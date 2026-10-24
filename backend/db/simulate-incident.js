'use strict';
/**
 * MediSync DRP - Simulasi Insiden "Human Error: DROP TABLE"
 * ============================================================
 * Script ini mensimulasikan insiden kehilangan data akibat
 * kesalahan manusia (human error): penghapusan tabel rekam medis.
 *
 * PERHATIAN: Script ini HANYA untuk keperluan demonstrasi DRP.
 *            JANGAN dijalankan di environment production nyata!
 *
 * Penggunaan (dari docker exec atau node langsung):
 *   docker exec medisync_backend node /app/db/simulate-incident.js
 *
 * Skenario DRP yang disimulasikan:
 *   Seorang admin/DBA secara tidak sengaja menjalankan perintah
 *   DROP TABLE medical_records saat melakukan maintenance.
 *   Seluruh rekam medis pasien (EMR) hilang seketika.
 * ============================================================
 */
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'medisync.db');

console.log('');
console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║   MEDISYNC DRP - SIMULASI INSIDEN HUMAN ERROR           ║');
console.log('║   Skenario: DROP TABLE medical_records                  ║');
console.log('╚══════════════════════════════════════════════════════════╝');
console.log('');
console.log('⚠️  PERINGATAN: Ini adalah simulasi demonstrasi DRP!');
console.log('');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = OFF'); // Nonaktifkan FK sementara untuk simulasi DROP

// ── Catat kondisi sebelum insiden ───────────────────────────
const beforeCount = db.prepare("SELECT COUNT(*) as cnt FROM medical_records").get().cnt;
const beforeRecords = db.prepare("SELECT id, patient_id, diagnosis, created_at FROM medical_records").all();

console.log(`📊 KONDISI SEBELUM INSIDEN:`);
console.log(`   Total rekam medis: ${beforeCount}`);
beforeRecords.forEach(r => {
  console.log(`   [EMR #${r.id}] Patient: ${r.patient_id} | Diagnosis: ${r.diagnosis?.substring(0,40)}...`);
});
console.log('');

// ── Simulasikan human error: DROP TABLE ─────────────────────
console.log('💥 [INSIDEN] Menjalankan: DROP TABLE medical_records...');
console.log('   (Simulasi kesalahan admin saat maintenance)');

try {
  db.exec('DROP TABLE IF EXISTS medical_records');
  console.log('');
  console.log('❌ INSIDEN TERJADI: Tabel medical_records BERHASIL DIHAPUS!');
  console.log('   Seluruh rekam medis pasien hilang dari database.');
} catch (err) {
  console.error('Error simulasi:', err.message);
}

// ── Catat kondisi pasca insiden ─────────────────────────────
const tableExists = db.prepare(
  "SELECT COUNT(*) as cnt FROM sqlite_master WHERE type='table' AND name='medical_records'"
).get().cnt;

console.log('');
console.log(`📊 KONDISI SETELAH INSIDEN:`);
console.log(`   Tabel medical_records ada? ${tableExists === 1 ? 'YA' : 'TIDAK — TERHAPUS!'}`);

if (tableExists === 0) {
  // Catat insiden di audit log
  try {
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    db.prepare(`
      INSERT INTO audit_logs (user_id, action, table_name, ip_address, created_at, user_name, severity, details)
      VALUES (NULL, 'DROP_TABLE', 'medical_records', '127.0.0.1', ?, 'SYSTEM_SIMULATION', 'danger', ?)
    `).run(now, `[DRP SIMULASI] DROP TABLE medical_records dieksekusi. ${beforeCount} rekam medis hilang. Diperlukan PITR recovery segera.`);
    console.log('   Insiden tercatat di audit_logs.');
  } catch (e) {
    console.log('   (Audit log tidak bisa dicatat karena error)');
  }
}

db.close();

console.log('');
console.log('══════════════════════════════════════════════════════════');
console.log('  INSIDEN TERDETEKSI — AKTIVASI DRP RECOVERY PROTOCOL');
console.log('══════════════════════════════════════════════════════════');
console.log('');
console.log('  Data yang hilang:');
console.log(`    ✗ ${beforeCount} rekam medis pasien TERHAPUS PERMANEN`);
console.log('');
console.log('  Langkah Recovery (Point-in-Time Recovery):');
console.log('  1. Jalankan recovery dari PITR snapshot:');
console.log('     docker exec medisync_drp_backup sh /scripts/pitr-recover.sh [SNAPSHOT_ID]');
console.log('');
console.log('  2. Restart backend:');
console.log('     docker restart medisync_backend');
console.log('');
console.log('  3. Verifikasi:');
console.log('     curl http://localhost/api/medical-records');
console.log('');
