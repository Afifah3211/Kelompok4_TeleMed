import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { KeyRound, Mail, Lock, ArrowLeft, CheckCircle2, ShieldCheck, UserCheck, Calendar } from 'lucide-react';

export default function ResetPasswordView() {
  const { navigateTo, resetPassword, showToast } = useApp();

  const [step, setStep] = useState(1); // 1: Identitas Diri, 2: New Password, 3: Success
  const [username, setUsername] = useState('budi@email.com');
  const [nik, setNik] = useState('3273012804900001');
  const [birthDate, setBirthDate] = useState('1990-04-28');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleVerifyIdentity = (e) => {
    e.preventDefault();
    if (!username.trim() || !nik.trim() || !birthDate.trim()) {
      showToast('Harap lengkapi semua data identitas diri.', 'danger');
      return;
    }
    showToast('Identitas awal terisi. Silakan masukkan kata sandi baru Anda.', 'info');
    setStep(2);
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 8) {
      showToast('Kata sandi baru minimal 8 karakter.', 'danger');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('Konfirmasi kata sandi tidak cocok.', 'danger');
      return;
    }

    setIsLoading(true);
    try {
      const success = await resetPassword({
        username: username.trim(),
        nik: nik.trim(),
        birthDate: birthDate.trim(),
        newPassword: newPassword.trim(),
      });
      if (success) {
        setStep(3);
      }
    } catch (err) {
      // toast sudah ditangani
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="reset-pwd-container">
      <div className="reset-pwd-card">
        <button 
          className="btn-back-link"
          onClick={() => navigateTo('auth', 'login')}
        >
          <ArrowLeft size={16} />
          <span>Kembali ke Halaman Masuk</span>
        </button>

        <div className="reset-icon-wrapper">
          <KeyRound size={28} color="#1D4ED8" />
        </div>

        <h2 className="reset-title">Atur Ulang Kata Sandi</h2>
        <p className="reset-subtitle">
          {step === 1 && 'Verifikasi identitas pasien terdaftar (Username, NIK, dan Tanggal Lahir).'}
          {step === 2 && `Identitas ${username} terverifikasi. Masukkan kata sandi baru Anda.`}
          {step === 3 && 'Kata sandi akun Anda telah berhasil diperbarui dengan aman!'}
        </p>

        {step === 1 && (
          <form onSubmit={handleVerifyIdentity} className="reset-form">
            <div className="form-group">
              <label className="form-label">Username / Email Terdaftar</label>
              <div className="input-with-icon">
                <Mail size={18} className="field-icon" />
                <input
                  type="text"
                  className="form-input with-left-icon"
                  placeholder="budi@email.com"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Nomor Induk Kependudukan (NIK)</label>
              <div className="input-with-icon">
                <UserCheck size={18} className="field-icon" />
                <input
                  type="text"
                  className="form-input with-left-icon"
                  placeholder="16 digit NIK"
                  value={nik}
                  onChange={(e) => setNik(e.target.value)}
                  maxLength={16}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Tanggal Lahir</label>
              <div className="input-with-icon">
                <Calendar size={18} className="field-icon" />
                <input
                  type="date"
                  className="form-input with-left-icon"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-block btn-lg">
              Lanjut ke Pengaturan Sandi
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleResetPassword} className="reset-form">
            <div className="form-group">
              <label className="form-label">Kata Sandi Baru</label>
              <div className="input-with-icon">
                <Lock size={18} className="field-icon" />
                <input
                  type="password"
                  className="form-input with-left-icon"
                  placeholder="Minimal 8 karakter baru"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Konfirmasi Kata Sandi Baru</label>
              <div className="input-with-icon">
                <Lock size={18} className="field-icon" />
                <input
                  type="password"
                  className="form-input with-left-icon"
                  placeholder="Ulangi kata sandi baru"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <button 
              type="submit" 
              className="btn btn-primary btn-block btn-lg"
              disabled={isLoading}
            >
              {isLoading ? 'Menyimpan...' : 'Simpan Kata Sandi Baru'}
            </button>
          </form>
        )}

        {step === 3 && (
          <div className="reset-success-box text-center">
            <div className="success-icon-badge">
              <CheckCircle2 size={42} color="#059669" />
            </div>
            <h3 style={{ marginTop: '12px', fontSize: '1.2rem' }}>Pembaruan Berhasil</h3>
            <p style={{ color: '#64748B', fontSize: '0.88rem', marginTop: '6px' }}>
              Kata sandi baru telah disimpan ke database terenkripsi bcrypt/hash sesuai Bab 3.5 Dokumen Arsitektur.
            </p>
            <button 
              className="btn btn-primary btn-block btn-lg"
              style={{ marginTop: '20px' }}
              onClick={() => navigateTo('auth', 'login')}
            >
              Masuk Sekarang
            </button>
          </div>
        )}

        <div className="reset-footer-note">
          <ShieldCheck size={14} color="#0F766E" />
          <span>Setiap permintaan reset kata sandi diaudit untuk mencegah pembajakan akun.</span>
        </div>
      </div>
    </div>
  );
}
