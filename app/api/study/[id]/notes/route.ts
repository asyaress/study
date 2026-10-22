import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getCurrentUser, unauthorized } from "@/lib/auth";
import { addStudyNote } from "@/lib/study-repository";
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
    const uploadLimit = rateLimit(`study-note:${user.id}:${clientIp(request)}`, 10, 10 * 60 * 1000);
    if (!uploadLimit.ok) return tooManyRequests(uploadLimit.retryAfter);

    const sessionId = safeId((await context.params).id);
    if (!sessionId) throw new PublicError("Sesi belajar tidak valid.");
    const declaredLength = Number(request.headers.get("content-length") ?? 0);
    if (Number.isFinite(declaredLength) && declaredLength > MAX_FILE_SIZE + 1024 * 1024) {
      throw new PublicError("Ukuran file maksimal 25 MB.");
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new PublicError("Pilih file terlebih dahulu.");
    if (file.size === 0) throw new PublicError("File kosong tidak bisa diunggah.");
    if (file.size > MAX_FILE_SIZE) throw new PublicError("Ukuran file maksimal 25 MB.");
    const extension = fileExtension(file.name);
    if (!extension) throw new PublicError("Jenis file ini tidak didukung. Pakai PDF, gambar, atau dokumen.");

    const storedName = `${randomUUID()}${extension}`;
    const folder = `s${sessionId}`;
    const targetPath = storedUploadPath(folder, storedName);
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, Buffer.from(await file.arrayBuffer()));

    const session = await addStudyNote({
      sessionId,
      userId: user.id,
      originalName: path.basename(file.name).slice(0, 180),
      storedName,
      sizeBytes: file.size,
      filePath: path.posix.join("storage", "uploads", folder, storedName),
    });
    return Response.json({ session, message: "Catatan berhasil disimpan." }, { status: 201 });
  } catch (error) {
    console.error(error);
    return Response.json(
      { message: clientMessage(error, "Catatan gagal disimpan.") },
      { status: error instanceof PublicError ? 400 : 500 },
    );
  }
}
