import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Pill, 
  CheckCircle2, 
  Clock, 
  Package, 
  Search, 
  FileText, 
  Stethoscope, 
  Plus,
  Minus,
  RefreshCw
} from 'lucide-react';

export default function PharmacistDashboard() {
  const { 
    currentUser, 
    prescriptions, 
    refreshPrescriptions,
    updatePrescriptionStatus, 
    medicines, 
    updateMedicineStock,
    showToast 
  } = useApp();

  const [activeTab, setActiveTab] = useState('resep'); // 'resep' | 'obat'
  const [queueView, setQueueView] = useState('active'); // 'active' | 'completed'
  const [selectedRx, setSelectedRx] = useState(prescriptions[0] || null);
  const [searchDrug, setSearchDrug] = useState('');

  const isCompleted = (rx) => rx.status.toLowerCase().includes('selesai');
  const isReturned = (rx) => rx.status === 'Dikembalikan ke Dokter';
  const activePrescriptions = prescriptions.filter((rx) => !isCompleted(rx) && !isReturned(rx));
  const historyPrescriptions = prescriptions.filter((rx) => isCompleted(rx) || isReturned(rx));
  const visiblePrescriptions = queueView === 'active' ? activePrescriptions : historyPrescriptions;
  const unavailableItems = selectedRx?.items?.filter((item) =>
    !item.medicineId || !medicines.some((medicine) => Number(medicine.id) === Number(item.medicineId))
  ) || [];

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') {
        refreshPrescriptions().catch((error) => console.warn('Gagal memperbarui antrean resep:', error));
      }
    };
    refresh();
    const timer = window.setInterval(refresh, 15000);
    return () => window.clearInterval(timer);
  }, [refreshPrescriptions]);

  useEffect(() => {
    if (visiblePrescriptions.length === 0) {
      setSelectedRx(null);
      return;
    }
    setSelectedRx((current) => visiblePrescriptions.find((rx) => rx.id === current?.id) || visiblePrescriptions[0]);
  }, [prescriptions, queueView]);

  const filteredMedicines = medicines.filter((m) =>
    m.name.toLowerCase().includes(searchDrug.toLowerCase()) ||
    (m.category || '').toLowerCase().includes(searchDrug.toLowerCase()) ||
    (m.code || '').toLowerCase().includes(searchDrug.toLowerCase())
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
            <h2 className="banner-title">Layanan Farmasi</h2>
            <p className="banner-sub">
              Petugas: <strong>{currentUser.name}</strong> • SIPA: {currentUser.sipa || '19950512/SIPA-3273/2022'} • RS/Klinik TeleMed
            </p>
          </div>
        </div>

        <div className="pharma-stats-row">
          <div className="p-stat-card">
            <span className="p-stat-num">{activePrescriptions.length}</span>
            <span className="p-stat-lbl">Antrean Aktif</span>
          </div>
          <div className="p-stat-card">
            <span className="p-stat-num text-amber">
              {prescriptions.filter((p) => p.status.includes('Menunggu')).length}
            </span>
            <span className="p-stat-lbl">Menunggu Diracik</span>
          </div>
          <div className="p-stat-card">
            <span className="p-stat-num text-emerald">
              {historyPrescriptions.filter(isCompleted).length}
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
          <span>Resep</span>
        </button>

        <button
          className={`pharma-nav-btn ${activeTab === 'obat' ? 'active' : ''}`}
          onClick={() => setActiveTab('obat')}
        >
          <Package size={16} />
          <span>Stok obat</span>
        </button>
      </div>

      {/* Tab 1: Antrean Resep Digital */}
      {activeTab === 'resep' && (
        <div className="pharma-content-split">
          {/* Left: Prescription list */}
          <div className="pharma-list-col">
            <div className="filter-bar pharmacist-queue-toolbar">
              <div className="queue-view-switch" aria-label="Tampilan antrean resep">
                <button type="button" className={`filter-chip ${queueView === 'active' ? 'active' : ''}`} onClick={() => setQueueView('active')}>
                  Antrean aktif
                </button>
                <button type="button" className={`filter-chip ${queueView === 'completed' ? 'active' : ''}`} onClick={() => setQueueView('completed')}>
                  Riwayat resep
                </button>
              </div>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => refreshPrescriptions().catch((error) => showToast(error.message || 'Gagal memperbarui antrean resep.', 'danger'))}>
                <RefreshCw size={14} /> Segarkan
              </button>
            </div>

            <div className="rx-cards-stack">
              {visiblePrescriptions.length === 0 ? (
                <div className="empty-state-box">
                  <Clock size={32} color="#94A3B8" />
                  <p>{queueView === 'active' ? 'Tidak ada resep yang perlu diproses.' : 'Belum ada riwayat resep.'}</p>
                </div>
              ) : (
                visiblePrescriptions.map((rx) => (
                  <div
                    key={rx.id}
                    className={`rx-item-card ${selectedRx?.id === rx.id ? 'selected' : ''}`}
                    onClick={() => setSelectedRx(rx)}
                  >
                    <div className="rx-card-header">
                      <span className="rx-id-badge">{rx.id}</span>
                      <span className={`status-pill ${
                        rx.status.includes('Selesai') ? 'pill-success' :
                        rx.status.includes('Diramu') || isReturned(rx) ? 'pill-warning' : 'pill-info'
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
                    selectedRx.status.includes('Diramu') || isReturned(selectedRx) ? 'pill-warning' : 'pill-info'
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
                    <small>Catatan Dokter untuk Apoteker</small>
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

                {!isCompleted(selectedRx) && !isReturned(selectedRx) && unavailableItems.length > 0 ? (
                  <div className="rx-correction-warning" role="alert">
                    <div>
                      <strong>Resep perlu diperbaiki</strong>
                      <p>Obat {unavailableItems.map((item) => `“${item.medicineName}”`).join(', ')} tidak cocok dengan katalog stok. Resep ini belum bisa diserahkan.</p>
                    </div>
                    <button
                      className="btn btn-outline"
                      onClick={() => updatePrescriptionStatus(selectedRx.id, 'Dikembalikan ke Dokter', 'Obat tidak ditemukan pada katalog stok. Mohon dokter memperbaiki resep.')}
                    >
                      Kembalikan ke dokter
                    </button>
                  </div>
                ) : !isCompleted(selectedRx) && !isReturned(selectedRx) ? (
                  <div className="pharmacist-workflow-actions">
                    <h4 style={{ fontSize: '0.9rem', marginBottom: '10px' }}>Ubah Status Pengerjaan Obat:</h4>
                    <div className="workflow-buttons">
                      <button
                        className="btn btn-outline"
                        onClick={() => updatePrescriptionStatus(selectedRx.id, 'Sedang Diramu', 'Obat sedang disiapkan di instalasi farmasi.')}
                        disabled={selectedRx.status !== 'Menunggu Penyiapan'}
                      >
                        <Clock size={16} />
                        <span>Sedang Diramu</span>
                      </button>

                      <button
                        className="btn btn-primary"
                        onClick={() => updatePrescriptionStatus(selectedRx.id, 'Selesai / Sudah Diambil', 'Obat telah diserahkan lengkap dengan etiket pemakaian.')}
                        disabled={selectedRx.status !== 'Sedang Diramu'}
                      >
                        <CheckCircle2 size={16} />
                        <span>Tandai Sudah Diserahkan</span>
                      </button>
                    </div>
                  </div>
                ) : isReturned(selectedRx) ? (
                  <div className="prescription-completed-note">
                    Resep dikembalikan ke dokter untuk diperbaiki. Resep tersimpan di riwayat dan tidak mengurangi stok.
                  </div>
                ) : (
                  <div className="prescription-completed-note">
                    <CheckCircle2 size={17} /> Resep ini sudah diserahkan. Riwayat hanya dapat dilihat dan stoknya telah diperbarui.
                  </div>
                )}

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
            <span className="inventory-result-count">Menampilkan {filteredMedicines.length} dari {medicines.length} obat</span>
          </div>

          <div className="inventory-guidance">
            <Package size={16} />
            <span>Stok memakai satuan pada kolom obat; angka di bawah 100 ditandai rendah. Tombol +/− mengubah stok sebanyak 10 satuan.</span>
          </div>

          <div className="table-responsive">
            <table className="med-inventory-table">
              <colgroup>
                <col className="inventory-col-code" />
                <col className="inventory-col-name" />
                <col className="inventory-col-category" />
                <col className="inventory-col-form" />
                <col className="inventory-col-dosage" />
                <col className="inventory-col-price" />
                <col className="inventory-col-stock" />
                <col className="inventory-col-actions" />
              </colgroup>
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
                      <div className="medicine-name">{med.name}</div>
                      {med.description && <div className="medicine-description">{med.description}</div>}
                    </td>
                    <td><span className="cat-badge">{med.category}</span></td>
                    <td>{med.form}</td>
                    <td><span className="medicine-dosage">{med.dosage}</span></td>
                    <td><strong>Rp {Number(med.price || 0).toLocaleString('id-ID')}</strong><span className="medicine-unit">/{med.unit}</span></td>
                    <td>
                      <span className={`stock-badge ${med.stock < 100 ? 'stock-low' : 'stock-ok'}`}>
                        {med.stock} <span>{med.unit}</span>
                      </span>
                    </td>
                    <td>
                      <div className="stock-btn-group">
                        <button
                          className="btn-stock-adjust dec"
                          onClick={() => updateMedicineStock(med.id, -10)}
                          title={`Kurangi 10 ${med.unit}`}
                          aria-label={`Kurangi stok ${med.name} sebanyak 10 ${med.unit}`}
                          disabled={med.stock < 10}
                        >
                          <Minus size={14} />
                        </button>
                        <button
                          className="btn-stock-adjust inc"
                          onClick={() => updateMedicineStock(med.id, 10)}
                          title={`Tambah 10 ${med.unit}`}
                          aria-label={`Tambah stok ${med.name} sebanyak 10 ${med.unit}`}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredMedicines.length === 0 && (
                  <tr>
                    <td colSpan="8" className="inventory-empty-cell">Tidak ada obat yang cocok dengan pencarian.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
