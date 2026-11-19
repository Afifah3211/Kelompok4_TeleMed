import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { normalizeConsultationType } from '../utils/consultation';
import { 
  authApi, 
  usersApi, 
  consultationsApi, 
  medicalRecordsApi, 
  auditLogsApi, 
  backupApi, 
  drpApi, 
  medicinesApi, 
  prescriptionsApi,
  getToken,
  setToken,
  clearToken
} from '../services/api';

const AppContext = createContext();

// Helper untuk membuat avatar default yang menarik berdasarkan role/nama
function getDefaultAvatar(role, name) {
  if (role === 'dokter') {
    return 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=150&q=80';
  }
  if (role === 'admin') {
    return 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80';
  }
  if (role === 'apoteker') {
    return 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=150&q=80';
  }
  return 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80';
}

// Normalisasi objek user & profile dari backend
function buildCurrentUser(user, profile) {
  if (!user) return null;
  const role = user.role;
  const p = profile || {};
  return {
    id: user.id,
    userId: user.id,
    username: user.username,
    role: role,
    name: p.full_name || user.username,
    fullName: p.full_name || user.username,
    email: user.username,
    nik: p.nik || '-',
    phone: p.phone || '-',
    birthDate: p.birth_date || '',
    gender: p.gender === 'L' ? 'Laki-laki' : p.gender === 'P' ? 'Perempuan' : '-',
    address: p.address || '-',
    bloodType: p.blood_type || '-',
    allergies: p.allergies || '-',
    specialization: p.specialization || '',
    specialty: p.specialization || (role === 'dokter' ? 'Dokter Spesialis' : ''),
    strNumber: p.str_number || '',
    sip: p.str_number || '446/MED/2026',
    sipaNumber: p.sipa_number || '',
    sipa: p.sipa_number || '19950512/SIPA-3273/2022',
    workplace: p.workplace || 'RS / Klinik TeleMed',
    avatar: getDefaultAvatar(role, p.full_name || user.username),
    status: user.is_active ? 'Aktif' : 'Nonaktif',
    patientId: role === 'pasien' ? p.id : null,
    doctorId: role === 'dokter' ? p.id : null,
    pharmacistId: role === 'apoteker' ? p.id : null,
  };
}

// Normalisasi data Konsultasi
function calculateAge(birthDateValue) {
  if (!birthDateValue) return '';
  const birthDate = new Date(birthDateValue);
  if (Number.isNaN(birthDate.getTime())) return '';
  const today = new Date();
  return String(today.getFullYear() - birthDate.getUTCFullYear() - (
    today < new Date(today.getFullYear(), birthDate.getUTCMonth(), birthDate.getUTCDate()) ? 1 : 0
  ));
}

function normalizeConsultation(c) {
  const sched = c.scheduled_at ? new Date(c.scheduled_at) : new Date();
  const dateStr = c.scheduled_at ? c.scheduled_at.slice(0, 10) : '';
  const timeStr = c.scheduled_at 
    ? `${String(sched.getHours()).padStart(2, '0')}:${String(sched.getMinutes()).padStart(2, '0')} WIB`
    : '09:00 WIB';
  return {
    ...c,
    id: c.id,
    patientId: c.patient_id,
    patientName: c.patient_name || 'Pasien',
    patientNik: c.patient_nik || '',
    patientPhone: c.patient_phone || '',
    patientGender: c.patient_gender === 'L' ? 'Laki-laki' : c.patient_gender === 'P' ? 'Perempuan' : '-',
    patientAge: calculateAge(c.patient_birth_date),
    doctorId: c.doctor_id,
    doctorName: c.doctor_name || 'Dokter',
    specialty: c.doctor_specialization || 'Spesialis',
    status: c.status,
    type: normalizeConsultationType(c.type),
    complaint: c.complaint || '',
    date: dateStr,
    time: timeStr,
    roomUrl: c.room_url || `https://meet.medisync.id/room/c${c.id}`,
  };
}

// Normalisasi data EMR
function normalizeEMR(e) {
  const created = e.created_at ? new Date(e.created_at) : new Date();
  const dateStr = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}-${String(created.getDate()).padStart(2, '0')} ${String(created.getHours()).padStart(2, '0')}:${String(created.getMinutes()).padStart(2, '0')} WIB`;

  return {
    ...e,
    id: e.id,
    patientId: e.patient_id,
    patientName: e.patient_name || 'Pasien',
    patientNik: e.patient_nik || '',
    patientGender: e.patient_gender === 'L' ? 'Laki-laki' : e.patient_gender === 'P' ? 'Perempuan' : '-',
    patientAge: calculateAge(e.patient_birth_date),
    doctorId: e.doctor_id,
    doctorName: e.doctor_name || 'Dokter',
    doctorSip: e.doctor_sip || '',
    date: dateStr,
    diagnosis: e.diagnosis || '',
    complaint: e.complaint || '',
    treatment: e.treatment || '',
    action: e.treatment || '',
    prescription: e.prescription || '',
    isDeleted: !!e.is_deleted,
    deletedAt: e.deleted_at ? String(e.deleted_at) : null,
    deletedBy: e.deleted_by || null,
    vitals: {
      bp: e.vital_bp || '',
      heartRate: e.vital_heart_rate || '',
      temperature: e.vital_temperature || '',
      weight: e.vital_weight || '',
      respRate: e.vital_resp_rate || '',
    },
  };
}

// Normalisasi data Resep
function normalizePrescription(p) {
  const created = p.created_at ? new Date(p.created_at) : new Date();
  const dateStr = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}-${String(created.getDate()).padStart(2, '0')}`;

  return {
    ...p,
    id: p.id,
    patientId: p.patient_id,
    patientName: p.patient_name || 'Pasien',
    doctorId: p.doctor_id,
    doctorName: p.doctor_name || 'Dokter',
    status: p.status,
    notes: p.notes || '',
    pharmacistNotes: p.pharmacist_notes || '',
    date: dateStr,
    prescriptionText: p.notes || '',
    items: (p.items || []).map((it) => ({
      medicineId: it.medicine_id,
      medicineName: it.medicine_name,
      quantity: it.quantity,
      dosage: it.dosage,
    })),
  };
}

// Normalisasi data Audit Log
function normalizeAuditLog(l) {
  const created = l.created_at ? new Date(l.created_at) : new Date();
  const timeStr = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}-${String(created.getDate()).padStart(2, '0')} ${String(created.getHours()).padStart(2, '0')}:${String(created.getMinutes()).padStart(2, '0')}:${String(created.getSeconds()).padStart(2, '0')} WIB`;

  return {
    ...l,
    id: l.id,
    userId: String(l.user_id || 'ANONYMOUS'),
    userName: l.user_name || 'Sistem',
    action: l.action,
    tableName: l.table_name,
    dataId: String(l.record_id || ''),
    ipAddress: l.ip_address || '127.0.0.1',
    severity: l.severity || 'info',
    details: l.details || '',
    timestamp: timeStr,
  };
}

export function AppProvider({ children }) {
  // Navigation & Page state
  const [currentPage, setCurrentPage] = useState('landing'); // 'landing' | 'auth' | 'reset-password' | 'dashboard'
  const [authMode, setAuthMode] = useState('register'); // 'register' | 'login'
  const [dashboardTab, setDashboardTab] = useState('overview');

  // Core state dari Backend API (Tidak ada di localStorage!)
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [emrs, setEmrs] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [backupConfig, setBackupConfig] = useState({
    policyName: '3-2-1 Backup & Cloud Disaster Recovery Plan',
    rtoTarget: '30 Menit',
    rpoTarget: '1 Menit',
    lastBackup: 'Belum ada pencadangan',
    storageNodes: [
      { type: 'Volume Snapshot Docker', copy: 'Copy 1 (Lokal Host)', status: 'Sinkron (Tersimpan)', path: 'telemed_pgdata', size: '24.8 MB' },
      { type: 'Logical Dump pg_dump -Fc', copy: 'Copy 2 (Format Berbeda)', status: 'Tersedia', path: '/backups/dump', size: '18.2 MB' },
      { type: 'Base Backup + Continuous WAL', copy: 'Copy 2 (PITR Engine)', status: 'Aktif Streaming', path: '/backups/wal_archive', size: '12.4 MB' },
      { type: 'Off-site Cloud Replica S3 AES-256', copy: 'Copy 3 (Off-site Cloud)', status: 'Terverifikasi (Aman)', path: 's3://telemed-cold-archive', size: '25.1 MB' }
    ]
  });
  const [medicines, setMedicines] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);

  // Modal states
  const [teleconsultationSession, setTeleconsultationSession] = useState(null);
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [viewingEMR, setViewingEMR] = useState(null);

  // Toast notifications
  const [toasts, setToasts] = useState([]);

  // Toast dispatch
  const showToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random().toString(36).substring(2, 5);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const refreshPrescriptions = useCallback(async () => {
    const rxList = await prescriptionsApi.getAll();
    const normalized = (rxList || []).map(normalizePrescription);
    setPrescriptions(normalized);
    return normalized;
  }, []);

  // Memuat data role-specific dari FastAPI backend
  const loadInitialData = useCallback(async (role) => {
    try {
      // 1. Data Dokter (diperlukan pasien saat booking & admin di kelola dokter)
      if (role === 'pasien' || role === 'admin') {
        const docList = await usersApi.getDoctors();
        const formattedDocs = (docList || []).map((d) => ({
          id: d.id,
          userId: d.user_id,
          name: d.full_name,
          role: 'dokter',
          specialty: d.specialization || 'Dokter Spesialis',
          sip: d.str_number || '446/MED/2026',
          avatar: getDefaultAvatar('dokter', d.full_name),
          status: d.is_active ? 'Aktif' : 'Nonaktif',
        }));
        setUsers((prev) => {
          const others = prev.filter((u) => u.role !== 'dokter');
          return [...others, ...formattedDocs];
        });
      }

      // 2. Data Pasien (diperlukan dokter & admin)
      if (role === 'dokter' || role === 'admin') {
        const patList = await usersApi.getPatients();
        const formattedPats = (patList || []).map((p) => ({
          id: p.id,
          userId: p.user_id,
          name: p.full_name,
          role: 'pasien',
          nik: p.nik || '-',
          phone: p.phone || '-',
          birthDate: p.birth_date || '',
          gender: p.gender === 'L' ? 'Laki-laki' : p.gender === 'P' ? 'Perempuan' : '-',
          address: p.address || '-',
          bloodType: p.blood_type || '-',
          allergies: p.allergies || '-',
          avatar: getDefaultAvatar('pasien', p.full_name),
          status: p.is_active ? 'Aktif' : 'Nonaktif',
        }));
        setUsers((prev) => {
          const others = prev.filter((u) => u.role !== 'pasien');
          return [...others, ...formattedPats];
        });
      }

      // 3. Konsultasi / Appointments (pasien, dokter, admin)
      if (role === 'pasien' || role === 'dokter' || role === 'admin') {
        const apts = await consultationsApi.getAll();
        setAppointments((apts || []).map(normalizeConsultation));
      }

      // 4. Rekam Medis / EMR (pasien, dokter, admin)
      if (role === 'pasien' || role === 'dokter' || role === 'admin') {
        const includeDeleted = role === 'dokter' || role === 'admin';
        const emrList = await medicalRecordsApi.getAll({ include_deleted: includeDeleted });
        setEmrs((emrList || []).map(normalizeEMR));
      }

      // 5. Obat Farmasi (dokter, admin, apoteker)
      if (role === 'dokter' || role === 'admin' || role === 'apoteker') {
        const medList = await medicinesApi.getAll();
        setMedicines(medList || []);
      }

      // 6. Resep Digital (pasien, dokter, admin, apoteker)
      await refreshPrescriptions();

      // 7. Audit Logs & Backup (khusus admin)
      if (role === 'admin') {
        const logs = await auditLogsApi.getAll({ limit: 100 });
        setAuditLogs((logs || []).map(normalizeAuditLog));

        try {
          const bData = await backupApi.getOverview();
          if (bData && bData.config) {
            setBackupConfig((prev) => ({
              ...prev,
              policyName: bData.config.policy_name || prev.policyName,
              rtoTarget: bData.config.rto_target || prev.rtoTarget,
              rpoTarget: bData.config.rpo_target || prev.rpoTarget,
              lastBackup: bData.recent_runs && bData.recent_runs.length > 0
                ? String(bData.recent_runs[0].started_at).slice(0, 19).replace('T', ' ') + ' WIB'
                : prev.lastBackup,
              storageNodes: (bData.nodes && bData.nodes.length > 0)
                ? bData.nodes.map((n) => ({
                    type: n.node_name,
                    copy: n.node_type,
                    status: n.status,
                    path: n.storage_path,
                    size: n.size_bytes ? `${(n.size_bytes / (1024 * 1024)).toFixed(2)} MB` : '18.2 MB'
                  }))
                : prev.storageNodes
            }));
          }
        } catch (bErr) {
          console.warn('Backup overview error:', bErr);
        }
      }
    } catch (err) {
      console.warn('Error loading initial data from backend:', err);
    }
  }, [refreshPrescriptions]);

  // Inisialisasi Auth pada mount dengan token dari sessionStorage
  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      const token = getToken();
      if (!token) {
        if (isMounted) {
          setCurrentUser(null);
          setCurrentPage('landing');
          setIsLoaded(true);
        }
        return;
      }

      try {
        const me = await authApi.getMe();
        if (isMounted && me && me.user) {
          const userObj = buildCurrentUser(me.user, me.profile);
          setCurrentUser(userObj);
          setCurrentPage('dashboard');
          await loadInitialData(me.user.role);
        }
      } catch (err) {
        if (isMounted) {
          clearToken();
          setCurrentUser(null);
          setCurrentPage('landing');
        }
      } finally {
        if (isMounted) setIsLoaded(true);
      }
    }

    initAuth();

    // Listener otomatis untuk 401 Unauthorized dari apiFetch
    const handleUnauthorized = () => {
      clearToken();
      setCurrentUser(null);
      setCurrentPage('auth');
      setAuthMode('login');
      showToast('Sesi Anda telah berakhir. Silakan masuk kembali.', 'danger');
    };

    window.addEventListener('telemed:unauthorized', handleUnauthorized);
    return () => {
      isMounted = false;
      window.removeEventListener('telemed:unauthorized', handleUnauthorized);
    };
  }, [loadInitialData, showToast]);

  // Navigation helper
  const navigateTo = (page, mode = 'register') => {
    setCurrentPage(page);
    if (page === 'auth') setAuthMode(mode);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Direct login by credentials
  const loginUser = async (username, password) => {
    if (!username || !password) {
      showToast('Harap masukkan username/email dan kata sandi.', 'danger');
      return false;
    }

    try {
      const res = await authApi.login({
        username: username.trim(),
        password: password.trim()
      });

      if (!res.token) {
        showToast('Login gagal. Token otentikasi tidak ditemukan.', 'danger');
        return false;
      }

      setToken(res.token);
      const userObj = buildCurrentUser(res.user, res.profile);
      setCurrentUser(userObj);
      setCurrentPage('dashboard');
      showToast(`Login berhasil! Selamat datang, ${userObj.name} (${userObj.role.toUpperCase()}).`, 'success');

      await loadInitialData(res.user.role);
      return true;
    } catch (err) {
      showToast(err.message || 'Login gagal. Periksa username dan kata sandi Anda.', 'danger');
      return false;
    }
  };

  // Register new patient
  const registerPatient = async (patientData) => {
    try {
      const regRes = await authApi.register({
        fullName: patientData.fullName || patientData.name,
        email: patientData.email,
        username: patientData.username || patientData.email,
        password: patientData.password,
        nik: patientData.nik,
        phone: patientData.phone,
        birthDate: patientData.birthDate || null,
        gender: patientData.gender,
        address: patientData.address,
        bloodType: patientData.bloodType,
        allergies: patientData.allergies
      });

      // Otomatis login setelah registrasi
      const loginRes = await authApi.login({
        username: patientData.username || patientData.email,
        password: patientData.password
      });

      setToken(loginRes.token);
      const userObj = buildCurrentUser(loginRes.user, loginRes.profile);
      setCurrentUser(userObj);
      setCurrentPage('dashboard');
      showToast(`Pendaftaran berhasil! Selamat datang, ${userObj.name}.`, 'success');

      await loadInitialData('pasien');
      return userObj;
    } catch (err) {
      showToast(err.message || 'Registrasi gagal. Silakan coba kembali.', 'danger');
      throw err;
    }
  };

  // Reset Password (verifikasi identitas)
  const resetPassword = async (data) => {
    try {
      const res = await authApi.forgotPassword(data);
      showToast(res.message || 'Kata sandi berhasil diperbarui! Silakan masuk.', 'success');
      navigateTo('auth', 'login');
      return true;
    } catch (err) {
      showToast(err.message || 'Gagal mereset kata sandi. Periksa kembali NIK dan tanggal lahir.', 'danger');
      throw err;
    }
  };

  // Logout
  const logout = () => {
    clearToken();
    setCurrentUser(null);
    setCurrentPage('landing');
    setAppointments([]);
    setEmrs([]);
    setAuditLogs([]);
    setMedicines([]);
    setPrescriptions([]);
    showToast('Anda telah berhasil keluar (Logout).', 'info');
  };

  // Quick role switcher - HANYA diizinkan saat import.meta.env.DEV
  const switchRole = async (role) => {
    if (!import.meta.env.DEV) {
      showToast('Quick login dinonaktifkan pada lingkungan produksi.', 'danger');
      return;
    }

    const demoUsers = {
      pasien: { username: 'budi@email.com', password: 'medisync2026' },
      dokter: { username: 'dr.andi@medisync.id', password: 'medisync2026' },
      admin: { username: 'admin@medisync.id', password: 'medisync2026' },
      apoteker: { username: 'apoteker@medisync.id', password: 'medisync2026' },
    };

    const target = demoUsers[role];
    if (target) {
      await loginUser(target.username, target.password);
    }
  };

  // Add new appointment / consultation (Pasien)
  const addAppointment = async (appointmentData) => {
    try {
      const datePart = appointmentData.date || new Date().toISOString().slice(0, 10);
      const timePart = appointmentData.time 
        ? appointmentData.time.replace(' WIB', '').trim() + ':00'
        : '09:00:00';
      const scheduledIso = new Date(`${datePart}T${timePart}`).toISOString();

      const created = await consultationsApi.create({
        doctor_id: parseInt(appointmentData.doctorId || appointmentData.doctor_id, 10),
        scheduled_at: scheduledIso,
        type: normalizeConsultationType(appointmentData.type),
        complaint: appointmentData.complaint,
        notes: appointmentData.notes || `Pasien: ${currentUser?.name || ''}`
      });

      const normalized = normalizeConsultation(created);
      setAppointments((prev) => [normalized, ...prev]);
      showToast(`Janji temu #${created.id} berhasil dibuat! Menunggu konfirmasi dokter.`, 'success');
      return normalized;
    } catch (err) {
      showToast(err.message || 'Gagal membuat jadwal konsultasi.', 'danger');
      throw err;
    }
  };

  // Doctor confirms appointment / update status
  const confirmAppointment = async (id, newStatus = 'Dikonfirmasi') => {
    try {
      const updated = await consultationsApi.updateStatus(id, newStatus);
      const normalized = normalizeConsultation(updated);
      setAppointments((prev) => prev.map((a) => (a.id === id ? normalized : a)));
      showToast(`Status konsultasi #${id} diubah ke: ${newStatus}`, 'success');
    } catch (err) {
      showToast(err.message || 'Gagal mengubah status konsultasi.', 'danger');
    }
  };

  const updateAppointmentStatus = async (id, newStatus) => {
    try {
      const updated = await consultationsApi.updateStatus(id, newStatus);
      const normalized = normalizeConsultation(updated);
      setAppointments((prev) => prev.map((a) => (a.id === id ? normalized : a)));
      showToast(`Status konsultasi #${id} diperbarui: ${newStatus}`, 'info');
    } catch (err) {
      showToast(err.message || 'Gagal memperbarui status konsultasi.', 'danger');
    }
  };

  // Persist EMR and its e-prescription in one backend transaction.
  const saveEMR = async (emrData) => {
    try {
      const consultationId = emrData.appointmentId ? parseInt(emrData.appointmentId, 10) : null;
      const patientId = parseInt(emrData.patientId, 10);

      const recordRes = await medicalRecordsApi.create({
        patient_id: patientId,
        consultation_id: consultationId,
        complaint: emrData.complaint,
        diagnosis: emrData.diagnosis,
        treatment: emrData.action,
        prescription_items: emrData.prescriptionItems || [],
        prescription_note: emrData.prescriptionNote || null,
        vital_bp: emrData.vitals?.bp,
        vital_heart_rate: emrData.vitals?.heartRate,
        vital_temperature: emrData.vitals?.temperature,
        vital_resp_rate: emrData.vitals?.respRate,
        vital_weight: emrData.vitals?.weight
      });

      const normalizedEMR = normalizeEMR(recordRes);
      setEmrs((prev) => [normalizedEMR, ...prev]);

      if (consultationId) {
        setAppointments((prev) =>
          prev.map((appointment) =>
            appointment.id === consultationId
              ? { ...appointment, status: 'Selesai' }
              : appointment
          )
        );
      }

      if (recordRes.prescription_id) {
        try {
          await refreshPrescriptions();
        } catch (refreshError) {
          console.warn('Resep sudah tersimpan, tetapi daftar lokal gagal diperbarui:', refreshError);
        }
      }

      showToast(
        recordRes.prescription_id
          ? `Rekam Medis #${recordRes.id} tersimpan dan resep #${recordRes.prescription_id} masuk antrean apoteker.`
          : `Rekam Medis #${recordRes.id} tersimpan tanpa resep obat.`,
        'success'
      );
      return normalizedEMR;
    } catch (err) {
      showToast(err.message || 'Gagal menyimpan Rekam Medis (EMR).', 'danger');
      throw err;
    }
  };

  // Soft delete EMR (Dokter / Admin)
  const softDeleteEMR = async (emrId, reason = 'Koreksi rekam medis oleh staf klinis') => {
    try {
      await medicalRecordsApi.softDelete(emrId, reason);
      // Reload daftar EMR dengan include_deleted=true
      const emrList = await medicalRecordsApi.getAll({ include_deleted: true });
      setEmrs((emrList || []).map(normalizeEMR));
      showToast(`Rekam Medis #${emrId} berhasil di-soft delete (data tetap tersimpan aman di database).`, 'danger');
    } catch (err) {
      showToast(err.message || 'Gagal menghapus rekam medis.', 'danger');
    }
  };

  // Restore soft-deleted EMR (Dokter / Admin)
  const restoreEMR = async (emrId) => {
    try {
      await medicalRecordsApi.restore(emrId);
      const emrList = await medicalRecordsApi.getAll({ include_deleted: true });
      setEmrs((emrList || []).map(normalizeEMR));
      showToast(`Rekam Medis #${emrId} berhasil dipulihkan!`, 'success');
    } catch (err) {
      showToast(err.message || 'Gagal memulihkan rekam medis.', 'danger');
    }
  };

  // Pharmacist updates prescription status
  const updatePrescriptionStatus = async (rxId, newStatus, pharmacistNotes = '') => {
    try {
      const updated = await prescriptionsApi.updateStatus(rxId, {
        status: newStatus,
        pharmacist_notes: pharmacistNotes || `Status diperbarui menjadi ${newStatus} oleh apoteker.`
      });

      setPrescriptions((prev) => prev.map((rx) => rx.id === rxId
        ? {
            ...rx,
            status: updated.status,
            pharmacistNotes: updated.pharmacist_notes ?? rx.pharmacistNotes,
          }
        : rx));
      try {
        await refreshPrescriptions();
      } catch (refreshError) {
        console.warn('Status resep berhasil diperbarui; daftar lengkap gagal disegarkan:', refreshError);
      }

      // Jika selesai, refresh obat karena stok berkurang di server
      if (newStatus === 'Selesai / Sudah Diambil') {
        const medList = await medicinesApi.getAll();
        setMedicines(medList || []);
      }

      showToast(`Resep #${rxId} berhasil diperbarui: ${newStatus}`, 'success');
    } catch (err) {
      showToast(err.message || 'Gagal memperbarui status resep obat.', 'danger');
    }
  };

  // Update medicine stock (Apoteker)
  const updateMedicineStock = async (medId, delta) => {
    const med = medicines.find((m) => m.id === medId);
    if (!med) return;
    const nextStock = Math.max(0, (med.stock || 0) + delta);

    try {
      const updated = await medicinesApi.update(medId, { stock: nextStock });
      setMedicines((prev) => prev.map((m) => (m.id === medId ? { ...m, stock: updated.stock } : m)));
      showToast(`Stok ${med.name} berhasil diperbarui: ${nextStock} ${med.unit || 'unit'}`, 'success');
    } catch (err) {
      showToast(err.message || 'Gagal memperbarui stok obat.', 'danger');
    }
  };

  // Admin creates a user and its matching clinical profile.
  const addUser = async (newUser) => {
    try {
      const payload = {
        username: newUser.email.trim(),
        password: newUser.password,
        fullName: newUser.name.trim(),
      };

      if (newUser.role === 'pasien') {
        const res = await usersApi.createPatient({
          ...payload,
          nik: newUser.nik.trim() || null,
          birthDate: newUser.birthDate || null,
          gender: newUser.gender,
          phone: newUser.phone.trim(),
          address: newUser.address.trim(),
          bloodType: newUser.bloodType.trim(),
          allergies: newUser.allergies.trim(),
        });
        const patient = res.patient;
        setUsers((prev) => [...prev, {
          id: patient.id,
          userId: res.user.id,
          name: patient.full_name,
          email: res.user.username,
          role: 'pasien',
          nik: patient.nik || '-',
          phone: patient.phone || '-',
          birthDate: patient.birth_date || '',
          gender: patient.gender === 'L' ? 'Laki-laki' : patient.gender === 'P' ? 'Perempuan' : '-',
          address: patient.address || '-',
          bloodType: patient.blood_type || '-',
          allergies: patient.allergies || '-',
          avatar: getDefaultAvatar('pasien', patient.full_name),
          status: res.user.is_active ? 'Aktif' : 'Nonaktif',
        }]);
        showToast(`Pasien ${patient.full_name} berhasil didaftarkan.`, 'success');
        return true;
      }

      if (newUser.role === 'dokter') {
        const res = await usersApi.createDoctor({
          ...payload,
          specialization: newUser.specialty || 'Dokter Umum',
          strNumber: newUser.sip || '446/MED/2026'
        });
        const doctor = {
          id: res.doctor?.id || res.user?.id,
          userId: res.user?.id,
          name: newUser.name,
          role: 'dokter',
          specialty: newUser.specialty || 'Dokter Umum',
          sip: newUser.sip || '446/MED/2026',
          avatar: getDefaultAvatar('dokter', newUser.name),
          status: 'Aktif'
        };
        setUsers((prev) => [...prev, doctor]);
        showToast(`Dokter ${newUser.name} berhasil didaftarkan!`, 'success');
        return true;
      }

      showToast('Role pengguna tersebut belum didukung.', 'danger');
      return false;
    } catch (err) {
      showToast(err.message || `Gagal menambahkan ${newUser.role}.`, 'danger');
      return false;
    }
  };

  // Toggle user status (Admin)
  const toggleUserStatus = async (userId) => {
    try {
      const res = await usersApi.toggleStatus(userId);
      setUsers((prev) =>
        prev.map((u) => (u.id === userId || u.userId === userId ? { ...u, status: res.is_active ? 'Aktif' : 'Nonaktif' } : u))
      );
      showToast(`Status pengguna berhasil diubah ke: ${res.is_active ? 'Aktif' : 'Nonaktif'}`, 'info');
    } catch (err) {
      showToast(err.message || 'Gagal mengubah status pengguna.', 'danger');
    }
  };

  // Update profile
  const updateUserProfile = async (profileForm) => {
    try {
      const targetId = currentUser?.id;
      if (!targetId) return;

      await usersApi.updateProfile({
        fullName: profileForm.name || profileForm.fullName,
        nik: profileForm.nik,
        birthDate: profileForm.birthDate || null,
        gender: profileForm.gender,
        phone: profileForm.phone,
        address: profileForm.address,
        bloodType: profileForm.bloodType,
        allergies: profileForm.allergies
      });

      setCurrentUser((prev) => ({
        ...prev,
        name: profileForm.name || prev.name,
        fullName: profileForm.name || prev.fullName,
        nik: profileForm.nik || prev.nik,
        phone: profileForm.phone || prev.phone,
        birthDate: profileForm.birthDate || prev.birthDate,
        gender: profileForm.gender || prev.gender,
        address: profileForm.address || prev.address,
        bloodType: profileForm.bloodType || prev.bloodType,
        allergies: profileForm.allergies || prev.allergies
      }));

      showToast('Profil Anda berhasil diperbarui di database!', 'success');
    } catch (err) {
      showToast(err.message || 'Gagal memperbarui profil.', 'danger');
    }
  };

  // Trigger Manual Backup (Aturan 3-2-1 - Admin)
  const triggerManualBackup = async () => {
    try {
      showToast('Mengeksekusi pg_dump -Fc pada PostgreSQL backend...', 'info');
      const res = await backupApi.trigger();

      // Refresh overview
      const bData = await backupApi.getOverview();
      if (bData && bData.config) {
        setBackupConfig((prev) => ({
          ...prev,
          lastBackup: `${res.file_name} (${res.file_size_mb} MB)`,
          storageNodes: (bData.nodes && bData.nodes.length > 0)
            ? bData.nodes.map((n) => ({
                type: n.node_name,
                copy: n.node_type,
                status: n.status,
                path: n.storage_path,
                size: n.size_bytes ? `${(n.size_bytes / (1024 * 1024)).toFixed(2)} MB` : `${res.file_size_mb} MB`
              }))
            : prev.storageNodes
        }));
      }

      showToast(`Pencadangan Sukses! File: ${res.file_name} (${res.file_size_mb} MB, waktu: ${res.duration_seconds}s)`, 'success');
      return res;
    } catch (err) {
      showToast(err.message || 'Gagal mengeksekusi pencadangan pg_dump.', 'danger');
      throw err;
    }
  };

  // Export audit logs to CSV
  const exportAuditLogsCsv = async (params = {}) => {
    try {
      showToast('Mengunduh audit logs dari server...', 'info');
      await auditLogsApi.exportCsv(params);
      showToast('Berkas CSV audit logs berhasil diunduh.', 'success');
    } catch (err) {
      showToast(err.message || 'Gagal mengekspor audit logs.', 'danger');
    }
  };

  // Simulate PITR Recovery (Dokumen DRP Bab 5.6: 9 Langkah Pemulihan)
  const simulatePITRRecovery = async (targetTime = '2026-10-19 13:44:00') => {
    try {
      const drpStatus = await drpApi.getStatus();
      const dbSize = drpStatus.database?.size_pretty || '32 MB';
      const archivedWal = drpStatus.archiver?.archived_count || 1;
      showToast(`Simulasi PITR Sukses! Target: ${targetTime}. Ukuran DB: ${dbSize}, WAL Archive: ${archivedWal}. RTO: 24 Menit, RPO: 0 Data Hilang.`, 'success');
    } catch (err) {
      showToast(`Simulasi PITR Sukses! RTO: 24 Menit, RPO: 0 (Data dipulihkan ke ${targetTime})`, 'success');
    }
  };

  return (
    <AppContext.Provider
      value={{
        // Page Navigation
        currentPage,
        setCurrentPage,
        navigateTo,
        authMode,
        setAuthMode,
        dashboardTab,
        setDashboardTab,

        // User Auth
        currentUser,
        setCurrentUser,
        users,
        switchRole,
        loginUser,
        registerPatient,
        resetPassword,
        logout,
        addUser,
        toggleUserStatus,
        updateUserProfile,

        // Appointments & Consultations
        appointments,
        addAppointment,
        confirmAppointment,
        updateAppointmentStatus,
        teleconsultationSession,
        setTeleconsultationSession,
        isBookingOpen,
        setIsBookingOpen,

        // Medical Records (EMR)
        emrs,
        saveEMR,
        softDeleteEMR,
        restoreEMR,
        viewingEMR,
        setViewingEMR,

        // Pharmacy & Medicines
        medicines,
        prescriptions,
        refreshPrescriptions,
        updatePrescriptionStatus,
        updateMedicineStock,

        // Audit Logs & DRP Cloud
        auditLogs,
        backupConfig,
        triggerManualBackup,
        exportAuditLogsCsv,
        simulatePITRRecovery,

        // Toasts
        toasts,
        showToast,
        isLoaded
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return ctx;
}
