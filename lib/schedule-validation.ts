import type { ColorTone, SchedulePayload } from "@/lib/models";
import { PublicError } from "@/lib/security";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
const tones: ColorTone[] = ["berry", "violet", "lime", "sky", "orange"];

export function isDate(value: string) {
  return datePattern.test(value);
}

export function assertDateRange(start: string, end: string) {
  if (!isDate(start) || !isDate(end) || start > end) {
    throw new PublicError("Rentang tanggal tidak valid.");
  }
  const span = Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`);
  if (!Number.isFinite(span) || span > 400 * 24 * 60 * 60 * 1000) {
    throw new PublicError("Rentang tanggal terlalu panjang.");
  }
}

export function cleanSchedulePayload(value: unknown): SchedulePayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new PublicError("Data jadwal tidak valid.");
  }
  const input = value as Record<string, unknown>;
  const title = String(input.title ?? "").trim();
  const date = String(input.date ?? "");
  const startTime = String(input.startTime ?? "");
  const endTime = String(input.endTime ?? "");
  const color = tones.includes(input.color as ColorTone) ? input.color as ColorTone : "berry";
  const courseId = input.courseId == null || input.courseId === "" ? null : Number(input.courseId);

  if (!title) throw new PublicError("Nama jadwal wajib diisi.");
  if (!datePattern.test(date)) throw new PublicError("Tanggal tidak valid.");
  if (!timePattern.test(startTime) || !timePattern.test(endTime)) throw new PublicError("Jam tidak valid.");
  if (endTime <= startTime) throw new PublicError("Jam selesai harus setelah jam mulai.");
  if (courseId !== null && (!Number.isSafeInteger(courseId) || courseId < 1)) {
    throw new PublicError("Mata kuliah tidak valid.");
  }

  return {
    courseId,
    title: title.slice(0, 180),
    date,
    startTime,
    endTime,
    location: String(input.location ?? "").trim().slice(0, 120),
    description: String(input.description ?? "").trim().slice(0, 4000),
    color,
  };
}
