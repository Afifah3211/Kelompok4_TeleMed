'use strict';
/**
 * MediSync - DRP (Disaster Recovery Plan) Router
 * ================================================
 * Endpoint untuk manajemen PITR dan simulasi insiden.
 * Digunakan untuk demonstrasi DRP pada studi kasus.
 *
 * Endpoints:
 *   GET  /api/drp/status          — Status database & backup
 *   POST /api/drp/snapshot        — Buat PITR snapshot sekarang
 *   GET  /api/drp/snapshots       — Daftar semua snapshot PITR
 *   POST /api/drp/simulate-drop   — [DEMO] Simulasi DROP TABLE
 *   POST /api/drp/recover/:id     — Recover dari snapshot PITR
 */
const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../db/medisync.db');
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, '../backups');
const PITR_DIR = path.join(BACKUP_DIR, 'pitr');

// Pastikan direktori ada
[BACKUP_DIR, PITR_DIR].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// ── Helper: buat timestamp string ───────────────────────────
function ts() {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}
function fileTs() {
  // Replace semua karakter non-digit agar nama file bersih (tanpa titik/dash)
  return new Date().toISOString().replace(/[^0-9]/g, '').substring(0, 15);
}


// ── Helper: baca statistik database ─────────────────────────
function getDbStats(db) {
  const tableExists = (t) => {
    try {
      return db.prepare(`SELECT COUNT(*) as c FROM sqlite_master WHERE type='table' AND name=?`).get(t).c > 0;
    } catch { return false; }
  };
  const count = (q) => { try { return db.prepare(q).get().cnt; } catch { return null; } };

  return {
    medical_records_table_exists: tableExists('medical_records'),
    users: count('SELECT COUNT(*) as cnt FROM users'),
    medical_records: tableExists('medical_records')
      ? count('SELECT COUNT(*) as cnt FROM medical_records')
      : null,
    consultations: count('SELECT COUNT(*) as cnt FROM consultations'),
    audit_logs: count('SELECT COUNT(*) as cnt FROM audit_logs'),
  };
}

// ────────────────────────────────────────────────────────────
// GET /api/drp/status — Status database & sistem DRP
// ────────────────────────────────────────────────────────────
router.get('/status', (req, res) => {
  try {
    const db = getDb();
    const stats = getDbStats(db);

    // Hitung jumlah snapshot PITR
    const snapshots = fs.readdirSync(PITR_DIR)
      .filter(f => f.endsWith('.meta'))
      .length;

    // Hitung jumlah backup reguler
    const backups = fs.existsSync(BACKUP_DIR)
      ? fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.db') && !f.startsWith('pre_')).length
      : 0;

    res.json({
      success: true,
      data: {
        system: 'MediSync DRP Status',
        timestamp: ts(),
        database: {
          path: DB_PATH,
          exists: fs.existsSync(DB_PATH),
          size_bytes: fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH).size : 0,
          ...stats,
          integrity: stats.medical_records_table_exists ? 'NORMAL' : 'KRITIS - TABEL HILANG',
        },
        drp: {
          pitr_snapshots: snapshots,
          regular_backups: backups,
          pitr_dir: PITR_DIR,
          backup_dir: BACKUP_DIR,
          rpo_target: 'RPO ≈ 0 (snapshot sebelum setiap operasi kritis)',
          rto_target: 'RTO < 5 menit (via PITR recovery script)',
        }
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ────────────────────────────────────────────────────────────
// POST /api/drp/snapshot — Buat PITR snapshot sekarang
// ────────────────────────────────────────────────────────────
router.post('/snapshot', (req, res) => {
  try {
    const db = getDb();
    const stats = getDbStats(db);
    const timestamp = fileTs();
    const snapshotId = `PITR_${timestamp}`;
    const snapshotFile = path.join(PITR_DIR, `${snapshotId}.db`);
    const metaFile = path.join(PITR_DIR, `${snapshotId}.meta`);

    // WAL checkpoint untuk konsistensi penuh sebelum copy
    db.pragma('wal_checkpoint(TRUNCATE)');

    // Buat snapshot dengan fs.copyFileSync (paling reliabel untuk SQLite WAL mode)
    fs.copyFileSync(DB_PATH, snapshotFile);

    // Verifikasi integritas snapshot
    const checkDb = new Database(snapshotFile, { readonly: true });
    const integrity = checkDb.pragma('integrity_check', { simple: true });
    const snapSize = fs.statSync(snapshotFile).size;
    checkDb.close();

    if (integrity !== 'ok') {
      fs.unlinkSync(snapshotFile);
      return res.status(500).json({ success: false, error: 'Snapshot gagal: integritas tidak valid' });
    }

    // Simpan metadata
    const meta = [
      `snapshot_id=${snapshotId}`,
      `timestamp=${timestamp}`,
      `created_at=${ts()}`,
      `db_file=${DB_PATH}`,
      `snapshot_file=${snapshotFile}`,
      `size_bytes=${snapSize}`,
      `pre_incident_users=${stats.users}`,
      `pre_incident_medical_records=${stats.medical_records}`,
      `pre_incident_consultations=${stats.consultations}`,
      `pre_incident_audit_logs=${stats.audit_logs}`,
      `status=CLEAN_SNAPSHOT`,
    ].join('\n');
    fs.writeFileSync(metaFile, meta);

    // Catat ke audit log
    try {
      db.prepare(`
        INSERT INTO audit_logs (user_id, action, table_name, ip_address, created_at, user_name, severity, details)
        VALUES (NULL, 'BACKUP', 'pitr_snapshots', ?, ?, 'DRP System', 'success', ?)
      `).run(req.ip || '127.0.0.1', ts(), `PITR Snapshot dibuat: ${snapshotId}. Records: ${stats.medical_records} EMR, ${stats.users} users.`);
    } catch (_) {}

    res.json({
      success: true,
      snapshot_id: snapshotId,
      created_at: ts(),
      size_kb: Math.round(snapSize / 1024),
      stats_at_snapshot: stats,
      message: `Snapshot PITR berhasil dibuat. Gunakan ID ini untuk recovery: ${snapshotId}`,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ────────────────────────────────────────────────────────────
// GET /api/drp/snapshots — Daftar semua snapshot PITR
// ────────────────────────────────────────────────────────────
router.get('/snapshots', (req, res) => {
  try {
    const metaFiles = fs.readdirSync(PITR_DIR)
      .filter(f => f.endsWith('.meta'))
      .sort()
      .reverse(); // Terbaru duluan

    const snapshots = metaFiles.map(f => {
      const content = fs.readFileSync(path.join(PITR_DIR, f), 'utf-8');
      const meta = {};
      content.split('\n').forEach(line => {
        const [k, ...v] = line.split('=');
        if (k) meta[k.trim()] = v.join('=').trim();
      });
      const snapFile = path.join(PITR_DIR, `${meta.snapshot_id}.db`);
      meta.file_exists = fs.existsSync(snapFile);
      meta.file_size_kb = meta.file_exists
        ? Math.round(fs.statSync(snapFile).size / 1024)
        : 0;
      return meta;
    });

    res.json({ success: true, count: snapshots.length, data: snapshots });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ────────────────────────────────────────────────────────────
// POST /api/drp/simulate-drop — [DEMO] Simulasi DROP TABLE
// Endpoint khusus demonstrasi DRP — jangan aktifkan di produksi!
// ────────────────────────────────────────────────────────────
router.post('/simulate-drop', (req, res) => {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DRP_DEMO !== 'true') {
    return res.status(403).json({
      success: false,
      error: 'Simulasi insiden dinonaktifkan di production. Set ALLOW_DRP_DEMO=true untuk mengaktifkan.'
    });
  }

  try {
    const db = getDb();

    // Catat kondisi sebelum insiden
    const beforeStats = getDbStats(db);

    // Nonaktifkan FK sementara untuk simulasi
    db.pragma('foreign_keys = OFF');

    // === SIMULASI INSIDEN: DROP TABLE ===
    db.exec('DROP TABLE IF EXISTS medical_records');

    // Re-aktifkan FK
    db.pragma('foreign_keys = ON');

    // Catat ke audit log
    try {
      db.prepare(`
        INSERT INTO audit_logs (user_id, action, table_name, ip_address, created_at, user_name, severity, details)
        VALUES (NULL, 'DROP_TABLE', 'medical_records', ?, ?, 'DRP_DEMO_SIMULATION', 'danger', ?)
      `).run(
        req.ip || '127.0.0.1', ts(),
        `[DRP SIMULASI] Human Error: DROP TABLE medical_records. ${beforeStats.medical_records} rekam medis hilang. Recovery diperlukan segera.`
      );
    } catch (_) {}

    res.json({
      success: true,
      incident: {
        type: 'HUMAN_ERROR',
        action: 'DROP TABLE medical_records',
        timestamp: ts(),
        data_lost: {
          medical_records: beforeStats.medical_records,
          description: 'Seluruh tabel rekam medis pasien TERHAPUS'
        },
        severity: 'CRITICAL',
      },
      before_incident: beforeStats,
      after_incident: getDbStats(db),
      recovery_instructions: {
        step1: 'GET /api/drp/snapshots — Lihat daftar snapshot PITR tersedia',
        step2: 'POST /api/drp/recover/{snapshot_id} — Pilih snapshot sebelum insiden',
        step3: 'Restart backend setelah recovery selesai',
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ────────────────────────────────────────────────────────────
// POST /api/drp/recover/:snapshotId — Recovery dari snapshot PITR
// ────────────────────────────────────────────────────────────
router.post('/recover/:snapshotId', (req, res) => {
  const { snapshotId } = req.params;
  const snapshotFile = path.join(PITR_DIR, `${snapshotId}.db`);
  const metaFile = path.join(PITR_DIR, `${snapshotId}.meta`);

  if (!fs.existsSync(snapshotFile)) {
    return res.status(404).json({
      success: false,
      error: `Snapshot tidak ditemukan: ${snapshotId}`,
      hint: 'Gunakan GET /api/drp/snapshots untuk melihat daftar snapshot tersedia.'
    });
  }

  try {
    // Baca metadata pre-incident
    let preMeta = {};
    if (fs.existsSync(metaFile)) {
      fs.readFileSync(metaFile, 'utf-8').split('\n').forEach(line => {
        const [k, ...v] = line.split('=');
        if (k) preMeta[k.trim()] = v.join('=').trim();
      });
    }

    // Verifikasi integritas snapshot
    const checkDb = new Database(snapshotFile, { readonly: true });
    const integrity = checkDb.pragma('integrity_check', { simple: true });
    checkDb.close();

    if (integrity !== 'ok') {
      return res.status(500).json({ success: false, error: 'Snapshot rusak — tidak dapat digunakan untuk recovery' });
    }

    // Catat kondisi saat ini (post-incident)
    let postStats = {};
    try {
      const db = getDb();
      postStats = getDbStats(db);
    } catch (_) {}

    // Safety backup sebelum recovery
    const safetyFile = path.join(BACKUP_DIR, `pre_pitr_safety_${fileTs()}.db`);
    try {
      fs.copyFileSync(DB_PATH, safetyFile);
    } catch (_) {}

    // ── LAKUKAN RECOVERY ─────────────────────────────────────
    // Tutup koneksi DB saat ini (singleton) sebelum overwrite file
    // Pada SQLite, kita bisa langsung copy file saat WAL mode
    fs.copyFileSync(snapshotFile, DB_PATH);

    // Verifikasi pasca-recovery
    const recoveredDb = new Database(DB_PATH, { readonly: true });
    const recoveredStats = getDbStats(recoveredDb);
    recoveredDb.close();

    // Catat ke audit log (pada DB yang sudah di-recover)
    try {
      const db2 = new Database(DB_PATH);
      db2.prepare(`
        INSERT INTO audit_logs (user_id, action, table_name, ip_address, created_at, user_name, severity, details)
        VALUES (NULL, 'RESTORE', 'medical_records', ?, ?, 'DRP System', 'success', ?)
      `).run(
        req.ip || '127.0.0.1', ts(),
        `PITR Recovery berhasil dari snapshot ${snapshotId}. ${recoveredStats.medical_records} rekam medis dipulihkan.`
      );
      db2.close();
    } catch (_) {}

    // Update metadata
    if (fs.existsSync(metaFile)) {
      fs.appendFileSync(metaFile, `\nrecovery_status=RECOVERED\nrecovery_timestamp=${ts()}`);
    }

    res.json({
      success: true,
      message: 'Point-in-Time Recovery BERHASIL. Rekam medis pasien dipulihkan.',
      recovery: {
        snapshot_id: snapshotId,
        snapshot_created_at: preMeta.created_at || 'N/A',
        recovery_timestamp: ts(),
      },
      before_recovery: postStats,
      after_recovery: recoveredStats,
      data_restored: {
        medical_records: recoveredStats.medical_records,
        users: recoveredStats.users,
        consultations: recoveredStats.consultations,
      },
      next_steps: 'Restart server backend agar singleton DB ter-refresh: docker restart medisync_backend'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
