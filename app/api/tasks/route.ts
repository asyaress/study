import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { getCurrentUser, unauthorized } from "@/lib/auth";
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
import { addTaskFile, createTask, deleteTask, listTasks } from "@/lib/task-repository";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const MAX_FILES = 4;

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const date = new URL(request.url).searchParams.get("date") ?? "";
  if (!isDate(date)) {
    return Response.json({ message: "Tanggal tidak valid." }, { status: 400 });
  }
  const tasks = await listTasks(user.id, date);
  return Response.json({ tasks }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const crossSite = rejectCrossSite(request);
  if (crossSite) return crossSite;
  const written: string[] = [];
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const uploadLimit = rateLimit(`upload:${user.id}:${clientIp(request)}`, 10, 10 * 60 * 1000);
    if (!uploadLimit.ok) return tooManyRequests(uploadLimit.retryAfter);

    const form = await request.formData();
    const date = String(form.get("date") ?? "");
    const detail = String(form.get("detail") ?? "").trim().slice(0, 2000);
    const courseValue = String(form.get("courseId") ?? "");
    const courseId = courseValue ? safeId(courseValue) : null;
    const files = form.getAll("file").filter((item): item is File => item instanceof File && item.size > 0).slice(0, MAX_FILES);
    if (!isDate(date)) throw new PublicError("Tanggal tidak valid.");
    if (!detail) throw new PublicError("Isi detail tugas.");
    if (courseValue && !courseId) throw new PublicError("Mata kuliah tidak valid.");
    if (courseId) await assertCourseOwned(courseId, user.id);
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) throw new PublicError("Ukuran file maksimal 25 MB.");
      if (!fileExtension(file.name)) throw new PublicError("Jenis file ini tidak didukung. Pakai foto, PDF, atau dokumen.");
    }

    const taskId = await createTask({ userId: user.id, courseId, date, detail });
    try {
      for (const file of files) {
        const extension = fileExtension(file.name);
        if (!extension) continue;
        const storedName = `${randomUUID()}${extension}`;
        const targetPath = storedUploadPath(`t${taskId}`, storedName);
        await mkdir(path.dirname(targetPath), { recursive: true });
        await writeFile(targetPath, Buffer.from(await file.arrayBuffer()));
        written.push(targetPath);
        await addTaskFile({
          taskId,
          originalName: path.basename(file.name).slice(0, 180),
          storedName,
          sizeBytes: file.size,
          filePath: path.posix.join("storage", "uploads", `t${taskId}`, storedName),
        });
      }
    } catch (error) {
      await Promise.all(written.map((item) => unlink(item).catch(() => undefined)));
      await deleteTask(taskId, user.id);
      throw error;
    }
    return Response.json({ id: taskId, message: "Tugas disimpan." }, { status: 201 });
  } catch (error) {
    console.error(error);
    return Response.json(
      { message: clientMessage(error, "Tugas gagal disimpan.") },
      { status: error instanceof PublicError ? 400 : 500 },
    );
  }
}
