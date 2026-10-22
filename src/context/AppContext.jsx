import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  INITIAL_USERS, 
  INITIAL_APPOINTMENTS, 
  INITIAL_EMRS, 
  INITIAL_AUDIT_LOGS, 
  BACKUP_CONFIG,
  INITIAL_MEDICINES,
  INITIAL_PRESCRIPTIONS
} from '../data/mockData';

const AppContext = createContext();

const LOCAL_STORAGE_KEY = 'medisync_state_v2';

export function AppProvider({ children }) {
  // Navigation & Page state
  const [currentPage, setCurrentPage] = useState('landing'); // 'landing' | 'auth' | 'reset-password' | 'dashboard'
  const [authMode, setAuthMode] = useState('register'); // 'register' | 'login'
  const [dashboardTab, setDashboardTab] = useState('overview'); // role-specific subtab

  // Core state
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentUser, setCurrentUser] = useState(null); // Unauthenticated by default
  const [users, setUsers] = useState(INITIAL_USERS);
  const [appointments, setAppointments] = useState(INITIAL_APPOINTMENTS);
  const [emrs, setEmrs] = useState(INITIAL_EMRS);
  const [auditLogs, setAuditLogs] = useState(INITIAL_AUDIT_LOGS);
  const [backupConfig, setBackupConfig] = useState(BACKUP_CONFIG);
  const [medicines, setMedicines] = useState(INITIAL_MEDICINES);
  const [prescriptions, setPrescriptions] = useState(INITIAL_PRESCRIPTIONS);
  
  // Modal states
  const [teleconsultationSession, setTeleconsultationSession] = useState(null);
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [viewingEMR, setViewingEMR] = useState(null);
  
  // Toast notifications
  const [toasts, setToasts] = useState([]);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.users) setUsers(parsed.users);
        if (parsed.appointments) setAppointments(parsed.appointments);
        if (parsed.emrs) setEmrs(parsed.emrs);
        if (parsed.auditLogs) setAuditLogs(parsed.auditLogs);
        if (parsed.backupConfig) setBackupConfig(parsed.backupConfig);
        if (parsed.medicines) setMedicines(parsed.medicines);
        if (parsed.prescriptions) setPrescriptions(parsed.prescriptions);
        if (parsed.currentUserId) {
          const u = (parsed.users || INITIAL_USERS).find(x => x.id === parsed.currentUserId);
          if (u) {
            setCurrentUser(u);
            if (parsed.currentPage) setCurrentPage(parsed.currentPage);
          } else {
            setCurrentUser(null);
            setCurrentPage('landing');
          }
        } else {
          setCurrentUser(null);
          setCurrentPage('landing');
        }
      } else {
        setCurrentPage('landing');
      }
    } catch (err) {
      console.warn('Error reading localStorage:', err);
    }
    setIsLoaded(true);
  }, []);

  // Save to localStorage whenever state updates
  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({
        users,
        appointments,
        emrs,
        auditLogs,
        backupConfig,
        medicines,
        prescriptions,
        currentPage,
        currentUserId: currentUser?.id
      }));
    } catch (err) {
      console.warn('Error writing to localStorage:', err);
    }
  }, [users, appointments, emrs, auditLogs, backupConfig, medicines, prescriptions, currentPage, currentUser, isLoaded]);

  // Toast dispatch
  const showToast = (message, type = 'info') => {
    const id = Date.now() + Math.random().toString(36).substring(2, 5);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  // Real-time IP address generator (simulated client IP based on role per DRP document)
  const getSimulatedIp = () => {
    if (currentUser?.role === 'admin') return '192.168.1.45 (Klinik Admin Net)';
    if (currentUser?.role === 'dokter') return '192.168.1.88 (Ruang Poli Dokter)';
    if (currentUser?.role === 'apoteker') return '192.168.1.92 (Instalasi Farmasi)';
    return '180.252.12.90 (Telkomsel Pasien Mobile)';
  };

  // Helper to append audit logs
  const logAudit = (action, tableName, dataId, severity, details) => {
    const now = new Date();
    const timeString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')} WIB`;
    
    const newLog = {
      id: `LOG-${Math.floor(1000 + Math.random() * 9000)}`,
      timestamp: timeString,
      ipAddress: getSimulatedIp(),
      userId: currentUser?.id || 'ANONYMOUS',
      userName: `${currentUser?.name || 'Tamu'} (${currentUser?.role || 'Guest'})`,
      action: action.toUpperCase(),
      tableName,
      dataId,
      severity,
      details
    };

    setAuditLogs((prev) => [newLog, ...prev]);
  };

  // Navigation helper
  const navigateTo = (page, mode = 'register') => {
    setCurrentPage(page);
    if (page === 'auth') setAuthMode(mode);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Switch current user / role
  const switchUser = (userId) => {
    const target = users.find((u) => u.id === userId);
    if (target) {
      setCurrentUser(target);
      logAudit('LOGIN', 'users_auth', target.id, 'info', `Beralih peran / login sebagai ${target.name} [Role: ${target.role.toUpperCase()}].`);
      showToast(`Beralih ke akun: ${target.name} (${target.role.toUpperCase()})`, 'info');
    }
  };

  // Quick role switcher (Pasien, Dokter, Admin, Apoteker)
  const switchRole = (role) => {
    const target = users.find((u) => u.role === role);
    if (target) {
      setCurrentUser(target);
      setCurrentPage('dashboard');
      logAudit('LOGIN', 'users_auth', target.id, 'info', `Quick login sebagai ${target.name} (${role.toUpperCase()}).`);
      showToast(`Login berhasil sebagai ${target.name} (${role.toUpperCase()})`, 'success');
    }
  };

  // Direct login by credentials
  const loginUser = (email, password) => {
    if (!email || !password) {
      showToast('Harap masukkan email/username dan kata sandi.', 'danger');
      return false;
    }

    const cleanInput = email.trim().toLowerCase();
    const target = users.find(u => 
      u.email.toLowerCase() === cleanInput || 
      u.name.toLowerCase() === cleanInput ||
      u.id.toLowerCase() === cleanInput
    );
    
    if (!target) {
      showToast('Akun tidak ditemukan. Periksa kembali email Anda.', 'danger');
      return false;
    }

    // Verify password (default mock password is password123)
    if (target.password && target.password !== password.trim()) {
      showToast('Kata sandi salah. Silakan periksa kembali.', 'danger');
      return false;
    }

    if (target.status === 'Nonaktif') {
      showToast('Akun Anda dinonaktifkan oleh administrator klinik.', 'danger');
      return false;
    }

    setCurrentUser(target);
    setCurrentPage('dashboard');
    logAudit('LOGIN', 'users_auth', target.id, 'success', `Login berhasil sebagai ${target.name} [Role: ${target.role.toUpperCase()}].`);
    showToast(`Login berhasil! Selamat datang, ${target.name} (${target.role.toUpperCase()}).`, 'success');
    return true;
  };

  // Register new patient
  const registerPatient = (patientData) => {
    const newId = `USR-P${Math.floor(100 + Math.random() * 900)}`;
    const newPatient = {
      id: newId,
      name: patientData.fullName || patientData.name || 'Pasien Baru',
      email: patientData.email,
      role: 'pasien',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80',
      nik: patientData.nik || '3273010000000000',
      birthDate: patientData.birthDate || '1995-01-01',
      gender: patientData.gender || 'Laki-laki',
      phone: patientData.phone || '0812-3456-7890',
      address: patientData.address || 'Bandung, Jawa Barat',
      bloodType: patientData.bloodType || 'O+',
      allergies: patientData.allergies || 'Tidak Ada',
      status: 'Aktif'
    };

    setUsers(prev => [newPatient, ...prev]);
    setCurrentUser(newPatient);
    setCurrentPage('dashboard');
    logAudit('CREATE', 'patients', newId, 'success', `Pasien baru mendaftar: ${newPatient.name} (NIK: ${newPatient.nik}). Akun langsung aktif.`);
    showToast(`Pendaftaran berhasil! Selamat datang, ${newPatient.name}.`, 'success');
    return newPatient;
  };

  // Reset Password
  const resetPassword = (email, newPassword) => {
    const cleanEmail = email.trim().toLowerCase();
    logAudit('UPDATE', 'users_auth', cleanEmail, 'warning', `Reset kata sandi berhasil untuk akun: ${cleanEmail}.`);
    showToast(`Kata sandi untuk ${cleanEmail} telah berhasil diperbarui! Silakan masuk.`, 'success');
    navigateTo('auth', 'login');
    return true;
  };

  // Logout
  const logout = () => {
    if (currentUser) {
      logAudit('LOGOUT', 'users_auth', currentUser.id, 'info', `Pengguna ${currentUser.name} keluar dari sistem.`);
    }
    setCurrentUser(null);
    setCurrentPage('landing');
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    } catch (e) {}
    showToast('Anda telah berhasil keluar (Logout).', 'info');
  };

  // Add new appointment (Pasien)
  const addAppointment = (appointmentData) => {
    const newId = `APT-${Math.floor(104 + Math.random() * 900)}`;
    const newApt = {
      id: newId,
      patientId: currentUser.id,
      patientName: currentUser.name,
      patientNik: currentUser.nik || '3273010000000000',
      patientGender: currentUser.gender || 'Laki-laki',
      patientAge: '35 thn',
      status: 'Menunggu', // Menunggu, Dikonfirmasi, Sedang Berlangsung, Selesai, Dibatalkan
      roomUrl: `https://meet.medisync.id/room/${newId.toLowerCase()}`,
      ...appointmentData
    };

    setAppointments((prev) => [newApt, ...prev]);
    logAudit('CREATE', 'jadwal_konsultasi', newId, 'success', `Pasien ${currentUser.name} memesan janji temu ${newApt.type} dengan ${newApt.doctorName} untuk ${newApt.date} ${newApt.time}.`);
    showToast(`Janji temu ${newId} berhasil dibuat! Menunggu konfirmasi dokter.`, 'success');
    return newApt;
  };

  // Doctor confirms appointment
  const confirmAppointment = (id, newStatus = 'Dikonfirmasi') => {
    setAppointments((prev) =>
      prev.map((apt) => (apt.id === id ? { ...apt, status: newStatus } : apt))
    );
    logAudit('UPDATE', 'jadwal_konsultasi', id, 'info', `Dokter ${currentUser.name} mengonfirmasi jadwal janji temu ${id} menjadi "${newStatus}".`);
    showToast(`Jadwal ${id} berhasil diubah ke: ${newStatus}`, 'success');
  };

  // Update appointment status general
  const updateAppointmentStatus = (id, newStatus) => {
    setAppointments((prev) =>
      prev.map((apt) => (apt.id === id ? { ...apt, status: newStatus } : apt))
    );
    logAudit('UPDATE', 'jadwal_konsultasi', id, 'info', `Status janji temu ${id} diperbarui menjadi: "${newStatus}".`);
    showToast(`Status konsultasi ${id} diubah ke ${newStatus}`, 'info');
  };

  // Save new EMR & generate prescription if needed (Dokter)
  const saveEMR = (emrData) => {
    const newId = `EMR-2026-${String(emrs.length + 1).padStart(3, '0')}`;
    const now = new Date();
    const dateFormatted = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} WIB`;

    const newRecord = {
      id: newId,
      date: dateFormatted,
      doctorId: currentUser.id,
      doctorName: currentUser.name,
      doctorSip: currentUser.sip || '446/MED/2026',
      isDeleted: false,
      deletedAt: null,
      deletedBy: null,
      ...emrData
    };

    setEmrs((prev) => [newRecord, ...prev]);

    // Also mark related appointment as 'Selesai' if provided
    if (emrData.appointmentId) {
      updateAppointmentStatus(emrData.appointmentId, 'Selesai');
    }

    // Automatically send prescription order to Pharmacy if prescription text exists!
    if (emrData.prescription && emrData.prescription.trim().length > 0) {
      const rxId = `RX-2026-${String(prescriptions.length + 1).padStart(3, '0')}`;
      const newRx = {
        id: rxId,
        emrId: newId,
        appointmentId: emrData.appointmentId || 'APT-GEN',
        patientId: emrData.patientId || currentUser.id,
        patientName: emrData.patientName,
        doctorName: currentUser.name,
        date: dateFormatted,
        status: 'Menunggu Penyiapan',
        items: [
          { medicineName: emrData.prescription.split('\n')[0] || 'Resep Racikan Dokter', quantity: 'Sesuai Dosis', dosage: 'Sesuai instruksi dokter' }
        ],
        prescriptionText: emrData.prescription,
        notes: `Diagnosis: ${emrData.diagnosis}`,
        pharmacistNotes: 'Resep baru diterima dari ruang dokter.'
      };
      setPrescriptions((prev) => [newRx, ...prev]);
      logAudit('CREATE', 'resep_obat', rxId, 'success', `Resep digital ${rxId} diteruskan ke Instalasi Farmasi / Apoteker untuk pasien ${emrData.patientName}.`);
    }

    logAudit('CREATE', 'rekam_medis', newId, 'success', `Dokter ${currentUser.name} menerbitkan Rekam Medis ${newId} untuk pasien ${newRecord.patientName}. Diagnosis: ${newRecord.diagnosis}.`);
    showToast(`Rekam Medis ${newId} dan resep berhasil diterbitkan!`, 'success');
    return newRecord;
  };

  // Soft delete EMR (Keamanan Data)
  const softDeleteEMR = (emrId, reason = 'Koreksi rekam medis oleh staf klinis') => {
    const now = new Date();
    const timeString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} WIB`;

    setEmrs((prev) =>
      prev.map((item) => {
        if (item.id === emrId) {
          return {
            ...item,
            isDeleted: true,
            deletedAt: timeString,
            deletedBy: `${currentUser.name} (${reason})`
          };
        }
        return item;
      })
    );

    logAudit('DELETE', 'rekam_medis', emrId, 'danger', `Soft Delete dilakukan pada ${emrId} oleh ${currentUser.name}. Alasan: "${reason}". Data fisik tetap aman di database.`);
    showToast(`Rekam Medis ${emrId} berhasil di-soft delete (data tetap tersimpan aman di database).`, 'danger');
  };

  // Restore soft-deleted EMR
  const restoreEMR = (emrId) => {
    setEmrs((prev) =>
      prev.map((item) => {
        if (item.id === emrId) {
          return {
            ...item,
            isDeleted: false,
            deletedAt: null,
            deletedBy: null
          };
        }
        return item;
      })
    );

    logAudit('RESTORE', 'rekam_medis', emrId, 'success', `Rekam Medis ${emrId} dipulihkan kembali ke status aktif oleh ${currentUser.name}.`);
    showToast(`Rekam Medis ${emrId} berhasil dipulihkan!`, 'success');
  };

  // Pharmacist updates prescription status
  const updatePrescriptionStatus = (rxId, newStatus, pharmacistNotes = '') => {
    setPrescriptions((prev) =>
      prev.map((rx) => {
        if (rx.id === rxId) {
          return {
            ...rx,
            status: newStatus,
            pharmacistNotes: pharmacistNotes || `Status diperbarui menjadi ${newStatus} oleh ${currentUser.name}.`
          };
        }
        return rx;
      })
    );
    logAudit('UPDATE', 'resep_obat', rxId, 'info', `Apoteker ${currentUser.name} mengubah status resep ${rxId} menjadi: "${newStatus}".`);
    showToast(`Resep ${rxId} berhasil diperbarui: ${newStatus}`, 'success');
  };

  // Update medicine stock
  const updateMedicineStock = (medId, delta) => {
    setMedicines((prev) =>
      prev.map((m) => {
        if (m.id === medId) {
          const nextStock = Math.max(0, m.stock + delta);
          return { ...m, stock: nextStock };
        }
        return m;
      })
    );
    logAudit('UPDATE', 'obat_farmasi', medId, 'info', `Penyesuaian stok obat ${medId} oleh ${currentUser.name}.`);
    showToast('Stok obat berhasil diperbarui!', 'success');
  };

  // Add new User (Admin)
  const addUser = (newUser) => {
    const newId = `USR-${newUser.role.substring(0, 3).toUpperCase()}${Math.floor(10 + Math.random() * 90)}`;
    const userObj = {
      id: newId,
      status: 'Aktif',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
      ...newUser
    };
    setUsers((prev) => [...prev, userObj]);
    logAudit('CREATE', 'users_auth', newId, 'success', `Admin ${currentUser.name} menambahkan pengguna baru: ${userObj.name} [${userObj.role.toUpperCase()}].`);
    showToast(`Pengguna ${userObj.name} berhasil didaftarkan!`, 'success');
  };

  // Toggle user status
  const toggleUserStatus = (userId) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          const nextStatus = u.status === 'Aktif' ? 'Nonaktif' : 'Aktif';
          logAudit('UPDATE', 'users_auth', userId, 'warning', `Status akun ${u.name} diubah menjadi ${nextStatus}.`);
          showToast(`Status ${u.name} sekarang: ${nextStatus}`, 'info');
          return { ...u, status: nextStatus };
        }
        return u;
      })
    );
  };

  // Trigger Manual Backup (Aturan 3-2-1)
  const triggerManualBackup = () => {
    const now = new Date();
    const timeString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')} WIB`;
    const backupId = `BAK-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;

    const updatedConfig = {
      ...backupConfig,
      lastBackup: timeString,
      storageNodes: backupConfig.storageNodes.map((node) => ({
        ...node,
        status: node.copy.includes('Offsite') ? 'Terverifikasi (Aman)' : 'Sinkron (Tersimpan)',
        size: `${(24.8 + Math.random() * 0.4).toFixed(2)} MB`
      }))
    };

    setBackupConfig(updatedConfig);
    logAudit('BACKUP', 'backup_archive', backupId, 'success', `Manual Backup 3-2-1 dieksekusi: Volume Snapshot, Logical Dump, Base Backup + WAL, dan Offsite S3 AES-256.`);
    showToast(`Pencadangan Aturan 3-2-1 Sukses! Snapshot ID: ${backupId}`, 'success');

    // Downloadable snapshot
    const backupPayload = {
      system: 'TeleMed - Sistem Telemedicine Kelompok 4 (UIN Sunan Ampel Surabaya)',
      policy: '3-2-1 Backup & PITR Compliance Rule',
      timestamp: timeString,
      backupId,
      metadata: {
        totalPatients: users.filter((u) => u.role === 'pasien').length,
        totalDoctors: users.filter((u) => u.role === 'dokter').length,
        totalAppointments: appointments.length,
        totalEMRs: emrs.length,
        totalMedicines: medicines.length,
        totalPrescriptions: prescriptions.length,
        totalAuditLogs: auditLogs.length
      },
      data: { users, appointments, emrs, auditLogs, medicines, prescriptions }
    };

    const blob = new Blob([JSON.stringify(backupPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `telemed_backup_321_${backupId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Simulate PITR Recovery (Dokumen DRP Bab 5.6: 9 Langkah Pemulihan)
  const simulatePITRRecovery = (targetTime = '2026-10-19 13:44:00') => {
    logAudit('RECOVERY_STEP_1', 'system_recovery', 'INCIDENT-01', 'danger', 'Langkah 1: Deteksi DROP TABLE terdeteksi pada 13:45:00 WIB. Stopwatch RTO dimulai.');
    logAudit('RECOVERY_STEP_2', 'system_recovery', 'BACKEND_SVC', 'warning', 'Langkah 2: docker compose stop backend (Aplikasi dihentikan agar tidak ada data kotor).');
    logAudit('RECOVERY_STEP_3', 'system_recovery', 'PG_WAL', 'info', 'Langkah 3: Amankan WAL terakhir via SELECT pg_switch_wal().');
    logAudit('RECOVERY_STEP_4', 'system_recovery', 'PG_DATA', 'info', 'Langkah 4: Stop PostgreSQL dan simpan volume rusak ke /forensik/pgdata_rusak.tar.gz.');
    logAudit('RECOVERY_STEP_5', 'system_recovery', 'BASE_BACKUP', 'info', 'Langkah 5: Ekstrak base backup terbaru 01:00 WIB ke pgdata.');
    logAudit('RECOVERY_STEP_6', 'system_recovery', 'PITR_CONFIG', 'info', `Langkah 6: Atur recovery_target_time = '${targetTime}' dan buat recovery.signal.`);
    logAudit('RECOVERY_STEP_7', 'system_recovery', 'WAL_REPLAY', 'info', 'Langkah 7: Start db, Replay WAL archive hingga titik sebelum DROP TABLE tercapai.');
    logAudit('RECOVERY_STEP_8', 'system_recovery', 'VALIDATION', 'success', 'Langkah 8: Validasi baris database & integritas tabel users, patients, doctors, medical_records: 100% Cocok!');
    logAudit('RECOVERY_STEP_9', 'system_recovery', 'APP_START', 'success', 'Langkah 9: Backend & frontend dihidupkan kembali. RTO Aktual: 24 Menit (Di bawah target 30 Menit), RPO: 0 Data Hilang.');
    
    // Restore all soft deleted records to demo data sanity
    setEmrs(prev => prev.map(e => ({ ...e, isDeleted: false })));
    showToast(`Simulasi PITR Sukses! RTO: 24 Menit, RPO: 0 (Data berhasil dipulihkan ke ${targetTime})`, 'success');
  };

  // Reset to initial defaults
  const resetToFactoryDefault = () => {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    setUsers(INITIAL_USERS);
    setAppointments(INITIAL_APPOINTMENTS);
    setEmrs(INITIAL_EMRS);
    setAuditLogs(INITIAL_AUDIT_LOGS);
    setBackupConfig(BACKUP_CONFIG);
    setMedicines(INITIAL_MEDICINES);
    setPrescriptions(INITIAL_PRESCRIPTIONS);
    setCurrentUser(null);
    setCurrentPage('landing');
    showToast('Data sistem telah dikembalikan ke kondisi awal (belum login).', 'info');
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
        switchUser,
        switchRole,
        loginUser,
        registerPatient,
        resetPassword,
        logout,
        addUser,
        toggleUserStatus,

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
        updatePrescriptionStatus,
        updateMedicineStock,

        // Audit Logs & DRP Cloud
        auditLogs,
        logAudit,
        backupConfig,
        triggerManualBackup,
        simulatePITRRecovery,
        resetToFactoryDefault,

        // Toasts
        toasts,
        showToast
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
