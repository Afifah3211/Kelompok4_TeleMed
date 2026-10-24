import React from 'react';
import { useApp } from '../context/AppContext';
import { 
  Activity, 
  ShieldCheck, 
  Stethoscope, 
  CalendarCheck, 
  FileText, 
  Pill, 
  Database, 
  Server, 
  Lock, 
  ArrowRight, 
  CheckCircle2, 
  Users, 
  Clock, 
  Award,
  ChevronRight,
  Sparkles
} from 'lucide-react';

export default function LandingPage() {
  const { navigateTo, switchRole } = useApp();

  return (
    <div className="landing-container">
      {/* Top Banner / Enterprise Compliance Badge */}
      <div className="academic-badge-bar">
        <div className="academic-inner">
          <span className="badge-pill">Standar Permenkes No. 24/2022 & ISO 27001</span>
          <span className="academic-meta">
            <strong>TeleMed Enterprise Healthcare</strong> • Platform Telemedis Terintegrasi & Cloud Disaster Recovery
          </span>
          <span className="group-members">
            Jaminan Ketersediaan Layanan 99.9% High Availability & RTO &le; 30 Menit
          </span>
        </div>
      </div>

      {/* Hero Section */}
      <section className="landing-hero">
        <div className="hero-content">
          <div className="hero-pill">
            <Sparkles size={16} className="text-primary" />
            <span>Sistem Telemedicine (TeleMed) & DRP Terpadu</span>
          </div>

          <h1 className="hero-title">
            Layanan Kesehatan Digital, <br />
            <span className="gradient-text">Lebih Dekat, Cepat, dan Aman.</span>
          </h1>

          <p className="hero-subtitle">
            Platform konsultasi online antara pasien dan dokter berbasis web. Dilengkapi sistem Rekam Medis Elektronik (EMR), peresepan obat apoteker, audit log forensik, dan Disaster Recovery Plan (DRP) berbasis Cloud Computing dengan target RTO &le; 30 menit & RPO &le; 1 menit.
          </p>

          <div className="hero-actions">
            <button 
              className="btn btn-primary btn-lg"
              onClick={() => navigateTo('auth', 'register')}
            >
              <span>Daftar Pasien Baru</span>
              <ArrowRight size={18} />
            </button>

            <button 
              className="btn btn-outline btn-lg"
              onClick={() => navigateTo('auth', 'login')}
            >
              <span>Masuk Portal</span>
            </button>
          </div>
        </div>

        {/* Hero Visual Card / System Highlights */}
        <div className="hero-visual">
          <div className="visual-card">
            <div className="card-header-styled">
              <div className="app-dot red"></div>
              <div className="app-dot yellow"></div>
              <div className="app-dot green"></div>
              <span className="card-title-preview">TeleMed Cloud Engine v1.0 Enterprise</span>
            </div>

            <div className="visual-body">
              <div className="metric-grid">
                <div className="metric-box">
                  <div className="metric-val text-primary">&le; 30 mnt</div>
                  <div className="metric-lbl">Target RTO Sistem</div>
                </div>
                <div className="metric-box">
                  <div className="metric-val text-teal">&le; 1 mnt</div>
                  <div className="metric-lbl">Target RPO Data</div>
                </div>
                <div className="metric-box">
                  <div className="metric-val text-blue">AES-256</div>
                  <div className="metric-lbl">Enkripsi Offsite</div>
                </div>
                <div className="metric-box">
                  <div className="metric-val text-purple">3-2-1</div>
                  <div className="metric-lbl">Aturan Backup</div>
                </div>
              </div>

              <div className="flow-mini-preview">
                <div className="flow-step">
                  <div className="step-circle active">1</div>
                  <div className="step-text">
                    <strong>Pasien Booking</strong>
                    <small>Pilih jadwal & dokter</small>
                  </div>
                </div>
                <div className="flow-arrow">&rarr;</div>
                <div className="flow-step">
                  <div className="step-circle active">2</div>
                  <div className="step-text">
                    <strong>Telekonsultasi</strong>
                    <small>Chat / Video dokter</small>
                  </div>
                </div>
                <div className="flow-arrow">&rarr;</div>
                <div className="flow-step">
                  <div className="step-circle active">3</div>
                  <div className="step-text">
                    <strong>Rekam Medis & Resep</strong>
                    <small>Soft delete & apoteker</small>
                  </div>
                </div>
              </div>

              <div className="security-tag">
                <ShieldCheck size={16} color="#0F766E" />
                <span>Seluruh transaksi tercatat otomatis di Audit Log (Tabel audit_logs & WAL replication)</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Fitur Utama 6 Pilar */}
      <section className="features-section">
        <div className="section-header text-center">
          <span className="section-pill">Arsitektur Terpadu</span>
          <h2 className="section-heading">Fitur Komprehensif Sistem TeleMed</h2>
          <p className="section-description">
            Dirancang secara khusus mengacu pada Dokumen Arsitektur Sistem dan Disaster Recovery Plan (DRP) Program Studi Sistem Informasi UIN Sunan Ampel Surabaya.
          </p>
        </div>

        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon icon-blue">
              <CalendarCheck size={24} />
            </div>
            <h3>Pendaftaran & Booking Jadwal</h3>
            <p>
              Pasien dapat mendaftar mandiri, memilih dokter spesialis, jadwal konsultasi, dan mengunggah keluhan awal secara efisien.
            </p>
            <ul className="feature-list">
              <li><CheckCircle2 size={14} color="#1D4ED8" /> Antrean terjadwal transparan</li>
              <li><CheckCircle2 size={14} color="#1D4ED8" /> Notifikasi status konfirmasi dokter</li>
            </ul>
          </div>

          <div className="feature-card">
            <div className="feature-icon icon-teal">
              <Stethoscope size={24} />
            </div>
            <h3>Dashboard Dokter & EMR</h3>
            <p>
              Dokter dapat mengonfirmasi jadwal, melakukan telekonsultasi, serta mencatat anamnesis, diagnosis ICD-10, tindakan, dan resep digital.
            </p>
            <ul className="feature-list">
              <li><CheckCircle2 size={14} color="#0F766E" /> Riwayat rekam medis pasien terpadu</li>
              <li><CheckCircle2 size={14} color="#0F766E" /> Perlindungan soft delete (is_deleted)</li>
            </ul>
          </div>

          <div className="feature-card">
            <div className="feature-icon icon-emerald">
              <Pill size={24} />
            </div>
            <h3>Instalasi Farmasi & Apoteker</h3>
            <p>
              Resep dari rekam medis dokter otomatis terhubung ke bagian farmasi untuk disiapkan, diramu, dan diperbarui status pengambilannya.
            </p>
            <ul className="feature-list">
              <li><CheckCircle2 size={14} color="#059669" /> Antrean resep real-time</li>
              <li><CheckCircle2 size={14} color="#059669" /> Pemantauan inventori stok obat</li>
            </ul>
          </div>

          <div className="feature-card">
            <div className="feature-icon icon-amber">
              <ShieldCheck size={24} />
            </div>
            <h3>Audit Log Forensik</h3>
            <p>
              Setiap aksi login, pembuatan rekam medis, perubahan status, hingga soft-delete dicatat lengkap dengan timestamp, IP address, dan user ID.
            </p>
            <ul className="feature-list">
              <li><CheckCircle2 size={14} color="#D97706" /> Akses hanya untuk administrator</li>
              <li><CheckCircle2 size={14} color="#D97706" /> Deteksi anomali & kepatuhan regulasi</li>
            </ul>
          </div>

          <div className="feature-card">
            <div className="feature-icon icon-indigo">
              <Database size={24} />
            </div>
            <h3>DRP 4 Lapis & Aturan 3-2-1</h3>
            <p>
              Strategi pencadangan berlapis: Snapshot volume Docker mingguan, Dump logis tiap 6 jam, Base Backup + WAL streaming kontinu, dan Salinan Off-site AES-256.
            </p>
            <ul className="feature-list">
              <li><CheckCircle2 size={14} color="#4F46E5" /> 3 Salinan, 2 Media, 1 Offsite Cloud</li>
              <li><CheckCircle2 size={14} color="#4F46E5" /> Enkripsi data sensitif pasien</li>
            </ul>
          </div>

          <div className="feature-card">
            <div className="feature-icon icon-rose">
              <Server size={24} />
            </div>
            <h3>Point-in-Time Recovery (PITR)</h3>
            <p>
              Simulasi 9 langkah pemulihan database ketika terjadi insiden DROP TABLE atau corrupt, memungkinkan pengembalian data ke detik sebelum bencana terjadi.
            </p>
            <ul className="feature-list">
              <li><CheckCircle2 size={14} color="#E11D48" /> Replay WAL PostgreSQL terarah</li>
              <li><CheckCircle2 size={14} color="#E11D48" /> Target RTO 30 menit terpenuhi</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Standar Keamanan & Kepatuhan Regulasi */}
      <section className="team-section">
        <div className="team-card-wrapper">
          <div className="team-header">
            <div>
              <span className="section-pill">Kepatuhan & Sertifikasi</span>
              <h3 style={{ fontSize: '1.4rem', marginTop: '6px' }}>Standar Keamanan Medis & Kepatuhan Regulasi</h3>
              <p style={{ color: '#64748B', fontSize: '0.9rem', marginTop: '4px' }}>
                Arsitektur TeleMed memenuhi regulasi rekam medis elektronik dan standar perlindungan data pribadi nasional
              </p>
            </div>
            <div className="dosen-box">
              <Award size={20} color="#1D4ED8" />
              <div>
                <strong>ISO/IEC 27001 & Permenkes No. 24/2022</strong>
                <small>Sertifikasi Sistem Manajemen Keamanan Informasi</small>
              </div>
            </div>
          </div>

          <div className="members-grid">
            <div className="member-card">
              <div className="member-avatar" style={{ background: '#0F766E' }}>
                <Lock size={20} color="#fff" />
              </div>
              <div className="member-info">
                <strong>Enkripsi Data AES-256</strong>
                <span>Data Rekam Medis & Backup Terenkripsi</span>
                <span className="member-role">Keamanan Tingkat Tinggi</span>
              </div>
            </div>

            <div className="member-card">
              <div className="member-avatar" style={{ background: '#1D4ED8' }}>
                <ShieldCheck size={20} color="#fff" />
              </div>
              <div className="member-info">
                <strong>Audit Log Forensik Otomatis</strong>
                <span>Pencatatan IP Address & User Action</span>
                <span className="member-role">Integritas Data Terjamin</span>
              </div>
            </div>

            <div className="member-card">
              <div className="member-avatar" style={{ background: '#7C3AED' }}>
                <Server size={20} color="#fff" />
              </div>
              <div className="member-info">
                <strong>High Availability 99.9%</strong>
                <span>Target RTO &le; 30 mnt & RPO &le; 1 mnt</span>
                <span className="member-role">Disaster Recovery Ready</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="cta-section">
        <div className="cta-box">
          <h2>Siap Menjalankan Simulasi Cloud TeleMed?</h2>
          <p>
            Masuk ke portal atau gunakan tombol demo cepat di atas untuk langsung menguji fungsi setiap modul aplikasi.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '20px', flexWrap: 'wrap' }}>
            <button 
              className="btn btn-primary btn-lg"
              onClick={() => navigateTo('auth', 'register')}
            >
              Daftar Pasien Sekarang
            </button>
            <button 
              className="btn btn-outline btn-lg"
              onClick={() => navigateTo('auth', 'login')}
            >
              Masuk dengan Akun yang Ada
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
