import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  INITIAL_USERS, 
  INITIAL_APPOINTMENTS, 
  INITIAL_EMRS, 
  INITIAL_AUDIT_LOGS, 
  BACKUP_CONFIG 
} from '../data/mockData';

const AppContext = createContext();

const LOCAL_STORAGE_KEY = 'medisync_state_v1';

export function AppProvider({ children }) {
  // Load initial state from LocalStorage if available
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentUser, setCurrentUser] = useState(INITIAL_USERS[0]); // Default: Pasien Budi Santoso
  const [users, setUsers] = useState(INITIAL_USERS);
  const [appointments, setAppointments] = useState(INITIAL_APPOINTMENTS);
  const [emrs, setEmrs] = useState(INITIAL_EMRS);
  const [auditLogs, setAuditLogs] = useState(INITIAL_AUDIT_LOGS);
  const [backupConfig, setBackupConfig] = useState(BACKUP_CONFIG);
  
  // Modal states
  const [teleconsultationSession, setTeleconsultationSession] = useState(null); // appointment object when in call
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
        if (parsed.currentUserId) {
          const u = parsed.users?.find(x => x.id === parsed.currentUserId) || INITIAL_USERS[0];
          setCurrentUser(u);
        }
      }
    } catch (err) {
      console.warn('Error reading localStorage:', err);
    }
    setIsLoaded(true);
  }, []);

  // Save to localStorage whenever core state updates
  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({
        users,
        appointments,
        emrs,
        auditLogs,
        backupConfig,
        currentUserId: currentUser?.id
      }));
    } catch (err) {
      console.warn('Error writing to localStorage:', err);
    }
  }, [users, appointments, emrs, auditLogs, backupConfig, currentUser, isLoaded]);

  // Toast dispatch
  const showToast = (message, type = 'info') => {
    const id = Date.now() + Math.random().toString(36).substring(2, 5);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  // Real-time IP address generator (simulated client IP based on role)
  const getSimulatedIp = () => {
    if (currentUser.role === 'admin') return '192.168.1.45 (Klinik Admin Net)';
    if (currentUser.role === 'dokter') return '192.168.1.88 (Ruang Poli Dokter)';
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

  // Switch current user / role
  const switchUser = (userId) => {
    const target = users.find((u) => u.id === userId);
    if (target) {
      setCurrentUser(target);
      logAudit('LOGIN', 'users_auth', target.id, 'info', `Beralih peran / login sebagai ${target.name} [Role: ${target.role.toUpperCase()}].`);
      showToast(`Beralih ke akun: ${target.name} (${target.role.toUpperCase()})`, 'info');
    }
  };

  // Quick role switcher
  const switchRole = (role) => {
    const target = users.find((u) => u.role === role);
    if (target) {
      switchUser(target.id);
    }
  };

  // Add new appointment
  const addAppointment = (appointmentData) => {
    const newId = `APT-${Math.floor(104 + Math.random() * 900)}`;
    const newApt = {
      id: newId,
      patientId: currentUser.id,
      patientName: currentUser.name,
      patientNik: currentUser.nik || '3273010000000000',
      patientGender: currentUser.gender || 'Laki-laki',
      patientAge: '35 thn',
      status: 'Menunggu',
      roomUrl: `https://meet.medisync.id/room/${newId.toLowerCase()}`,
      ...appointmentData
    };

    setAppointments((prev) => [newApt, ...prev]);
    logAudit('CREATE', 'jadwal_konsultasi', newId, 'success', `Pasien ${currentUser.name} memesan janji temu ${newApt.type} dengan ${newApt.doctorName} untuk ${newApt.date} ${newApt.time}.`);
    showToast(`Janji temu ${newId} berhasil dibuat!`, 'success');
    return newApt;
  };

  // Update appointment status
  const updateAppointmentStatus = (id, newStatus) => {
    setAppointments((prev) =>
      prev.map((apt) => (apt.id === id ? { ...apt, status: newStatus } : apt))
    );
    logAudit('UPDATE', 'jadwal_konsultasi', id, 'info', `Status janji temu ${id} diperbarui menjadi: "${newStatus}".`);
    showToast(`Status konsultasi ${id} diubah ke ${newStatus}`, 'info');
  };

  // Save new EMR (Dokter)
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

    logAudit('CREATE', 'rekam_medis', newId, 'success', `Dokter ${currentUser.name} menerbitkan Rekam Medis ${newId} untuk pasien ${newRecord.patientName}. Diagnosis: ${newRecord.diagnosis}.`);
    showToast(`Rekam Medis ${newId} berhasil disimpan!`, 'success');
    return newRecord;
  };

  // Soft delete EMR (Keamanan Data: Sesuai Dokumen PRD Halaman 1 & 2)
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

    // Subtle red accent in audit log table as required by PRD!
    logAudit('DELETE', 'rekam_medis', emrId, 'danger', `Soft Delete dilakukan pada ${emrId} oleh ${currentUser.name}. Alasan: "${reason}". Data fisik tetap aman di database.`);
    showToast(`Rekam Medis ${emrId} berhasil di-soft delete (data tetap tersimpan aman di sistem).`, 'danger');
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

  // Update User Profile
  const updateUserProfile = (updatedProfile) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === updatedProfile.id ? { ...u, ...updatedProfile } : u))
    );
    if (currentUser.id === updatedProfile.id) {
      setCurrentUser((prev) => ({ ...prev, ...updatedProfile }));
    }
    logAudit('UPDATE', 'pasien', updatedProfile.id, 'info', `Profil pengguna ${updatedProfile.name} diperbarui.`);
    showToast('Profil berhasil disimpan!', 'success');
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
    logAudit('BACKUP', 'backup_archive', backupId, 'success', `Manual Backup 3-2-1 selesai dieksekusi. Snapshot disimpan pada NVMe Local SSD, NAS Lokal, dan S3 Offsite.`);
    showToast(`Pencadangan Aturan 3-2-1 Sukses! Snapshot ID: ${backupId}`, 'success');

    // Create a downloadable backup JSON snapshot
    const backupPayload = {
      system: 'MediSync Telemedicine Platform v1.0',
      policy: '3-2-1 Backup Compliance Rule',
      timestamp: timeString,
      backupId,
      metadata: {
        totalPatients: users.filter((u) => u.role === 'pasien').length,
        totalDoctors: users.filter((u) => u.role === 'dokter').length,
        totalAppointments: appointments.length,
        totalEMRs: emrs.length,
        totalAuditLogs: auditLogs.length
      },
      data: {
        users,
        appointments,
        emrs,
        auditLogs
      }
    };

    const blob = new Blob([JSON.stringify(backupPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `medisync_backup_321_${backupId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Reset database to initial defaults
  const resetToFactoryDefault = () => {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    setUsers(INITIAL_USERS);
    setAppointments(INITIAL_APPOINTMENTS);
    setEmrs(INITIAL_EMRS);
    setAuditLogs(INITIAL_AUDIT_LOGS);
    setBackupConfig(BACKUP_CONFIG);
    setCurrentUser(INITIAL_USERS[0]);
    showToast('Data sistem telah dikembalikan ke kondisi awal (PRD Default).', 'info');
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        users,
        switchUser,
        switchRole,
        updateUserProfile,
        addUser,
        toggleUserStatus,
        appointments,
        addAppointment,
        updateAppointmentStatus,
        emrs,
        saveEMR,
        softDeleteEMR,
        restoreEMR,
        auditLogs,
        logAudit,
        backupConfig,
        triggerManualBackup,
        resetToFactoryDefault,
        teleconsultationSession,
        setTeleconsultationSession,
        isBookingOpen,
        setIsBookingOpen,
        viewingEMR,
        setViewingEMR,
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
