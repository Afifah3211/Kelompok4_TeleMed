# Spesifikasi Arsitektur TeleMed

## Tujuan

TeleMed adalah aplikasi telemedis dan rekam medis elektronik untuk pasien, dokter, dan admin. Dokter menerbitkan resep sebagai bagian dari rekam medis; pasien membaca resepnya di portal. Aplikasi tidak memiliki akun apoteker atau modul stok farmasi. Frontend menyediakan alur UI berbasis peran; backend FastAPI menyediakan autentikasi, API, audit log, serta integrasi PostgreSQL dan penyimpanan file.

## Komponen dan alur

```text
Browser :8080 -> frontend (Nginx + React SPA)
                    | /api/* -> backend (FastAPI :8000)
                    | /files/chat/* -> Nginx Edge Cache -> MinIO (S3 API :9000)
                    |                    ^
                    |                    | URL signature validation
                    | /api/chat/* -> backend (FastAPI)
                                      |       |
                                      v       v
                                  PostgreSQL  MinIO
backup -> PostgreSQL; arsip WAL -> volume wal_archive
```

Semua service berjalan pada jaringan Docker Compose `telemed_net`. PostgreSQL tidak dipublikasikan ke host di Compose utama; profile pengembangan memetakannya ke `127.0.0.1:5433`. Data database, backup, WAL, dan objek MinIO disimpan pada named volume. Direktori `./offsite` adalah salinan terenkripsi pada host yang sama dan perlu disinkronkan ke media berbeda untuk perlindungan kehilangan host.

## Tanggung jawab layanan

| Layanan | Tanggung jawab | Persistensi / akses |
|---|---|---|
| frontend | Build dan sajikan React; reverse proxy API dan gambar chat | Port 8080 |
| backend | REST API, JWT/RBAC, audit, pesan chat, metadata DB, akses MinIO | Stateless; bisa direplikasi |
| db | PostgreSQL 16, data klinis, WAL archive | `pgdata`, `wal_archive` |
| backup | Dump logis, base backup, off-site encryption, retensi | `backups`, `./offsite`, Docker secret |
| minio | Penyimpanan objek gambar chat | `minio_data`; UI/API loopback host |

## Ketersediaan, keamanan, dan pemulihan

- Healthcheck digunakan untuk menunggu dependensi database/backend siap.
- Nginx memakai DNS internal Docker untuk menemukan replika backend.
- Backend memvalidasi JWT dan role untuk endpoint terproteksi; kredensial dan key deployment harus diganti dari nilai demo.
- Pesan chat dan metadata gambar terikat pada konsultasi di PostgreSQL. Hanya pasien pemilik konsultasi dan dokter yang ditugaskan dapat membaca/mengirim chat melalui API.
- URL gambar CDN `/files/chat/{key}` memakai tanda tangan HMAC berumur satu jam yang divalidasi backend lewat Nginx `auth_request`; cache tetap memeriksa tanda tangan pada setiap request. Port S3 MinIO tidak dipublikasikan ke host di Compose utama.
- Backup PostgreSQL dan target RTO/RPO dijelaskan di [recovery/DRP_RECOVERY_PLAN.md](recovery/DRP_RECOVERY_PLAN.md).

## Batasan rancangan praktikum

Compose menjalankan semua container pada satu host sehingga replikasi backend bukan high availability lintas host. Cache CDN Nginx bersifat lokal pada instance frontend. `./offsite` pada host yang sama bukan off-site geografis. RTO/RPO harus dilaporkan berdasarkan hasil eksperimen, bukan hanya target dokumen.
