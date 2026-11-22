import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Plus, Save, Trash2, X } from 'lucide-react';

function getInitialItems(prescription) {
  return (prescription?.items || []).map((item) => ({
    medicineName: item.medicineName || '',
    quantity: String(Number.parseInt(String(item.quantity || '').match(/\d+/)?.[0] || '1', 10)),
    dosage: item.dosage || '',
  }));
}

export default function EMREditModal() {
  const {
    editingEMR,
    setEditingEMR,
    prescriptions,
    updateEMR,
  } = useApp();
  const prescription = useMemo(
    () => prescriptions.find((item) => Number(item.medicalRecordId) === Number(editingEMR?.id)),
    [prescriptions, editingEMR?.id]
  );
  const [complaint, setComplaint] = useState(editingEMR?.complaint || '');
  const [diagnosis, setDiagnosis] = useState(editingEMR?.diagnosis || '');
  const [action, setAction] = useState(editingEMR?.action || '');
  const [prescriptionNote, setPrescriptionNote] = useState(prescription?.notes || '');
  const [prescriptionItems, setPrescriptionItems] = useState(() => getInitialItems(prescription));
  const [vitals, setVitals] = useState(editingEMR?.vitals || {
    bp: '',
    heartRate: '',
    temperature: '',
    weight: '',
    respRate: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!editingEMR) return;
    setComplaint(editingEMR.complaint || '');
    setDiagnosis(editingEMR.diagnosis || '');
    setAction(editingEMR.action || '');
    setPrescriptionNote(prescription?.notes || '');
    setPrescriptionItems(getInitialItems(prescription));
    setVitals(editingEMR.vitals || {
      bp: '',
      heartRate: '',
      temperature: '',
      weight: '',
      respRate: '',
    });
    setError('');
  }, [editingEMR?.id, prescription?.id]);

  if (!editingEMR) return null;

  const updateItem = (index, changes) => {
    setPrescriptionItems((items) => items.map((item, itemIndex) =>
      itemIndex === index ? { ...item, ...changes } : item
    ));
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (!diagnosis.trim()) {
      setError('Diagnosis wajib diisi.');
      return;
    }
    if (prescription && prescriptionItems.length === 0) {
      setError('Resep yang sudah diterbitkan harus memiliki minimal satu obat.');
      return;
    }

    const items = prescriptionItems.map((item) => ({
      medicineName: item.medicineName.trim(),
      quantity: Number(item.quantity),
      dosage: item.dosage.trim(),
    }));
    if (items.some((item) =>
      !item.medicineName ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      !item.dosage
    )) {
      setError('Lengkapi nama obat, jumlah, dan aturan pakai pada setiap item resep.');
      return;
    }

    setSaving(true);
    try {
      await updateEMR(editingEMR.id, {
        complaint: complaint.trim(),
        diagnosis: diagnosis.trim(),
        action: action.trim(),
        prescriptionItems: items,
        prescriptionNote: prescriptionNote.trim(),
        vitals,
      });
      setEditingEMR(null);
    } catch (saveError) {
      setError(saveError.message || 'Rekam medis gagal diperbarui.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div className="modal-content" style={{ maxWidth: 850, maxHeight: '92vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>Edit Rekam Medis #{editingEMR.id}</h3>
            <p style={{ fontSize: '0.82rem', color: '#64748B' }}>{editingEMR.patientName}</p>
          </div>
          <button type="button" onClick={() => setEditingEMR(null)} aria-label="Tutup">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={submit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label" htmlFor="edit-emr-complaint">Keluhan</label>
              <textarea id="edit-emr-complaint" className="form-textarea" value={complaint} onChange={(event) => setComplaint(event.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="edit-emr-diagnosis">Diagnosis</label>
              <input id="edit-emr-diagnosis" className="form-input" value={diagnosis} onChange={(event) => setDiagnosis(event.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="edit-emr-action">Tindakan & edukasi</label>
              <textarea id="edit-emr-action" className="form-textarea" value={action} onChange={(event) => setAction(event.target.value)} />
            </div>

            <div className="form-group">
              <label className="form-label">Tanda vital</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                {[
                  ['bp', 'Tekanan darah'],
                  ['heartRate', 'Denyut nadi'],
                  ['temperature', 'Suhu tubuh'],
                  ['weight', 'Berat badan'],
                  ['respRate', 'Frekuensi napas'],
                ].map(([key, label]) => (
                  <input
                    key={key}
                    className="form-input"
                    aria-label={label}
                    placeholder={label}
                    value={vitals[key] || ''}
                    onChange={(event) => setVitals((current) => ({ ...current, [key]: event.target.value }))}
                  />
                ))}
              </div>
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <label className="form-label" style={{ margin: 0 }}>Resep obat</label>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setPrescriptionItems((items) => [...items, { medicineName: '', quantity: '1', dosage: '' }])}
                >
                  <Plus size={14} /> Tambah obat
                </button>
              </div>
              {prescriptionItems.map((item, index) => (
                    <div key={index} style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1fr) 90px minmax(160px, 1fr) auto', gap: 8, marginTop: 10, alignItems: 'center' }}>
                        <input
                          className="form-input"
                          aria-label="Nama obat"
                          placeholder="Nama obat"
                          value={item.medicineName}
                          onChange={(event) => updateItem(index, { medicineName: event.target.value })}
                          required
                        />
                      <input className="form-input" type="number" min="1" step="1" aria-label="Jumlah" value={item.quantity} onChange={(event) => updateItem(index, { quantity: event.target.value })} required />
                      <input className="form-input" aria-label="Aturan pakai" placeholder="Aturan pakai" value={item.dosage} onChange={(event) => updateItem(index, { dosage: event.target.value })} required />
                      <button type="button" className="btn btn-outline btn-sm" aria-label="Hapus item resep" onClick={() => setPrescriptionItems((items) => items.filter((_, itemIndex) => itemIndex !== index))}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  {prescriptionItems.length > 0 && (
                    <textarea
                      className="form-textarea"
                      style={{ marginTop: 10 }}
                      aria-label="Catatan resep"
                      placeholder="Catatan resep untuk pasien (opsional)"
                      value={prescriptionNote}
                      onChange={(event) => setPrescriptionNote(event.target.value)}
                    />
                  )}
            </div>
            {error && <div role="alert" style={{ color: '#B91C1C', background: '#FEF2F2', padding: 10, borderRadius: 8 }}>{error}</div>}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={() => setEditingEMR(null)}>Batal</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              <Save size={16} /> {saving ? 'Menyimpan…' : 'Simpan perubahan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
