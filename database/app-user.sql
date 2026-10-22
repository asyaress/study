-- Jalankan sekali sebagai admin MySQL di server.
-- Ganti kata sandi sebelum dipakai, lalu isi DB_USER dan DB_PASSWORD di environment.
-- User ini hanya boleh baca dan tulis data aplikasi. Tidak bisa FILE, SUPER, atau database lain.

CREATE USER IF NOT EXISTS 'studyspace'@'127.0.0.1' IDENTIFIED BY 'GANTI_KATA_SANDI_INI';

REVOKE ALL PRIVILEGES, GRANT OPTION FROM 'studyspace'@'127.0.0.1';

GRANT SELECT, INSERT, UPDATE, DELETE ON study.* TO 'studyspace'@'127.0.0.1';

FLUSH PRIVILEGES;
