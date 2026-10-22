import "server-only";

import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { db } from "@/lib/db";
import { PublicError } from "@/lib/security";
import type { AttachmentRecord, ColorTone, CourseRecord, SchedulePayload, ScheduleRecord } from "@/lib/models";

type ScheduleRow = RowDataPacket & {
  id: number;
  course_id: number | null;
  course_code: string | null;
  course_name: string | null;
  title: string;
  schedule_date: string;
  start_time: string;
  end_time: string;
  location: string | null;
  description: string | null;
  color: ColorTone;
};

type AttachmentRow = RowDataPacket & {
  id: number;
  schedule_id: number;
  category: "materi" | "catatan";
  original_name: string;
  mime_type: string | null;
  size_bytes: number;
  created_at: string;
};

export async function listCourses(userId: number): Promise<CourseRecord[]> {
  const [rows] = await db.query<(RowDataPacket & CourseRecord)[]>(
    "SELECT id, code, name, lecturer, color FROM courses WHERE user_id = ? ORDER BY code",
    [userId],
  );
  return rows.map((row) => ({
    id: Number(row.id),
    code: row.code,
    name: row.name,
    lecturer: row.lecturer,
    color: row.color,
  }));
}

export async function listSchedules(start: string, end: string, userId: number): Promise<ScheduleRecord[]> {
  const [scheduleRows] = await db.query<ScheduleRow[]>(
    `SELECT s.id, s.course_id, c.code AS course_code, c.name AS course_name,
            s.title, s.schedule_date, TIME_FORMAT(s.start_time, '%H:%i') AS start_time,
            TIME_FORMAT(s.end_time, '%H:%i') AS end_time, s.location,
            s.description, s.color
       FROM schedules s
       LEFT JOIN courses c ON c.id = s.course_id
      WHERE s.user_id = ? AND s.schedule_date BETWEEN ? AND ?
      ORDER BY s.schedule_date, s.start_time
      LIMIT 2000`,
    [userId, start, end],
  );

  if (scheduleRows.length === 0) return [];

  const ids = scheduleRows.map((row) => row.id);
  const placeholders = ids.map(() => "?").join(",");
  const [attachmentRows] = await db.query<AttachmentRow[]>(
    `SELECT id, schedule_id, category, original_name, mime_type, size_bytes,
            DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s') AS created_at
       FROM attachments
      WHERE schedule_id IN (${placeholders})
      ORDER BY created_at DESC`,
    ids,
  );

  const attachmentsBySchedule = new Map<number, AttachmentRecord[]>();
  for (const row of attachmentRows) {
    const values = attachmentsBySchedule.get(row.schedule_id) ?? [];
    values.push({
      id: Number(row.id),
      scheduleId: Number(row.schedule_id),
      category: row.category,
      originalName: row.original_name,
      mimeType: row.mime_type,
      sizeBytes: Number(row.size_bytes),
      createdAt: row.created_at,
    });
    attachmentsBySchedule.set(row.schedule_id, values);
  }

  return scheduleRows.map((row) => ({
    id: Number(row.id),
    courseId: row.course_id === null ? null : Number(row.course_id),
    courseCode: row.course_code,
    courseName: row.course_name,
    title: row.title,
    date: row.schedule_date,
    startTime: row.start_time,
    endTime: row.end_time,
    location: row.location,
    description: row.description,
    color: row.color,
    attachments: attachmentsBySchedule.get(Number(row.id)) ?? [],
  }));
}

export async function assertCourseOwned(courseId: number | null, userId: number) {
  if (courseId === null) return;
  const [rows] = await db.query<(RowDataPacket & { total: number })[]>(
    "SELECT COUNT(*) AS total FROM courses WHERE id = ? AND user_id = ?",
    [courseId, userId],
  );
  if (Number(rows[0]?.total ?? 0) === 0) throw new PublicError("Mata kuliah tidak ditemukan.");
}

export async function createSchedule(payload: SchedulePayload, userId: number): Promise<number> {
  await assertCourseOwned(payload.courseId, userId);
  const [result] = await db.execute<ResultSetHeader>(
    `INSERT INTO schedules
      (user_id, course_id, title, schedule_date, start_time, end_time, location, description, color)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      payload.courseId,
      payload.title,
      payload.date,
      payload.startTime,
      payload.endTime,
      payload.location || null,
      payload.description || null,
      payload.color ?? "berry",
    ],
  );
  return Number(result.insertId);
}

export async function updateSchedule(id: number, payload: SchedulePayload, userId: number) {
  await assertCourseOwned(payload.courseId, userId);
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query<(RowDataPacket & {
      course_id: number | null;
      schedule_date: string;
      start_time: string;
      end_time: string;
    })[]>(
      `SELECT course_id, schedule_date,
              TIME_FORMAT(start_time, '%H:%i') AS start_time,
              TIME_FORMAT(end_time, '%H:%i') AS end_time
         FROM schedules
        WHERE id = ? AND user_id = ?
        FOR UPDATE`,
      [id, userId],
    );
    const current = rows[0];
    if (!current) {
      await connection.rollback();
      return false;
    }
    await connection.execute(
      `UPDATE schedules
          SET course_id = ?, title = ?, schedule_date = ?, start_time = ?, end_time = ?,
              location = ?, description = ?, color = ?
        WHERE id = ? AND user_id = ?`,
      [
        payload.courseId,
        payload.title,
        payload.date,
        payload.startTime,
        payload.endTime,
        payload.location || null,
        payload.description || null,
        payload.color ?? "berry",
        id,
        userId,
      ],
    );
    const sameCourse = current.course_id !== null && Number(current.course_id) === payload.courseId;
    const timeChanged = current.start_time !== payload.startTime || current.end_time !== payload.endTime;
    if (sameCourse && timeChanged) {
      await connection.execute(
        `UPDATE schedules
            SET start_time = ?, end_time = ?
          WHERE user_id = ?
            AND course_id = ?
            AND DAYOFWEEK(schedule_date) = DAYOFWEEK(?)
            AND TIME_FORMAT(start_time, '%H:%i') = ?
            AND id <> ?`,
        [
          payload.startTime,
          payload.endTime,
          userId,
          current.course_id,
          current.schedule_date,
          current.start_time,
          id,
        ],
      );
    }
    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    if (error instanceof Error && "code" in error && error.code === "ER_DUP_ENTRY") {
      throw new PublicError("Jam itu sudah dipakai jadwal lain.");
    }
    throw error;
  } finally {
    connection.release();
  }
}

export async function deleteSchedule(id: number, userId: number) {
  const [result] = await db.execute<ResultSetHeader>("DELETE FROM schedules WHERE id = ? AND user_id = ?", [id, userId]);
  return result.affectedRows > 0;
}
