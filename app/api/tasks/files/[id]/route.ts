import { readFile } from "node:fs/promises";
import { getCurrentUser, unauthorized } from "@/lib/auth";
import {
  contentDisposition,
  rejectCrossSite,
  safeDownloadType,
  safeId,
  storedUploadPath,
} from "@/lib/security";
import { getTaskFile } from "@/lib/task-repository";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  const crossSite = rejectCrossSite(request);
  if (crossSite) return crossSite;
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const fileId = safeId((await context.params).id);
  if (!fileId) return new Response("File tidak valid.", { status: 400 });
  const record = await getTaskFile(fileId, user.id);
  if (!record) return new Response("File tidak ditemukan.", { status: 404 });
  try {
    const body = await readFile(storedUploadPath(`t${record.task_id}`, record.stored_name));
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
