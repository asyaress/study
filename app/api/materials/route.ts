import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getCurrentUser, unauthorized } from "@/lib/auth";
import { createMaterial, listMaterials } from "@/lib/material-repository";
import { assertCourseOwned } from "@/lib/schedule-repository";
import { isDate } from "@/lib/schedule-validation";
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

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const materials = await listMaterials(user.id);
  return Response.json({ materials }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
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

    const form = await request.formData();
    const courseId = safeId(String(form.get("courseId") ?? ""));
    const date = String(form.get("date") ?? "");
    const note = String(form.get("note") ?? "").trim().slice(0, 240);
    const file = form.get("file");
    if (!courseId) throw new PublicError("Pilih mata kuliah terlebih dahulu.");
    if (!isDate(date)) throw new PublicError("Tanggal tidak valid.");
    if (!(file instanceof File)) throw new PublicError("Pilih file terlebih dahulu.");
    if (file.size === 0) throw new PublicError("File kosong tidak bisa diunggah.");
    if (file.size > MAX_FILE_SIZE) throw new PublicError("Ukuran file maksimal 25 MB.");
    const extension = fileExtension(file.name);
    if (!extension) throw new PublicError("Jenis file ini tidak didukung. Pakai PDF, gambar, atau dokumen.");
    await assertCourseOwned(courseId, user.id);

    const storedName = `${randomUUID()}${extension}`;
    const folder = `c${courseId}`;
    const targetPath = storedUploadPath(folder, storedName);
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, Buffer.from(await file.arrayBuffer()));

    const id = await createMaterial({
      userId: user.id,
      courseId,
      date,
      originalName: path.basename(file.name).slice(0, 180),
      storedName,
      sizeBytes: file.size,
      filePath: path.posix.join("storage", "uploads", folder, storedName),
      note: note || null,
    });
    return Response.json({ id, message: "Materi berhasil ditambahkan." }, { status: 201 });
  } catch (error) {
    console.error(error);
    return Response.json(
      { message: clientMessage(error, "Materi gagal ditambahkan.") },
      { status: error instanceof PublicError ? 400 : 500 },
    );
  }
}
