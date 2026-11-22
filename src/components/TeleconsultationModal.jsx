import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { chatApi, videoApi } from '../services/api';
import { isChatConsultation } from '../utils/consultation';
import {
  Video,
  MessageCircle,
  ImagePlus,
  Send,
  X,
  Clock,
  CheckCircle2,
  UserRound,
  Stethoscope,
  LoaderCircle,
} from 'lucide-react';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function VideoCallPanel({ consultation, isDoctor, closed, ready }) {
  const { updateAppointmentStatus, setTeleconsultationSession, showToast } = useApp();
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const sessionIdRef = useRef(null);
  const [callState, setCallState] = useState('Menyiapkan kamera dan mikrofon…');
  const [callError, setCallError] = useState('');
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    if (closed || !ready) return undefined;

    let active = true;
    let peerConnection;
    let localStream;
    let remoteStream;
    let pollTimer;
    let afterId = 0;
    let polling = false;
    const pendingCandidates = [];

    const reportError = (error) => {
      if (active) setCallError(error?.message || 'Koneksi video gagal.');
    };

    const sendSignal = async (signalType, payload) => {
      const sessionId = sessionIdRef.current;
      if (!sessionId) return;
      try {
        await videoApi.sendSignal(consultation.id, sessionId, signalType, payload);
      } catch (error) {
        reportError(error);
      }
    };

    const addPendingCandidates = async () => {
      while (pendingCandidates.length && peerConnection?.remoteDescription) {
        await peerConnection.addIceCandidate(pendingCandidates.shift());
      }
    };

    const pollSignals = async () => {
      if (polling || !sessionIdRef.current || !active) return;
      polling = true;
      try {
        const signals = await videoApi.getSignals(
          consultation.id,
          sessionIdRef.current,
          afterId
        );
        setCallError((current) => (/HTTP Error 50[234]/.test(current) ? '' : current));
        for (const signal of signals) {
          afterId = Math.max(afterId, Number(signal.id));
          if (signal.signal_type === 'hangup') {
            setCallState('Peserta lain mengakhiri sesi video.');
            peerConnection?.close();
            localStream?.getTracks().forEach((track) => track.stop());
            if (localVideoRef.current) localVideoRef.current.srcObject = null;
            if (pollTimer) window.clearInterval(pollTimer);
            return;
          }
          if (signal.signal_type === 'candidate') {
            const candidate = new RTCIceCandidate(signal.payload);
            if (peerConnection?.remoteDescription) {
              await peerConnection.addIceCandidate(candidate);
            } else {
              pendingCandidates.push(candidate);
            }
          } else if (signal.signal_type === 'offer' && !isDoctor) {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(signal.payload));
            await addPendingCandidates();
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            await sendSignal('answer', peerConnection.localDescription.toJSON());
          } else if (signal.signal_type === 'answer' && isDoctor && !peerConnection.remoteDescription) {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(signal.payload));
            await addPendingCandidates();
          }
        }
      } catch (error) {
        reportError(error);
      } finally {
        polling = false;
      }
    };

    const connect = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) {
          throw new Error('Browser ini tidak mendukung kamera atau koneksi video WebRTC.');
        }
        localStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: true,
        });
        if (!active) {
          localStream.getTracks().forEach((track) => track.stop());
          return;
        }
        if (localVideoRef.current) localVideoRef.current.srcObject = localStream;

        const { session_id: sessionId } = await videoApi.joinSession(consultation.id);
        if (!active) {
          localStream.getTracks().forEach((track) => track.stop());
          return;
        }
        sessionIdRef.current = sessionId;

        peerConnection = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        });
        remoteStream = new MediaStream();
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
        localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream));
        peerConnection.ontrack = (event) => {
          event.streams[0]?.getTracks().forEach((track) => {
            if (!remoteStream.getTracks().some((existing) => existing.id === track.id)) {
              remoteStream.addTrack(track);
            }
          });
        };
        peerConnection.onicecandidate = (event) => {
          if (event.candidate) sendSignal('candidate', event.candidate.toJSON());
        };
        peerConnection.onconnectionstatechange = () => {
          if (!active) return;
          if (peerConnection.connectionState === 'connected') {
            setCallState('Terhubung dengan peserta konsultasi.');
            setCallError('');
          } else if (peerConnection.connectionState === 'failed') {
            setCallState('Koneksi video terputus.');
            setCallError('Jaringan tidak dapat menghubungkan kedua peserta. Coba jaringan lain atau mulai ulang sesi.');
          } else if (peerConnection.connectionState === 'disconnected') {
            setCallState('Mencoba menghubungkan kembali…');
          }
        };

        if (isDoctor) {
          const offer = await peerConnection.createOffer();
          await peerConnection.setLocalDescription(offer);
          await sendSignal('offer', peerConnection.localDescription.toJSON());
        }
        setCallState(isDoctor
          ? 'Menunggu pasien bergabung ke video…'
          : 'Kamera aktif. Menunggu dokter menghubungkan video…');
        pollTimer = window.setInterval(pollSignals, 1200);
        pollSignals();
      } catch (error) {
        reportError(error);
        setCallState('Video belum tersambung.');
        peerConnection?.close();
        localStream?.getTracks().forEach((track) => track.stop());
      }
    };

    setCallError('');
    setCallState('Meminta izin kamera dan mikrofon…');
    connect();

    return () => {
      active = false;
      if (pollTimer) window.clearInterval(pollTimer);
      peerConnection?.close();
      localStream?.getTracks().forEach((track) => track.stop());
      if (localVideoRef.current) localVideoRef.current.srcObject = null;
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
      sessionIdRef.current = null;
    };
  }, [consultation.id, closed, isDoctor, ready]);

  const endConsultation = async () => {
    if (ending || !window.confirm('Akhiri konsultasi sekarang? Sesi video akan ditutup, lalu dokter dapat melengkapi rekam medis.')) {
      return;
    }
    setEnding(true);
    if (sessionIdRef.current) {
      try {
        await videoApi.sendSignal(consultation.id, sessionIdRef.current, 'hangup');
      } catch (error) {
        showToast(`Sinyal penutupan video gagal dikirim: ${error.message}`, 'warning');
      }
    }
    const updated = await updateAppointmentStatus(consultation.id, 'Selesai');
    if (updated) setTeleconsultationSession(null);
    setEnding(false);
  };

  if (closed) {
    return (
      <div style={{ background: '#F1F5F9', display: 'grid', placeItems: 'center', padding: 24 }}>
        <div role="status" style={{ maxWidth: 520, textAlign: 'center', color: '#334155' }}>
          <CheckCircle2 size={42} color="#0F766E" />
          <h2>Konsultasi telah berakhir</h2>
          <p>Dokter dapat melengkapi rekam medis setelah sesi ini.</p>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div style={{ background: '#F1F5F9', display: 'grid', placeItems: 'center', padding: 24 }}>
        <div role="status" style={{ maxWidth: 520, textAlign: 'center', color: '#334155' }}>
          <Clock size={42} color="#1D4ED8" />
          <h2>Menunggu dokter memulai konsultasi</h2>
          <p>Kamera dan mikrofon belum diaktifkan.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: '#F1F5F9', padding: 18, display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
      <div style={{ flex: 1, minHeight: 300, position: 'relative', display: 'grid', placeItems: 'center', borderRadius: 14, overflow: 'hidden', background: '#0F172A' }}>
        <video ref={remoteVideoRef} autoPlay playsInline style={{ width: '100%', height: '100%', minHeight: 300, objectFit: 'cover' }} />
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
          <span style={{ color: '#CBD5E1', background: 'rgba(15,23,42,.72)', padding: '8px 12px', borderRadius: 8 }}>
            {callState}
          </span>
        </div>
        <video ref={localVideoRef} autoPlay playsInline muted style={{ position: 'absolute', right: 14, bottom: 14, width: 'min(28%, 190px)', minWidth: 110, aspectRatio: '4 / 3', objectFit: 'cover', border: '2px solid #fff', borderRadius: 10, background: '#334155' }} />
      </div>
      {callError && <div role="alert" style={{ color: '#991B1B', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '9px 12px', fontSize: 13 }}>{callError}</div>}
      <div style={{ color: '#64748B', fontSize: 12 }}>
        Kamera dan mikrofon aktif pada perangkat ini. Jika tidak ada koneksi langsung, periksa izin browser atau jaringan.
      </div>
      {isDoctor && (
        <button type="button" className="btn btn-danger" onClick={endConsultation} disabled={ending} style={{ alignSelf: 'center' }}>
          {ending ? 'Mengakhiri konsultasi…' : 'Akhiri Konsultasi'}
        </button>
      )}
    </div>
  );
}

export default function TeleconsultationModal() {
  const {
    teleconsultationSession,
    setTeleconsultationSession,
    currentUser,
    showToast,
    updateAppointmentStatus,
  } = useApp();
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState('');
  const [duration, setDuration] = useState(0);
  const [endingChat, setEndingChat] = useState(false);
  const imageInputRef = useRef(null);
  const messageListRef = useRef(null);

  const consultationId = teleconsultationSession?.id;
  const isChatOnly = isChatConsultation(teleconsultationSession?.type);

  useEffect(() => {
    if (!consultationId) {
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
    if (!consultationId || isChatOnly || ['Selesai', 'Dibatalkan'].includes(teleconsultationSession?.status)) return undefined;
    setDuration(0);
    const timer = window.setInterval(() => setDuration((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [consultationId, isChatOnly, teleconsultationSession?.status]);

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

  const endChatConsultation = async () => {
    if (endingChat || !window.confirm('Akhiri konsultasi sekarang? Dokter masih dapat melengkapi rekam medis setelah sesi ini.')) {
      return;
    }
    setEndingChat(true);
    try {
      const updated = await updateAppointmentStatus(consultationId, 'Selesai');
      if (updated) setTeleconsultationSession(null);
    } finally {
      setEndingChat(false);
    }
  };

  const isDoctor = currentUser?.role === 'dokter';
  const consultationReady = teleconsultationSession.status === 'Sedang Berlangsung';
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
            {isChatOnly && isDoctor && !conversationClosed && (
              <button type="button" className="btn btn-danger btn-sm" onClick={endChatConsultation} disabled={endingChat}>
                {endingChat ? 'Mengakhiri…' : 'Akhiri Konsultasi'}
              </button>
            )}
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setTeleconsultationSession(null)} style={{ color: '#fff', background: '#334155', borderColor: '#64748B' }}>
              <X size={15} /> Tutup
            </button>
          </div>
        </header>

        <div className={`teleconsultation-body ${isChatOnly ? '' : 'has-video-chat'}`}>
          {!isChatOnly && (
            <VideoCallPanel
              consultation={teleconsultationSession}
              isDoctor={isDoctor}
              closed={conversationClosed}
              ready={consultationReady}
            />
          )}

          <div style={{ minHeight: 0, display: 'flex', flexDirection: 'column', background: '#fff' }}>
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
          </div>
        </div>
      </section>
    </div>
  );
}
