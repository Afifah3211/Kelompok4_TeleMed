# TeleMed: Sistem Manajemen Telemedis & Rekam Medis Elektronik 🏥💻
> **Platform Telemedis Berstandar Enterprise • Versi 2.0 (Kelompok 4 TeleMed)**

TeleMed (MediSync) adalah platform telemedis berbasis web modern yang menghubungkan pasien, dokter spesialis, apoteker, dan administrator klinik secara terintegrasi. Sistem dilengkapi dengan **Rekam Medis Elektronik (EMR)** berfitur *Soft Delete*, pencatatan forensik audit trail (*Audit Log*), **Pencadangan Data Otomatis Berstandar Aturan 3-2-1** (Dump Logis, Base Backup, Continuous WAL Archiving, dan Enkripsi Off-site AES-256), serta kapabilitas **Horizontal Autoscaling & Dynamic Load Balancing**.

Dokumen praktikum: [Spesifikasi Arsitektur](ARCHITECTURE_SPEC.md), [DRP](recovery/DRP_RECOVERY_PLAN.md), dan [Checklist Deliverable per Pertemuan](PRAKTIKUM.md). PRD produk tersedia di [Dokumen PRD Telemedis.pdf](Dokumen%20PRD%20Telemedis.pdf).

---

## 🏗️ Arsitektur Sistem & Container

Sistem diorkestrasi menggunakan **Docker Compose** pada satu jaringan terisolasi (`telemed_net`):

```text
       ┌────────────────────────────────────────────────────────┐
       │             KLIEN / PENGGUNA (Browser Web)             │
       └───────────────────────────┬────────────────────────────┘
                                   │ HTTP Request (Port 8080)
                                   ▼
       ┌────────────────────────────────────────────────────────┐
       │             FRONTEND (Nginx Reverse Proxy)             │
       │  - Host Port: 8080 -> Container Port: 80               │
       │  - SPA Static Server: React 19 + Vite 6                │
       │  - DNS Resolver Internal: 127.0.0.11 valid=5s          │
       │  - Dynamic Reverse Proxy: /api/ -> http://backend:8000 │
       └───────┬───────────────────┬───────────────────┬────────┘
               │ (Round-Robin)     │ (Round-Robin)     │ (Round-Robin)
               ▼                   ▼                   ▼
       ┌───────────────┐   ┌───────────────┐   ┌───────────────┐
       │   backend_1   │   │   backend_2   │   │   backend_N   │
       │ Python FastAPI│   │ Python FastAPI│   │ Python FastAPI│
       │ Port int: 8000│   │ Port int: 8000│   │ Port int: 8000│
       │  CPU: max 0.5 │   │  CPU: max 0.5 │   │  CPU: max 0.5 │
       │  RAM: 512 MB  │   │  RAM: 512 MB  │   │  RAM: 512 MB  │
       └───────┬───────┘   └───────┬───────┘   └───────┬───────┘
               │                   │                   │
               └─────────────┬─────┴───────────────────┘
                             │ Asyncpg Connection Pool (Max 10 per replika)
                             ▼
       ┌────────────────────────────────────────────────────────┐
       │             DATABASE (PostgreSQL 16)                   │
       │  - Port Internal: 5432 (tanpa ekspos ke host)          │
       │  - Volume pgdata: Data persisten tabel & indeks        │
       │  - Volume wal_archive: Arsip kontinu Write-Ahead Log   │
       │  - Concurrency Lock: pg_advisory_lock(42)              │
       └───────┬───────────────────────────────────────┬────────┘
               │                                       │
               │ Volume backups (rw)                   │ Volume wal_archive (ro)
               ▼                                       ▼
       ┌────────────────────────────────────────────────────────┐
       │            BACKUP JOB (Cron + Bash Daemon)             │
       │  - Dump Logis: pg_dump -Fc (tiap 6 jam)                │
       │  - Base Backup: pg_basebackup (harian 01:00)           │
       │  - Sync Off-site: Enkripsi AES-256-CBC ke host ./offsite│
       │  - Kunci Enkripsi: /run/secrets/backup_key             │
       └────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tumpukan Teknologi (Tech Stack)

| Layer | Komponen Teknologi | Keterangan |
|---|---|---|
| **Frontend** | React 19, Vite 6, Vanilla CSS | Single Page Application (SPA), Lucide Icons, Google Fonts |
| **Reverse Proxy** | Nginx 1.27 Alpine | Melayani build statis frontend & load balancer dinamis via DNS Docker |
| **Backend API** | Python 3.11, FastAPI, Uvicorn | RESTful API stateless, Pydantic v2, SlowAPI, Async Connection Pool |
| **Database** | PostgreSQL 16 Official | Relasional ACID, WAL Archiving kontinu, Advisory Lock untuk seeding |
| **DRP / Backup** | Bash, Cron, pg_dump, pg_basebackup | Pencadangan Aturan 3-2-1, OpenSSL AES-256-CBC, PBKDF2 salt |
| **Orchestrasi** | Docker & Docker Compose | Jaringan bridge `telemed_net`, resource limits CPU/RAM |
| **Testing** | Grafana k6, Matplotlib | Stress testing konkurensi bertingkat (10, 100, 500, 1000 VU) |

---

## 🚀 Panduan Menjalankan Sistem

### Prasyarat
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) telah terpasang dan berstatus aktif (running) dengan backend WSL2 (Windows) atau Docker Engine (Linux/macOS).
- Port host **8080** bebas dan dapat digunakan.

### 1. Inisialisasi Kunci Rahasia
Salin template environment, ganti `JWT_SECRET` dengan nilai acak (minimal 32 karakter), lalu buat Docker secret backup. Jangan commit `.env` atau `secrets/`:
```powershell
# PowerShell: salin template, lalu edit .env dan ganti JWT_SECRET.
Copy-Item .env.example .env
New-Item -ItemType Directory -Force secrets | Out-Null
# Buat key acak untuk enkripsi backup (contoh PowerShell):
[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)) | Set-Content secrets/backup_key.txt
```
Pada Linux/macOS, gunakan `cp .env.example .env`, `mkdir -p secrets`, dan `openssl rand -base64 32 > secrets/backup_key.txt`.

### 2. Build & Jalankan Seluruh Layanan
Di Windows, cara termudah adalah menjalankan launcher yang menyamakan password role PostgreSQL dengan `.env`, lalu build dan menyalakan aplikasi:
```powershell
.\run-local.cmd
```

Launcher ini memakai Execution Policy `Bypass` hanya untuk proses PowerShell yang dijalankan olehnya; kebijakan Windows tidak diubah permanen. Data volume tidak dihapus.

Alternatif manual untuk menjalankan stack tanpa launcher:
```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```
PostgreSQL hanya tersedia di jaringan Compose. Untuk koneksi GUI lokal, gunakan override `docker-compose.dev.yml` yang memetakan port `5433` ke loopback.

### 3. Verifikasi Status Layanan
Pastikan seluruh container berada pada kondisi `Up (healthy)`:
```bash
docker compose ps
```
Layanan dapat diakses melalui browser pada:
👉 **`http://localhost:8080`**

### 4. Menghentikan Layanan
```bash
# Menghentikan container (data volume pgdata & backups tetap aman tersimpan)
docker compose down

# PERHATIAN: Perintah berikut akan MENGHAPUS seluruh volume data database!
# docker compose down -v
```

### Penyimpanan File/CDN Lokal

Gambar hanya diunggah melalui chat di dalam konsultasi. Backend memeriksa bahwa pengguna adalah pasien pemilik konsultasi atau dokter yang ditugaskan; pesan dan metadata gambar masuk ke PostgreSQL, sedangkan objek gambar disimpan di MinIO. Browser menerima URL bertanda tangan berdurasi satu jam; Nginx memvalidasi URL sebelum meneruskan/cache gambar dari MinIO. Header `X-Cache-Status` menunjukkan status cache. Tidak ada file explorer global. Port S3 tidak dibuka ke host pada Compose utama; console MinIO hanya dibuka pada loopback dengan Compose development override.

Untuk membandingkan origin dengan CDN, jalankan dua pengujian terpisah dari PowerShell:
```powershell
.\run_stress.ps1 -Tag cdn -Script stress_cdn.js -Mode cdn
.\run_stress.ps1 -Tag origin -Script stress_cdn.js -Mode direct
python k6/plot_cdn.py
```
Skrip CDN menguji GET aset pada 10, 100, dan 500 VU (durasi tahan default 1 menit) dan menyimpan ringkasan JSON serta dashboard HTML di `k6/results/`. Runner membatasi skenario ini sampai 500 VU. Jika `SEED_PASSWORD` di `.env` diubah, tambahkan `-SeedPassword "password-demo-anda"` pada kedua perintah. Jalankan tiap mode pada kondisi host yang serupa, dan tunggu cooldown sebelum memulai mode berikutnya.

---

## 🗄️ Koneksi Database GUI (pgAdmin / DBeaver)

Secara default, port PostgreSQL (5432) **tidak dibuka ke host** demi keamanan arsitektur zero-trust. Jika Anda ingin menyambungkan tools GUI seperti **pgAdmin**, **DBeaver**, atau **TablePlus** dari host lokal:

### 1. Jalankan Compose dengan Mode Dev Override
```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```
Konfigurasi ini akan memetakan port container `5432` ke port host **`127.0.0.1:5433`** (khusus loopback).

Di pgAdmin Windows, daftarkan server **sekali** melalui **Register → Server**. Simpan password agar pgAdmin dapat menggunakannya kembali setelah aplikasi direstart. Docker dapat menyalakan database dan membuka portnya, tetapi tidak dapat otomatis membuat entri di aplikasi pgAdmin Desktop yang terpasang di Windows.

### 2. Parameter Koneksi GUI:
- **Host / Address**: `localhost` atau `127.0.0.1`
- **Port**: `5433`
- **Maintenance Database**: nilai `POSTGRES_DB` pada `.env` (project saat ini: `telemed`)
- **Username**: nilai `POSTGRES_USER` pada `.env` (project saat ini: `telemed_admin`)
- **Password**: nilai `POSTGRES_PASSWORD` pada `.env`

---

## 👥 Akun Demo & Hak Akses (RBAC)

Saat database pertama kali diinisialisasi, seed data otomatis dijalankan secara idempoten dan aman konkurensi (`pg_advisory_lock`). Password untuk seluruh akun demo dikonfigurasikan melalui variabel `SEED_PASSWORD` pada berkas `.env` (default: `medisync2026`).

| Role | Username / Email | Keterangan & Hak Akses |
|---|---|---|
| **Pasien 1** | `budi@email.com` | Booking konsultasi, melihat jadwal, riwayat EMR pribadi, pembatalan jadwal mandiri. |
| **Pasien 2** | `siti@email.com` | Booking konsultasi, melihat jadwal & rekam medis pribadi. |
| **Dokter 1** | `dr.andi@medisync.id` | Dokter Spesialis Penyakit Dalam: input EMR, resep obat, soft-delete EMR, kelola konsultasi. |
| **Dokter 2** | `dr.sarah@medisync.id` | Dokter Spesialis Anak (Pediatri): penanganan pasien anak dan rekam medis. |
| **Dokter 3** | `dr.bintang@medisync.id` | Dokter Spesialis Jantung & Pembuluh Darah (Kardiologi). |
| **Apoteker** | `apoteker@medisync.id` | Staf Farmasi: melihat antrean resep obat, update status racik/penyerahan obat, penyesuaian stok. |
| **Admin IT** | `admin@medisync.id` | Administrator: pemantauan Audit Log forensik, ekspor CSV audit, manajemen status cadangan DRP. |

---

## 🛡️ DRP & Backup Job (Aturan 3-2-1)

Sistem TeleMed menerapkan strategi pencadangan data berlapis sesuai standar Aturan 3-2-1:
- **Salinan 1 (Lokal Produksi):** Volume Docker `pgdata` aktif PostgreSQL 16.
- **Salinan 2 (Format Berbeda):** Dump logis kustom (`pg_dump -Fc`), Base Backup fisik (`pg_basebackup -Ft -z`), dan WAL streaming kontinu (`wal_archive`).
- **Salinan 3 (Off-site Terenkripsi):** Replikasi terenkripsi AES-256-CBC ke direktori off-site terpisah pada host (`./offsite`).

### Jadwal Otomatis (Cron Daemon)
Container `backup` menjalankan cron daemon terisolasi:
- **Dump Logis:** Setiap 6 jam (`00:00`, `06:00`, `12:00`, `18:00` WIB) — Retensi 7 hari.
- **Base Backup:** Setiap hari pukul `01:00` WIB — Retensi 7 hari.
- **Sinkronisasi WAL ke Off-site:** Setiap 5 menit (`*/5 * * * *`).
- **Pembersihan Retensi (Cleanup):** Setiap hari pukul `02:00` WIB (lokal > 7 hari, off-site > 30 hari).
- **Pemeriksaan Integritas Harian:** Setiap hari pukul `06:30` WIB (hasil dicatat di `/backups/check.log`).

### Perintah Operasional Manual Backup:
```powershell
# 1. Jalankan dump logis manual
docker compose exec backup /scripts/dump_logis.sh

# 2. Jalankan base backup manual
docker compose exec backup /scripts/base_backup.sh

# 3. Jalankan sinkronisasi enkripsi off-site manual
docker compose exec backup /scripts/sync_offsite.sh

# 4. Jalankan pemeriksaan integritas berkas backup harian
docker compose exec backup /scripts/check_daily.sh

# 5. Jalankan pembersihan retensi berkas kadaluwarsa
docker compose exec backup /scripts/cleanup.sh

# 6. Memeriksa log hasil pemeriksaan integritas harian
docker compose exec backup cat /backups/check.log
```

> ⚠️ **Pemisahan Kunci Enkripsi (Asumsi Keamanan 5.11):**
> Kunci enkripsi (`./secrets/backup_key.txt`) **wajib disimpan secara terpisah** dari media pencadangan (misalnya pada Cloud KMS atau HashiCorp Vault terisolasi). Jika berkas backup off-site dicuri oleh pihak luar, data medis pasien tetap aman terenkripsi AES-256-CBC selama penyerang tidak memiliki akses fisik/kredensial ke kunci ini.

---

## 📈 Autoscaling & Dynamic Load Balancing

Backend didesain sepenuhnya *stateless* sehingga dapat direplikasi secara horizontal:
- **DNS Round-Robin Load Balancing**: Nginx frontend mengarahkan trafik `/api/` ke service `backend:8000` menggunakan resolver Docker internal `127.0.0.11` dengan TTL `valid=5s`.
- **Autoscaler Script (`scripts/autoscale.sh`)**: Berjalan di host/WSL untuk memantau rata-rata CPU container relatif terhadap limit (`cpus: 0.5`) dan menambah/mengurangi replika antara `MIN=1` dan `MAX=5`.

### 1. Menjalankan Autoscaler di WSL:
```bash
chmod +x scripts/*.sh
./scripts/autoscale.sh
```

### 2. Menguji Load Balancing:
Skrip demo akan mengirimkan 30 request berturut-turut ke endpoint `/api/health` dan menampilkan distribusi trafik ke masing-masing container instance:
```bash
./scripts/demo_loadbalancing.sh
```
*Dokumentasi lengkap mengenai formula metrik, cooldown flapping, dan perbandingan dengan Kubernetes HPA dapat dibaca pada [AUTOSCALING.md](AUTOSCALING.md).*

---

## ⚡ Pertemuan 3 - Stress Testing

Pengujian beban sistem (*Stress Testing*) dilakukan menggunakan alat uji industri **Grafana k6** bertingkat pada 4 level beban konkurensi: **10 VU**, **100 VU**, **500 VU**, dan **1000 VU**.

### Prosedur Menjalankan Uji Beban

> ⚠️ **Peringatan Penting:** Jalankan pengujian bertahap dari level terendah. Jangan menjalankan pengujian 500/1000 VU secara langsung jika spesifikasi laptop/host terbatas.

#### 1. Uji Beban Skenario Statis (Tanpa Autoscaler):
Pastikan backend berjalan dengan 1 replika, lalu jalankan di terminal PowerShell:
```powershell
.\run_stress.ps1 -Tag noscale
```

#### 2. Uji Beban Skenario Dinamis (Dengan Autoscaler Aktif):
1. Buka satu terminal WSL/Bash dan aktifkan autoscaler:
   ```bash
   chmod +x scripts/*.sh
   ./scripts/autoscale.sh
   ```
2. Buka terminal PowerShell terpisah dan jalankan uji beban:
   ```powershell
   .\run_stress.ps1 -Tag autoscale
   ```

#### 3. Membuat Grafik Visualisasi Perbandingan:
Setelah kedua pengujian selesai, gabungkan metrik untuk laporan:
```powershell
# Install dependensi grafik jika belum ada
pip install matplotlib

# Buat grafik komparasi
python k6/plot_results.py noscale autoscale
```

### Cara Membaca Berkas Hasil di `k6/results/`
Seluruh artefak hasil pengujian otomatis tersimpan di folder `k6/results/`:
1. **`summary_<tag>_<vu>vu.json`**: Data mentah metrik k6 (Throughput, Latency p90/p95/p99, Error Rate, HTTP checks).
2. **`<tag>_<vu>vu.html`**: Dashboard web k6 interaktif yang dapat dibuka di browser untuk menganalisis grafik performa per detik.
3. **`grafik_noscale_autoscale.png`**: Grafik komparatif 3 panel (Throughput RPS, Latensi p95/avg ms, dan Persentase Error Rate) untuk lampiran laporan.
4. **`ringkasan_noscale_autoscale.csv`**: Tabel rekapitulasi numerik yang siap disalin ke spreadsheet atau tabel laporan akademik.

---

## ⚠️ Keterbatasan yang Diketahui (Known Limitations)

Secara jujur dan transparan, arsitektur sistem memiliki batasan operasional berikut:
1. **Autoscaling Reaktif, Bukan Prediktif**:
   Penskalaan replika container dipicu *setelah* ambang batas utilisasi CPU terlampaui (`UP > 60%`). Sistem tidak memiliki model prediktif untuk mengantisipasi lonjakan trafik seketika, sehingga request awal saat lonjakan mungkin mengalami peningkatan latensi respons sebelum replika baru siap melayani.
2. **Latensi Spin-Up Container (~10–20 Detik)**:
   Proses scale-out membutuhkan waktu alokasi container baru oleh Docker daemon, booting runtime Python Uvicorn, koneksi pool database, dan periode healthcheck sebelum Nginx memasukkan container baru ke pool routing DNS.
3. **Autoscaler Berjalan di Lingkungan Host/WSL**:
   Skrip autoscaler dieksekusi dari host laptop pengembang dan bergantung pada terminal yang aktif, bukan control plane mandiri di dalam cluster terdistribusi.
4. **Kapasitas Komputasi Fisik Host**:
   Meskipun backend dapat di-scale hingga 5 replika dengan batas 0.5 CPU per container, seluruh container tersebut tetap berbagi inti CPU fisik dan memori RAM yang sama pada laptop pengembang.
5. **SlowAPI Rate Limiter Bersifat In-Memory**:
   Rate limiter slowapi beroperasi secara in-memory per replika container (tidak menggunakan Redis terpusat), sehingga pada beban terdistribusi, kuota request dihitung independen pada masing-masing instance.
6. **Snapshot Volume Mingguan Belum Terotomatisasi**:
   Pencadangan snapshot volume disk belum diotomatisasi di dalam container backup karena memerlukan akses langsung ke socket Docker host (`/var/run/docker.sock`), yang dihindari demi mematuhi prinsip isolasi keamanan container.

---

## 👥 Pengembang
- **Kelompok 4 TeleMed** - Sistem Manajemen Telemedis Terdistribusi (Versi 2.0)
