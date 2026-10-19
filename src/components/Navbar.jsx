import React from 'react';
import { useApp } from '../context/AppContext';
import { 
  Activity, 
  User, 
  Stethoscope, 
  ShieldCheck, 
  CalendarPlus, 
  RotateCcw,
  Bell
} from 'lucide-react';

export default function Navbar() {
  const { 
    currentUser, 
    switchRole, 
    setIsBookingOpen, 
    resetToFactoryDefault,
    auditLogs
  } = useApp();

  return (
    <header className="navbar-header">
      <div className="navbar-inner">
        {/* Brand */}
        <div className="brand-wrapper" onClick={() => switchRole(currentUser.role)}>
          <div className="brand-icon">
            <Activity size={24} strokeWidth={2.5} />
          </div>
          <div>
            <div className="brand-title">
              MediSync
              <span style={{ fontSize: '0.65rem', padding: '2px 6px', background: '#DBEAFE', color: '#1D4ED8', borderRadius: '4px', fontWeight: 700 }}>
                v1.0 PRD
              </span>
            </div>
            <div className="brand-subtitle">Sistem Manajemen Telemedis</div>
          </div>
        </div>

        {/* Persona / Role Quick Switcher (Pasien, Dokter, Admin) */}
        <div className="role-switcher-capsule">
          <button
            type="button"
            className={`role-tab-btn ${currentUser.role === 'pasien' ? 'active' : ''}`}
            onClick={() => switchRole('pasien')}
            title="Masuk sebagai Pasien (Budi Santoso)"
          >
            <User size={16} />
            <span>Pasien</span>
          </button>

          <button
            type="button"
            className={`role-tab-btn ${currentUser.role === 'dokter' ? 'active role-dokter' : ''}`}
            onClick={() => switchRole('dokter')}
            title="Masuk sebagai Dokter (Dr. Andi Pratama, Sp.PD)"
          >
            <Stethoscope size={16} />
            <span>Dokter (EMR)</span>
          </button>

          <button
            type="button"
            className={`role-tab-btn ${currentUser.role === 'admin' ? 'active role-admin' : ''}`}
            onClick={() => switchRole('admin')}
            title="Masuk sebagai Admin (Aditya Nugraha, S.Kom)"
          >
            <ShieldCheck size={16} />
            <span>Admin (Audit Log & Backup)</span>
          </button>
        </div>

        {/* Right Actions & Active User Capsule */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {currentUser.role === 'pasien' && (
            <button 
              className="btn btn-primary btn-sm"
              onClick={() => setIsBookingOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <CalendarPlus size={16} />
              <span>Daftar Konsultasi</span>
            </button>
          )}

          <button
            className="btn btn-outline btn-sm"
            onClick={resetToFactoryDefault}
            title="Reset dataset sesuai default dokumen PRD"
            style={{ padding: '6px 10px', color: '#64748B' }}
          >
            <RotateCcw size={15} />
            <span style={{ fontSize: '0.75rem' }}>Reset Demo</span>
          </button>

          {/* User Profile Pill */}
          <div className="user-capsule" title={`ID: ${currentUser.id} | Email: ${currentUser.email}`}>
            <img 
              src={currentUser.avatar} 
              alt={currentUser.name} 
              className="user-avatar" 
            />
            <div className="user-info-text">
              <span className="user-name">{currentUser.name}</span>
              <span className="user-role-badge">
                {currentUser.role === 'pasien' && 'Pasien Terdaftar'}
                {currentUser.role === 'dokter' && (currentUser.specialty || 'Dokter Spesialis')}
                {currentUser.role === 'admin' && 'Administrator Sistem'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
