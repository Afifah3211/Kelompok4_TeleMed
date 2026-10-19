import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  ShieldCheck, 
  Users, 
  FileSpreadsheet, 
  Database, 
  Search, 
  Filter, 
  Download, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  Plus, 
  Lock, 
  Server, 
  Cloud, 
  HardDrive,
  Eye,
  Trash2,
  Calendar
} from 'lucide-react';

export default function AdminAuditLogs() {
  const { 
    currentUser, 
    users, 
    addUser, 
    toggleUserStatus, 
    auditLogs, 
    backupConfig, 
    triggerManualBackup,
    showToast
  } = useApp();

  // Top navigation tabs as specified in PRD Prompt Halaman 3 ('Kelola Pengguna' and 'Log Sistem' + 'Backup 3-2-1')
  const [activeAdminTab, setActiveAdminTab] = useState('log-sistem'); // 'log-sistem', 'kelola-pengguna', 'backup-321'

  // Audit Log Search & Date Filter (PRD Spec)
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');

  // New user form modal state
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    name: '',
    email: '',
    role: 'pasien',
    nik: '',
    specialty: '',
    sip: '',
    hospital: '',
    phone: '',
    address: ''
  });

  // Filter audit logs
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

  const handleCreateUser = (e) => {
    e.preventDefault();
    if (!newUserForm.name || !newUserForm.email) {
      alert('Harap isi nama dan email.');
      return;
    }

    addUser(newUserForm);
    setIsAddUserOpen(false);
    setNewUserForm({
      name: '',
      email: '',
      role: 'pasien',
      nik: '',
      specialty: '',
      sip: '',
      hospital: '',
      phone: '',
      address: ''
    });
  };

  const exportLogsAsCSV = () => {
    const headers = ['ID', 'Tanggal', 'IP Address', 'ID Pengguna', 'Aksi', 'Tabel Data', 'ID Data', 'Rincian'];
    const rows = filteredLogs.map((l) => [
      l.id,
      `"${l.timestamp}"`,
      `"${l.ipAddress}"`,
      `"${l.userId} (${l.userName})"`,
      `"${l.action}"`,
      `"${l.tableName}"`,
      `"${l.dataId}"`,
      `"${l.details.replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `medisync_audit_logs_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Audit Log berhasil diekspor ke CSV!', 'success');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Admin Top Dashboard Banner */}
      <div 
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
                Pusat Keamanan & Audit Sistem Klinik
              </h1>
              <span className="badge badge-accent" style={{ fontSize: '0.72rem' }}>
                ISO 27001 & Permenkes Terverifikasi
              </span>
            </div>
            <div style={{ fontSize: '0.85rem', color: '#94A3B8', marginTop: '4px' }}>
              Administrator: {currentUser.name} • Status Sistem: <strong style={{ color: '#10B981' }}>Normal & Aman</strong>
            </div>
          </div>
        </div>

        {/* Top Navigation: 'Kelola Pengguna', 'Log Sistem', 'Backup 3-2-1' (PRD Spec) */}
        <div 
          style={{ 
            display: 'flex', 
            background: '#1E293B', 
            padding: '4px', 
            borderRadius: '12px',
            gap: '4px'
          }}
        >
          <button
            onClick={() => setActiveAdminTab('log-sistem')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.88rem',
              fontWeight: 600,
              background: activeAdminTab === 'log-sistem' ? '#4F46E5' : 'transparent',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <FileSpreadsheet size={16} />
            <span>Log Sistem (Audit Logs)</span>
          </button>

          <button
            onClick={() => setActiveAdminTab('kelola-pengguna')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.88rem',
              fontWeight: 600,
              background: activeAdminTab === 'kelola-pengguna' ? '#4F46E5' : 'transparent',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Users size={16} />
            <span>Kelola Pengguna ({users.length})</span>
          </button>

          <button
            onClick={() => setActiveAdminTab('backup-321')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.88rem',
              fontWeight: 600,
              background: activeAdminTab === 'backup-321' ? '#4F46E5' : 'transparent',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Database size={16} />
            <span>Backup Aturan 3-2-1</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          TAB 1: LOG SISTEM (AUDIT LOGS)
          PRD Spec: Columns: 'Tanggal', 'IP Address', 'ID Pengguna', 'Aksi', 'Tabel Data', 'ID Data'
          Search bar and date filter above the table.
          Subtle red accents (#DC2626) to highlight 'Delete' actions.
         ========================================================================= */}
      {activeAdminTab === 'log-sistem' && (
        <div className="card">
          <div className="card-header" style={{ flexWrap: 'wrap', gap: '14px' }}>
            <div>
              <h2 className="card-title">
                <FileSpreadsheet size={20} color="#1D4ED8" />
                Catatan Aktivitas Sistem (Audit Trail Logs)
              </h2>
              <p style={{ fontSize: '0.82rem', color: '#64748B', marginTop: '2px' }}>
                Merekam alamat IP, timestamp, pengguna, dan mutasi data rekam medis untuk investigasi forensik & kepatuhan hukum.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-outline btn-sm" onClick={exportLogsAsCSV}>
                <Download size={15} />
                <span>Ekspor CSV</span>
              </button>
            </div>
          </div>

          {/* Search bar and Date Filter Above Table (PRD Prompt Halaman 3) */}
          <div 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px', 
              marginBottom: '18px',
              flexWrap: 'wrap'
            }}
          >
            {/* Search Input */}
            <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
              <Search 
                size={16} 
                style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} 
              />
              <input
                type="text"
                className="form-input"
                placeholder="Cari berdasarkan User, IP, Aksi, atau ID Data..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '36px' }}
              />
            </div>

            {/* Date Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar size={16} color="#64748B" />
              <input
                type="date"
                className="form-input"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                style={{ width: '160px' }}
                title="Filter tanggal log"
              />
              {dateFilter && (
                <button 
                  className="btn btn-outline btn-sm"
                  onClick={() => setDateFilter('')}
                  style={{ padding: '8px 10px' }}
                >
                  Reset
                </button>
              )}
            </div>

            {/* Action Type Filter */}
            <select
              className="form-select"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              style={{ width: '140px' }}
            >
              <option value="ALL">Semua Aksi</option>
              <option value="LOGIN">LOGIN</option>
              <option value="CREATE">CREATE</option>
              <option value="UPDATE">UPDATE</option>
              <option value="DELETE">DELETE</option>
              <option value="RESTORE">RESTORE</option>
              <option value="BACKUP">BACKUP</option>
            </select>
          </div>

          {/* Comprehensive High-Contrast Table for Audit Logs */}
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  {/* PRD Prompt Halaman 3 Table columns: 'Tanggal', 'IP Address', 'ID Pengguna', 'Aksi', 'Tabel Data', 'ID Data' */}
                  <th>Tanggal & Jam</th>
                  <th>IP Address</th>
                  <th>ID Pengguna</th>
                  <th>Aksi</th>
                  <th>Tabel Data</th>
                  <th>ID Data</th>
                  <th>Rincian Aktivitas</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: '#64748B' }}>
                      Tidak ditemukan catatan audit yang cocok dengan filter.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => {
                    const isDeleteAction = log.action === 'DELETE' || log.severity === 'danger';
                    return (
                      <tr 
                        key={log.id} 
                        style={{ 
                          // Subtle red accents (#DC2626) to highlight 'Delete' actions (PRD Spec)
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
                          {/* Subtle red accent badge for Delete as required by PRD */}
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

      {/* =========================================================================
          TAB 2: KELOLA PENGGUNA (PRD Section 4: Sistem Login & Hak Akses)
         ========================================================================= */}
      {activeAdminTab === 'kelola-pengguna' && (
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">
                <Users size={20} color="#1D4ED8" />
                Manajemen Pengguna & Hak Akses (RBAC)
              </h2>
              <p style={{ fontSize: '0.82rem', color: '#64748B', marginTop: '2px' }}>
                Membatasi hak akses: Admin dapat mengelola semua, Dokter memiliki akses pasien & EMR, Pasien hanya melihat rekam medis miliknya.
              </p>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setIsAddUserOpen(true)}>
              <Plus size={16} /> Tambah Pengguna Baru
            </button>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Pengguna</th>
                  <th>Role / Hak Akses</th>
                  <th>Kontak / Identitas</th>
                  <th>Spesialisasi / Keterangan</th>
                  <th>Status Akun</th>
                  <th style={{ textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <img 
                          src={u.avatar} 
                          alt={u.name} 
                          style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }} 
                        />
                        <div>
                          <div style={{ fontWeight: 700 }}>{u.name}</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      {u.role === 'admin' && <span className="badge" style={{ background: '#EEF2FF', color: '#4F46E5', border: '1px solid #C7D2FE' }}>Admin IT</span>}
                      {u.role === 'dokter' && <span className="badge badge-accent">Dokter</span>}
                      {u.role === 'pasien' && <span className="badge badge-primary">Pasien</span>}
                    </td>
                    <td>
                      <div style={{ fontSize: '0.82rem' }}>{u.phone || '-'}</div>
                      <div style={{ fontSize: '0.72rem', color: '#64748B' }}>NIK: {u.nik || '-'}</div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.85rem' }}>{u.specialty || u.position || '-'}</div>
                      {u.sip && <div style={{ fontSize: '0.72rem', color: '#64748B' }}>SIP: {u.sip}</div>}
                    </td>
                    <td>
                      <span className={`badge ${u.status === 'Aktif' ? 'badge-selesai' : 'badge-danger'}`}>
                        {u.status === 'Aktif' ? '● Aktif' : '○ Nonaktif'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => toggleUserStatus(u.id)}
                        disabled={u.id === currentUser.id}
                        title={u.status === 'Aktif' ? 'Nonaktifkan Akun' : 'Aktifkan Akun'}
                      >
                        {u.status === 'Aktif' ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: BACKUP OTOMATIS ATURAN 3-2-1 (PRD Section 1, 2, 4)
         ========================================================================= */}
      {activeAdminTab === 'backup-321' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card">
            <div className="card-header">
              <div>
                <h2 className="card-title">
                  <Database size={20} color="#0F766E" />
                  Pencadangan Otomatis & Ketahanan Data (Aturan Backup 3-2-1)
                </h2>
                <p style={{ fontSize: '0.82rem', color: '#64748B', marginTop: '2px' }}>
                  Standar PRD: Sistem melakukan backup berkala dengan aturan 3-2-1 (3 Salinan Data, 2 Media Berbeda, 1 Lokasi Offsite Terpisah) agar aman dari kerusakan server.
                </p>
              </div>

              <button className="btn btn-primary" onClick={triggerManualBackup}>
                <RefreshCw size={16} />
                <span>Lakukan Backup Sekarang</span>
              </button>
            </div>

            {/* 3-2-1 Architectural Status Nodes */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              {backupConfig.storageNodes.map((node, i) => (
                <div 
                  key={i} 
                  style={{ 
                    border: '1.5px solid #E2E8F0', 
                    borderRadius: '12px', 
                    padding: '18px', 
                    background: '#FFFFFF',
                    borderTop: i === 0 ? '4px solid #1D4ED8' : i === 1 ? '4px solid #0F766E' : '4px solid #7C3AED'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {i === 0 && <HardDrive size={20} color="#1D4ED8" />}
                      {i === 1 && <Server size={20} color="#0F766E" />}
                      {i === 2 && <Cloud size={20} color="#7C3AED" />}
                      <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{node.copy}</span>
                    </div>
                    <span className="badge badge-selesai">
                      <CheckCircle2 size={12} /> {node.status}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.85rem', color: '#334155', fontWeight: 600 }}>{node.type}</div>
                  <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: '2px' }}>Lokasi: {node.location}</div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '14px', paddingTop: '10px', borderTop: '1px solid #F1F5F9', fontSize: '0.78rem' }}>
                    <span>Ukuran: <strong>{node.size}</strong></span>
                    <span>Latensi: <strong>{node.latency}</strong></span>
                  </div>
                </div>
              ))}
            </div>

            {/* Backup Specifications details */}
            <div 
              style={{ 
                background: '#F8FAFC', 
                border: '1px solid #E2E8F0', 
                borderRadius: '12px', 
                padding: '20px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '16px'
              }}
            >
              <div>
                <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>METODE ENKRIPSI</div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0F172A', marginTop: '2px' }}>
                  <Lock size={14} style={{ display: 'inline', marginRight: '4px' }} />
                  {backupConfig.encryption}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>JADWAL OTOMATIS CRON</div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0F172A', marginTop: '2px' }}>
                  {backupConfig.backupSchedule}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>TERAKHIR DILAKUKAN</div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0F766E', marginTop: '2px' }}>
                  {backupConfig.lastBackup}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>RETENSI ARSIP DATA</div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0F172A', marginTop: '2px' }}>
                  {backupConfig.retention}
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
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Tambah Akun Pengguna Baru</h3>
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
                    <option value="pasien">Pasien</option>
                    <option value="dokter">Dokter</option>
                    <option value="admin">Admin IT / Klinik</option>
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
                      <label className="form-label">Nomor Surat Izin Praktik (SIP)</label>
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
                  <div className="form-group">
                    <label className="form-label">Nomor Induk Kependudukan (NIK)</label>
                    <input
                      type="text"
                      className="form-input"
                      value={newUserForm.nik}
                      onChange={(e) => setNewUserForm({ ...newUserForm, nik: e.target.value })}
                    />
                  </div>
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
                <button type="submit" className="btn btn-primary">
                  Simpan Pengguna
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
