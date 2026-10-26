# MediSync: Sistem Manajemen Telemedis 🏥💻
> **Dokumen Kebutuhan Produk (PRD) & Spesifikasi Desain • Versi 1.0 (Kelompok 4 TeleMed)**

MediSync adalah platform telemedis berbasis web modern yang dirancang untuk menghubungkan pasien dengan dokter spesialis secara aman, cepat, dan terpercaya. Dilengkapi dengan Rekam Medis Elektronik (EMR) berfitur *Soft Delete*, pencatatan audit forensik (*Audit Log*), dan pencadangan data otomatis berstandar *Aturan 3-2-1*.

---

## 🐳 Menjalankan dengan Docker (Tugas Pertemuan 2)

### Prasyarat
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) terinstall dan berjalan
- Port 8000 tersedia di host

### Arsitektur Container

```
[Browser: localhost:8000]
        ↓ HTTP
[medisync_frontend: Nginx:80]  ──proxy /api/──→  [medisync_backend: Node.js:5000]
                                                          ↓ better-sqlite3
                                                  [Volume: medisync_db_data]
                                                  └── /app/db/data/medisync.db

[medisync_drp_backup: Alpine]  ──baca──→  [Volume: medisync_db_data]
                               ──tulis──→ [Volume: medisync_backups]

Semua container → Network: medisync_net (bridge)
```

### Cara Menjalankan

```powershell
# 1. Clone repo
git clone https://github.com/Afifah3211/Kelompok4_TeleMed.git
cd Kelompok4_TeleMed

# 2. Build & jalankan semua container
docker compose up -d --build

# 3. Cek status container
docker compose ps

# 4. Buka aplikasi
# → http://localhost:8000
```

### Database

Backend menggunakan **SQLite** (via `better-sqlite3`) yang disimpan di Docker Volume `medisync_db_data`. Database di-seed otomatis saat pertama kali container berjalan melalui `entrypoint.sh`.

- **DB Path di container**: `/app/db/data/medisync.db`
- **Volume**: `kelompok4_telemed_medisync_db_data`
- **Data persisten**: ✅ Data tidak hilang meski container di-restart atau di-rebuild

### Verifikasi Koneksi

```powershell
# Health check via nginx proxy
curl http://localhost:8000/api/health

# Koneksi internal Docker (frontend → backend)
docker exec medisync_frontend wget -qO- http://backend:5000/api/health

# Cek tabel database langsung
docker exec medisync_backend sqlite3 /app/db/data/medisync.db ".tables"

# Hitung data
docker exec medisync_backend sqlite3 /app/db/data/medisync.db "SELECT COUNT(*) FROM users;"

# Lihat network
docker network inspect medisync_net

# Lihat volumes
docker volume ls --filter name=kelompok4
```

### Bukti Persistensi Data

```powershell
# Hentikan container (TANPA -v agar volume tidak terhapus)
docker compose down

# Cek volume masih ada
docker volume ls

# Jalankan ulang
docker compose up -d

# Data masih ada!
curl http://localhost:8000/api/medical-records
```

### Menghentikan & Reset

```powershell
# Stop saja (data tersimpan)
docker compose down

# Stop + hapus semua data (reset total)
docker compose down -v
```

---

## 🎨 Panduan Warna & Desain Antarmuka (PRD Standard)

| Peran Warna | Kode Hex | Penggunaan Utama |
|---|---|---|
| **Biru Medis (Primary)** | `#1D4ED8` | Header navigasi, tombol aksi utama, badge fokus, dan link. Memberi kesan profesional, sehat, dan terpercaya. |
| **Hijau Tosca (Accent)** | `#0F766E` | Status *"Selesai"*, tanda berhasil, aksen konsultasi, dan ikon-ikon kesehatan. |
| **Putih Bersih (Surface)** | `#FFFFFF` | Latar belakang kartu informasi dan formulir agar kontras dan mudah dibaca. |
| **Clean Background** | `#F8FAFC` | Latar belakang aplikasi yang bersih, modern, dan tidak melelahkan mata. |
| **Merah Aksen (Danger/Delete)** | `#DC2626` | Penanda khusus aksi *Soft Delete* dan log penghapusan data penting. |

---

## 🚀 Fitur Utama Sesuai Dokumen PRD

### 1. Sistem Login & Hak Akses Berbasis Peran (RBAC)
- **Pasien**: Melihat rekam medis pribadi, menjadwalkan konsultasi online, dan masuk ke ruang telemedis virtual.
- **Dokter**: Memantau antrean pasien hari ini, mengisi formulir konsultasi aktif, menerbitkan e-Prescription (resep obat), dan mengelola arsip rekam medis.
- **Admin IT / Klinik**: Mengelola akun pengguna klinis, memantau *Audit Log* sistem secara *real-time*, dan mengawasi pencadangan data *3-2-1*.

### 2. Rekam Medis Elektronik (EMR)
- Formulir konsultasi lengkap dengan tanda-tanda vital
- Soft Delete: data tidak benar-benar hilang, ditandai `is_deleted=true`
- Tab Arsip & Pemulihan untuk restore data yang ter-soft delete

### 3. Admin & Audit Log
- Tabel audit trail dengan filter tanggal dan pencarian
- Ekspor CSV untuk audit kepatuhan
- Monitor pencadangan data aturan 3-2-1

### 4. DRP — Disaster Recovery Plan (Bonus)
Endpoint khusus demonstrasi DRP tersedia di `/api/drp/`:
- `POST /api/drp/snapshot` — Buat PITR snapshot
- `GET  /api/drp/snapshots` — Daftar snapshot
- `POST /api/drp/simulate-drop` — Simulasi DROP TABLE (demo)
- `POST /api/drp/recover/:id` — Recovery dari snapshot
- `GET  /api/drp/status` — Status DRP sistem

---

## 🛠️ Tumpukan Teknologi (Tech Stack)

| Layer | Teknologi |
|-------|-----------|
| Frontend | React 19, Vite 6, Vanilla CSS |
| Backend | Node.js 22, Express 5, better-sqlite3 |
| Database | SQLite (file: `medisync.db` di Docker Volume) |
| Web Server | Nginx 1.27 Alpine (reverse proxy) |
| Container | Docker Compose (3 services) |
| Icons | Lucide Icons |
| Fonts | Google Fonts (Inter & Plus Jakarta Sans) |

---

## 💻 Menjalankan Lokal (Tanpa Docker)

```bash
# Install dependensi
npm install

# Jalankan dev server
npm run dev
# → http://localhost:5173

# Build production
npm run build
```

---

## 👥 Pengembang
- **Kelompok 4 TeleMed** - Sistem Manajemen Telemedis (MediSync v1.0)
