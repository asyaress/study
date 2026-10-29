"use client";

import { Download, Eye, FileText } from "lucide-react";
import { useMemo, useState } from "react";
import { FilePreview } from "@/components/file-preview";
import type { MaterialRecord } from "@/lib/models";

function formatBytes(value: number) {
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function formatLongDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, day, 12));
}

function mtLabel(value: number) {
  return `MT ${String(value).padStart(2, "0")}`;
}

function canPreview(name: string) {
  return /\.(pdf|png|jpe?g|gif|webp|pptx)$/i.test(name);
}

export function ExamPage({
  materials,
  query,
  loading,
}: {
  materials: MaterialRecord[];
  query: string;
  loading: boolean;
}) {
  const exams = useMemo(() => {
    const numbers = new Set<number>();
    for (const item of materials) {
      if (item.mtStatus === "confirmed" && item.mtNumber) numbers.add(item.mtNumber);
    }
    return [...numbers].sort((left, right) => left - right);
  }, [materials]);
  const unconfirmedCount = materials.filter((item) => item.mtStatus === "unconfirmed").length;
  const [picked, setPicked] = useState<number | "belum" | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const selected = picked === "belum" && unconfirmedCount > 0
    ? "belum"
    : typeof picked === "number" && exams.includes(picked)
      ? picked
      : exams[0] ?? (unconfirmedCount ? "belum" : null);

  const needle = query.trim().toLocaleLowerCase("id-ID");
  const visible = materials.filter((item) => {
    const inGroup = selected === "belum"
      ? item.mtStatus === "unconfirmed"
      : item.mtStatus === "confirmed" && item.mtNumber === selected;
    if (!inGroup) return false;
    if (!needle) return true;
    return `${item.topic ?? ""} ${item.originalName} ${item.courseName ?? ""} ${item.courseCode ?? ""} ${item.note ?? ""}`
      .toLocaleLowerCase("id-ID")
      .includes(needle);
  });
  const grouped = new Map<string, MaterialRecord[]>();
  for (const item of visible) {
    const key = String(item.courseId ?? 0);
    const list = grouped.get(key) ?? [];
    list.push(item);
    grouped.set(key, list);
  }
  const courseNames = [...new Set(visible.map((item) => item.courseName).filter(Boolean))];

  return (
    <section className="simple-page materi-page">
      <div className="page-header">
        <div>
          <h1>Ujian</h1>
        </div>
      </div>
      <div className="course-chips" role="tablist" aria-label="Pilih nomor MT">
        {exams.map((number) => {
          const count = materials.filter(
            (item) => item.mtStatus === "confirmed" && item.mtNumber === number,
          ).length;
          return (
            <button
              key={number}
              className={selected === number ? "active" : ""}
              onClick={() => {
                setPicked(number);
                setOpenId(null);
              }}
            >
              <em>{mtLabel(number)}</em>
              <span>{count}</span>
            </button>
          );
        })}
        {unconfirmedCount > 0 && (
          <button
            className={selected === "belum" ? "active" : ""}
            onClick={() => {
              setPicked("belum");
              setOpenId(null);
            }}
          >
            <em>Belum jelas</em>
            <span>{unconfirmedCount}</span>
          </button>
        )}
      </div>
      {loading ? (
        <div className="calendar-skeleton">
          <div />
          <div />
        </div>
      ) : selected === null ? (
        <div className="page-empty">
          <FileText size={28} />
          <strong>Belum ada kelompok ujian</strong>
        </div>
      ) : visible.length === 0 ? (
        <div className="page-empty">
          <FileText size={28} />
          <strong>Tidak ada materi untuk pencarian ini</strong>
        </div>
      ) : (
        <>
          <p className="exam-summary">
            {selected === "belum"
              ? `${visible.length} berkas belum punya nomor MT, jadi belum masuk kelompok ujian.`
              : `${visible.length} materi ${mtLabel(selected)}${courseNames.length ? ` · ${courseNames.join(", ")}` : ""}`}
          </p>
          <div className="material-groups">
            {[...grouped.entries()].map(([key, items]) => {
              const first = items[0];
              return (
                <section className="material-course" key={key}>
                  <header className="material-course-head">
                    <i className={`schedule-accent ${first.color}`} />
                    <div>
                      <strong>{first.courseName ?? "Tanpa mata kuliah"}</strong>
                      <small>
                        {first.courseCode ? `${first.courseCode} · ` : ""}
                        {items.length} file
                      </small>
                    </div>
                  </header>
                  {items.map((file) => (
                    <article className="exam-file" key={file.id}>
                      <div className="material-item exam-item">
                        <span className={`file-icon ${file.color}`}>
                          <FileText size={18} />
                        </span>
                        <span className="material-copy">
                          <strong>{file.topic || file.originalName}</strong>
                          <small>
                            {file.date ? `${formatLongDate(file.date)} · ` : ""}
                            {formatBytes(file.sizeBytes)}
                            {file.note ? ` · ${file.note}` : ""}
                          </small>
                        </span>
                        {canPreview(file.originalName) ? (
                          <button
                            onClick={() => setOpenId((current) => current === file.id ? null : file.id)}
                            aria-label={openId === file.id ? `Tutup ${file.topic || file.originalName}` : `Lihat ${file.topic || file.originalName}`}
                          >
                            <Eye size={17} />
                          </button>
                        ) : (
                          <span />
                        )}
                        <a href={`/api/files/${file.id}`} aria-label={`Unduh ${file.originalName}`}>
                          <Download size={17} />
                        </a>
                      </div>
                      {openId === file.id && (
                        <div className="study-preview">
                          <FilePreview href={`/api/files/${file.id}`} name={file.originalName} />
                        </div>
                      )}
                    </article>
                  ))}
                </section>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
