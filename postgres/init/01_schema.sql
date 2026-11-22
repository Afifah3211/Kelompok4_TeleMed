-- ============================================================
-- TeleMed (Kelompok 4) - Skema PostgreSQL 16
-- Sesuai Dokumen Arsitektur & DRP Awal (6 tabel inti)
-- + tabel tambahan yang MEMANG dipakai aplikasi: prescriptions, prescription_items,
--   backup_config, backup_nodes, backup_runs
-- Aman dijalankan berulang (IF NOT EXISTS).
-- ============================================================

-- 1. users ---------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,              -- hash bcrypt, BUKAN password asli
  role          VARCHAR(20)  NOT NULL
                CHECK (role IN ('admin','dokter','pasien')),
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
  is_deleted    BOOLEAN      NOT NULL DEFAULT FALSE,
  deleted_at    TIMESTAMPTZ,
  deleted_by    VARCHAR(150),
  delete_reason TEXT,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 2. patients ------------------------------------------------
CREATE TABLE IF NOT EXISTS patients (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  nik        VARCHAR(16),
  full_name  VARCHAR(150) NOT NULL,
  birth_date DATE,
  gender     CHAR(1) CHECK (gender IN ('L','P')),
  phone      VARCHAR(30),
  address    TEXT,
  blood_type VARCHAR(3),
  allergies  TEXT,
  profile_photo_key VARCHAR(512)
);

-- 3. doctors -------------------------------------------------
CREATE TABLE IF NOT EXISTS doctors (
  id             SERIAL PRIMARY KEY,
  user_id        INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  full_name      VARCHAR(150) NOT NULL,
  specialization VARCHAR(150),
  str_number     VARCHAR(60),
  phone          VARCHAR(30),
  workplace      VARCHAR(150),
  profile_photo_key VARCHAR(512)
);

-- 4. consultations -------------------------------------------
CREATE TABLE IF NOT EXISTS consultations (
  id           SERIAL PRIMARY KEY,
  patient_id   INTEGER NOT NULL REFERENCES patients(id),
  doctor_id    INTEGER NOT NULL REFERENCES doctors(id),
  scheduled_at TIMESTAMPTZ NOT NULL,
  status       VARCHAR(30) NOT NULL DEFAULT 'Menunggu'
               CHECK (status IN ('Menunggu','Sedang Berlangsung','Selesai','Dibatalkan')),
  type         VARCHAR(60) NOT NULL,
  complaint    TEXT,
  room_url     TEXT,
  notes        TEXT,
  is_deleted   BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at   TIMESTAMPTZ,
  deleted_by   VARCHAR(150),
  delete_reason TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_consult_patient ON consultations(patient_id);
CREATE INDEX IF NOT EXISTS idx_consult_doctor  ON consultations(doctor_id);
CREATE INDEX IF NOT EXISTS idx_consult_status  ON consultations(status);
CREATE INDEX IF NOT EXISTS idx_consult_deleted ON consultations(is_deleted);

-- 5. medical_records (soft delete) ----------------------------
CREATE TABLE IF NOT EXISTS medical_records (
  id                SERIAL PRIMARY KEY,
  patient_id        INTEGER NOT NULL REFERENCES patients(id),
  doctor_id         INTEGER NOT NULL REFERENCES doctors(id),
  consultation_id   INTEGER REFERENCES consultations(id),
  complaint         TEXT,
  diagnosis         TEXT,
  treatment         TEXT,
  prescription      TEXT,
  vital_bp          VARCHAR(30),
  vital_heart_rate  VARCHAR(30),
  vital_temperature VARCHAR(30),
  vital_resp_rate   VARCHAR(30),
  vital_weight      VARCHAR(30),
  is_deleted        BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at        TIMESTAMPTZ,
  deleted_by        VARCHAR(200),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mr_patient ON medical_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_mr_doctor  ON medical_records(doctor_id);
CREATE INDEX IF NOT EXISTS idx_mr_deleted ON medical_records(is_deleted);

-- 6. audit_logs ----------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id         BIGSERIAL PRIMARY KEY,
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  user_name  VARCHAR(150),
  action     VARCHAR(30) NOT NULL,        -- LOGIN, CREATE, UPDATE, DELETE, RESTORE, BACKUP
  table_name VARCHAR(60),
  record_id  INTEGER,
  ip_address VARCHAR(64),
  severity   VARCHAR(10) NOT NULL DEFAULT 'info'
             CHECK (severity IN ('info','success','warning','danger')),
  details    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user    ON audit_logs(user_id);

-- 7. Prescriptions belong to the doctor-patient clinical workflow.
CREATE TABLE IF NOT EXISTS prescriptions (
  id                SERIAL PRIMARY KEY,
  medical_record_id INTEGER REFERENCES medical_records(id),
  consultation_id   INTEGER REFERENCES consultations(id),
  patient_id        INTEGER NOT NULL REFERENCES patients(id),
  doctor_id         INTEGER NOT NULL REFERENCES doctors(id),
  status            VARCHAR(20) NOT NULL DEFAULT 'Diterbitkan'
                    CHECK (status = 'Diterbitkan'),
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rx_status  ON prescriptions(status);
CREATE INDEX IF NOT EXISTS idx_rx_patient ON prescriptions(patient_id);

CREATE TABLE IF NOT EXISTS prescription_items (
  id              SERIAL PRIMARY KEY,
  prescription_id INTEGER NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
  medicine_name   VARCHAR(150) NOT NULL,
  quantity        VARCHAR(50),
  dosage          TEXT
);

-- 7b. Consultation chat messages and MinIO image metadata --------
CREATE TABLE IF NOT EXISTS chat_messages (
  id                       BIGSERIAL PRIMARY KEY,
  consultation_id          INTEGER NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
  sender_user_id           INTEGER NOT NULL REFERENCES users(id),
  body                     TEXT,
  attachment_key           VARCHAR(512),
  attachment_name          VARCHAR(255),
  attachment_content_type  VARCHAR(100),
  attachment_size_bytes    BIGINT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chat_message_has_content CHECK (
    NULLIF(BTRIM(body), '') IS NOT NULL OR attachment_key IS NOT NULL
  )
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_consultation_created
  ON chat_messages(consultation_id, created_at, id);

-- 7c. WebRTC video-call signaling (SDP/ICE only; temporary metadata) ----
CREATE TABLE IF NOT EXISTS consultation_video_sessions (
  consultation_id INTEGER PRIMARY KEY REFERENCES consultations(id) ON DELETE CASCADE,
  session_id      UUID NOT NULL,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at        TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS consultation_video_signals (
  id              BIGSERIAL PRIMARY KEY,
  consultation_id INTEGER NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
  session_id      UUID NOT NULL,
  sender_user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  signal_type     VARCHAR(20) NOT NULL
                  CHECK (signal_type IN ('offer','answer','candidate','hangup')),
  payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_video_signals_room
  ON consultation_video_signals(consultation_id, session_id, id);

-- 8. backup (konfigurasi tampilan + log eksekusi nyata) -------
CREATE TABLE IF NOT EXISTS backup_config (
  id              SERIAL PRIMARY KEY,
  policy          VARCHAR(100),
  last_backup     TIMESTAMPTZ,
  next_backup     TIMESTAMPTZ,
  backup_schedule VARCHAR(100),
  encryption      VARCHAR(60),
  retention       VARCHAR(60)
);

CREATE TABLE IF NOT EXISTS backup_nodes (
  id         SERIAL PRIMARY KEY,
  config_id  INTEGER NOT NULL REFERENCES backup_config(id) ON DELETE CASCADE,
  copy_label VARCHAR(100),
  type       VARCHAR(60),
  location   VARCHAR(100),
  status     VARCHAR(60),
  size       VARCHAR(30),
  latency    VARCHAR(30)
);

CREATE TABLE IF NOT EXISTS backup_runs (
  id           SERIAL PRIMARY KEY,
  kind         VARCHAR(20) NOT NULL CHECK (kind IN ('dump','base','snapshot','manual')),
  status       VARCHAR(20) NOT NULL CHECK (status IN ('running','success','failed')),
  file_name    VARCHAR(255),
  size_bytes   BIGINT,
  triggered_by VARCHAR(100),
  started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at  TIMESTAMPTZ
);
