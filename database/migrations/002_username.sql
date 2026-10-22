USE study;

ALTER TABLE users
  ADD COLUMN username VARCHAR(50) NULL AFTER name;

UPDATE users
   SET username = SUBSTRING_INDEX(email, '@', 1)
 WHERE username IS NULL OR username = '';

ALTER TABLE users
  MODIFY username VARCHAR(50) NOT NULL,
  MODIFY email VARCHAR(190) NULL,
  ADD UNIQUE KEY uq_users_username (username);
