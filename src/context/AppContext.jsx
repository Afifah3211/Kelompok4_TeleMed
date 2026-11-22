import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { normalizeConsultationType } from '../utils/consultation';
import { 
  authApi, 
  usersApi, 
  consultationsApi, 
  medicalRecordsApi, 
  auditLogsApi, 
  backupApi, 
  prescriptionsApi,
  adminRecoveryApi,
  getToken,
  setToken,
  clearToken
} from '../services/api';

const AppContext = createContext();

const DEFAULT_AVATAR = '/avatar-placeholder.svg';
const CURRENT_PAGE_KEY = 'telemed_current_page';
const VALID_PAGES = new Set(['landing', 'auth', 'reset-password', 'dashboard']);

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
    sip: p.str_number || '',
    workplace: p.workplace || '',
    avatar: p.profile_photo_url || DEFAULT_AVATAR,
    profilePhotoUrl: p.profile_photo_url || '',
    status: user.is_active === false ? 'Nonaktif' : 'Aktif',
    patientId: role === 'pasien' ? p.id : null,
    doctorId: role === 'dokter' ? p.id : null,
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
    consultationId: e.consultation_id,
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
    id: p.id,
    medicalRecordId: p.medical_record_id,
    patientId: p.patient_id,
    patientName: p.patient_name || 'Pasien',
    doctorId: p.doctor_id,
    doctorName: p.doctor_name || 'Dokter',
    notes: p.notes || '',
    date: dateStr,
    prescriptionText: p.prescription_text || '',
    items: (p.items || []).map((it) => ({
      medicineName: it.medicine_name || '',
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
  const [currentPage, setCurrentPage] = useState(() => {
    const savedPage = sessionStorage.getItem(CURRENT_PAGE_KEY);
    return VALID_PAGES.has(savedPage) ? savedPage : 'landing';
  }); // 'landing' | 'auth' | 'reset-password' | 'dashboard'
  const [authMode, setAuthMode] = useState('register'); // 'register' | 'login'
  const [dashboardTab, setDashboardTab] = useState('overview');

  // Core state dari Backend API (Tidak ada di localStorage!)
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [emrs, setEmrs] = useState([]);
  const [deletedRecords, setDeletedRecords] = useState({ medical_records: [], consultations: [], users: [] });
  const [auditLogs, setAuditLogs] = useState([]);
  const [backupConfig, setBackupConfig] = useState({
    policyName: 'Backup PostgreSQL terjadwal (single-host)',
    rtoTarget: 'maksimal 5 menit untuk restore drill; ukur aktual',
    rpoTarget: 'maksimal 6 jam dari dump terjadwal',
    lastBackup: 'Belum ada job backup tercatat',
    recentRuns: []
  });
  const [prescriptions, setPrescriptions] = useState([]);

  // Modal states
  const [teleconsultationSession, setTeleconsultationSession] = useState(null);
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [viewingEMR, setViewingEMR] = useState(null);
  const [editingEMR, setEditingEMR] = useState(null);

  // Toast notifications
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    sessionStorage.setItem(CURRENT_PAGE_KEY, currentPage);
  }, [currentPage]);

  // Keep the same viewport when a user refreshes any page or dashboard tab.
  useEffect(() => {
    const saveScrollPosition = () => {
      sessionStorage.setItem('telemed_scroll_y', String(window.scrollY));
    };
    window.addEventListener('pagehide', saveScrollPosition);
    return () => window.removeEventListener('pagehide', saveScrollPosition);
  }, []);

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

  const refreshAppointments = useCallback(async () => {
    const appointmentList = await consultationsApi.getAll();
    const normalized = (appointmentList || []).map(normalizeConsultation);
    setAppointments(normalized);
    setTeleconsultationSession((current) => {
      if (!current) return current;
      return normalized.find((appointment) => Number(appointment.id) === Number(current.id)) || current;
    });
    return normalized;
  }, []);

  const refreshUsers = useCallback(async () => {
    const role = currentUser?.role;
    if (!['pasien', 'dokter', 'admin'].includes(role)) return [];
    const doctorRequest = usersApi.getDoctors();
    const patientRequest = role === 'dokter' || role === 'admin'
      ? usersApi.getPatients()
      : Promise.resolve([]);
    const [doctorRows, patientRows] = await Promise.all([doctorRequest, patientRequest]);
    const doctorUsers = (doctorRows || []).map((doctor) => ({
      id: doctor.id,
      userId: doctor.user_id,
      name: doctor.full_name,
      email: doctor.username,
      role: 'dokter',
      specialty: doctor.specialization || 'Dokter Spesialis',
      sip: doctor.str_number || '',
      phone: doctor.phone || '',
      hospital: doctor.workplace || '',
      avatar: doctor.profile_photo_url || DEFAULT_AVATAR,
      status: doctor.is_active ? 'Aktif' : 'Nonaktif',
    }));
    const patientUsers = (patientRows || []).map((patient) => ({
      id: patient.id,
      userId: patient.user_id,
      name: patient.full_name,
      email: patient.username,
      role: 'pasien',
      nik: patient.nik || '-',
      phone: patient.phone || '-',
      birthDate: patient.birth_date || '',
      gender: patient.gender === 'L' ? 'Laki-laki' : patient.gender === 'P' ? 'Perempuan' : '-',
      address: patient.address || '-',
      bloodType: patient.blood_type || '-',
      allergies: patient.allergies || '-',
      avatar: patient.profile_photo_url || DEFAULT_AVATAR,
      status: patient.is_active ? 'Aktif' : 'Nonaktif',
    }));
    const combined = [...doctorUsers, ...patientUsers];
    setUsers(combined);
    return combined;
  }, [currentUser?.role]);

  const refreshDeletedRecords = useCallback(async () => {
    if (currentUser?.role !== 'admin') return null;
    const deleted = await adminRecoveryApi.getDeleted();
    setDeletedRecords(deleted);
    return deleted;
  }, [currentUser?.role]);

  const refreshEMRs = useCallback(async () => {
    const role = currentUser?.role;
    if (!['pasien', 'dokter', 'admin'].includes(role)) return [];
    const recordList = await medicalRecordsApi.getAll({
      include_deleted: role === 'admin',
    });
    const normalized = (recordList || []).map(normalizeEMR);
    setEmrs(normalized);
    setViewingEMR((current) => {
      if (!current) return current;
      return normalized.find((record) => Number(record.id) === Number(current.id)) || null;
    });
    setEditingEMR((current) => {
      if (!current) return current;
      return normalized.find((record) => Number(record.id) === Number(current.id)) || null;
    });
    return normalized;
  }, [currentUser?.role]);

  useEffect(() => {
    if (!currentUser) return undefined;
    const role = currentUser.role;
    const timer = window.setInterval(() => {
      refreshPrescriptions().catch((error) => console.warn('Gagal memperbarui antrean resep:', error));
      if (['pasien', 'dokter', 'admin'].includes(role)) {
        refreshAppointments().catch((error) => console.warn('Gagal memperbarui konsultasi:', error));
        refreshEMRs().catch((error) => console.warn('Gagal memperbarui rekam medis:', error));
      }
      if (role === 'admin') {
        refreshDeletedRecords().catch((error) => console.warn('Gagal memperbarui data pemulihan:', error));
      }
      if (['pasien', 'dokter', 'admin'].includes(role)) {
        refreshUsers().catch((error) => console.warn('Gagal memperbarui direktori pengguna:', error));
      }
    }, 15000);
    return () => window.clearInterval(timer);
  }, [currentUser, refreshAppointments, refreshDeletedRecords, refreshEMRs, refreshPrescriptions, refreshUsers]);

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
          avatar: d.profile_photo_url || DEFAULT_AVATAR,
          status: d.is_active ? 'Aktif' : 'Nonaktif',
          email: d.username,
          phone: d.phone || '',
          hospital: d.workplace || '',
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
          avatar: p.profile_photo_url || DEFAULT_AVATAR,
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
        const includeDeleted = role === 'admin';
        const emrList = await medicalRecordsApi.getAll({ include_deleted: includeDeleted });
        setEmrs((emrList || []).map(normalizeEMR));
      }

      // 5. Resep digital
      await refreshPrescriptions();

      // 6. Audit Logs & Backup (khusus admin)
      if (role === 'admin') {
        await refreshDeletedRecords();
        await refreshUsers();
        const logs = await auditLogsApi.getAll({ limit: 100 });
        setAuditLogs((logs || []).map(normalizeAuditLog));

        try {
          const bData = await backupApi.getOverview();
          if (bData && bData.config) {
            setBackupConfig((prev) => ({
              ...prev,
              policyName: bData.config.policy_name || prev.policyName,
              lastBackup: bData.recent_runs && bData.recent_runs.length > 0
                ? `${String(bData.recent_runs[0].started_at).slice(0, 19).replace('T', ' ')} WIB`
                : prev.lastBackup,
              recentRuns: bData.recent_runs || []
            }));
          }
        } catch (bErr) {
          console.warn('Backup overview error:', bErr);
        }
      }
    } catch (err) {
      console.warn('Error loading initial data from backend:', err);
    }
  }, [refreshDeletedRecords, refreshPrescriptions, refreshUsers]);

  // Inisialisasi Auth pada mount dengan token dari sessionStorage
  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      const token = getToken();
      if (!token) {
        if (isMounted) {
          setCurrentUser(null);
          const savedPage = sessionStorage.getItem(CURRENT_PAGE_KEY);
          setCurrentPage(savedPage === 'auth' || savedPage === 'reset-password' ? savedPage : 'landing');
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
          // Keep the recovery screen mounted until the dashboard data is ready.
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
    setUsers([]);
    setDeletedRecords({ medical_records: [], consultations: [], users: [] });
    setAuditLogs([]);
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
      showToast(`Janji temu #${created.id} berhasil dibuat. Menunggu dokter memulai konsultasi.`, 'success');
      return normalized;
    } catch (err) {
      showToast(err.message || 'Gagal membuat jadwal konsultasi.', 'danger');
      throw err;
    }
  };

  // Doctor confirms appointment / update status
  const confirmAppointment = async (id, newStatus = 'Sedang Berlangsung') => {
    try {
      const updated = await consultationsApi.updateStatus(id, newStatus);
      const normalized = normalizeConsultation(updated);
      setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, ...normalized } : a)));
      showToast(`Status konsultasi #${id} diubah ke: ${newStatus}`, 'success');
      return normalized;
    } catch (err) {
      showToast(err.message || 'Gagal mengubah status konsultasi.', 'danger');
      return null;
    }
  };

  const updateAppointmentStatus = async (id, newStatus) => {
    try {
      const updated = await consultationsApi.updateStatus(id, newStatus);
      const normalized = normalizeConsultation(updated);
      setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, ...normalized } : a)));
      setTeleconsultationSession((current) =>
        current && Number(current.id) === Number(id) ? { ...current, ...normalized } : current
      );
      showToast(`Status konsultasi #${id} diperbarui: ${newStatus}`, 'info');
      return normalized;
    } catch (err) {
      showToast(err.message || 'Gagal memperbarui status konsultasi.', 'danger');
      return null;
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
          ? `Rekam Medis #${recordRes.id} tersimpan dan resep #${recordRes.prescription_id} diterbitkan.`
          : `Rekam Medis #${recordRes.id} tersimpan tanpa resep obat.`,
        'success'
      );
      return normalizedEMR;
    } catch (err) {
      showToast(err.message || 'Gagal menyimpan Rekam Medis (EMR).', 'danger');
      throw err;
    }
  };

  const updateEMR = async (emrId, emrData) => {
    try {
      const recordRes = await medicalRecordsApi.update(emrId, {
        complaint: emrData.complaint,
        diagnosis: emrData.diagnosis,
        treatment: emrData.action,
        prescriptionItems: emrData.prescriptionItems,
        prescriptionNote: emrData.prescriptionNote || null,
        vitalBp: emrData.vitals?.bp,
        vitalHeartRate: emrData.vitals?.heartRate,
        vitalTemperature: emrData.vitals?.temperature,
        vitalRespRate: emrData.vitals?.respRate,
        vitalWeight: emrData.vitals?.weight,
      });
      const normalizedEMR = normalizeEMR(recordRes);
      setEmrs((prev) => prev.map((record) =>
        Number(record.id) === Number(emrId) ? normalizedEMR : record
      ));
      setViewingEMR((current) =>
        current && Number(current.id) === Number(emrId) ? normalizedEMR : current
      );

      try {
        await refreshPrescriptions();
        showToast(`Rekam Medis #${emrId} dan resep terkait berhasil diperbarui.`, 'success');
      } catch (refreshError) {
        console.warn('Rekam medis tersimpan, tetapi antrean resep gagal disegarkan:', refreshError);
        showToast(
          'Rekam medis tersimpan, tetapi antrean resep belum dapat disegarkan. Data akan dicoba ulang otomatis.',
          'info'
        );
      }
      return normalizedEMR;
    } catch (err) {
      showToast(err.message || 'Gagal memperbarui rekam medis.', 'danger');
      throw err;
    }
  };

  const deleteEMR = async (emrId, reason = 'Dihapus oleh dokter pemeriksa') => {
    try {
      await medicalRecordsApi.delete(emrId, reason);
      const deletedId = Number(emrId);
      setEmrs((previous) => previous.filter((record) => Number(record.id) !== deletedId));
      setPrescriptions((previous) =>
        previous.filter((prescription) => Number(prescription.medicalRecordId) !== deletedId)
      );
      setViewingEMR((current) => (
        current && Number(current.id) === deletedId ? null : current
      ));
      setEditingEMR((current) => (
        current && Number(current.id) === deletedId ? null : current
      ));
      showToast(`Rekam Medis #${emrId} berhasil dihapus. Hanya admin yang dapat memulihkannya.`, 'success');
      return true;
    } catch (err) {
      showToast(err.message || 'Gagal menghapus rekam medis.', 'danger');
      return false;
    }
  };

  const restoreEMR = async (emrId) => {
    try {
      await medicalRecordsApi.restore(emrId);
      const emrList = await medicalRecordsApi.getAll({ include_deleted: true });
      setEmrs((emrList || []).map(normalizeEMR));
      showToast(`Rekam Medis #${emrId} berhasil dipulihkan.`, 'success');
      return true;
    } catch (err) {
      showToast(err.message || 'Gagal memulihkan rekam medis.', 'danger');
      return false;
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
          avatar: DEFAULT_AVATAR,
          status: res.user.is_active ? 'Aktif' : 'Nonaktif',
        }]);
        showToast(`Pasien ${patient.full_name} berhasil didaftarkan.`, 'success');
        return true;
      }

      if (newUser.role === 'dokter') {
        const res = await usersApi.createDoctor({
          ...payload,
          specialization: newUser.specialty || 'Dokter Umum',
          strNumber: newUser.sip || null,
          phone: newUser.phone || null,
          workplace: newUser.hospital || null,
        });
        const doctor = {
          id: res.doctor?.id || res.user?.id,
          userId: res.user?.id,
          name: newUser.name,
          role: 'dokter',
          specialty: newUser.specialty || 'Dokter Umum',
          sip: newUser.sip || '',
          avatar: res.doctor?.profile_photo_url || DEFAULT_AVATAR,
          phone: newUser.phone || '',
          hospital: newUser.hospital || '',
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
      if (!targetId) return false;

      const profile = {
        fullName: profileForm.name || profileForm.fullName,
        nik: profileForm.nik,
        birthDate: profileForm.birthDate || null,
        gender: profileForm.gender,
        phone: profileForm.phone,
        address: profileForm.address,
        bloodType: profileForm.bloodType,
        allergies: profileForm.allergies
      };
      if (currentUser.role === 'dokter') {
        profile.specialization = profileForm.specialization || profileForm.specialty;
        profile.strNumber = profileForm.strNumber || profileForm.sip;
        profile.workplace = profileForm.workplace;
      }
      await usersApi.updateProfile(targetId, profile);

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
        allergies: profileForm.allergies || prev.allergies,
        specialization: profileForm.specialization || profileForm.specialty || prev.specialization,
        specialty: profileForm.specialization || profileForm.specialty || prev.specialty,
        strNumber: profileForm.strNumber || profileForm.sip || prev.strNumber,
        sip: profileForm.strNumber || profileForm.sip || prev.sip,
        workplace: profileForm.workplace || prev.workplace,
      }));

      showToast('Profil Anda berhasil diperbarui.', 'success');
      return true;
    } catch (err) {
      showToast(err.message || 'Gagal memperbarui profil.', 'danger');
      return false;
    }
  };

  const uploadProfilePhoto = async (image) => {
    try {
      if (!currentUser?.id) return false;
      const result = await usersApi.uploadProfilePhoto(currentUser.id, image);
      setCurrentUser((prev) => ({
        ...prev,
        avatar: result.profile_photo_url || DEFAULT_AVATAR,
        profilePhotoUrl: result.profile_photo_url || '',
      }));
      showToast('Foto profil berhasil diperbarui.', 'success');
      return true;
    } catch (err) {
      showToast(err.message || 'Gagal mengunggah foto profil.', 'danger');
      return false;
    }
  };

  const deleteUser = async (userId, reason) => {
    try {
      await usersApi.delete(userId, reason);
      setUsers((prev) => prev.filter((user) => Number(user.userId) !== Number(userId)));
      await refreshDeletedRecords();
      showToast('Akun dipindahkan ke pemulihan admin.', 'success');
      return true;
    } catch (err) {
      showToast(err.message || 'Gagal menghapus akun.', 'danger');
      return false;
    }
  };

  const deleteAppointment = async (id, reason) => {
    try {
      await consultationsApi.delete(id, reason);
      setAppointments((prev) => prev.filter((appointment) => Number(appointment.id) !== Number(id)));
      await refreshDeletedRecords();
      showToast('Konsultasi dipindahkan ke pemulihan admin.', 'success');
      return true;
    } catch (err) {
      showToast(err.message || 'Gagal menghapus konsultasi.', 'danger');
      return false;
    }
  };

  const restoreDeletedRecord = async (entity, id) => {
    try {
      await adminRecoveryApi.restore(entity, id);
      if (entity === 'medical-record') await refreshEMRs();
      if (entity === 'consultation') await refreshAppointments();
      if (entity === 'user') await refreshUsers();
      await refreshDeletedRecords();
      showToast('Data berhasil dipulihkan.', 'success');
      return true;
    } catch (err) {
      showToast(err.message || 'Gagal memulihkan data.', 'danger');
      return false;
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
          lastBackup: `${res.file_name} (${(res.size_bytes / (1024 * 1024)).toFixed(2)} MB)`,
          recentRuns: bData.recent_runs || []
        }));
      }

      showToast(`Pencadangan sukses: ${res.file_name} (${(res.size_bytes / (1024 * 1024)).toFixed(2)} MB).`, 'success');
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
        uploadProfilePhoto,
        deleteUser,
        refreshUsers,

        // Appointments & Consultations
        appointments,
        addAppointment,
        confirmAppointment,
        updateAppointmentStatus,
        deleteAppointment,
        refreshAppointments,
        teleconsultationSession,
        setTeleconsultationSession,
        isBookingOpen,
        setIsBookingOpen,

        // Medical Records (EMR)
        emrs,
        saveEMR,
        updateEMR,
        refreshEMRs,
        deleteEMR,
        restoreEMR,
        deletedRecords,
        refreshDeletedRecords,
        restoreDeletedRecord,
        viewingEMR,
        setViewingEMR,
        editingEMR,
        setEditingEMR,

        // Prescriptions
        prescriptions,
        refreshPrescriptions,

        // Audit Logs & Backup DRP
        auditLogs,
        backupConfig,
        triggerManualBackup,
        exportAuditLogsCsv,

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
