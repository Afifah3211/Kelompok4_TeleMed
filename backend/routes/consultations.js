'use strict';
const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');

// GET /api/consultations
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { patient_id, doctor_id, status } = req.query;
    let q = `SELECT c.*, p.full_name as patient_name, p.nik as patient_nik, d.full_name as doctor_name, d.specialization FROM consultations c JOIN patients p ON c.patient_id = p.id JOIN doctors d ON c.doctor_id = d.id WHERE 1=1`;
    const params = [];
    if (patient_id) { q += ' AND c.patient_id = ?'; params.push(patient_id); }
    if (doctor_id) { q += ' AND c.doctor_id = ?'; params.push(doctor_id); }
    if (status) { q += ' AND c.status = ?'; params.push(status); }
    q += ' ORDER BY c.scheduled_at DESC';
    res.json(db.prepare(q).all(...params));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/consultations/:id
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const row = db.prepare(`SELECT c.*, p.full_name as patient_name, p.nik as patient_nik, d.full_name as doctor_name, d.specialization FROM consultations c JOIN patients p ON c.patient_id = p.id JOIN doctors d ON c.doctor_id = d.id WHERE c.id = ?`).get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Konsultasi tidak ditemukan' });
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/consultations — pasien booking
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { patient_id, doctor_id, scheduled_at, type, complaint } = req.body;
    if (!patient_id || !doctor_id || !scheduled_at || !type) return res.status(400).json({ error: 'patient_id, doctor_id, scheduled_at, type wajib' });

    const { lastInsertRowid } = db.prepare(`INSERT INTO consultations (patient_id, doctor_id, scheduled_at, status, type, complaint, room_url) VALUES (?,?,?,'Menunggu',?,?,?)`)
      .run(patient_id, doctor_id, scheduled_at, type, complaint || null, `https://meet.medisync.id/room/c${Date.now()}`);

    const created = db.prepare(`SELECT c.*, p.full_name as patient_name, d.full_name as doctor_name, d.specialization FROM consultations c JOIN patients p ON c.patient_id=p.id JOIN doctors d ON c.doctor_id=d.id WHERE c.id=?`).get(lastInsertRowid);
    res.status(201).json(created);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/consultations/:id/status
router.patch('/:id/status', (req, res) => {
  try {
    const db = getDb();
    const { status } = req.body;
    const valid = ['Menunggu', 'Sedang Berlangsung', 'Selesai', 'Dibatalkan'];
    if (!valid.includes(status)) return res.status(400).json({ error: `Status harus: ${valid.join(', ')}` });
    db.prepare("UPDATE consultations SET status=?, updated_at=datetime('now','localtime') WHERE id=?").run(status, req.params.id);
    res.json({ message: 'Status diperbarui', id: Number(req.params.id), status });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
