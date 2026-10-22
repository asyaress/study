"use client";

import { Download, FileText, Pause, Play, Timer, Trash2, Upload, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { FilePreview } from "@/components/file-preview";
import { ThemeSelect } from "@/components/theme-select";
import type { CourseRecord, MaterialRecord, StudySession } from "@/lib/models";

function clock(total: number) {
  const safe = Math.max(0, total);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

function spoken(total: number) {
  const safe = Math.max(0, total);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  if (hours > 0) return `${hours} jam ${minutes} menit`;
  if (minutes > 0) return `${minutes} menit ${seconds} detik`;
  return `${seconds} detik`;
}

function elapsed(session: StudySession, nowMs: number) {
  if (session.status === "done") return session.durationSeconds;
  const end = session.status === "paused" && session.pausedAt
    ? session.pausedAt
    : Math.floor(nowMs / 1000);
  return Math.max(0, end - session.startedAt - session.pausedSeconds);
}

function formatBytes(value: number) {
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function formatLongDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, day, 12));
}

export function StudyPage({
  courses,
  materials,
  query,
  notify,
}: {
  courses: CourseRecord[];
  materials: MaterialRecord[];
  query: string;
  notify: (text: string, error?: boolean) => void;
}) {
  const [active, setActive] = useState<StudySession | null>(null);
  const [history, setHistory] = useState<StudySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [starting, setStarting] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [pausedForFinish, setPausedForFinish] = useState(false);
  const [courseId, setCourseId] = useState(courses[0] ? String(courses[0].id) : "");
  const [materialId, setMaterialId] = useState<number | null>(null);
  const [summary, setSummary] = useState("");
  const [noteFiles, setNoteFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [openPreview, setOpenPreview] = useState<number | null>(null);

  const load = async () => {
    const response = await fetch("/api/study", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.message || "Belajar belum bisa dibuka.");
    setActive(body.active ?? null);
    setHistory(body.history ?? []);
  };

  useEffect(() => {
    let cancelled = false;
    fetch("/api/study", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.message || "Belajar belum bisa dibuka.");
        return body;
      })
      .then((body) => {
        if (cancelled) return;
        setActive(body.active ?? null);
        setHistory(body.history ?? []);
      })
      .catch((error: unknown) => {
        if (!cancelled) notify(error instanceof Error ? error.message : "Belajar belum bisa dibuka.", true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [notify]);

  useEffect(() => {
    if (active?.status !== "running") return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active?.id, active?.status]);

  useEffect(() => {
    document.body.style.overflow = starting || finishing ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [finishing, starting]);

  const choices = materials.filter(
    (item) => item.category === "materi" && item.courseId === Number(courseId),
  );
  const seconds = active ? elapsed(active, now) : 0;
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const todaySeconds = useMemo(() => {
    const done = history
      .filter((item) => item.startedOn === todayKey)
      .reduce((total, item) => total + item.durationSeconds, 0);
    const current = active && active.startedOn === todayKey ? elapsed(active, now) : 0;
    return done + current;
  }, [active, history, now, todayKey]);
  const needle = query.trim().toLocaleLowerCase("id-ID");
  const visibleHistory = history.filter((item) => {
    if (!needle) return true;
    return `${item.courseName ?? ""} ${item.materialName ?? ""} ${item.summary ?? ""}`
      .toLocaleLowerCase("id-ID")
      .includes(needle);
  });

  const patch = async (id: number, action: "pause" | "resume" | "finish", note = "") => {
    const response = await fetch(`/api/study/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, summary: note }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.message || "Sesi belajar gagal diperbarui.");
    return body.session as StudySession;
  };

  const begin = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/study", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: Number(courseId),
          materialId,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "Belajar gagal dimulai.");
      setActive(body.session);
      setStarting(false);
      setNow(Date.now());
    } catch (error) {
      notify(error instanceof Error ? error.message : "Belajar gagal dimulai.", true);
    } finally {
      setSaving(false);
    }
  };

  const openFinish = async () => {
    if (!active) return;
    try {
      if (active.status === "running") {
        setActive(await patch(active.id, "pause"));
        setPausedForFinish(true);
      } else {
        setPausedForFinish(false);
      }
      setSummary("");
      setNoteFiles([]);
      setFinishing(true);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Sesi belajar gagal dijeda.", true);
    }
  };

  const cancelFinish = async () => {
    if (active && pausedForFinish) {
      try {
        setActive(await patch(active.id, "resume"));
      } catch (error) {
        notify(error instanceof Error ? error.message : "Sesi belajar gagal dilanjut.", true);
      }
    }
    setPausedForFinish(false);
    setFinishing(false);
  };

  const saveFinish = async () => {
    if (!active) return;
    setSaving(true);
    try {
      let session = await patch(active.id, "finish", summary);
      for (const file of noteFiles.slice(0, 8)) {
        const form = new FormData();
        form.set("file", file);
        const response = await fetch(`/api/study/${active.id}/notes`, { method: "POST", body: form });
        const body = await response.json();
        if (!response.ok) throw new Error(body.message || "Catatan gagal disimpan.");
        session = body.session;
      }
      setActive(null);
      setFinishing(false);
      setPausedForFinish(false);
      await load();
      notify("Sesi belajar disimpan.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Sesi belajar gagal disimpan.", true);
      await load().catch(() => undefined);
    } finally {
      setSaving(false);
    }
  };

  const removeHistory = async (id: number) => {
    if (!window.confirm("Hapus riwayat ini? Catatannya ikut terhapus.")) return;
    const response = await fetch(`/api/study/${id}`, { method: "DELETE" });
    const body = await response.json();
    if (!response.ok) {
      notify(body.message || "Riwayat gagal dihapus.", true);
      return;
    }
    setHistory((current) => current.filter((item) => item.id !== id));
    notify("Riwayat dihapus.");
  };

  return (
    <section className="simple-page study-page">
      <div className="page-header">
        <div>
          <h1>Belajar</h1>
        </div>
        {!active && (
          <button className="material-add" onClick={() => setStarting(true)} disabled={courses.length === 0}>
            <Play size={18} /> Mulai
          </button>
        )}
      </div>

      <div className="study-today">
        <span>Hari ini</span>
        <strong>{spoken(todaySeconds)}</strong>
      </div>

      {loading ? (
        <div className="calendar-skeleton">
          <div />
          <div />
        </div>
      ) : active ? (
        <div className="study-live">
          <div className={`study-live-head tone-${active.color}`}>
            <span>{active.courseCode || "Belajar"}</span>
            <strong>{active.courseName}</strong>
            {active.materialName && <small>{active.materialName}</small>}
          </div>
          <p className="study-timer" aria-live="off">{clock(seconds)}</p>
          <div className="study-actions">
            {active.status === "running" ? (
              <button
                className="study-pause"
                onClick={() => void patch(active.id, "pause").then(setActive).catch((error: unknown) => {
                  notify(error instanceof Error ? error.message : "Sesi belajar gagal dijeda.", true);
                })}
              >
                <Pause size={18} /> Jeda
              </button>
            ) : (
              <button
                className="study-pause"
                onClick={() => void patch(active.id, "resume").then((session) => {
                  setActive(session);
                  setNow(Date.now());
                }).catch((error: unknown) => {
                  notify(error instanceof Error ? error.message : "Sesi belajar gagal dilanjut.", true);
                })}
              >
                <Play size={18} /> Lanjut
              </button>
            )}
            <button className="material-add" onClick={() => void openFinish()}>
              Selesai
            </button>
          </div>
          {active.materialId && (
            <div className="study-preview">
              <FilePreview href={`/api/files/${active.materialId}`} name={active.materialName || "Materi"} />
            </div>
          )}
        </div>
      ) : null}

      <div className="study-history">
        <h2>Riwayat</h2>
        {visibleHistory.length === 0 ? (
          <div className="page-empty">
            <Timer size={28} />
            <strong>Belum ada riwayat</strong>
          </div>
        ) : (
          visibleHistory.map((item) => (
            <article className="study-card" key={item.id}>
              <header>
                <i className={`schedule-accent ${item.color}`} />
                <div>
                  <strong>{item.courseName || "Mata kuliah"}</strong>
                  <small>
                    {formatLongDate(item.startedOn)} · {item.startedTime}
                    {item.endedTime ? `–${item.endedTime}` : ""}
                  </small>
                </div>
                <b>{clock(item.durationSeconds)}</b>
              </header>
              {item.materialName && (
                <p className="study-line">
                  <FileText size={15} /> {item.materialName}
                  {item.materialDate ? ` · ${formatLongDate(item.materialDate)}` : ""}
                </p>
              )}
              {item.pausedSeconds > 0 && <p className="study-line">Jeda {spoken(item.pausedSeconds)}</p>}
              {item.summary && <p className="study-summary">{item.summary}</p>}
              {item.notes.length > 0 && (
                <div className="study-notes">
                  {item.notes.map((note) => (
                    <a key={note.id} href={`/api/study/notes/${note.id}`}>
                      <Download size={15} />
                      <span>{note.originalName}</span>
                      <small>{formatBytes(note.sizeBytes)}</small>
                    </a>
                  ))}
                </div>
              )}
              <div className="study-card-actions">
                {item.materialId && (
                  <button onClick={() => setOpenPreview((current) => current === item.id ? null : item.id)}>
                    {openPreview === item.id ? "Tutup materi" : "Lihat materi"}
                  </button>
                )}
                <button onClick={() => void removeHistory(item.id)} aria-label="Hapus riwayat">
                  <Trash2 size={15} /> Hapus
                </button>
              </div>
              {openPreview === item.id && item.materialId && (
                <div className="study-preview">
                  <FilePreview href={`/api/files/${item.materialId}`} name={item.materialName || "Materi"} />
                </div>
              )}
            </article>
          ))
        )}
      </div>

      {starting && (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setStarting(false)}>
          <div className="modal-card" role="dialog" aria-modal="true">
            <span className="sheet-handle" />
            <div className="modal-head">
              <div>
                <span className="modal-icon"><Timer size={19} /></span>
                <div><h2>Mulai belajar</h2></div>
              </div>
              <button onClick={() => setStarting(false)} aria-label="Tutup"><X size={20} /></button>
            </div>
            <form
              className="schedule-form"
              onSubmit={(event) => {
                event.preventDefault();
                void begin();
              }}
            >
              <label className="full-field">
                <span>Mata kuliah</span>
                <ThemeSelect
                  required
                  value={courseId}
                  onChange={(next) => {
                    setCourseId(next);
                    setMaterialId(null);
                  }}
                  options={
                    courses.length === 0
                      ? [{ value: "", label: "Belum ada mata kuliah" }]
                      : courses.map((course) => ({
                          value: String(course.id),
                          label: course.name,
                        }))
                  }
                />
              </label>
              <div className="study-pick" role="listbox" aria-label="Materi">
                <button
                  type="button"
                  aria-pressed={materialId === null}
                  onClick={() => setMaterialId(null)}
                >
                  Tanpa file
                </button>
                {choices.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    aria-pressed={materialId === item.id}
                    onClick={() => setMaterialId(item.id)}
                  >
                    <strong>{item.originalName}</strong>
                    <small>{item.date ? formatLongDate(item.date) : ""}</small>
                  </button>
                ))}
              </div>
              <div className="form-actions">
                <button type="button" className="cancel-button" onClick={() => setStarting(false)}>Batal</button>
                <button className="save-button" disabled={saving || courses.length === 0}>
                  {saving ? "Menyimpan..." : "Mulai"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {finishing && active && (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && void cancelFinish()}>
          <div className="modal-card" role="dialog" aria-modal="true">
            <span className="sheet-handle" />
            <div className="modal-head">
              <div>
                <span className="modal-icon"><Timer size={19} /></span>
                <div><h2>{clock(elapsed(active, now))}</h2></div>
              </div>
              <button onClick={() => void cancelFinish()} aria-label="Tutup"><X size={20} /></button>
            </div>
            <form
              className="schedule-form"
              onSubmit={(event) => {
                event.preventDefault();
                void saveFinish();
              }}
            >
              <label className="full-field">
                <span>Catatan</span>
                <textarea
                  rows={3}
                  maxLength={500}
                  value={summary}
                  onChange={(event) => setSummary(event.target.value)}
                  placeholder="Catatan"
                />
              </label>
              <label className="upload-box">
                <input
                  type="file"
                  multiple
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.csv,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip"
                  onChange={(event) => setNoteFiles(Array.from(event.target.files ?? []).slice(0, 8))}
                />
                <span><Upload size={21} /></span>
                <strong>
                  {noteFiles.length ? noteFiles.map((file) => file.name).join(", ") : "Unggah catatan"}
                </strong>
                <small>PDF, foto, atau dokumen. Maksimal 25 MB.</small>
              </label>
              <div className="form-actions">
                <button type="button" className="cancel-button" onClick={() => void cancelFinish()}>Batal</button>
                <button className="save-button" disabled={saving}>
                  {saving ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
