USE study;

CREATE TABLE users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(190) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB;

CREATE TABLE sessions (
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

INSERT INTO users (name, email, password_hash)
VALUES ('Ara Fahrezy', 'ara@studyspace.id', '$2b$12$RRGo4L5T9d0QFrCQ0LCaqe2WEwT/SHmwOjVOFOYqIy9cXmmDAey76');

ALTER TABLE courses
  ADD COLUMN user_id BIGINT UNSIGNED NULL AFTER id;

ALTER TABLE schedules
  ADD COLUMN user_id BIGINT UNSIGNED NULL AFTER id;

SET @demo_user_id = (SELECT id FROM users WHERE email = 'ara@studyspace.id' LIMIT 1);
UPDATE courses SET user_id = @demo_user_id WHERE user_id IS NULL;
UPDATE schedules SET user_id = @demo_user_id WHERE user_id IS NULL;

ALTER TABLE courses
  DROP INDEX uq_courses_code,
  MODIFY user_id BIGINT UNSIGNED NOT NULL,
  ADD UNIQUE KEY uq_courses_user_code (user_id, code),
  ADD KEY idx_courses_user (user_id),
  ADD CONSTRAINT fk_courses_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE schedules
  DROP INDEX uq_schedule_slot,
  MODIFY user_id BIGINT UNSIGNED NOT NULL,
  ADD UNIQUE KEY uq_schedule_user_slot (user_id, schedule_date, start_time, title),
  ADD KEY idx_schedules_user (user_id),
  ADD CONSTRAINT fk_schedules_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE CASCADE;
