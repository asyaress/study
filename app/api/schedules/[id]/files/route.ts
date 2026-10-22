import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getCurrentUser, unauthorized } from "@/lib/auth";
import { db } from "@/lib/db";
import { MAX_FILES_PER_USER, countUserFiles } from "@/lib/material-repository";
import {
  PublicError,
  clientIp,
  clientMessage,
  fileExtension,
  rateLimit,
  rejectCrossSite,
  safeId,
  storedUploadPath,
  tooManyRequests,
} from "@/lib/security";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 25 * 1024 * 1024;
type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const crossSite = rejectCrossSite(request);
  if (crossSite) return crossSite;
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const uploadLimit = rateLimit(`upload:${user.id}:${clientIp(request)}`, 10, 10 * 60 * 1000);
    if (!uploadLimit.ok) return tooManyRequests(uploadLimit.retryAfter);

    const declaredLength = Number(request.headers.get("content-length") ?? 0);
    if (Number.isFinite(declaredLength) && declaredLength > MAX_FILE_SIZE + 1024 * 1024) {
      throw new PublicError("Ukuran file maksimal 25 MB.");
    }

    const scheduleId = safeId((await context.params).id);
    if (!scheduleId) throw new PublicError("Jadwal tidak valid.");
    const [owned] = await db.query<(RowDataPacket & { course_id: number | null; schedule_date: string })[]>(
      "SELECT course_id, DATE_FORMAT(schedule_date, '%Y-%m-%d') AS schedule_date FROM schedules WHERE id = ? AND user_id = ? LIMIT 1",
      [scheduleId, user.id],
    );
    const schedule = owned[0];
    if (!schedule) {
      return Response.json({ message: "Jadwal tidak ditemukan." }, { status: 404 });
    }
    if (await countUserFiles(user.id) >= MAX_FILES_PER_USER) {
      throw new PublicError("Jumlah file sudah mencapai batas.");
    }

    const form = await request.formData();
    const file = form.get("file");
    const category = form.get("category") === "catatan" ? "catatan" : "materi";
    if (!(file instanceof File)) throw new PublicError("Pilih file terlebih dahulu.");
    if (file.size === 0) throw new PublicError("File kosong tidak bisa diunggah.");
    if (file.size > MAX_FILE_SIZE) throw new PublicError("Ukuran file maksimal 25 MB.");
    const extension = fileExtension(file.name);
    if (!extension) throw new PublicError("Jenis file ini tidak didukung. Pakai PDF, gambar, atau dokumen.");

    const storedName = `${randomUUID()}${extension}`;
    const targetPath = storedUploadPath(scheduleId, storedName);
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, Buffer.from(await file.arrayBuffer()));

    const relativePath = path.posix.join("storage", "uploads", String(scheduleId), storedName);
    const [result] = await db.execute<ResultSetHeader>(
      `INSERT INTO attachments
        (schedule_id, course_id, material_date, category, original_name, stored_name, mime_type, size_bytes, file_path)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        scheduleId,
        schedule.course_id,
        schedule.schedule_date,
        category,
        path.basename(file.name).slice(0, 180),
        storedName,
        null,
        file.size,
        relativePath,
      ],
    );

    return Response.json({ id: Number(result.insertId), message: "File berhasil diunggah." }, { status: 201 });
  } catch (error) {
    console.error(error);
    return Response.json(
      { message: clientMessage(error, "File gagal diunggah.") },
      { status: error instanceof PublicError ? 400 : 500 },
    );
  }
}
