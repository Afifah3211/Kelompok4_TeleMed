/**
 * FileUpload.jsx — Komponen upload file ke MinIO CDN
 * Pertemuan 5: File Management & Content Delivery Network
 *
 * Fitur:
 * - Drag & drop atau klik untuk pilih file
 * - Preview URL CDN setelah upload berhasil
 * - Validasi tipe & ukuran di sisi client
 * - Progress state (uploading/idle/success/error)
 */
import React, { useRef, useState } from 'react';
import { Upload, FileText, Image, CheckCircle2, AlertCircle, X, ExternalLink } from 'lucide-react';
import { filesApi } from '../services/api';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'text/plain'];
const MAX_MB = 10;

export default function FileUpload({ onUploaded, label = 'Upload Lampiran', accept = '*/*', className = '' }) {
  const inputRef = useRef(null);
  const [state, setState] = useState('idle'); // idle | uploading | success | error
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [dragging, setDragging] = useState(false);

  async function handleFile(file) {
    if (!file) return;

    // Validasi tipe
    if (!ALLOWED_TYPES.includes(file.type)) {
      setState('error');
      setErrorMsg(`Tipe tidak didukung: ${file.type}. Izin: JPG, PNG, GIF, WebP, PDF, TXT`);
      return;
    }

    // Validasi ukuran
    if (file.size > MAX_MB * 1024 * 1024) {
      setState('error');
      setErrorMsg(`File terlalu besar (${(file.size / 1024 / 1024).toFixed(1)} MB). Maksimal ${MAX_MB} MB.`);
      return;
    }

    setState('uploading');
    setErrorMsg('');
    try {
      const data = await filesApi.upload(file);
      setResult(data);
      setState('success');
      if (onUploaded) onUploaded(data);
    } catch (err) {
      setState('error');
      setErrorMsg(err.message || 'Upload gagal. Coba lagi.');
    }
  }

  function onInputChange(e) {
    handleFile(e.target.files?.[0]);
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files?.[0]);
  }

  function reset() {
    setState('idle');
    setResult(null);
    setErrorMsg('');
    if (inputRef.current) inputRef.current.value = '';
  }

  const isImage = result?.content_type?.startsWith('image/');

  return (
    <div className={`file-upload-wrapper ${className}`} style={{ fontFamily: 'inherit' }}>
      {label && (
        <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '6px', color: '#374151' }}>
          {label}
        </label>
      )}

      {/* Drop Zone */}
      {state !== 'success' && (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          style={{
            border: `2px dashed ${dragging ? '#3B82F6' : state === 'error' ? '#EF4444' : '#CBD5E1'}`,
            borderRadius: '8px',
            padding: '24px 16px',
            textAlign: 'center',
            cursor: state === 'uploading' ? 'wait' : 'pointer',
            background: dragging ? '#EFF6FF' : '#F8FAFC',
            transition: 'all 0.2s',
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            onChange={onInputChange}
            style={{ display: 'none' }}
            disabled={state === 'uploading'}
          />

          {state === 'uploading' ? (
            <div>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>⏳</div>
              <p style={{ color: '#3B82F6', fontWeight: 600, margin: 0 }}>Mengupload ke MinIO CDN...</p>
            </div>
          ) : (
            <div>
              <Upload size={32} color={dragging ? '#3B82F6' : '#94A3B8'} style={{ marginBottom: '8px' }} />
              <p style={{ margin: 0, fontWeight: 600, color: '#374151' }}>
                Klik atau drag &amp; drop file di sini
              </p>
              <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: '#94A3B8' }}>
                JPG, PNG, PDF, TXT — Maks. {MAX_MB} MB
              </p>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {state === 'error' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', padding: '10px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '6px', color: '#DC2626', fontSize: '0.83rem' }}>
          <AlertCircle size={16} />
          <span style={{ flex: 1 }}>{errorMsg}</span>
          <button onClick={reset} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626' }}><X size={14} /></button>
        </div>
      )}

      {/* Success */}
      {state === 'success' && result && (
        <div style={{ marginTop: '8px', border: '1px solid #BBF7D0', borderRadius: '8px', overflow: 'hidden', background: '#F0FDF4' }}>
          {/* Preview gambar */}
          {isImage && (
            <img
              src={result.cdn_url}
              alt={result.filename}
              style={{ width: '100%', maxHeight: '180px', objectFit: 'cover', display: 'block' }}
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          )}
          <div style={{ padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <CheckCircle2 size={18} color="#16A34A" style={{ flexShrink: 0, marginTop: '1px' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 700, color: '#15803D', fontSize: '0.85rem' }}>Upload berhasil!</p>
                <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#374151', wordBreak: 'break-all' }}>
                  {isImage
                    ? <Image size={12} style={{ display: 'inline', marginRight: 4 }} />
                    : <FileText size={12} style={{ display: 'inline', marginRight: 4 }} />}
                  {result.filename} · {(result.size_bytes / 1024).toFixed(1)} KB
                </p>
                <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#6B7280', wordBreak: 'break-all' }}>
                  CDN URL: <code style={{ background: '#E5E7EB', padding: '1px 4px', borderRadius: '3px' }}>{result.cdn_url}</code>
                </p>
              </div>
              <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                <a
                  href={result.cdn_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Buka di tab baru"
                  style={{ display: 'flex', alignItems: 'center', padding: '4px 8px', background: '#D1FAE5', border: '1px solid #6EE7B7', borderRadius: '4px', color: '#065F46', fontSize: '0.75rem', textDecoration: 'none', gap: '4px' }}
                >
                  <ExternalLink size={12} /> Buka
                </a>
                <button
                  onClick={reset}
                  title="Upload file lain"
                  style={{ display: 'flex', alignItems: 'center', padding: '4px 8px', background: '#F3F4F6', border: '1px solid #D1D5DB', borderRadius: '4px', color: '#374151', fontSize: '0.75rem', cursor: 'pointer', gap: '4px' }}
                >
                  <Upload size={12} /> Ganti
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
