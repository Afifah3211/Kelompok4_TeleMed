# TeleMed Backend API (Python FastAPI + PostgreSQL 16)

Backend layanan telemedis TeleMed (Kelompok 4) dibangun dengan Python 3.12, FastAPI, dan PostgreSQL 16.

## Arsitektur & Keamanan
- **Autentikasi**: JWT (HS256) dengan payload `sub` (user_id), `role`, `pid` (profile ID), dan `exp`.
- **Password**: Hashing asinkron menggunakan `bcrypt` langsung (cost 10) dieksekusi via `asyncio.to_thread`.
- **Database Pooling**: `psycopg_pool.AsyncConnectionPool` dengan `row_factory=dict_row` dan query terparameterisasi (`%s`).
- **Audit Logging**: Semua aktivitas penting (`LOGIN`, `CREATE`, `UPDATE`) otomatis dicatat ke tabel `audit_logs` dengan IP klien dari reverse-proxy Nginx.
- **Rate Limiting**: Dibatasi maksimal 30 request/menit/IP untuk endpoint login dan forgot-password via SlowAPI.

## Endpoints (Bagian A)
- `GET /api/health`: Status sistem, status konektivitas database, instance hostname container, dan uptime.
- `POST /api/auth/login`: Autentikasi user & pengembalian token JWT beserta profil.
- `POST /api/auth/register`: Registrasi mandiri khusus pasien (transaksi atomik `users` + `patients`).
- `POST /api/auth/change-password`: Ganti password untuk user login.
- `POST /api/auth/forgot-password`: Reset password mandiri pasien dengan verifikasi identitas (NIK dan tanggal lahir).
  > **Catatan Keterbatasan:** Endpoint ini menggunakan verifikasi NIK dan tanggal lahir terdaftar karena sistem saat ini belum memiliki integrasi email/SMTP service (keterbatasan infrastruktur belum tersedianya mail server).
- `GET /api/users`: List seluruh user (admin).
- `GET /api/users/doctors`: List seluruh dokter beserta spesialisasi (semua role login).
- `GET /api/users/patients`: List data pasien (dokter, admin, apoteker).
- `POST /api/users/doctor`: Pembuatan akun dokter baru (admin).
- `PATCH /api/users/{id}/toggle`: Toggle aktif/nonaktif akun (admin).
- `PUT /api/users/{id}`: Pembaruan profil (diri sendiri atau admin).

## Dokumentasi Interaktif
- Swagger UI: `http://localhost:8080/api/docs` (atau `http://localhost:8000/api/docs` secara internal)
- OpenAPI JSON: `http://localhost:8080/api/openapi.json`
