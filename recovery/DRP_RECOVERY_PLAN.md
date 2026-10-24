# ============================================================
# MediSync DRP - Disaster Recovery Plan
# Studi Kasus: Telemedicine & Rekam Medis Elektronik
# Versi: 2.0 | Kelompok 4 TeleMed
# ============================================================

> **Tantangan:** Privasi data absolut dan nol toleransi terhadap hilangnya
> data medis pasien. RPO target ≈ 0 (Zero Data Loss).

---

## Arsitektur Multi-Container

```
┌──────────────────────────────────────────────────────────────────┐
│                        Docker Host                               │
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐   │
│  │  frontend    │    │   backend    │    │   db-backup      │   │
│  │  (Nginx)     │───▶│  (Node.js)   │    │   (DRP Agent)    │   │
│  │  Port: 80    │    │  Port: 5000  │    │  Backup Sched.   │   │
│  └──────────────┘    └──────┬───────┘    └────────┬─────────┘   │
│                             │                     │              │
│         ┌───────────────────▼─────────────────────▼──────────┐  │
│         │            Docker Volumes (PERSISTEN)              │  │
│         │                                                    │  │
│         │  📦 medisync_db_data   → SQLite DB (PRIMARY)       │  │
│         │  📦 medisync_backups   → PITR Snapshots            │  │
│         │  📦 medisync_recovery  → Scripts & Logs DRP        │  │
│         └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Aturan 3-2-1 Backup (PRD Kelompok 4)

| Salinan | Media | Lokasi | Implementasi |
|---------|-------|--------|--------------|
| **Copy 1** (Primary) | SQLite NVMe | Dalam container | Volume `medisync_db_data` |
| **Copy 2** (Local) | Docker Volume | Dalam host | Volume `medisync_backups` (PITR + reguler) |
| **Copy 3** (Offsite) | S3 Glacier | Cloud Singapura | Eksternal / mount volume offsite |

---

## RTO & RPO

| Metrik | Target | Strategi |
|--------|--------|----------|
| **RPO** | ≈ 0 (Zero Data Loss) | PITR snapshot sebelum setiap operasi kritis |
| **RTO** | < 5 menit | Recovery via API atau script shell otomatis |

---

## Skenario DR Test: "Human Error — DROP TABLE"

### Kronologi Insiden

```
T-0  : Admin melakukan maintenance pada database
T+1s : Admin salah ketik: DROP TABLE medical_records
T+2s : Seluruh rekam medis pasien HILANG dari sistem
T+3m : Tim DRP mengeksekusi Point-in-Time Recovery
T+5m : ✅ Sistem normal kembali, nol data hilang
```

---

## Prosedur PITR Lengkap (via API)

### Phase 1 — PRE-INCIDENT: Buat Snapshot

```bash
# Buat PITR snapshot sebelum operasi kritis
curl -X POST http://localhost/api/drp/snapshot

# Response contoh:
# {
#   "success": true,
#   "snapshot_id": "PITR_20261024_140000",
#   "stats_at_snapshot": {
#     "medical_records": 3,
#     "users": 6
#   }
# }
```

### Phase 2 — INCIDENT: Simulasi DROP TABLE

```bash
# Simulasikan human error: DROP TABLE medical_records
curl -X POST http://localhost/api/drp/simulate-drop

# Response akan menunjukkan:
# - medical_records_table_exists: false
# - data hilang: 3 rekam medis
```

### Phase 3 — VERIFY: Konfirmasi Insiden

```bash
# Cek status database pasca insiden
curl http://localhost/api/drp/status

# Lihat daftar snapshot PITR tersedia
curl http://localhost/api/drp/snapshots
```

### Phase 4 — RECOVERY: Point-in-Time Recovery

```bash
# Recover dari snapshot pre-incident
curl -X POST http://localhost/api/drp/recover/PITR_20261024_140000

# Restart backend agar singleton DB ter-refresh
docker restart medisync_backend
```

### Phase 5 — VERIFY RECOVERY: Konfirmasi Pemulihan

```bash
# Verifikasi rekam medis sudah kembali
curl http://localhost/api/medical-records

# Cek audit log untuk bukti recovery
curl http://localhost/api/audit-logs
```

---

## Prosedur PITR via Shell Script (dalam Container)

```bash
# STEP 1: Buat snapshot pre-incident
docker exec medisync_drp_backup sh /scripts/pitr-snapshot.sh

# STEP 2: Simulasi insiden (drop table)
docker exec medisync_backend node /app/db/simulate-incident.js

# STEP 3: Recovery
docker exec medisync_drp_backup sh /scripts/pitr-recover.sh PITR_20261024_HHMMSS

# STEP 4: Restart backend
docker restart medisync_backend

# STEP 5: Verifikasi
curl http://localhost:5000/api/drp/status
```

---

## Full System Recovery (Dari Nol)

```bash
# 1. Clone project
git clone <repo> && cd Kelompok4_TeleMed

# 2. Build & jalankan semua container
docker compose up -d --build

# 3. Seed data awal
docker exec medisync_backend npm run seed

# 4. Restore dari backup (jika tersedia)
docker exec medisync_drp_backup sh /scripts/restore.sh medisync_drp_LATEST.db

# 5. Verifikasi
curl http://localhost/api/drp/status
```

---

## Endpoint API DRP

| Method | Endpoint | Fungsi |
|--------|----------|--------|
| `GET` | `/api/drp/status` | Status database & sistem DRP |
| `POST` | `/api/drp/snapshot` | Buat PITR snapshot sekarang |
| `GET` | `/api/drp/snapshots` | Daftar semua snapshot PITR |
| `POST` | `/api/drp/simulate-drop` | **[DEMO]** Simulasi DROP TABLE |
| `POST` | `/api/drp/recover/:id` | Recovery dari snapshot PITR |

---

## Mengapa SQLite Cukup untuk Studi Kasus Ini?

> **Pertanyaan:** Haruskah menggunakan PostgreSQL/MySQL yang "lebih nyata"?

**Jawaban: Tidak perlu untuk tujuan demonstrasi DRP ini.**

| Aspek | SQLite (saat ini) | PostgreSQL |
|-------|-------------------|------------|
| PITR | ✅ Via file snapshot + WAL | ✅ Via WAL archiving |
| Zero Data Loss Demo | ✅ Snapshot sebelum insiden | ✅ Continuous WAL streaming |
| DROP TABLE Recovery | ✅ Restore dari file .db | ✅ pg_restore dari dump |
| Kompleksitas setup | ✅ Sangat sederhana | ❌ Perlu config banyak |
| Cocok untuk demo | ✅ Sempurna | ⚠️ Over-engineering |

SQLite dengan WAL mode + Docker Volume sudah memenuhi semua requirement DRP
studi kasus ini. Migrasi ke PostgreSQL baru diperlukan jika ada **concurrent users
lebih dari 1000** atau kebutuhan replikasi real-time antar server.
