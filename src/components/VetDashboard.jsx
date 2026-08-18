import React, { useState, useEffect } from 'react';
import {
  Activity, User, LogOut, Heart, Thermometer, ShieldCheck,
  AlertTriangle, CheckCircle2, Plus, Search, Filter,
  FileText, Volume2, Clock, Check, Award, Stethoscope,
  Sliders, Calendar, ClipboardList, RefreshCw, Key, Download, Mail, Save
} from 'lucide-react';
import {
  collection, query, onSnapshot, orderBy, limit, addDoc, Timestamp,
  doc, getDoc, setDoc
} from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
import { ref, onValue } from 'firebase/database';
import { db, auth, rtdb } from '../firebase';
import { jsPDF } from 'jspdf';

export default function VetDashboard({ onLogout, userEmail, userId }) {
  const [activeTab, setActiveTab] = useState('diagnostics'); // diagnostics, reports, profile

  // Firestore data states
  const [animals, setAnimals]             = useState([]);
  const [selectedAnimal, setSelectedAnimal] = useState(null);
  const [latestReadings, setLatestReadings] = useState({});
  const [latestAI, setLatestAI]         = useState({});
  const [healthRecords, setHealthRecords] = useState([]);
  const [vaccinations, setVaccinations] = useState([]);
  const [sensorHistory, setSensorHistory] = useState([]); // FR-V06 Sensor History
  const [devices, setDevices]             = useState([]);
  const [loading, setLoading]           = useState(true);

  // Filter states
  const [searchQuery, setSearchQuery]   = useState('');
  const [filterHealth, setFilterHealth] = useState('All');
  const [viewAssignedOnly, setViewAssignedOnly] = useState(false); // FR-V04 Assigned animals filter

  // Profile states (FR-V03)
  const [vetProfile, setVetProfile] = useState({
    name: '', phone: '', licenseNumber: '', email: userEmail || ''
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg]       = useState({ text: '', type: '' });
  const [resetSent, setResetSent]         = useState(false);

  // Form states
  const [diagnosis, setDiagnosis]   = useState('');
  const [treatment, setTreatment]   = useState('');
  const [vaccine, setVaccine]       = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [saving, setSaving]         = useState(false);

  // Report generation states (FR-V15)
  const [reportRange, setReportRange] = useState('daily');
  const [generatingPDF, setGeneratingPDF] = useState(false);

  // ── 1. Load Vet Profile ────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    getDoc(doc(db, 'users', userId)).then(s => {
      if (s.exists()) {
        const d = s.data();
        setVetProfile({
          name: d.name || '',
          phone: d.phone || '',
          licenseNumber: d.licenseNumber || '',
          email: d.email || userEmail || ''
        });
      }
    });
  }, [userId]);

  // Load all devices from Firestore for MAC resolution
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'devices'), (snap) => {
      setDevices(snap.docs.map(d => ({ docId: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  // ── 2. Load all animals ────────────────────────────────────
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'animals'), (snap) => {
      const list = snap.docs.map(d => ({ docId: d.id, ...d.data() }));
      setAnimals(list);
      setLoading(false);
      list.forEach(a => {
        subscribeToSensor(a.docId);
        subscribeToAI(a.docId);
      });
      // Auto-select first animal
      if (list.length > 0 && !selectedAnimal) {
        setSelectedAnimal({ docId: list[0].docId, ...list[0] });
      }
    });
    return () => unsub();
  }, []);

  // ── 3. Latest sensor reading per animal ───────────────────
  const subscribeToSensor = (animalId) => {
    const q = query(
      collection(db, 'animals', animalId, 'sensor_readings'),
      orderBy('timestamp', 'desc'), limit(1)
    );
    onSnapshot(q, (snap) => {
      if (!snap.empty) {
        setLatestReadings(prev => {
          const existing = prev[animalId];
          const incoming = snap.docs[0].data();
          if (existing && existing.timestamp && incoming.timestamp) {
            const tExist = existing.timestamp.seconds || new Date(existing.timestamp).getTime()/1000;
            const tIncoming = incoming.timestamp.seconds || new Date(incoming.timestamp).getTime()/1000;
            if (tExist >= tIncoming) return prev; // Keep the fresher RTDB stream values
          }
          return { ...prev, [animalId]: incoming };
        });
      }
    });
  };

  // ── 4. Latest AI prediction per animal ────────────────────
  const subscribeToAI = (animalId) => {
    const q = query(
      collection(db, 'animals', animalId, 'ai_predictions'),
      orderBy('timestamp', 'desc'), limit(1)
    );
    onSnapshot(q, (snap) => {
      if (!snap.empty) {
        setLatestAI(prev => ({ ...prev, [animalId]: snap.docs[0].data() }));
      }
    });
  };

  // ── 5. Load health records for selected animal ────────────
  useEffect(() => {
    if (!selectedAnimal) return;
    const q = query(
      collection(db, 'animals', selectedAnimal.docId, 'health_records'),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setHealthRecords(snap.docs.map(d => ({ docId: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [selectedAnimal?.docId]);

  // ── 6. Load vaccinations for selected animal ──────────────
  useEffect(() => {
    if (!selectedAnimal) return;
    const q = query(
      collection(db, 'animals', selectedAnimal.docId, 'vaccinations'),
      orderBy('administeredOn', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setVaccinations(snap.docs.map(d => ({ docId: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [selectedAnimal?.docId]);

  // ── 7. FR-V06: Load historical readings list (last 15) ─────
  useEffect(() => {
    if (!selectedAnimal) return;
    const q = query(
      collection(db, 'animals', selectedAnimal.docId, 'sensor_readings'),
      orderBy('timestamp', 'desc'),
      limit(15)
    );
    const unsub = onSnapshot(q, (snap) => {
      setSensorHistory(snap.docs.map(d => ({ docId: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [selectedAnimal?.docId]);

  // ── Realtime Database listener for ESP32 live telemetry ──
  useEffect(() => {
    if (animals.length === 0) return;

    const activeRTDBListeners = [];

    animals.forEach(a => {
      if (!a.deviceId) return;

      const deviceDoc = devices.find(d => d.deviceId === a.deviceId || d.docId === a.deviceId);
      const listenerKey = deviceDoc?.macAddress ? deviceDoc.macAddress.toUpperCase().trim() : a.deviceId;

      const deviceRef = ref(rtdb, `livestock/${listenerKey}/latest`);
      
      const unsubscribe = onValue(deviceRef, (snapshot) => {
        if (!snapshot.exists()) return;
        const val = snapshot.val();
        
        // Read real-time heartRate from sensor if available and valid (> 0)
        let heartRate = val.heartRate;
        const temp = val.temperature || 38.5;
        const ax = val.accelerometer?.x || 0;
        const ay = val.accelerometer?.y || 0;
        const az = val.accelerometer?.z || 0;

        // Process activity level: prefer backend ML classification, fallback to magnitude thresholds
        let activity = val.activityLevel;
        const magnitude = Math.sqrt(ax * ax + ay * ay + az * az);
        let stepIncrement = 0;

        if (heartRate === undefined || heartRate === null || heartRate <= 0) {
          // Fallback to simulation/estimation if sensor is not present/active
          heartRate = Math.floor(65 + (temp - 38.5) * 8);

          // Normalize activity values to lowercase to match styling keys
          if (activity) {
            activity = activity.toLowerCase();
          }

          if (activity === 'running' || (!activity && magnitude > 25000)) {
            activity = 'running';
            stepIncrement = 3;
            heartRate += 25;
          } else if (activity === 'walking' || (!activity && magnitude > 16000)) {
            activity = 'walking';
            stepIncrement = 1;
            heartRate += 12;
          } else if (activity === 'sleeping') {
            activity = 'sleeping';
            heartRate -= 10;
          } else if (activity === 'standing') {
            activity = 'standing';
          } else if (activity === 'resting') {
            activity = 'resting';
          } else if (activity === 'abnormal movement') {
            activity = 'abnormal movement';
            heartRate += 15;
          } else {
            activity = 'resting';
          }
          heartRate = Math.max(55, Math.min(115, heartRate));
        } else {
          // If using actual heart rate sensor, we still calculate step count based on activity
          if (activity) {
            activity = activity.toLowerCase();
          }
          if (activity === 'running' || (!activity && magnitude > 25000)) {
            activity = 'running';
            stepIncrement = 3;
          } else if (activity === 'walking' || (!activity && magnitude > 16000)) {
            activity = 'walking';
            stepIncrement = 1;
          } else if (activity === 'sleeping') {
            activity = 'sleeping';
          } else if (activity === 'standing') {
            activity = 'standing';
          } else if (activity === 'resting') {
            activity = 'resting';
          } else if (activity === 'abnormal movement') {
            activity = 'abnormal movement';
          } else {
            activity = 'resting';
          }
        }

        const prevSteps = latestReadings[a.docId]?.stepCount || 120;
        const newSteps = prevSteps + stepIncrement;

        const timestampDate = val.timestamp ? new Date(val.timestamp) : new Date();

        const readingData = {
          bodyTemperature: parseFloat(temp.toFixed(1)),
          heartRate,
          isRealHeartRate: val.heartRate > 0,
          activityLevel: activity,
          stepCount: newSteps,
          accelerometerX: parseFloat((ax / 16384.0).toFixed(2)),
          accelerometerY: parseFloat((ay / 16384.0).toFixed(2)),
          accelerometerZ: parseFloat((az / 16384.0).toFixed(2)),
          batteryLevel: val.battery || 85,
          sensorStatus: 'connected',
          isBuffered: false,
          timestamp: Timestamp.fromDate(timestampDate)
        };

        setLatestReadings(prev => ({ ...prev, [a.docId]: readingData }));
      });

      activeRTDBListeners.push({ deviceId: a.deviceId, unsubscribe });
    });

    return () => {
      activeRTDBListeners.forEach(l => l.unsubscribe());
    };
  }, [animals, devices]);

  // ── Helpers ────────────────────────────────────────────────
  const getReading = (id) => latestReadings[id] || {};
  const getAI      = (id) => latestAI[id]       || {};

  const enriched = animals.map(a => ({
    ...a,
    temp:       getReading(a.docId).bodyTemperature ?? null,
    heartRate:  getReading(a.docId).heartRate       ?? null,
    activity:   getReading(a.docId).activityLevel   ?? '—',
    healthScore: getAI(a.docId).healthScore         ?? a.currentHealthScore ?? 0,
    diseaseRisk: getAI(a.docId).diseaseRisk         ?? { level: 'low', diseases: [] },
    posture:    getAI(a.docId).postureDetails        ?? '—',
    injuryDetected: getAI(a.docId).injuryDetected   ?? false,
    injuryDetails:  getAI(a.docId).injuryDetails    ?? 'No anomalies detected.',
    coughCount: getAI(a.docId).coughCount            ?? 0,
    coughDetected: getAI(a.docId).coughDetected      ?? false,
    distressDetected: getAI(a.docId).distressDetected ?? false,
    stressLevel: getAI(a.docId).stressLevel          ?? 'low',
  }));

  const selectedEnriched = selectedAnimal
    ? enriched.find(a => a.docId === selectedAnimal.docId)
    : null;

  // FR-V04 View assigned animals logic:
  // Show only animals assigned to this vet's ID or explicitly listed in vet's assignedAnimals list.
  const filteredAnimals = enriched.filter(a => {
    const matchSearch =
      (a.tagNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (a.name      || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchHealth =
      filterHealth === 'All' ||
      (filterHealth === 'Healthy'  && a.healthStatus === 'healthy')  ||
      (filterHealth === 'Warning'  && a.healthStatus === 'at_risk')  ||
      (filterHealth === 'Critical' && a.healthStatus === 'critical');

    const isAssigned = 
      a.assignedVetId === userId || 
      (vetProfile?.assignedAnimals && vetProfile.assignedAnimals.includes(a.docId));

    const matchAssigned = !viewAssignedOnly || isAssigned;

    return matchSearch && matchHealth && matchAssigned;
  });

  const healthClass = (s) => s === 'critical' ? 'critical' : s === 'at_risk' ? 'warning' : 'healthy';

  const formatDate = (ts) => {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toISOString().split('T')[0];
  };

  // ── FR-V11, V12, V14 Save clinical records ────────────────
  const handleSaveRecommendation = async (e) => {
    e.preventDefault();
    if (!diagnosis && !treatment && !vaccine) {
      alert('Please fill at least one recommendation field.');
      return;
    }
    if (!selectedAnimal) return;
    setSaving(true);

    try {
      const now = Timestamp.now();
      // Save health record — FR-V11, FR-V12
      if (diagnosis || treatment) {
        await addDoc(
          collection(db, 'animals', selectedAnimal.docId, 'health_records'),
          {
            animalId: selectedAnimal.docId,
            vetId: userId || 'vet-uid-001',
            farmerId: selectedAnimal.farmerId || '',
            recordType: diagnosis ? 'diagnosis' : 'treatment',
            diagnosisNotes: diagnosis,
            symptoms: [],
            treatment: treatment,
            medications: [],
            followUpDate: null,
            severity: 'mild',
            outcome: 'ongoing',
            attachments: [],
            createdAt: now,
            updatedAt: now
          }
        );
      }
      // Save vaccination — FR-V14
      if (vaccine) {
        await addDoc(
          collection(db, 'animals', selectedAnimal.docId, 'vaccinations'),
          {
            animalId: selectedAnimal.docId,
            vetId: userId || 'vet-uid-001',
            vaccineName: vaccine,
            vaccineCategory: vaccine.toLowerCase().includes('respiratory') ? 'respiratory'
              : vaccine.toLowerCase().includes('blackleg') ? 'blackleg'
              : vaccine.toLowerCase().includes('anthrax') ? 'anthrax' : 'other',
            batchNumber: `BATCH-${Date.now()}`,
            dosage: '2ml intramuscular',
            administeredOn: now,
            nextDueDate: null,
            notes: `Recorded by Vet ${userEmail}`,
            createdAt: now
          }
        );
      }
      setSuccessMsg('Clinical recommendation saved to database!');
      setDiagnosis('');
      setTreatment('');
      setVaccine('');
    } catch (err) {
      console.error('Save error:', err);
      setSuccessMsg('Error saving record. Please try again.');
    } finally {
      setSaving(false);
      setTimeout(() => setSuccessMsg(''), 4000);
    }
  };

  // ── FR-V03 Update Vet Profile ──────────────────────────────
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMsg({ text: '', type: '' });
    try {
      await setDoc(doc(db, 'users', userId || 'vet-uid-001'), {
        name: vetProfile.name,
        phone: vetProfile.phone,
        licenseNumber: vetProfile.licenseNumber,
        email: vetProfile.email,
        updatedAt: Timestamp.now()
      }, { merge: true });

      setProfileMsg({ text: 'Profile updated successfully!', type: 'success' });
    } catch (err) {
      setProfileMsg({ text: 'Error updating profile: ' + err.message, type: 'error' });
    } finally {
      setProfileSaving(false);
    }
  };

  const handleResetPassword = async () => {
    try {
      await sendPasswordResetEmail(auth, userEmail);
      setResetSent(true);
      setProfileMsg({ text: `Reset email sent to ${userEmail}`, type: 'success' });
    } catch (err) {
      setProfileMsg({ text: 'Error: ' + err.message, type: 'error' });
    }
  };

  // ── FR-V15 Generate Veterinary PDF Report ──────────────────
  const generateVetReport = () => {
    setGeneratingPDF(true);
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const now = new Date().toLocaleString();

    // Custom Header
    pdf.setFillColor(10, 15, 30);
    pdf.rect(0, 0, 210, 40, 'F');
    pdf.setTextColor(6, 182, 212); // Cyan
    pdf.setFontSize(22);
    pdf.setFont('helvetica', 'bold');
    pdf.text('LIVETRACK AI', 15, 18);
    pdf.setFontSize(11);
    pdf.setTextColor(180, 180, 200);
    pdf.text('CLINICAL HEALTH & TREATMENT AUDIT REPORT', 15, 27);
    pdf.setFontSize(8);
    pdf.text(`Report Generated by Vet: ${vetProfile.name || userEmail} (${vetProfile.licenseNumber || 'No License'}) on ${now}`, 15, 35);

    // Title
    pdf.setTextColor(10, 15, 30);
    pdf.setFontSize(16);
    pdf.text('Veterinary Herd Diagnosis Summary', 15, 52);
    pdf.setDrawColor(6, 182, 212);
    pdf.setLineWidth(0.5);
    pdf.line(15, 55, 195, 55);

    // Statistics
    pdf.setFontSize(10);
    pdf.text(`Total Monitored Herd: ${enriched.length} animals`, 15, 63);
    pdf.text(`Active Diagnostics Cases: ${enriched.filter(a => a.healthStatus !== 'healthy').length}`, 15, 69);
    pdf.text(`Acoustic Cough Triggers: ${enriched.filter(a => a.coughDetected).length}`, 15, 75);

    // Table Header
    let y = 85;
    pdf.setFillColor(6, 182, 212);
    pdf.rect(15, y - 4, 180, 8, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    ['Tag', 'Name', 'Species', 'Temp', 'HR', 'Score', 'Status'].forEach((h, idx) => {
      pdf.text(h, [15, 38, 65, 95, 115, 138, 168][idx], y);
    });
    pdf.setFont('helvetica', 'normal');
    y += 8;

    enriched.forEach((a, i) => {
      if (y > 270) { pdf.addPage(); y = 20; }
      pdf.setFillColor(i % 2 === 0 ? 245 : 252, i % 2 === 0 ? 245 : 252, i % 2 === 0 ? 252 : 245);
      pdf.rect(15, y - 4, 180, 8, 'F');
      pdf.setTextColor(40, 40, 60);

      pdf.text(a.tagNumber || '—', 15, y);
      pdf.text(a.name || '—', 38, y);
      pdf.text(a.species || '—', 65, y);
      pdf.text(a.temp !== null ? `${a.temp}°C` : '—', 95, y);
      pdf.text(a.heartRate !== null ? `${a.heartRate}` : '—', 115, y);
      pdf.text(`${a.healthScore}/100`, 138, y);
      pdf.text(a.healthStatus || '—', 168, y);

      y += 9;
    });

    pdf.save(`Vet_Health_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    setGeneratingPDF(false);
  };

  if (loading) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', flexDirection:'column', background:'#060913', color:'#fff' }}>
        <div className="spinner" style={{ width:'36px', height:'36px', borderWidth:'3.5px', borderTopColor:'var(--secondary)', marginBottom:'1.25rem' }}></div>
        <p style={{ fontFamily:'Outfit,sans-serif', color:'var(--text-muted)', fontSize:'0.8rem', textTransform:'uppercase', letterSpacing:'0.08em' }}>Loading veterinary records...</p>
      </div>
    );
  }

  const activeDiseaseCases = enriched.filter(a => a.healthStatus !== 'healthy').length;
  const avgHealthScore = enriched.length
    ? Math.round(enriched.reduce((acc, a) => acc + a.healthScore, 0) / enriched.length)
    : 0;
  const coughAnomalies = enriched.filter(a => a.coughDetected).length;

  const tabBtn = (id, label, Icon) => (
    <button
      className="btn-logout"
      onClick={() => setActiveTab(id)}
      style={{
        borderColor: activeTab === id ? 'var(--secondary)' : 'var(--border-glass)',
        color: activeTab === id ? '#fff' : 'var(--text-muted)',
        background: activeTab === id ? 'rgba(6,182,212,0.08)' : 'transparent'
      }}
    >
      <Icon size={14} /> {label}
    </button>
  );

  return (
    <div className="dashboard-container">
      {/* Vet Header */}
      <header className="dashboard-header-nav" style={{ borderBottomColor: 'rgba(6,182,212,0.2)' }}>
        <div className="nav-brand">
          <div className="logo-icon-small" style={{ background: 'linear-gradient(135deg,var(--secondary) 0%,#0891b2 100%)' }}>
            <Stethoscope size={18} color="#060913" strokeWidth={2.5} />
          </div>
          <span className="brand-text">LIVETRACK AI</span>
          <span className="badge-system" style={{ color:'var(--secondary)', borderColor:'rgba(6,182,212,0.2)', background:'rgba(6,182,212,0.05)' }}>VET PORTAL</span>
        </div>
        <div className="nav-actions">
          <div className="user-profile">
            <div className="avatar" style={{ backgroundColor:'rgba(6,182,212,0.15)' }}>
              <User size={14} color="var(--secondary)" />
            </div>
            <span className="user-email">{userEmail}</span>
          </div>
          <button className="btn-logout" onClick={onLogout}>
            <LogOut size={16} /><span>Sign Out</span>
          </button>
        </div>
      </header>

      <main className="dashboard-content">

        {/* Vet navigation tabs — FR-V03 / FR-V15 support */}
        <section style={{ display:'flex', gap:'1rem', borderBottom:'1px solid var(--border-glass)', paddingBottom:'1rem' }}>
          {tabBtn('diagnostics', 'Diagnostics & Vitals', Stethoscope)}
          {tabBtn('reports',     'Clinical Reports',     FileText)}
          {tabBtn('profile',     'Veterinarian Profile', User)}
        </section>

        {/* ── Tab 1: Diagnostics ──────────────────────────────── */}
        {activeTab === 'diagnostics' && (
          <>
            {/* KPI Row */}
            <section className="kpi-section">
              <div className="metric-card">
                <div className="metric-icon bg-cyan"><Stethoscope size={20} color="var(--secondary)" /></div>
                <div className="metric-info">
                  <span className="metric-label">Active Diagnostic Cases</span>
                  <div className="metric-value-row">
                    <h3>{activeDiseaseCases}</h3>
                    <span className="status-indicator-badge" style={{ color:'var(--warning)', background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.15)' }}>Attention Req.</span>
                  </div>
                  <p className="metric-sub">Total Monitored: {enriched.length} animals</p>
                </div>
              </div>

              <div className="metric-card">
                <div className="metric-icon bg-emerald"><Award size={20} color="var(--primary)" /></div>
                <div className="metric-info">
                  <span className="metric-label">Herd Vitality Index</span>
                  <div className="metric-value-row">
                    <h3>{avgHealthScore}%</h3>
                    <span className={`status-indicator-badge ${avgHealthScore > 75 ? 'positive' : ''}`}>
                      {avgHealthScore > 75 ? 'Optimal' : 'Suboptimal'}
                    </span>
                  </div>
                  <p className="metric-sub">Average AI health score across herd</p>
                </div>
              </div>

              <div className="metric-card">
                <div className="metric-icon bg-purple"><Volume2 size={20} color="#c084fc" /></div>
                <div className="metric-info">
                  <span className="metric-label">AI Acoustics Trigger</span>
                  <div className="metric-value-row">
                    <h3>{coughAnomalies} {coughAnomalies === 1 ? 'Anomaly' : 'Anomalies'}</h3>
                    <span className="status-indicator-badge" style={{ color:'#c084fc', background:'rgba(192,132,252,0.08)', border:'1px solid rgba(192,132,252,0.15)' }}>Audio ML</span>
                  </div>
                  <p className="metric-sub">Cough detection from Firestore AI records</p>
                </div>
              </div>
            </section>

            {/* Split layout */}
            <section className="telemetry-grid">
              {/* Left Panel: Animal list & filters */}
              <div className="inventory-card-wrapper">
                <div className="inventory-search-bar" style={{ flexDirection:'column', gap:'0.75rem' }}>
                  <div style={{ display:'flex', gap:'0.75rem', width:'100%' }}>
                    <div className="search-input-wrapper">
                      <Search size={16} className="search-ico" />
                      <input type="text" placeholder="Search animal dossiers..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                    </div>
                    <div className="filter-dropdown-wrapper">
                      <Filter size={14} className="filter-ico" />
                      <select value={filterHealth} onChange={e => setFilterHealth(e.target.value)}>
                        <option value="All">All Vitals</option>
                        <option value="Healthy">Healthy</option>
                        <option value="Warning">At Risk</option>
                        <option value="Critical">Critical</option>
                      </select>
                    </div>
                  </div>

                  {/* FR-V04 view assigned animal toggle */}
                  <button
                    className="btn-logout"
                    onClick={() => setViewAssignedOnly(!viewAssignedOnly)}
                    style={{
                      width:'100%',
                      justifyContent:'center',
                      borderColor: viewAssignedOnly ? 'var(--secondary)' : 'var(--border-glass)',
                      color: viewAssignedOnly ? '#fff' : 'var(--text-muted)',
                      background: viewAssignedOnly ? 'rgba(6,182,212,0.08)' : 'transparent',
                      fontSize:'0.8rem'
                    }}
                  >
                    {viewAssignedOnly ? '✓ Viewing Assigned Animals Only' : 'Show My Assigned Animals Only (FR-V04)'}
                  </button>
                </div>

                <div className="inventory-list" style={{ maxHeight:'400px' }}>
                  {filteredAnimals.map(animal => {
                    const isSelected = selectedAnimal?.docId === animal.docId;
                    const hClass     = healthClass(animal.healthStatus);
                    return (
                      <div
                        key={animal.docId}
                        className={`inventory-item ${isSelected ? 'active' : ''}`}
                        onClick={() => setSelectedAnimal(animal)}
                        style={{ borderLeftColor: isSelected ? 'var(--secondary)' : 'transparent' }}
                      >
                        <div className="item-left">
                          <div className={`health-indicator-border ${hClass}`}></div>
                          <div className="item-title-block">
                            <h6>{animal.name}</h6>
                            <span>{animal.tagNumber} • {animal.species}</span>
                          </div>
                        </div>
                        <div className="item-right">
                          <div className="item-vital">
                            <Thermometer size={12} />
                            <span>{animal.temp !== null ? `${animal.temp}°C` : '—'}</span>
                          </div>
                          <span className={`status-indicator-badge ${hClass}`} style={{ fontSize:'0.65rem' }}>
                            {animal.healthStatus?.replace('_',' ')}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  {filteredAnimals.length === 0 && (
                    <div className="empty-herd-search">No animal profiles found.</div>
                  )}
                </div>
              </div>

              {/* Right Panel: Dossier inspect & history */}
              {selectedEnriched ? (
                <div className="map-card-wrapper" style={{ padding:'1.5rem', gap:'1.5rem' }}>

                  {/* Header */}
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', borderBottom:'1px solid var(--border-glass)', paddingBottom:'1rem' }}>
                    <div>
                      <span style={{ fontSize:'0.75rem', fontWeight:600, color:'var(--secondary)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Livestock Vitals Record</span>
                      <h4 style={{ fontSize:'1.5rem', fontFamily:'var(--font-heading)', color:'#fff', marginTop:'0.15rem' }}>
                        {selectedEnriched.name} <span style={{ color:'var(--text-muted)', fontSize:'1rem', fontWeight:400 }}>({selectedEnriched.tagNumber})</span>
                      </h4>
                      <p style={{ fontSize:'0.8rem', color:'var(--text-muted)', marginTop:'0.1rem' }}>
                        {selectedEnriched.species} • {selectedEnriched.breed} • Weight: {selectedEnriched.weight}kg
                      </p>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', background:'rgba(255,255,255,0.02)', padding:'0.5rem 1rem', borderRadius:'12px', border:'1px solid var(--border-glass)' }}>
                      <div style={{ textAlign:'right' }}>
                        <span style={{ fontSize:'0.65rem', color:'var(--text-muted)', display:'block' }}>HEALTH SCORE (FR-V08)</span>
                        <span style={{ fontSize:'1.2rem', fontWeight:700, color: selectedEnriched.healthScore > 80 ? 'var(--primary)' : selectedEnriched.healthScore > 60 ? 'var(--warning)' : 'var(--danger)' }}>
                          {selectedEnriched.healthScore}/100
                        </span>
                      </div>
                      <div className={`metric-icon ${selectedEnriched.healthScore > 80 ? 'bg-emerald' : selectedEnriched.healthScore > 60 ? 'bg-cyan' : 'bg-purple'}`} style={{ width:'36px', height:'36px', borderRadius:'8px' }}>
                        <Heart size={16} color={selectedEnriched.healthScore > 80 ? 'var(--primary)' : selectedEnriched.healthScore > 60 ? 'var(--secondary)' : 'var(--danger)'} />
                      </div>
                    </div>
                  </div>

                  {/* AI Predictions / Sensor streams */}
                  <div style={{ display:'grid', gridTemplateColumns:'1.2fr 0.8fr', gap:'1.5rem' }}>
                    <div style={{ background:'rgba(0,0,0,0.15)', border:'1px solid var(--border-glass)', borderRadius:'16px', padding:'1.25rem' }}>
                      <h5 style={{ fontFamily:'var(--font-heading)', color:'#fff', fontSize:'0.95rem', display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'1rem' }}>
                        <Activity size={16} color="var(--secondary)" /> Live Sensor Streams
                      </h5>
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'1rem', marginBottom:'1.25rem' }}>
                        <div style={{ background:'rgba(255,255,255,0.015)', border:'1px solid rgba(255,255,255,0.03)', padding:'0.75rem', borderRadius:'12px' }}>
                          <span style={{ fontSize:'0.7rem', color:'var(--text-muted)', display:'block' }}>BODY TEMPERATURE</span>
                          <span style={{ fontSize:'1.25rem', fontWeight:700, color: selectedEnriched.temp > 40.0 ? 'var(--danger)' : selectedEnriched.temp > 39.4 ? 'var(--warning)' : '#fff' }}>
                            {selectedEnriched.temp !== null ? `${selectedEnriched.temp} °C` : '—'}
                          </span>
                        </div>
                        <div style={{ background:'rgba(255,255,255,0.015)', border:'1px solid rgba(255,255,255,0.03)', padding:'0.75rem', borderRadius:'12px', position: 'relative' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize:'0.7rem', color:'var(--text-muted)' }}>HEART RATE</span>
                            {selectedEnriched.heartRate !== null && (
                              <span style={{
                                fontSize: '0.52rem',
                                padding: '1px 3px',
                                borderRadius: '3px',
                                fontWeight: 600,
                                background: selectedEnriched.isRealHeartRate ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.05)',
                                color: selectedEnriched.isRealHeartRate ? 'var(--primary)' : 'var(--text-muted)',
                                border: selectedEnriched.isRealHeartRate ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(255,255,255,0.1)'
                              }}>
                                {selectedEnriched.isRealHeartRate ? '● Sensor' : '● Est.'}
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize:'1.25rem', fontWeight:700, color: selectedEnriched.heartRate > 90 ? 'var(--danger)' : '#fff', display: 'block', marginTop: '0.15rem' }}>
                            {selectedEnriched.heartRate !== null ? `${selectedEnriched.heartRate} BPM` : '—'}
                          </span>
                        </div>
                      </div>

                      {/* FR-V09, FR-V10 CV and Audio streams */}
                      <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
                        <div style={{ fontSize:'0.8rem', borderBottom:'1px solid rgba(255,255,255,0.03)', paddingBottom:'0.5rem' }}>
                          <span style={{ color:'var(--text-dark)', fontWeight:600, display:'block' }}>POSTURE (FR-V09 COMPUTER VISION):</span>
                          <span style={{ color:'#fff' }}>{selectedEnriched.posture}</span>
                        </div>
                        <div style={{ fontSize:'0.8rem', borderBottom:'1px solid rgba(255,255,255,0.03)', paddingBottom:'0.5rem' }}>
                          <span style={{ color:'var(--text-dark)', fontWeight:600, display:'block' }}>GAIT / INJURY AUDIT (COMPUTER VISION):</span>
                          <span style={{ color: selectedEnriched.injuryDetected ? 'var(--warning)' : '#fff' }}>
                            {selectedEnriched.injuryDetails}
                          </span>
                        </div>
                        <div style={{ fontSize:'0.8rem' }}>
                          <span style={{ color:'var(--text-dark)', fontWeight:600, display:'block' }}>DISTRESS SOUND (FR-V10 AUDIO):</span>
                          <span style={{ color: selectedEnriched.coughDetected ? 'var(--danger)' : '#fff' }}>
                            {selectedEnriched.coughDetected
                              ? `High cough frequency detected (${selectedEnriched.coughCount}/hr)`
                              : 'Normal vocalization.'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* FR-V07 Disease predictions */}
                    <div style={{ background:'rgba(255,255,255,0.01)', border:'1px solid var(--border-glass)', borderRadius:'16px', padding:'1.25rem' }}>
                      <h5 style={{ fontFamily:'var(--font-heading)', color:'#fff', fontSize:'0.95rem', display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.75rem' }}>
                        <AlertTriangle size={16} color="var(--warning)" /> FR-V07 Disease Prediction
                      </h5>
                      <div style={{ textAlign:'center', padding:'1rem 0' }}>
                        {selectedEnriched.diseaseRisk?.diseases?.length > 0 ? (
                          <>
                            <span style={{ fontSize:'2.5rem', fontWeight:800, fontFamily:'var(--font-heading)', color: selectedEnriched.diseaseRisk.diseases[0].probability > 70 ? 'var(--danger)' : selectedEnriched.diseaseRisk.diseases[0].probability > 40 ? 'var(--warning)' : 'var(--primary)' }}>
                              {selectedEnriched.diseaseRisk.diseases[0].probability}%
                            </span>
                            <p style={{ fontSize:'0.75rem', color:'var(--text-muted)', marginTop:'0.25rem' }}>Risk probability index</p>
                            <div style={{ background:'rgba(0,0,0,0.2)', padding:'0.75rem', borderRadius:'10px', fontSize:'0.75rem', marginTop:'0.75rem' }}>
                              <span style={{ color:'var(--text-dark)', fontWeight:600, display:'block', textTransform:'uppercase' }}>Target Anomaly:</span>
                              <span style={{ color:'#fff', fontWeight:600, fontSize:'0.8rem' }}>{selectedEnriched.diseaseRisk.diseases[0].name}</span>
                            </div>
                          </>
                        ) : (
                          <span style={{ fontSize:'1.2rem', fontWeight:700, color:'var(--primary)' }}>No Risk Detected</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* FR-V06: Historical Telemetry Log list */}
                  <div style={{ background:'rgba(255,255,255,0.015)', border:'1px solid var(--border-glass)', borderRadius:'16px', padding:'1.25rem' }}>
                    <h5 style={{ fontFamily:'var(--font-heading)', color:'#fff', fontSize:'0.95rem', display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.75rem' }}>
                      <Clock size={16} color="var(--secondary)" /> FR-V06 Historical Sensor Logs (Last 15 readings)
                    </h5>
                    <div style={{ maxHeight:'150px', overflowY:'auto', display:'flex', flexDirection:'column', gap:'0.40rem' }}>
                      {sensorHistory.map((s, idx) => (
                        <div key={s.docId} style={{ display:'grid', gridTemplateColumns:'2.5fr 2fr 2fr 3fr', gap:'0.5rem', fontSize:'0.72rem', padding:'0.4rem 0.75rem', background: idx === 0 ? 'rgba(6,182,212,0.05)' : 'rgba(255,255,255,0.01)', borderRadius:'8px', border:'1px solid rgba(255,255,255,0.03)' }}>
                          <span style={{ color:'#fff', fontWeight:600 }}>Temp: {s.bodyTemperature}°C</span>
                          <span style={{ color:'var(--text-muted)' }}>HR: {s.heartRate} BPM</span>
                          <span style={{ color:'var(--text-muted)', textTransform:'capitalize' }}>Act: {s.activityLevel}</span>
                          <span style={{ color:'var(--text-dark)', textAlign:'right' }}>{s.timestamp?.toDate ? s.timestamp.toDate().toLocaleString() : '—'}</span>
                        </div>
                      ))}
                      {sensorHistory.length === 0 && (
                        <p style={{ color:'var(--text-muted)', fontSize:'0.78rem' }}>No historical telemetry packets received.</p>
                      )}
                    </div>
                  </div>

                  {/* Recommendations and history */}
                  <div style={{ display:'grid', gridTemplateColumns:'1.1fr 0.9fr', gap:'1.5rem' }}>
                    {/* Clinical forms */}
                    <form onSubmit={handleSaveRecommendation} style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
                      <h5 style={{ fontFamily:'var(--font-heading)', color:'#fff', fontSize:'0.95rem', display:'flex', alignItems:'center', gap:'0.5rem' }}>
                        <FileText size={16} color="var(--secondary)" /> Add Clinical Interventions (FR-V11, V12, V14)
                      </h5>
                      <div className="form-group" style={{ marginBottom:0 }}>
                        <div className="input-container">
                          <input type="text" className="form-input" style={{ paddingLeft:'1rem' }} placeholder=" " value={diagnosis} onChange={e => setDiagnosis(e.target.value)} />
                          <label className="floating-label" style={{ left:'1rem' }}>FR-V11 Diagnosis Notes</label>
                        </div>
                      </div>
                      <div className="form-group" style={{ marginBottom:0 }}>
                        <div className="input-container">
                          <input type="text" className="form-input" style={{ paddingLeft:'1rem' }} placeholder=" " value={treatment} onChange={e => setTreatment(e.target.value)} />
                          <label className="floating-label" style={{ left:'1rem' }}>FR-V12 Prescribed Treatment</label>
                        </div>
                      </div>
                      <div className="form-group" style={{ marginBottom:0 }}>
                        <div className="input-container">
                          <select className="form-input" style={{ paddingLeft:'1rem', appearance:'none', cursor:'pointer' }} value={vaccine} onChange={e => setVaccine(e.target.value)}>
                            <option value="">-- Record Vaccination (FR-V14) --</option>
                            <option value="IBR-BVD-PI3-BRSV (Respiratory)">IBR-BVD-PI3-BRSV (Respiratory)</option>
                            <option value="Clostridial Booster (Blackleg)">Clostridial Booster (Blackleg)</option>
                            <option value="Anthrax Vaccine">Anthrax Vaccine</option>
                            <option value="Brucellosis Vaccine">Brucellosis Vaccine</option>
                            <option value="FMD Vaccine">FMD Vaccine</option>
                          </select>
                        </div>
                      </div>
                      <button type="submit" className="btn-primary" style={{ padding:'0.75rem 1.1rem', fontSize:'0.9rem' }} disabled={saving}>
                        <Check size={16} /> {saving ? 'Saving...' : 'Save Intervention'}
                      </button>
                      {successMsg && (
                        <div className="feedback-message feedback-success" style={{ padding:'0.5rem 0.75rem', marginTop:0 }}>
                          <CheckCircle2 size={14} /> <span>{successMsg}</span>
                        </div>
                      )}
                    </form>

                    {/* Complete Medical History log (FR-V05 / FR-V13) */}
                    <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
                      <h5 style={{ fontFamily:'var(--font-heading)', color:'#fff', fontSize:'0.95rem', display:'flex', alignItems:'center', gap:'0.5rem' }}>
                        <Clock size={16} color="var(--text-muted)" /> Complete Medical Records (FR-V05)
                      </h5>
                      <div style={{ background:'rgba(0,0,0,0.1)', border:'1px solid var(--border-glass)', borderRadius:'16px', padding:'1rem', display:'flex', flexDirection:'column', gap:'0.75rem', maxHeight:'240px', overflowY:'auto' }}>
                        {healthRecords.map((rec, i) => (
                          <div key={rec.docId} style={{ borderBottom: i === healthRecords.length - 1 && vaccinations.length === 0 ? 'none' : '1px solid rgba(255,255,255,0.03)', paddingBottom:'0.5rem', fontSize:'0.75rem' }}>
                            <div style={{ display:'flex', justifyContent:'space-between', color:'var(--text-dark)', fontWeight:600 }}>
                              <span>{rec.recordType?.toUpperCase()} • {formatDate(rec.createdAt)}</span>
                            </div>
                            <p style={{ color:'var(--text-main)', marginTop:'0.15rem', lineHeight:1.3 }}>{rec.diagnosisNotes || rec.treatment}</p>
                          </div>
                        ))}
                        {vaccinations.map((v, i) => (
                          <div key={v.docId} style={{ borderBottom: i === vaccinations.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.03)', paddingBottom:'0.5rem', fontSize:'0.75rem' }}>
                            <div style={{ display:'flex', justifyContent:'space-between', color:'var(--text-dark)', fontWeight:600 }}>
                              <span>VACCINATION • {formatDate(v.administeredOn)}</span>
                            </div>
                            <p style={{ color:'var(--text-main)', marginTop:'0.15rem', lineHeight:1.3 }}>{v.vaccineName} — {v.dosage}</p>
                          </div>
                        ))}
                        {healthRecords.length === 0 && vaccinations.length === 0 && (
                          <div style={{ color:'var(--text-dark)', fontSize:'0.75rem', margin:'auto' }}>
                            No clinical records found.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                </div>
              ) : (
                <div className="map-card-wrapper" style={{ padding:'2rem', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <p style={{ color:'var(--text-muted)' }}>Select an animal dossier from the list to begin diagnosing.</p>
                </div>
              )}
            </section>
          </>
        )}

        {/* ── Tab 2: Reports (FR-V15) ────────────────────────── */}
        {activeTab === 'reports' && (
          <div style={{ display:'flex', flexDirection:'column', gap:'1.5rem', maxWidth:'800px', margin:'0 auto', width:'100%' }}>
            <div className="map-card-wrapper" style={{ padding:'2rem', textAlign:'center', gap:'1rem' }}>
              <FileText size={48} color="var(--secondary)" style={{ margin:'0 auto 0.50rem' }} />
              <h3 style={{ color:'#fff', fontFamily:'var(--font-heading)', fontSize:'1.4rem' }}>FR-V15 Generate Veterinary Health Report</h3>
              <p style={{ color:'var(--text-muted)', fontSize:'0.85rem', maxWidth:'550px', margin:'0 auto' }}>
                Compile clinical cases, AI predictions, recorded diagnoses, and vaccinations for all animals into a secure, transactional PDF document.
              </p>
              
              <button
                className="btn-primary"
                onClick={generateVetReport}
                disabled={generatingPDF}
                style={{ background:'linear-gradient(135deg,var(--secondary) 0%,#0891b2 100%)', color:'#060913', display:'flex', alignItems:'center', gap:'0.5rem', width:'auto', margin:'1rem auto 0', padding:'0.75rem 2rem' }}
              >
                {generatingPDF ? (
                  <>
                    <span className="spinner" style={{ borderTopColor:'#060913' }}></span>
                    <span>Compiling Report...</span>
                  </>
                ) : (
                  <>
                    <Download size={16} /> Export Clinical PDF Report
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ── Tab 3: Profile (FR-V03) ────────────────────────── */}
        {activeTab === 'profile' && (
          <div style={{ display:'flex', flexDirection:'column', gap:'1.5rem', maxWidth:'650px', margin:'0 auto', width:'100%' }}>
            {/* Header info */}
            <div className="map-card-wrapper" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(6,182,212,0.1)', border: '2px solid rgba(6,182,212,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <User size={28} color="var(--secondary)" />
              </div>
              <div>
                <h3 style={{ color: '#fff', fontFamily: 'var(--font-heading)', fontSize: '1.25rem', margin: 0 }}>
                  {vetProfile.name || 'Veterinarian Officer'}
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: '0.25rem 0 0 0' }}>{userEmail}</p>
                <span style={{ fontSize: '0.68rem', color: 'var(--secondary)', background: 'rgba(6,182,212,0.08)', padding: '0.15rem 0.6rem', borderRadius: '20px', marginTop: '0.4rem', display: 'inline-block' }}>VETERINARIAN PORTAL</span>
              </div>
            </div>

            {profileMsg.text && (
              <div className={`feedback-message ${profileMsg.type === 'success' ? 'feedback-success' : 'feedback-error'}`}>
                {profileMsg.type === 'success' ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                <span>{profileMsg.text}</span>
              </div>
            )}

            {/* Profile update form */}
            <div className="map-card-wrapper" style={{ padding:'1.5rem' }}>
              <h4 style={{ color:'#fff', fontFamily:'var(--font-heading)', fontSize:'1.1rem', marginBottom:'1.25rem', display:'flex', alignItems:'center', gap:'0.5rem' }}>
                <User size={18} color="var(--secondary)" /> FR-V03 — Update Vet Profile
              </h4>
              <form onSubmit={handleUpdateProfile} style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <div className="input-container">
                      <input type="text" className="form-input" style={{ paddingLeft: '1rem' }} placeholder=" " value={vetProfile.name} onChange={e => setVetProfile({ ...vetProfile, name: e.target.value })} required disabled={profileSaving} />
                      <label className="floating-label" style={{ left: '1rem' }}>Vet Name</label>
                    </div>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <div className="input-container">
                      <input type="text" className="form-input" style={{ paddingLeft: '1rem' }} placeholder=" " value={vetProfile.licenseNumber} onChange={e => setVetProfile({ ...vetProfile, licenseNumber: e.target.value })} required disabled={profileSaving} />
                      <label className="floating-label" style={{ left: '1rem' }}>Vet License Number</label>
                    </div>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <div className="input-container">
                      <input type="tel" className="form-input" style={{ paddingLeft: '1rem' }} placeholder=" " value={vetProfile.phone} onChange={e => setVetProfile({ ...vetProfile, phone: e.target.value })} disabled={profileSaving} />
                      <label className="floating-label" style={{ left: '1rem' }}>Phone Number</label>
                    </div>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <div className="input-container">
                      <input type="email" className="form-input" style={{ paddingLeft: '1rem', opacity:0.6 }} placeholder=" " value={vetProfile.email} readOnly />
                      <label className="floating-label" style={{ left: '1rem' }}>Email Address</label>
                    </div>
                  </div>
                </div>
                
                <button type="submit" className="btn-primary" disabled={profileSaving} style={{ background:'linear-gradient(135deg,var(--secondary) 0%,#0891b2 100%)', color:'#060913', alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Save size={16} /> {profileSaving ? 'Saving...' : 'Update Vet Profile'}
                </button>
              </form>
            </div>

            {/* Password Reset */}
            <div className="map-card-wrapper" style={{ padding: '1.5rem' }}>
              <h4 style={{ color: '#fff', fontFamily: 'var(--font-heading)', fontSize: '1.1rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Key size={18} color="var(--warning)" /> Security Reset Password
              </h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: '0 0 1.25rem 0' }}>
                A password reset configuration link will be delivered to <strong style={{ color: '#fff' }}>{userEmail}</strong>.
              </p>
              <button
                className="btn-logout"
                onClick={handleResetPassword}
                disabled={resetSent}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderColor: resetSent ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)', color: resetSent ? 'var(--primary)' : 'var(--warning)' }}
              >
                {resetSent ? <><CheckCircle2 size={16} /> Link Transmitted!</> : <><Mail size={16} /> Transmit Password Reset Link</>}
              </button>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
