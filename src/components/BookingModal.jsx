import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Calendar, Clock, Stethoscope, Video, MessageCircle, X, CheckCircle2 } from 'lucide-react';
import confetti from 'canvas-confetti';

function getTodayLocalDate() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function BookingModal() {
  const { isBookingOpen, setIsBookingOpen, users, addAppointment, currentUser } = useApp();

  const doctors = users.filter((u) => u.role === 'dokter' && u.status === 'Aktif');
  const timeSlots = Array.from({ length: 17 }, (_, index) => {
    const totalMinutes = 9 * 60 + index * 30;
    const hour = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
    const minute = String(totalMinutes % 60).padStart(2, '0');
    return `${hour}:${minute} WIB`;
  });
  const todayStr = getTodayLocalDate();

  const [selectedDoctorId, setSelectedDoctorId] = useState(doctors[0]?.id || '');
  const [date, setDate] = useState(todayStr);
  const [time, setTime] = useState('13:30 WIB');
  const [type, setType] = useState('');
  const [complaint, setComplaint] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState('');

  useEffect(() => {
    if (isBookingOpen) {
      const currentToday = getTodayLocalDate();
      setDate((prev) => (prev < currentToday ? currentToday : prev));
    }
  }, [isBookingOpen]);

  useEffect(() => {
    if (!selectedDoctorId && doctors.length > 0) setSelectedDoctorId(doctors[0].id);
  }, [doctors, selectedDoctorId]);

  useEffect(() => {
    if (isBookingOpen) {
      setType('');
      setComplaint('');
    }
  }, [isBookingOpen]);

  if (!isBookingOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBookingError('');
    if (!complaint.trim()) {
      alert('Harap tuliskan keluhan awal Anda.');
      return;
    }
    if (!type) {
      alert('Pilih metode konsultasi Chat atau Video Call.');
      return;
    }

    const doctor = doctors.find((d) => d.id === selectedDoctorId) || doctors[0];
    if (!doctor) {
      alert('Dokter belum tersedia. Coba muat ulang halaman.');
      return;
    }

    setSubmitting(true);
    try {
      await addAppointment({
        doctorId: doctor.id,
        doctorName: doctor.name,
        specialty: doctor.specialty,
        date,
        time,
        type,
        complaint: complaint.trim(),
        notes: `Pasien: ${currentUser.name}`
      });

      try {
        confetti({
          particleCount: 70,
          spread: 60,
          origin: { y: 0.6 }
        });
      } catch (err) {}

      setIsBookingOpen(false);
      setComplaint('');
    } catch (error) {
      setBookingError(error.message || 'Jadwal konsultasi gagal dibuat.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedDoctor = doctors.find((d) => d.id === selectedDoctorId) || doctors[0];

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Buat Janji Konsultasi Dokter</h3>
            <p style={{ fontSize: '0.82rem', color: '#64748B' }}>Setiap konsultasi berlangsung 30 menit; konflik dokter dan pasien divalidasi saat pemesanan.</p>
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
            {bookingError && <div role="alert" style={{ color: '#B91C1C', background: '#FEF2F2', padding: 10, borderRadius: 8, marginBottom: 14 }}>{bookingError}</div>}
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
                  min={todayStr}
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
                  {timeSlots.map((slot) => <option key={slot} value={slot}>{slot}</option>)}
                </select>
              </div>
            </div>

            {/* Consultation Type */}
            <div className="form-group">
              <label className="form-label">Metode Konsultasi</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <label 
                  style={{
                    border: `1.5px solid ${type === 'Video Call' ? '#1D4ED8' : '#E2E8F0'}`,
                    background: type === 'Video Call' ? '#EFF6FF' : '#FFF',
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
                    value="Video Call"
                    required
                    checked={type === 'Video Call'}
                    onChange={() => setType('Video Call')}
                    style={{ accentColor: '#1D4ED8' }}
                  />
                  <Video size={16} color="#1D4ED8" />
                  <span>Video Call Medis</span>
                </label>

                <label 
                  style={{
                    border: `1.5px solid ${type === 'Chat' ? '#1D4ED8' : '#E2E8F0'}`,
                    background: type === 'Chat' ? '#EFF6FF' : '#FFF',
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
                    value="Chat"
                    required
                    checked={type === 'Chat'}
                    onChange={() => setType('Chat')}
                    style={{ accentColor: '#1D4ED8' }}
                  />
                  <MessageCircle size={16} color="#0F766E" />
                  <span>Chat konsultasi</span>
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
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Menyimpan…' : 'Konfirmasi Pemesanan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
