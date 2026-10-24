'use strict';
const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');

// GET /api/medical-records
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { patient_id, doctor_id, include_deleted } = req.query;
    let q = `SELECT mr.*, p.full_name as patient_name, p.nik as patient_nik, d.full_name as doctor_name, d.str_number as doctor_str FROM medical_records mr JOIN patients p ON mr.patient_id=p.id JOIN doctors d ON mr.doctor_id=d.id WHERE 1=1`;
    const params = [];
    if (include_deleted !== 'true') q += ' AND mr.is_deleted=0';
    if (patient_id) { q += ' AND mr.patient_id=?'; params.push(patient_id); }
    if (doctor_id) { q += ' AND mr.doctor_id=?'; params.push(doctor_id); }
    q += ' ORDER BY mr.created_at DESC';
    res.json(db.prepare(q).all(...params));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/medical-records/deleted
router.get('/deleted', (req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare(`SELECT mr.*, p.full_name as patient_name, d.full_name as doctor_name FROM medical_records mr JOIN patients p ON mr.patient_id=p.id JOIN doctors d ON mr.doctor_id=d.id WHERE mr.is_deleted=1 ORDER BY mr.deleted_at DESC`).all();
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/medical-records/:id
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const row = db.prepare(`SELECT mr.*, p.full_name as patient_name, p.nik as patient_nik, d.full_name as doctor_name, d.str_number as doctor_str FROM medical_records mr JOIN patients p ON mr.patient_id=p.id JOIN doctors d ON mr.doctor_id=d.id WHERE mr.id=?`).get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Rekam medis tidak ditemukan' });
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/medical-records — dokter buat rekam medis
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { patient_id, doctor_id, consultation_id, complaint, diagnosis, treatment, prescription, vital_bp, vital_heart_rate, vital_temperature, vital_resp_rate, vital_weight } = req.body;
    if (!patient_id || !doctor_id || !diagnosis) return res.status(400).json({ error: 'patient_id, doctor_id, diagnosis wajib' });

    const { lastInsertRowid } = db.prepare(`INSERT INTO medical_records (patient_id, doctor_id, consultation_id, complaint, diagnosis, treatment, prescription, vital_bp, vital_heart_rate, vital_temperature, vital_resp_rate, vital_weight) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(patient_id, doctor_id, consultation_id||null, complaint||null, diagnosis, treatment||null, prescription||null, vital_bp||null, vital_heart_rate||null, vital_temperature||null, vital_resp_rate||null, vital_weight||null);

    if (consultation_id) {
      db.prepare("UPDATE consultations SET status='Selesai', updated_at=datetime('now','localtime') WHERE id=?").run(consultation_id);
    }

    const created = db.prepare(`SELECT mr.*, p.full_name as patient_name, d.full_name as doctor_name FROM medical_records mr JOIN patients p ON mr.patient_id=p.id JOIN doctors d ON mr.doctor_id=d.id WHERE mr.id=?`).get(lastInsertRowid);
    res.status(201).json(created);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/medical-records/:id — soft delete
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const { deleted_by, reason } = req.body;
    db.prepare(`UPDATE medical_records SET is_deleted=1, deleted_at=datetime('now','localtime'), deleted_by=? WHERE id=? AND is_deleted=0`)
      .run(`${deleted_by || 'Dokter'} (${reason || 'Koreksi data'})`, req.params.id);
    res.json({ message: 'Soft delete berhasil. Data fisik tetap aman.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/medical-records/:id/restore
router.patch('/:id/restore', (req, res) => {
  try {
    const db = getDb();
    db.prepare(`UPDATE medical_records SET is_deleted=0, deleted_at=NULL, deleted_by=NULL WHERE id=?`).run(req.params.id);
    res.json({ message: 'Rekam medis dipulihkan.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
