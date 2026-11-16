import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  Calendar,
  Clock,
  User,
  FileText,
  Save,
  Video,
  CheckCircle2,
  Trash2,
  RotateCcw,
  Heart,
  Sparkles,
  Stethoscope,
  Eye,
  AlertTriangle,
  Archive,
  HardDrive,
  ExternalLink,
  UploadCloud,
  RefreshCw
} from 'lucide-react';
import confetti from 'canvas-confetti';
import FileUpload from '../components/FileUpload';
import { filesApi } from '../services/api';

const ICD10_PRESETS = [
  { code: 'I10', label: 'Hipertensi Primer Esensial' },
  { code: 'J02.9', label: 'Faringitis Akut' },
  { code: 'K30', label: 'Dispepsia Fungsional' },
  { code: 'E11.9', label: 'Diabetes Melitus Tipe 2' },
  { code: 'J06.9', label: 'Infeksi Saluran Pernapasan Akut (ISPA)' }
];

export default function DoctorEMR() {
  const {
    currentUser,
    appointments,
    confirmAppointment,
    updateAppointmentStatus,
    emrs,
    saveEMR,
    softDeleteEMR,
    restoreEMR,
    setTeleconsultationSession,
    setViewingEMR,
    showToast
  } = useApp();

  const [cdnFiles, setCdnFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(false);

  const loadStorageFiles = async () => {
    setLoadingFiles(true);
    try {
      const data = await filesApi.listFiles();
      setCdnFiles(data.files || []);
    } catch (err) {
      console.error('Gagal memuat file CDN:', err);
    } finally {
      setLoadingFiles(false);
    }
  };

  useEffect(() => {
    loadStorageFiles();
  }, []);

  // Tab: 'emr-active' (split-screen today's consultation) or 'arsip' (EMR list & soft deleted records)
  const [currentView, setCurrentView] = useState('emr-active');

  // Demo fallback jika database belum memiliki jadwal konsultasi hari ini
  const demoFallbackAppointments = [
    {
      id: 101,
      patientId: 1,
      patientName: 'Budi Santoso',
      patientNik: '3273011405890002',
      patientGender: 'Laki-laki',
      patientAge: '35 thn',
      complaint: 'Pusing berputar dan tengkuk terasa berat sejak kemarin.',
      time: '09:00 WIB',
      status: 'Menunggu'
    },
    {
      id: 102,
      patientId: 2,
      patientName: 'Siti Rahmawati',
      patientNik: '3273026811940005',
      patientGender: 'Perempuan',
      patientAge: '29 thn',
      complaint: 'Nyeri ulu hati panas dan perih setelah minum kopi.',
      time: '10:30 WIB',
      status: 'Menunggu'
    }
  ];

  // Filter jadwal konsultasi dokter: cocokkan user id atau doctorId profil, atau tampilkan semua untuk demo
  const filteredAppointments = appointments.filter(
    (a) =>
      a.doctorId === currentUser?.id ||
      a.doctorId === currentUser?.doctorId ||
      currentUser?.role === 'admin'
  );

  const doctorAppointments = filteredAppointments.length > 0 
    ? filteredAppointments 
    : (appointments.length > 0 ? appointments : demoFallbackAppointments);

  // Selected patient for active consultation (default to first active appointment)
  const [selectedAppointmentId, setSelectedAppointmentId] = useState(
    doctorAppointments[0]?.id || ''
  );

  const selectedAppointment = doctorAppointments.find((a) => a.id === selectedAppointmentId) || doctorAppointments[0];

  // Consultation Form state (PRD Spec: 'Keluhan', 'Diagnosis', 'Tindakan', 'Resep Obat')
  const [complaint, setComplaint] = useState(selectedAppointment?.complaint || '');
  const [diagnosis, setDiagnosis] = useState('');
  const [action, setAction] = useState('');
  const [prescription, setPrescription] = useState('');
  const [vitals, setVitals] = useState({
    bp: '120/80 mmHg',
    heartRate: '76 bpm',
    temperature: '36.7 °C',
    weight: '68 kg'
  });

  useEffect(() => {
    if (selectedAppointment) {
      setComplaint(selectedAppointment.complaint || '');
    }
  }, [selectedAppointment?.id]);

  // State untuk lampiran file (CDN upload - Pertemuan 5)
  const [attachments, setAttachments] = useState([]);
  const handleFileUploaded = (fileData) => {
    setAttachments((prev) => [...prev, fileData]);
    showToast('Lampiran berhasil diupload ke CDN', 'success');
  };

  // When changing selected patient, update complaint template
  const handleSelectAppointment = (apt) => {
    setSelectedAppointmentId(apt.id);
    setComplaint(apt.complaint || '');
    setDiagnosis('');
    setAction('');
    setPrescription('');
  };

  // Submit active consultation form
  const handleSaveEMR = (e) => {
    e.preventDefault();

    if (!selectedAppointment) {
      alert('Pilih pasien antrean terlebih dahulu.');
      return;
    }
    if (!diagnosis.trim()) {
      alert('Harap isi Diagnosis pemeriksaan.');
      return;
    }

    let finalAction = action.trim() || 'Edukasi istirahat cukup dan pola makan sehat.';
    if (attachments.length > 0) {
      finalAction += '\n\n[Lampiran Dokumen CDN]:\n' + attachments.map(a => `- ${a.filename}: ${a.cdn_url}`).join('\n');
    }

    saveEMR({
      appointmentId: selectedAppointment.id,
      patientId: selectedAppointment.patientId,
      patientName: selectedAppointment.patientName,
      patientNik: selectedAppointment.patientNik,
      patientGender: selectedAppointment.patientGender || 'Laki-laki',
      patientAge: selectedAppointment.patientAge || '35 thn',
      complaint: complaint.trim(),
      diagnosis: diagnosis.trim(),
      action: finalAction,
      prescription: prescription.trim() || 'Tidak ada resep obat (terapi suportif).',
      vitals
    });

    try {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 }
      });
    } catch (err) { }

    // Reset form for next patient
    setDiagnosis('');
    setAction('');
    setPrescription('');
  };

  // Preset ICD-10 quick filler
  const handleSelectPreset = (item) => {
    setDiagnosis(`${item.label} (ICD-10: ${item.code})`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
              Portal Dokter & Rekam Medis (Doctor EMR)
            </h1>
            <div style={{ fontSize: '0.82rem', color: '#64748B' }}>
              {currentUser.name} • {currentUser.specialty || 'Dokter Spesialis'} • SIP: {currentUser.sip || '446/123/SIP/2022'}
            </div>
          </div>
        </div>

        {/* View Switcher: Split-Screen Consultation vs Arsip Rekam Medis vs CDN Storage */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className={`btn btn-sm ${currentView === 'emr-active' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setCurrentView('emr-active')}
          >
            <Clock size={16} />
            <span>Pemeriksaan Hari Ini (Split-Screen)</span>
          </button>

          <button
            className={`btn btn-sm ${currentView === 'arsip' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setCurrentView('arsip')}
          >
            <Archive size={16} />
            <span>Semua Rekam Medis & Arsip Soft Delete ({emrs.length})</span>
          </button>

          <button
            className={`btn btn-sm ${currentView === 'cdn-files' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => {
              setCurrentView('cdn-files');
              loadStorageFiles();
            }}
            style={{
              backgroundColor: currentView === 'cdn-files' ? '#0F766E' : 'transparent',
              borderColor: '#0F766E',
              color: currentView === 'cdn-files' ? '#FFFFFF' : '#0F766E',
              fontWeight: 600
            }}
          >
            <HardDrive size={16} />
            <span>📁 Berkas Medis (CDN Storage)</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          VIEW 1: SPLIT SCREEN LAYOUT (PRD Halaman 3 Prompt 2)
          Left column: Today's appointments (Patient name, time, status with teal #0F766E)
          Right column: Active Consultation Form (Keluhan, Diagnosis, Tindakan, Resep Obat)
          Button: Simpan Rekam Medis (Primary Blue)
         ========================================================================= */}
      {currentView === 'emr-active' && (
        <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '24px', alignItems: 'start' }}>
          {/* Left Column: Jadwal Hari Ini / Today's appointments */}
          <div className="card" style={{ padding: '20px' }}>
            <div className="card-header" style={{ marginBottom: '14px', paddingBottom: '12px' }}>
              <div>
                <h2 className="card-title" style={{ fontSize: '1.05rem' }}>
                  <Calendar size={18} color="#0F766E" />
                  Jadwal Hari Ini
                </h2>
                <p style={{ fontSize: '0.78rem', color: '#64748B' }}>
                  Daftar antrean konsultasi pasien hari ini
                </p>
              </div>
              <span className="badge badge-accent" style={{ color: '#0F766E' }}>
                {doctorAppointments.length} Pasien
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
            </div>
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
                        NIK: {selectedAppointment.patientNik} • Usia: {selectedAppointment.patientAge || '35 thn'} • Gender: {selectedAppointment.patientGender || 'Laki-laki'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {selectedAppointment.status === 'Menunggu' && (
                      <button
                        type="button"
                        className="btn btn-sm"
                        style={{ background: '#0F766E', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}
                        onClick={() => confirmAppointment(selectedAppointment.id, 'Dikonfirmasi')}
                      >
                        <CheckCircle2 size={15} />
                        <span>Konfirmasi Jadwal</span>
                      </button>
                    )}

                    {selectedAppointment.status === 'Dikonfirmasi' && (
                      <button
                        type="button"
                        className="btn btn-sm"
                        style={{ background: '#2563EB', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}
                        onClick={() => confirmAppointment(selectedAppointment.id, 'Sedang Berlangsung')}
                      >
                        <Clock size={15} />
                        <span>Mulai Konsultasi</span>
                      </button>
                    )}

                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => setTeleconsultationSession(selectedAppointment)}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Video size={15} />
                      <span>Telekonsultasi Room</span>
                    </button>
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
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <label className="form-label" style={{ marginBottom: 0 }}>
                      Diagnosis Klinis (Assessment Medis)
                    </label>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.72rem', color: '#64748B' }}>Preset ICD-10:</span>
                      {ICD10_PRESETS.slice(0, 3).map((p) => (
                        <button
                          key={p.code}
                          type="button"
                          onClick={() => handleSelectPreset(p)}
                          style={{
                            background: '#F1F5F9',
                            border: '1px solid #CBD5E1',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '0.7rem',
                            cursor: 'pointer',
                            color: '#334155'
                          }}
                        >
                          {p.code}
                        </button>
                      ))}
                    </div>
                  </div>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Contoh: Hipertensi Primer Esensial (ICD-10: I10)"
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

                {/* Lampiran File - CDN Upload (Pertemuan 5) */}
                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <FileUpload
                    label="📎 Lampiran Dokumen / Foto (opsional)"
                    onUploaded={handleFileUploaded}
                    accept="image/*,application/pdf,text/plain"
                  />
                  {attachments.length > 0 && (
                    <div style={{ marginTop: '8px', fontSize: '0.78rem', color: '#6B7280' }}>
                      <strong>{attachments.length} lampiran terlampir:</strong>{' '}
                      {attachments.map((a, i) => (
                        <span key={i}>
                          <a href={a.cdn_url} target="_blank" rel="noopener noreferrer" style={{ color: '#3B82F6' }}>
                            {a.filename}
                          </a>
                          {i < attachments.length - 1 ? ', ' : ''}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {/* 4. Clean Text Input for 'Resep Obat' (PRD Spec) */}
                <div className="form-group">
                  <label className="form-label">
                    Resep Obat Elektronik (e-Prescription)
                  </label>
                  <textarea
                    className="form-textarea"
                    placeholder="Nama obat, sediaan dosis, signa/aturan pakai, jumlah tablet. Contoh:&#10;Amlodipine 5mg (1x1 tablet pagi sesudah makan - No. XXX)&#10;Paracetamol 500mg (3x1 tablet jika pusing - No. X)"
                    value={prescription}
                    onChange={(e) => setPrescription(e.target.value)}
                  />
                </div>

                {/* Primary Blue Button 'Simpan Rekam Medis' (PRD Spec) */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
                  <button
                    type="submit"
                    className="btn btn-primary btn-lg"
                    style={{
                      backgroundColor: '#1D4ED8',
                      boxShadow: '0 4px 14px rgba(29, 78, 216, 0.3)',
                      fontWeight: 700
                    }}
                  >
                    <Save size={18} />
                    <span>Simpan Rekam Medis</span>
                  </button>
                </div>
              </form>
            ) : (
              <div style={{ textAlign: 'center', padding: '48px 20px', color: '#64748B' }}>
                <User size={40} style={{ color: '#CBD5E1', margin: '0 auto 12px' }} />
                <div style={{ fontWeight: 600 }}>Tidak ada pasien antrean yang dipilih</div>
                <div style={{ fontSize: '0.85rem', marginTop: '4px' }}>Silakan klik salah satu pasien pada daftar jadwal hari ini di sebelah kiri.</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 2: ARSIP REKAM MEDIS & SOFT DELETE (PRD Goals & Section 4)
         ========================================================================= */}
      {currentView === 'arsip' && (
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">
                <Archive size={20} color="#1D4ED8" />
                Arsip Rekam Medis (EMR Database)
              </h2>
              <p style={{ fontSize: '0.82rem', color: '#64748B', marginTop: '2px' }}>
                Fitur Keamanan Data: Data terhapus menggunakan mekanisme <strong>Soft Delete</strong> sehingga data fisik kesehatan pasien tetap terjaga aman.
              </p>
            </div>
          </div>

          {/* Banner Akses Cepat CDN Pertemuan 5 */}
          <div style={{ margin: '0 24px 16px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '12px', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <HardDrive size={20} color="#166534" />
              </div>
              <div>
                <strong style={{ color: '#166534', fontSize: '0.9rem', display: 'block' }}>
                  Fitur Tugas Pertemuan 5: File Management & CDN Berbasis Docker
                </strong>
                <span style={{ color: '#374151', fontSize: '0.8rem' }}>
                  Ingin upload foto/dokumen medis ke MinIO S3 & menguji URL Edge CDN? Buka tab <strong>Pemeriksaan Hari Ini</strong> atau tab <strong>CDN File Explorer</strong>.
                </span>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              style={{ backgroundColor: '#059669', borderColor: '#059669', fontWeight: 600 }}
              onClick={() => {
                setCurrentView('cdn-files');
                loadStorageFiles();
              }}
            >
              <UploadCloud size={14} />
              <span>Buka CDN File Explorer</span>
            </button>
          </div>

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
                {emrs.map((item) => (
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
                            <AlertTriangle size={12} /> Terhapus (Soft Delete)
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

                        {item.isDeleted ? (
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => restoreEMR(item.id)}
                            title="Pulihkan data rekam medis"
                          >
                            <RotateCcw size={14} /> Pulihkan
                          </button>
                        ) : (
                          <button
                            className="btn btn-danger-outline btn-sm"
                            onClick={() => {
                              const reason = prompt('Masukkan alasan soft delete rekam medis:', 'Koreksi administratif data rekam medis');
                              if (reason) softDeleteEMR(item.id, reason);
                            }}
                            title="Lakukan soft delete pada rekam medis ini"
                          >
                            <Trash2 size={14} /> Soft Delete
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

      {/* =========================================================================
          VIEW 3: CDN & FILE STORAGE EXPLORER (Pertemuan 5 CDN)
         ========================================================================= */}
      {currentView === 'cdn-files' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* CDN Architecture Banner */}
          <div className="card" style={{ padding: '24px', background: 'linear-gradient(135deg, #F0FDF4 0%, #FFFFFF 100%)', border: '1px solid #BBF7D0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <HardDrive size={24} color="#059669" />
                  <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#065F46', margin: 0 }}>
                    File Management & Content Delivery Network (CDN)
                  </h2>
                  <span className="badge" style={{ backgroundColor: '#DCFCE7', color: '#166534', fontWeight: 700 }}>
                    Pertemuan 5
                  </span>
                </div>
                <p style={{ fontSize: '0.88rem', color: '#374151', margin: 0, maxWidth: '800px', lineHeight: 1.5 }}>
                  Arsitektur CDN lokal: Seluruh file statis (dokumen/gambar) dilayani langsung oleh <strong>Nginx Edge Cache</strong> (port 8080) dan diteruskan ke <strong>MinIO S3 Storage</strong> (port 9000/9001). Backend app server tidak melayani file statis dari disk lokal.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <a
                  href="http://localhost:9001"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-sm btn-outline"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <ExternalLink size={14} />
                  <span>Buka MinIO Console (:9001)</span>
                </a>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={loadStorageFiles}
                  disabled={loadingFiles}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#059669', borderColor: '#059669' }}
                >
                  <RefreshCw size={14} className={loadingFiles ? 'spin' : ''} />
                  <span>Refresh Storage</span>
                </button>
              </div>
            </div>

            {/* Verification Info Badges */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '18px' }}>
              <div style={{ background: '#FFFFFF', padding: '8px 14px', borderRadius: '8px', border: '1px solid #D1FAE5', fontSize: '0.8rem', color: '#065F46' }}>
                🌐 <strong>Edge CDN Node:</strong> Nginx Reverse Proxy (<code>/files/</code>)
              </div>
              <div style={{ background: '#FFFFFF', padding: '8px 14px', borderRadius: '8px', border: '1px solid #D1FAE5', fontSize: '0.8rem', color: '#065F46' }}>
                🗄️ <strong>S3 Bucket:</strong> <code>telemed-files</code> (MinIO/Silo)
              </div>
              <div style={{ background: '#FFFFFF', padding: '8px 14px', borderRadius: '8px', border: '1px solid #D1FAE5', fontSize: '0.8rem', color: '#065F46' }}>
                ⚡ <strong>Cache Policy:</strong> <code>Cache-Control: public, max-age=86400</code>
              </div>
              <div style={{ background: '#FFFFFF', padding: '8px 14px', borderRadius: '8px', border: '1px solid #D1FAE5', fontSize: '0.8rem', color: '#065F46' }}>
                🔍 <strong>Response Header:</strong> <code>X-CDN-Node: telemed-minio-local</code>
              </div>
            </div>
          </div>

          {/* Upload Card */}
          <div className="card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '6px', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <UploadCloud size={18} color="#2563EB" />
              Upload Aset Medis ke CDN Storage
            </h3>
            <p style={{ fontSize: '0.82rem', color: '#64748B', marginBottom: '16px' }}>
              Unggah file dokumen resep, hasil lab (PDF), atau gambar medis (JPG, PNG). File otomatis masuk ke MinIO S3 dan disajikan via CDN.
            </p>

            <FileUpload
              label="Pilih atau Drop File Aset Medis"
              onUploaded={() => {
                loadStorageFiles();
                showToast('File berhasil diunggah ke CDN & MinIO Storage!', 'success');
              }}
            />
          </div>

          {/* Stored Files Table */}
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={18} color="#059669" />
                Daftar File Tersimpan di MinIO S3 & CDN ({cdnFiles.length})
              </h3>
              <span style={{ fontSize: '0.78rem', color: '#64748B' }}>
                Bucket: <strong>telemed-files</strong>
              </span>
            </div>

            {loadingFiles ? (
              <div style={{ textAlign: 'center', padding: '32px', color: '#64748B' }}>Memuat daftar file dari storage...</div>
            ) : cdnFiles.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748B', background: '#F8FAFC', borderRadius: '12px', border: '1px dashed #CBD5E1' }}>
                <HardDrive size={36} color="#94A3B8" style={{ margin: '0 auto 10px' }} />
                <div style={{ fontWeight: 600 }}>Belum ada file di MinIO Storage</div>
                <div style={{ fontSize: '0.82rem', marginTop: '4px' }}>
                  Gunakan box upload di atas untuk mengunggah file uji coba pertama Anda.
                </div>
              </div>
            ) : (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>No</th>
                      <th>Object Key (MinIO)</th>
                      <th>Ukuran</th>
                      <th>Terakhir Diubah</th>
                      <th>Akses CDN (Nginx Edge)</th>
                      <th style={{ textAlign: 'right' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cdnFiles.map((file, idx) => (
                      <tr key={file.key}>
                        <td>{idx + 1}</td>
                        <td>
                          <span style={{ fontWeight: 600, color: '#1E293B', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                            {file.key}
                          </span>
                        </td>
                        <td>{(file.size_bytes / 1024).toFixed(1)} KB</td>
                        <td style={{ fontSize: '0.8rem', color: '#64748B' }}>
                          {new Date(file.last_modified).toLocaleString('id-ID')}
                        </td>
                        <td>
                          <a
                            href={file.cdn_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              color: '#059669',
                              fontWeight: 600,
                              textDecoration: 'underline',
                              fontSize: '0.85rem'
                            }}
                          >
                            <span>{file.cdn_url}</span>
                            <ExternalLink size={12} />
                          </a>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <a
                            href={file.cdn_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-sm btn-outline"
                            style={{ padding: '4px 10px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            <ExternalLink size={13} />
                            <span>Buka di CDN</span>
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
