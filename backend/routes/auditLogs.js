'use strict';
const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');

// GET /api/audit-logs
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { user_id, action, search, limit = 200 } = req.query;
    let q = 'SELECT * FROM audit_logs WHERE 1=1';
    const p = [];
    if (user_id) { q += ' AND user_id=?'; p.push(user_id); }
    if (action) { q += ' AND action=?'; p.push(action); }
    if (search) { q += ' AND (details LIKE ? OR user_name LIKE ? OR table_name LIKE ?)'; const s=`%${search}%`; p.push(s,s,s); }
    q += ' ORDER BY created_at DESC LIMIT ?';
    p.push(Number(limit));
    res.json(db.prepare(q).all(...p));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/audit-logs
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { user_id, action, table_name, record_id, ip_address, user_name, severity, details } = req.body;
    db.prepare(`INSERT INTO audit_logs (user_id, action, table_name, record_id, ip_address, created_at, user_name, severity, details) VALUES (?,?,?,?,?,datetime('now','localtime'),?,?,?)`)
      .run(user_id||null, action, table_name||null, record_id||null, ip_address||'127.0.0.1', user_name||null, severity||'info', details||null);
    res.status(201).json({ message: 'Log ditambahkan' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/audit-logs/export/csv
router.get('/export/csv', (req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC').all();
    const hdr = 'ID,Waktu,User ID,Username,Aksi,Tabel,Record ID,IP,Severity,Detail\n';
    const csv = rows.map(r => `${r.id},${r.created_at},${r.user_id},${r.user_name},${r.action},${r.table_name},${r.record_id},${r.ip_address},${r.severity},"${(r.details||'').replace(/"/g,'""')}"`).join('\n');
    res.setHeader('Content-Type','text/csv; charset=utf-8');
    res.setHeader('Content-Disposition',`attachment; filename="audit_log_${Date.now()}.csv"`);
    res.send('\uFEFF'+hdr+csv);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
