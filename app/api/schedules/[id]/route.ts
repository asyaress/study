import { unlink } from "node:fs/promises";
import type { RowDataPacket } from "mysql2/promise";
import { getCurrentUser, unauthorized } from "@/lib/auth";
import { db } from "@/lib/db";
import { deleteSchedule, updateSchedule } from "@/lib/schedule-repository";
import { cleanSchedulePayload } from "@/lib/schedule-validation";
import { PublicError, clientMessage, rejectCrossSite, requireJson, safeId, storedUploadPath } from "@/lib/security";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: Context) {
  const crossSite = rejectCrossSite(request);
  if (crossSite) return crossSite;
  const json = requireJson(request);
  if (json) return json;
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const scheduleId = safeId((await context.params).id);
    if (!scheduleId) return Response.json({ message: "Jadwal tidak valid." }, { status: 400 });
    const payload = cleanSchedulePayload(await request.json());
    const updated = await updateSchedule(scheduleId, payload, user.id);
    return updated
      ? Response.json({ message: "Jadwal berhasil diperbarui." })
      : Response.json({ message: "Jadwal tidak ditemukan." }, { status: 404 });
  } catch (error) {
    console.error(error);
    return Response.json(
      { message: clientMessage(error, "Jadwal gagal diperbarui.") },
      { status: error instanceof PublicError ? 400 : 500 },
    );
  }
}

export async function DELETE(request: Request, context: Context) {
  const crossSite = rejectCrossSite(request);
  if (crossSite) return crossSite;
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const scheduleId = safeId((await context.params).id);
  if (!scheduleId) return Response.json({ message: "Jadwal tidak valid." }, { status: 400 });
  const [files] = await db.query<(RowDataPacket & { stored_name: string })[]>(
    `SELECT a.stored_name
       FROM attachments a
       JOIN schedules s ON s.id = a.schedule_id
      WHERE a.schedule_id = ? AND s.user_id = ?`,
    [scheduleId, user.id],
  );
  const removed = await deleteSchedule(scheduleId, user.id);
  if (removed) {
    await Promise.all(files.map(async (file) => {
      try {
        await unlink(storedUploadPath(scheduleId, file.stored_name));
      } catch {
        // File mungkin sudah tidak ada; data jadwal tetap berhasil dihapus.
      }
    }));
  }
  return removed
    ? Response.json({ message: "Jadwal dihapus." })
    : Response.json({ message: "Jadwal tidak ditemukan." }, { status: 404 });
}
