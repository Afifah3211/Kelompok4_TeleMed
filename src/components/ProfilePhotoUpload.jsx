import React, { useEffect, useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import { useApp } from '../context/AppContext';

const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export default function ProfilePhotoUpload({ file, onFileChange }) {
  const { currentUser, showToast } = useApp();
  const inputRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState('');

  useEffect(() => {
    if (!file) {
      setPreviewUrl('');
      if (inputRef.current) inputRef.current.value = '';
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleFileChange = (event) => {
    const selected = event.target.files?.[0];
    if (!selected) return;
    if (!ACCEPTED_TYPES.has(selected.type)) {
      showToast('Foto profil hanya menerima JPG, PNG, atau WebP.', 'danger');
      event.target.value = '';
      return;
    }
    if (selected.size > MAX_FILE_SIZE) {
      showToast('Ukuran foto profil maksimal 5 MB.', 'danger');
      event.target.value = '';
      return;
    }
    onFileChange?.(selected);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
      <img
        src={previewUrl || currentUser?.avatar}
        alt={`Foto profil ${currentUser?.name || ''}`}
        style={{ width: 88, height: 88, borderRadius: '50%', objectFit: 'cover', border: '1px solid #E2E8F0' }}
      />
      <div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
        <button type="button" className="btn btn-outline btn-sm" onClick={() => inputRef.current?.click()}>
          <Camera size={15} /> Pilih Foto
        </button>
        <small style={{ display: 'block', marginTop: 6, color: '#64748B' }}>
          {file ? `${file.name} · akan disimpan bersama profil` : 'JPG, PNG, atau WebP; maksimal 5 MB.'}
        </small>
      </div>
    </div>
  );
}
