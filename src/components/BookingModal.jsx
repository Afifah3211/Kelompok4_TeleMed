import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Calendar, Clock, Stethoscope, Video, MessageCircle, X, CheckCircle2 } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function BookingModal() {
  const { isBookingOpen, setIsBookingOpen, users, addAppointment, currentUser } = useApp();

  const doctors = users.filter((u) => u.role === 'dokter');

  const [selectedDoctorId, setSelectedDoctorId] = useState(doctors[0]?.id || '');
  const [date, setDate] = useState('2026-10-20');
  const [time, setTime] = useState('13:30 WIB');
  const [type, setType] = useState('Video Telekonsultasi');
  const [complaint, setComplaint] = useState('');

  if (!isBookingOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!complaint.trim()) {
      alert('Harap tuliskan keluhan awal Anda.');
      return;
    }

    const doctor = doctors.find((d) => d.id === selectedDoctorId) || doctors[0];

    addAppointment({
      doctorId: doctor.id,
      doctorName: doctor.name,
      specialty: doctor.specialty,
      date,
      time,
      type,
      complaint: complaint.trim(),
      notes: `Pasien: ${currentUser.name}`
    });

    // Confetti celebration
    try {
      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.6 }
      });
    } catch (err) {}

    setIsBookingOpen(false);
    setComplaint('');
  };

  const selectedDoctor = doctors.find((d) => d.id === selectedDoctorId) || doctors[0];

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Buat Janji Konsultasi Dokter</h3>
            <p style={{ fontSize: '0.82rem', color: '#64748B' }}>Pilih dokter spesialis dan waktu periksa secara online</p>
          </div>
          <button
            onClick={() => setIsBookingOpen(false)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* Select Doctor */}
            <div className="form-group">
              <label className="form-label">Pilih Dokter Spesialis</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {doctors.map((doc) => (
                  <div
                    key={doc.id}
                    onClick={() => setSelectedDoctorId(doc.id)}
                    style={{
                      border: `1.5px solid ${selectedDoctorId === doc.id ? '#1D4ED8' : '#E2E8F0'}`,
                      background: selectedDoctorId === doc.id ? '#EFF6FF' : '#FFFFFF',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <img 
                      src={doc.avatar} 
                      alt={doc.name} 
                      style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover' }} 
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0F172A' }}>{doc.name}</div>
                      <div style={{ fontSize: '0.8rem', color: '#0F766E', fontWeight: 600 }}>{doc.specialty}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{doc.hospital} • Pengalaman: {doc.experience}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1D4ED8' }}>{doc.fee}</div>
                      <div style={{ fontSize: '0.7rem', color: '#10B981', fontWeight: 600 }}>{doc.isOnline ? '● Online' : '○ Praktik'}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Date and Time */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div className="form-group">
                <label className="form-label">Tanggal Konsultasi</label>
                <input
                  type="date"
                  className="form-input"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Pilihan Jam / Sesi</label>
                <select 
                  className="form-select"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                >
                  <option value="09:00 WIB">09:00 WIB (Pagi)</option>
                  <option value="10:30 WIB">10:30 WIB (Pagi)</option>
                  <option value="11:15 WIB">11:15 WIB (Siang)</option>
                  <option value="13:30 WIB">13:30 WIB (Siang)</option>
                  <option value="15:00 WIB">15:00 WIB (Sore)</option>
                  <option value="19:00 WIB">19:00 WIB (Malam)</option>
                </select>
              </div>
            </div>

            {/* Consultation Type */}
            <div className="form-group">
              <label className="form-label">Metode Konsultasi</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <label 
                  style={{
                    border: `1.5px solid ${type === 'Video Telekonsultasi' ? '#1D4ED8' : '#E2E8F0'}`,
                    background: type === 'Video Telekonsultasi' ? '#EFF6FF' : '#FFF',
                    padding: '10px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: 600
                  }}
                >
                  <input
                    type="radio"
                    name="consultationType"
                    checked={type === 'Video Telekonsultasi'}
                    onChange={() => setType('Video Telekonsultasi')}
                    style={{ accentColor: '#1D4ED8' }}
                  />
                  <Video size={16} color="#1D4ED8" />
                  <span>Video Call Medis</span>
                </label>

                <label 
                  style={{
                    border: `1.5px solid ${type === 'Konsultasi Online' ? '#1D4ED8' : '#E2E8F0'}`,
                    background: type === 'Konsultasi Online' ? '#EFF6FF' : '#FFF',
                    padding: '10px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: 600
                  }}
                >
                  <input
                    type="radio"
                    name="consultationType"
                    checked={type === 'Konsultasi Online'}
                    onChange={() => setType('Konsultasi Online')}
                    style={{ accentColor: '#1D4ED8' }}
                  />
                  <MessageCircle size={16} color="#0F766E" />
                  <span>Chat & Telemedis</span>
                </label>
              </div>
            </div>

            {/* Keluhan */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Keluhan Utama / Gejala yang Dirasakan</label>
              <textarea
                className="form-textarea"
                placeholder="Contoh: Sakit kepala sebelah kiri berdenyut sejak 2 hari, disertai mual dan sensitif terhadap cahaya..."
                value={complaint}
                onChange={(e) => setComplaint(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setIsBookingOpen(false)}
            >
              Batal
            </button>
            <button type="submit" className="btn btn-primary">
              Konfirmasi Pemesanan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
