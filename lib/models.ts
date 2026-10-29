export type ColorTone = "berry" | "violet" | "lime" | "sky" | "orange";

export type UserProfile = {
  id: number;
  name: string;
  username: string;
};

export type CourseRecord = {
  id: number;
  code: string;
  name: string;
  lecturer: string | null;
  color: ColorTone;
};

export type AttachmentRecord = {
  id: number;
  scheduleId: number;
  category: "materi" | "catatan";
  originalName: string;
  mimeType: string | null;
  sizeBytes: number;
  createdAt: string;
};

export type ScheduleRecord = {
  id: number;
  courseId: number | null;
  courseCode: string | null;
  courseName: string | null;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string | null;
  description: string | null;
  color: ColorTone;
  attachments: AttachmentRecord[];
};

export type MaterialRecord = {
  id: number;
  courseId: number | null;
  courseCode: string | null;
  courseName: string | null;
  color: ColorTone;
  date: string;
  scheduleId: number | null;
  scheduleTitle: string | null;
  category: "materi" | "catatan";
  originalName: string;
  sizeBytes: number;
  note: string | null;
  mtNumber: number | null;
  mtStatus: "confirmed" | "unconfirmed" | null;
  topic: string | null;
};

export type StudyNote = {
  id: number;
  originalName: string;
  sizeBytes: number;
};

export type StudySession = {
  id: number;
  status: "running" | "paused" | "done";
  courseId: number | null;
  courseName: string | null;
  courseCode: string | null;
  color: ColorTone;
  materialId: number | null;
  materialName: string | null;
  materialDate: string | null;
  startedAt: number;
  pausedAt: number | null;
  pausedSeconds: number;
  endedAt: number | null;
  durationSeconds: number;
  startedOn: string;
  startedTime: string;
  endedTime: string | null;
  summary: string | null;
  notes: StudyNote[];
};

export type TaskFile = {
  id: number;
  originalName: string;
  sizeBytes: number;
};

export type TaskRecord = {
  id: number;
  courseId: number | null;
  courseName: string | null;
  courseCode: string | null;
  color: ColorTone;
  date: string;
  detail: string;
  files: TaskFile[];
};

export type SchedulePayload = {
  courseId: number | null;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location?: string;
  description?: string;
  color?: ColorTone;
};
