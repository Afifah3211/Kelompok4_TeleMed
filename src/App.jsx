import React from 'react';
import { useApp } from './context/AppContext';
import Navbar from './components/Navbar';
import PatientDashboard from './views/PatientDashboard';
import DoctorEMR from './views/DoctorEMR';
import AdminAuditLogs from './views/AdminAuditLogs';
import TeleconsultationModal from './components/TeleconsultationModal';
import BookingModal from './components/BookingModal';
import EMRDetailModal from './components/EMRDetailModal';
import Toast from './components/Toast';
import { ShieldCheck, Heart } from 'lucide-react';

export default function App() {
  const { currentUser } = useApp();

  return (
    <div className="app-container">
      {/* Top Navigation */}
      <Navbar />

      {/* Main Role-Specific View */}
      <main className="main-content">
        {currentUser.role === 'pasien' && <PatientDashboard />}
        {currentUser.role === 'dokter' && <DoctorEMR />}
        {currentUser.role === 'admin' && <AdminAuditLogs />}
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
            <strong>MediSync: Sistem Manajemen Telemedis</strong> • Versi 1.0 (Dokumen PRD Kelompok 4)
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ShieldCheck size={14} color="#0F766E" /> Keamanan Data & Audit Log Aktif
            </span>
            <span>•</span>
            <span>Aturan Backup 3-2-1</span>
            <span>•</span>
            <span>Soft Delete EMR Terproteksi</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
