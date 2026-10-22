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
