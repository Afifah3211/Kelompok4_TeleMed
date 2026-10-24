'use strict';
const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');

// GET /api/users — list all (admin)
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { role } = req.query;
    let q = 'SELECT * FROM users WHERE 1=1';
    const p = [];
    if (role) { q += ' AND role = ?'; p.push(role); }
    q += ' ORDER BY id ASC';
    res.json(db.prepare(q).all(...p));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/users/patients — list all patients with profile
router.get('/patients', (req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare(`SELECT u.id as user_id, u.username, u.is_active, u.created_at, p.* FROM users u JOIN patients p ON p.user_id = u.id WHERE u.role='pasien' ORDER BY p.full_name`).all();
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/users/doctors — list all doctors with profile
router.get('/doctors', (req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare(`SELECT u.id as user_id, u.username, u.is_active, u.created_at, d.* FROM users u JOIN doctors d ON d.user_id = u.id WHERE u.role='dokter' ORDER BY d.full_name`).all();
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/users/doctor — admin creates a doctor
router.post('/doctor', (req, res) => {
  try {
    const db = getDb();
    const { username, password, fullName, specialization, strNumber } = req.body;
    if (!username || !password || !fullName) return res.status(400).json({ error: 'Username, password, nama wajib diisi' });

    const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (exists) return res.status(409).json({ error: 'Username sudah terdaftar' });

    const { lastInsertRowid: userId } = db.prepare(`INSERT INTO users (username, password_hash, role, is_active) VALUES (?,?,'dokter',1)`).run(username, password);
    db.prepare(`INSERT INTO doctors (user_id, full_name, specialization, str_number) VALUES (?,?,?,?)`).run(userId, fullName, specialization || null, strNumber || null);

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    const doctor = db.prepare('SELECT * FROM doctors WHERE user_id = ?').get(userId);
    res.status(201).json({ user, doctor });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/users/:id/toggle — toggle active/inactive
router.patch('/:id/toggle', (req, res) => {
  try {
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });
    const newStatus = user.is_active ? 0 : 1;
    db.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(newStatus, req.params.id);
    res.json({ ...user, is_active: newStatus });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/users/:id — update user profile
router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });

    if (user.role === 'pasien') {
      const { fullName, nik, birthDate, gender, phone, address } = req.body;
      db.prepare('UPDATE patients SET full_name=COALESCE(?,full_name), nik=COALESCE(?,nik), birth_date=COALESCE(?,birth_date), gender=COALESCE(?,gender), phone=COALESCE(?,phone), address=COALESCE(?,address) WHERE user_id=?')
        .run(fullName||null, nik||null, birthDate||null, gender||null, phone||null, address||null, user.id);
    } else if (user.role === 'dokter') {
      const { fullName, specialization, strNumber } = req.body;
      db.prepare('UPDATE doctors SET full_name=COALESCE(?,full_name), specialization=COALESCE(?,specialization), str_number=COALESCE(?,str_number) WHERE user_id=?')
        .run(fullName||null, specialization||null, strNumber||null, user.id);
    }
    res.json({ message: 'Profil diperbarui' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
