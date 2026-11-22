import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Calendar, 
  FileText, 
  ShieldCheck, 
  User, 
  Mail, 
  Lock, 
  ArrowRight, 
  Stethoscope, 
  CheckCircle2,
  ArrowLeft
} from 'lucide-react';

export default function AuthView() {
  const { 
    authMode, 
    setAuthMode, 
    navigateTo, 
    loginUser, 
    registerPatient, 
    showToast 
  } = useApp();

  // Form fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nik, setNik] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState('');
  const [phone, setPhone] = useState('');
  const [bloodType, setBloodType] = useState('');
  const [allergies, setAllergies] = useState('');
  const [address, setAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleFillDemo = (demoEmail, demoRole) => {
    setAuthMode('login');
    setEmail(demoEmail);
    setPassword('medisync2026');
    showToast(`Form diisi kredensial ${demoRole}. Klik 'Masuk' untuk melanjutkan.`, 'info');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLoading) return;

    if (authMode === 'register') {
      if (!fullName.trim() || !email.trim() || !password.trim() || !gender || !phone.trim() || !bloodType.trim() || !allergies.trim() || !address.trim()) {
        showToast('Harap lengkapi semua field yang wajib diisi.', 'danger');
        return;
      }
      if (password.trim().length < 8) {
        showToast('Kata sandi minimal 8 karakter.', 'danger');
        return;
      }
      setIsLoading(true);
      try {
        await registerPatient({
          fullName: fullName.trim(),
          email: email.trim(),
          username: email.trim(),
          password: password.trim(),
          nik: nik.trim() || undefined,
          birthDate: birthDate || null,
          gender,
          phone: phone.trim(),
          bloodType: bloodType.trim(),
          allergies: allergies.trim(),
          address: address.trim()
        });
      } catch (err) {
        // error sudah ditangani / ditampilkan via toast di AppContext
      } finally {
        setIsLoading(false);
      }
    } else {
      if (!email.trim() || !password.trim()) {
        showToast('Masukkan email/username dan kata sandi Anda.', 'danger');
        return;
      }
      setIsLoading(true);
      try {
        await loginUser(email.trim(), password.trim());
      } catch (err) {
        // error sudah ditangani / ditampilkan via toast di AppContext
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleGoogleLogin = () => {
    setAuthMode('login');
    setEmail('budi@email.com');
    setPassword('medisync2026');
    showToast('Kredensial SSO terisi: budi@email.com. Klik "Masuk" untuk verifikasi.', 'info');
  };

  return (
    <div className="auth-page-container">
      <div className="auth-split-wrapper">
        {/* Left Side: Gradient Hero matching Screenshot */}
        <div className="auth-left-panel">
          <div className="auth-left-top">
            <button 
              className="back-to-home-btn"
              onClick={() => navigateTo('landing')}
              title="Kembali ke Beranda"
            >
              <ArrowLeft size={16} />
              <span>Kembali ke Beranda</span>
            </button>
          </div>

          <div className="auth-left-center">
            <h1 className="auth-hero-heading">
              Layanan kesehatan,<br />
              lebih dekat dan aman.
            </h1>

            <div className="auth-features-list">
              <div className="auth-feature-item">
                <div className="auth-feat-icon">
                  <Calendar size={18} />
                </div>
                <span>Jadwalkan konsultasi dengan dokter pilihan</span>
              </div>

              <div className="auth-feature-item">
                <div className="auth-feat-icon">
                  <FileText size={18} />
                </div>
                <span>Rekam medis elektronik tersimpan rapi</span>
              </div>

              <div className="auth-feature-item">
                <div className="auth-feat-icon">
                  <ShieldCheck size={18} />
                </div>
                <span>Setiap aktivitas tercatat dalam audit log</span>
              </div>
            </div>
          </div>

          <div className="auth-left-footer">
            <span>&copy; MediSync Healthcare Systems</span>
          </div>
        </div>

        {/* Right Side: Form Card */}
        <div className="auth-right-panel">
          <div className="auth-form-card">
            {/* Mode Switch Tabs */}
            <div className="auth-mode-switch">
              <button 
                type="button"
                className={`auth-mode-tab ${authMode === 'register' ? 'active' : ''}`}
                onClick={() => setAuthMode('register')}
              >
                Daftar Pasien
              </button>
              <button 
                type="button"
                className={`auth-mode-tab ${authMode === 'login' ? 'active' : ''}`}
                onClick={() => setAuthMode('login')}
              >
                Masuk
              </button>
            </div>

            <div className="auth-header-text">
              <h2 className="auth-title">
                {authMode === 'register' ? 'Daftar sebagai pasien' : 'Masuk ke akun Anda'}
              </h2>
              <p className="auth-subtitle">
                {authMode === 'register' 
                  ? 'Akun dokter dibuat oleh admin klinik.' 
                  : 'Gunakan email dan kata sandi akun terdaftar.'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="auth-actual-form">
              {authMode === 'register' && (
                <div className="form-group">
                  <label className="form-label">Nama lengkap</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Contoh: Budi Santoso"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              {authMode === 'register' && (
                <div className="form-group">
                  <label className="form-label">Nomor NIK (KTP)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="16 digit NIK Pasien (opsional)"
                    value={nik}
                    onChange={(e) => setNik(e.target.value)}
                    maxLength={16}
                  />
                  <small className="form-hint">Opsional. Jika belum tersedia, boleh dikosongkan.</small>
                </div>
              )}

              {authMode === 'register' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Tanggal Lahir (opsional)</label>
                    <input
                      type="date"
                      className="form-input"
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Jenis Kelamin</label>
                    <select className="form-select" value={gender} onChange={(e) => setGender(e.target.value)} required>
                      <option value="">Pilih jenis kelamin</option>
                      <option value="L">Laki-laki</option>
                      <option value="P">Perempuan</option>
                      <option value="-">- (Tidak dicantumkan)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Telepon / WhatsApp</label>
                    <input
                      type="tel"
                      className="form-input"
                      placeholder="Masukkan nomor, atau - jika tidak ada"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Golongan Darah</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Contoh: O+, atau - jika tidak diketahui"
                      value={bloodType}
                      onChange={(e) => setBloodType(e.target.value)}
                      maxLength={3}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Alergi</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Tuliskan alergi, atau - jika tidak ada/belum diketahui"
                      value={allergies}
                      onChange={(e) => setAllergies(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Alamat Domisili</label>
                    <textarea
                      className="form-textarea"
                      placeholder="Masukkan alamat, atau - jika tidak ingin dicantumkan"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      rows={2}
                      required
                    />
                  </div>
                </>
              )}

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="form-label">Kata sandi</label>
                  {authMode === 'login' && (
                    <button 
                      type="button"
                      className="link-subtle"
                      onClick={() => navigateTo('reset-password')}
                      style={{ fontSize: '0.8rem', background: 'none', border: 'none', color: '#1D4ED8', cursor: 'pointer' }}
                    >
                      Lupa kata sandi?
                    </button>
                  )}
                </div>
                <input
                  type="password"
                  className="form-input"
                  placeholder={authMode === 'register' ? 'Minimal 8 karakter' : 'Masukkan kata sandi'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <button 
                type="submit" 
                className="btn btn-primary btn-block btn-lg"
                disabled={isLoading}
              >
                {isLoading 
                  ? 'Memproses...' 
                  : (authMode === 'register' ? 'Daftar' : 'Masuk')}
              </button>

              <div className="auth-divider">
                <span>atau</span>
              </div>

              <button 
                type="button" 
                className="btn btn-google-outline btn-block"
                onClick={handleGoogleLogin}
              >
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.03h3.88c2.27-2.09 3.66-5.17 3.66-9.12z"/>
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.03c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.13C3.27 21.39 7.35 24 12 24z"/>
                  <path fill="#FBBC05" d="M5.28 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.58H1.26C.46 8.17 0 9.99 0 12s.46 3.83 1.26 5.42l4.02-3.13z"/>
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.27 2.61 1.26 6.58l4.02 3.13c.95-2.83 3.6-4.96 6.72-4.96z"/>
                </svg>
                <span>Lanjutkan dengan Google</span>
              </button>
            </form>

            <div className="auth-bottom-toggle">
              {authMode === 'register' ? (
                <span>
                  Sudah punya akun?{' '}
                  <button 
                    type="button" 
                    className="auth-link-bold"
                    onClick={() => setAuthMode('login')}
                  >
                    Masuk
                  </button>
                </span>
              ) : (
                <span>
                  Belum punya akun?{' '}
                  <button 
                    type="button" 
                    className="auth-link-bold"
                    onClick={() => setAuthMode('register')}
                  >
                    Daftar sebagai pasien
                  </button>
                </span>
              )}
            </div>

            {/* Demo Credentials Helper Box - Hanya tampil di DEV mode */}
            {import.meta.env.DEV && (
              <div className="demo-credentials-box">
                <div className="demo-box-title">
                  <span className="dot-pulse"></span>
                  <strong>Kredensial Akun Simulasi (Pilih Role):</strong>
                </div>
                <p className="demo-box-sub">
                  Klik peran untuk mengisi form otomatis, lalu klik tombol <strong>Masuk</strong>:
                </p>
                <div className="demo-pills-row">
                  <button 
                    type="button" 
                    className="quick-role-btn btn-pasien"
                    onClick={() => handleFillDemo('budi@email.com', 'Pasien (Budi)')}
                  >
                    <User size={13} /> Pasien: budi@email.com
                  </button>
                  <button 
                    type="button" 
                    className="quick-role-btn btn-dokter"
                    onClick={() => handleFillDemo('dr.andi@medisync.id', 'Dokter (Dr. Andi)')}
                  >
                    <Stethoscope size={13} /> Dokter: dr.andi@medisync.id
                  </button>
                  <button 
                    type="button" 
                    className="quick-role-btn btn-admin"
                    onClick={() => handleFillDemo('admin@medisync.id', 'Admin IT')}
                  >
                    <ShieldCheck size={13} /> Admin: admin@medisync.id
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
