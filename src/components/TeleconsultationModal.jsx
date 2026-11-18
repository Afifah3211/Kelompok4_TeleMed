import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { chatApi } from '../services/api';
import { isChatConsultation } from '../utils/consultation';
import {
  Video,
  MessageCircle,
  ImagePlus,
  Send,
  X,
  Clock,
  UserRound,
  Stethoscope,
  LoaderCircle,
} from 'lucide-react';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export default function TeleconsultationModal() {
  const { teleconsultationSession, setTeleconsultationSession, currentUser, showToast } = useApp();
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState('');
  const [duration, setDuration] = useState(0);
  const imageInputRef = useRef(null);
  const messageListRef = useRef(null);

  const consultationId = teleconsultationSession?.id;
  const isChatOnly = isChatConsultation(teleconsultationSession?.type);

  useEffect(() => {
    if (!consultationId || !isChatOnly) {
      setMessages([]);
      setChatError('');
      return undefined;
    }
    let active = true;

    const loadMessages = async (showSpinner = false) => {
      if (showSpinner && active) setLoading(true);
      try {
        const result = await chatApi.getMessages(consultationId);
        if (active) {
          setMessages(Array.isArray(result) ? result : []);
          setChatError('');
        }
      } catch (error) {
        if (active) setChatError(error.message || 'Pesan konsultasi gagal dimuat.');
      } finally {
        if (showSpinner && active) setLoading(false);
      }
    };

    setMessages([]);
    setMessageText('');
    setSelectedImage(null);
    setChatError('');
    if (imageInputRef.current) imageInputRef.current.value = '';
    loadMessages(true);
    const poll = window.setInterval(() => loadMessages(false), 4000);
    return () => {
      active = false;
      window.clearInterval(poll);
    };
  }, [consultationId, isChatOnly]);

  useEffect(() => {
    if (!consultationId || isChatOnly) return undefined;
    setDuration(0);
    const timer = window.setInterval(() => setDuration((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [consultationId, isChatOnly]);

  useEffect(() => {
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [messages.length]);

  if (!teleconsultationSession) return null;

  const formatDuration = (seconds) =>
    `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

  const chooseImage = (event) => {
    const image = event.target.files?.[0];
    if (!image) return;
    if (!ALLOWED_IMAGE_TYPES.includes(image.type)) {
      showToast('Lampiran chat hanya menerima JPG, PNG, atau WebP.', 'danger');
      event.target.value = '';
      return;
    }
    if (image.size > MAX_IMAGE_BYTES) {
      showToast('Ukuran gambar maksimal 5 MB.', 'danger');
      event.target.value = '';
      return;
    }
    setSelectedImage(image);
  };

  const sendMessage = async (event) => {
    event.preventDefault();
    if (!messageText.trim() && !selectedImage) return;

    setSending(true);
    setChatError('');
    try {
      await chatApi.sendMessage(consultationId, messageText.trim(), selectedImage);
      setMessageText('');
      setSelectedImage(null);
      if (imageInputRef.current) imageInputRef.current.value = '';
      const updated = await chatApi.getMessages(consultationId);
      setMessages(Array.isArray(updated) ? updated : []);
    } catch (error) {
      setChatError(error.message || 'Pesan gagal dikirim.');
    } finally {
      setSending(false);
    }
  };

  const isDoctor = currentUser?.role === 'dokter';
  const roomTitle = isChatOnly ? 'Chat Konsultasi' : 'Ruang Video Konsultasi';
  const otherParticipant = isDoctor
    ? teleconsultationSession.patientName
    : teleconsultationSession.doctorName;
  const conversationClosed = ['Selesai', 'Dibatalkan'].includes(teleconsultationSession.status);

  return (
    <div className="modal-overlay" style={{ padding: 12, zIndex: 1000 }}>
      <section style={{ width: 'min(1100px, 96vw)', height: 'min(760px, 92vh)', background: '#fff', borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 70px rgba(15,23,42,.28)' }}>
        <header style={{ padding: '16px 20px', background: '#0F172A', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <div style={{ width: 40, height: 40, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: 10, background: '#1D4ED8' }}>
              {isChatOnly ? <MessageCircle size={21} /> : <Video size={21} />}
            </div>
            <div style={{ minWidth: 0 }}>
              <strong style={{ display: 'block' }}>{roomTitle}</strong>
              <span style={{ color: '#CBD5E1', fontSize: 13 }}>Konsultasi #{consultationId} · {otherParticipant}</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {!isChatOnly && <span style={{ color: '#BFDBFE', fontSize: 13 }}><Clock size={14} style={{ verticalAlign: 'middle' }} /> {formatDuration(duration)}</span>}
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setTeleconsultationSession(null)} style={{ color: '#fff', borderColor: '#475569' }}>
              <X size={15} /> Tutup
            </button>
          </div>
        </header>

        <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1fr' }}>
          {!isChatOnly && (
            <div style={{ background: '#F1F5F9', display: 'grid', placeItems: 'center', padding: 24 }}>
              <div style={{ width: '100%', maxWidth: 640, minHeight: 330, borderRadius: 16, background: '#0F172A', color: '#fff', display: 'grid', placeItems: 'center', textAlign: 'center', padding: 28 }}>
                <div>
                  <Video size={48} color="#93C5FD" style={{ marginBottom: 12 }} />
                  <h2 style={{ color: '#fff', margin: '0 0 8px' }}>Ruang video demo</h2>
                  <p style={{ color: '#CBD5E1', margin: 0, maxWidth: 420 }}>
                    Ini tampilan demo. Streaming kamera real-time belum terhubung. Pesan dan lampiran gambar tersedia melalui konsultasi bermetode Chat.
                  </p>
                </div>
              </div>
            </div>
          )}

          {isChatOnly && <div style={{ minHeight: 0, display: 'flex', flexDirection: 'column', background: '#fff' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #E2E8F0' }}>
              <strong style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#0F172A' }}>
                {isDoctor ? <Stethoscope size={17} /> : <UserRound size={17} />}
                Pesan dengan {otherParticipant}
              </strong>
              <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>Pesan dan gambar disimpan pada konsultasi ini.</div>
            </div>

            <div ref={messageListRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12, background: '#F8FAFC' }}>
              {loading && messages.length === 0 && <p style={{ color: '#64748B', textAlign: 'center' }}>Memuat percakapan…</p>}
              {!loading && messages.length === 0 && <p style={{ color: '#64748B', textAlign: 'center', margin: 'auto' }}>Belum ada pesan. Mulai percakapan atau kirim gambar kondisi yang ingin dibahas.</p>}
              {messages.map((item) => {
                const ownMessage = Number(item.sender_user_id) === Number(currentUser?.id);
                return (
                  <article key={item.id} style={{ alignSelf: ownMessage ? 'flex-end' : 'flex-start', maxWidth: '88%', padding: 12, borderRadius: 12, background: ownMessage ? '#DBEAFE' : '#fff', border: '1px solid #E2E8F0' }}>
                    <div style={{ color: '#475569', fontSize: 11, marginBottom: 5 }}>{ownMessage ? 'Anda' : item.sender_name} · {new Date(item.created_at).toLocaleString('id-ID')}</div>
                    {item.body && <div style={{ color: '#0F172A', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{item.body}</div>}
                    {item.attachment && (
                      <a href={item.attachment.url} target="_blank" rel="noreferrer" style={{ display: 'block', marginTop: item.body ? 8 : 0 }}>
                        <img src={item.attachment.url} alt={item.attachment.filename} loading="lazy" style={{ display: 'block', maxWidth: 260, maxHeight: 220, objectFit: 'contain', borderRadius: 8, background: '#fff' }} />
                        <span style={{ display: 'block', fontSize: 11, marginTop: 4 }}>{item.attachment.filename}</span>
                      </a>
                    )}
                  </article>
                );
              })}
            </div>

            {chatError && <div role="alert" style={{ padding: '8px 14px', color: '#B91C1C', background: '#FEF2F2', fontSize: 13 }}>{chatError}</div>}
            {conversationClosed ? (
              <div style={{ padding: 14, borderTop: '1px solid #E2E8F0', color: '#64748B', fontSize: 13 }}>
                Konsultasi sudah ditutup. Riwayat chat hanya dapat dibaca.
              </div>
            ) : <form onSubmit={sendMessage} style={{ padding: 12, borderTop: '1px solid #E2E8F0' }}>
              {selectedImage && <div style={{ fontSize: 12, color: '#475569', marginBottom: 8 }}>Gambar terpilih: {selectedImage.name} <button type="button" onClick={() => { setSelectedImage(null); if (imageInputRef.current) imageInputRef.current.value = ''; }} style={{ border: 0, background: 'none', color: '#B91C1C', cursor: 'pointer' }}>Hapus</button></div>}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseImage} hidden />
                <button type="button" className="btn btn-outline" title="Lampirkan gambar" onClick={() => imageInputRef.current?.click()} disabled={sending}>
                  <ImagePlus size={18} />
                </button>
                <input value={messageText} onChange={(event) => setMessageText(event.target.value)} maxLength={2000} placeholder="Tulis pesan konsultasi…" aria-label="Pesan konsultasi" style={{ minWidth: 0, flex: 1, border: '1px solid #CBD5E1', borderRadius: 9, padding: '11px 12px' }} />
                <button type="submit" className="btn btn-primary" disabled={sending || (!messageText.trim() && !selectedImage)}>
                  {sending ? <LoaderCircle size={17} className="spin" /> : <Send size={17} />}
                  <span>Kirim</span>
                </button>
              </div>
              <div style={{ marginTop: 6, color: '#64748B', fontSize: 11 }}>JPG, PNG, WebP · Maksimal 5 MB · Percakapan hanya untuk pasien dan dokter pada konsultasi ini.</div>
            </form>}
          </div>}
        </div>
      </section>
    </div>
  );
}
