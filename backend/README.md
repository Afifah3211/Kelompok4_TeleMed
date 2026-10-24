# MediSync Backend - REST API Documentation

> **Sistem Manajemen Telemedis | Express.js + SQLite (better-sqlite3)**
> Sesuai Dokumen PRD Kelompok 4 TeleMed v1.0

---

## 📁 Struktur Backend

```
backend/
├── server.js              # Entry point Express server
├── .env                   # Konfigurasi environment (PORT, etc.)
├── package.json
├── db/
│   ├── database.js        # Singleton koneksi SQLite
│   ├── schema.sql         # Skema tabel database
│   ├── seed.js            # Seed data awal (dari mockData.js)
│   └── medisync.db        # File database SQLite (auto-generated)
└── routes/
    ├── users.js           # /api/users — RBAC: pasien, dokter, admin
    ├── appointments.js    # /api/appointments — Jadwal Konsultasi
    ├── emrs.js            # /api/emrs — Rekam Medis + Soft Delete (PRD)
    ├── auditLogs.js       # /api/audit-logs — Forensic Trail + CSV export
    └── backup.js          # /api/backup — Aturan 3-2-1 Backup (PRD)
```

---

## 🚀 Menjalankan Backend

```bash
# Masuk ke folder backend
cd backend

# Install dependencies (jika belum)
npm install

# Seed database dengan data awal
npm run seed

# Jalankan server
npm start
# Server berjalan di: http://localhost:5000
```

---

## 📡 Daftar Endpoint API

### 🔵 Health Check
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/health` | Status server dan daftar endpoint |

---

### 👥 Users — `/api/users`
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/users` | Daftar semua pengguna (filter: `role`, `status`) |
| GET | `/api/users/doctors` | Daftar dokter aktif (untuk Booking Modal) |
| GET | `/api/users/:id` | Detail satu pengguna |
| POST | `/api/users/login` | Autentikasi pengguna |
| POST | `/api/users` | Tambah pengguna baru (Admin) |
| PUT | `/api/users/:id` | Update profil pengguna |
| PATCH | `/api/users/:id/toggle-status` | Aktifkan/Nonaktifkan akun |

**Login Body:**
```json
{ "email": "budi.santoso@email.com", "password": "medisync2026" }
```

**Default Accounts:**
| Email | Password | Role |
|-------|----------|------|
| `budi.santoso@email.com` | `medisync2026` | pasien |
| `siti.rahma@email.com` | `medisync2026` | pasien |
| `dr.andi@medisync.id` | `medisync2026` | dokter |
| `dr.sarah@medisync.id` | `medisync2026` | dokter |
| `dr.bintang@medisync.id` | `medisync2026` | dokter |
| `admin.it@medisync.id` | `medisync2026` | admin |

---

### 📅 Appointments — `/api/appointments`
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/appointments` | Daftar janji temu (filter: `patientId`, `doctorId`, `status`) |
| GET | `/api/appointments/:id` | Detail satu janji temu |
| POST | `/api/appointments` | Buat janji temu baru |
| PATCH | `/api/appointments/:id/status` | Update status |
| PUT | `/api/appointments/:id` | Update lengkap |
| DELETE | `/api/appointments/:id` | Batalkan janji (set status: Dibatalkan) |

**Status valid:** `Menunggu` | `Sedang Berlangsung` | `Selesai` | `Dibatalkan`

---

### 🏥 EMR (Rekam Medis) — `/api/emrs`
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/emrs` | Daftar EMR aktif (`includeDeleted=true` untuk semua) |
| GET | `/api/emrs/deleted` | Daftar EMR yang di-soft delete (Tab Arsip PRD) |
| GET | `/api/emrs/:id` | Detail satu EMR |
| POST | `/api/emrs` | Simpan rekam medis baru (Dokter) |
| PUT | `/api/emrs/:id` | Update rekam medis |
| DELETE | `/api/emrs/:id` | **Soft Delete** — data fisik TETAP AMAN! |
| PATCH | `/api/emrs/:id/restore` | Pulihkan EMR yang di-soft delete |

> **⚠️ Soft Delete (Sesuai PRD):** Data tidak pernah dihapus dari database fisik.
> Field `is_deleted = true`, `deleted_at`, dan `deleted_by` diset secara aman.

**Create EMR Body:**
```json
{
  "patientId": "USR-P01",
  "doctorId": "USR-D01",
  "appointmentId": "APT-101",
  "vitals": {
    "bp": "135/88 mmHg",
    "heartRate": "78 bpm",
    "temperature": "36.6 °C",
    "respiratoryRate": "18 x/menit",
    "weight": "70 kg"
  },
  "complaint": "...",
  "diagnosis": "Hipertensi Primer Esensial (ICD-10: I10)",
  "action": "...",
  "prescription": "..."
}
```

---

### 📋 Audit Logs — `/api/audit-logs`
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/audit-logs` | Daftar log (filter: `userId`, `action`, `severity`, `search`, `from`, `to`) |
| POST | `/api/audit-logs` | Tambah log baru |
| GET | `/api/audit-logs/export/csv` | **Export ke CSV** untuk audit kepatuhan |

**Severity:** `info` | `success` | `warning` | `danger` (merah = DELETE, sesuai PRD)

---

### 💾 Backup 3-2-1 — `/api/backup`
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/backup` | Konfigurasi backup saat ini |
| POST | `/api/backup/trigger` | **Lakukan Backup Sekarang** (manual trigger PRD) |
| GET | `/api/backup/snapshot` | Download snapshot JSON terenkripsi |

---

## 🗄️ Skema Database

```
users           → Pengguna (pasien, dokter, admin)
appointments    → Jadwal konsultasi
emrs            → Rekam Medis Elektronik (soft delete)
audit_logs      → Log aktivitas forensik
backup_config   → Konfigurasi aturan 3-2-1
backup_nodes    → Storage nodes (SSD, NAS, S3 Offsite)
```

---

## 🔧 Environment Variables

```env
PORT=5000
NODE_ENV=development
```

---

## 🔗 Integrasi Frontend

Import `src/services/api.js` di komponen React:

```js
import { usersApi, appointmentsApi, emrsApi, auditLogsApi, backupApi } from './services/api';

// Contoh penggunaan
const users = await usersApi.getAll({ role: 'dokter' });
const emrs = await emrsApi.getAll({ patientId: 'USR-P01' });
await emrsApi.softDelete('EMR-2026-003', 'Dr. Andi', 'Duplikasi data');
await backupApi.trigger('Aditya Nugraha', 'USR-ADM01');
```

---

> **Kelompok 4 TeleMed** — MediSync v1.0 Backend REST API
