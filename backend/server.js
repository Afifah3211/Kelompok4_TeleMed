'use strict';
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => console.log(`[${res.statusCode}] ${req.method} ${req.url} (${Date.now()-start}ms)`));
  next();
});

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'online', system: 'MediSync Backend v1.0' }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/consultations', require('./routes/consultations'));
app.use('/api/medical-records', require('./routes/medicalRecords'));
app.use('/api/audit-logs', require('./routes/auditLogs'));
app.use('/api/backup', require('./routes/backup'));
// DRP: Disaster Recovery Plan — PITR, simulasi insiden, & recovery
app.use('/api/drp', require('./routes/drp'));

// 404
app.use((req, res) => res.status(404).json({ error: `Not found: ${req.method} ${req.url}` }));

app.listen(PORT, () => {
  console.log(`\nMediSync Backend berjalan di http://localhost:${PORT}`);
  console.log('Endpoints: /api/auth, /api/users, /api/consultations, /api/medical-records, /api/audit-logs, /api/backup');
  console.log('DRP Endpoints: /api/drp/status, /api/drp/snapshot, /api/drp/snapshots, /api/drp/simulate-drop, /api/drp/recover/:id\n');
});
