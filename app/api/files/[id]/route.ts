import { readFile, unlink } from "node:fs/promises";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getCurrentUser, unauthorized } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  contentDisposition,
  rejectCrossSite,
  safeDownloadType,
  safeId,
  storedUploadPath,
} from "@/lib/security";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };
type FileRow = RowDataPacket & {
  schedule_id: number | null;
  course_id: number | null;
  original_name: string;
  stored_name: string;
};

function fileFolder(record: FileRow) {
  if (record.schedule_id) return record.schedule_id;
  if (record.course_id) return `c${record.course_id}`;
  throw new Error("File tidak punya lokasi penyimpanan.");
}

async function getFile(id: number, userId: number) {
  const [rows] = await db.query<FileRow[]>(
    `SELECT a.schedule_id, a.course_id, a.original_name, a.stored_name
       FROM attachments a
       LEFT JOIN schedules s ON s.id = a.schedule_id
       LEFT JOIN courses c ON c.id = a.course_id
      WHERE a.id = ?
        AND (s.user_id = ? OR (a.schedule_id IS NULL AND c.user_id = ?))
      LIMIT 1`,
    [id, userId, userId],
  );
  return rows[0] ?? null;
}

export async function GET(request: Request, context: Context) {
  const crossSite = rejectCrossSite(request);
  if (crossSite) return crossSite;
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const fileId = safeId((await context.params).id);
  if (!fileId) return new Response("File tidak valid.", { status: 400 });
  const record = await getFile(fileId, user.id);
  if (!record) return new Response("File tidak ditemukan.", { status: 404 });
  try {
    const absolutePath = storedUploadPath(fileFolder(record), record.stored_name);
    const body = await readFile(absolutePath);
    return new Response(body, {
      headers: {
        "Content-Type": safeDownloadType(record.stored_name),
        "Content-Disposition": contentDisposition(record.original_name),
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
        "Content-Security-Policy": "default-src 'none'",
      },
    });
  } catch {
    return new Response("File tidak ditemukan di penyimpanan.", { status: 404 });
  }
}

export async function DELETE(request: Request, context: Context) {
  const crossSite = rejectCrossSite(request);
  if (crossSite) return crossSite;
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const fileId = safeId((await context.params).id);
  if (!fileId) return Response.json({ message: "File tidak valid." }, { status: 400 });
  const record = await getFile(fileId, user.id);
  if (!record) return Response.json({ message: "File tidak ditemukan." }, { status: 404 });

  await db.execute<ResultSetHeader>("DELETE FROM attachments WHERE id = ?", [fileId]);
  try {
    await unlink(storedUploadPath(fileFolder(record), record.stored_name));
  } catch {
    // Metadata tetap dibersihkan jika file fisiknya sudah tidak ada.
  }
  return Response.json({ message: "File dihapus." });
}
