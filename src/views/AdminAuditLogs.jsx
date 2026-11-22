import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import DashboardMetric from '../components/DashboardMetric';
import {
  ShieldCheck,
  Users,
  UserCheck,
  FileSpreadsheet,
  Database,
  Activity,
  ArrowRight,
  LayoutDashboard,
  Search,
  Filter,
  Download,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Eye,
  Trash2,
  Calendar,
  Stethoscope,
  RotateCcw,
  Clock,
  Sparkles,
  TrendingUp
} from 'lucide-react';

export default function AdminAuditLogs() {
  const {
    currentUser,
    users,
    emrs,
    deletedRecords,
    restoreDeletedRecord,
    appointments,
    deleteUser,
    addUser,
    toggleUserStatus,
    auditLogs,
    backupConfig,
    triggerManualBackup,
    exportAuditLogsCsv,
    showToast
  } = useApp();

  // Tabs: 'dashboard' | 'log-sistem' | 'kelola-dokter' | 'data-pasien' | 'backup-drp' | 'rekam-medis'
  const adminTabKey = `telemed_admin_tab_${currentUser?.id || 'unknown'}`;
  const [activeAdminTab, setActiveAdminTab] = useState(() => {
    const savedTab = sessionStorage.getItem(adminTabKey);
    return ['dashboard', 'log-sistem', 'kelola-dokter', 'data-pasien', 'backup-drp', 'rekam-medis'].includes(savedTab)
      ? savedTab
      : 'dashboard';
  });
  const [dashboardRange, setDashboardRange] = useState(7);

  useEffect(() => {
    sessionStorage.setItem(adminTabKey, activeAdminTab);
  }, [activeAdminTab, adminTabKey]);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');

  // User creation modal
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'dokter',
    nik: '',
    birthDate: '',
    gender: '',
    specialty: '',
    sip: '',
    hospital: '',
    phone: '',
    bloodType: '',
    allergies: '',
    address: ''
  });

  // Filter lists
  const doctors = users.filter((u) => u.role === 'dokter');
  const patients = users.filter((u) => u.role === 'pasien');
  const today = new Date();
  const todayKey = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');
  const consultationTrend = Array.from({ length: dashboardRange }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - dashboardRange + index + 1);
    const dateKey = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');
    return {
      dateKey,
      label: date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }),
      count: appointments.filter((appointment) => appointment.date === dateKey).length,
    };
  });
  const maxTrendCount = Math.max(1, ...consultationTrend.map((day) => day.count));
  const todayConsultations = appointments.filter((appointment) => appointment.date === todayKey);
  const ongoingConsultations = appointments.filter(
    (appointment) => ['Menunggu', 'Sedang Berlangsung'].includes(appointment.status)
  ).length;
  const activeEMRs = emrs.filter((record) => !record.isDeleted);
  const deletedTotal =
    (deletedRecords.medical_records?.length || 0) +
    (deletedRecords.consultations?.length || 0) +
    (deletedRecords.users?.length || 0);
  const recentAuditLogs = auditLogs.slice(0, 5);

  const requestDeletionReason = (label) => {
    if (!window.confirm(`Pindahkan ${label} ke data terhapus? Hanya admin yang dapat memulihkannya.`)) return null;
    const reason = window.prompt('Alasan penghapusan:', 'Permintaan administrator');
    return reason === null ? null : reason.trim() || 'Permintaan administrator';
  };

  const filteredLogs = auditLogs.filter((log) => {
    const matchesSearch =
      log.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.userId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.ipAddress.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.tableName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.dataId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.details.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesDate = !dateFilter || log.timestamp.includes(dateFilter);
    const matchesAction = actionFilter === 'ALL' || log.action === actionFilter;

    return matchesSearch && matchesDate && matchesAction;
  });

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!newUserForm.name || !newUserForm.email) {
      showToast('Harap isi nama dan email.', 'danger');
      return;
    }
    if (!newUserForm.password || newUserForm.password.length < 8) {
      showToast('Kata sandi awal minimal 8 karakter.', 'danger');
      return;
    }
    if (newUserForm.role === 'pasien') {
      const requiredPatientInfo = [newUserForm.gender, newUserForm.phone, newUserForm.bloodType, newUserForm.allergies, newUserForm.address];
      if (requiredPatientInfo.some((value) => !value?.trim())) {
        showToast('Lengkapi data pasien. Jika tidak ada, masukkan tanda - pada kolom tersebut.', 'danger');
        return;
      }
    }

    setIsSavingUser(true);
    const created = await addUser(newUserForm);
    setIsSavingUser(false);
    if (!created) return;

    setIsAddUserOpen(false);
    setNewUserForm({
      name: '',
      email: '',
      password: '',
      role: 'dokter',
      nik: '',
      birthDate: '',
      gender: '',
      specialty: '',
      sip: '',
      hospital: '',
      phone: '',
      bloodType: '',
      allergies: '',
      address: ''
    });
  };

  const exportLogsAsCSV = async () => {
    const params = {};
    if (searchQuery) params.search = searchQuery;
    if (dateFilter) params.from = dateFilter;
    if (actionFilter && actionFilter !== 'ALL') params.action = actionFilter;
    await exportAuditLogsCsv(params);
  };

  return (
    <div className="admin-dashboard" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Banner */}
      <div
        className="admin-dashboard-banner"
        style={{
          background: '#0F172A',
          borderRadius: '16px',
          border: '1px solid #1E293B',
          padding: '24px 28px',
          color: '#FFFFFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '20px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: '#4F46E5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <ShieldCheck size={28} color="#fff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#fff' }}>
                Administrator
              </h1>
            </div>
            <div style={{ fontSize: '0.85rem', color: '#94A3B8', marginTop: '4px' }}>
              <strong>{currentUser.name}</strong> · Kelola pengguna dan aktivitas sistem
            </div>
          </div>
        </div>

        {/* 5 Tabs Navigation */}
        <div
          className="admin-dashboard-tabs"
          style={{
            display: 'flex',
            background: '#1E293B',
            padding: '4px',
            borderRadius: '12px',
            gap: '4px',
            flexWrap: 'wrap'
          }}
        >
          <button
            onClick={() => setActiveAdminTab('dashboard')}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 600,
              background: activeAdminTab === 'dashboard' ? '#4F46E5' : 'transparent',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <LayoutDashboard size={16} />
            <span>Dashboard</span>
          </button>

          <button
            onClick={() => setActiveAdminTab('log-sistem')}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 600,
              background: activeAdminTab === 'log-sistem' ? '#4F46E5' : 'transparent',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <FileSpreadsheet size={16} />
            <span>Audit log</span>
          </button>

          <button
            onClick={() => setActiveAdminTab('kelola-dokter')}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 600,
              background: activeAdminTab === 'kelola-dokter' ? '#4F46E5' : 'transparent',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Stethoscope size={16} />
            <span>Dokter</span>
          </button>

          <button
            onClick={() => setActiveAdminTab('data-pasien')}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 600,
              background: activeAdminTab === 'data-pasien' ? '#4F46E5' : 'transparent',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Users size={16} />
            <span>Pasien</span>
          </button>

          <button
            onClick={() => setActiveAdminTab('backup-drp')}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 600,
              background: activeAdminTab === 'backup-drp' ? '#4F46E5' : 'transparent',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Database size={16} />
            <span>Sistem & backup</span>
          </button>

          <button
            onClick={() => setActiveAdminTab('rekam-medis')}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 600,
              background: activeAdminTab === 'rekam-medis' ? '#4F46E5' : 'transparent',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <FileSpreadsheet size={16} />
            <span>Data terhapus</span>
          </button>

        </div>
      </div>

      {activeAdminTab === 'dashboard' && (
        <div className="admin-overview">
          <div className="dashboard-metrics">
            <DashboardMetric
              icon={Users}
              label="Pasien terdaftar"
              value={patients.length}
              note="Buka pengelolaan pasien"
              color="#2563EB"
              onClick={() => setActiveAdminTab('data-pasien')}
            />
            <DashboardMetric
              icon={UserCheck}
              label="Dokter aktif"
              value={doctors.filter((doctor) => doctor.status === 'Aktif').length}
              note={`${doctors.length} dokter terdaftar`}
              color="#0F766E"
              onClick={() => setActiveAdminTab('kelola-dokter')}
            />
            <DashboardMetric
              icon={Activity}
              label="Konsultasi berjalan"
              value={ongoingConsultations}
              note={`${todayConsultations.length} terjadwal hari ini`}
              color="#7C3AED"
            />
            <DashboardMetric
              icon={FileSpreadsheet}
              label="Rekam medis aktif"
              value={activeEMRs.length}
              note="Data yang dapat diakses"
              color="#0891B2"
            />
            <DashboardMetric
              icon={Trash2}
              label="Item di data terhapus"
              value={deletedTotal}
              note="Khusus pemulihan admin"
              color="#DC2626"
              onClick={() => setActiveAdminTab('rekam-medis')}
            />
          </div>

          <div className="dashboard-columns">
            <section className="card dashboard-panel">
              <div className="card-header">
                <div>
                  <h2 className="card-title"><TrendingUp size={19} color="#4F46E5" /> Aktivitas konsultasi</h2>
                  <p className="dashboard-panel-note">Jumlah konsultasi terjadwal pada periode yang dipilih.</p>
                </div>
                <select
                  className="form-select dashboard-range-select"
                  aria-label="Periode grafik konsultasi"
                  value={dashboardRange}
                  onChange={(event) => setDashboardRange(Number(event.target.value))}
                >
                  <option value={7}>7 hari</option>
                  <option value={14}>14 hari</option>
                  <option value={30}>30 hari</option>
                </select>
              </div>
              <div
                className="dashboard-trend-chart"
                role="img"
                aria-label={`Grafik ${dashboardRange} hari konsultasi`}
                style={{ gridTemplateColumns: `repeat(${dashboardRange}, minmax(0, 1fr))` }}
              >
                {consultationTrend.map((day, index) => {
                  const showLabel = dashboardRange === 7 ||
                    index % Math.ceil(dashboardRange / 7) === 0 ||
                    index === dashboardRange - 1;
                  const barHeight = day.count
                    ? Math.max(10, (day.count / maxTrendCount) * 100)
                    : 4;
                  return (
                    <div className="dashboard-trend-column" key={day.dateKey} title={`${day.label}: ${day.count} konsultasi`}>
                      <span className="dashboard-trend-value">{day.count || ''}</span>
                      <div className="dashboard-trend-track">
                        <div className="dashboard-trend-bar" style={{ height: `${barHeight}%` }} />
                      </div>
                      <span className="dashboard-trend-label">{showLabel ? day.label : ''}</span>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="card dashboard-panel">
              <div className="card-header">
                <div>
                  <h2 className="card-title"><Activity size={19} color="#0F766E" /> Status konsultasi</h2>
                  <p className="dashboard-panel-note">{appointments.length} konsultasi aktif dalam sistem.</p>
                </div>
              </div>
              <div className="dashboard-status-list">
                {['Menunggu', 'Sedang Berlangsung', 'Selesai', 'Dibatalkan'].map((status) => {
                  const count = appointments.filter((appointment) => appointment.status === status).length;
                  const percentage = appointments.length ? (count / appointments.length) * 100 : 0;
                  return (
                    <div className="dashboard-status-row" key={status}>
                      <div className="dashboard-status-label"><span>{status}</span><strong>{count}</strong></div>
                      <div className="dashboard-status-track"><div style={{ width: `${percentage}%` }} /></div>
                    </div>
                  );
                })}
              </div>
              <button type="button" className="btn btn-outline btn-sm dashboard-panel-action" onClick={() => setActiveAdminTab('rekam-medis')}>
                Buka data terhapus <ArrowRight size={15} />
              </button>
            </section>
          </div>

          <div className="dashboard-columns">
            <section className="card dashboard-panel">
              <div className="card-header">
                <div>
                  <h2 className="card-title"><FileSpreadsheet size={19} color="#2563EB" /> Aktivitas terbaru</h2>
                  <p className="dashboard-panel-note">Perubahan terbaru yang tercatat pada audit log.</p>
                </div>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setActiveAdminTab('log-sistem')}>
                  Semua audit log
                </button>
              </div>
              {recentAuditLogs.length === 0 ? (
                <p className="dashboard-empty">Belum ada aktivitas tercatat.</p>
              ) : (
                <div className="dashboard-activity-list">
                  {recentAuditLogs.map((log) => (
                    <div className="dashboard-activity-item" key={log.id}>
                      <span className={`dashboard-activity-dot ${log.action === 'DELETE' ? 'is-danger' : ''}`} />
                      <div className="dashboard-activity-copy">
                        <strong>{log.action} · {log.tableName}</strong>
                        <span>{log.userName} · {log.timestamp}</span>
                      </div>
                      <small>#{log.dataId}</small>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="card dashboard-panel dashboard-backup-panel">
              <div className="card-header">
                <div>
                  <h2 className="card-title"><Database size={19} color="#7C3AED" /> Kesiapan sistem</h2>
                  <p className="dashboard-panel-note">Ringkasan pencadangan dan pemulihan.</p>
                </div>
              </div>
              <div className="dashboard-backup-status">
                <span className="dashboard-backup-check"><CheckCircle2 size={18} /></span>
                <div><strong>{backupConfig.policyName}</strong><span>Target RTO {backupConfig.rtoTarget} · RPO {backupConfig.rpoTarget}</span></div>
              </div>
              <p className="dashboard-backup-date">Pencadangan terakhir: {backupConfig.lastBackup}</p>
              <button type="button" className="btn btn-outline btn-sm dashboard-panel-action" onClick={() => setActiveAdminTab('backup-drp')}>
                Buka sistem & backup <ArrowRight size={15} />
              </button>
            </section>
          </div>
        </div>
      )}

      {/* TAB 1: LOG AUDIT SISTEM */}
      {activeAdminTab === 'log-sistem' && (
        <div className="card">
          <div className="card-header" style={{ flexWrap: 'wrap', gap: '14px' }}>
            <div>
              <h2 className="card-title">
                <FileSpreadsheet size={20} color="#1D4ED8" />
                Aktivitas sistem
              </h2>
              <p style={{ fontSize: '0.82rem', color: '#64748B', marginTop: '2px' }}>
                Setiap aksi dicatat otomatis: timestamp, IP address, user_id, action, table_name, dan record_id
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-outline btn-sm" onClick={exportLogsAsCSV}>
                <Download size={15} /> Export CSV
              </button>
            </div>
          </div>

          {/* Filter Bar */}
          <div
            style={{
              display: 'flex',
              gap: '12px',
              padding: '16px 20px',
              background: '#F8FAFC',
              borderBottom: '1px solid #E2E8F0',
              flexWrap: 'wrap',
              alignItems: 'center'
            }}
          >
            <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '11px', color: '#64748B' }} />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '36px' }}
                placeholder="Cari user, IP, action, tabel..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div style={{ width: '170px' }}>
              <input
                type="date"
                className="form-input"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
              />
            </div>

            <div style={{ width: '160px' }}>
              <select
                className="form-select"
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
              >
                <option value="ALL">Semua Aksi</option>
                <option value="CREATE">CREATE</option>
                <option value="UPDATE">UPDATE</option>
                <option value="DELETE">DELETE</option>
                <option value="LOGIN">LOGIN</option>
                <option value="BACKUP">BACKUP</option>
              </select>
            </div>

            {(searchQuery || dateFilter || actionFilter !== 'ALL') && (
              <button
                className="btn btn-outline btn-sm"
                onClick={() => {
                  setSearchQuery('');
                  setDateFilter('');
                  setActionFilter('ALL');
                }}
              >
                Reset Filter
              </button>
            )}
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Waktu (Timestamp)</th>
                  <th>IP Address</th>
                  <th>Pengguna (User ID)</th>
                  <th>Aksi (Action)</th>
                  <th>Tabel Database</th>
                  <th>ID Record</th>
                  <th>Rincian Aktivitas</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: '#64748B' }}>
                      Tidak ada audit log yang sesuai dengan filter.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => {
                    const isDeleteAction = log.action === 'DELETE' || log.severity === 'danger';
                    return (
                      <tr
                        key={log.id}
                        style={{
                          backgroundColor: isDeleteAction ? '#FEF2F2' : 'inherit'
                        }}
                      >
                        <td style={{ whiteSpace: 'nowrap', fontSize: '0.82rem', fontFamily: 'monospace' }}>
                          {log.timestamp}
                        </td>
                        <td style={{ whiteSpace: 'nowrap', fontSize: '0.82rem', color: '#475569', fontFamily: 'monospace' }}>
                          {log.ipAddress}
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{log.userName}</div>
                          <div style={{ fontSize: '0.72rem', color: '#64748B', fontFamily: 'monospace' }}>{log.userId}</div>
                        </td>
                        <td>
                          {isDeleteAction ? (
                            <span
                              style={{
                                backgroundColor: '#FEE2E2',
                                color: '#DC2626',
                                border: '1px solid #FECACA',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontWeight: 700,
                                fontSize: '0.75rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              <AlertTriangle size={12} /> {log.action}
                            </span>
                          ) : log.action === 'CREATE' ? (
                            <span className="badge badge-accent">CREATE</span>
                          ) : log.action === 'UPDATE' ? (
                            <span className="badge badge-primary">UPDATE</span>
                          ) : (
                            <span className="badge" style={{ background: '#F1F5F9', color: '#334155' }}>{log.action}</span>
                          )}
                        </td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: '#0F766E' }}>
                          {log.tableName}
                        </td>
                        <td style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.82rem' }}>
                          {log.dataId}
                        </td>
                        <td style={{ fontSize: '0.82rem', color: '#334155', maxWidth: '300px' }}>
                          {log.details}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: KELOLA DOKTER */}
      {activeAdminTab === 'kelola-dokter' && (
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">
                <Stethoscope size={20} color="#0F766E" />
                Manajemen Dokter Spesialis
              </h2>
              <p style={{ fontSize: '0.82rem', color: '#64748B', marginTop: '2px' }}>
                Daftar dokter terdaftar, nomor Surat Izin Praktik (SIP/STR), rumah sakit mitra, dan status aktif.
              </p>
            </div>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                setNewUserForm(prev => ({ ...prev, role: 'dokter' }));
                setIsAddUserOpen(true);
              }}
            >
              <Plus size={16} /> Tambah Dokter Baru
            </button>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Dokter</th>
                  <th>Spesialisasi</th>
                  <th>Nomor SIP / STR</th>
                  <th>Rumah Sakit / Klinik Mitra</th>
                  <th>Status Akun</th>
                  <th style={{ textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {doctors.map((doc) => (
                  <tr key={doc.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <img
                          src={doc.avatar}
                          alt={doc.name}
                          style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover' }}
                        />
                        <div>
                          <div style={{ fontWeight: 700 }}>{doc.name}</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{doc.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-accent">{doc.specialty || 'Dokter Umum'}</span>
                    </td>
                    <td>
                      <code>{doc.sip || '-'}</code>
                    </td>
                    <td>{doc.hospital || '-'}</td>
                    <td>
                      <span className={`badge ${doc.status === 'Aktif' ? 'badge-selesai' : 'badge-danger'}`}>
                        {doc.status === 'Aktif' ? '● Aktif' : '○ Nonaktif'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => toggleUserStatus(doc.userId || doc.id)}
                        >
                          {doc.status === 'Aktif' ? 'Nonaktifkan' : 'Aktifkan'}
                        </button>
                        <button
                          className="btn btn-danger-outline btn-sm"
                          onClick={async () => {
                            const reason = requestDeletionReason(`akun dokter ${doc.name}`);
                            if (reason !== null) await deleteUser(doc.userId, reason);
                          }}
                          title="Hapus sementara akun dokter"
                        >
                          <Trash2 size={14} /> Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: DATA PASIEN */}
      {activeAdminTab === 'data-pasien' && (
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">
                <Users size={20} color="#1D4ED8" />
                Data Pasien Terdaftar
              </h2>
              <p style={{ fontSize: '0.82rem', color: '#64748B', marginTop: '2px' }}>
                Informasi identitas kependudukan (NIK), kontak, alamat, golongan darah, dan status pasien.
              </p>
            </div>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                setNewUserForm(prev => ({ ...prev, role: 'pasien' }));
                setIsAddUserOpen(true);
              }}
            >
              <Plus size={16} /> Daftarkan Pasien Baru
            </button>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Pasien</th>
                  <th>Nomor NIK (KTP)</th>
                  <th>Jenis Kelamin</th>
                  <th>Telepon / WA</th>
                  <th>Golongan Darah & Alergi</th>
                  <th>Alamat Domisili</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {patients.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <img
                          src={p.avatar}
                          alt={p.name}
                          style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover' }}
                        />
                        <div>
                          <div style={{ fontWeight: 700 }}>{p.name}</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{p.email}</div>
                        </div>
                      </div>
                    </td>
                    <td><code>{p.nik || '-'}</code></td>
                    <td>{p.gender || '-'}</td>
                    <td>{p.phone || '-'}</td>
                    <td>
                      <div><strong>{p.bloodType || '-'}</strong></div>
                      <small style={{ color: p.allergies && p.allergies !== '-' && p.allergies !== 'Tidak Ada' ? '#DC2626' : '#64748B' }}>
                        Alergi: {p.allergies || '-'}
                      </small>
                    </td>
                    <td style={{ maxWidth: '200px', fontSize: '0.82rem' }}>{p.address || '-'}</td>
                    <td>
                      <span className={`badge ${p.status === 'Aktif' ? 'badge-selesai' : 'badge-danger'}`}>
                        {p.status === 'Aktif' ? '● Aktif' : '○ Nonaktif'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => toggleUserStatus(p.userId || p.id)}
                        >
                          {p.status === 'Aktif' ? 'Nonaktifkan' : 'Aktifkan'}
                        </button>
                        <button
                          className="btn btn-danger-outline btn-sm"
                          onClick={async () => {
                            const reason = requestDeletionReason(`akun pasien ${p.name}`);
                            if (reason !== null) await deleteUser(p.userId, reason);
                          }}
                          title="Hapus sementara akun pasien"
                        >
                          <Trash2 size={14} /> Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeAdminTab === 'rekam-medis' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <section className="card">
            <div className="card-header">
              <div>
                <h2 className="card-title"><Trash2 size={20} color="#DC2626" /> Rekam medis terhapus</h2>
                <p style={{ fontSize: '0.82rem', color: '#64748B', marginTop: 4 }}>Hanya admin yang dapat memulihkan rekam medis.</p>
              </div>
            </div>
            <div className="table-container">
              <table className="data-table">
                <thead><tr><th>ID</th><th>Pasien</th><th>Diagnosis</th><th>Dokter</th><th>Dihapus pada</th><th>Aksi</th></tr></thead>
                <tbody>
                  {(deletedRecords.medical_records || []).map((record) => (
                    <tr key={record.id}>
                      <td>{record.id}</td><td>{record.patient_name}</td><td>{record.diagnosis || '-'}</td><td>{record.doctor_name}</td><td>{record.deleted_at || '-'}</td>
                      <td><button className="btn btn-primary btn-sm" onClick={() => restoreDeletedRecord('medical-record', record.id)}><RotateCcw size={14} /> Pulihkan</button></td>
                    </tr>
                  ))}
                  {(deletedRecords.medical_records || []).length === 0 && <tr><td colSpan="6" style={{ textAlign: 'center', color: '#64748B', padding: 20 }}>Tidak ada rekam medis terhapus.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card">
            <div className="card-header"><h2 className="card-title"><Calendar size={20} color="#DC2626" /> Konsultasi terhapus</h2></div>
            <div className="table-container">
              <table className="data-table">
                <thead><tr><th>ID</th><th>Jadwal</th><th>Pasien</th><th>Dokter</th><th>Alasan</th><th>Aksi</th></tr></thead>
                <tbody>
                  {(deletedRecords.consultations || []).map((record) => (
                    <tr key={record.id}>
                      <td>{record.id}</td><td>{record.scheduled_at}</td><td>{record.patient_name}</td><td>{record.doctor_name}</td><td>{record.delete_reason || '-'}</td>
                      <td><button className="btn btn-primary btn-sm" onClick={() => restoreDeletedRecord('consultation', record.id)}><RotateCcw size={14} /> Pulihkan</button></td>
                    </tr>
                  ))}
                  {(deletedRecords.consultations || []).length === 0 && <tr><td colSpan="6" style={{ textAlign: 'center', color: '#64748B', padding: 20 }}>Tidak ada konsultasi terhapus.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card">
            <div className="card-header"><h2 className="card-title"><Users size={20} color="#DC2626" /> Akun pasien dan dokter terhapus</h2></div>
            <div className="table-container">
              <table className="data-table">
                <thead><tr><th>ID</th><th>Nama</th><th>Email</th><th>Role</th><th>Alasan</th><th>Aksi</th></tr></thead>
                <tbody>
                  {(deletedRecords.users || []).map((record) => (
                    <tr key={record.id}>
                      <td>{record.id}</td><td>{record.full_name}</td><td>{record.username}</td><td>{record.role}</td><td>{record.delete_reason || '-'}</td>
                      <td><button className="btn btn-primary btn-sm" onClick={() => restoreDeletedRecord('user', record.id)}><RotateCcw size={14} /> Pulihkan</button></td>
                    </tr>
                  ))}
                  {(deletedRecords.users || []).length === 0 && <tr><td colSpan="6" style={{ textAlign: 'center', color: '#64748B', padding: 20 }}>Tidak ada akun terhapus.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* TAB 4: BACKUP & DISASTER RECOVERY */}
      {activeAdminTab === 'backup-drp' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ background: '#FFFFFF', borderRadius: '16px', padding: '24px', color: '#0F172A', border: '1px solid #E2E8F0' }}>
            <span className="badge badge-accent" style={{ marginBottom: '8px' }}>Latihan restore database penuh</span>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Pemulihan diuji pada database terisolasi</h3>
            <p style={{ color: '#475569', fontSize: '0.9rem', maxWidth: '900px', marginTop: '8px' }}>
              Jalankan <code> .\dr_test.ps1</code> dari root project. Skrip membuat dump PostgreSQL penuh, merestorenya ke database latihan pada service PostgreSQL yang sama, lalu membandingkan semua tabel dan jumlah baris. Database utama tidak dihapus.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginTop: '18px' }}>
              <div><strong>RTO latihan:</strong> target maksimal 5 menit, ukur hasil aktual.</div>
              <div><strong>RPO dump terjadwal:</strong> target maksimal 6 jam.</div>
              <div><strong>RPO drill:</strong> 0 relatif terhadap dump yang baru dibuat.</div>
              <div><strong>Batas:</strong> bukan uji host mati, failover, atau PITR WAL.</div>
            </div>
          </div>

          {/* Backup schedule and execution history */}
          <div className="card">
            <div className="card-header">
              <div>
                <h2 className="card-title">
                  <Database size={20} color="#0F766E" />
                  Jadwal & Riwayat Backup
                </h2>
                <p style={{ fontSize: '0.82rem', color: '#64748B', marginTop: '2px' }}>
                  Dump logis tiap 6 jam, base backup harian, dan WAL diarsipkan. Folder ./offsite berada pada host yang sama, jadi tidak melindungi dari kerusakan host.
                </p>
              </div>

              <button className="btn btn-primary" onClick={triggerManualBackup}>
                <RefreshCw size={16} />
                <span>Picu Backup Manual Sekarang</span>
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '24px' }}>
              {[
                ['Data utama', 'Docker volume pgdata; melindungi dari container terganti, bukan host rusak.'],
                ['Dump logis', 'pg_dump -Fc tiap 6 jam ke volume Docker backups.'],
                ['Base backup dan WAL', 'Base backup harian; WAL diarsipkan, tetapi PITR belum diuji.'],
                ['Salinan terenkripsi', './offsite di host yang sama; bukan backup 3-2-1 lintas lokasi.'],
                ['File MinIO', 'Volume minio_data terpisah; belum termasuk dalam backup database.']
              ].map(([title, detail]) => (
                <div key={title} style={{ border: '1px solid #E2E8F0', borderRadius: '10px', padding: '14px', background: '#FFFFFF' }}>
                  <strong style={{ color: '#0F172A' }}>{title}</strong>
                  <p style={{ margin: '6px 0 0', color: '#64748B', fontSize: '0.82rem' }}>{detail}</p>
                </div>
              ))}
            </div>

            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
              <h4 style={{ margin: '0 0 12px', fontSize: '0.95rem', fontWeight: 700 }}>Target dan batas pemulihan</h4>
              <p style={{ margin: 0, color: '#475569', fontSize: '0.85rem', lineHeight: 1.7 }}>
                RTO latihan maksimal 5 menit dan harus diukur. RPO dump terjadwal ditargetkan maksimal 6 jam; RPO 0 hanya relatif terhadap dump yang baru dibuat dalam restore drill. WAL sudah diarsipkan, tetapi PITR belum diuji. Salinan ./offsite ada pada host yang sama.
              </p>
            </div>

            {/* Riwayat backup dan batas implementasi */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', alignItems: 'start' }}>
              <div style={{ border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden', background: '#FFFFFF' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#0F172A' }}>
                    Riwayat Backup Database
                  </h4>
                  <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                    Job backup yang tercatat pada database
                  </span>
                </div>
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Nama Arsip</th>
                        <th>Jenis</th>
                        <th>Status</th>
                        <th>Waktu Dibuat</th>
                        <th>Pemicu</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(backupConfig.recentRuns || []).length === 0 ? (
                        <tr>
                          <td colSpan="5" style={{ textAlign: 'center', padding: '24px', color: '#64748B' }}>
                            Belum ada job backup tercatat. Tunggu jadwal backup atau picu dump manual.
                          </td>
                        </tr>
                      ) : (
                        (backupConfig.recentRuns || []).map((run, idx) => (
                          <tr key={run.id || idx}>
                            <td>
                              <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.82rem', color: '#0F172A' }}>
                                {run.file_name}
                              </span>
                            </td>
                            <td>
                              <span className="badge badge-accent" style={{ textTransform: 'uppercase', fontSize: '0.7rem' }}>
                                {run.kind || 'dump'}
                              </span>
                            </td>
                            <td>
                              <span className={`badge ${run.status === 'failed' ? 'badge-danger' : 'badge-selesai'}`}>
                                {run.status}
                              </span>
                            </td>
                            <td style={{ fontSize: '0.78rem', color: '#475569' }}>
                              {run.started_at ? String(run.started_at).slice(0, 19).replace('T', ' ') + ' WIB' : '-'}
                            </td>
                            <td style={{ fontSize: '0.78rem', color: '#64748B' }}>
                              {run.triggered_by || 'system'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{ border: '1px solid #E2E8F0', borderRadius: '12px', padding: '18px', background: '#FFFFFF' }}>
                <h4 style={{ margin: '0 0 14px 0', fontSize: '0.95rem', fontWeight: 700, color: '#0F172A' }}>
                  Batas Pemulihan
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.8rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #F1F5F9' }}>
                    <span style={{ color: '#64748B' }}>Metode dump</span>
                    <strong style={{ color: '#0F172A' }}>PostgreSQL custom (-Fc)</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #F1F5F9' }}>
                    <span style={{ color: '#64748B' }}>Jadwal dump</span>
                    <strong style={{ color: '#0F172A' }}>Tiap 6 jam</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #F1F5F9' }}>
                    <span style={{ color: '#64748B' }}>Target RTO drill</span>
                    <strong style={{ color: '#0F172A' }}>≤ 5 menit; ukur aktual</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #F1F5F9' }}>
                    <span style={{ color: '#64748B' }}>Target RPO dump</span>
                    <strong style={{ color: '#0F172A' }}>≤ 6 jam</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #F1F5F9' }}>
                    <span style={{ color: '#64748B' }}>PITR dari WAL</span>
                    <strong style={{ color: '#B45309' }}>Belum diuji</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B' }}>Offsite lintas host</span>
                    <strong style={{ color: '#B45309' }}>Belum dikonfigurasi</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {isAddUserOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>
                {newUserForm.role === 'dokter' ? 'Tambah Dokter Baru' : 'Daftarkan Pasien Baru'}
              </h3>
              <button
                onClick={() => setIsAddUserOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUser}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Role Pengguna</label>
                  <select
                    className="form-select"
                    value={newUserForm.role}
                    onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value })}
                  >
                    <option value="dokter">Dokter</option>
                    <option value="pasien">Pasien</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Nama Lengkap</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newUserForm.name}
                    onChange={(e) => setNewUserForm({ ...newUserForm, name: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    className="form-input"
                    value={newUserForm.email}
                    onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Kata Sandi Awal</label>
                  <input
                    type="password"
                    className="form-input"
                    value={newUserForm.password}
                    onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                    minLength={8}
                    autoComplete="new-password"
                    required
                  />
                  <small className="form-hint">Minimal 8 karakter. Sampaikan kata sandi ini dengan aman kepada pengguna.</small>
                </div>

                {newUserForm.role === 'dokter' ? (
                  <>
                    <div className="form-group">
                      <label className="form-label">Spesialisasi</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Contoh: Spesialis Penyakit Dalam"
                        value={newUserForm.specialty}
                        onChange={(e) => setNewUserForm({ ...newUserForm, specialty: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Nomor Surat Izin Praktik (SIP / STR)</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Contoh: 446/123/SIP/2026"
                        value={newUserForm.sip}
                        onChange={(e) => setNewUserForm({ ...newUserForm, sip: e.target.value })}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="form-group">
                      <label className="form-label">Nomor Induk Kependudukan (NIK)</label>
                      <input
                        type="text"
                        className="form-input"
                        value={newUserForm.nik}
                        onChange={(e) => setNewUserForm({ ...newUserForm, nik: e.target.value })}
                        maxLength={16}
                        inputMode="numeric"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Tanggal Lahir</label>
                      <input
                        type="date"
                        className="form-input"
                        value={newUserForm.birthDate}
                        onChange={(e) => setNewUserForm({ ...newUserForm, birthDate: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Jenis Kelamin</label>
                      <select
                        className="form-select"
                        value={newUserForm.gender}
                        onChange={(e) => setNewUserForm({ ...newUserForm, gender: e.target.value })}
                        required
                      >
                        <option value="">Pilih jenis kelamin</option>
                        <option value="L">Laki-laki</option>
                        <option value="P">Perempuan</option>
                        <option value="-">- (Tidak dicantumkan)</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Telepon / WhatsApp</label>
                      <input
                        type="tel"
                        className="form-input"
                        placeholder="Nomor telepon, atau - jika tidak ada"
                        value={newUserForm.phone}
                        onChange={(e) => setNewUserForm({ ...newUserForm, phone: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Golongan Darah</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Contoh: O+, atau - jika tidak diketahui"
                        value={newUserForm.bloodType}
                        onChange={(e) => setNewUserForm({ ...newUserForm, bloodType: e.target.value })}
                        maxLength={3}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Alergi</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Tuliskan alergi, atau - jika tidak ada/belum diketahui"
                        value={newUserForm.allergies}
                        onChange={(e) => setNewUserForm({ ...newUserForm, allergies: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Alamat Domisili</label>
                      <textarea
                        className="form-textarea"
                        placeholder="Masukkan alamat, atau - jika tidak ada"
                        value={newUserForm.address}
                        onChange={(e) => setNewUserForm({ ...newUserForm, address: e.target.value })}
                        rows={2}
                        required
                      />
                    </div>
                    <small className="form-hint">Jenis kelamin, telepon, golongan darah, alergi, dan alamat wajib diisi. Ketik atau pilih - jika datanya tidak ada.</small>
                  </>
                )}
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setIsAddUserOpen(false)}
                >
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSavingUser}>
                  {isSavingUser ? 'Menyimpan...' : 'Simpan Akun'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
