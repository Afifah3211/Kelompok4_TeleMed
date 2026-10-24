import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Pill, 
  CheckCircle2, 
  Clock, 
  Package, 
  AlertCircle, 
  Search, 
  FileText, 
  User, 
  Stethoscope, 
  ChevronRight,
  Plus,
  Minus,
  Truck,
  Sparkles
} from 'lucide-react';

export default function PharmacistDashboard() {
  const { 
    currentUser, 
    prescriptions, 
    updatePrescriptionStatus, 
    medicines, 
    updateMedicineStock,
    showToast 
  } = useApp();

  const [activeTab, setActiveTab] = useState('resep'); // 'resep' | 'obat'
  const [filterStatus, setFilterStatus] = useState('Semua');
  const [selectedRx, setSelectedRx] = useState(prescriptions[0] || null);
  const [searchDrug, setSearchDrug] = useState('');

  const filteredPrescriptions = prescriptions.filter((rx) => {
    if (filterStatus === 'Semua') return true;
    return rx.status.toLowerCase().includes(filterStatus.toLowerCase());
  });

  const filteredMedicines = medicines.filter((m) =>
    m.name.toLowerCase().includes(searchDrug.toLowerCase()) ||
    m.category.toLowerCase().includes(searchDrug.toLowerCase())
  );

  return (
    <div className="pharmacist-dashboard-container">
      {/* Top Header Card */}
      <div className="dashboard-banner pharma-banner">
        <div className="banner-left">
          <div className="banner-icon-circle">
            <Pill size={26} color="#059669" />
          </div>
          <div>
            <h2 className="banner-title">Instalasi Farmasi & Pengelolaan Obat</h2>
            <p className="banner-sub">
              Petugas: <strong>{currentUser.name}</strong> • SIPA: {currentUser.sipa || '19950512/SIPA-3273/2022'} • RS/Klinik TeleMed
            </p>
          </div>
        </div>

        <div className="pharma-stats-row">
          <div className="p-stat-card">
            <span className="p-stat-num">{prescriptions.length}</span>
            <span className="p-stat-lbl">Total Resep Masuk</span>
          </div>
          <div className="p-stat-card">
            <span className="p-stat-num text-amber">
              {prescriptions.filter(p => p.status.includes('Menunggu') || p.status.includes('Diramu')).length}
            </span>
            <span className="p-stat-lbl">Perlu Disiapkan</span>
          </div>
          <div className="p-stat-card">
            <span className="p-stat-num text-emerald">
              {prescriptions.filter(p => p.status.includes('Selesai')).length}
            </span>
            <span className="p-stat-lbl">Resep Selesai</span>
          </div>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="pharma-tab-nav">
        <button
          className={`pharma-nav-btn ${activeTab === 'resep' ? 'active' : ''}`}
          onClick={() => setActiveTab('resep')}
        >
          <FileText size={16} />
          <span>Antrean Resep Digital ({prescriptions.length})</span>
        </button>

        <button
          className={`pharma-nav-btn ${activeTab === 'obat' ? 'active' : ''}`}
          onClick={() => setActiveTab('obat')}
        >
          <Package size={16} />
          <span>Inventori & Stok Obat ({medicines.length})</span>
        </button>
      </div>

      {/* Tab 1: Antrean Resep Digital */}
      {activeTab === 'resep' && (
        <div className="pharma-content-split">
          {/* Left: Prescription list */}
          <div className="pharma-list-col">
            <div className="filter-bar">
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Filter Status:</span>
              <div className="filter-chips">
                {['Semua', 'Menunggu', 'Diramu', 'Selesai'].map((st) => (
                  <button
                    key={st}
                    className={`filter-chip ${filterStatus === st ? 'active' : ''}`}
                    onClick={() => setFilterStatus(st)}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            <div className="rx-cards-stack">
              {filteredPrescriptions.length === 0 ? (
                <div className="empty-state-box">
                  <Clock size={32} color="#94A3B8" />
                  <p>Tidak ada resep pada kategori ini.</p>
                </div>
              ) : (
                filteredPrescriptions.map((rx) => (
                  <div
                    key={rx.id}
                    className={`rx-item-card ${selectedRx?.id === rx.id ? 'selected' : ''}`}
                    onClick={() => setSelectedRx(rx)}
                  >
                    <div className="rx-card-header">
                      <span className="rx-id-badge">{rx.id}</span>
                      <span className={`status-pill ${
                        rx.status.includes('Selesai') ? 'pill-success' :
                        rx.status.includes('Diramu') ? 'pill-warning' : 'pill-info'
                      }`}>
                        {rx.status}
                      </span>
                    </div>

                    <div className="rx-patient-info">
                      <strong>{rx.patientName}</strong>
                      <span className="rx-doc-name">
                        <Stethoscope size={13} /> {rx.doctorName}
                      </span>
                    </div>

                    <div className="rx-items-snippet">
                      {rx.items?.map((it, idx) => (
                        <span key={idx} className="rx-item-tag">
                          {it.medicineName} ({it.quantity})
                        </span>
                      ))}
                    </div>

                    <div className="rx-time-sub">
                      <Clock size={12} /> {rx.date}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right: Selected Prescription Detail & Action */}
          <div className="pharma-detail-col">
            {selectedRx ? (
              <div className="rx-detail-box">
                <div className="rx-detail-header">
                  <div>
                    <span className="rx-top-tag">Lembar Resep Elektronik (e-Prescription)</span>
                    <h3 style={{ fontSize: '1.25rem', marginTop: '4px' }}>{selectedRx.id}</h3>
                  </div>
                  <span className={`status-pill ${
                    selectedRx.status.includes('Selesai') ? 'pill-success' :
                    selectedRx.status.includes('Diramu') ? 'pill-warning' : 'pill-info'
                  }`}>
                    {selectedRx.status}
                  </span>
                </div>

                <div className="patient-meta-grid">
                  <div className="meta-box">
                    <small>Nama Pasien</small>
                    <strong>{selectedRx.patientName}</strong>
                  </div>
                  <div className="meta-box">
                    <small>Dokter Pemeriksa</small>
                    <strong>{selectedRx.doctorName}</strong>
                  </div>
                  <div className="meta-box">
                    <small>Waktu Konsultasi</small>
                    <span>{selectedRx.date}</span>
                  </div>
                  <div className="meta-box">
                    <small>Catatan Medis Dokter</small>
                    <span className="text-muted">{selectedRx.notes || '-'}</span>
                  </div>
                </div>

                <div className="prescribed-items-list">
                  <h4 style={{ fontSize: '0.95rem', marginBottom: '8px', color: '#1E293B' }}>
                    Daftar Obat yang Diresepkan:
                  </h4>
                  {selectedRx.items && selectedRx.items.length > 0 ? (
                    <div className="items-table-wrapper">
                      <table className="items-table">
                        <thead>
                          <tr>
                            <th>Nama Obat</th>
                            <th>Jumlah</th>
                            <th>Aturan Pakai / Dosis</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedRx.items.map((item, idx) => (
                            <tr key={idx}>
                              <td><strong>{item.medicineName}</strong></td>
                              <td>{item.quantity}</td>
                              <td>{item.dosage}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <pre className="prescription-raw-box">{selectedRx.prescriptionText}</pre>
                  )}
                </div>

                <div className="pharmacist-workflow-actions">
                  <h4 style={{ fontSize: '0.9rem', marginBottom: '10px' }}>Ubah Status Pengerjaan Obat:</h4>
                  <div className="workflow-buttons">
                    <button
                      className="btn btn-outline"
                      onClick={() => updatePrescriptionStatus(selectedRx.id, 'Sedang Diramu', 'Obat sedang disiapkan di instalasi farmasi.')}
                      disabled={selectedRx.status === 'Sedang Diramu'}
                    >
                      <Clock size={16} />
                      <span>Sedang Diramu</span>
                    </button>

                    <button
                      className="btn btn-primary"
                      onClick={() => updatePrescriptionStatus(selectedRx.id, 'Selesai / Sudah Diambil', 'Obat telah diserahkan lengkap dengan etiket pemakaian.')}
                      disabled={selectedRx.status === 'Selesai / Sudah Diambil'}
                    >
                      <CheckCircle2 size={16} />
                      <span>Selesai & Siap Diambil / Kirim</span>
                    </button>
                  </div>
                </div>

                <div className="audit-trace-note">
                  <small>
                    Catatan Farmasi: <em>{selectedRx.pharmacistNotes || 'Menunggu verifikasi apoteker.'}</em>
                  </small>
                </div>
              </div>
            ) : (
              <div className="empty-select-box">
                <FileText size={48} color="#CBD5E1" />
                <p>Pilih salah satu resep di sisi kiri untuk memproses.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Inventori & Stok Obat */}
      {activeTab === 'obat' && (
        <div className="pharma-inventory-view">
          <div className="inventory-top-bar">
            <div className="search-box-pill">
              <Search size={18} color="#64748B" />
              <input
                type="text"
                placeholder="Cari obat (nama, kategori)..."
                value={searchDrug}
                onChange={(e) => setSearchDrug(e.target.value)}
              />
            </div>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => showToast('Katalog obat terintegrasi dengan database klinik.', 'info')}
            >
              Sinkronisasi Database Obat
            </button>
          </div>

          <div className="table-responsive">
            <table className="med-inventory-table">
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Nama Obat</th>
                  <th>Kategori</th>
                  <th>Sediaan</th>
                  <th>Aturan Pakai Standar</th>
                  <th>Harga / Satuan</th>
                  <th>Sisa Stok</th>
                  <th style={{ textAlign: 'center' }}>Kelola Stok</th>
                </tr>
              </thead>
              <tbody>
                {filteredMedicines.map((med) => (
                  <tr key={med.id}>
                    <td><code>{med.id}</code></td>
                    <td>
                      <strong>{med.name}</strong>
                      <small className="block text-muted">{med.description}</small>
                    </td>
                    <td><span className="cat-badge">{med.category}</span></td>
                    <td>{med.form}</td>
                    <td><small>{med.dosage}</small></td>
                    <td><strong>Rp {med.price.toLocaleString('id-ID')}</strong> <small>/{med.unit}</small></td>
                    <td>
                      <span className={`stock-badge ${med.stock < 100 ? 'stock-low' : 'stock-ok'}`}>
                        {med.stock} {med.unit}
                      </span>
                    </td>
                    <td>
                      <div className="stock-btn-group">
                        <button
                          className="btn-stock-adjust dec"
                          onClick={() => updateMedicineStock(med.id, -10)}
                          title="Kurangi 10"
                        >
                          <Minus size={14} />
                        </button>
                        <button
                          className="btn-stock-adjust inc"
                          onClick={() => updateMedicineStock(med.id, 10)}
                          title="Tambah 10"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
