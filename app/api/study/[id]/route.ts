import { getCurrentUser, unauthorized } from "@/lib/auth";
import {
  deleteStudySession,
  finishStudySession,
  pauseStudySession,
  resumeStudySession,
} from "@/lib/study-repository";
import {
  PublicError,
  clientMessage,
  rejectCrossSite,
  requireJson,
  safeId,
} from "@/lib/security";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const crossSite = rejectCrossSite(request);
  if (crossSite) return crossSite;
  const json = requireJson(request);
  if (json) return json;
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const sessionId = safeId((await context.params).id);
    if (!sessionId) throw new PublicError("Sesi belajar tidak valid.");
    const input = await request.json() as Record<string, unknown>;
    const action = String(input.action ?? "");
    if (action === "pause") {
      return Response.json({ session: await pauseStudySession(sessionId, user.id) });
    }
    if (action === "resume") {
      return Response.json({ session: await resumeStudySession(sessionId, user.id) });
    }
    if (action === "finish") {
      const summary = String(input.summary ?? "").trim().slice(0, 500);
      return Response.json({
        session: await finishStudySession(sessionId, user.id, summary || null),
      });
    }
    throw new PublicError("Perintah tidak dikenal.");
  } catch (error) {
    console.error(error);
    return Response.json(
      { message: clientMessage(error, "Sesi belajar gagal diperbarui.") },
      { status: error instanceof PublicError ? 400 : 500 },
    );
  }
}

export async function DELETE(request: Request, context: Context) {
  const crossSite = rejectCrossSite(request);
  if (crossSite) return crossSite;
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const sessionId = safeId((await context.params).id);
  if (!sessionId) return Response.json({ message: "Sesi belajar tidak valid." }, { status: 400 });
  const removed = await deleteStudySession(sessionId, user.id);
  return removed
    ? Response.json({ message: "Riwayat dihapus." })
    : Response.json({ message: "Sesi belajar tidak ditemukan." }, { status: 404 });
}
