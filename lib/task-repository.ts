import "server-only";

import { unlink } from "node:fs/promises";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { db } from "@/lib/db";
import type { ColorTone, TaskFile, TaskRecord } from "@/lib/models";
import { storedUploadPath } from "@/lib/security";

type TaskRow = RowDataPacket & {
  id: number;
  course_id: number | null;
  course_name: string | null;
  course_code: string | null;
  color: ColorTone | null;
  task_date: string;
  detail: string;
};

type FileRow = RowDataPacket & {
  id: number;
  task_id: number;
  original_name: string;
  stored_name: string;
  size_bytes: number;
};

async function filesFor(taskIds: number[]) {
  const grouped = new Map<number, TaskFile[]>();
  if (taskIds.length === 0) return grouped;
  const [rows] = await db.query<FileRow[]>(
    `SELECT id, task_id, original_name, size_bytes
       FROM task_files
      WHERE task_id IN (${taskIds.map(() => "?").join(",")})
      ORDER BY id`,
    taskIds,
  );
  for (const row of rows) {
    const list = grouped.get(Number(row.task_id)) ?? [];
    list.push({
      id: Number(row.id),
      originalName: row.original_name,
      sizeBytes: Number(row.size_bytes),
    });
    grouped.set(Number(row.task_id), list);
  }
  return grouped;
}

function mapTask(row: TaskRow, files: TaskFile[]): TaskRecord {
  return {
    id: Number(row.id),
    courseId: row.course_id === null ? null : Number(row.course_id),
    courseName: row.course_name,
    courseCode: row.course_code,
    color: row.color ?? "berry",
    date: row.task_date,
    detail: row.detail,
    files,
  };
}

export async function listTasks(userId: number, date: string) {
  const [rows] = await db.query<TaskRow[]>(
    `SELECT t.id, t.course_id, c.name AS course_name, c.code AS course_code,
            c.color, DATE_FORMAT(t.task_date, '%Y-%m-%d') AS task_date, t.detail
       FROM tasks t
       LEFT JOIN courses c ON c.id = t.course_id
      WHERE t.user_id = ? AND t.task_date = ?
      ORDER BY t.id DESC`,
    [userId, date],
  );
  const files = await filesFor(rows.map((row) => Number(row.id)));
  return rows.map((row) => mapTask(row, files.get(Number(row.id)) ?? []));
}

export async function createTask(input: {
  userId: number;
  courseId: number | null;
  date: string;
  detail: string;
}) {
  const [result] = await db.execute<ResultSetHeader>(
    `INSERT INTO tasks (user_id, course_id, task_date, detail)
     VALUES (?, ?, ?, ?)`,
    [input.userId, input.courseId, input.date, input.detail],
  );
  return Number(result.insertId);
}

export async function addTaskFile(input: {
  taskId: number;
  originalName: string;
  storedName: string;
  sizeBytes: number;
  filePath: string;
}) {
  await db.execute(
    `INSERT INTO task_files (task_id, original_name, stored_name, size_bytes, file_path)
     VALUES (?, ?, ?, ?, ?)`,
    [input.taskId, input.originalName, input.storedName, input.sizeBytes, input.filePath],
  );
}

export async function getTaskFile(id: number, userId: number) {
  const [rows] = await db.query<(RowDataPacket & {
    task_id: number;
    original_name: string;
    stored_name: string;
  })[]>(
    `SELECT f.task_id, f.original_name, f.stored_name
       FROM task_files f
       JOIN tasks t ON t.id = f.task_id
      WHERE f.id = ? AND t.user_id = ?
      LIMIT 1`,
    [id, userId],
  );
  return rows[0] ?? null;
}

export async function deleteTask(id: number, userId: number) {
  const [files] = await db.query<FileRow[]>(
    `SELECT f.task_id, f.stored_name
       FROM task_files f
       JOIN tasks t ON t.id = f.task_id
      WHERE t.id = ? AND t.user_id = ?`,
    [id, userId],
  );
  const [result] = await db.execute<ResultSetHeader>(
    "DELETE FROM tasks WHERE id = ? AND user_id = ?",
    [id, userId],
  );
  if (result.affectedRows === 0) return false;
  await Promise.all(files.map(async (file) => {
    await unlink(storedUploadPath(`t${file.task_id}`, file.stored_name)).catch(() => undefined);
  }));
  return true;
}
