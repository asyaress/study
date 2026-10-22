import "server-only";

import { unlink } from "node:fs/promises";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { db } from "@/lib/db";
import type { ColorTone, StudyNote, StudySession } from "@/lib/models";
import { PublicError, storedUploadPath } from "@/lib/security";

const MAX_NOTES = 8;

type SessionRow = RowDataPacket & {
  id: number;
  status: "running" | "paused" | "done";
  course_id: number | null;
  course_code: string | null;
  live_course_name: string | null;
  course_color: ColorTone | null;
  course_name: string | null;
  material_id: number | null;
  material_name: string | null;
  material_date: string | null;
  started_at: number;
  paused_at: number | null;
  paused_seconds: number;
  ended_at: number | null;
  duration_seconds: number;
  started_on: string;
  started_time: string;
  ended_time: string | null;
  summary: string | null;
};

type NoteRow = RowDataPacket & {
  id: number;
  session_id: number;
  original_name: string;
  size_bytes: number;
};

const sessionSelect = `
  SELECT s.id, s.status, s.course_id, c.code AS course_code, c.name AS live_course_name,
         COALESCE(c.color, 'berry') AS course_color, s.course_name,
         s.material_id, s.material_name,
         DATE_FORMAT(a.material_date, '%Y-%m-%d') AS material_date,
         UNIX_TIMESTAMP(s.started_at) AS started_at,
         UNIX_TIMESTAMP(s.paused_at) AS paused_at,
         s.paused_seconds,
         UNIX_TIMESTAMP(s.ended_at) AS ended_at,
         s.duration_seconds,
         DATE_FORMAT(s.started_at, '%Y-%m-%d') AS started_on,
         DATE_FORMAT(s.started_at, '%H:%i') AS started_time,
         DATE_FORMAT(s.ended_at, '%H:%i') AS ended_time,
         s.summary
    FROM study_sessions s
    LEFT JOIN courses c ON c.id = s.course_id
    LEFT JOIN attachments a ON a.id = s.material_id
`;

function mapSession(row: SessionRow, notes: StudyNote[]): StudySession {
  return {
    id: Number(row.id),
    status: row.status,
    courseId: row.course_id === null ? null : Number(row.course_id),
    courseName: row.live_course_name ?? row.course_name,
    courseCode: row.course_code,
    color: row.course_color ?? "berry",
    materialId: row.material_id === null ? null : Number(row.material_id),
    materialName: row.material_name,
    materialDate: row.material_date,
    startedAt: Number(row.started_at),
    pausedAt: row.paused_at === null ? null : Number(row.paused_at),
    pausedSeconds: Number(row.paused_seconds),
    endedAt: row.ended_at === null ? null : Number(row.ended_at),
    durationSeconds: Number(row.duration_seconds),
    startedOn: row.started_on,
    startedTime: row.started_time,
    endedTime: row.ended_time,
    summary: row.summary,
    notes,
  };
}

async function notesFor(sessionIds: number[]) {
  const grouped = new Map<number, StudyNote[]>();
  if (sessionIds.length === 0) return grouped;
  const [rows] = await db.query<NoteRow[]>(
    `SELECT id, session_id, original_name, size_bytes
       FROM study_notes
      WHERE session_id IN (${sessionIds.map(() => "?").join(",")})
      ORDER BY id`,
    sessionIds,
  );
  for (const row of rows) {
    const list = grouped.get(Number(row.session_id)) ?? [];
    list.push({
      id: Number(row.id),
      originalName: row.original_name,
      sizeBytes: Number(row.size_bytes),
    });
    grouped.set(Number(row.session_id), list);
  }
  return grouped;
}

export async function getStudySession(id: number, userId: number) {
  const [rows] = await db.query<SessionRow[]>(
    `${sessionSelect} WHERE s.id = ? AND s.user_id = ? LIMIT 1`,
    [id, userId],
  );
  const row = rows[0];
  if (!row) return null;
  const notes = await notesFor([Number(row.id)]);
  return mapSession(row, notes.get(Number(row.id)) ?? []);
}

export async function getActiveStudySession(userId: number) {
  const [rows] = await db.query<SessionRow[]>(
    `${sessionSelect}
      WHERE s.user_id = ? AND s.status IN ('running', 'paused')
      ORDER BY s.id DESC
      LIMIT 1`,
    [userId],
  );
  const row = rows[0];
  if (!row) return null;
  const notes = await notesFor([Number(row.id)]);
  return mapSession(row, notes.get(Number(row.id)) ?? []);
}

export async function listStudyHistory(userId: number) {
  const [rows] = await db.query<SessionRow[]>(
    `${sessionSelect}
      WHERE s.user_id = ? AND s.status = 'done'
      ORDER BY s.started_at DESC
      LIMIT 80`,
    [userId],
  );
  const notes = await notesFor(rows.map((row) => Number(row.id)));
  return rows.map((row) => mapSession(row, notes.get(Number(row.id)) ?? []));
}

async function ownedMaterial(materialId: number, userId: number) {
  const [rows] = await db.query<(RowDataPacket & { course_id: number | null; original_name: string })[]>(
    `SELECT COALESCE(a.course_id, s.course_id) AS course_id, a.original_name
       FROM attachments a
       LEFT JOIN schedules s ON s.id = a.schedule_id
       LEFT JOIN courses c ON c.id = COALESCE(a.course_id, s.course_id)
      WHERE a.id = ?
        AND (s.user_id = ? OR (a.schedule_id IS NULL AND c.user_id = ?))
      LIMIT 1`,
    [materialId, userId, userId],
  );
  return rows[0] ?? null;
}

export async function startStudySession(userId: number, courseId: number, materialId: number | null) {
  const active = await getActiveStudySession(userId);
  if (active) return active;

  const [courses] = await db.query<(RowDataPacket & { name: string })[]>(
    "SELECT name FROM courses WHERE id = ? AND user_id = ? LIMIT 1",
    [courseId, userId],
  );
  const course = courses[0];
  if (!course) throw new PublicError("Mata kuliah tidak ditemukan.");

  let materialName: string | null = null;
  if (materialId) {
    const material = await ownedMaterial(materialId, userId);
    if (!material) throw new PublicError("Materi tidak ditemukan.");
    if (material.course_id !== null && Number(material.course_id) !== courseId) {
      throw new PublicError("Materi ini bukan bagian dari mata kuliah itu.");
    }
    materialName = material.original_name;
  }

  const [result] = await db.execute<ResultSetHeader>(
    `INSERT INTO study_sessions
      (user_id, course_id, material_id, course_name, material_name, status, started_at)
     VALUES (?, ?, ?, ?, ?, 'running', NOW())`,
    [userId, courseId, materialId, course.name, materialName],
  );
  const session = await getStudySession(Number(result.insertId), userId);
  if (!session) throw new PublicError("Sesi belajar gagal dibuat.");
  return session;
}

export async function pauseStudySession(id: number, userId: number) {
  await db.execute<ResultSetHeader>(
    `UPDATE study_sessions
        SET status = 'paused', paused_at = NOW()
      WHERE id = ? AND user_id = ? AND status = 'running'`,
    [id, userId],
  );
  const session = await getStudySession(id, userId);
  if (!session) throw new PublicError("Sesi belajar tidak ditemukan.");
  return session;
}

export async function resumeStudySession(id: number, userId: number) {
  await db.execute<ResultSetHeader>(
    `UPDATE study_sessions
        SET status = 'running',
            paused_seconds = paused_seconds + TIMESTAMPDIFF(SECOND, paused_at, NOW()),
            paused_at = NULL
      WHERE id = ? AND user_id = ? AND status = 'paused'`,
    [id, userId],
  );
  const session = await getStudySession(id, userId);
  if (!session) throw new PublicError("Sesi belajar tidak ditemukan.");
  return session;
}

export async function finishStudySession(id: number, userId: number, summary: string | null) {
  const [result] = await db.execute<ResultSetHeader>(
    `UPDATE study_sessions
        SET duration_seconds = GREATEST(
              0,
              TIMESTAMPDIFF(SECOND, started_at, IF(status = 'paused', paused_at, NOW())) - CAST(paused_seconds AS SIGNED)
            ),
            ended_at = NOW(),
            status = 'done',
            paused_at = NULL,
            summary = ?
      WHERE id = ? AND user_id = ? AND status IN ('running', 'paused')`,
    [summary, id, userId],
  );
  if (result.affectedRows === 0) {
    const existing = await getStudySession(id, userId);
    if (!existing) throw new PublicError("Sesi belajar tidak ditemukan.");
    return existing;
  }
  const session = await getStudySession(id, userId);
  if (!session) throw new PublicError("Sesi belajar tidak ditemukan.");
  return session;
}

export async function addStudyNote(input: {
  sessionId: number;
  userId: number;
  originalName: string;
  storedName: string;
  sizeBytes: number;
  filePath: string;
}) {
  const session = await getStudySession(input.sessionId, input.userId);
  if (!session) throw new PublicError("Sesi belajar tidak ditemukan.");
  if (session.notes.length >= MAX_NOTES) throw new PublicError("Catatan pada sesi ini sudah mencapai batas.");
  try {
    await db.execute<ResultSetHeader>(
      `INSERT INTO study_notes (session_id, original_name, stored_name, size_bytes, file_path)
       VALUES (?, ?, ?, ?, ?)`,
      [input.sessionId, input.originalName, input.storedName, input.sizeBytes, input.filePath],
    );
  } catch (error) {
    await unlink(storedUploadPath(`s${input.sessionId}`, input.storedName)).catch(() => undefined);
    throw error;
  }
  return getStudySession(input.sessionId, input.userId);
}

export async function getStudyNote(id: number, userId: number) {
  const [rows] = await db.query<(RowDataPacket & {
    session_id: number;
    original_name: string;
    stored_name: string;
  })[]>(
    `SELECT n.session_id, n.original_name, n.stored_name
       FROM study_notes n
       JOIN study_sessions s ON s.id = n.session_id
      WHERE n.id = ? AND s.user_id = ?
      LIMIT 1`,
    [id, userId],
  );
  return rows[0] ?? null;
}

export async function deleteStudySession(id: number, userId: number) {
  const [notes] = await db.query<(RowDataPacket & { session_id: number; stored_name: string })[]>(
    `SELECT n.session_id, n.stored_name
       FROM study_notes n
       JOIN study_sessions s ON s.id = n.session_id
      WHERE s.id = ? AND s.user_id = ?`,
    [id, userId],
  );
  const [result] = await db.execute<ResultSetHeader>(
    "DELETE FROM study_sessions WHERE id = ? AND user_id = ?",
    [id, userId],
  );
  if (result.affectedRows === 0) return false;
  await Promise.all(notes.map(async (note) => {
    await unlink(storedUploadPath(`s${note.session_id}`, note.stored_name)).catch(() => undefined);
  }));
  return true;
}
