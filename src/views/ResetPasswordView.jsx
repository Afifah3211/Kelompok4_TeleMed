import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { KeyRound, Mail, Lock, ArrowLeft, CheckCircle2, ShieldCheck } from 'lucide-react';

export default function ResetPasswordView() {
  const { navigateTo, resetPassword, showToast } = useApp();

  const [step, setStep] = useState(1); // 1: Email, 2: OTP & New Password, 3: Success
  const [email, setEmail] = useState('budi.santoso@email.com');
  const [otpCode, setOtpCode] = useState('849201');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSendOtp = (e) => {
    e.preventDefault();
    if (!email.trim()) {
      showToast('Harap masukkan alamat email terdaftar.', 'danger');
      return;
    }
    showToast(`Kode OTP simulasi dikirim ke ${email}: 849201`, 'info');
    setStep(2);
  };

  const handleResetPassword = (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      showToast('Kata sandi baru minimal 6 karakter.', 'danger');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('Konfirmasi kata sandi tidak cocok.', 'danger');
      return;
    }
    resetPassword(email, newPassword);
    setStep(3);
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
          {step === 1 && 'Masukkan alamat email yang terdaftar pada akun TeleMed Anda.'}
          {step === 2 && `Kode verifikasi telah dikirim ke ${email}. Masukkan kode dan sandi baru Anda.`}
          {step === 3 && 'Kata sandi akun Anda telah berhasil diperbarui dengan aman!'}
        </p>

        {step === 1 && (
          <form onSubmit={handleSendOtp} className="reset-form">
            <div className="form-group">
              <label className="form-label">Alamat Email Terdaftar</label>
              <div className="input-with-icon">
                <Mail size={18} className="field-icon" />
                <input
                  type="email"
                  className="form-input with-left-icon"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-block btn-lg">
              Kirim Kode Verifikasi (OTP)
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleResetPassword} className="reset-form">
            <div className="form-group">
              <label className="form-label">Kode Verifikasi (OTP Simulasi)</label>
              <input
                type="text"
                className="form-input text-center font-mono"
                style={{ fontSize: '1.2rem', letterSpacing: '4px' }}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                maxLength={6}
                required
              />
              <small style={{ color: '#0F766E', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                Tip Simulasi: Gunakan kode 849201 yang telah diisikan otomatis.
              </small>
            </div>

            <div className="form-group">
              <label className="form-label">Kata Sandi Baru</label>
              <div className="input-with-icon">
                <Lock size={18} className="field-icon" />
                <input
                  type="password"
                  className="form-input with-left-icon"
                  placeholder="Minimal 6 karakter baru"
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

            <button type="submit" className="btn btn-primary btn-block btn-lg">
              Simpan Kata Sandi Baru
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
