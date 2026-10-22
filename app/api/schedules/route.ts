import { getCurrentUser, unauthorized } from "@/lib/auth";
import { createSchedule, listCourses, listSchedules } from "@/lib/schedule-repository";
import { assertDateRange, cleanSchedulePayload } from "@/lib/schedule-validation";
import { PublicError, clientMessage, rejectCrossSite, requireJson } from "@/lib/security";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const { searchParams } = new URL(request.url);
    const today = new Date().toISOString().slice(0, 10);
    const start = searchParams.get("start") ?? today;
    const end = searchParams.get("end") ?? start;
    assertDateRange(start, end);
    const [schedules, courses] = await Promise.all([
      listSchedules(start, end, user.id),
      listCourses(user.id),
    ]);
    return Response.json({ schedules, courses }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error(error);
    return Response.json(
      { message: clientMessage(error, "Database belum bisa dibaca.") },
      { status: error instanceof PublicError ? 400 : 500 },
    );
  }
}

export async function POST(request: Request) {
  const crossSite = rejectCrossSite(request);
  if (crossSite) return crossSite;
  const json = requireJson(request);
  if (json) return json;
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const payload = cleanSchedulePayload(await request.json());
    const id = await createSchedule(payload, user.id);
    return Response.json({ id, message: "Jadwal berhasil dibuat." }, { status: 201 });
  } catch (error) {
    console.error(error);
    return Response.json(
      { message: clientMessage(error, "Jadwal gagal dibuat.") },
      { status: error instanceof PublicError ? 400 : 500 },
    );
  }
}
