-- Materi bisa menempel di jadwal, atau ditambahkan langsung ke mata kuliah dan tanggal.

ALTER TABLE attachments
  ADD COLUMN course_id BIGINT UNSIGNED NULL AFTER schedule_id,
  ADD COLUMN material_date DATE NULL AFTER course_id,
  ADD COLUMN note VARCHAR(240) NULL AFTER file_path;

ALTER TABLE attachments
  MODIFY schedule_id BIGINT UNSIGNED NULL;

ALTER TABLE attachments
  ADD KEY idx_attachments_course (course_id),
  ADD KEY idx_attachments_date (material_date),
  ADD CONSTRAINT fk_attachments_course
    FOREIGN KEY (course_id) REFERENCES courses(id)
    ON UPDATE CASCADE ON DELETE SET NULL;

UPDATE attachments a
JOIN schedules s ON s.id = a.schedule_id
   SET a.course_id = s.course_id,
       a.material_date = s.schedule_date
 WHERE a.material_date IS NULL;
