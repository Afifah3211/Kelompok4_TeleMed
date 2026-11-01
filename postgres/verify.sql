-- Jalankan di pgAdmin > Query Tool (buat bukti screenshot laporan)

-- 1) Daftar tabel
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' ORDER BY table_name;

-- 2) Jumlah baris tiap tabel inti (setelah backend selesai seed)
SELECT 'users' AS tabel, COUNT(*) FROM users
UNION ALL SELECT 'patients', COUNT(*) FROM patients
UNION ALL SELECT 'doctors', COUNT(*) FROM doctors
UNION ALL SELECT 'consultations', COUNT(*) FROM consultations
UNION ALL SELECT 'medical_records', COUNT(*) FROM medical_records
UNION ALL SELECT 'audit_logs', COUNT(*) FROM audit_logs;

-- 3) Pastikan password sudah di-hash (harus diawali $2a$ atau $2b$)
SELECT username, role, LEFT(password_hash, 7) AS hash_prefix FROM users;

-- 4) WAL archiving aktif? (archived_count harus naik)
SHOW wal_level;
SHOW archive_mode;
SELECT archived_count, failed_count, last_archived_wal, last_archived_time
FROM pg_stat_archiver;
