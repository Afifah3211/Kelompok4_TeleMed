import asyncio
import logging
import psycopg
from psycopg.rows import dict_row

from app.config import settings
from app.db import get_conninfo
from app.security import hash_password

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("telemed.seed")


async def seed_data():
    conninfo = get_conninfo()
    logger.info("[Seed] Menghubungkan ke PostgreSQL untuk inisialisasi data...")

    # Retry koneksi ke DB bila belum siap
    conn = None
    for attempt in range(1, 20):
        try:
            conn = await psycopg.AsyncConnection.connect(conninfo, row_factory=dict_row)
            break
        except Exception as exc:
            logger.warning(f"[Seed] DB belum siap ({attempt}/20): {exc}. Menunggu 2 detik...")
            await asyncio.sleep(2)

    if not conn:
        raise RuntimeError("[Seed] Gagal terhubung ke database PostgreSQL")

    async with conn:
        async with conn.cursor() as cur:
            # Advisory lock 42 untuk mencegah race condition antar replika container
            logger.info("[Seed] Mengambil pg_advisory_lock(42)...")
            await cur.execute("SELECT pg_advisory_lock(42);")

            try:
                # ── 1. USERS, PATIENTS, DOCTORS ───────────────────────────
                pwd_hash = await hash_password(settings.SEED_PASSWORD)

                users_data = [
                    (1, "budi@email.com", pwd_hash, "pasien", True),
                    (2, "siti@email.com", pwd_hash, "pasien", True),
                    (3, "dr.andi@medisync.id", pwd_hash, "dokter", True),
                    (4, "dr.sarah@medisync.id", pwd_hash, "dokter", True),
                    (5, "dr.bintang@medisync.id", pwd_hash, "dokter", True),
                    (6, "admin@medisync.id", pwd_hash, "admin", True),
                ]
                await cur.executemany(
                    """
                    INSERT INTO users (id, username, password_hash, role, is_active)
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO NOTHING;
                    """,
                    users_data,
                )

                patients_data = [
                    (
                        1, 1, "3273011405890002", "Budi Santoso", "1989-05-14",
                        "L", "0812-3456-7890", "Jl. Merdeka No. 45, Bandung, Jawa Barat",
                        "O+", "Penisilin, Seafood"
                    ),
                    (
                        2, 2, "3273026811940005", "Siti Rahmawati", "1994-11-28",
                        "P", "0813-9876-5432", "Jl. Dago Asri No. 12, Bandung, Jawa Barat",
                        "A+", "Tidak Ada"
                    ),
                ]
                await cur.executemany(
                    """
                    INSERT INTO patients (
                        id, user_id, nik, full_name, birth_date, gender, phone, address, blood_type, allergies
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO NOTHING;
                    """,
                    patients_data,
                )

                doctors_data = [
                    (1, 3, "Dr. Andi Pratama, Sp.PD", "Spesialis Penyakit Dalam", "446/123/SIP/2022"),
                    (2, 4, "Dr. Sarah Wijaya, Sp.A", "Spesialis Anak (Pediatri)", "446/789/SIP/2023"),
                    (3, 5, "Dr. Bintang Kusuma, Sp.JP", "Spesialis Jantung & Pembuluh Darah", "446/456/SIP/2021"),
                ]
                await cur.executemany(
                    """
                    INSERT INTO doctors (id, user_id, full_name, specialization, str_number)
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO NOTHING;
                    """,
                    doctors_data,
                )

                logger.info("[Seed] OK [1/6] users, patients, doctors")

                # ── 2. CONSULTATIONS (6) ──────────────────────────────────
                consultations_data = [
                    (
                        1, 1, 1, "2026-10-12 09:00:00+07", "Selesai", "Video Telekonsultasi",
                        "Pusing berputar dan lemas badan.", "https://meet.medisync.id/room/c1",
                        "Selesai, EMR diterbitkan.", "2026-10-10 08:00:00+07", "2026-10-12 10:00:00+07"
                    ),
                    (
                        2, 2, 1, "2026-10-05 14:00:00+07", "Selesai", "Video Telekonsultasi",
                        "Nyeri ulu hati dan mual.", "https://meet.medisync.id/room/c2",
                        "Selesai, EMR diterbitkan.", "2026-10-03 09:00:00+07", "2026-10-05 15:00:00+07"
                    ),
                    (
                        3, 1, 1, "2026-09-20 11:00:00+07", "Selesai", "Video Telekonsultasi",
                        "Demam dan batuk kering.", "https://meet.medisync.id/room/c3",
                        "EMR di-soft delete.", "2026-09-18 08:00:00+07", "2026-09-20 12:00:00+07"
                    ),
                    (
                        4, 1, 1, "2026-10-22 10:30:00+07", "Menunggu", "Video Telekonsultasi",
                        "Tengkuk kaku, tensi 145/95.", "https://meet.medisync.id/room/c4",
                        "Riwayat alergi Penisilin.", "2026-10-20 09:00:00+07", "2026-10-20 09:00:00+07"
                    ),
                    (
                        5, 2, 1, "2026-10-22 11:15:00+07", "Menunggu", "Video Telekonsultasi",
                        "Batuk berdahak 4 hari, demam 37.8 C.", "https://meet.medisync.id/room/c5",
                        "Belum minum antibiotik.", "2026-10-20 10:00:00+07", "2026-10-20 10:00:00+07"
                    ),
                    (
                        6, 1, 2, "2026-10-24 14:00:00+07", "Menunggu", "Konsultasi Online",
                        "Konsultasi imunisasi anak.", "https://meet.medisync.id/room/c6",
                        "Jadwal mendatang.", "2026-10-19 09:30:00+07", "2026-10-19 09:30:00+07"
                    ),
                ]
                await cur.executemany(
                    """
                    INSERT INTO consultations (
                        id, patient_id, doctor_id, scheduled_at, status, type,
                        complaint, room_url, notes, created_at, updated_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO NOTHING;
                    """,
                    consultations_data,
                )
                logger.info("[Seed] OK [2/6] consultations")

                # ── 3. MEDICAL_RECORDS (3, termasuk 1 soft-deleted) ──────
                mr_data = [
                    (
                        1, 1, 1, 1,
                        "Pusing berputar dan tengkuk berat 3 hari.",
                        "Hipertensi Primer Esensial (ICD-10: I10)",
                        "Edukasi diet rendah garam, istirahat 7-8 jam, kontrol 2 minggu.",
                        "Amlodipine 5mg 1x1 pagi\nParacetamol 500mg 3x1 jika pusing",
                        "135/88 mmHg", "78 bpm", "36.6 C", "18 x/menit", "70 kg",
                        False, None, None, "2026-10-12 09:45:00+07"
                    ),
                    (
                        2, 2, 1, 2,
                        "Nyeri ulu hati panas perih, mual setelah kopi.",
                        "Dispepsia Fungsional (ICD-10: K30)",
                        "Pola makan teratur, hindari asam pedas kopi.",
                        "Omeprazole 20mg 2x1\nAntasida Doen 3x1 kunyah",
                        "115/75 mmHg", "74 bpm", "36.8 C", "16 x/menit", "54 kg",
                        False, None, None, "2026-10-05 14:15:00+07"
                    ),
                    (
                        3, 1, 1, 3,
                        "Demam hari ke-2, nyeri tenggorokan, batuk kering.",
                        "Faringitis Akut Viral (ICD-10: J02.9)",
                        "Bed rest, hidrasi 2.5L/hari, kumur garam hangat.",
                        "Paracetamol 500mg 3x1\nVitamin C 500mg 1x1",
                        "120/80 mmHg", "82 bpm", "38.2 C", "20 x/menit", "70 kg",
                        True, "2026-09-22 16:30:00+07", "Dr. Andi Pratama (Duplikasi entri)", "2026-09-20 11:10:00+07"
                    ),
                ]
                await cur.executemany(
                    """
                    INSERT INTO medical_records (
                        id, patient_id, doctor_id, consultation_id, complaint,
                        diagnosis, treatment, prescription, vital_bp, vital_heart_rate,
                        vital_temperature, vital_resp_rate, vital_weight,
                        is_deleted, deleted_at, deleted_by, created_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO NOTHING;
                    """,
                    mr_data,
                )
                logger.info("[Seed] OK [3/6] medical_records")
                # Resep adalah data klinis dokter-pasien, bukan antrean farmasi.
                rx_data = [
                    (
                        1, 1, 1, 1, 1,
                        "Diterbitkan",
                        "Pasien diinformasikan kontrol tensi 2 minggu lagi.",
                        "2026-10-12 09:50:00+07"
                    ),
                    (
                        2, 2, 2, 2, 1,
                        "Diterbitkan",
                        "Hindari makanan pedas dan kopi.",
                        "2026-10-19 10:40:00+07"
                    ),
                ]
                await cur.executemany(
                    """
                    INSERT INTO prescriptions (
                        id, medical_record_id, consultation_id, patient_id, doctor_id,
                        status, notes, created_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO NOTHING;
                    """,
                    rx_data,
                )

                rx_items_data = [
                    (1, 1, "Amlodipine 5 mg", "3 strip", "1x1 tablet pagi sesudah makan"),
                    (2, 1, "Paracetamol 500 mg", "1 strip", "3x1 tablet bila pusing"),
                    (3, 2, "Omeprazole 20 mg", "2 strip", "2x1 kapsul sebelum makan"),
                    (4, 2, "Antasida Doen", "2 strip", "3x1 tablet kunyah sebelum makan"),
                ]
                await cur.executemany(
                    """
                    INSERT INTO prescription_items (
                        id, prescription_id, medicine_name, quantity, dosage
                    ) VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO NOTHING;
                    """,
                    rx_items_data,
                )
                logger.info("[Seed] OK prescriptions & prescription_items")

                # ── 6. AUDIT_LOGS AWAL ────────────────────────────────────
                audit_data = [
                    (1, 6, "admin@medisync.id", "LOGIN", "users", 6, "192.168.1.45", "info", "Admin login berhasil.", "2026-10-19 10:25:14+07"),
                    (2, 3, "dr.andi@medisync.id", "UPDATE", "consultations", 4, "192.168.1.88", "info", "Status konsultasi diubah.", "2026-10-19 10:15:02+07"),
                    (3, 1, "budi@email.com", "CREATE", "consultations", 6, "180.252.12.90", "success", "Booking konsultasi baru.", "2026-10-19 09:30:41+07"),
                    (4, 3, "dr.andi@medisync.id", "DELETE", "medical_records", 3, "192.168.1.88", "danger", "Soft Delete rekam medis ID=3.", "2026-10-18 17:45:22+07"),
                    (5, None, "System", "BACKUP", "backup_archive", None, "127.0.0.1", "success", "Backup 3-2-1 rutin berhasil.", "2026-10-18 02:00:00+07"),
                ]
                await cur.executemany(
                    """
                    INSERT INTO audit_logs (
                        id, user_id, user_name, action, table_name, record_id,
                        ip_address, severity, details, created_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO NOTHING;
                    """,
                    audit_data,
                )
                logger.info("[Seed] OK [5/6] audit_logs awal")

                # ── 7. BACKUP_CONFIG & BACKUP_NODES ───────────────────────
                await cur.execute(
                    """
                    INSERT INTO backup_config (
                        id, policy, last_backup, next_backup, backup_schedule, encryption, retention
                    ) VALUES (1, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO UPDATE SET
                        policy = EXCLUDED.policy,
                        last_backup = CASE
                            WHEN backup_config.policy = 'Aturan 3-2-1' THEN NULL
                            ELSE backup_config.last_backup
                        END,
                        next_backup = EXCLUDED.next_backup,
                        backup_schedule = EXCLUDED.backup_schedule,
                        encryption = EXCLUDED.encryption,
                        retention = EXCLUDED.retention;
                    """,
                    (
                        "Backup PostgreSQL terjadwal (single-host)",
                        None,
                        None,
                        "Dump tiap 6 jam; base harian; sync tiap 5 menit",
                        "AES-256-CBC untuk salinan file di host yang sama",
                        "7 hari lokal; 30 hari pada folder salinan di host yang sama",
                    ),
                )
                nodes_data = [
                    (1, 1, "Data utama", "Docker volume PostgreSQL pgdata", "Host Docker saat ini", "Persisten; single-host", "-", "-"),
                    (2, 1, "Dump logis", "pg_dump -Fc tiap 6 jam", "Docker volume backups:/backups/dump", "Terjadwal", "-", "-"),
                    (3, 1, "Base backup dan WAL", "pg_basebackup harian; WAL archive", "Docker volume backups dan wal_archive", "WAL PITR belum diuji", "-", "-"),
                    (4, 1, "Salinan terenkripsi", "AES-256-CBC", "./offsite pada host yang sama", "Bukan offsite lintas host", "-", "-"),
                ]
                await cur.executemany(
                    """
                    INSERT INTO backup_nodes (
                        id, config_id, copy_label, type, location, status, size, latency
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO UPDATE SET
                        config_id = EXCLUDED.config_id,
                        copy_label = EXCLUDED.copy_label,
                        type = EXCLUDED.type,
                        location = EXCLUDED.location,
                        status = EXCLUDED.status,
                        size = EXCLUDED.size,
                        latency = EXCLUDED.latency;
                    """,
                    nodes_data,
                )
                logger.info("[Seed] OK [6/6] backup_config & backup_nodes")

                # ── SINKRONISASI SEQUENCE POSTGRESQL ──────────────────────
                sequences = [
                    ("users_id_seq", "users"),
                    ("patients_id_seq", "patients"),
                    ("doctors_id_seq", "doctors"),
                    ("consultations_id_seq", "consultations"),
                    ("medical_records_id_seq", "medical_records"),
                    ("prescriptions_id_seq", "prescriptions"),
                    ("prescription_items_id_seq", "prescription_items"),
                    ("audit_logs_id_seq", "audit_logs"),
                    ("backup_config_id_seq", "backup_config"),
                    ("backup_nodes_id_seq", "backup_nodes"),
                    ("backup_runs_id_seq", "backup_runs"),
                ]
                for seq, tbl in sequences:
                    await cur.execute(f"SELECT setval('{seq}', (SELECT COALESCE(MAX(id), 1) FROM {tbl}));")

                await conn.commit()
                logger.info("[Seed] Seluruh proses seeding idempoten berhasil dan sequences telah disinkronkan.")

            except Exception as e:
                logger.exception(f"[Seed] Error saat seeding: {e}")
                await conn.rollback()
                raise
            finally:
                logger.info("[Seed] Melepas pg_advisory_lock(42)...")
                await cur.execute("SELECT pg_advisory_unlock(42);")
                await conn.commit()


def main():
    asyncio.run(seed_data())


if __name__ == "__main__":
    main()
