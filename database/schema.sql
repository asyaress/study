CREATE DATABASE IF NOT EXISTS study
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE study;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  username VARCHAR(50) NOT NULL,
  email VARCHAR(190) NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_username (username),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sessions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sessions_token (token_hash),
  KEY idx_sessions_user (user_id),
  KEY idx_sessions_expiry (expires_at),
  CONSTRAINT fk_sessions_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS courses (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  code VARCHAR(24) NOT NULL,
  name VARCHAR(160) NOT NULL,
  lecturer VARCHAR(160) NULL,
  color VARCHAR(24) NOT NULL DEFAULT 'berry',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_courses_user_code (user_id, code),
  KEY idx_courses_user (user_id),
  CONSTRAINT fk_courses_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS schedules (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  course_id BIGINT UNSIGNED NULL,
  title VARCHAR(180) NOT NULL,
  schedule_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  location VARCHAR(120) NULL,
  description TEXT NULL,
  color VARCHAR(24) NOT NULL DEFAULT 'berry',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_schedules_date (schedule_date),
  KEY idx_schedules_course (course_id),
  KEY idx_schedules_user (user_id),
  UNIQUE KEY uq_schedule_user_slot (user_id, schedule_date, start_time, title),
  CONSTRAINT fk_schedules_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_schedules_course
    FOREIGN KEY (course_id) REFERENCES courses(id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS attachments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  schedule_id BIGINT UNSIGNED NULL,
  course_id BIGINT UNSIGNED NULL,
  material_date DATE NULL,
  category ENUM('materi', 'catatan') NOT NULL DEFAULT 'materi',
  original_name VARCHAR(255) NOT NULL,
  stored_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(190) NULL,
  size_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
  file_path VARCHAR(500) NOT NULL,
  note VARCHAR(240) NULL,
  mt_number TINYINT UNSIGNED NULL,
  mt_status ENUM('confirmed', 'unconfirmed') NULL,
  topic VARCHAR(180) NULL,
  source_key VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_attachments_schedule (schedule_id),
  KEY idx_attachments_course (course_id),
  KEY idx_attachments_date (material_date),
  KEY idx_attachments_mt (mt_number),
  CONSTRAINT fk_attachments_schedule
    FOREIGN KEY (schedule_id) REFERENCES schedules(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_attachments_course
    FOREIGN KEY (course_id) REFERENCES courses(id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS study_sessions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  course_id BIGINT UNSIGNED NULL,
  material_id BIGINT UNSIGNED NULL,
  course_name VARCHAR(160) NULL,
  material_name VARCHAR(180) NULL,
  status ENUM('running', 'paused', 'done') NOT NULL DEFAULT 'running',
  started_at DATETIME NOT NULL,
  paused_at DATETIME NULL,
  paused_seconds INT UNSIGNED NOT NULL DEFAULT 0,
  ended_at DATETIME NULL,
  duration_seconds INT UNSIGNED NOT NULL DEFAULT 0,
  summary VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_study_user_status (user_id, status),
  KEY idx_study_started (user_id, started_at),
  CONSTRAINT fk_study_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_study_course
    FOREIGN KEY (course_id) REFERENCES courses(id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_study_material
    FOREIGN KEY (material_id) REFERENCES attachments(id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS study_notes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  session_id BIGINT UNSIGNED NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  stored_name VARCHAR(255) NOT NULL,
  size_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
  file_path VARCHAR(500) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_study_notes_session (session_id),
  CONSTRAINT fk_study_notes_session
    FOREIGN KEY (session_id) REFERENCES study_sessions(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS tasks (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  course_id BIGINT UNSIGNED NULL,
  task_date DATE NOT NULL,
  detail VARCHAR(2000) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_tasks_user_date (user_id, task_date),
  CONSTRAINT fk_tasks_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_tasks_course
    FOREIGN KEY (course_id) REFERENCES courses(id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS task_files (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  task_id BIGINT UNSIGNED NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  stored_name VARCHAR(255) NOT NULL,
  size_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
  file_path VARCHAR(500) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_task_files_task (task_id),
  CONSTRAINT fk_task_files_task
    FOREIGN KEY (task_id) REFERENCES tasks(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

INSERT IGNORE INTO users (name, username, email, password_hash) VALUES
  ('Ara Fahrezy', 'ara', 'ara@studyspace.id', '$2b$12$RRGo4L5T9d0QFrCQ0LCaqe2WEwT/SHmwOjVOFOYqIy9cXmmDAey76');

SET @demo_user_id = (SELECT id FROM users WHERE username = 'ara' LIMIT 1);

INSERT IGNORE INTO courses (user_id, code, name, lecturer, color) VALUES
  (@demo_user_id, 'IF101', 'Pemrograman Berorientasi Objek', 'Dr. Aris Kusuma', 'berry'),
  (@demo_user_id, 'IF104', 'Algoritma dan Pemrograman', 'Prof. Dian Pratiwi', 'violet'),
  (@demo_user_id, 'IF118', 'Interaksi Manusia dan Komputer', 'Nadya Putri, M.Ds.', 'lime'),
  (@demo_user_id, 'IF120', 'Sistem Basis Data', 'Raka Mahendra, M.Kom.', 'sky');

INSERT IGNORE INTO schedules
  (user_id, course_id, title, schedule_date, start_time, end_time, location, description, color)
SELECT @demo_user_id, id, 'Pemrograman Berorientasi Objek', '2026-09-30', '08:00:00', '09:40:00', 'Ruang D301', 'Lanjut ke inheritance dan polymorphism.', 'berry'
FROM courses WHERE user_id = @demo_user_id AND code = 'IF101';

INSERT IGNORE INTO schedules
  (user_id, course_id, title, schedule_date, start_time, end_time, location, description, color)
SELECT @demo_user_id, id, 'Algoritma dan Pemrograman', '2026-09-30', '10:00:00', '11:40:00', 'Lab Komputer 02', 'Latihan graph traversal.', 'violet'
FROM courses WHERE user_id = @demo_user_id AND code = 'IF104';

INSERT IGNORE INTO schedules
  (user_id, course_id, title, schedule_date, start_time, end_time, location, description, color)
SELECT @demo_user_id, id, 'Interaksi Manusia dan Komputer', '2026-10-01', '09:40:00', '11:20:00', 'Ruang B204', 'Persiapan usability testing.', 'lime'
FROM courses WHERE user_id = @demo_user_id AND code = 'IF118';

INSERT IGNORE INTO schedules
  (user_id, course_id, title, schedule_date, start_time, end_time, location, description, color)
SELECT @demo_user_id, id, 'Sistem Basis Data', '2026-10-02', '13:00:00', '14:40:00', 'Ruang C112', 'Normalisasi database.', 'sky'
FROM courses WHERE user_id = @demo_user_id AND code = 'IF120';
