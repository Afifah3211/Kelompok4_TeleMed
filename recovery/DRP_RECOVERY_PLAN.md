# Disaster Recovery Plan (DRP) — TeleMed

Versi ini mengikuti implementasi aktif: React/Vite, Nginx, FastAPI, PostgreSQL 16, Docker Compose, dan MinIO. Perintah yang memakai endpoint DRP membutuhkan akun admin.

## Cakupan dan arsitektur

- Frontend dan reverse proxy: service `frontend`, port host 8080.
- API: service `backend`, FastAPI port internal 8000.
- Database: service `db`, PostgreSQL 16; volume persisten `pgdata`.
- Arsip WAL: volume `wal_archive`, diisi oleh PostgreSQL `archive_command`.
- Backup: service `backup`; dump dan base backup disimpan di volume `backups`, salinan terenkripsi disimpan pada bind mount `./offsite`.
- Aset file: service MinIO dengan volume `minio_data`.

## Sasaran pemulihan

| Ukuran | Sasaran | Cara mengukur |
|---|---:|---|
| RTO | ≤ 5 menit untuk pemulihan tabel dari snapshot yang tersedia | Catat waktu mulai insiden sampai pemeriksaan API dan jumlah rekam medis berhasil |
| RPO | ≤ 6 jam untuk pemulihan dari dump terjadwal; 0 untuk skenario DROP TABLE setelah snapshot manual berhasil | Bandingkan waktu insiden dengan backup terakhir yang benar-benar dapat dipulihkan dan jumlah rekam medis sebelum/sesudah |

RPO nol bukan jaminan umum konfigurasi ini. Dump berjalan tiap 6 jam dan WAL lokal diarsipkan dengan `archive_timeout=60s`, tetapi prosedur pemulihan PITR dari rangkaian WAL belum diotomatisasi/divalidasi. Karena itu, jangan menyatakan RPO 60 detik atau 5 menit sebelum uji restore WAL membuktikannya. Snapshot manual sebelum DROP TABLE memberi RPO nol khusus untuk skenario latihan tersebut.

## Jadwal dan lokasi backup

- Dump logis `pg_dump -Fc`: setiap 6 jam ke `/backups/dump`.
- Base backup `pg_basebackup`: setiap hari ke `/backups/base`.
- WAL: terus menerus ke volume `wal_archive`.
- Sync off-site terenkripsi: setiap 5 menit ke `./offsite` (bind mount lokal terpisah; bukan cloud/offsite geografis).
- Retensi lokal 7 hari, salinan off-site 30 hari; pemeriksaan integritas harian.
- Kunci enkripsi disediakan melalui Docker secret `./secrets/backup_key.txt`. Simpan kunci produksi secara terpisah dari backup.

Volume persisten melindungi dari kehilangan container, tetapi tidak melindungi dari kehilangan host. Salinan `./offsite` pada host yang sama juga tidak memenuhi ketahanan terhadap kehilangan host; salin ke media/host berbeda untuk DR produksi.

## Skenario latihan: penghapusan tabel `medical_records`

1. Jalankan stack dan simpan waktu mulai latihan.
2. Jalankan `./dr_test.ps1`. Skrip login admin, merekam status awal, membuat dump snapshot dengan `pg_dump`, menghapus tabel sebagai simulasi insiden, lalu menjalankan `pg_restore` dan memeriksa jumlah data.
3. Catat waktu insiden, waktu pemulihan selesai, jumlah rekam medis sebelum dan sesudah, serta hasil RPO.
4. Simpan output terminal dan screenshot status sebelum insiden, saat tabel hilang, dan setelah pulih sebagai laporan insiden.

Endpoint simulasi `POST /api/drp/simulate-drop` benar-benar menghapus tabel beserta dependensinya. Gunakan hanya untuk latihan pada data demo, setelah snapshot berhasil dibuat.

## Pemulihan manual dari dump

Untuk pemulihan terarah ke tabel, gunakan latihan `dr_test.ps1`/endpoint `/api/drp/recover/{snapshot_id}`. Untuk restore penuh, hentikan penulisan aplikasi, pilih dump yang tervalidasi, lalu pulihkan ke database kosong/terisolasi sebelum mengalihkan aplikasi. Jangan menguji restore penuh langsung pada database produksi.

Contoh pemeriksaan backup:

```sh
docker compose exec backup /scripts/dump_logis.sh
docker compose exec backup /scripts/check_daily.sh
docker compose exec db pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"
```

## Kriteria latihan berhasil

- API kembali sehat dan tabel `medical_records` tersedia.
- Jumlah data rekam medis sama dengan snapshot bila target RPO latihan tercapai.
- Durasi pemulihan tercatat dan dibandingkan dengan target RTO 5 menit.
- File backup, log backup, output DR test, dan screenshot disimpan sebagai bukti.

DR test tidak dianggap berhasil berdasarkan skrip saja; target RTO/RPO baru dapat dinyatakan tercapai setelah nilai runtime diukur dan dicatat.
