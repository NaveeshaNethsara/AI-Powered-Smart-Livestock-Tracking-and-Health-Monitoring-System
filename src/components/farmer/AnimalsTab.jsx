// ── AnimalsTab.jsx ───────────────────────────────────────────
// FR-F06 Register animal  FR-F07 Edit  FR-F08 Remove
// FR-F09 View profile     FR-F10 Search  FR-F11 Assign collar
// FR-F12 Vaccinations     FR-F13 Medical history
import React, { useState, useEffect } from 'react';
import {
  Plus, Trash2, Edit3, Save, X, Search, Cpu, ChevronDown,
  ChevronUp, Syringe, FileText, Tag
} from 'lucide-react';
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  onSnapshot, query, orderBy, Timestamp
} from 'firebase/firestore';
import { db } from '../../firebase';

const EMPTY_FORM = {
  name: '', tagNumber: '', species: 'Cattle', breed: '',
  gender: 'female', weight: '', color: '', deviceId: ''
};

export default function AnimalsTab({ animals, devices, farmerId }) {
  const [searchQuery, setSearchQuery]   = useState('');
  const [showForm, setShowForm]         = useState(false);
  const [editingId, setEditingId]       = useState(null);
  const [form, setForm]                 = useState(EMPTY_FORM);
  const [expandedId, setExpandedId]     = useState(null);
  const [vaccinations, setVaccinations] = useState([]);
  const [healthRecords, setHealthRecords] = useState([]);
  const [activeSubTab, setActiveSubTab] = useState('vaccinations');
  const [saving, setSaving]             = useState(false);
  const [msg, setMsg]                   = useState('');

  // Load sub-records when an animal is expanded
  useEffect(() => {
    if (!expandedId) return;
    const vq = query(collection(db, 'animals', expandedId, 'vaccinations'), orderBy('administeredOn', 'desc'));
    const hq = query(collection(db, 'animals', expandedId, 'health_records'), orderBy('createdAt', 'desc'));
    const u1 = onSnapshot(vq, s => setVaccinations(s.docs.map(d => ({ docId: d.id, ...d.data() }))));
    const u2 = onSnapshot(hq, s => setHealthRecords(s.docs.map(d => ({ docId: d.id, ...d.data() }))));
    return () => { u1(); u2(); };
  }, [expandedId]);

  const filtered = animals.filter(a =>
    (a.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (a.tagNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (a.species || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openAdd = () => { setForm(EMPTY_FORM); setEditingId(null); setShowForm(true); };
  const openEdit = (a) => {
    setForm({
      name: a.name || '', tagNumber: a.tagNumber || '', species: a.species || 'Cattle',
      breed: a.breed || '', gender: a.gender || 'female',
      weight: a.weight || '', color: a.color || '', deviceId: a.deviceId || ''
    });
    setEditingId(a.docId);
    setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data = {
        name: form.name, tagNumber: form.tagNumber, species: form.species,
        breed: form.breed, gender: form.gender, weight: parseFloat(form.weight) || 0,
        color: form.color, deviceId: form.deviceId,
        farmerId: farmerId || 'farmer-uid-001',
        isActive: true, updatedAt: Timestamp.now()
      };
      if (editingId) {
        await updateDoc(doc(db, 'animals', editingId), data);
        setMsg('Animal updated successfully!');
      } else {
        await addDoc(collection(db, 'animals'), {
          ...data, healthStatus: 'healthy', currentHealthScore: 80,
          imageUrl: '', assignedVetId: 'vet-uid-001',
          registeredAt: Timestamp.now()
        });
        setMsg('Animal registered successfully!');
      }
      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
    } catch (err) {
      setMsg('Error: ' + err.message);
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(''), 3000);
    }
  };

  const handleDelete = async (docId, name) => {
    if (!window.confirm(`Remove ${name} from the system? This cannot be undone.`)) return;
    await updateDoc(doc(db, 'animals', docId), { isActive: false, updatedAt: Timestamp.now() });
    setMsg(`${name} removed.`);
    setTimeout(() => setMsg(''), 2000);
  };

  const fmtDate = (ts) => {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toISOString().split('T')[0];
  };

  const inputStyle = { paddingLeft: '1rem' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="search-input-wrapper" style={{ maxWidth: '320px', flex: 1 }}>
          <Search size={16} className="search-ico" />
          <input type="text" placeholder="Search by name, tag, species..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
        <button className="btn-primary" onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Plus size={16} /> Register Animal
        </button>
      </div>

      {msg && <div className="feedback-message feedback-success">{msg}</div>}

      {/* Add/Edit Form */}
      {showForm && (
        <div className="map-card-wrapper" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h4 style={{ color: '#fff', fontFamily: 'var(--font-heading)', fontSize: '1.1rem' }}>
              {editingId ? 'Edit Animal Information' : 'Register New Animal'} — FR-F{editingId ? '07' : '06'}
            </h4>
            <button onClick={() => setShowForm(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <X size={18} />
            </button>
          </div>
          <form onSubmit={handleSave}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem' }}>
              {[
                { key: 'name', label: 'Animal Name', type: 'text' },
                { key: 'tagNumber', label: 'Tag Number (e.g. TAG-110)', type: 'text' },
                { key: 'breed', label: 'Breed', type: 'text' },
                { key: 'weight', label: 'Weight (kg)', type: 'number' },
                { key: 'color', label: 'Color / Markings', type: 'text' },
              ].map(f => (
                <div key={f.key} className="form-group" style={{ marginBottom: 0 }}>
                  <div className="input-container">
                    <input type={f.type} className="form-input" style={inputStyle} placeholder=" "
                      value={form[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })} required />
                    <label className="floating-label" style={{ left: '1rem' }}>{f.label}</label>
                  </div>
                </div>
              ))}
              {/* Species */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <div className="input-container">
                  <select className="form-input" style={{ ...inputStyle, appearance: 'none' }}
                    value={form.species} onChange={e => setForm({ ...form, species: e.target.value })}>
                    {['Cattle', 'Sheep', 'Goat', 'Buffalo', 'Pig'].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              {/* Gender */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <div className="input-container">
                  <select className="form-input" style={{ ...inputStyle, appearance: 'none' }}
                    value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}>
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                  </select>
                </div>
              </div>
              {/* Assign collar — FR-F11 */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <div className="input-container">
                  <select className="form-input" style={{ ...inputStyle, appearance: 'none' }}
                    value={form.deviceId} onChange={e => setForm({ ...form, deviceId: e.target.value })}>
                    <option value="">-- Assign IoT Collar (FR-F11) --</option>
                    {devices.map(d => (
                      <option key={d.docId} value={d.deviceId || d.docId}>
                        {d.deviceId || d.docId} — {d.macAddress} ({d.status})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button type="submit" className="btn-primary" disabled={saving}>
                <Save size={16} /> {saving ? 'Saving...' : editingId ? 'Update Animal' : 'Register Animal'}
              </button>
              <button type="button" className="btn-logout" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Animals List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {filtered.length === 0 && (
          <div className="map-card-wrapper" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            No animals found. Register your first animal above.
          </div>
        )}
        {filtered.map(animal => {
          const isExpanded = expandedId === animal.docId;
          const hClass = animal.healthStatus === 'critical' ? 'critical' : animal.healthStatus === 'at_risk' ? 'warning' : 'healthy';
          return (
            <div key={animal.docId} className="map-card-wrapper" style={{ padding: '1.25rem' }}>
              {/* Animal Row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div className={`health-indicator-border ${hClass}`} style={{ width: '4px', height: '48px', borderRadius: '2px', flexShrink: 0 }}></div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <h5 style={{ color: '#fff', fontFamily: 'var(--font-heading)', fontSize: '1rem', margin: 0 }}>{animal.name}</h5>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '0.2rem 0.6rem', borderRadius: '20px' }}>
                      <Tag size={10} style={{ marginRight: '0.2rem' }} />{animal.tagNumber}
                    </span>
                    <span className={`status-indicator-badge ${hClass}`} style={{ fontSize: '0.65rem' }}>
                      {animal.healthStatus?.replace('_', ' ')}
                    </span>
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: '0.2rem 0 0 0' }}>
                    {animal.species} • {animal.breed} • {animal.gender} • {animal.weight}kg • {animal.color}
                    {animal.deviceId && <span style={{ color: 'var(--primary)', marginLeft: '0.5rem' }}>
                      <Cpu size={10} style={{ marginRight: '0.2rem' }} />{animal.deviceId}
                    </span>}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn-logout" style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }} onClick={() => openEdit(animal)}>
                    <Edit3 size={13} /> Edit
                  </button>
                  <button
                    className="btn-logout"
                    style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', borderColor: isExpanded ? 'var(--primary)' : 'var(--border-glass)', color: isExpanded ? 'var(--primary)' : 'var(--text-muted)' }}
                    onClick={() => { setExpandedId(isExpanded ? null : animal.docId); setActiveSubTab('vaccinations'); }}
                  >
                    {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />} Records
                  </button>
                  <button
                    onClick={() => handleDelete(animal.docId, animal.name)}
                    style={{ background: 'transparent', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', color: 'var(--danger)', cursor: 'pointer', padding: '0.4rem 0.5rem', fontSize: '0.75rem' }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* Expanded: Vaccination + Medical history */}
              {isExpanded && (
                <div style={{ marginTop: '1.25rem', borderTop: '1px solid var(--border-glass)', paddingTop: '1.25rem' }}>
                  <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
                    <button className="btn-logout" onClick={() => setActiveSubTab('vaccinations')}
                      style={{ borderColor: activeSubTab === 'vaccinations' ? 'var(--primary)' : 'var(--border-glass)', color: activeSubTab === 'vaccinations' ? 'var(--primary)' : 'var(--text-muted)', fontSize: '0.75rem' }}>
                      <Syringe size={12} /> Vaccinations (FR-F12)
                    </button>
                    <button className="btn-logout" onClick={() => setActiveSubTab('medical')}
                      style={{ borderColor: activeSubTab === 'medical' ? 'var(--secondary)' : 'var(--border-glass)', color: activeSubTab === 'medical' ? 'var(--secondary)' : 'var(--text-muted)', fontSize: '0.75rem' }}>
                      <FileText size={12} /> Medical History (FR-F13)
                    </button>
                  </div>

                  {activeSubTab === 'vaccinations' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {vaccinations.length === 0 ? <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>No vaccination records.</p>
                        : vaccinations.map(v => (
                          <div key={v.docId} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)', borderRadius: '10px', padding: '0.75rem', fontSize: '0.78rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                              <strong style={{ color: '#fff' }}>{v.vaccineName}</strong>
                              <span style={{ color: 'var(--text-muted)' }}>{fmtDate(v.administeredOn)}</span>
                            </div>
                            <p style={{ color: 'var(--text-muted)', margin: 0 }}>{v.dosage} • Batch: {v.batchNumber} • Next due: {fmtDate(v.nextDueDate)}</p>
                          </div>
                        ))
                      }
                    </div>
                  )}

                  {activeSubTab === 'medical' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {healthRecords.length === 0 ? <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>No medical records.</p>
                        : healthRecords.map(r => (
                          <div key={r.docId} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)', borderRadius: '10px', padding: '0.75rem', fontSize: '0.78rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                              <strong style={{ color: '#fff', textTransform: 'uppercase' }}>{r.recordType}</strong>
                              <span style={{ color: 'var(--text-muted)' }}>{fmtDate(r.createdAt)}</span>
                            </div>
                            <p style={{ color: 'var(--text-main)', margin: '0.25rem 0' }}>{r.diagnosisNotes || r.treatment || '—'}</p>
                            {r.severity && <span style={{ color: r.severity === 'severe' ? 'var(--danger)' : r.severity === 'moderate' ? 'var(--warning)' : 'var(--primary)', fontSize: '0.7rem' }}>Severity: {r.severity}</span>}
                          </div>
                        ))
                      }
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
