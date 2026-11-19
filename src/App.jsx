import React from 'react';
import { useApp } from './context/AppContext';
import Navbar from './components/Navbar';
import LandingPage from './views/LandingPage';
import AuthView from './views/AuthView';
import ResetPasswordView from './views/ResetPasswordView';
import PatientDashboard from './views/PatientDashboard';
import DoctorEMR from './views/DoctorEMR';
import AdminAuditLogs from './views/AdminAuditLogs';
import PharmacistDashboard from './views/PharmacistDashboard';
import TeleconsultationModal from './components/TeleconsultationModal';
import BookingModal from './components/BookingModal';
import EMRDetailModal from './components/EMRDetailModal';
import Toast from './components/Toast';

export default function App() {
  const { currentPage, currentUser } = useApp();

  return (
    <div className="app-container">
      {/* Top Navigation & Simulation Toolbar */}
      <Navbar />

      {/* Main Page Rendering */}
      <main className="main-content">
        {currentPage === 'landing' && <LandingPage />}
        {currentPage === 'auth' && <AuthView />}
        {currentPage === 'reset-password' && <ResetPasswordView />}
        
        {currentPage === 'dashboard' && currentUser && (
          <>
            {currentUser.role === 'pasien' && <PatientDashboard />}
            {currentUser.role === 'dokter' && <DoctorEMR />}
            {currentUser.role === 'admin' && <AdminAuditLogs />}
            {currentUser.role === 'apoteker' && <PharmacistDashboard />}
          </>
        )}

        {currentPage === 'dashboard' && !currentUser && (
          <LandingPage />
        )}
      </main>

      {/* Modals and Overlays */}
      <TeleconsultationModal />
      <BookingModal />
      <EMRDetailModal />
      <Toast />

      {/* Footer */}
      <footer 
        style={{ 
          background: '#FFFFFF', 
          borderTop: '1px solid #E2E8F0', 
          padding: '24px 20px', 
          marginTop: 'auto',
          fontSize: '0.82rem',
          color: '#64748B'
        }}
      >
        <div 
          style={{ 
            maxWidth: '1360px', 
            margin: '0 auto', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px'
          }}
        >
          <div>
          <strong>TeleMed</strong> • Layanan konsultasi kesehatan online
          </div>
        </div>
      </footer>
    </div>
  );
}
