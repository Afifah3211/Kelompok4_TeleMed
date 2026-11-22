import React from 'react';
import { useApp } from '../context/AppContext';
import { 
  Activity, 
  LogOut,
  LogIn,
  ShieldCheck,
  Stethoscope,
  User
} from 'lucide-react';

export default function Navbar() {
  const { 
    currentUser, 
    currentPage,
    navigateTo,
    logout
  } = useApp();

  const isLoggedIn = !!currentUser && currentPage === 'dashboard';

  return (
    <header className="navbar-header">
      <div className="navbar-inner">
        {/* Brand */}
        <div className="brand-wrapper" onClick={() => !isLoggedIn && navigateTo('landing')}>
          <div className="brand-icon">
            <Activity size={24} strokeWidth={2.5} />
          </div>
          <div>
            <div className="brand-title">
              MediSync
            </div>
            <div className="brand-subtitle">
              {isLoggedIn 
                ? (currentUser.role === 'pasien' ? 'Portal Pasien' :
                   currentUser.role === 'dokter' ? 'Portal Dokter' :
                   currentUser.role === 'admin' ? 'Portal Admin' : 'Portal Pengguna')
                : 'Konsultasi Kesehatan Online'}
            </div>
          </div>
        </div>

        {/* PUBLIC NAVIGATION (When NOT logged in) */}
        {!isLoggedIn && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <nav className="public-nav-links">
              <button 
                type="button" 
                className={`nav-text-link ${currentPage === 'landing' ? 'active' : ''}`}
                onClick={() => navigateTo('landing')}
              >
                Beranda
              </button>
            </nav>

            <button
              className="btn btn-outline btn-sm"
              onClick={() => navigateTo('auth', 'login')}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <LogIn size={15} />
              <span>Masuk</span>
            </button>
          </div>
        )}

        {/* AUTHENTICATED NAVIGATION (When Logged In on Dashboard) */}
        {isLoggedIn && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {/* Role indicator pill */}
            <div className="auth-role-pill">
              {currentUser.role === 'pasien' && (
                <span className="role-tag tag-pasien">
                  <User size={14} /> Pasien
                </span>
              )}
              {currentUser.role === 'dokter' && (
                <span className="role-tag tag-dokter">
                  <Stethoscope size={14} /> Dokter
                </span>
              )}
              {currentUser.role === 'admin' && (
                <span className="role-tag tag-admin">
                  <ShieldCheck size={14} /> Admin
                </span>
              )}
            </div>

            {/* User Capsule */}
            <div className="user-capsule" title={`ID: ${currentUser.id} | Email: ${currentUser.email}`}>
              <img 
                src={currentUser.avatar} 
                alt={currentUser.name} 
                className="user-avatar" 
              />
              <div className="user-info-text">
                <span className="user-name">{currentUser.name}</span>
                <span className="user-role-badge">
                  {currentUser.role === 'pasien' && (currentUser.nik ? `NIK: ${currentUser.nik}` : 'Pasien')}
                  {currentUser.role === 'dokter' && (currentUser.specialty || 'Dokter Spesialis')}
                  {currentUser.role === 'admin' && 'Administrator IT'}
                </span>
              </div>
            </div>

            {/* Logout Button */}
            <button
              className="btn btn-outline btn-sm"
              onClick={logout}
              title="Keluar dari Akun (Logout)"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#DC2626', borderColor: '#FECACA', background: '#FEF2F2' }}
            >
              <LogOut size={15} />
              <span>Keluar</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
