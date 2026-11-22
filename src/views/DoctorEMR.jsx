import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import DashboardMetric from '../components/DashboardMetric';
import ProfilePhotoUpload from '../components/ProfilePhotoUpload';
import { isChatConsultation } from '../utils/consultation';
import {
  Calendar,
  Clock,
  User,
  FileText,
  Save,
  Video,
  CheckCircle2,
  Trash2,
  Heart,
  Stethoscope,
  Eye,
  AlertTriangle,
  MessageCircle,
  Plus,
  Pencil,
  LayoutDashboard,
  Activity,
  ArrowRight,
  TrendingUp
} from 'lucide-react';
import confetti from 'canvas-confetti';

export default function DoctorEMR() {
  const {
    currentUser,
    appointments,
    updateUserProfile,
    uploadProfilePhoto,
    updateAppointmentStatus,
    emrs,
    saveEMR,
    deleteEMR,
    setEditingEMR,
    setTeleconsultationSession,
    setViewingEMR,
    showToast
  } = useApp();

  // Tab: examination queue or medical records.
  const [currentView, setCurrentView] = useState('overview');
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [doctorProfile, setDoctorProfile] = useState({
    name: currentUser?.name || '',
    specialization: currentUser?.specialization || '',
    strNumber: currentUser?.strNumber || '',
    phone: currentUser?.phone === '-' ? '' : currentUser?.phone || '',
    workplace: currentUser?.workplace || '',
  });

  useEffect(() => {
    setDoctorProfile({
      name: currentUser?.name || '',
      specialization: currentUser?.specialization || '',
      strNumber: currentUser?.strNumber || '',
      phone: currentUser?.phone === '-' ? '' : currentUser?.phone || '',
      workplace: currentUser?.workplace || '',
    });
  }, [currentUser?.id]);

  const handleDoctorProfileSubmit = async (event) => {
    event.preventDefault();
    if (savingProfile) return;
    setSavingProfile(true);
    try {
      const profileSaved = await updateUserProfile(doctorProfile);
      if (profileSaved && profilePhoto) {
        const photoSaved = await uploadProfilePhoto(profilePhoto);
        if (photoSaved) setProfilePhoto(null);
      }
    } finally {
      setSavingProfile(false);
    }
  };

  const consultationIdsWithRecords = new Set(
    emrs
      .filter((record) => record.consultationId)
      .map((record) => Number(record.consultationId))
  );

  // Ended consultations remain available until their medical record is saved.
  const assignedAppointments = appointments.filter(
    (appointment) => Number(appointment.doctorId) === Number(currentUser?.doctorId)
  );
  const doctorAppointments = assignedAppointments.filter(
    (appointment) =>
      (
        ['Menunggu', 'Sedang Berlangsung'].includes(appointment.status) ||
        (appointment.status === 'Selesai' && !consultationIdsWithRecords.has(Number(appointment.id)))
      )
  );
  const completedChatAppointments = appointments.filter(
    (appointment) =>
      Number(appointment.doctorId) === Number(currentUser?.doctorId) &&
      appointment.status === 'Selesai'
  );
  const visibleEMRs = emrs.filter((record) => !record.isDeleted);
  const today = new Date();
  const todayKey = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');
  const todayDoctorAppointments = assignedAppointments.filter(
    (appointment) => appointment.date === todayKey && appointment.status !== 'Dibatalkan'
  );
  const waitingConsultations = assignedAppointments.filter(
    (appointment) => appointment.status === 'Menunggu'
  ).length;
  const activeConsultations = assignedAppointments.filter(
    (appointment) => appointment.status === 'Sedang Berlangsung'
  ).length;
  const consultationsToRecord = doctorAppointments.filter(
    (appointment) => appointment.status === 'Selesai'
  ).length;
  const doctorTrend = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - 6 + index);
    const dateKey = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');
    return {
      dateKey,
      label: date.toLocaleDateString('id-ID', { weekday: 'short' }),
      count: assignedAppointments.filter((appointment) => appointment.date === dateKey).length,
    };
  });
  const maxDoctorTrend = Math.max(1, ...doctorTrend.map((day) => day.count));
  const dashboardAgenda = [...doctorAppointments]
    .sort((first, second) => `${first.date} ${first.time}`.localeCompare(`${second.date} ${second.time}`))
    .slice(0, 5);
  const recentDoctorEMRs = visibleEMRs.slice(0, 5);

  // Selected patient for active consultation (default to first active appointment)
  const [selectedAppointmentId, setSelectedAppointmentId] = useState('');

  useEffect(() => {
    if (!doctorAppointments.some((appointment) => appointment.id === selectedAppointmentId)) {
      setSelectedAppointmentId(doctorAppointments[0]?.id || '');
    }
  }, [doctorAppointments, selectedAppointmentId]);

  const selectedAppointment = doctorAppointments.find((a) => a.id === selectedAppointmentId);
  const patientDemographic = selectedAppointment
    ? [
        selectedAppointment.patientNik ? `NIK: ${selectedAppointment.patientNik}` : '',
        selectedAppointment.patientAge ? `Usia: ${selectedAppointment.patientAge} thn` : '',
        selectedAppointment.patientGender && selectedAppointment.patientGender !== '-'
          ? `Gender: ${selectedAppointment.patientGender}`
          : '',
      ].filter(Boolean).join(' | ')
    : '';

  // Consultation Form state (PRD Spec: 'Keluhan', 'Diagnosis', 'Tindakan', 'Resep Obat')
  const [complaint, setComplaint] = useState(selectedAppointment?.complaint || '');
  const [diagnosis, setDiagnosis] = useState('');
  const [action, setAction] = useState('');
  const [prescriptionItems, setPrescriptionItems] = useState([]);
  const [prescriptionNote, setPrescriptionNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState(false);
  const [vitals, setVitals] = useState({
    bp: '',
    heartRate: '',
    temperature: '',
    weight: ''
  });

  useEffect(() => {
    if (selectedAppointment) {
      setComplaint(selectedAppointment.complaint || '');
      setDiagnosis('');
      setAction('');
      setPrescriptionItems([]);
      setPrescriptionNote('');
      setVitals({ bp: '', heartRate: '', temperature: '', weight: '' });
    }
  }, [selectedAppointment?.id]);

  // When changing selected patient, update complaint template
  const handleSelectAppointment = (apt) => {
    setSelectedAppointmentId(apt.id);
    setComplaint(apt.complaint || '');
    setDiagnosis('');
    setAction('');
    setPrescriptionItems([]);
    setPrescriptionNote('');
    setVitals({ bp: '', heartRate: '', temperature: '', weight: '' });
  };

  // Submit active consultation form
  const handleSaveEMR = async (e) => {
    e.preventDefault();

    if (!selectedAppointment) {
      alert('Pilih pasien antrean terlebih dahulu.');
      return;
    }
    if (!['Sedang Berlangsung', 'Selesai'].includes(selectedAppointment.status)) {
      alert('Mulai konsultasi terlebih dahulu sebelum menyimpan rekam medis.');
      return;
    }
    if (!diagnosis.trim()) {
      alert('Harap isi Diagnosis pemeriksaan.');
      return;
    }

    const completedItems = prescriptionItems.map((item) => ({
      ...item,
      medicineId: item.medicineId ? Number(item.medicineId) : null,
      medicineName: item.medicineId ? null : item.medicineName.trim(),
      quantity: Number(item.quantity),
      dosage: item.dosage.trim(),
    }));
    if (completedItems.some((item) =>
      (!item.medicineId && !item.medicineName) ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      !item.dosage
    )) {
      alert('Lengkapi nama obat, jumlah, dan aturan pakai pada setiap item resep.');
      return;
    }

    setSaving(true);
    try {
      await saveEMR({
        appointmentId: selectedAppointment.id,
        patientId: selectedAppointment.patientId,
        patientName: selectedAppointment.patientName,
        patientNik: selectedAppointment.patientNik,
        complaint: complaint.trim(),
        diagnosis: diagnosis.trim(),
        action: action.trim(),
        prescriptionItems: completedItems,
        prescriptionNote: prescriptionNote.trim(),
        vitals
      });
      try {
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
      } catch (err) { }
    } catch (error) {
      console.error('Gagal menyimpan rekam medis:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleStartConsultation = async () => {
    if (!selectedAppointment || starting) return;
    setStarting(true);
    try {
      const updatedAppointment = await updateAppointmentStatus(
        selectedAppointment.id,
        'Sedang Berlangsung'
      );
      if (updatedAppointment) setTeleconsultationSession(updatedAppointment);
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="doctor-emr-root" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header bar with Navigation Tabs */}
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              background: '#0F766E',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff'
            }}
          >
            <Stethoscope size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A' }}>
              Portal Dokter
            </h1>
            <div style={{ fontSize: '0.82rem', color: '#64748B' }}>
              {currentUser.name} • {currentUser.specialty || 'Dokter'} • SIP: {currentUser.sip || '-'}
            </div>
          </div>
        </div>

        {/* View Switcher: dashboard, consultation queue, and medical records */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className={`btn btn-sm ${currentView === 'overview' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setCurrentView('overview')}
          >
            <LayoutDashboard size={16} />
            <span>Dashboard</span>
          </button>

          <button
            className={`btn btn-sm ${currentView === 'emr-active' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setCurrentView('emr-active')}
          >
            <Clock size={16} />
            <span>Antrean</span>
          </button>

          <button
            className={`btn btn-sm ${currentView === 'arsip' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setCurrentView('arsip')}
          >
            <FileText size={16} />
            <span>Rekam medis ({visibleEMRs.length})</span>
          </button>

          <button
            className={`btn btn-sm ${currentView === 'chat-history' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setCurrentView('chat-history')}
          >
            <MessageCircle size={16} />
            <span>Riwayat Chat ({completedChatAppointments.length})</span>
          </button>

          <button
            className={`btn btn-sm ${currentView === 'profile' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setCurrentView('profile')}
          >
            <User size={16} />
            <span>Profil Saya</span>
          </button>
        </div>
      </div>

      {currentView === 'overview' && (
        <div className="doctor-dashboard">
          <div className="doctor-dashboard-heading">
            <div>
              <h2>Selamat datang, dr. {currentUser.name}</h2>
              <p>{today.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>
            <button type="button" className="btn btn-primary" onClick={() => setCurrentView('emr-active')}>
              Buka antrean <ArrowRight size={16} />
            </button>
          </div>

          <div className="dashboard-metrics">
            <DashboardMetric
              icon={Calendar}
              label="Jadwal hari ini"
              value={todayDoctorAppointments.length}
              note="Konsultasi terjadwal"
              color="#2563EB"
              onClick={() => setCurrentView('emr-active')}
            />
            <DashboardMetric
              icon={Clock}
              label="Menunggu"
              value={waitingConsultations}
              note="Pasien dalam antrean"
              color="#D97706"
              onClick={() => setCurrentView('emr-active')}
            />
            <DashboardMetric
              icon={Activity}
              label="Sedang konsultasi"
              value={activeConsultations}
              note="Sesi berlangsung"
              color="#0F766E"
              onClick={() => setCurrentView('emr-active')}
            />
            <DashboardMetric
              icon={FileText}
              label="Perlu rekam medis"
              value={consultationsToRecord}
              note="Konsultasi selesai"
              color="#7C3AED"
              onClick={() => setCurrentView('emr-active')}
            />
            <DashboardMetric
              icon={CheckCircle2}
              label="Rekam medis aktif"
              value={visibleEMRs.length}
              note="Tersimpan di sistem"
              color="#0891B2"
              onClick={() => setCurrentView('arsip')}
            />
          </div>

          <div className="dashboard-columns">
            <section className="card dashboard-panel">
              <div className="card-header">
                <div>
                  <h2 className="card-title"><TrendingUp size={19} color="#4F46E5" /> Aktivitas konsultasi</h2>
                  <p className="dashboard-panel-note">Jadwal konsultasi tujuh hari terakhir.</p>
                </div>
              </div>
              <div
                className="dashboard-trend-chart doctor-trend-chart"
                role="img"
                aria-label="Grafik konsultasi tujuh hari terakhir"
                style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}
              >
                {doctorTrend.map((day) => (
                  <div className="dashboard-trend-column" key={day.dateKey} title={`${day.label}: ${day.count} konsultasi`}>
                    <span className="dashboard-trend-value">{day.count || ''}</span>
                    <div className="dashboard-trend-track">
                      <div className="dashboard-trend-bar" style={{ height: `${day.count ? Math.max(10, (day.count / maxDoctorTrend) * 100) : 4}%` }} />
                    </div>
                    <span className="dashboard-trend-label">{day.label}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="card dashboard-panel">
              <div className="card-header">
                <div>
                  <h2 className="card-title"><Calendar size={19} color="#0F766E" /> Agenda berikutnya</h2>
                  <p className="dashboard-panel-note">Antrean dan rekam medis yang perlu ditindaklanjuti.</p>
                </div>
              </div>
              {dashboardAgenda.length === 0 ? (
                <p className="doctor-dashboard-empty">Belum ada agenda yang perlu ditindaklanjuti.</p>
              ) : (
                <div className="doctor-dashboard-list">
                  {dashboardAgenda.map((appointment) => (
                    <button
                      type="button"
                      className="doctor-dashboard-list-item"
                      key={appointment.id}
                      onClick={() => {
                        handleSelectAppointment(appointment);
                        setCurrentView('emr-active');
                      }}
                    >
                      <span className="doctor-dashboard-list-icon"><User size={17} /></span>
                      <span className="doctor-dashboard-list-copy">
                        <strong>{appointment.patientName}</strong>
                        <span>{appointment.date} · {appointment.time}</span>
                      </span>
                      <span className="doctor-dashboard-status">{appointment.status === 'Selesai' ? 'Perlu rekam medis' : appointment.status}</span>
                      <ArrowRight size={16} />
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className="card dashboard-panel doctor-dashboard-records">
              <div className="card-header">
                <div>
                  <h2 className="card-title"><FileText size={19} color="#0891B2" /> Rekam medis terbaru</h2>
                  <p className="dashboard-panel-note">Akses cepat ke catatan pemeriksaan pasien.</p>
                </div>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setCurrentView('arsip')}>
                  Lihat semua <ArrowRight size={14} />
                </button>
              </div>
              {recentDoctorEMRs.length === 0 ? (
                <p className="doctor-dashboard-empty">Belum ada rekam medis aktif.</p>
              ) : (
                <div className="doctor-dashboard-list">
                  {recentDoctorEMRs.map((record) => (
                    <button
                      type="button"
                      className="doctor-dashboard-list-item"
                      key={record.id}
                      onClick={() => setViewingEMR(record)}
                    >
                      <span className="doctor-dashboard-list-icon"><FileText size={17} /></span>
                      <span className="doctor-dashboard-list-copy">
                        <strong>{record.patientName}</strong>
                        <span>{record.date} · {record.diagnosis || 'Tanpa diagnosis'}</span>
                      </span>
                      <ArrowRight size={16} />
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 1: SPLIT SCREEN LAYOUT (PRD Halaman 3 Prompt 2)
          Left column: Today's appointments (Patient name, time, status with teal #0F766E)
          Right column: Active Consultation Form (Keluhan, Diagnosis, Tindakan, Resep Obat)
          Button: Simpan Rekam Medis (Primary Blue)
         ========================================================================= */}
      {currentView === 'emr-active' && (doctorAppointments.length === 0 ? (
        <div className="card doctor-no-appointments">
          <Calendar size={28} color="#0F766E" />
          <div>
            <h2>Tidak ada pasien dalam antrean</h2>
            <p>Jadwal konsultasi aktif akan muncul di sini. Riwayat sebelumnya tersedia di arsip rekam medis.</p>
          </div>
        </div>
      ) : (
        <div className="doctor-workspace" style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 380px) minmax(0, 1fr)', gap: '20px', alignItems: 'start' }}>
          {/* Left Column: Jadwal Hari Ini / Today's appointments */}
          <div className="card doctor-queue-sticky" style={{ padding: '20px' }}>
            <div className="card-header" style={{ marginBottom: '14px', paddingBottom: '12px' }}>
              <div>
                <h2 className="card-title" style={{ fontSize: '1.05rem' }}>
                  <Calendar size={18} color="#0F766E" />
                  Antrean Konsultasi
                </h2>
                <p style={{ fontSize: '0.78rem', color: '#64748B' }}>
                  Konsultasi aktif yang ditugaskan kepada Anda
                </p>
              </div>
              <span className="badge badge-accent" style={{ color: '#0F766E' }}>
                {doctorAppointments.length} pasien
              </span>
            </div>

            {doctorAppointments.length === 0 ? (
              <div style={{ padding: '24px 12px', textAlign: 'center', color: '#64748B', fontSize: '0.88rem' }}>
                Tidak ada pasien dalam antrean. Riwayat konsultasi tersedia di arsip.
              </div>
            ) : <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {doctorAppointments.map((apt) => {
                const isSelected = selectedAppointment?.id === apt.id;
                return (
                  <div
                    key={apt.id}
                    onClick={() => handleSelectAppointment(apt)}
                    style={{
                      padding: '14px',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      border: `1.5px solid ${isSelected ? '#1D4ED8' : '#E2E8F0'}`,
                      backgroundColor: isSelected ? '#EFF6FF' : '#FFFFFF',
                      transition: 'all 0.15s ease',
                      boxShadow: isSelected ? 'var(--shadow-sm)' : 'none'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.92rem', color: isSelected ? '#1D4ED8' : '#0F172A' }}>
                        {apt.patientName}
                      </div>
                      {/* Teal Accent #0F766E for Status as requested by PRD */}
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          color: '#0F766E',
                          backgroundColor: '#F0FDFA',
                          border: '1px solid #99F6E4',
                          padding: '2px 8px',
                          borderRadius: '12px'
                        }}
                      >
                        {apt.status}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.78rem', color: '#64748B' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={13} /> {apt.time}
                      </span>
                      <span>NIK: {apt.patientNik}</span>
                    </div>

                    <div style={{ fontSize: '0.8rem', color: '#334155', marginTop: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      Keluhan: <em>{apt.complaint}</em>
                    </div>
                  </div>
                );
              })}
            </div>}
          </div>

          {/* Right Column: Active Consultation Form (PRD Prompt Halaman 3) */}
          <div className="card" style={{ padding: '24px' }}>
            {selectedAppointment ? (
              <form onSubmit={handleSaveEMR}>
                {/* Active Patient Card Banner */}
                <div
                  style={{
                    background: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    borderRadius: '12px',
                    padding: '16px 20px',
                    marginBottom: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '50%',
                        background: '#DBEAFE',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#1D4ED8',
                        fontWeight: 700
                      }}
                    >
                      <User size={22} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0F172A' }}>
                        {selectedAppointment.patientName}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#64748B' }}>
                        {patientDemographic}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {selectedAppointment.status === 'Menunggu' && (
                      <button
                        type="button"
                        className="btn btn-sm"
                        style={{ background: '#0F766E', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}
                        onClick={handleStartConsultation}
                        disabled={starting}
                      >
                        <CheckCircle2 size={15} />
                        <span>{starting ? 'Memulai…' : 'Mulai Konsultasi'}</span>
                      </button>
                    )}

                    {selectedAppointment.status === 'Sedang Berlangsung' && <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => setTeleconsultationSession(selectedAppointment)}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      {isChatConsultation(selectedAppointment.type) ? <MessageCircle size={15} /> : <Video size={15} />}
                      <span>{isChatConsultation(selectedAppointment.type) ? 'Buka Chat Konsultasi' : 'Buka Ruang Video'}</span>
                    </button>}
                  </div>
                </div>

                {/* Vitals Input Row */}
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Heart size={15} color="#DC2626" />
                    <span>Tanda-Tanda Vital (Pemeriksaan Fisik Mandiri / Klinis)</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                    <div>
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>Tekanan Darah</label>
                      <input
                        type="text"
                        className="form-input"
                        value={vitals.bp}
                        onChange={(e) => setVitals({ ...vitals, bp: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>Denyut Nadi</label>
                      <input
                        type="text"
                        className="form-input"
                        value={vitals.heartRate}
                        onChange={(e) => setVitals({ ...vitals, heartRate: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>Suhu Tubuh</label>
                      <input
                        type="text"
                        className="form-input"
                        value={vitals.temperature}
                        onChange={(e) => setVitals({ ...vitals, temperature: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>Berat Badan</label>
                      <input
                        type="text"
                        className="form-input"
                        value={vitals.weight}
                        onChange={(e) => setVitals({ ...vitals, weight: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* 1. Clean Text Input for 'Keluhan' (PRD Spec) */}
                <div className="form-group">
                  <label className="form-label">
                    Keluhan Utama (Anamnesis & Riwayat Penyakit Sekarang)
                  </label>
                  <textarea
                    className="form-textarea"
                    placeholder="Tuliskan keluhan pasien, durasi gejala, faktor pemicu, riwayat konsumsi obat..."
                    value={complaint}
                    onChange={(e) => setComplaint(e.target.value)}
                    required
                  />
                </div>

                {/* 2. Clean Text Input for 'Diagnosis' (PRD Spec) */}
                <div className="form-group">
                  <label className="form-label" htmlFor="clinical-diagnosis">
                    Diagnosis klinis
                  </label>
                  <input
                    id="clinical-diagnosis"
                    type="text"
                    className="form-input"
                    placeholder="Tulis diagnosis; sertakan kode ICD-10 bila diperlukan"
                    value={diagnosis}
                    onChange={(e) => setDiagnosis(e.target.value)}
                    required
                  />
                </div>

                {/* 3. Clean Text Input for 'Tindakan' (PRD Spec) */}
                <div className="form-group">
                  <label className="form-label">
                    Tindakan & Edukasi Pasien (Plan / Care Management)
                  </label>
                  <textarea
                    className="form-textarea"
                    placeholder="Rencana edukasi gaya hidup, pembatasan diet garam/gula, jadwal kontrol berkala, rujukan lab..."
                    value={action}
                    onChange={(e) => setAction(e.target.value)}
                  />
                </div>

                {/* Structured prescription recorded in the medical record */}
                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <label className="form-label" style={{ margin: 0 }}>Resep obat (opsional)</label>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => setPrescriptionItems((items) => [...items, { medicineId: '', medicineName: '', quantity: 1, dosage: '' }])}>
                      <Plus size={15} /> Tambah Obat
                    </button>
                  </div>
                  <p style={{ color: '#64748B', fontSize: 12, margin: '0 0 10px' }}>
                    Tulis nama obat secara manual; resep tetap tersimpan meskipun obat belum ada di daftar.
                  </p>
                  {prescriptionItems.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1.4fr) 100px minmax(180px, 1.5fr) auto', gap: 8, marginBottom: 5, color: '#64748B', fontSize: 11 }}>
                      <span>Nama obat</span><span>Jumlah</span><span>Aturan pakai / dosis</span><span />
                    </div>
                  )}
                  {prescriptionItems.map((item, index) => (
                    <div key={index} style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1.4fr) 100px minmax(180px, 1.5fr) auto', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                      <input className="form-input" type="text" maxLength={150} required placeholder="Nama obat" aria-label="Nama obat" value={item.medicineName} onChange={(event) => setPrescriptionItems((items) => items.map((row, rowIndex) => rowIndex === index ? { ...row, medicineId: '', medicineName: event.target.value } : row))} />
                      <input className="form-input" type="number" min="1" step="1" required aria-label="Jumlah unit stok" value={item.quantity} onChange={(event) => setPrescriptionItems((items) => items.map((row, rowIndex) => rowIndex === index ? { ...row, quantity: event.target.value } : row))} />
                      <input className="form-input" type="text" maxLength={500} required placeholder="Aturan pakai / dosis" value={item.dosage} onChange={(event) => setPrescriptionItems((items) => items.map((row, rowIndex) => rowIndex === index ? { ...row, dosage: event.target.value } : row))} />
                      <button type="button" className="btn btn-outline btn-sm" aria-label="Hapus item resep" onClick={() => setPrescriptionItems((items) => items.filter((_, rowIndex) => rowIndex !== index))}><Trash2 size={15} /></button>
                    </div>
                  ))}
                  {prescriptionItems.length > 0 && (
                    <textarea className="form-textarea" maxLength={1000} placeholder="Catatan resep untuk pasien (opsional)." value={prescriptionNote} onChange={(event) => setPrescriptionNote(event.target.value)} />
                  )}
                </div>

                {/* Primary Blue Button 'Simpan Rekam Medis' (PRD Spec) */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
                  <button
                    type="submit"
                    className="btn btn-primary btn-lg"
                    disabled={saving || !['Sedang Berlangsung', 'Selesai'].includes(selectedAppointment.status)}
                    style={{
                      backgroundColor: '#1D4ED8',
                      boxShadow: '0 4px 14px rgba(29, 78, 216, 0.3)',
                      fontWeight: 700
                    }}
                  >
                    <Save size={18} />
                    <span>{saving ? 'Menyimpan…' : 'Simpan Rekam Medis'}</span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="doctor-selection-empty" style={{ textAlign: 'center', padding: '36px 20px', color: '#64748B' }}>
                <User size={40} style={{ color: '#CBD5E1', margin: '0 auto 12px' }} />
                <div style={{ fontWeight: 600 }}>Pilih pasien dari antrean</div>
                <div style={{ fontSize: '0.85rem', marginTop: '4px' }}>Detail konsultasi akan tampil di area ini.</div>
              </div>
            )}
          </div>
        </div>
      ))}

      {/* =========================================================================
          VIEW 2: ARSIP REKAM MEDIS
         ========================================================================= */}
      {currentView === 'arsip' && (
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">
                <FileText size={20} color="#1D4ED8" />
                Rekam medis
              </h2>
              <p style={{ fontSize: '0.82rem', color: '#64748B', marginTop: '2px' }}>
                Lihat catatan pemeriksaan aktif. Rekam medis yang dihapus tidak lagi tampil di portal dokter.
              </p>
            </div>
          </div>

          {/* Banner Akses Cepat CDN Pertemuan 5 */}


          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID Rekam Medis</th>
                  <th>Tanggal</th>
                  <th>Nama Pasien</th>
                  <th>Diagnosis</th>
                  <th>Dokter Pemeriksa</th>
                  <th>Status Keamanan Data</th>
                  <th style={{ textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {visibleEMRs.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', color: '#64748B', padding: 20 }}>
                      Belum ada rekam medis aktif.
                    </td>
                  </tr>
                ) : visibleEMRs.map((item) => (
                  <tr key={item.id} style={{ opacity: item.isDeleted ? 0.8 : 1, backgroundColor: item.isDeleted ? '#FFF5F5' : 'inherit' }}>
                    <td>
                      <span style={{ fontWeight: 700, color: item.isDeleted ? '#DC2626' : '#1D4ED8' }}>
                        {item.id}
                      </span>
                    </td>
                    <td>{item.date}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{item.patientName}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748B' }}>NIK: {item.patientNik}</div>
                    </td>
                    <td>
                      <span className="badge badge-accent">{item.diagnosis}</span>
                    </td>
                    <td>{item.doctorName}</td>
                    <td>
                      {item.isDeleted ? (
                        <div>
                          <span className="badge badge-danger">
                            <AlertTriangle size={12} /> Dihapus
                          </span>
                          <div style={{ fontSize: '0.72rem', color: '#DC2626', marginTop: '3px' }}>
                            {item.deletedAt}
                          </div>
                        </div>
                      ) : (
                        <span className="badge badge-selesai">
                          <CheckCircle2 size={12} /> Aktif & Terverifikasi
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => setViewingEMR(item)}
                          title="Lihat Rincian Rekam Medis"
                        >
                          <Eye size={14} /> Detail
                        </button>

                        {!item.isDeleted && (
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => setEditingEMR(item)}
                            title="Edit rekam medis"
                          >
                            <Pencil size={14} /> Edit
                          </button>
                        )}

                        {!item.isDeleted && (
                          <button
                            className="btn btn-danger-outline btn-sm"
                            onClick={async () => {
                              const confirmed = window.confirm(
                                'Peringatan: rekam medis akan dihapus dan tidak dapat dipulihkan oleh dokter. Hanya admin yang dapat memulihkannya. Lanjutkan?'
                              );
                              if (!confirmed) return;
                              await deleteEMR(item.id);
                            }}
                            title="Hapus rekam medis ini"
                          >
                            <Trash2 size={14} /> Hapus
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {currentView === 'chat-history' && (
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title"><MessageCircle size={20} color="#0F766E" /> Riwayat Chat Konsultasi</h2>
              <p style={{ fontSize: '0.82rem', color: '#64748B', marginTop: 4 }}>
                Percakapan dari konsultasi chat maupun video yang telah selesai dapat dibaca kembali.
              </p>
            </div>
          </div>
          {completedChatAppointments.length === 0 ? (
            <p style={{ padding: '4px 0', color: '#64748B' }}>Belum ada riwayat konsultasi chat.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {completedChatAppointments.map((appointment) => (
                <div key={appointment.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 12, border: '1px solid #E2E8F0', borderRadius: 10 }}>
                  <div>
                    <strong>{appointment.patientName}</strong>
                    <div style={{ color: '#64748B', fontSize: 13 }}>{appointment.type} · {appointment.date} · {appointment.time}</div>
                    <div style={{ color: '#64748B', fontSize: 12 }}>{appointment.complaint || 'Tidak ada keluhan tercatat'}</div>
                  </div>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setTeleconsultationSession(appointment)}>
                    <MessageCircle size={15} /> Buka Chat
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {currentView === 'profile' && (
        <div className="card" style={{ padding: 24 }}>
          <div className="card-header">
            <div>
              <h2 className="card-title"><User size={20} color="#0F766E" /> Profil Dokter</h2>
              <p style={{ fontSize: '0.82rem', color: '#64748B', marginTop: 4 }}>
                Kelola informasi profesional dan foto profil yang ditampilkan kepada pasien.
              </p>
            </div>
          </div>
          <form onSubmit={handleDoctorProfileSubmit}>
            <div style={{ padding: '4px 0 22px' }}>
              <ProfilePhotoUpload file={profilePhoto} onFileChange={setProfilePhoto} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Nama dokter</label>
                <input className="form-input" value={doctorProfile.name} onChange={(event) => setDoctorProfile({ ...doctorProfile, name: event.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Spesialisasi</label>
                <input className="form-input" value={doctorProfile.specialization} onChange={(event) => setDoctorProfile({ ...doctorProfile, specialization: event.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Nomor STR / SIP</label>
                <input className="form-input" value={doctorProfile.strNumber} onChange={(event) => setDoctorProfile({ ...doctorProfile, strNumber: event.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Nomor telepon</label>
                <input className="form-input" value={doctorProfile.phone} onChange={(event) => setDoctorProfile({ ...doctorProfile, phone: event.target.value })} />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Tempat praktik</label>
                <input className="form-input" value={doctorProfile.workplace} onChange={(event) => setDoctorProfile({ ...doctorProfile, workplace: event.target.value })} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn btn-primary" disabled={savingProfile}>
                <Save size={16} /> {savingProfile ? 'Menyimpan…' : 'Simpan Profil'}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
