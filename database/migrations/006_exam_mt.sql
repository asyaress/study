-- Kelompok ujian MT. Satu nomor bisa memuat materi dari lebih dari satu mata kuliah.
-- confirmed = masuk halaman ujian. unconfirmed = sudah diperiksa, nomor MT tidak tertulis.

ALTER TABLE attachments
  ADD COLUMN mt_number TINYINT UNSIGNED NULL AFTER note,
  ADD COLUMN mt_status ENUM('confirmed', 'unconfirmed') NULL AFTER mt_number,
  ADD COLUMN topic VARCHAR(180) NULL AFTER mt_status,
  ADD COLUMN source_key VARCHAR(255) NULL AFTER topic,
  ADD KEY idx_attachments_mt (mt_number);
