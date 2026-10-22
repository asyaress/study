import "server-only";

import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { db } from "@/lib/db";
import type { ColorTone, MaterialRecord } from "@/lib/models";
import { PublicError } from "@/lib/security";

export const MAX_FILES_PER_USER = 200;

type MaterialRow = RowDataPacket & {
  id: number;
  category: "materi" | "catatan";
  original_name: string;
  size_bytes: number;
  note: string | null;
  schedule_id: number | null;
  course_id: number | null;
  material_date: string | null;
  course_code: string | null;
  course_name: string | null;
  course_color: ColorTone | null;
  schedule_title: string | null;
};

export async function countUserFiles(userId: number) {
  const [rows] = await db.query<(RowDataPacket & { total: number })[]>(
    `SELECT COUNT(*) AS total
       FROM attachments a
       LEFT JOIN schedules s ON s.id = a.schedule_id
       LEFT JOIN courses c ON c.id = a.course_id
      WHERE s.user_id = ? OR (a.schedule_id IS NULL AND c.user_id = ?)`,
    [userId, userId],
  );
  return Number(rows[0]?.total ?? 0);
}

export async function listMaterials(userId: number): Promise<MaterialRecord[]> {
  const [rows] = await db.query<MaterialRow[]>(
    `SELECT a.id, a.category, a.original_name, a.size_bytes, a.note, a.schedule_id,
            COALESCE(a.course_id, s.course_id) AS course_id,
            DATE_FORMAT(COALESCE(a.material_date, s.schedule_date), '%Y-%m-%d') AS material_date,
            c.code AS course_code, c.name AS course_name,
            COALESCE(c.color, s.color, 'berry') AS course_color,
            s.title AS schedule_title
       FROM attachments a
       LEFT JOIN schedules s ON s.id = a.schedule_id
       LEFT JOIN courses c ON c.id = COALESCE(a.course_id, s.course_id)
      WHERE s.user_id = ? OR (a.schedule_id IS NULL AND c.user_id = ?)
      ORDER BY material_date DESC, c.name, a.id DESC
      LIMIT 500`,
    [userId, userId],
  );
  return rows.map((row) => ({
    id: Number(row.id),
    courseId: row.course_id === null ? null : Number(row.course_id),
    courseCode: row.course_code,
    courseName: row.course_name,
    color: row.course_color ?? "berry",
    date: row.material_date ?? "",
    scheduleId: row.schedule_id === null ? null : Number(row.schedule_id),
    scheduleTitle: row.schedule_title,
    category: row.category,
    originalName: row.original_name,
    sizeBytes: Number(row.size_bytes),
    note: row.note,
  }));
}

export async function createMaterial(input: {
  userId: number;
  courseId: number;
  date: string;
  originalName: string;
  storedName: string;
  sizeBytes: number;
  filePath: string;
  note: string | null;
}) {
  const [owned] = await db.query<(RowDataPacket & { total: number })[]>(
    "SELECT COUNT(*) AS total FROM courses WHERE id = ? AND user_id = ?",
    [input.courseId, input.userId],
  );
  if (Number(owned[0]?.total ?? 0) === 0) throw new PublicError("Mata kuliah tidak ditemukan.");
  if (await countUserFiles(input.userId) >= MAX_FILES_PER_USER) {
    throw new PublicError("Jumlah file sudah mencapai batas.");
  }
  const [result] = await db.execute<ResultSetHeader>(
    `INSERT INTO attachments
      (schedule_id, course_id, material_date, category, original_name, stored_name, mime_type, size_bytes, file_path, note)
     VALUES (NULL, ?, ?, 'materi', ?, ?, NULL, ?, ?, ?)`,
    [
      input.courseId,
      input.date,
      input.originalName,
      input.storedName,
      input.sizeBytes,
      input.filePath,
      input.note,
    ],
  );
  return Number(result.insertId);
}
