// MediSync: Sistem Manajemen Telemedis - Mock Dataset Standar Klinik
export const INITIAL_USERS = [
  {
    id: 'USR-P01',
    name: 'Budi Santoso',
    email: 'budi.santoso@email.com',
    password: 'password123',
    role: 'pasien',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80',
    nik: '3273011405890002',
    birthDate: '1989-05-14',
    gender: 'Laki-laki',
    phone: '0812-3456-7890',
    address: 'Jl. Merdeka No. 45, Bandung, Jawa Barat',
    bloodType: 'O+',
    allergies: 'Penisilin, Seafood',
    status: 'Aktif'
  },
  {
    id: 'USR-P02',
    name: 'Siti Rahmawati',
    email: 'siti.rahma@email.com',
    password: 'password123',
    role: 'pasien',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80',
    nik: '3273026811940005',
    birthDate: '1994-11-28',
    gender: 'Perempuan',
    phone: '0813-9876-5432',
    address: 'Jl. Dago Asri No. 12, Bandung, Jawa Barat',
    bloodType: 'A+',
    allergies: 'Tidak Ada',
    status: 'Aktif'
  },
  {
    id: 'USR-D01',
    name: 'Dr. Andi Pratama, Sp.PD',
    email: 'dr.andi@medisync.id',
    password: 'password123',
    role: 'dokter',
    specialty: 'Spesialis Penyakit Dalam',
    sip: '446/123/SIP/2022',
    experience: '12 Tahun',
    hospital: 'RS Medika Sehat Jakarta',
    fee: 'Rp 150.000',
    avatar: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=150&q=80',
    rating: '4.9 (142 ulasan)',
    status: 'Aktif',
    isOnline: true
  },
  {
    id: 'USR-D02',
    name: 'Dr. Sarah Wijaya, Sp.A',
    email: 'dr.sarah@medisync.id',
    password: 'password123',
    role: 'dokter',
    specialty: 'Spesialis Anak (Pediatri)',
    sip: '446/789/SIP/2023',
    experience: '8 Tahun',
    hospital: 'RS Bunda Ceria Bandung',
    fee: 'Rp 135.000',
    avatar: 'https://images.unsplash.com/photo-1594824813590-78536f9a71ff?auto=format&fit=crop&w=150&q=80',
    rating: '4.95 (98 ulasan)',
    status: 'Aktif',
    isOnline: true
  },
  {
    id: 'USR-D03',
    name: 'Dr. Bintang Kusuma, Sp.JP',
    email: 'dr.bintang@medisync.id',
    password: 'password123',
    role: 'dokter',
    specialty: 'Spesialis Jantung & Pembuluh Darah',
    sip: '446/456/SIP/2021',
    experience: '15 Tahun',
    hospital: 'Pusat Jantung Nasional',
    fee: 'Rp 200.000',
    avatar: 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&w=150&q=80',
    rating: '5.0 (210 ulasan)',
    status: 'Aktif',
    isOnline: false
  },
  {
    id: 'USR-ADM01',
    name: 'Aditya Nugraha, S.Kom',
    email: 'admin.it@medisync.id',
    password: 'password123',
    role: 'admin',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
    position: 'Kepala IT & Keamanan Data Klinik',
    status: 'Aktif'
  },
  {
    id: 'USR-APT01',
    name: 'apt. Dewi Sartika, S.Farm',
    email: 'apoteker@medisync.id',
    password: 'password123',
    role: 'apoteker',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=150&q=80',
    sipa: '19950512/SIPA-3273/2022',
    hospital: 'Instalasi Farmasi TeleMed',
    position: 'Penanggung Jawab Instalasi Farmasi',
    status: 'Aktif'
  }
];

export const INITIAL_APPOINTMENTS = [
  {
    id: 'APT-101',
    patientId: 'USR-P01',
    patientName: 'Budi Santoso',
    patientNik: '3273011405890002',
    patientGender: 'Laki-laki',
    patientAge: '35 thn',
    doctorId: 'USR-D01',
    doctorName: 'Dr. Andi Pratama, Sp.PD',
    specialty: 'Spesialis Penyakit Dalam',
    date: 'Hari ini, 19 Okt 2026',
    time: '10:30 WIB',
    type: 'Video Telekonsultasi',
    complaint: 'Tengkuk terasa kaku, pusing sejak bangun tidur, tensi mandiri tercatat 145/95 mmHg.',
    status: 'Sedang Berlangsung', // Menunggu, Sedang Berlangsung, Selesai, Dibatalkan
    roomUrl: 'https://meet.medisync.id/room/apt-101-session',
    notes: 'Pasien ada riwayat alergi Penisilin.'
  },
  {
    id: 'APT-102',
    patientId: 'USR-P02',
    patientName: 'Siti Rahmawati',
    patientNik: '3273026811940005',
    patientGender: 'Perempuan',
    patientAge: '30 thn',
    doctorId: 'USR-D01',
    doctorName: 'Dr. Andi Pratama, Sp.PD',
    specialty: 'Spesialis Penyakit Dalam',
    date: 'Hari ini, 19 Okt 2026',
    time: '11:15 WIB',
    type: 'Video Telekonsultasi',
    complaint: 'Batuk berdahak 4 hari, demam sumer-sumer (37.8°C), tenggorokan perih menelan.',
    status: 'Menunggu',
    roomUrl: 'https://meet.medisync.id/room/apt-102-session',
    notes: 'Belum minum antibiotik sebelumnya.'
  },
  {
    id: 'APT-103',
    patientId: 'USR-P01',
    patientName: 'Budi Santoso',
    patientNik: '3273011405890002',
    patientGender: 'Laki-laki',
    patientAge: '35 thn',
    doctorId: 'USR-D02',
    doctorName: 'Dr. Sarah Wijaya, Sp.A',
    specialty: 'Spesialis Anak',
    date: '24 Okt 2026',
    time: '14:00 WIB',
    type: 'Konsultasi Online',
    complaint: 'Konsultasi imunisasi lanjutan anak (DPT combo booster).',
    status: 'Menunggu',
    roomUrl: 'https://meet.medisync.id/room/apt-103-session',
    notes: 'Jadwal mendatang.'
  },
  {
    id: 'APT-100',
    patientId: 'USR-P01',
    patientName: 'Budi Santoso',
    patientNik: '3273011405890002',
    patientGender: 'Laki-laki',
    patientAge: '35 thn',
    doctorId: 'USR-D01',
    doctorName: 'Dr. Andi Pratama, Sp.PD',
    specialty: 'Spesialis Penyakit Dalam',
    date: '12 Okt 2026',
    time: '09:00 WIB',
    type: 'Video Telekonsultasi',
    complaint: 'Pusing berputar dan lemas badan.',
    status: 'Selesai',
    roomUrl: 'https://meet.medisync.id/room/apt-100-session',
    notes: 'Telah diterbitkan rekam medis EMR-2026-001.'
  }
];

export const INITIAL_EMRS = [
  {
    id: 'EMR-2026-001',
    appointmentId: 'APT-100',
    patientId: 'USR-P01',
    patientName: 'Budi Santoso',
    patientNik: '3273011405890002',
    patientAge: '35 thn',
    patientGender: 'Laki-laki',
    doctorId: 'USR-D01',
    doctorName: 'Dr. Andi Pratama, Sp.PD',
    doctorSip: '446/123/SIP/2022',
    date: '2026-10-12 09:45 WIB',
    vitals: {
      bp: '135/88 mmHg',
      heartRate: '78 bpm',
      temperature: '36.6 °C',
      respiratoryRate: '18 x/menit',
      weight: '70 kg'
    },
    complaint: 'Pusing berputar dan tengkuk terasa berat saat bangun tidur selama 3 hari terakhir.',
    diagnosis: 'Hipertensi Primer Esensial (ICD-10: I10)',
    action: 'Edukasi diet rendah natrium/garam (< 5 gram per hari), istirahat cukup 7-8 jam per malam, hindari rokok & kafein berlebih, kontrol berkala tensi dalam 2 minggu.',
    prescription: 'Amlodipine 5mg (1x1 tablet pagi sesudah makan - No. XXX)\nParacetamol 500mg (3x1 tablet jika pusing/nyeri timbul - No. X)',
    isDeleted: false,
    deletedAt: null,
    deletedBy: null
  },
  {
    id: 'EMR-2026-002',
    appointmentId: 'APT-098',
    patientId: 'USR-P02',
    patientName: 'Siti Rahmawati',
    patientNik: '3273026811940005',
    patientAge: '30 thn',
    patientGender: 'Perempuan',
    doctorId: 'USR-D01',
    doctorName: 'Dr. Andi Pratama, Sp.PD',
    doctorSip: '446/123/SIP/2022',
    date: '2026-10-05 14:15 WIB',
    vitals: {
      bp: '115/75 mmHg',
      heartRate: '74 bpm',
      temperature: '36.8 °C',
      respiratoryRate: '16 x/menit',
      weight: '54 kg'
    },
    complaint: 'Nyeri ulu hati terasa panas perih, mual kembung terutama setelah minum kopi.',
    diagnosis: 'Dispepsia Fungsional / Gastritis Ringan (ICD-10: K30)',
    action: 'Edukasi pola makan teratur porsi kecil bertahap, hindari makanan asam, pedas, kopi, dan santan pekat. Manajemen stres kerja.',
    prescription: 'Omeprazole 20mg (2x1 kapsul, 30 menit sebelum makan pagi & malam - No. XIV)\nAntasida Doen tab (3x1 tablet kunyah, 1 jam sebelum makan atau saat perih - No. XII)',
    isDeleted: false,
    deletedAt: null,
    deletedBy: null
  },
  {
    id: 'EMR-2026-003',
    appointmentId: 'APT-092',
    patientId: 'USR-P01',
    patientName: 'Budi Santoso',
    patientNik: '3273011405890002',
    patientAge: '35 thn',
    patientGender: 'Laki-laki',
    doctorId: 'USR-D01',
    doctorName: 'Dr. Andi Pratama, Sp.PD',
    doctorSip: '446/123/SIP/2022',
    date: '2026-09-20 11:10 WIB',
    vitals: {
      bp: '120/80 mmHg',
      heartRate: '82 bpm',
      temperature: '38.2 °C',
      respiratoryRate: '20 x/menit',
      weight: '70 kg'
    },
    complaint: 'Demam hari ke-2 disertai nyeri tenggorokan dan batuk kering.',
    diagnosis: 'Faringitis Akut Viral (ICD-10: J02.9)',
    action: 'Istirahat total (bed rest), hidrasi cairan hangat minimal 2.5 liter per hari, kumur larutan garam hangat.',
    prescription: 'Paracetamol 500mg (3x1 tablet sesudah makan - No. XV)\nVitamin C 500mg (1x1 tablet sesudah makan - No. X)',
    isDeleted: true,
    deletedAt: '2026-09-22 16:30 WIB',
    deletedBy: 'Dr. Andi Pratama, Sp.PD (Koreksi duplikasi entri rekam medis)'
  }
];

export const INITIAL_AUDIT_LOGS = [
  {
    id: 'LOG-8841',
    timestamp: '2026-10-19 10:25:14 WIB',
    ipAddress: '192.168.1.45',
    userId: 'USR-ADM01',
    userName: 'Aditya Nugraha (Admin)',
    action: 'LOGIN',
    tableName: 'users_auth',
    dataId: 'USR-ADM01',
    severity: 'info',
    details: 'Berhasil login melalui autentikasi sesi aman browser.'
  },
  {
    id: 'LOG-8840',
    timestamp: '2026-10-19 10:15:02 WIB',
    ipAddress: '192.168.1.88',
    userId: 'USR-D01',
    userName: 'Dr. Andi Pratama (Dokter)',
    action: 'UPDATE',
    tableName: 'jadwal_konsultasi',
    dataId: 'APT-101',
    severity: 'info',
    details: 'Mengubah status konsultasi menjadi "Sedang Berlangsung".'
  },
  {
    id: 'LOG-8839',
    timestamp: '2026-10-19 09:30:41 WIB',
    ipAddress: '180.252.12.90',
    userId: 'USR-P01',
    userName: 'Budi Santoso (Pasien)',
    action: 'CREATE',
    tableName: 'jadwal_konsultasi',
    dataId: 'APT-103',
    severity: 'success',
    details: 'Membuat janji telekonsultasi baru dengan Dr. Sarah Wijaya, Sp.A.'
  },
  {
    id: 'LOG-8838',
    timestamp: '2026-10-18 17:45:22 WIB',
    ipAddress: '192.168.1.88',
    userId: 'USR-D01',
    userName: 'Dr. Andi Pratama (Dokter)',
    action: 'DELETE', // Will show red accent as per PRD
    tableName: 'rekam_medis',
    dataId: 'EMR-2026-003',
    severity: 'danger',
    details: 'Soft Delete dilakukan pada rekam medis EMR-2026-003. Data ditandai is_deleted=true (data fisik tetap utuh).'
  },
  {
    id: 'LOG-8837',
    timestamp: '2026-10-18 02:00:00 WIB',
    ipAddress: '127.0.0.1 (System Cron)',
    userId: 'SYS-BACKUP-DAEMON',
    userName: 'Automated Backup Daemon',
    action: 'BACKUP',
    tableName: 'backup_archive',
    dataId: 'BAK-20261018-0200',
    severity: 'success',
    details: 'Pencadangan rutin Aturan 3-2-1 berhasil: Salinan 1 (SSD), Salinan 2 (NAS), Salinan 3 (S3 Terenkripsi).'
  }
];

export const BACKUP_CONFIG = {
  policy: 'Aturan 3-2-1 (3 Salinan, 2 Media Berbeda, 1 Offsite Terpisah)',
  lastBackup: '2026-10-19 02:00:00 WIB',
  nextBackup: '2026-10-20 02:00:00 WIB',
  backupSchedule: 'Harian otomatis (Pukul 02:00 WIB)',
  encryption: 'AES-256 GCM (Enkripsi End-to-End)',
  retention: '30 Hari Snapshot Harian, 12 Bulan Arsip Bulanan',
  storageNodes: [
    {
      copy: 'Salinan 1 (Production Master)',
      type: 'SSD NVMe Server Utama',
      location: 'Data Center Jakarta',
      status: 'Optimal (Aktif)',
      size: '24.8 MB',
      latency: '< 1 ms'
    },
    {
      copy: 'Salinan 2 (Local Secondary Media)',
      type: 'Dedicated NAS RAID-10',
      location: 'Server Room Klinik',
      status: 'Sinkron (Tersimpan)',
      size: '24.8 MB',
      latency: '2 ms'
    },
    {
      copy: 'Salinan 3 (Offsite Cloud Disaster Recovery)',
      type: 'Encrypted S3 Glacier Bucket',
      location: 'Cloud Region Singapura (Offsite)',
      status: 'Terverifikasi (Aman)',
      size: '24.8 MB',
      latency: '28 ms'
    }
  ]
};

export const INITIAL_MEDICINES = [
  {
    id: 'MED-001',
    name: 'Paracetamol 500 mg',
    category: 'Analgesik & Antipiretik',
    form: 'Tablet',
    stock: 240,
    unit: 'Strip (10 tab)',
    price: 5000,
    dosage: '3x1 tablet sesudah makan bila demam/nyeri',
    description: 'Pereda nyeri ringan-sedang dan penurun demam.'
  },
  {
    id: 'MED-002',
    name: 'Amlodipine 5 mg',
    category: 'Antihipertensi',
    form: 'Tablet',
    stock: 180,
    unit: 'Strip (10 tab)',
    price: 15000,
    dosage: '1x1 tablet pagi hari sesudah makan',
    description: 'Penurun tekanan darah tinggi (hipertensi).'
  },
  {
    id: 'MED-003',
    name: 'Omeprazole 20 mg',
    category: 'Saluran Cerna (PPI)',
    form: 'Kapsul',
    stock: 150,
    unit: 'Strip (10 kapsul)',
    price: 18000,
    dosage: '2x1 kapsul, 30 menit sebelum makan',
    description: 'Mengatasi tukak lambung, GERD, dan dispepsia.'
  },
  {
    id: 'MED-004',
    name: 'Antasida Doen',
    category: 'Saluran Cerna',
    form: 'Tablet Kunyah',
    stock: 300,
    unit: 'Strip (10 tab)',
    price: 6000,
    dosage: '3x1 tablet kunyah, 1 jam sebelum makan',
    description: 'Menetralkan asam lambung berlebih.'
  },
  {
    id: 'MED-005',
    name: 'Amoxicillin 500 mg',
    category: 'Antibiotik',
    form: 'Kaplet',
    stock: 110,
    unit: 'Strip (10 tab)',
    price: 12000,
    dosage: '3x1 tablet tiap 8 jam harus dihabiskan',
    description: 'Antibiotik infeksi bakteri saluran pernapasan.'
  },
  {
    id: 'MED-006',
    name: 'Cetirizine 10 mg',
    category: 'Antihistamin / Alergi',
    form: 'Tablet',
    stock: 95,
    unit: 'Strip (10 tab)',
    price: 10000,
    dosage: '1x1 tablet malam hari',
    description: 'Meredakan gejala bersin, gatal, dan rhinitis alergi.'
  },
  {
    id: 'MED-007',
    name: 'Vitamin C 500 mg + Zinc',
    category: 'Suplemen & Imun',
    form: 'Tablet',
    stock: 400,
    unit: 'Botol (30 tab)',
    price: 35000,
    dosage: '1x1 tablet sehari sesudah makan',
    description: 'Meningkatkan daya tahan tubuh masa penyembuhan.'
  }
];

export const INITIAL_PRESCRIPTIONS = [
  {
    id: 'RX-2026-001',
    emrId: 'EMR-2026-001',
    appointmentId: 'APT-100',
    patientId: 'USR-P01',
    patientName: 'Budi Santoso',
    doctorName: 'Dr. Andi Pratama, Sp.PD',
    date: '2026-10-12 09:50 WIB',
    status: 'Selesai / Sudah Diambil', // Menunggu Penyiapan, Sedang Diramu, Selesai / Sudah Diambil
    items: [
      { medicineName: 'Amlodipine 5 mg', quantity: '3 strip', dosage: '1x1 tablet pagi sesudah makan' },
      { medicineName: 'Paracetamol 500 mg', quantity: '1 strip', dosage: '3x1 tablet bila pusing' }
    ],
    notes: 'Pasien diinformasikan kontrol tensi 2 minggu lagi.',
    pharmacistNotes: 'Telah diserahkan kepada pasien oleh apt. Dewi Sartika, S.Farm.'
  },
  {
    id: 'RX-2026-002',
    emrId: 'EMR-2026-002',
    appointmentId: 'APT-098',
    patientId: 'USR-P02',
    patientName: 'Siti Rahmawati',
    doctorName: 'Dr. Andi Pratama, Sp.PD',
    date: '2026-10-19 10:40 WIB',
    status: 'Sedang Diramu',
    items: [
      { medicineName: 'Omeprazole 20 mg', quantity: '2 strip', dosage: '2x1 kapsul sebelum makan' },
      { medicineName: 'Antasida Doen', quantity: '2 strip', dosage: '3x1 tablet kunyah sebelum makan' }
    ],
    notes: 'Hindari makanan pedas dan kopi.',
    pharmacistNotes: 'Sedang disiapkan etiket pemakaian oleh apoteker.'
  }
];

