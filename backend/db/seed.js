'use strict';
/**
 * MediSync - Seed Database (ERD-compliant)
 * Tabel: users, patients, doctors, consultations, medical_records, audit_logs
 */
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'medisync.db');
const SCHEMA_PATH = process.env.SCHEMA_PATH || path.join(__dirname, 'schema.sql');


function seed() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
  db.exec(schema);

  // 1. USERS
  db.prepare(`INSERT OR IGNORE INTO users (id, username, password_hash, role, is_active, created_at) VALUES (?,?,?,?,?,?)`).run(1,'budi@email.com','medisync2026','pasien',1,'2026-01-10 08:00:00');
  db.prepare(`INSERT OR IGNORE INTO users (id, username, password_hash, role, is_active, created_at) VALUES (?,?,?,?,?,?)`).run(2,'siti@email.com','medisync2026','pasien',1,'2026-02-15 09:00:00');
  db.prepare(`INSERT OR IGNORE INTO users (id, username, password_hash, role, is_active, created_at) VALUES (?,?,?,?,?,?)`).run(3,'dr.andi@medisync.id','medisync2026','dokter',1,'2022-06-01 07:00:00');
  db.prepare(`INSERT OR IGNORE INTO users (id, username, password_hash, role, is_active, created_at) VALUES (?,?,?,?,?,?)`).run(4,'dr.sarah@medisync.id','medisync2026','dokter',1,'2023-03-20 07:00:00');
  db.prepare(`INSERT OR IGNORE INTO users (id, username, password_hash, role, is_active, created_at) VALUES (?,?,?,?,?,?)`).run(5,'dr.bintang@medisync.id','medisync2026','dokter',1,'2021-08-05 07:00:00');
  db.prepare(`INSERT OR IGNORE INTO users (id, username, password_hash, role, is_active, created_at) VALUES (?,?,?,?,?,?)`).run(6,'admin@medisync.id','medisync2026','admin',1,'2020-01-01 00:00:00');
  console.log('OK [1/7] users');

  // 2. PATIENTS
  db.prepare(`INSERT OR IGNORE INTO patients (id, user_id, nik, full_name, birth_date, gender, phone, address) VALUES (?,?,?,?,?,?,?,?)`)
    .run(1,1,'3273011405890002','Budi Santoso','1989-05-14','L','0812-3456-7890','Jl. Merdeka No. 45, Bandung');
  db.prepare(`INSERT OR IGNORE INTO patients (id, user_id, nik, full_name, birth_date, gender, phone, address) VALUES (?,?,?,?,?,?,?,?)`)
    .run(2,2,'3273026811940005','Siti Rahmawati','1994-11-28','P','0813-9876-5432','Jl. Dago Asri No. 12, Bandung');
  console.log('OK [2/7] patients');

  // 3. DOCTORS
  db.prepare(`INSERT OR IGNORE INTO doctors (id, user_id, full_name, specialization, str_number) VALUES (?,?,?,?,?)`)
    .run(1,3,'Dr. Andi Pratama, Sp.PD','Spesialis Penyakit Dalam','446/123/SIP/2022');
  db.prepare(`INSERT OR IGNORE INTO doctors (id, user_id, full_name, specialization, str_number) VALUES (?,?,?,?,?)`)
    .run(2,4,'Dr. Sarah Wijaya, Sp.A','Spesialis Anak (Pediatri)','446/789/SIP/2023');
  db.prepare(`INSERT OR IGNORE INTO doctors (id, user_id, full_name, specialization, str_number) VALUES (?,?,?,?,?)`)
    .run(3,5,'Dr. Bintang Kusuma, Sp.JP','Spesialis Jantung & Pembuluh Darah','446/456/SIP/2021');
  console.log('OK [3/7] doctors');

  // 4. CONSULTATIONS
  const ic = db.prepare(`INSERT OR IGNORE INTO consultations (id, patient_id, doctor_id, scheduled_at, status, type, complaint, room_url, notes, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  ic.run(1,1,1,'2026-10-12 09:00:00','Selesai','Video Telekonsultasi','Pusing berputar dan lemas badan.','https://meet.medisync.id/room/c1','Selesai, EMR diterbitkan.','2026-10-10 08:00:00','2026-10-12 10:00:00');
  ic.run(2,2,1,'2026-10-05 14:00:00','Selesai','Video Telekonsultasi','Nyeri ulu hati dan mual.','https://meet.medisync.id/room/c2','Selesai, EMR diterbitkan.','2026-10-03 09:00:00','2026-10-05 15:00:00');
  ic.run(3,1,1,'2026-09-20 11:00:00','Selesai','Video Telekonsultasi','Demam dan batuk kering.','https://meet.medisync.id/room/c3','EMR di-soft delete.','2026-09-18 08:00:00','2026-09-20 12:00:00');
  ic.run(4,1,1,'2026-10-22 10:30:00','Menunggu','Video Telekonsultasi','Tengkuk kaku, tensi 145/95.','https://meet.medisync.id/room/c4','Riwayat alergi Penisilin.','2026-10-20 09:00:00','2026-10-20 09:00:00');
  ic.run(5,2,1,'2026-10-22 11:15:00','Menunggu','Video Telekonsultasi','Batuk berdahak 4 hari, demam 37.8 C.','https://meet.medisync.id/room/c5','Belum minum antibiotik.','2026-10-20 10:00:00','2026-10-20 10:00:00');
  ic.run(6,1,2,'2026-10-24 14:00:00','Menunggu','Konsultasi Online','Konsultasi imunisasi anak.','https://meet.medisync.id/room/c6','Jadwal mendatang.','2026-10-19 09:30:00','2026-10-19 09:30:00');
  console.log('OK [4/7] consultations');

  // 5. MEDICAL_RECORDS
  const im = db.prepare(`INSERT OR IGNORE INTO medical_records (id, patient_id, doctor_id, consultation_id, complaint, diagnosis, treatment, prescription, vital_bp, vital_heart_rate, vital_temperature, vital_resp_rate, vital_weight, is_deleted, deleted_at, deleted_by, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  im.run(1,1,1,1,'Pusing berputar dan tengkuk berat 3 hari.','Hipertensi Primer Esensial (ICD-10: I10)','Edukasi diet rendah garam, istirahat 7-8 jam, kontrol 2 minggu.','Amlodipine 5mg 1x1 pagi\nParacetamol 500mg 3x1 jika pusing','135/88 mmHg','78 bpm','36.6 C','18 x/menit','70 kg',0,null,null,'2026-10-12 09:45:00');
  im.run(2,2,1,2,'Nyeri ulu hati panas perih, mual setelah kopi.','Dispepsia Fungsional (ICD-10: K30)','Pola makan teratur, hindari asam pedas kopi.','Omeprazole 20mg 2x1\nAntasida Doen 3x1 kunyah','115/75 mmHg','74 bpm','36.8 C','16 x/menit','54 kg',0,null,null,'2026-10-05 14:15:00');
  im.run(3,1,1,3,'Demam hari ke-2, nyeri tenggorokan, batuk kering.','Faringitis Akut Viral (ICD-10: J02.9)','Bed rest, hidrasi 2.5L/hari, kumur garam hangat.','Paracetamol 500mg 3x1\nVitamin C 500mg 1x1','120/80 mmHg','82 bpm','38.2 C','20 x/menit','70 kg',1,'2026-09-22 16:30:00','Dr. Andi Pratama (Duplikasi entri)','2026-09-20 11:10:00');
  console.log('OK [5/7] medical_records');

  // 6. AUDIT_LOGS
  const il = db.prepare(`INSERT OR IGNORE INTO audit_logs (id, user_id, action, table_name, record_id, ip_address, created_at, user_name, severity, details) VALUES (?,?,?,?,?,?,?,?,?,?)`);
  il.run(1,6,'LOGIN','users',6,'192.168.1.45','2026-10-19 10:25:14','admin@medisync.id','info','Admin login berhasil.');
  il.run(2,3,'UPDATE','consultations',4,'192.168.1.88','2026-10-19 10:15:02','dr.andi@medisync.id','info','Status konsultasi diubah.');
  il.run(3,1,'CREATE','consultations',6,'180.252.12.90','2026-10-19 09:30:41','budi@email.com','success','Booking konsultasi baru.');
  il.run(4,3,'DELETE','medical_records',3,'192.168.1.88','2026-10-18 17:45:22','dr.andi@medisync.id','danger','Soft Delete rekam medis ID=3.');
  il.run(5,null,'BACKUP','backup_archive',null,'127.0.0.1','2026-10-18 02:00:00','System','success','Backup 3-2-1 rutin berhasil.');
  console.log('OK [6/7] audit_logs');

  // 7. BACKUP CONFIG
  if (!db.prepare('SELECT id FROM backup_config LIMIT 1').get()) {
    const { lastInsertRowid } = db.prepare(`INSERT INTO backup_config (policy, last_backup, next_backup, backup_schedule, encryption, retention) VALUES (?,?,?,?,?,?)`)
      .run('Aturan 3-2-1','2026-10-19 02:00:00','2026-10-20 02:00:00','Harian 02:00 WIB','AES-256 GCM','30 Hari Snapshot');
    const bn = db.prepare(`INSERT INTO backup_nodes (config_id, copy_label, type, location, status, size, latency) VALUES (?,?,?,?,?,?,?)`);
    bn.run(lastInsertRowid,'Salinan 1 (Production)','SSD NVMe','Data Center Jakarta','Optimal','24.8 MB','< 1 ms');
    bn.run(lastInsertRowid,'Salinan 2 (NAS Lokal)','NAS RAID-10','Server Room Klinik','Sinkron','24.8 MB','2 ms');
    bn.run(lastInsertRowid,'Salinan 3 (Offsite Cloud)','S3 Glacier','Cloud Singapura','Terverifikasi','24.8 MB','28 ms');
    console.log('OK [7/7] backup_config');
  }

  db.close();
  console.log('\nSeeding selesai! DB siap.');
}
seed();
