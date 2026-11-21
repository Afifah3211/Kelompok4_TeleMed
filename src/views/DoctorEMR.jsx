import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
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
  RotateCcw,
  Heart,
  Stethoscope,
  Eye,
  AlertTriangle,
  Archive,
  MessageCircle,
  Plus
} from 'lucide-react';
import confetti from 'canvas-confetti';

export default function DoctorEMR() {
  const {
    currentUser,
    appointments,
    medicines,
    updateAppointmentStatus,
    emrs,
    saveEMR,
    softDeleteEMR,
    restoreEMR,
    setTeleconsultationSession,
    setViewingEMR,
    showToast
  } = useApp();

  // Tab: examination queue or medical-record archive.
  const [currentView, setCurrentView] = useState('emr-active');

  // The working queue contains only this doctor's consultations that still need action.
  const doctorAppointments = appointments.filter(
    (appointment) =>
      Number(appointment.doctorId) === Number(currentUser?.doctorId) &&
      ['Menunggu', 'Sedang Berlangsung'].includes(appointment.status)
  );

  // Selected patient for active consultation (default to first active appointment)
  const [selectedAppointmentId, setSelectedAppointmentId] = useState('');

  useEffect(() => {
    if (!doctorAppointments.some((appointment) => appointment.id === selectedAppointmentId)) {
      setSelectedAppointmentId(doctorAppointments[0]?.id || '');
    }
  }, [doctorAppointments, selectedAppointmentId]);

  const selectedAppointment = doctorAppointments.find((a) => a.id === selectedAppointmentId);

  // Consultation Form state (PRD Spec: 'Keluhan', 'Diagnosis', 'Tindakan', 'Resep Obat')
  const [complaint, setComplaint] = useState(selectedAppointment?.complaint || '');
  const [diagnosis, setDiagnosis] = useState('');
  const [action, setAction] = useState('');
  const [prescriptionItems, setPrescriptionItems] = useState([]);
  const [prescriptionNote, setPrescriptionNote] = useState('');
  const [saving, setSaving] = useState(false);
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
    if (!diagnosis.trim()) {
      alert('Harap isi Diagnosis pemeriksaan.');
      return;
    }

    const completedItems = prescriptionItems.map((item) => ({
      ...item,
      medicineId: Number(item.medicineId),
      quantity: Number(item.quantity),
      dosage: item.dosage.trim(),
    }));
    if (completedItems.some((item) => !item.medicineId || !item.quantity || !item.dosage)) {
      alert('Lengkapi obat, jumlah, dan aturan pakai pada setiap item resep.');
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
              {currentUser.name} • {currentUser.specialty || 'Dokter Spesialis'} • SIP: {currentUser.sip || '446/123/SIP/2022'}
            </div>
          </div>
        </div>

        {/* View Switcher: consultation queue and medical-record archive */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
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
            <Archive size={16} />
            <span>Arsip rekam medis ({emrs.length})</span>
          </button>

        </div>
      </div>

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
          <div className="card" style={{ padding: '20px' }}>
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
                        NIK: {selectedAppointment.patientNik}{selectedAppointment.patientAge ? ` | Usia: ${selectedAppointment.patientAge} thn` : '}{selectedAppointment.patientGender ? ` | Gender: ${selectedAppointment.patientGender}` : '}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {selectedAppointment.status === 'Menunggu' && (
                      <button
                        type="button"
                        className="btn btn-sm"
                        style={{ background: '#0F766E', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}
                        onClick={() => updateAppointmentStatus(selectedAppointment.id, 'Sedang Berlangsung')}
                      >
                        <CheckCircle2 size={15} />
                        <span>Mulai Konsultasi</span>
                      </button>
                    )}

                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => setTeleconsultationSession(selectedAppointment)}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      {isChatConsultation(selectedAppointment.type) ? <MessageCircle size={15} /> : <Video size={15} />}
                      <span>{isChatConsultation(selectedAppointment.type) ? 'Buka Chat Konsultasi' : 'Buka Ruang Video'}</span>
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

                {/* Structured e-prescription linked to the pharmacy catalog */}
                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <label className="form-label" style={{ margin: 0 }}>Resep Elektronik untuk Apoteker (opsional)</label>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => setPrescriptionItems((items) => [...items, { medicineId: '', quantity: 1, dosage: '' }])} disabled={medicines.length === 0}>
                      <Plus size={15} /> Tambah Obat
                    </button>
                  </div>
                  <p style={{ color: '#64748B', fontSize: 12, margin: '0 0 10px' }}>
                    Jika resep diterbitkan, obat dipilih dari katalog agar nama dan stok cocok dengan data farmasi. Tanpa item resep, rekam medis tetap tersimpan tanpa masuk antrean apoteker.
                  </p>
                  {medicines.length === 0 && <p style={{ color: '#B45309', fontSize: 12 }}>Katalog obat belum tersedia; minta apoteker mengisi inventori terlebih dahulu.</p>}
                  {prescriptionItems.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1.4fr) 110px minmax(200px, 1.5fr) auto', gap: 8, marginBottom: 5, color: '#64748B', fontSize: 11 }}>
                      <span>Obat dari katalog</span><span>Jumlah unit</span><span>Aturan pakai / dosis</span><span />
                    </div>
                  )}
                  {prescriptionItems.map((item, index) => (
                    <div key={index} style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1.4fr) 110px minmax(200px, 1.5fr) auto', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                      <select className="form-select" value={item.medicineId} required onChange={(event) => setPrescriptionItems((items) => items.map((row, rowIndex) => rowIndex === index ? { ...row, medicineId: event.target.value } : row))}>
                        <option value="">Pilih obat katalog</option>
                        {medicines.map((medicine) => <option key={medicine.id} value={medicine.id}>{medicine.name} — stok {medicine.stock} {medicine.unit}</option>)}
                      </select>
                      <input className="form-input" type="number" min="1" step="1" required aria-label="Jumlah unit stok" value={item.quantity} onChange={(event) => setPrescriptionItems((items) => items.map((row, rowIndex) => rowIndex === index ? { ...row, quantity: event.target.value } : row))} />
                      <input className="form-input" type="text" maxLength={500} required placeholder="Aturan pakai / dosis" value={item.dosage} onChange={(event) => setPrescriptionItems((items) => items.map((row, rowIndex) => rowIndex === index ? { ...row, dosage: event.target.value } : row))} />
                      <button type="button" className="btn btn-outline btn-sm" aria-label="Hapus item resep" onClick={() => setPrescriptionItems((items) => items.filter((_, rowIndex) => rowIndex !== index))}><Trash2 size={15} /></button>
                      {item.medicineId && <small style={{ gridColumn: '1 / -1', color: '#64748B' }}>Jumlah dihitung dalam unit stok: {medicines.find((medicine) => Number(medicine.id) === Number(item.medicineId))?.unit || 'unit'}.</small>}
                    </div>
                  ))}
                  {prescriptionItems.length > 0 && (
                    <textarea className="form-textarea" maxLength={1000} placeholder="Catatan dokter untuk apoteker (opsional), misalnya substitusi tidak diperbolehkan." value={prescriptionNote} onChange={(event) => setPrescriptionNote(event.target.value)} />
                  )}
                </div>

                {/* Primary Blue Button 'Simpan Rekam Medis' (PRD Spec) */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
                  <button
                    type="submit"
                    className="btn btn-primary btn-lg"
                    disabled={saving}
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
          VIEW 2: ARSIP REKAM MEDIS & SOFT DELETE (PRD Goals & Section 4)
         ========================================================================= */}
      {currentView === 'arsip' && (
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">
                <Archive size={20} color="#1D4ED8" />
                Arsip rekam medis
              </h2>
              <p style={{ fontSize: '0.82rem', color: '#64748B', marginTop: '2px' }}>
                Lihat catatan pemeriksaan dan pulihkan data yang diarsipkan bila diperlukan.
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

    </div>
  );
}
