import React from 'react';
import { useApp } from '../context/AppContext';
import {
  Activity,
  ArrowRight,
  CalendarCheck,
  FileText,
  Pill,
  Stethoscope,
} from 'lucide-react';

const services = [
  {
    icon: <Stethoscope size={23} />,
    className: 'icon-blue',
    title: 'Konsultasi dengan Dokter',
    description: 'Pilih dokter sesuai kebutuhan dan konsultasikan keluhan melalui chat atau video.',
  },
  {
    icon: <CalendarCheck size={23} />,
    className: 'icon-teal',
    title: 'Jadwal Konsultasi',
    description: 'Atur jadwal konsultasi dan lihat status janji temu dari akun Anda.',
  },
  {
    icon: <FileText size={23} />,
    className: 'icon-indigo',
    title: 'Rekam Medis',
    description: 'Lihat ringkasan hasil konsultasi dan riwayat pemeriksaan Anda.',
  },
  {
    icon: <Pill size={23} />,
    className: 'icon-emerald',
    title: 'Resep Digital',
    description: 'Akses resep dan informasi status penyiapan obat setelah konsultasi.',
  },
];

export default function LandingPage() {
  const { navigateTo } = useApp();

  return (
    <div className="landing-container">
      <section className="landing-hero">
        <div className="hero-content">
          <div className="hero-pill">
            <Activity size={16} className="text-primary" />
            <span>Layanan Kesehatan Online</span>
          </div>

          <h1 className="hero-title">
            Konsultasi kesehatan, <br />
            <span className="gradient-text">lebih mudah dari rumah.</span>
          </h1>

          <p className="hero-subtitle">
            Temui dokter secara online, atur jadwal konsultasi, dan akses informasi kesehatan Anda dalam satu layanan.
          </p>

          <div className="hero-actions">
            <button
              className="btn btn-primary btn-lg"
              onClick={() => navigateTo('auth', 'register')}
            >
              <span>Daftar Pasien</span>
              <ArrowRight size={18} />
            </button>
          </div>
        </div>

        <div className="hero-visual">
          <div className="health-illustration" aria-hidden="true">
            <div className="health-illustration-orbit orbit-outer" />
            <div className="health-illustration-orbit orbit-inner" />
            <div className="health-illustration-glow" />
            <div className="health-illustration-icon"><Stethoscope size={108} strokeWidth={1.35} /></div>
            <div className="health-illustration-pulse"><Activity size={44} strokeWidth={1.7} /></div>
            <div className="health-illustration-plus plus-one">+</div>
            <div className="health-illustration-plus plus-two">+</div>
            <div className="health-illustration-caption">TeleMed</div>
            </div>
        </div>
      </section>

      <section className="features-section">
        <div className="section-header text-center">
          <span className="section-pill">Layanan Kami</span>
          <h2 className="section-heading">Perawatan kesehatan dalam satu tempat</h2>
          <p className="section-description">
            Dapatkan layanan konsultasi dan informasi kesehatan dengan alur yang mudah diikuti.
          </p>
        </div>

        <div className="features-grid">
          {services.map((service) => (
            <article className="feature-card" key={service.title}>
              <div className={`feature-icon ${service.className}`}>{service.icon}</div>
              <h3>{service.title}</h3>
              <p>{service.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="team-section care-steps-section">
        <div className="team-card-wrapper">
          <div className="team-header">
            <div>
              <span className="section-pill">Cara Menggunakan</span>
              <h3 className="care-steps-title">Mulai konsultasi dalam beberapa langkah</h3>
              <p className="care-steps-description">Buat akun pasien, pilih dokter, lalu ikuti konsultasi sesuai jadwal.</p>
            </div>
          </div>
          <div className="members-grid">
            <div className="member-card care-step-card">
              <div className="member-avatar" style={{ background: '#DBEAFE', color: '#1D4ED8' }}>1</div>
              <div className="member-info"><strong>Buat akun pasien</strong><span>Daftar untuk mengakses layanan TeleMed.</span></div>
            </div>
            <div className="member-card care-step-card">
              <div className="member-avatar" style={{ background: '#CCFBF1', color: '#0F766E' }}>2</div>
              <div className="member-info"><strong>Pilih dokter dan jadwal</strong><span>Tentukan dokter dan waktu konsultasi yang sesuai.</span></div>
            </div>
            <div className="member-card care-step-card">
              <div className="member-avatar" style={{ background: '#DCFCE7', color: '#15803D' }}>3</div>
              <div className="member-info"><strong>Konsultasi dan tindak lanjut</strong><span>Baca hasil pemeriksaan, resep, dan status obat.</span></div>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
