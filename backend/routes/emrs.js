'use strict';
/**
 * MediSync - EMR (Rekam Medis Elektronik) Router
 * CRUD + Soft Delete + Restore EMR
 * Sesuai PRD: Fitur Soft Delete EMR (is_deleted = true, data fisik tetap aman)
 */
const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');

function formatEmr(row) {
  if (!row) return null;
  return {
    id: row.id,
    appointmentId: row.appointment_id,
    patientId: row.patient_id,
    patientName: row.patient_name,
    patientNik: row.patient_nik,
    patientAge: row.patient_age,
    patientGender: row.patient_gender,
    doctorId: row.doctor_id,
    doctorName: row.doctor_name,
    doctorSip: row.doctor_sip,
    date: row.date,
    vitals: {
      bp:            row.vital_bp,
      heartRate:     row.vital_heart_rate,
      temperature:   row.vital_temperature,
      respiratoryRate: row.vital_resp_rate,
      weight:        row.vital_weight
    },
    complaint:    row.complaint,
    diagnosis:    row.diagnosis,
    action:       row.action,
    prescription: row.prescription,
    isDeleted:    Boolean(row.is_deleted),
    deletedAt:    row.deleted_at,
    deletedBy:    row.deleted_by,
    createdAt:    row.created_at,
    updatedAt:    row.updated_at
  };
}

// GET /api/emrs - Semua EMR (dengan filter)
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { patientId, doctorId, includeDeleted } = req.query;
    let query = 'SELECT * FROM emrs WHERE 1=1';
    const params = [];

    // Default: hanya tampilkan yang tidak dihapus (Soft Delete sesuai PRD)
    if (includeDeleted !== 'true') {
      query += ' AND is_deleted = 0';
    }
    if (patientId) { query += ' AND patient_id = ?'; params.push(patientId); }
    if (doctorId)  { query += ' AND doctor_id = ?';  params.push(doctorId); }
    query += ' ORDER BY created_at DESC';

    const rows = db.prepare(query).all(...params);
    res.json({ success: true, data: rows.map(formatEmr) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/emrs/deleted - Khusus EMR yang di-soft delete (Tab Arsip & Pemulihan PRD)
router.get('/deleted', (req, res) => {
  try {
    const db = getDb();
    const { doctorId } = req.query;
    let query = 'SELECT * FROM emrs WHERE is_deleted = 1';
    const params = [];
    if (doctorId) { query += ' AND doctor_id = ?'; params.push(doctorId); }
    query += ' ORDER BY deleted_at DESC';
    const rows = db.prepare(query).all(...params);
    res.json({ success: true, data: rows.map(formatEmr) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/emrs/:id - Detail satu EMR
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const row = db.prepare('SELECT * FROM emrs WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: 'Rekam medis tidak ditemukan' });
    res.json({ success: true, data: formatEmr(row) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/emrs - Simpan rekam medis baru (Dokter)
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const {
      appointmentId, patientId, patientName, patientNik, patientAge, patientGender,
      doctorId, doctorName, doctorSip,
      vitals = {},
      complaint, diagnosis, action, prescription
    } = req.body;

    if (!patientId || !doctorId || !diagnosis) {
      return res.status(400).json({ success: false, error: 'Field wajib: patientId, doctorId, diagnosis' });
    }

    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')} WIB`;
    const count = db.prepare('SELECT COUNT(*) as cnt FROM emrs').get().cnt;
    const newId = `EMR-${now.getFullYear()}-${String(count + 1).padStart(3, '0')}`;

    db.prepare(`
      INSERT INTO emrs
        (id, appointment_id, patient_id, patient_name, patient_nik, patient_age, patient_gender,
         doctor_id, doctor_name, doctor_sip, date,
         vital_bp, vital_heart_rate, vital_temperature, vital_resp_rate, vital_weight,
         complaint, diagnosis, action, prescription,
         is_deleted, deleted_at, deleted_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, NULL)
    `).run(
      newId, appointmentId || null, patientId, patientName || '',
      patientNik || null, patientAge || null, patientGender || null,
      doctorId, doctorName || '', doctorSip || null, dateStr,
      vitals.bp || null, vitals.heartRate || null, vitals.temperature || null,
      vitals.respiratoryRate || null, vitals.weight || null,
      complaint || null, diagnosis, action || null, prescription || null
    );

    // Auto update appointment status to Selesai if provided
    if (appointmentId) {
      db.prepare("UPDATE appointments SET status = 'Selesai', updated_at = datetime('now','localtime') WHERE id = ?")
        .run(appointmentId);
    }

    const created = db.prepare('SELECT * FROM emrs WHERE id = ?').get(newId);
    res.status(201).json({ success: true, data: formatEmr(created) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/emrs/:id - Update rekam medis
router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const emr = db.prepare('SELECT * FROM emrs WHERE id = ?').get(req.params.id);
    if (!emr) return res.status(404).json({ success: false, error: 'Rekam medis tidak ditemukan' });
    if (emr.is_deleted) return res.status(400).json({ success: false, error: 'Rekam medis sudah dihapus, pulihkan dulu sebelum mengedit' });

    const { vitals = {}, complaint, diagnosis, action, prescription } = req.body;

    db.prepare(`
      UPDATE emrs SET
        vital_bp = COALESCE(?, vital_bp),
        vital_heart_rate = COALESCE(?, vital_heart_rate),
        vital_temperature = COALESCE(?, vital_temperature),
        vital_resp_rate = COALESCE(?, vital_resp_rate),
        vital_weight = COALESCE(?, vital_weight),
        complaint = COALESCE(?, complaint),
        diagnosis = COALESCE(?, diagnosis),
        action = COALESCE(?, action),
        prescription = COALESCE(?, prescription),
        updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(
      vitals.bp || null, vitals.heartRate || null, vitals.temperature || null,
      vitals.respiratoryRate || null, vitals.weight || null,
      complaint || null, diagnosis || null, action || null, prescription || null,
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM emrs WHERE id = ?').get(req.params.id);
    res.json({ success: true, data: formatEmr(updated) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/emrs/:id - Soft Delete EMR (Sesuai PRD - data fisik TIDAK dihapus!)
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const emr = db.prepare('SELECT * FROM emrs WHERE id = ?').get(req.params.id);
    if (!emr) return res.status(404).json({ success: false, error: 'Rekam medis tidak ditemukan' });
    if (emr.is_deleted) return res.status(400).json({ success: false, error: 'Rekam medis sudah dalam kondisi terhapus' });

    const { deletedBy = 'Dokter', reason = 'Koreksi rekam medis oleh staf klinis' } = req.body;
    const now = new Date();
    const timeString = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')} WIB`;

    db.prepare(`
      UPDATE emrs SET
        is_deleted = 1,
        deleted_at = ?,
        deleted_by = ?,
        updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(timeString, `${deletedBy} (${reason})`, req.params.id);

    const updated = db.prepare('SELECT * FROM emrs WHERE id = ?').get(req.params.id);
    res.json({
      success: true,
      message: `Soft Delete berhasil. Data ${req.params.id} ditandai is_deleted=true. Data fisik tetap aman di database.`,
      data: formatEmr(updated)
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/emrs/:id/restore - Pulihkan EMR yang di-soft delete (Tab Arsip & Pemulihan PRD)
router.patch('/:id/restore', (req, res) => {
  try {
    const db = getDb();
    const emr = db.prepare('SELECT * FROM emrs WHERE id = ?').get(req.params.id);
    if (!emr) return res.status(404).json({ success: false, error: 'Rekam medis tidak ditemukan' });
    if (!emr.is_deleted) return res.status(400).json({ success: false, error: 'Rekam medis tidak dalam kondisi terhapus' });

    db.prepare(`
      UPDATE emrs SET
        is_deleted = 0,
        deleted_at = NULL,
        deleted_by = NULL,
        updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(req.params.id);

    const updated = db.prepare('SELECT * FROM emrs WHERE id = ?').get(req.params.id);
    res.json({
      success: true,
      message: `Rekam Medis ${req.params.id} berhasil dipulihkan ke status aktif.`,
      data: formatEmr(updated)
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
