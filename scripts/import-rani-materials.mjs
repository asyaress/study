import { randomUUID } from "node:crypto";
import { copyFile, mkdir, readdir, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { readFileSync } from "node:fs";
import mysql from "mysql2/promise";

const ROOT = path.resolve("ppt-20261029T121303Z-1-001/ppt");

/** Pembagian mengikuti audit 25 Oktober 2026. Nomor MT hanya diisi jika tertulis di slide atau nama file. */
const CATALOG = {
  "A. AGAMA-HINDU/Makalah_Seni_Keagamaan_Hindu_Revisi_Dosen klmpok 10.docx": {
    course: "AGAMA",
    topic: "Makalah Seni Keagamaan Hindu",
    status: "unconfirmed",
    note: "Nomor MT belum tertulis di berkas.",
  },
  "A. AGAMA-HINDU/SENIN-14-09-2026/materi kuliah agama hindu 2026.docx": {
    course: "AGAMA",
    date: "2026-09-14",
    topic: "Daftar pokok bahasan Agama Hindu",
    status: "unconfirmed",
    note: "Nomor topik 1–10 bukan label MT.",
  },
  "A. Kewarganegaraan/SENIN-21-09-2026/Pancasila 1.pdf": {
    course: "PANCASILA",
    date: "2026-09-21",
    topic: "Pancasila – materi awal",
    status: "unconfirmed",
    note: "Nomor MT belum tertulis di berkas.",
  },
  "A. Kewarganegaraan/29-09/Pancasila Pertemuan 2.pdf": {
    course: "PANCASILA",
    date: "2026-09-29",
    topic: "Pancasila – sistem nilai dan etika politik",
    status: "unconfirmed",
    note: "Pertemuan 2 bukan nomor MT.",
  },
  "A. Kewarganegaraan/SELASA-22-09/RPS KEWARGANEGARAAN - Revisi.docx": {
    course: "KEWIRA",
    date: "2026-09-22",
    topic: "RPS Kewarganegaraan",
    status: "unconfirmed",
    note: "Dokumen rencana, bukan materi bertanda MT.",
  },
  "A. Kewarganegaraan/SELASA-22-09/RTM_Kewarganegaraan bhs indo.docx": {
    course: "KEWIRA",
    date: "2026-09-22",
    topic: "Rencana Tugas Mahasiswa",
    status: "unconfirmed",
    note: "Dokumen tugas, bukan materi bertanda MT.",
  },
  "A. Kewarganegaraan/Makalah_Integrasi_Nasional_Indonesia by me.docx": {
    course: "KEWIRA",
    topic: "Makalah Integrasi Nasional",
    status: "unconfirmed",
    note: "Nomor MT belum tertulis di berkas.",
  },
  "A. ILMU-DASAR-KEDOK-2/2-OKT/KULIAH   2026 SRUKTUR ORGANISASI DAN FUNGSI SEL.pptx": {
    course: "HISTOLOGI",
    date: "2026-10-02",
    topic: "Histologi: struktur, organisasi, dan fungsi sel",
    status: "unconfirmed",
    note: "Salinan identik di folder lain tidak dimasukkan.",
  },
  "A. ILMU-DASAR-KEDOK-2/KULIAH   2026 SRUKTUR ORGANISASI DAN FUNGSI SEL.pptx": { skip: "duplikat struktur sel" },
  "A. ILMU-DASAR-KEDOK-2/2-OKT/KULIAH  JARINGAN  EPITHEL DAN KELENJAR NEW OKT 2.pptx": {
    course: "HISTOLOGI",
    date: "2026-10-02",
    topic: "Histologi: jaringan epitel dan kelenjar",
    status: "unconfirmed",
    note: "Salinan identik di folder lain tidak dimasukkan.",
  },
  "A. ILMU-DASAR-KEDOK-1/KULIAH  JARINGAN  EPITHEL DAN KELENJAR NEW OKT 2.pptx": { skip: "duplikat jaringan epitel" },
  "A. ILMU-DASAR-KEDOK-2/2-OKT/Nervous System (Anatomi) - drg. virtika (2026).pptx": {
    course: "ANATOMI",
    date: "2026-10-02",
    topic: "Anatomi: sistem saraf",
    status: "unconfirmed",
    note: "Nomor MT belum tertulis di berkas.",
  },
  "A. ILMU-DASAR-KEDOK-2/25-SEP/Hematolymphoid System 2026 - NV.pdf": {
    course: "HISTOLOGI",
    date: "2026-09-25",
    topic: "Sistem hematolimfoid",
    status: "unconfirmed",
    note: "Nomor MT belum tertulis di berkas.",
  },
  "A. ILMU-DASAR-KEDOK-2/25-SEP/Medical Terminology.pptm": {
    course: "HISTOLOGI",
    date: "2026-09-25",
    topic: "Terminologi medis",
    status: "unconfirmed",
    note: "Nomor MT belum tertulis di berkas.",
  },
  "A. ILMU-DASAR-KEDOK-2/25-SEP/KULIAH 2026 HUMAN ANATOMY & ORGAN.pptx": {
    course: "ANATOMI",
    date: "2026-09-25",
    topic: "Anatomi tubuh manusia dan organ",
    status: "unconfirmed",
    note: "Nomor MT belum tertulis di berkas.",
  },
  "A. ILMU-DASAR-KEDOK-1/MT06_PENDIDIKAN KESEHATAN GIGI BERDASARKAN KARAKTERISTIK SASARAN DAN SIKLUS KEHIDUPAN.pptx": {
    course: "PKG",
    mt: 6,
    topic: "Pendidikan berdasarkan karakteristik sasaran dan siklus kehidupan",
    status: "confirmed",
    note: "Berkas ada di folder lain; isinya Pendidikan Kesehatan Gigi.",
  },
  "A. ILMU-DASAR-KEDOK-1/1-09/MT 06 Pendidikan Kesehatan Gigi, Pemilihan Media.pptx": {
    course: "PKG",
    date: "2026-09-01",
    mt: 6,
    topic: "Pengembangan media pendidikan kesehatan gigi dan digital health",
    status: "confirmed",
    note: "Berkas ada di folder lain; isinya Pendidikan Kesehatan Gigi.",
  },
  "A. ILMU-DASAR-KEDOK-1/1-09/MT 05 Etika hubungan drg-pasien.pptx": {
    course: "BIOETIK",
    date: "2026-09-01",
    mt: 5,
    topic: "Etika hubungan dokter gigi–pasien",
    status: "confirmed",
    note: "Berkas ada di folder lain; isinya Bioetik.",
  },
  "A. ILMU-DASAR-KEDOK-1/08-10/SYSTEMA LOCOMOTORIUM.pdf": {
    course: "ANATOMI",
    date: "2026-10-08",
    topic: "Sistem lokomotor: otot, tulang, dan sendi",
    status: "unconfirmed",
    note: "Nomor MT belum tertulis di berkas.",
  },
  "A. ILMU-DASAR-KEDOK-1/Anatomi kelenjar endokrin.pptx": {
    course: "ANATOMI",
    date: "2026-10-22",
    topic: "Anatomi kelenjar endokrin",
    status: "unconfirmed",
    note: "Nomor MT belum tertulis di 51 slide.",
  },
  "A. PKG/7-OKT/Blood & Lymphatic vessel - NV 26.pdf": {
    course: "ANATOMI",
    date: "2026-10-07",
    topic: "Anatomi pembuluh darah dan limfe",
    status: "unconfirmed",
    note: "Berkas ada di folder PKG; isinya anatomi. Nomor MT belum tertulis.",
  },
  "A. PKG/7-OKT/Cor - NV 26.pdf": {
    course: "ANATOMI",
    date: "2026-10-07",
    topic: "Anatomi jantung",
    status: "unconfirmed",
    note: "Berkas ada di folder PKG; isinya anatomi. Nomor MT belum tertulis.",
  },
  "A. PKG/23-SEP/MODUL PENGANTAR PENDIDIKAN KESEHATAN GIGI GANJIL 26.pdf": {
    course: "PKG",
    date: "2026-09-23",
    topic: "Modul pengantar Pendidikan Kesehatan Gigi",
    status: "unconfirmed",
    note: "Mencakup banyak topik, tidak otomatis satu nomor MT.",
  },
  "A. PKG/23-SEP/PPT_Konsep_Determinan_Perilaku_Kesehatan_Gigi_S1_FKG.pdf": {
    course: "PKG",
    date: "2026-09-23",
    topic: "Determinan perilaku kesehatan gigi",
    status: "unconfirmed",
    note: "Nomor MT belum tertulis di berkas.",
  },
  "A. PKG/17-SEP-2026/KONSEP PEMBERDAYAAN MSY MT 6 2026 GANJIL.pptx": {
    course: "PKG",
    date: "2026-09-17",
    mt: 6,
    topic: "Pemberdayaan masyarakat dan community engagement",
    status: "confirmed",
  },
  "A. PKG/MT 6 Metode pendidikan & edukasi kesehatan gigi 19 - 10 - 2026.ppt": {
    course: "PKG",
    date: "2026-10-19",
    mt: 6,
    topic: "Metode pendidikan dan edukasi kesehatan gigi",
    status: "confirmed",
  },
  "A. PKG/MT 6 Perencanaan program pendidikan kesehatan gigi  MT 06 20-10-2026.ppt": {
    course: "PKG",
    date: "2026-10-20",
    mt: 6,
    topic: "Perencanaan program pendidikan kesehatan gigi",
    status: "confirmed",
  },
  "A. PKG/Sistem Informasi Kedokteran Gigi Modern.pptx": {
    course: "PKG",
    date: "2026-10-21",
    mt: 6,
    topic: "Sistem informasi kedokteran gigi modern",
    status: "confirmed",
  },
  "A. BIOETIK/22-SEP/Prinsip-prinsip Bioetika(MT05).pptx": {
    course: "BIOETIK",
    date: "2026-09-22",
    mt: 5,
    topic: "Prinsip-prinsip bioetika",
    status: "confirmed",
  },
  "A. BIOETIK/SELASA-15-09-2026/PDF MT 05 drg Kaka Konsep Dasar Bioetik dan Profesionalisme.pdf": {
    course: "BIOETIK",
    date: "2026-09-15",
    mt: 5,
    topic: "Konsep dasar bioetika dan profesionalisme",
    status: "confirmed",
  },
  "A. BIOETIK/TUGAS KASUS.docx": {
    course: "BIOETIK",
    topic: "Studi kasus tindakan kedokteran gigi",
    status: "unconfirmed",
    note: "Tugas kasus, nomor MT belum tertulis.",
  },
  "A. ETIKA-KEDOKTERAN-GIGI/WhatsApp Image 2026-09-22 at 12.01.38.jpeg": {
    course: "BIOETIK",
    date: "2026-09-22",
    topic: "Dokumentasi kasus prostetik dan informed consent",
    status: "unconfirmed",
    note: "Gambar kasus, nomor MT belum tertulis.",
  },
  "A. ILMU-DASAR-KEDOK-2/MT 8 Kelainan Kelenjar Saliva (1).pptx": {
    course: "HISTOLOGI",
    date: "2026-10-23",
    mt: 8,
    topic: "Kelainan kelenjar saliva",
    status: "confirmed",
  },
  "A. ILMU-DASAR-KEDOK-2/Anatomical Pathology - NV 26.pdf": {
    course: "PA",
    date: "2026-10-23",
    topic: "Fiksasi dan preparasi jaringan",
    status: "unconfirmed",
    note: "Nomor MT belum tertulis. Tidak digabung ke MT 08.",
  },
  "A. ADMINISTRASI-KULIAH/WhatsApp Image 2026-09-19 at 16.17.21.jpeg": { skip: "administrasi" },
  "A. ADMINISTRASI-KULIAH/sks kuliah Ni Luh Raniasih.pdf": { skip: "administrasi" },
  "A. ADMINISTRASI-KULIAH/IMG_1974.pdf": { skip: "administrasi" },
  "A. ADMINISTRASI-KULIAH/IMG_3430.pdf": { skip: "administrasi" },
};

function loadEnv() {
  return Object.fromEntries(
    readFileSync(".env.local", "utf8")
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
      }),
  );
}

async function walk(directory, prefix = "") {
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...(await walk(absolute, relative)));
    else found.push(relative);
  }
  return found;
}

const env = loadEnv();
const connection = await mysql.createConnection({
  host: env.DB_HOST || "127.0.0.1",
  port: Number(env.DB_PORT || 3306),
  user: env.DB_USER || "root",
  password: env.DB_PASSWORD || "",
  database: env.DB_NAME || "study",
  charset: "utf8mb4",
  timezone: "+08:00",
});

const [mtColumn] = await connection.query("SHOW COLUMNS FROM attachments LIKE 'mt_number'");
if (mtColumn.length === 0) {
  await connection.query(`
    ALTER TABLE attachments
      ADD COLUMN mt_number TINYINT UNSIGNED NULL AFTER note,
      ADD COLUMN mt_status ENUM('confirmed', 'unconfirmed') NULL AFTER mt_number,
      ADD COLUMN topic VARCHAR(180) NULL AFTER mt_status,
      ADD COLUMN source_key VARCHAR(255) NULL AFTER topic,
      ADD KEY idx_attachments_mt (mt_number)
  `);
}

const [users] = await connection.query("SELECT id FROM users WHERE username = 'rani' LIMIT 1");
const userId = users[0]?.id;
if (!userId) {
  console.error("Akun rani belum ada.");
  process.exit(1);
}

const [courses] = await connection.query(
  "SELECT id, code FROM courses WHERE user_id = ?",
  [userId],
);
const courseIds = new Map(courses.map((course) => [course.code, course.id]));

const [previous] = await connection.query(
  `SELECT a.file_path
     FROM attachments a
     JOIN courses c ON c.id = a.course_id
    WHERE c.user_id = ? AND a.source_key IS NOT NULL`,
  [userId],
);
for (const row of previous) {
  const absolute = path.resolve(row.file_path);
  const root = path.resolve("storage", "uploads") + path.sep;
  if (absolute.startsWith(root)) await unlink(absolute).catch(() => undefined);
}
await connection.query(
  `DELETE a FROM attachments a
     JOIN courses c ON c.id = a.course_id
    WHERE c.user_id = ? AND a.source_key IS NOT NULL`,
  [userId],
);

const files = await walk(ROOT);
const missing = files.filter((file) => !CATALOG[file]);
if (missing.length) {
  console.error("Ada berkas yang belum dipetakan:", missing);
  process.exit(1);
}
const unused = Object.keys(CATALOG).filter((key) => !files.includes(key));
if (unused.length) {
  console.error("Peta menunjuk berkas yang tidak ada:", unused);
  process.exit(1);
}

let imported = 0;
const counts = new Map();
for (const relative of files) {
  const item = CATALOG[relative];
  if (item.skip) continue;
  const courseId = courseIds.get(item.course);
  if (!courseId) {
    console.error(`Mata kuliah ${item.course} tidak ada untuk ${relative}`);
    process.exit(1);
  }
  const source = path.join(ROOT, ...relative.split("/"));
  const info = await stat(source);
  const extension = path.extname(relative).toLowerCase();
  const storedName = `${randomUUID()}${extension}`;
  const folder = path.resolve("storage", "uploads", `c${courseId}`);
  await mkdir(folder, { recursive: true });
  await copyFile(source, path.join(folder, storedName));
  const originalName = path.basename(relative).slice(0, 180);
  await connection.query(
    `INSERT INTO attachments
      (schedule_id, course_id, material_date, category, original_name, stored_name, mime_type, size_bytes, file_path, note, mt_number, mt_status, topic, source_key)
     VALUES (NULL, ?, ?, 'materi', ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?)`,
    [
      courseId,
      item.date ?? null,
      originalName,
      storedName,
      info.size,
      path.posix.join("storage", "uploads", `c${courseId}`, storedName),
      item.note ?? null,
      item.mt ?? null,
      item.status,
      item.topic,
      relative.slice(0, 255),
    ],
  );
  imported += 1;
  const label = item.status === "confirmed" ? `MT ${String(item.mt).padStart(2, "0")}` : "belum jelas";
  counts.set(label, (counts.get(label) ?? 0) + 1);
}

const [summary] = await connection.query(
  `SELECT
      SUM(a.mt_status = 'confirmed') AS confirmed,
      SUM(a.mt_status = 'unconfirmed') AS unconfirmed,
      COUNT(*) AS total
     FROM attachments a
     JOIN courses c ON c.id = a.course_id
    WHERE c.user_id = ? AND a.source_key IS NOT NULL`,
  [userId],
);
console.log(JSON.stringify({ imported, groups: Object.fromEntries(counts), summary: summary[0] }));
await connection.end();
