# Sinkronisasi database production

Repository hanya menyimpan schema, migration, dan alat transfer. Snapshot database
serta file unggahan tidak boleh masuk Git karena mengandung data pengguna.

## 1. Ekspor dari komputer lokal

Pastikan `.env.local` menunjuk ke database lokal, lalu jalankan:

```bash
npm run db:export
tar -czf .deploy/study-uploads.tar.gz -C storage uploads
```

Hasil privat berada di `.deploy/` dan diabaikan oleh Git:

- `study-db.snapshot.json`
- `study-db.snapshot.json.sha256`
- `study-uploads.tar.gz`

## 2. Salin langsung ke server

Buat direktori penerima di server:

```bash
mkdir -p /root/study-migration
chmod 700 /root/study-migration
```

Dari komputer lokal, kirim ketiga file memakai SCP atau SFTP. Jangan unggah file
tersebut ke GitHub.

## 3. Backup server

Di server, masuk ke direktori aplikasi dan hentikan servicenya melalui aaPanel.
Pastikan `.env.local` menunjuk ke database production, lalu buat backup:

```bash
cd /www/wwwroot/study.toedjoesinargroup.com
export PATH="/www/server/nodejs/v22.23.4/bin:$PATH"
npm run db:export -- /root/study-migration/server-before-import.json
```

## 4. Impor snapshot lokal

Schema target harus sudah berasal dari `database/schema.sql` dan seluruh migration
yang berlaku. Impor berikut menghapus data aplikasi di database target, memasukkan
snapshot lokal dalam transaksi, lalu memverifikasi jumlah baris setiap tabel:

```bash
npm run db:import -- /root/study-migration/study-db.snapshot.json --confirm-replace
```

## 5. Ganti file unggahan

Pertahankan salinan yang dapat dipulihkan sebelum mengganti folder upload:

```bash
cd /www/wwwroot/study.toedjoesinargroup.com
mv storage/uploads storage/uploads.before-local-import
mkdir -p storage
tar -xzf /root/study-migration/study-uploads.tar.gz -C storage
chown -R www:www storage/uploads
```

Restart service melalui aaPanel, lalu verifikasi aplikasi dan endpoint lokal:

```bash
curl -I http://127.0.0.1:3000/
```

Simpan backup sampai seluruh akun, jadwal, catatan, materi, dan berkas sudah
terverifikasi. Setelah itu hapus snapshot sensitif dari lokasi transfer secara aman.
