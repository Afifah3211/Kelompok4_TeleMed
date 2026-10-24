-- MediSync: Sistem Manajemen Telemedis
-- Skema Database SQLite - Sesuai ERD Diagram PRD Kelompok 4
-- ============================================================
-- Tabel: users, patients, doctors, consultations,
--        medical_records, audit_logs
-- Catatan: Rekam medis tidak dihapus permanen (soft delete)
-- ============================================================

PRAGMA foreign_keys = ON;

-- ============================================================
-- 1. TABEL users
--    Akun autentikasi untuk semua role (admin/dokter/pasien)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,
  role          TEXT    NOT NULL CHECK(role IN ('admin', 'dokter', 'pasien')),
  is_active     INTEGER NOT NULL DEFAULT 1,  -- bool: 1=aktif, 0=nonaktif
  created_at    TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- ============================================================
-- 2. TABEL patients
--    Data profil pasien, berelasi ke users (1-to-1)
-- ============================================================
CREATE TABLE IF NOT EXISTS patients (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL UNIQUE,
  nik        TEXT,
  full_name  TEXT    NOT NULL,
  birth_date TEXT,                 -- date (YYYY-MM-DD)
  gender     TEXT CHECK(gender IN ('L', 'P', NULL)),
  phone      TEXT,
  address    TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================================
-- 3. TABEL doctors
--    Data profil dokter, berelasi ke users (1-to-1)
-- ============================================================
CREATE TABLE IF NOT EXISTS doctors (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        INTEGER NOT NULL UNIQUE,
  full_name      TEXT    NOT NULL,
  specialization TEXT,
  str_number     TEXT,             -- Nomor SIP/STR dokter
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================================
-- 4. TABEL consultations
--    Jadwal konsultasi antara pasien dan dokter
--    Sesuai ERD: patient_id (FK->patients), doctor_id (FK->doctors)
-- ============================================================
CREATE TABLE IF NOT EXISTS consultations (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id   INTEGER NOT NULL,
  doctor_id    INTEGER NOT NULL,
  scheduled_at TEXT    NOT NULL,   -- timestamp konsultasi
  status       TEXT    NOT NULL DEFAULT 'Menunggu'
               CHECK(status IN ('Menunggu', 'Sedang Berlangsung', 'Selesai', 'Dibatalkan')),
  type         TEXT    NOT NULL,   -- 'Video Telekonsultasi', 'Konsultasi Online', dst.
  complaint    TEXT,               -- Keluhan awal pasien saat booking
  room_url     TEXT,               -- URL ruang meeting virtual
  notes        TEXT,               -- Catatan tambahan
  created_at   TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (doctor_id)  REFERENCES doctors(id)
);

-- ============================================================
-- 5. TABEL medical_records
--    Rekam medis elektronik (EMR) — soft delete sesuai PRD
--    Catatan: Rekam medis TIDAK dihapus permanen (is_deleted flag)
-- ============================================================
CREATE TABLE IF NOT EXISTS medical_records (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id      INTEGER NOT NULL,
  doctor_id       INTEGER NOT NULL,
  consultation_id INTEGER,         -- nullable: EMR bisa dibuat tanpa konsultasi
  complaint       TEXT,
  diagnosis       TEXT,
  treatment       TEXT,            -- Tindakan medis
  prescription    TEXT,            -- Resep obat (e-Prescription)
  -- Tanda-tanda vital (tambahan dari PRD tampilan UI)
  vital_bp        TEXT,
  vital_heart_rate TEXT,
  vital_temperature TEXT,
  vital_resp_rate TEXT,
  vital_weight    TEXT,
  -- Soft Delete fields (Sesuai PRD: data fisik tetap aman)
  is_deleted      INTEGER NOT NULL DEFAULT 0,  -- bool: 1=dihapus, 0=aktif
  deleted_at      TEXT,
  deleted_by      TEXT,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (patient_id)      REFERENCES patients(id),
  FOREIGN KEY (doctor_id)       REFERENCES doctors(id),
  FOREIGN KEY (consultation_id) REFERENCES consultations(id)
);

-- ============================================================
-- 6. TABEL audit_logs
--    Forensic trail aktivitas sistem — Sesuai ERD PRD
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER,              -- FK ke users (nullable: bisa dari sistem)
  action     TEXT    NOT NULL,     -- LOGIN, CREATE, UPDATE, DELETE, RESTORE, BACKUP
  table_name TEXT,                 -- Nama tabel yang terpengaruh
  record_id  INTEGER,              -- ID record yang terpengaruh
  ip_address TEXT,
  created_at TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  -- Kolom tambahan untuk detail log (tampilan UI Admin PRD)
  user_name  TEXT,
  severity   TEXT    DEFAULT 'info'
             CHECK(severity IN ('info', 'success', 'warning', 'danger')),
  details    TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ============================================================
-- 7. TABEL backup_config & backup_nodes
--    Konfigurasi Aturan 3-2-1 Backup (Sesuai PRD)
-- ============================================================
CREATE TABLE IF NOT EXISTS backup_config (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  policy          TEXT,
  last_backup     TEXT,
  next_backup     TEXT,
  backup_schedule TEXT,
  encryption      TEXT,
  retention       TEXT
);

CREATE TABLE IF NOT EXISTS backup_nodes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  config_id   INTEGER NOT NULL,
  copy_label  TEXT,
  type        TEXT,
  location    TEXT,
  status      TEXT,
  size        TEXT,
  latency     TEXT,
  FOREIGN KEY (config_id) REFERENCES backup_config(id)
);
