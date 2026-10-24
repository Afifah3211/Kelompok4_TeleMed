'use strict';
/**
 * MediSync - Database Connection Module
 * Singleton better-sqlite3 instance
 */
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// DB_PATH bisa di-override via environment variable (Docker Volume)
// - Lokal  : backend/db/medisync.db (default)
// - Docker : /app/db/data/medisync.db (dari volume medisync_db_data)
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'medisync.db');
const SCHEMA_PATH = process.env.SCHEMA_PATH || path.join(__dirname, 'schema.sql');

let _db = null;

function getDb() {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');

    // Auto-run schema if DB is fresh
    const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
    _db.exec(schema);
  }
  return _db;
}

module.exports = { getDb };
