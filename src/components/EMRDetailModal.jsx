import React from 'react';
import { useApp } from '../context/AppContext';
import { FileText, Printer, X, ShieldAlert, CheckCircle2, User, Stethoscope, Heart, Calendar } from 'lucide-react';

export default function EMRDetailModal() {
  const { viewingEMR, setViewingEMR, softDeleteEMR, restoreEMR, currentUser } = useApp();

  if (!viewingEMR) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '720px' }}>
        {/* Header */}
        <div className="modal-header" style={{ background: '#F8FAFC' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={20} color="#1D4ED8" />
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Rekam Medis Elektronik (EMR)</h3>
              <span className="badge badge-primary">{viewingEMR.id}</span>
              {viewingEMR.isDeleted && (
                <span className="badge badge-danger">
                  <ShieldAlert size={12} /> Data Terhapus (Soft Delete)
                </span>
              )}
            </div>
            <p style={{ fontSize: '0.8rem', color: '#64748B', marginTop: '2px' }}>
              Klinik Pratama MediSync • Dokumen Rekam Kesehatan Terenkripsi
            </p>
          </div>
          <button
            onClick={() => setViewingEMR(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Soft Delete Alert banner if soft-deleted */}
        {viewingEMR.isDeleted && (
          <div 
            style={{ 
              backgroundColor: '#FEF2F2', 
              borderBottom: '1px solid #FECACA', 
              padding: '12px 24px', 
              color: '#991B1B', 
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div>
              <strong>Perhatian:</strong> Rekam medis ini telah ditandai soft delete pada {viewingEMR.deletedAt}. 
              <br />
              <span style={{ fontSize: '0.78rem' }}>Alasan/Pelaksana: {viewingEMR.deletedBy}</span>
            </div>
            {currentUser.role !== 'pasien' && (
              <button
                className="btn btn-sm btn-primary"
                onClick={() => {
                  restoreEMR(viewingEMR.id);
                  setViewingEMR({ ...viewingEMR, isDeleted: false });
                }}
              >
                Pulihkan Data
              </button>
            )}
          </div>
        )}

        <div className="modal-body">
          {/* Metadata Grid */}
          <div 
            style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
              gap: '14px', 
              background: '#F8FAFC', 
              padding: '16px', 
              borderRadius: '12px',
              border: '1px solid #E2E8F0',
              marginBottom: '20px'
            }}
          >
            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>PASIEN</div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{viewingEMR.patientName}</div>
              <div style={{ fontSize: '0.8rem', color: '#475569' }}>NIK: {viewingEMR.patientNik}</div>
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>DOKTER PEMERIKSA</div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0F766E' }}>{viewingEMR.doctorName}</div>
              <div style={{ fontSize: '0.8rem', color: '#475569' }}>SIP: {viewingEMR.doctorSip}</div>
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>TANGGAL PEMERIKSAAN</div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{viewingEMR.date}</div>
              <div style={{ fontSize: '0.8rem', color: '#10B981', fontWeight: 600 }}>Sesi Selesai</div>
            </div>
          </div>

          {/* Vital Signs (Tanda Vital) */}
          {viewingEMR.vitals && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Heart size={16} color="#DC2626" />
                <span>Tanda-Tanda Vital (Vitals)</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                <div style={{ background: '#FFF', border: '1px solid #E2E8F0', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748B' }}>Tekanan Darah</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1D4ED8' }}>{viewingEMR.vitals.bp || '120/80 mmHg'}</div>
                </div>
                <div style={{ background: '#FFF', border: '1px solid #E2E8F0', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748B' }}>Denyut Nadi</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700 }}>{viewingEMR.vitals.heartRate || '78 bpm'}</div>
                </div>
                <div style={{ background: '#FFF', border: '1px solid #E2E8F0', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748B' }}>Suhu Tubuh</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700 }}>{viewingEMR.vitals.temperature || '36.6 °C'}</div>
                </div>
                <div style={{ background: '#FFF', border: '1px solid #E2E8F0', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748B' }}>Berat Badan</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700 }}>{viewingEMR.vitals.weight || '70 kg'}</div>
                </div>
              </div>
            </div>
          )}

          {/* Keluhan & Diagnosis */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '14px' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '4px' }}>
                Keluhan Utama Pasien
              </div>
              <div style={{ fontSize: '0.9rem', color: '#0F172A', lineHeight: 1.5 }}>
                {viewingEMR.complaint}
              </div>
            </div>

            <div style={{ background: '#F0FDFA', border: '1px solid #99F6E4', borderRadius: '10px', padding: '14px' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0F766E', textTransform: 'uppercase', marginBottom: '4px' }}>
                Diagnosis Klinis
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0F766E' }}>
                {viewingEMR.diagnosis}
              </div>
            </div>

            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '14px' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '4px' }}>
                Tindakan Medis & Edukasi
              </div>
              <div style={{ fontSize: '0.9rem', color: '#0F172A', lineHeight: 1.5 }}>
                {viewingEMR.action}
              </div>
            </div>

            {/* Resep Obat */}
            <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '10px', padding: '14px' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1D4ED8', textTransform: 'uppercase', marginBottom: '6px' }}>
                Resep Obat Digital (e-Prescription)
              </div>
              <pre style={{ 
                fontFamily: 'inherit', 
                fontSize: '0.9rem', 
                color: '#1E3A8A', 
                whiteSpace: 'pre-wrap', 
                lineHeight: 1.6,
                fontWeight: 500
              }}>
                {viewingEMR.prescription}
              </pre>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          {currentUser.role === 'dokter' && !viewingEMR.isDeleted && (
            <button
              className="btn btn-danger-outline btn-sm"
              onClick={() => {
                const reason = prompt('Masukkan alasan soft delete rekam medis:', 'Koreksi penulisan oleh dokter pemeriksa');
                if (reason) {
                  softDeleteEMR(viewingEMR.id, reason);
                  setViewingEMR(null);
                }
              }}
            >
              Soft Delete Rekam Medis
            </button>
          )}

          <button className="btn btn-outline" onClick={handlePrint}>
            <Printer size={16} />
            <span>Cetak Rekam Medis</span>
          </button>
          <button className="btn btn-primary" onClick={() => setViewingEMR(null)}>
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
