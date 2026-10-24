'use strict';
/**
 * MediSync - Appointments Router
 * CRUD untuk jadwal konsultasi / janji temu
 * Sesuai PRD: Pasien booking, Dokter lihat antrean, status update
 */
const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');

function formatAppointment(row) {
  if (!row) return null;
  return {
    id: row.id,
    patientId: row.patient_id,
    patientName: row.patient_name,
    patientNik: row.patient_nik,
    patientGender: row.patient_gender,
    patientAge: row.patient_age,
    doctorId: row.doctor_id,
    doctorName: row.doctor_name,
    specialty: row.specialty,
    date: row.date,
    time: row.time,
    type: row.type,
    complaint: row.complaint,
    status: row.status,
    roomUrl: row.room_url,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// GET /api/appointments - Semua janji temu (dengan filter)
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { patientId, doctorId, status, date } = req.query;
    let query = 'SELECT * FROM appointments WHERE 1=1';
    const params = [];
    if (patientId) { query += ' AND patient_id = ?'; params.push(patientId); }
    if (doctorId)  { query += ' AND doctor_id = ?';  params.push(doctorId); }
    if (status)    { query += ' AND status = ?';      params.push(status); }
    if (date)      { query += ' AND date LIKE ?';     params.push(`%${date}%`); }
    query += ' ORDER BY created_at DESC';
    const rows = db.prepare(query).all(...params);
    res.json({ success: true, data: rows.map(formatAppointment) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/appointments/:id - Detail satu janji temu
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const row = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: 'Janji temu tidak ditemukan' });
    res.json({ success: true, data: formatAppointment(row) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/appointments - Buat janji temu baru (Pasien booking)
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const {
      patientId, patientName, patientNik, patientGender, patientAge,
      doctorId, doctorName, specialty, date, time, type, complaint, notes
    } = req.body;

    if (!patientId || !doctorId || !date || !time || !type) {
      return res.status(400).json({ success: false, error: 'Field wajib: patientId, doctorId, date, time, type' });
    }

    const now = new Date();
    const seq = Math.floor(100 + Math.random() * 900);
    const newId = `APT-${seq}`;

    db.prepare(`
      INSERT INTO appointments
        (id, patient_id, patient_name, patient_nik, patient_gender, patient_age,
         doctor_id, doctor_name, specialty, date, time, type, complaint, status, room_url, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Menunggu', ?, ?)
    `).run(
      newId, patientId, patientName || '', patientNik || null, patientGender || null, patientAge || null,
      doctorId, doctorName || '', specialty || null, date, time, type,
      complaint || null, `https://meet.medisync.id/room/${newId.toLowerCase()}-session`, notes || null
    );

    const created = db.prepare('SELECT * FROM appointments WHERE id = ?').get(newId);
    res.status(201).json({ success: true, data: formatAppointment(created) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/appointments/:id/status - Update status janji temu
router.patch('/:id/status', (req, res) => {
  try {
    const db = getDb();
    const { status } = req.body;
    const validStatuses = ['Menunggu', 'Sedang Berlangsung', 'Selesai', 'Dibatalkan'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: `Status tidak valid. Pilihan: ${validStatuses.join(', ')}` });
    }

    const apt = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
    if (!apt) return res.status(404).json({ success: false, error: 'Janji temu tidak ditemukan' });

    db.prepare("UPDATE appointments SET status = ?, updated_at = datetime('now','localtime') WHERE id = ?")
      .run(status, req.params.id);

    const updated = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
    res.json({ success: true, data: formatAppointment(updated) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/appointments/:id - Update lengkap janji temu
router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const apt = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
    if (!apt) return res.status(404).json({ success: false, error: 'Janji temu tidak ditemukan' });

    const { date, time, type, complaint, status, notes } = req.body;
    db.prepare(`
      UPDATE appointments SET
        date = COALESCE(?, date),
        time = COALESCE(?, time),
        type = COALESCE(?, type),
        complaint = COALESCE(?, complaint),
        status = COALESCE(?, status),
        notes = COALESCE(?, notes),
        updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(date || null, time || null, type || null, complaint || null, status || null, notes || null, req.params.id);

    const updated = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
    res.json({ success: true, data: formatAppointment(updated) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/appointments/:id - Batalkan janji temu (set status Dibatalkan)
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const apt = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
    if (!apt) return res.status(404).json({ success: false, error: 'Janji temu tidak ditemukan' });

    db.prepare("UPDATE appointments SET status = 'Dibatalkan', updated_at = datetime('now','localtime') WHERE id = ?")
      .run(req.params.id);
    res.json({ success: true, message: `Janji temu ${req.params.id} dibatalkan` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
