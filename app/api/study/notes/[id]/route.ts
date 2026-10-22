import { readFile } from "node:fs/promises";
import { getCurrentUser, unauthorized } from "@/lib/auth";
import { getStudyNote } from "@/lib/study-repository";
import {
  contentDisposition,
  rejectCrossSite,
  safeDownloadType,
  safeId,
  storedUploadPath,
} from "@/lib/security";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  const crossSite = rejectCrossSite(request);
  if (crossSite) return crossSite;
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const noteId = safeId((await context.params).id);
  if (!noteId) return new Response("Catatan tidak valid.", { status: 400 });
  const record = await getStudyNote(noteId, user.id);
  if (!record) return new Response("Catatan tidak ditemukan.", { status: 404 });
  try {
    const body = await readFile(storedUploadPath(`s${record.session_id}`, record.stored_name));
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
    return new Response("Catatan tidak ditemukan di penyimpanan.", { status: 404 });
  }
}
