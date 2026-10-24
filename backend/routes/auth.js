'use strict';
const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');

// POST /api/auth/login
router.post('/login', (req, res) => {
  try {
    const db = getDb();
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username dan password wajib diisi' });

    const user = db.prepare("SELECT * FROM users WHERE username = ? AND password_hash = ? AND is_active = 1").get(username, password);
    if (!user) return res.status(401).json({ error: 'Username/password salah atau akun nonaktif' });

    let profile = null;
    if (user.role === 'pasien') profile = db.prepare('SELECT * FROM patients WHERE user_id = ?').get(user.id);
    else if (user.role === 'dokter') profile = db.prepare('SELECT * FROM doctors WHERE user_id = ?').get(user.id);

    // Audit log
    db.prepare(`INSERT INTO audit_logs (user_id, action, table_name, record_id, ip_address, created_at, user_name, severity, details) VALUES (?,?,?,?,?,datetime('now','localtime'),?,?,?)`)
      .run(user.id, 'LOGIN', 'users', user.id, req.ip, user.username, 'info', `Login berhasil sebagai ${user.role}.`);

    res.json({ user: { ...user, is_active: Boolean(user.is_active) }, profile });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/auth/register (pasien only)
router.post('/register', (req, res) => {
  try {
    const db = getDb();
    const { username, password, fullName, nik, birthDate, gender, phone, address } = req.body;
    if (!username || !password || !fullName) return res.status(400).json({ error: 'Username, password, dan nama wajib diisi' });

    // Check duplicate
    const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (exists) return res.status(409).json({ error: 'Username sudah terdaftar' });

    const { lastInsertRowid: userId } = db.prepare(`INSERT INTO users (username, password_hash, role, is_active) VALUES (?, ?, 'pasien', 1)`).run(username, password);
    db.prepare(`INSERT INTO patients (user_id, nik, full_name, birth_date, gender, phone, address) VALUES (?,?,?,?,?,?,?)`)
      .run(userId, nik || null, fullName, birthDate || null, gender || null, phone || null, address || null);

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    const profile = db.prepare('SELECT * FROM patients WHERE user_id = ?').get(userId);

    db.prepare(`INSERT INTO audit_logs (user_id, action, table_name, record_id, ip_address, created_at, user_name, severity, details) VALUES (?,?,?,?,?,datetime('now','localtime'),?,?,?)`)
      .run(userId, 'CREATE', 'users', userId, req.ip, username, 'success', `Registrasi pasien baru: ${fullName}.`);

    res.status(201).json({ user, profile });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/auth/reset-password
router.post('/reset-password', (req, res) => {
  try {
    const db = getDb();
    const { username, newPassword } = req.body;
    if (!username || !newPassword) return res.status(400).json({ error: 'Username dan password baru wajib diisi' });

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) return res.status(404).json({ error: 'Akun tidak ditemukan' });

    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newPassword, user.id);
    res.json({ message: 'Password berhasil diperbarui' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
