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
  Calendar,
  Stethoscope,
  Play,
  RotateCcw,
  Clock,
  Sparkles
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
    simulatePITRRecovery,
    showToast
  } = useApp();

  // Tabs: 'log-sistem' | 'kelola-dokter' | 'data-pasien' | 'backup-drp'
  const [activeAdminTab, setActiveAdminTab] = useState('log-sistem');

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');

  // User creation modal
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    name: '',
    email: '',
    role: 'dokter',
    nik: '',
    specialty: '',
    sip: '',
    hospital: '',
    phone: '',
    address: ''
  });

  // Filter lists
  const doctors = users.filter((u) => u.role === 'dokter');
  const patients = users.filter((u) => u.role === 'pasien');

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
      showToast('Harap isi nama dan email.', 'danger');
      return;
    }

    addUser(newUserForm);
    setIsAddUserOpen(false);
    setNewUserForm({
      name: '',
      email: '',
      role: 'dokter',
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
      `"${l.userName} (${l.userId})"`,
      l.action,
      l.tableName,
      l.dataId,
      `"${l.details.replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `medisync_audit_trail_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Log audit berhasil diunduh dalam format CSV.', 'success');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Banner */}
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
                Dashboard Administrator & Log Audit
              </h1>
              <span className="badge badge-accent" style={{ fontSize: '0.72rem' }}>
                UIN Sunan Ampel Surabaya 2026
              </span>
            </div>
            <div style={{ fontSize: '0.85rem', color: '#94A3B8', marginTop: '4px' }}>
              Administrator: <strong>{currentUser.name}</strong> • Modul: Kelola Dokter, Pasien, Audit Log, dan DRP Cloud
            </div>
          </div>
        </div>

        {/* 4 Tabs Navigation */}
        <div 
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
            <span>Log Audit ({auditLogs.length})</span>
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
            <span>Kelola Dokter ({doctors.length})</span>
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
            <span>Data Pasien ({patients.length})</span>
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
            <span>DRP & Cloud Backup</span>
          </button>
        </div>
      </div>

      {/* TAB 1: LOG AUDIT SISTEM */}
      {activeAdminTab === 'log-sistem' && (
        <div className="card">
          <div className="card-header" style={{ flexWrap: 'wrap', gap: '14px' }}>
            <div>
              <h2 className="card-title">
                <FileSpreadsheet size={20} color="#1D4ED8" />
                Catatan Aktivitas Sistem (Audit Trail Logs)
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
                  <th>Tarif Konsultasi</th>
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
                      <code>{doc.sip || '446/STR/2026'}</code>
                    </td>
                    <td>{doc.hospital || 'RS Medika TeleMed'}</td>
                    <td><strong>{doc.fee || 'Rp 150.000'}</strong></td>
                    <td>
                      <span className={`badge ${doc.status === 'Aktif' ? 'badge-selesai' : 'badge-danger'}`}>
                        {doc.status === 'Aktif' ? '● Aktif' : '○ Nonaktif'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => toggleUserStatus(doc.id)}
                      >
                        {doc.status === 'Aktif' ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
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
                    <td><code>{p.nik}</code></td>
                    <td>{p.gender || 'Laki-laki'}</td>
                    <td>{p.phone || '-'}</td>
                    <td>
                      <div><strong>{p.bloodType || 'O+'}</strong></div>
                      <small style={{ color: p.allergies && p.allergies !== 'Tidak Ada' ? '#DC2626' : '#64748B' }}>
                        Alergi: {p.allergies || 'Tidak Ada'}
                      </small>
                    </td>
                    <td style={{ maxWidth: '200px', fontSize: '0.82rem' }}>{p.address || '-'}</td>
                    <td>
                      <span className={`badge ${p.status === 'Aktif' ? 'badge-selesai' : 'badge-danger'}`}>
                        {p.status === 'Aktif' ? '● Aktif' : '○ Nonaktif'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => toggleUserStatus(p.id)}
                      >
                        {p.status === 'Aktif' ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: DRP & CLOUD BACKUP SIMULATION */}
      {activeAdminTab === 'backup-drp' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Simulation Trigger Box matching Chapter 5 of PDF */}
          <div 
            style={{ 
              background: 'linear-gradient(135deg, #1E1B4B 0%, #0F172A 100%)', 
              borderRadius: '16px', 
              padding: '24px', 
              color: '#FFFFFF',
              border: '1px solid #312E81'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <span className="badge badge-accent" style={{ background: '#3730A3', color: '#C7D2FE', border: 'none', marginBottom: '8px' }}>
                  Simulasi Praktikum Cloud Computing (UINSA 2026)
                </span>
                <h3 style={{ fontSize: '1.35rem', fontWeight: 800 }}>
                  Simulasi Pemulihan Bencana: Skenario Tabel Terhapus (PITR)
                </h3>
                <p style={{ color: '#94A3B8', fontSize: '0.88rem', maxWidth: '750px', marginTop: '6px' }}>
                  Menguji kepatuhan Disaster Recovery Plan Bab 5.6: Jika terjadi insiden salah eksekusi <code>DROP TABLE</code> pada pukul 13:45, sistem memulihkan PostgreSQL ke target 13:44 WIB menggunakan Base Backup + Replay WAL kontinu. Target RTO &le; 30 menit & RPO &le; 1 menit.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  className="btn btn-primary"
                  style={{ background: '#4F46E5', display: 'flex', alignItems: 'center', gap: '8px' }}
                  onClick={() => simulatePITRRecovery('2026-10-19 13:44:00')}
                >
                  <Play size={16} />
                  <span>Jalankan Simulasi PITR 9 Langkah</span>
                </button>
              </div>
            </div>

            {/* 9 Steps visual timeline */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', marginTop: '24px' }}>
              {[
                { step: '1', title: 'Deteksi Error', desc: '13:45:00 WIB' },
                { step: '2', title: 'Stop Backend', desc: 'Cegah data kotor' },
                { step: '3', title: 'Amankan WAL', desc: 'pg_switch_wal()' },
                { step: '4', title: 'Stop DB Bukti', desc: 'Copy forensik' },
                { step: '5', title: 'Restore Base', desc: 'Extract pgdata' },
                { step: '6', title: 'Target PITR', desc: '13:44:00 WIB' },
                { step: '7', title: 'Replay WAL', desc: 'Putar ulang log' },
                { step: '8', title: 'Validasi', desc: 'Checksum data' },
                { step: '9', title: 'Start & RTO', desc: 'Pulih (24 menit)' }
              ].map((s, idx) => (
                <div 
                  key={idx}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    padding: '10px',
                    textAlign: 'center'
                  }}
                >
                  <div style={{ fontWeight: 800, color: '#818CF8', fontSize: '0.85rem' }}>Langkah {s.step}</div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#FFFFFF', marginTop: '2px' }}>{s.title}</div>
                  <div style={{ fontSize: '0.68rem', color: '#94A3B8', marginTop: '2px' }}>{s.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 4 Lapis Strategi Backup */}
          <div className="card">
            <div className="card-header">
              <div>
                <h2 className="card-title">
                  <Database size={20} color="#0F766E" />
                  Strategi Backup 4 Lapis & Aturan 3-2-1
                </h2>
                <p style={{ fontSize: '0.82rem', color: '#64748B', marginTop: '2px' }}>
                  Snapshot volume Docker mingguan, Dump logis tiap 6 jam, Base Backup + WAL kontinu, dan Salinan Off-site AES-256.
                </p>
              </div>

              <button className="btn btn-primary" onClick={triggerManualBackup}>
                <RefreshCw size={16} />
                <span>Picu Backup Manual Sekarang</span>
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
                <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>TARGET RTO & RPO</div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1D4ED8', marginTop: '2px' }}>
                  RTO &le; 30 Menit • RPO &le; 1 Menit
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
                  Simpan Akun
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
