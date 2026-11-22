import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { isChatConsultation } from '../utils/consultation';
import ProfilePhotoUpload from '../components/ProfilePhotoUpload';
import { 
  User, 
  Calendar, 
  FileText, 
  Video, 
  MessageCircle,
  Clock, 
  ShieldCheck, 
  ChevronRight, 
  AlertCircle,
  CheckCircle2,
  Stethoscope,
  HeartPulse,
  Save,
  Phone,
  MapPin,
  IdCard,
  Pill
} from 'lucide-react';

export default function PatientDashboard() {
  const { 
    currentUser, 
    updateUserProfile,
    uploadProfilePhoto,
    appointments, 
    updateAppointmentStatus,
    emrs, 
    prescriptions,
    setTeleconsultationSession, 
    setIsBookingOpen, 
    setViewingEMR,
    showToast
  } = useApp();

  const patientTabKey = `telemed_patient_tab_${currentUser.id}`;
  const [activeTab, setActiveTab] = useState(() => {
    const savedTab = sessionStorage.getItem(patientTabKey);
    return ['jadwal', 'riwayat', 'resep', 'profil'].includes(savedTab) ? savedTab : 'jadwal';
  }); // 'jadwal', 'riwayat', 'resep', 'profil'
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    sessionStorage.setItem(patientTabKey, activeTab);
  }, [activeTab, patientTabKey]);

  // Patient profile form state
  const [profileForm, setProfileForm] = useState({
    name: currentUser.name || '',
    nik: currentUser.nik || '',
    birthDate: currentUser.birthDate || '',
    gender: currentUser.gender || '',
    phone: currentUser.phone || '',
    address: currentUser.address || '',
    bloodType: currentUser.bloodType || '',
    allergies: currentUser.allergies || ''
  });

  // Filter appointments for current patient
  const patientAppointments = appointments.filter((a) => Number(a.patientId) === Number(currentUser.patientId));
  const upcomingAppointments = patientAppointments.filter((a) => a.status !== 'Selesai' && a.status !== 'Dibatalkan');
  const completedChatAppointments = patientAppointments.filter(
    (a) => a.status === 'Selesai' && isChatConsultation(a.type)
  );
  
  // Filter EMRs for this patient, excluding archived records.
  const patientEMRs = emrs.filter((e) => Number(e.patientId) === Number(currentUser.patientId) && !e.isDeleted);

  // Filter Prescriptions for current patient
  const patientPrescriptions = (prescriptions || []).filter((p) => Number(p.patientId) === Number(currentUser.patientId));

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    if (savingProfile) return;
    setSavingProfile(true);
    try {
      const profileSaved = await updateUserProfile({
        id: currentUser.id,
        ...profileForm
      });
      if (profileSaved && profilePhoto) {
        const photoSaved = await uploadProfilePhoto(profilePhoto);
        if (photoSaved) setProfilePhoto(null);
      }
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div className="patient-dashboard-layout" style={{ display: 'grid', gridTemplateColumns: '260px minmax(0, 1fr)', gap: '24px', alignItems: 'start' }}>
      {/* Left Sidebar Navigation (PRD Spec: 'Profil', 'Jadwal Konsultasi', 'Riwayat Medis') */}
      <aside 
        style={{ 
          background: '#FFFFFF', 
          borderRadius: '16px', 
          border: '1px solid #E2E8F0', 
          padding: '20px', 
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}
      >
        <div style={{ padding: '0 8px 16px', borderBottom: '1px solid #F1F5F9', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img 
              src={currentUser.avatar} 
              alt={currentUser.name} 
              style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }} 
            />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0F172A' }}>{currentUser.name}</div>
              <div style={{ fontSize: '0.75rem', color: '#64748B' }}>NIK: {currentUser.nik}</div>
            </div>
          </div>
        </div>

        <button
          onClick={() => setActiveTab('jadwal')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            borderRadius: '10px',
            border: 'none',
            background: activeTab === 'jadwal' ? '#EFF6FF' : 'transparent',
            color: activeTab === 'jadwal' ? '#1D4ED8' : '#475569',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: 'pointer',
            textAlign: 'left'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Calendar size={18} />
            <span>Jadwal Konsultasi</span>
          </div>
          {upcomingAppointments.length > 0 && (
            <span className="badge badge-primary" style={{ padding: '2px 7px', fontSize: '0.7rem' }}>
              {upcomingAppointments.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('riwayat')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            borderRadius: '10px',
            border: 'none',
            background: activeTab === 'riwayat' ? '#EFF6FF' : 'transparent',
            color: activeTab === 'riwayat' ? '#1D4ED8' : '#475569',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: 'pointer',
            textAlign: 'left'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileText size={18} />
            <span>Riwayat medis</span>
          </div>
        </button>

        <button
          onClick={() => setActiveTab('resep')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            borderRadius: '10px',
            border: 'none',
            background: activeTab === 'resep' ? '#EFF6FF' : 'transparent',
            color: activeTab === 'resep' ? '#1D4ED8' : '#475569',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: 'pointer',
            textAlign: 'left'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Pill size={18} />
            <span>Resep & Obat</span>
          </div>
        </button>

        <button
          onClick={() => setActiveTab('profil')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 14px',
            borderRadius: '10px',
            border: 'none',
            background: activeTab === 'profil' ? '#EFF6FF' : 'transparent',
            color: activeTab === 'profil' ? '#1D4ED8' : '#475569',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: 'pointer',
            textAlign: 'left'
          }}
        >
          <User size={18} />
          <span>Profil Pasien</span>
        </button>

        {/* Quick Health Summary Card */}
        <div 
          style={{ 
            marginTop: '20px', 
            background: '#F0FDFA', 
            border: '1px solid #99F6E4', 
            borderRadius: '12px', 
            padding: '14px',
            fontSize: '0.8rem'
          }}
        >
          <div style={{ fontWeight: 700, color: '#0F766E', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <HeartPulse size={16} /> Informasi Kesehatan
          </div>
          <div style={{ color: '#334155' }}>
            <div>Gol. Darah: <strong>{currentUser.bloodType || '-'}</strong></div>
            <div style={{ marginTop: '2px' }}>Alergi: <strong style={{ color: currentUser.allergies && currentUser.allergies !== '-' ? '#DC2626' : '#64748B' }}>{currentUser.allergies || '-'}</strong></div>
          </div>
        </div>
      </aside>

      {/* Main Area */}
      <main style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Welcome Greeting Banner (PRD Spec) */}
        <div 
          style={{ 
            background: 'linear-gradient(135deg, #1D4ED8 0%, #2563EB 60%, #3B82F6 100%)', 
            borderRadius: '16px', 
            padding: '28px 32px', 
            color: '#FFFFFF',
            boxShadow: 'var(--shadow-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <div style={{ position: 'relative', zIndex: 1, maxWidth: '600px' }}>
            <span 
              style={{ 
                background: 'rgba(255, 255, 255, 0.2)', 
                padding: '4px 12px', 
                borderRadius: '20px', 
                fontSize: '0.78rem', 
                fontWeight: 600,
                letterSpacing: '0.04em'
              }}
            >
              PORTAL PASIEN MEDISYNC
            </span>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#FFF', margin: '10px 0 6px' }}>
              Selamat Datang, {currentUser.name}! 👋
            </h1>
            <p style={{ fontSize: '0.92rem', color: '#DBEAFE', lineHeight: 1.5 }}>
              Konsultasi langsung dengan dokter terpercaya kami, akses rekam medis elektronik kapan saja, dan kelola kesehatan Anda secara aman.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              className="btn"
              onClick={() => setIsBookingOpen(true)}
              style={{ background: '#FFFFFF', color: '#1D4ED8', fontWeight: 700 }}
            >
              <Calendar size={18} />
              <span>Buat Konsultasi</span>
            </button>
          </div>
        </div>

        {/* Tab Content: JADWAL KONSULTASI */}
        {(activeTab === 'jadwal' || activeTab === 'riwayat') && (
          <>
            {/* Section: 'Konsultasi Mendatang' (PRD Spec Halaman 3) */}
            {activeTab === 'jadwal' && (
            <div className="card">
              <div className="card-header">
                <div>
                  <h2 className="card-title">
                    <Calendar size={20} color="#1D4ED8" />
                    Konsultasi Mendatang
                  </h2>
                  <p style={{ fontSize: '0.82rem', color: '#64748B', marginTop: '2px' }}>
                    Daftar antrean dan jadwal pertemuan telemedis aktif Anda
                  </p>
                </div>
              </div>

              {upcomingAppointments.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '36px 20px', color: '#64748B' }}>
                  <Calendar size={42} style={{ color: '#CBD5E1', margin: '0 auto 10px' }} />
                  <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Tidak ada konsultasi aktif saat ini</div>
                  <div style={{ fontSize: '0.82rem', marginTop: '4px' }}>Gunakan tombol Buat Konsultasi di bagian atas untuk memilih dokter dan jadwal.</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {upcomingAppointments.map((apt) => (
                    <div 
                      key={apt.id}
                      style={{ 
                        border: '1px solid #E2E8F0', 
                        borderRadius: '12px', 
                        padding: '18px 20px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        gap: '16px',
                        background: apt.status === 'Sedang Berlangsung' ? '#F0FDFA' : '#FFFFFF',
                        transition: 'border-color 0.2s',
                        borderLeft: apt.status === 'Sedang Berlangsung' ? '4px solid #0F766E' : '4px solid #1D4ED8'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div 
                          style={{ 
                            width: '48px', 
                            height: '48px', 
                            borderRadius: '12px', 
                            background: '#EFF6FF', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            color: '#1D4ED8'
                          }}
                        >
                          <Stethoscope size={24} />
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: 700, fontSize: '1rem', color: '#0F172A' }}>
                              {apt.doctorName}
                            </span>
                            <span className="badge badge-primary">{apt.specialty}</span>
                            {apt.status === 'Sedang Berlangsung' ? (
                              <span className="badge badge-berlangsung">● Sesi Sedang Berlangsung</span>
                            ) : (
                              <span className="badge badge-menunggu">Menunggu Giliran</span>
                            )}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '6px', fontSize: '0.82rem', color: '#64748B' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Calendar size={14} /> {apt.date}
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Clock size={14} /> {apt.time}
                            </span>
                          <span>Metode: <strong>{apt.type}</strong></span>
                          </div>

                          <div style={{ fontSize: '0.82rem', color: '#334155', marginTop: '6px' }}>
                            Keluhan: <em>"{apt.complaint}"</em>
                          </div>
                        </div>
                      </div>

                      <div>
                        {apt.status === 'Sedang Berlangsung' ? (
                        <button
                          className="btn btn-primary"
                          onClick={() => setTeleconsultationSession(apt)}
                          style={{ 
                            padding: '10px 20px', 
                            borderRadius: '10px',
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '8px',
                            fontWeight: 700,
                            boxShadow: '0 4px 12px rgba(29, 78, 216, 0.25)'
                          }}
                        >
                          {isChatConsultation(apt.type) ? <MessageCircle size={18} /> : <Video size={18} />}
                          <span>{isChatConsultation(apt.type) ? 'Buka Chat' : 'Buka Ruang Video'}</span>
                        </button>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                            <span style={{ color: '#64748B', fontSize: 13 }}>Menunggu dokter memulai konsultasi</span>
                            {apt.status === 'Menunggu' && (
                              <button
                                type="button"
                                className="btn btn-outline btn-sm"
                                onClick={() => {
                                  if (window.confirm('Batalkan jadwal konsultasi ini?')) {
                                    updateAppointmentStatus(apt.id, 'Dibatalkan');
                                  }
                                }}
                              >
                                Batalkan konsultasi
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            )}

            {/* Section: 'Riwayat Pemeriksaan' in a neat table (PRD Spec Halaman 3) */}
            {activeTab === 'riwayat' && (
            <>
            <div className="card">
              <div className="card-header">
                <div>
                  <h2 className="card-title"><MessageCircle size={20} color="#0F766E" /> Percakapan Konsultasi Selesai</h2>
                  <p style={{ fontSize: '0.82rem', color: '#64748B', marginTop: '2px' }}>Pesan dan gambar chat tetap dapat dibaca setelah konsultasi selesai.</p>
                </div>
              </div>
              {completedChatAppointments.length === 0 ? (
                <div style={{ color: '#64748B', padding: '12px 0' }}>Belum ada percakapan konsultasi selesai.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {completedChatAppointments.map((apt) => (
                    <div key={apt.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 12, border: '1px solid #E2E8F0', borderRadius: 10 }}>
                      <div>
                        <strong>{apt.doctorName}</strong>
                        <div style={{ color: '#64748B', fontSize: 13 }}>{apt.date} · {apt.type}</div>
                      </div>
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => setTeleconsultationSession(apt)}>
                        <MessageCircle size={15} /> Lihat Chat
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="card">
              <div className="card-header">
                <div>
                  <h2 className="card-title">
                    <FileText size={20} color="#0F766E" />
                    Riwayat Pemeriksaan & Rekam Medis
                  </h2>
                  <p style={{ fontSize: '0.82rem', color: '#64748B', marginTop: '2px' }}>
                    Catatan digital konsultasi terdahulu, hasil diagnosis, dan resep obat Anda
                  </p>
                </div>
              </div>

              {patientEMRs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 20px', color: '#64748B' }}>
                  Tidak ada riwayat rekam medis terdahulu.
                </div>
              ) : (
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>ID Rekam Medis</th>
                        <th>Tanggal & Jam</th>
                        <th>Dokter Pemeriksa</th>
                        <th>Diagnosis Medis</th>
                        <th>Resep Obat</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {patientEMRs.map((emr) => (
                        <tr key={emr.id}>
                          <td>
                            <span style={{ fontWeight: 700, color: '#1D4ED8' }}>{emr.id}</span>
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>{emr.date}</td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{emr.doctorName}</div>
                            <div style={{ fontSize: '0.75rem', color: '#64748B' }}>SIP: {emr.doctorSip}</div>
                          </td>
                          <td>
                            <span className="badge badge-accent" style={{ fontWeight: 600 }}>
                              {emr.diagnosis}
                            </span>
                          </td>
                          <td style={{ maxWidth: '240px', fontSize: '0.82rem' }}>
                            <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {emr.prescription.split('\n')[0]}
                            </div>
                          </td>
                          <td>
                            <span className="badge badge-selesai">
                              <CheckCircle2 size={12} /> Selesai
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              className="btn btn-outline btn-sm"
                              onClick={() => setViewingEMR(emr)}
                            >
                              Lihat Detail
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            </>
            )}
          </>
        )}

        {/* Tab Content: PROFIL PASIEN */}
        {activeTab === 'profil' && (
          <div className="card">
            <div className="card-header">
              <div>
                <h2 className="card-title">
                  <User size={20} color="#1D4ED8" />
                  Profil Identitas Pasien
                </h2>
                <p style={{ fontSize: '0.82rem', color: '#64748B', marginTop: '2px' }}>
                  Informasi pribadi lengkap (NIK, nama, tanggal lahir, jenis kelamin, telepon, alamat)
                </p>
              </div>
            </div>

            <form onSubmit={handleProfileSubmit}>
              <div style={{ padding: '0 24px 20px' }}>
                <ProfilePhotoUpload file={profilePhoto} onFileChange={setProfilePhoto} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
                <div className="form-group">
                  <label className="form-label">Nomor Induk Kependudukan (NIK)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={profileForm.nik}
                    onChange={(e) => setProfileForm({ ...profileForm, nik: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Nama Lengkap Sesuai KTP</label>
                  <input
                    type="text"
                    className="form-input"
                    value={profileForm.name}
                    onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Tanggal Lahir</label>
                  <input
                    type="date"
                    className="form-input"
                    value={profileForm.birthDate}
                    onChange={(e) => setProfileForm({ ...profileForm, birthDate: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Jenis Kelamin</label>
                  <select
                    className="form-select"
                    value={profileForm.gender}
                    onChange={(e) => setProfileForm({ ...profileForm, gender: e.target.value })}
                  >
                    <option value="Laki-laki">Laki-laki</option>
                    <option value="Perempuan">Perempuan</option>
                    <option value="-">- (Tidak dicantumkan)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Nomor Telepon / WhatsApp</label>
                  <input
                    type="text"
                    className="form-input"
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Golongan Darah</label>
                  <select
                    className="form-select"
                    value={profileForm.bloodType}
                    onChange={(e) => setProfileForm({ ...profileForm, bloodType: e.target.value })}
                  >
                    <option value="A+">A+</option>
                    <option value="B+">B+</option>
                    <option value="AB+">AB+</option>
                    <option value="O+">O+</option>
                    <option value="A-">A-</option>
                    <option value="B-">B-</option>
                    <option value="O-">O-</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Riwayat Alergi Obat / Makanan</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Contoh: Penisilin, Seafood (atau 'Tidak Ada')"
                  value={profileForm.allergies}
                  onChange={(e) => setProfileForm({ ...profileForm, allergies: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Alamat Lengkap</label>
                <textarea
                  className="form-textarea"
                  value={profileForm.address}
                  onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button type="submit" className="btn btn-primary" disabled={savingProfile}>
                  <Save size={16} />
                  <span>{savingProfile ? 'Menyimpan…' : 'Simpan Perubahan Profil'}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Resep dokter */}
        {activeTab === 'resep' && (
          <div className="card" style={{ padding: '24px' }}>
            <div className="card-header" style={{ marginBottom: '20px', paddingBottom: '16px' }}>
              <div>
                <h2 className="card-title" style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Pill size={22} color="#059669" />
                  <span>Resep Dokter</span>
                </h2>
                <p style={{ fontSize: '0.85rem', color: '#64748B', marginTop: '2px' }}>
                  Resep yang diterbitkan dokter dan tersimpan bersama rekam medis Anda
                </p>
              </div>
            </div>

            {patientPrescriptions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 20px', background: '#F8FAFC', borderRadius: '12px' }}>
                <Pill size={40} color="#94A3B8" style={{ margin: '0 auto 12px' }} />
                <h3 style={{ fontSize: '1.05rem', color: '#1E293B', marginBottom: '4px' }}>Belum Ada Resep Dokter</h3>
                <p style={{ fontSize: '0.85rem', color: '#64748B' }}>
                  Resep akan otomatis muncul di sini setelah dokter menyelesaikan sesi telekonsultasi.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {patientPrescriptions.map((rx) => (
                  <div 
                    key={rx.id}
                    style={{
                      border: '1px solid #E2E8F0',
                      borderRadius: '12px',
                      padding: '20px',
                      background: '#FFFFFF',
                      boxShadow: 'var(--shadow-sm)'
                    }}
                  >
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#1E293B', margin: '0 0 12px' }}>Resep</h3>
                    {rx.items && rx.items.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {rx.items.map((item, index) => (
                          <div key={index} style={{ padding: '10px 12px', borderRadius: 8, background: '#F8FAFC' }}>
                            <div style={{ fontWeight: 700, color: '#0F172A' }}>{item.medicineName}</div>
                            <div style={{ marginTop: 4, color: '#475569', fontSize: '0.85rem' }}>
                              Petunjuk konsumsi: {item.dosage}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ whiteSpace: 'pre-wrap', color: '#334155' }}>
                        {rx.prescriptionText || 'Tidak ada rincian obat.'}
                      </div>
                    )}
                    <div style={{ borderTop: '1px solid #E2E8F0', marginTop: 12, paddingTop: 10, fontSize: '0.85rem', color: '#475569' }}>
                      <strong>Catatan konsumsi:</strong> {rx.notes || 'Tidak ada catatan konsumsi.'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
