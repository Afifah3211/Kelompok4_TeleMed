import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  PhoneOff, 
  MessageSquare, 
  Send, 
  ShieldCheck, 
  Clock, 
  FileText,
  User,
  Stethoscope,
  Maximize2
} from 'lucide-react';

export default function TeleconsultationModal() {
  const { 
    teleconsultationSession, 
    setTeleconsultationSession, 
    currentUser, 
    updateAppointmentStatus,
    showToast 
  } = useApp();

  const [isMicOn, setIsMicOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [callDuration, setCallDuration] = useState(145); // in seconds
  const [messages, setMessages] = useState([
    {
      sender: 'Dokter',
      text: 'Halo Budi, selamat pagi. Bagaimana keluhan tengkuk kaku dan pusingnya hari ini?',
      time: '10:30'
    },
    {
      sender: 'Pasien',
      text: 'Selamat pagi dok. Masih agak berputar dok, terutama pas bangun tidur dan tensi mandiri tadi pagi 145/95 mmHg.',
      time: '10:31'
    },
    {
      sender: 'Dokter',
      text: 'Baik, saya periksa riwayat rekam medis sebelumnya ya. Apakah obat amlodipine yang kemarin masih rutin diminum?',
      time: '10:32'
    }
  ]);
  const [inputText, setInputText] = useState('');

  // Call timer simulation
  useEffect(() => {
    if (!teleconsultationSession) return;
    const timer = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [teleconsultationSession]);

  if (!teleconsultationSession) return null;

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const senderName = currentUser.role === 'dokter' ? 'Dokter' : 'Pasien';
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    setMessages((prev) => [
      ...prev,
      {
        sender: senderName,
        text: inputText.trim(),
        time: timeStr
      }
    ]);
    setInputText('');
  };

  const handleEndCall = () => {
    if (currentUser.role === 'dokter') {
      updateAppointmentStatus(teleconsultationSession.id, 'Selesai');
      showToast('Sesi telekonsultasi diakhiri oleh dokter. Silakan lengkapi Rekam Medis (EMR).', 'success');
    } else {
      showToast('Anda telah meninggalkan ruang telekonsultasi.', 'info');
    }
    setTeleconsultationSession(null);
  };

  return (
    <div className="modal-overlay" style={{ padding: 0 }}>
      <div 
        style={{ 
          width: '95vw', 
          maxWidth: '1280px', 
          height: '90vh', 
          backgroundColor: '#0F172A', 
          borderRadius: '16px', 
          overflow: 'hidden', 
          display: 'flex', 
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          border: '1px solid #1E293B'
        }}
      >
        {/* Header Room */}
        <div 
          style={{ 
            padding: '14px 24px', 
            background: 'rgba(15, 23, 42, 0.95)', 
            borderBottom: '1px solid #334155', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            color: '#FFFFFF'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div 
              style={{ 
                background: '#1D4ED8', 
                width: '36px', 
                height: '36px', 
                borderRadius: '8px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center' 
              }}
            >
              <Video size={20} color="#fff" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>MediSync Ruang Telemedis Terenkripsi</span>
                <span className="badge badge-accent" style={{ fontSize: '0.7rem' }}>
                  <ShieldCheck size={12} /> HIPAA Compliant
                </span>
              </div>
              <div style={{ fontSize: '0.8rem', color: '#94A3B8' }}>
                Pasien: {teleconsultationSession.patientName} • Dokter: {teleconsultationSession.doctorName}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div 
              style={{ 
                background: '#1E293B', 
                padding: '6px 14px', 
                borderRadius: '20px', 
                fontSize: '0.85rem', 
                color: '#38BDF8', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px' 
              }}
            >
              <Clock size={16} />
              <span>{formatTimer(callDuration)}</span>
            </div>

            <button
              onClick={() => setIsChatOpen(!isChatOpen)}
              style={{
                background: isChatOpen ? '#1D4ED8' : '#334155',
                border: 'none',
                color: '#fff',
                padding: '8px 14px',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.85rem',
                fontWeight: 600
              }}
            >
              <MessageSquare size={16} />
              <span>Obrolan ({messages.length})</span>
            </button>
          </div>
        </div>

        {/* Video Area + Chat Sidebar */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Main Video feeds */}
          <div 
            style={{ 
              flex: 1, 
              background: '#020617', 
              padding: '20px', 
              display: 'flex', 
              gap: '16px', 
              position: 'relative' 
            }}
          >
            {/* Primary stream: Doctor or Patient */}
            <div 
              style={{ 
                flex: 1, 
                backgroundColor: '#1E293B', 
                borderRadius: '12px', 
                overflow: 'hidden', 
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundImage: isVideoOn 
                  ? 'url("https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=1200&q=80")'
                  : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                boxShadow: '0 4px 20px rgba(0,0,0,0.4)'
              }}
            >
              {!isVideoOn && (
                <div style={{ textAlign: 'center', color: '#94A3B8' }}>
                  <Stethoscope size={56} style={{ margin: '0 auto 12px', color: '#38BDF8' }} />
                  <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#fff' }}>Kamera Dimatikan</div>
                  <div style={{ fontSize: '0.85rem' }}>Audio tetap terhubung secara aman</div>
                </div>
              )}

              {/* Label Name in stream */}
              <div 
                style={{ 
                  position: 'absolute', 
                  bottom: '16px', 
                  left: '16px', 
                  background: 'rgba(15, 23, 42, 0.75)', 
                  backdropFilter: 'blur(4px)',
                  padding: '6px 14px', 
                  borderRadius: '20px', 
                  color: '#fff', 
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10B981' }} />
                <span>{teleconsultationSession.doctorName} (Penyakit Dalam)</span>
              </div>
            </div>

            {/* Small PiP stream (Patient / Self) */}
            <div 
              style={{ 
                width: '260px', 
                height: '180px', 
                backgroundColor: '#0F172A', 
                borderRadius: '12px', 
                border: '2px solid #334155',
                overflow: 'hidden', 
                position: 'absolute', 
                top: '36px', 
                right: '36px',
                backgroundImage: 'url("https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80")',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                boxShadow: '0 10px 25px rgba(0,0,0,0.6)'
              }}
            >
              <div 
                style={{ 
                  position: 'absolute', 
                  bottom: '8px', 
                  left: '8px', 
                  background: 'rgba(15, 23, 42, 0.8)', 
                  padding: '4px 10px', 
                  borderRadius: '12px', 
                  color: '#fff', 
                  fontSize: '0.75rem' 
                }}
              >
                {teleconsultationSession.patientName} (Anda)
              </div>
            </div>
          </div>

          {/* Consultation Chat Drawer */}
          {isChatOpen && (
            <div 
              style={{ 
                width: '340px', 
                background: '#0F172A', 
                borderLeft: '1px solid #334155', 
                display: 'flex', 
                flexDirection: 'column' 
              }}
            >
              <div 
                style={{ 
                  padding: '14px 18px', 
                  borderBottom: '1px solid #1E293B', 
                  fontWeight: 600, 
                  color: '#F8FAFC',
                  fontSize: '0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <span>Catatan & Pesan Langsung</span>
                <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>Enkripsi 256-bit</span>
              </div>

              {/* Message List */}
              <div style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {messages.map((m, idx) => (
                  <div 
                    key={idx}
                    style={{
                      alignSelf: m.sender === 'Pasien' ? 'flex-end' : 'flex-start',
                      maxWidth: '85%'
                    }}
                  >
                    <div 
                      style={{ 
                        fontSize: '0.7rem', 
                        color: '#94A3B8', 
                        marginBottom: '4px',
                        textAlign: m.sender === 'Pasien' ? 'right' : 'left'
                      }}
                    >
                      {m.sender} • {m.time}
                    </div>
                    <div 
                      style={{ 
                        padding: '10px 14px', 
                        borderRadius: '12px',
                        fontSize: '0.85rem',
                        lineHeight: 1.4,
                        background: m.sender === 'Pasien' ? '#1D4ED8' : '#1E293B',
                        color: '#FFFFFF'
                      }}
                    >
                      {m.text}
                    </div>
                  </div>
                ))}
              </div>

              {/* Chat Input */}
              <form onSubmit={handleSendMessage} style={{ padding: '12px', borderTop: '1px solid #1E293B', display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="Ketik pesan konsultasi..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  style={{
                    flex: 1,
                    background: '#1E293B',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    color: '#fff',
                    fontSize: '0.85rem',
                    outline: 'none'
                  }}
                />
                <button
                  type="submit"
                  style={{
                    background: '#1D4ED8',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#fff',
                    padding: '8px 14px',
                    cursor: 'pointer'
                  }}
                >
                  <Send size={16} />
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Video Control Bar Footer */}
        <div 
          style={{ 
            padding: '16px 24px', 
            background: '#0B0F19', 
            borderTop: '1px solid #1E293B', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            gap: '16px' 
          }}
        >
          {/* Mic Toggle */}
          <button
            onClick={() => setIsMicOn(!isMicOn)}
            style={{
              background: isMicOn ? '#334155' : '#DC2626',
              border: 'none',
              borderRadius: '50%',
              width: '46px',
              height: '46px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            title={isMicOn ? 'Mute Mikrofon' : 'Nyalakan Mikrofon'}
          >
            {isMicOn ? <Mic size={20} /> : <MicOff size={20} />}
          </button>

          {/* Video Toggle */}
          <button
            onClick={() => setIsVideoOn(!isVideoOn)}
            style={{
              background: isVideoOn ? '#334155' : '#DC2626',
              border: 'none',
              borderRadius: '50%',
              width: '46px',
              height: '46px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            title={isVideoOn ? 'Matikan Kamera' : 'Nyalakan Kamera'}
          >
            {isVideoOn ? <Video size={20} /> : <VideoOff size={20} />}
          </button>

          {/* End Call Button */}
          <button
            onClick={handleEndCall}
            style={{
              background: '#DC2626',
              border: 'none',
              borderRadius: '24px',
              padding: '10px 24px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#fff',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(220, 38, 38, 0.4)'
            }}
          >
            <PhoneOff size={18} />
            <span>Akhiri Sesi Konsultasi</span>
          </button>
        </div>
      </div>
    </div>
  );
}
