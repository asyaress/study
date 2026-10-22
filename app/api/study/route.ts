import { getCurrentUser, unauthorized } from "@/lib/auth";
import {
  getActiveStudySession,
  listStudyHistory,
  startStudySession,
} from "@/lib/study-repository";
import {
  PublicError,
  clientMessage,
  rateLimit,
  rejectCrossSite,
  requireJson,
  safeId,
} from "@/lib/security";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const [active, history] = await Promise.all([
    getActiveStudySession(user.id),
    listStudyHistory(user.id),
  ]);
  return Response.json(
    { active, history },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(request: Request) {
  const crossSite = rejectCrossSite(request);
  if (crossSite) return crossSite;
  const json = requireJson(request);
  if (json) return json;
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const limit = rateLimit(`study:${user.id}`, 30, 60 * 60 * 1000);
    if (!limit.ok) {
      return Response.json(
        { message: "Terlalu banyak sesi. Tunggu sebentar." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter), "Cache-Control": "no-store" } },
      );
    }
    const input = await request.json() as Record<string, unknown>;
    const courseId = safeId(String(input.courseId ?? ""));
    const materialValue = input.materialId;
    const materialId = materialValue == null || materialValue === ""
      ? null
      : safeId(String(materialValue));
    if (!courseId) throw new PublicError("Pilih mata kuliah terlebih dahulu.");
    if (materialValue != null && materialValue !== "" && !materialId) {
      throw new PublicError("Materi tidak valid.");
    }
    const session = await startStudySession(user.id, courseId, materialId);
    return Response.json({ session }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error(error);
    return Response.json(
      { message: clientMessage(error, "Belajar gagal dimulai.") },
      { status: error instanceof PublicError ? 400 : 500 },
    );
  }
}
