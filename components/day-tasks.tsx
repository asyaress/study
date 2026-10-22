"use client";

import { Trash2, Upload, X } from "lucide-react";
import { useEffect, useState } from "react";
import { FilePreview } from "@/components/file-preview";
import { ThemeSelect } from "@/components/theme-select";
import type { CourseRecord, TaskRecord } from "@/lib/models";

export function DayTasks({
  date,
  courses,
  notify,
}: {
  date: string;
  courses: CourseRecord[];
  notify: (text: string, error?: boolean) => void;
}) {
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [open, setOpen] = useState(false);
  const [courseId, setCourseId] = useState("");
  const [detail, setDetail] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const response = await fetch(`/api/tasks?date=${date}`, { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.message || "Tugas belum bisa dibuka.");
    setTasks(body.tasks ?? []);
  };

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/tasks?date=${date}`, { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.message || "Tugas belum bisa dibuka.");
        return body;
      })
      .then((body) => {
        if (!cancelled) setTasks(body.tasks ?? []);
      })
      .catch((error: unknown) => {
        if (!cancelled) notify(error instanceof Error ? error.message : "Tugas belum bisa dibuka.", true);
      });
    return () => {
      cancelled = true;
    };
  }, [date, notify]);

  const save = async () => {
    setSaving(true);
    try {
      const form = new FormData();
      form.set("date", date);
      form.set("detail", detail);
      if (courseId) form.set("courseId", courseId);
      for (const file of files.slice(0, 4)) form.append("file", file);
      const response = await fetch("/api/tasks", { method: "POST", body: form });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "Tugas gagal disimpan.");
      setOpen(false);
      setDetail("");
      setFiles([]);
      await load();
      notify("Tugas disimpan.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Tugas gagal disimpan.", true);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    if (!window.confirm("Hapus tugas ini?")) return;
    const response = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    const body = await response.json();
    if (!response.ok) {
      notify(body.message || "Tugas gagal dihapus.", true);
      return;
    }
    setTasks((current) => current.filter((item) => item.id !== id));
    notify("Tugas dihapus.");
  };

  return (
    <section className="day-tasks">
      <div className="page-header">
        <h2>Tugas</h2>
        <button className="material-add" type="button" onClick={() => setOpen(true)}>
          <Upload size={18} /> Tambah tugas
        </button>
      </div>
      {tasks.length === 0 ? (
        <div className="page-empty">
          <strong>Belum ada tugas</strong>
        </div>
      ) : (
        tasks.map((task) => (
          <article className="study-card" key={task.id}>
            <header>
              <i className={`schedule-accent ${task.color}`} />
              <div>
                <strong>{task.courseName || "Tugas"}</strong>
                {task.courseCode ? <small>{task.courseCode}</small> : null}
              </div>
            </header>
            <p className="study-summary">{task.detail}</p>
            {task.files.map((file) => (
              <div className="study-preview" key={file.id}>
                <FilePreview href={`/api/tasks/files/${file.id}`} name={file.originalName} />
              </div>
            ))}
            <div className="study-card-actions">
              <button type="button" onClick={() => void remove(task.id)}>
                <Trash2 size={15} /> Hapus
              </button>
            </div>
          </article>
        ))
      )}
      {open && (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
          <div className="modal-card" role="dialog" aria-modal="true">
            <span className="sheet-handle" />
            <div className="modal-head">
              <div>
                <h2>Tugas</h2>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Tutup"><X size={20} /></button>
            </div>
            <form
              className="schedule-form"
              onSubmit={(event) => {
                event.preventDefault();
                void save();
              }}
            >
              <label className="full-field">
                <span>Mata kuliah</span>
                <ThemeSelect
                  value={courseId}
                  onChange={setCourseId}
                  placeholder="Tidak dipilih"
                  options={[
                    { value: "", label: "Tidak dipilih" },
                    ...courses.map((course) => ({ value: String(course.id), label: course.name })),
                  ]}
                />
              </label>
              <label className="full-field">
                <span>Detail</span>
                <textarea
                  required
                  rows={4}
                  maxLength={2000}
                  value={detail}
                  onChange={(event) => setDetail(event.target.value)}
                />
              </label>
              <label className="upload-box">
                <input
                  type="file"
                  multiple
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.ppt,.pptx"
                  onChange={(event) => setFiles(Array.from(event.target.files ?? []).slice(0, 4))}
                />
                <span><Upload size={21} /></span>
                <strong>{files.length ? files.map((file) => file.name).join(", ") : "Foto atau PDF"}</strong>
                <small>Maksimal 25 MB.</small>
              </label>
              <div className="form-actions">
                <button type="button" className="cancel-button" onClick={() => setOpen(false)}>Batal</button>
                <button className="save-button" disabled={saving}>{saving ? "Menyimpan..." : "Simpan"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
