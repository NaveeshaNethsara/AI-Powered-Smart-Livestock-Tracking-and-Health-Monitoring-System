import React, { useState, useEffect } from 'react';
import {
  User, LogOut, Users, Cpu, Sliders, Terminal,
  Plus, Trash2, UserPlus, Settings, Wifi, Battery,
  Save, Check, RefreshCw, Edit3, X, Search, Filter,
  AlertTriangle, Heart, BarChart2, Gauge, Database,
  PawPrint, Bell, MapPin, Syringe, FileText, CheckCircle2, ChevronRight, Activity, ShieldAlert
} from 'lucide-react';
import {
  collection, query, onSnapshot, orderBy, doc,
  setDoc, deleteDoc, addDoc, Timestamp, getDoc, getDocs, where, updateDoc
} from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut as authSignOut, sendPasswordResetEmail } from 'firebase/auth';
import { db, firebaseConfig } from '../firebase';

const EMPTY_ANIMAL_FORM = {
  name: '', tagNumber: '', species: 'Cattle', breed: '',
  gender: 'female', weight: '', color: '', deviceId: '', farmerId: ''
};

export default function AdminDashboard({ onLogout, userEmail }) {
  const [activeTab, setActiveTab] = useState('analytics');

  // Firestore data states
  const [users, setUsers]       = useState([]);
  const [devices, setDevices]   = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [animals, setAnimals]   = useState([]);
  const [alerts, setAlerts]     = useState([]);
  const [config, setConfig]     = useState(null);
  const [loading, setLoading]   = useState(true);

  // Form states - Users
  const [newUserName, setNewUserName]   = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole]   = useState('farmer');
  const [editingUser, setEditingUser]   = useState(null); // holds user object currently being edited
  const [tempPasswordInfo, setTempPasswordInfo] = useState(null);
  const [isProvisioning, setIsProvisioning]     = useState(false);
  const [provisionError, setProvisionError]     = useState('');

  // Form states - Animals
  const [animalForm, setAnimalForm]     = useState(EMPTY_ANIMAL_FORM);
  const [editingAnimal, setEditingAnimal] = useState(null); // holds animal being edited
  const [savingAnimal, setSavingAnimal] = useState(false);
  const [animalSearch, setAnimalSearch] = useState('');

  // Form states - Devices
  const [newDeviceId, setNewDeviceId]   = useState('');
  const [newDeviceMac, setNewDeviceMac] = useState('');
  const [editingDevice, setEditingDevice] = useState(null); // holds device being edited for assignment/firmware updates

  // Config sliders from Firestore
  const [tempHigh, setTempHigh]         = useState(39.8);
  const [tempLow, setTempLow]           = useState(37.8);
  const [hrHigh, setHrHigh]             = useState(95);
  const [hrLow, setHrLow]               = useState(55);
  const [aiConfidence, setAiConfidence] = useState(75);
  // Geofence defaults
  const [geofenceRadius, setGeofenceRadius]       = useState(200);
  const [geofenceCenterLat, setGeofenceCenterLat] = useState(6.9271);
  const [geofenceCenterLng, setGeofenceCenterLng] = useState(79.8612);
  // System general settings
  const [enableAutoClean, setEnableAutoClean]   = useState(false);
  const [maintenanceMode, setMaintenanceMode]   = useState(false);
  const [darkModeOverride, setDarkModeOverride] = useState(true);

  const [saveSuccess, setSaveSuccess]   = useState(false);
  const [deviceStats, setDeviceStats]   = useState({ online: 0, offline: 0 });

  // ── 1. Live users listener — only show active (non-deleted) users
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      const activeUsers = snap.docs
        .map(d => ({ docId: d.id, ...d.data() }))
        .filter(u => u.isActive !== false);
      setUsers(activeUsers);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // ── 2. Live devices listener ───────────────────────────────
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'devices'), (snap) => {
      const list = snap.docs.map(d => ({ docId: d.id, ...d.data() }));
      setDevices(list);
      setDeviceStats({
        online:  list.filter(d => d.status === 'online').length,
        offline: list.filter(d => d.status === 'offline').length,
      });
    });
    return () => unsub();
  }, []);

  // ── 3. Live audit logs listener ────────────────────────────
  useEffect(() => {
    const q = query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setAuditLogs(snap.docs.map(d => ({ docId: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  // ── 4. Live animals listener ───────────────────────────────
  useEffect(() => {
    const q = query(collection(db, 'animals'), where('isActive', '==', true));
    const unsub = onSnapshot(q, (snap) => {
      setAnimals(snap.docs.map(d => ({ docId: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  // ── 5. Live alerts listener ────────────────────────────────
  useEffect(() => {
    const q = query(collection(db, 'alerts'), orderBy('triggeredAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setAlerts(snap.docs.map(d => ({ docId: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  // ── 6. Load system config (one-time + live) ───────────────
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'system_config', 'global'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setConfig(data);
        setTempHigh(data.temperatureThresholds?.highAlert    ?? 39.8);
        setTempLow(data.temperatureThresholds?.lowAlert     ?? 37.8);
        setHrHigh(data.heartRateThresholds?.highAlert        ?? 95);
        setHrLow(data.heartRateThresholds?.lowAlert          ?? 55);
        setAiConfidence(data.aiModelParams?.minConfidence    ?? 75);
        setGeofenceRadius(data.geofenceBounds?.radius        ?? 200);
        setGeofenceCenterLat(data.geofenceBounds?.centerLat  ?? 6.9271);
        setGeofenceCenterLng(data.geofenceBounds?.centerLng  ?? 79.8612);
        setEnableAutoClean(data.systemSettings?.enableAutoClean ?? false);
        setMaintenanceMode(data.systemSettings?.maintenanceMode ?? false);
        setDarkModeOverride(data.systemSettings?.darkModeOverride ?? true);
      }
    });
    return () => unsub();
  }, []);

  // ── Helper: write audit log entry ─────────────────────────
  const writeAudit = async (action, targetId, targetType, details) => {
    await addDoc(collection(db, 'audit_logs'), {
      actorId: 'admin-uid-001',
      actorRole: 'admin',
      actorEmail: userEmail || 'admin@livetrack.ai',
      action,
      targetId,
      targetType,
      details,
      ipAddress: '—',
      timestamp: Timestamp.now()
    });
  };

  // ── User Actions ───────────────────────────────────────────
  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!newUserName || !newUserEmail) return;
    setIsProvisioning(true);
    setProvisionError('');
    setTempPasswordInfo(null);

    // Generate random 8-character temporary password with mixed types
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%';
    let tempPassword = 'LTrack@';
    for (let i = 0; i < 4; i++) {
      tempPassword += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    let secondaryApp = null;
    try {
      // 1. Create account in Firebase Auth using secondary app to avoid logging out the current admin
      const secondaryAppName = `SecondaryApp-${Date.now()}`;
      secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
      const secondaryAuth = getAuth(secondaryApp);
      
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, newUserEmail, tempPassword);
      const uid = userCredential.user.uid;

      // 2. Sign out of secondary auth context
      await authSignOut(secondaryAuth);

      // 3. Write user details to Firestore
      const data = {
        uid: uid,
        name: newUserName,
        email: newUserEmail,
        role: newUserRole,
        phone: '',
        profileImageUrl: '',
        farmName: '',
        licenseNumber: '',
        assignedAnimals: [],
        isActive: true,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        lastLoginAt: null
      };

      await setDoc(doc(db, 'users', uid), data);
      await writeAudit('user.created', uid, 'user', `New ${newUserRole} account registered: ${newUserEmail}`);
      
      // Update state to show temporary password card to admin
      setTempPasswordInfo({
        name: newUserName,
        email: newUserEmail,
        password: tempPassword,
        role: newUserRole
      });

      // Clear input fields
      setNewUserName('');
      setNewUserEmail('');
      setNewUserRole('farmer');
    } catch (err) {
      console.error('User registration failed: ', err);

      if (err.code === 'auth/email-already-in-use') {
        // The Auth account already exists — check if it's a deactivated Firestore account
        try {
          const q = query(collection(db, 'users'), where('email', '==', newUserEmail));
          const snap = await getDocs(q);

          if (!snap.empty) {
            // Found a deactivated Firestore document — reactivate it
            const existingDoc = snap.docs[0];
            const existingUid = existingDoc.id;

            await updateDoc(doc(db, 'users', existingUid), {
              name:      newUserName,
              role:      newUserRole,
              isActive:  true,
              deletedAt: null,
              updatedAt: Timestamp.now()
            });

            await writeAudit('user.reactivated', existingUid, 'user',
              `Deactivated account reactivated: ${newUserEmail} as ${newUserRole}`);

            setTempPasswordInfo({
              name:     newUserName,
              email:    newUserEmail,
              password: tempPassword,
              role:     newUserRole,
              reactivated: true
            });
            setNewUserName('');
            setNewUserEmail('');
            setNewUserRole('farmer');
          } else {
            // Orphaned Auth account: exists in Firebase Auth but no Firestore doc.
            try {
              await addDoc(collection(db, 'pendingUsers'), {
                name:      newUserName,
                email:     newUserEmail,
                role:      newUserRole,
                isActive:  true,
                createdAt: Timestamp.now()
              });

              await sendPasswordResetEmail(getAuth(), newUserEmail);

              await writeAudit('user.pending-reactivated', 'orphan', 'user',
                `Orphaned auth reactivated via pending flow: ${newUserEmail} as ${newUserRole}`);

              setTempPasswordInfo({
                name:          newUserName,
                email:         newUserEmail,
                role:          newUserRole,
                orphanFixed:   true
              });
              setNewUserName('');
              setNewUserEmail('');
              setNewUserRole('farmer');
            } catch (fixErr) {
              setProvisionError(
                `Could not set up pending account: ${fixErr.message}. ` +
                `As a last resort, delete "${newUserEmail}" from Firebase Console → Authentication manually.`
              );
            }
          }
        } catch (lookupErr) {
          setProvisionError('Email already in use. Could not reactivate: ' + lookupErr.message);
        }
      } else if (err.code === 'auth/invalid-email') {
        setProvisionError('Please enter a valid email address.');
      } else if (err.code === 'auth/weak-password') {
        setProvisionError('The temporary password generated was too weak.');
      } else {
        setProvisionError(err.message);
      }
    } finally {
      setIsProvisioning(false);
      // Clean up secondary app resources
      if (secondaryApp) {
        try {
          await deleteApp(secondaryApp);
        } catch (e) {
          console.error('Error deleting secondary app: ', e);
        }
      }
    }
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      const userRef = doc(db, 'users', editingUser.docId);
      await updateDoc(userRef, {
        name: editingUser.name,
        role: editingUser.role,
        email: editingUser.email,
        phone: editingUser.phone || '',
        farmName: editingUser.farmName || '',
        licenseNumber: editingUser.licenseNumber || '',
        updatedAt: Timestamp.now()
      });
      await writeAudit('user.updated', editingUser.docId, 'user', `Updated user details for: ${editingUser.email} (Role: ${editingUser.role})`);
      setEditingUser(null);
    } catch (err) {
      alert('Error updating user: ' + err.message);
    }
  };

  const handleDeleteUser = async (docId, email) => {
    if (email === userEmail) {
      alert('You cannot delete your own active administrator account!');
      return;
    }
    if (!window.confirm(`Are you sure you want to deactivate account: ${email}?`)) return;
    // Soft-delete
    await updateDoc(doc(db, 'users', docId), {
      isActive:  false,
      deletedAt: Timestamp.now()
    });
    await writeAudit('user.deactivated', docId, 'user', `Account deactivated: ${email}`);
  };

  // ── Animal Actions ─────────────────────────────────────────
  const handleAnimalFormSubmit = async (e) => {
    e.preventDefault();
    if (!animalForm.name || !animalForm.tagNumber) return;
    setSavingAnimal(true);
    try {
      const data = {
        name: animalForm.name,
        tagNumber: animalForm.tagNumber,
        species: animalForm.species,
        breed: animalForm.breed,
        gender: animalForm.gender,
        weight: parseFloat(animalForm.weight) || 0,
        color: animalForm.color,
        deviceId: animalForm.deviceId,
        farmerId: animalForm.farmerId,
        isActive: true,
        updatedAt: Timestamp.now()
      };

      if (editingAnimal) {
        // Update animal
        const animalRef = doc(db, 'animals', editingAnimal.docId);
        await updateDoc(animalRef, data);
        
        // Update device back-link if deviceId is assigned
        if (animalForm.deviceId) {
          await updateDoc(doc(db, 'devices', animalForm.deviceId), {
            assignedAnimalId: editingAnimal.docId,
            assignedFarmerId: animalForm.farmerId
          });
        }
        await writeAudit('animal.updated', editingAnimal.docId, 'animal', `Updated animal: ${animalForm.name} [Tag: ${animalForm.tagNumber}]`);
        setEditingAnimal(null);
      } else {
        // Register new animal
        const docRef = await addDoc(collection(db, 'animals'), {
          ...data,
          healthStatus: 'healthy',
          currentHealthScore: 85,
          imageUrl: '',
          assignedVetId: 'vet-uid-001',
          registeredAt: Timestamp.now()
        });

        // Update device back-link if deviceId is assigned
        if (animalForm.deviceId) {
          await updateDoc(doc(db, 'devices', animalForm.deviceId), {
            assignedAnimalId: docRef.id,
            assignedFarmerId: animalForm.farmerId
          });
        }
        await writeAudit('animal.registered', docRef.id, 'animal', `Registered new animal: ${animalForm.name} [Tag: ${animalForm.tagNumber}]`);
      }
      setAnimalForm(EMPTY_ANIMAL_FORM);
    } catch (err) {
      alert('Error saving animal: ' + err.message);
    } finally {
      setSavingAnimal(false);
    }
  };

  const handleEditAnimalClick = (a) => {
    setEditingAnimal(a);
    setAnimalForm({
      name: a.name || '',
      tagNumber: a.tagNumber || '',
      species: a.species || 'Cattle',
      breed: a.breed || '',
      gender: a.gender || 'female',
      weight: a.weight || '',
      color: a.color || '',
      deviceId: a.deviceId || '',
      farmerId: a.farmerId || ''
    });
  };

  const handleDeleteAnimal = async (docId, name) => {
    if (!window.confirm(`Are you sure you want to remove animal record: ${name}?`)) return;
    try {
      // Soft delete animal record
      await updateDoc(doc(db, 'animals', docId), {
        isActive: false,
        updatedAt: Timestamp.now()
      });
      await writeAudit('animal.deleted', docId, 'animal', `Removed animal record: ${name}`);
    } catch (err) {
      alert('Error removing animal record: ' + err.message);
    }
  };

  // ── Device Actions ─────────────────────────────────────────
  const handleAddDevice = async (e) => {
    e.preventDefault();
    if (!newDeviceId || !newDeviceMac) return;
    try {
      const data = {
        deviceId: newDeviceId,
        macAddress: newDeviceMac,
        firmwareVersion: 'v1.0.4',
        assignedAnimalId: '',
        assignedFarmerId: '',
        status: 'online',
        batteryLevel: 100,
        signalStrength: 'Strong',
        lastSeen: Timestamp.now(),
        isBuffering: false,
        lastSyncedAt: Timestamp.now(),
        registeredAt: Timestamp.now(),
        registeredBy: 'admin-uid-001'
      };
      await setDoc(doc(db, 'devices', newDeviceId), data);
      await writeAudit('device.registered', newDeviceId, 'device', `ESP32 collar provisioned: ${newDeviceId} [MAC: ${newDeviceMac}]`);
      setNewDeviceId(''); setNewDeviceMac('');
    } catch (err) {
      alert('Error registering device: ' + err.message);
    }
  };

  const handleDeviceUpdate = async (e) => {
    e.preventDefault();
    if (!editingDevice) return;
    try {
      const deviceRef = doc(db, 'devices', editingDevice.docId);
      await updateDoc(deviceRef, {
        firmwareVersion: editingDevice.firmwareVersion,
        assignedAnimalId: editingDevice.assignedAnimalId,
        assignedFarmerId: editingDevice.assignedFarmerId,
        status: editingDevice.status,
        batteryLevel: editingDevice.batteryLevel
      });

      // Update animal back-link if assignedAnimalId was selected
      if (editingDevice.assignedAnimalId) {
        await updateDoc(doc(db, 'animals', editingDevice.assignedAnimalId), {
          deviceId: editingDevice.docId
        });
      }

      await writeAudit('device.updated', editingDevice.docId, 'device', `Updated collar ${editingDevice.docId}: Firmware ${editingDevice.firmwareVersion}`);
      setEditingDevice(null);
    } catch (err) {
      alert('Error updating device: ' + err.message);
    }
  };

  const handleDeleteDevice = async (docId) => {
    if (!window.confirm(`Are you sure you want to decommission device: ${docId}?`)) return;
    try {
      await deleteDoc(doc(db, 'devices', docId));
      await writeAudit('device.removed', docId, 'device', `Decommissioned ESP32 collar: ${docId}`);
    } catch (err) {
      alert('Error removing device: ' + err.message);
    }
  };

  // ── Save config to Firestore ───────────────────────────────
  const handleSaveConfig = async (e) => {
    e.preventDefault();
    const updated = {
      ...(config || {}),
      temperatureThresholds: { ...config?.temperatureThresholds, highAlert: tempHigh, lowAlert: tempLow },
      heartRateThresholds:   { ...config?.heartRateThresholds,   highAlert: hrHigh,   lowAlert: hrLow   },
      aiModelParams:         { ...config?.aiModelParams,         minConfidence: aiConfidence },
      geofenceBounds:        { radius: geofenceRadius, centerLat: geofenceCenterLat, centerLng: geofenceCenterLng },
      systemSettings:        { enableAutoClean, maintenanceMode, darkModeOverride },
      updatedAt: Timestamp.now(),
      updatedBy: 'admin-uid-001'
    };
    await setDoc(doc(db, 'system_config', 'global'), updated);
    await writeAudit('config.updated', 'global', 'config', `Alert & System settings updated`);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const formatTime = (ts) => {
    if (!ts) return '—';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    const diff = Math.floor((Date.now() - date.getTime()) / 60000);
    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff}m ago`;
    if (diff < 1440) return `${Math.floor(diff/60)}h ago`;
    return `${Math.floor(diff/1440)}d ago`;
  };

  const tabBtn = (id, label, Icon) => (
    <button
      className="btn-logout"
      onClick={() => setActiveTab(id)}
      style={{
        borderColor: activeTab === id ? '#c084fc' : 'var(--border-glass)',
        color: activeTab === id ? '#fff' : 'var(--text-muted)',
        background: activeTab === id ? 'rgba(192,132,252,0.08)' : 'transparent'
      }}
    >
      <Icon size={14} /> {label}
    </button>
  );

  // Filters
  const filteredAnimals = animals.filter(a =>
    (a.name || '').toLowerCase().includes(animalSearch.toLowerCase()) ||
    (a.tagNumber || '').toLowerCase().includes(animalSearch.toLowerCase()) ||
    (a.species || '').toLowerCase().includes(animalSearch.toLowerCase())
  );

  const activeAlerts = alerts.filter(al => al.status === 'active');

  if (loading) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', flexDirection:'column', background:'#060913', color:'#fff' }}>
        <div className="spinner" style={{ width:'36px', height:'36px', borderWidth:'3.5px', borderTopColor:'#c084fc', marginBottom:'1.25rem' }}></div>
        <p style={{ fontFamily:'Outfit,sans-serif', color:'var(--text-muted)', fontSize:'0.8rem', textTransform:'uppercase', letterSpacing:'0.08em' }}>Loading admin panel...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-container">

      {/* Admin Header */}
      <header className="dashboard-header-nav" style={{ borderBottomColor:'rgba(192,132,252,0.2)' }}>
        <div className="nav-brand">
          <div className="logo-icon-small" style={{ background:'linear-gradient(135deg,#c084fc 0%,#a855f7 100%)' }}>
            <Cpu size={18} color="#060913" strokeWidth={2.5} />
          </div>
          <span className="brand-text">LIVETRACK AI</span>
          <span className="badge-system" style={{ color:'#c084fc', borderColor:'rgba(192,132,252,0.2)', background:'rgba(192,132,252,0.05)' }}>ADMIN SYSTEM</span>
        </div>
        <div className="nav-actions">
          <div className="user-profile">
            <div className="avatar" style={{ backgroundColor:'rgba(192,132,252,0.15)' }}>
              <User size={14} color="#c084fc" />
            </div>
            <span className="user-email">{userEmail}</span>
          </div>
          <button className="btn-logout" onClick={onLogout}>
            <LogOut size={16} /><span>Sign Out</span>
          </button>
        </div>
      </header>

      <main className="dashboard-content">

        {/* Tab nav */}
        <section style={{ display:'flex', gap:'0.75rem', flexWrap:'wrap', borderBottom:'1px solid var(--border-glass)', paddingBottom:'1rem' }}>
          {tabBtn('analytics', 'Analytics Dashboard',                           BarChart2)}
          {tabBtn('users',     `User Accounts (${users.length})`,                Users)}
          {tabBtn('animals',   `Animals (${animals.length})`,                    PawPrint)}
          {tabBtn('devices',   `Smart Collars (${devices.length})`,              Cpu)}
          {tabBtn('alerts',    `Livestock Alerts (${activeAlerts.length})`,       Bell)}
          {tabBtn('config',    'System Config',                                  Sliders)}
          {tabBtn('audits',    'System Health & Logs',                           Terminal)}
        </section>

        {/* ── Tab 0: Analytics Dashboard ───────────────────────── */}
        {activeTab === 'analytics' && (
          <section style={{ display:'flex', flexDirection:'column', gap:'1.5rem' }}>
            {/* Cards Grid */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:'1.25rem' }}>
              <div className="stat-card" style={{ borderLeft: '3px solid #c084fc' }}>
                <Users className="stat-icon" style={{ color: '#c084fc' }} />
                <h3>{users.length}</h3>
                <p>System Users</p>
                <span className="stat-subtext">{users.filter(u => u.role === 'farmer').length} Farmers • {users.filter(u => u.role === 'vet').length} Vets</span>
              </div>
              <div className="stat-card" style={{ borderLeft: '3px solid var(--primary)' }}>
                <PawPrint className="stat-icon" style={{ color: 'var(--primary)' }} />
                <h3>{animals.length}</h3>
                <p>Registered Livestock</p>
                <span className="stat-subtext">{animals.filter(a => a.deviceId).length} Assigned Devices</span>
              </div>
              <div className="stat-card" style={{ borderLeft: '3px solid var(--secondary)' }}>
                <Cpu className="stat-icon" style={{ color: 'var(--secondary)' }} />
                <h3>{deviceStats.online} / {devices.length}</h3>
                <p>ESP32 Collars Online</p>
                <span className="stat-subtext">{deviceStats.offline} Decommissioned/Offline</span>
              </div>
              <div className="stat-card" style={{ borderLeft: `3px solid ${activeAlerts.length > 0 ? 'var(--danger)' : 'var(--success)'}` }}>
                {activeAlerts.length > 0 ? <AlertTriangle className="stat-icon" style={{ color: 'var(--danger)' }} /> : <CheckCircle2 className="stat-icon" style={{ color: 'var(--success)' }} />}
                <h3>{activeAlerts.length}</h3>
                <p>Active Vitals Alerts</p>
                <span className="stat-subtext">{alerts.filter(al => al.severity === 'critical' && al.status === 'active').length} Critical Warnings</span>
              </div>
            </div>

            <div className="telemetry-grid">
              {/* Vitals Summary */}
              <div className="map-card-wrapper" style={{ padding:'1.5rem' }}>
                <h4 style={{ color:'#fff', fontFamily:'var(--font-heading)', fontSize:'1.2rem', marginBottom:'1.25rem', display:'flex', alignItems:'center', gap:'0.5rem' }}>
                  <Gauge size={18} color="#c084fc" /> Live System Vitals
                </h4>
                <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>
                  <div>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.75rem', marginBottom:'0.25rem' }}>
                      <span style={{ color:'var(--text-muted)' }}>Device Connectivity Index</span>
                      <span style={{ color:'#fff', fontWeight:600 }}>{devices.length ? Math.round((deviceStats.online / devices.length) * 100) : 0}%</span>
                    </div>
                    <div style={{ height:'6px', background:'rgba(255,255,255,0.05)', borderRadius:'3px', overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${devices.length ? (deviceStats.online / devices.length) * 100 : 0}%`, background:'var(--primary)', borderRadius:'3px' }} />
                    </div>
                  </div>
                  <div>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.75rem', marginBottom:'0.25rem' }}>
                      <span style={{ color:'var(--text-muted)' }}>AI Prediction Accuracy Confidence</span>
                      <span style={{ color:'#fff', fontWeight:600 }}>{aiConfidence}%</span>
                    </div>
                    <div style={{ height:'6px', background:'rgba(255,255,255,0.05)', borderRadius:'3px', overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${aiConfidence}%`, background:'#c084fc', borderRadius:'3px' }} />
                    </div>
                  </div>
                  <div>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.75rem', marginBottom:'0.25rem' }}>
                      <span style={{ color:'var(--text-muted)' }}>Battery Status OK (&gt; 20%)</span>
                      <span style={{ color:'#fff', fontWeight:600 }}>
                        {devices.length ? Math.round((devices.filter(d => d.batteryLevel >= 20).length / devices.length) * 100) : 0}%
                      </span>
                    </div>
                    <div style={{ height:'6px', background:'rgba(255,255,255,0.05)', borderRadius:'3px', overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${devices.length ? (devices.filter(d => d.batteryLevel >= 20).length / devices.length) * 100 : 0}%`, background:'var(--secondary)', borderRadius:'3px' }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Alert Distribution */}
              <div className="map-card-wrapper" style={{ padding:'1.5rem' }}>
                <h4 style={{ color:'#fff', fontFamily:'var(--font-heading)', fontSize:'1.2rem', marginBottom:'1.25rem', display:'flex', alignItems:'center', gap:'0.5rem' }}>
                  <ShieldAlert size={18} color="#c084fc" /> Active Warnings Breakdown
                </h4>
                <div style={{ display:'flex', flexDirection:'column', gap:'0.85rem' }}>
                  {[
                    ['Fever / Abnormal Temp', alerts.filter(al => al.type === 'temperature' && al.status === 'active').length, 'var(--danger)'],
                    ['Tachycardia / High HR', alerts.filter(al => al.type === 'heartRate' && al.status === 'active').length, '#f59e0b'],
                    ['Geofence Breaches', alerts.filter(al => al.type === 'geofence' && al.status === 'active').length, 'var(--secondary)'],
                    ['Device Hardware Faults', alerts.filter(al => al.type === 'battery' && al.status === 'active').length, 'var(--text-muted)']
                  ].map(([label, count, color]) => (
                    <div key={label} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0.5rem', background:'rgba(255,255,255,0.01)', border:'1px solid var(--border-glass)', borderRadius:'8px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
                        <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:color }} />
                        <span style={{ fontSize:'0.8rem', color:'#fff' }}>{label}</span>
                      </div>
                      <span style={{ fontSize:'0.8rem', fontWeight:600, color }}>{count} active</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── Tab 1: Users ───────────────────────────────────── */}
        {activeTab === 'users' && (
          <section className="telemetry-grid">
            <div className="map-card-wrapper" style={{ padding:'1.5rem' }}>
              <h4 style={{ color:'#fff', fontFamily:'var(--font-heading)', fontSize:'1.2rem', marginBottom:'1.25rem', display:'flex', alignItems:'center', gap:'0.5rem' }}>
                <Users size={18} color="#c084fc" /> Registered System Users
              </h4>
              <div className="inventory-list" style={{ maxHeight:'none' }}>
                {users.map(u => (
                  <div key={u.docId} className="inventory-item" style={{ cursor:'default' }}>
                    <div className="item-left">
                      <div className="avatar" style={{ width:'32px', height:'32px', backgroundColor: u.role==='admin' ? 'rgba(192,132,252,0.1)' : u.role==='vet' ? 'rgba(6,182,212,0.1)' : 'rgba(16,185,129,0.1)' }}>
                        <User size={14} color={u.role==='admin' ? '#c084fc' : u.role==='vet' ? 'var(--secondary)' : 'var(--primary)'} />
                      </div>
                      <div className="item-title-block">
                        <h6>{u.name}</h6>
                        <span>{u.email} {u.phone ? `• ${u.phone}` : ''}</span>
                        {u.farmName && <span style={{ fontSize:'0.7rem', color:'var(--text-dark)' }}>Farm: {u.farmName}</span>}
                      </div>
                    </div>
                    <div className="item-right" style={{ gap:'1rem' }}>
                      <span className="activity-pill" style={{
                        color: u.role==='admin' ? '#c084fc' : u.role==='vet' ? 'var(--secondary)' : 'var(--primary)',
                        background: u.role==='admin' ? 'rgba(192,132,252,0.08)' : u.role==='vet' ? 'rgba(6,182,212,0.08)' : 'rgba(16,185,129,0.08)'
                      }}>{u.role}</span>
                      
                      <button
                        onClick={() => setEditingUser(u)}
                        style={{ background:'transparent', border:'none', color:'var(--text-dark)', cursor:'pointer', transition:'0.2s' }}
                        onMouseEnter={e => e.currentTarget.style.color='#c084fc'}
                        onMouseLeave={e => e.currentTarget.style.color='var(--text-dark)'}
                        title="Edit User details"
                      >
                        <Edit3 size={16} />
                      </button>

                      <button
                        onClick={() => handleDeleteUser(u.docId, u.email)}
                        style={{ background:'transparent', border:'none', color:'var(--text-dark)', cursor:'pointer', transition:'0.2s' }}
                        onMouseEnter={e => e.currentTarget.style.color='var(--danger)'}
                        onMouseLeave={e => e.currentTarget.style.color='var(--text-dark)'}
                        title="Remove User"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="map-card-wrapper" style={{ padding:'1.5rem' }}>
              <h4 style={{ color:'#fff', fontFamily:'var(--font-heading)', fontSize:'1.2rem', marginBottom:'1.25rem', display:'flex', alignItems:'center', gap:'0.5rem' }}>
                {editingUser ? <Edit3 size={18} color="#c084fc" /> : <UserPlus size={18} color="#c084fc" />}
                {editingUser ? 'Update User Account' : 'Provision User Account'}
              </h4>

              {/* Success Banner displaying Temporary Password */}
              {tempPasswordInfo && (
                <div style={{
                  background: tempPasswordInfo.orphanFixed ? 'rgba(251,191,36,0.08)'
                            : tempPasswordInfo.reactivated ? 'rgba(6,182,212,0.08)'
                            : 'rgba(16,185,129,0.08)',
                  border: `1px solid ${
                    tempPasswordInfo.orphanFixed ? '#f59e0b'
                  : tempPasswordInfo.reactivated ? 'var(--secondary)'
                  : 'var(--primary)'}`,
                  borderRadius: '12px', padding: '1rem', marginBottom: '1.25rem'
                }}>
                  <h5 style={{
                    color: tempPasswordInfo.orphanFixed ? '#f59e0b'
                         : tempPasswordInfo.reactivated ? 'var(--secondary)'
                         : 'var(--primary)',
                    margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem'
                  }}>
                    <Check size={16} />
                    {tempPasswordInfo.orphanFixed ? '📧 Password Reset Sent!'
                   : tempPasswordInfo.reactivated ? '♻️ Account Reactivated!'
                   : '✅ User Account Created!'}
                  </h5>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 0.75rem 0' }}>
                    {tempPasswordInfo.orphanFixed ? (
                      <>A password reset email has been sent to <strong style={{ color: '#fff' }}>{tempPasswordInfo.email}</strong>.
                      The user should click the link in the email to set a new password, then log in as <strong>{tempPasswordInfo.role}</strong>.
                      Their profile will be created automatically on first login.</>
                    ) : tempPasswordInfo.reactivated ? (
                      <>The previously deactivated account for <strong style={{ color: '#fff' }}>{tempPasswordInfo.email}</strong> has been <strong>reactivated</strong> as <strong>{tempPasswordInfo.role}</strong>. The old password still works — use the reset option below if needed.</>
                    ) : (
                      <>A new account has been created for <strong style={{ color: '#fff' }}>{tempPasswordInfo.email}</strong> as <strong>{tempPasswordInfo.role}</strong>.</>
                    )}
                  </p>
                  {!tempPasswordInfo.reactivated && !tempPasswordInfo.orphanFixed && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 0.75rem 0' }}>
                      Temporary Password: <strong style={{ color: 'var(--primary)', fontSize: '0.95rem', background: 'rgba(16,185,129,0.15)', padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid rgba(16,185,129,0.3)' }}>{tempPasswordInfo.password}</strong>
                    </p>
                  )}
                  <button type="button" className="btn-logout" onClick={() => setTempPasswordInfo(null)} style={{ padding: '0.35rem 0.75rem', fontSize: '0.72rem' }}>
                    Dismiss
                  </button>
                </div>
              )}

              {/* Error Banner */}
              {provisionError && (
                <div className="feedback-message feedback-error" style={{ marginBottom: '1.25rem', marginTop: 0 }}>
                  <span style={{ fontWeight: 'bold' }}>Error:</span> {provisionError}
                </div>
              )}

              {editingUser ? (
                // UPDATE USER FORM
                <form onSubmit={handleUpdateUser} style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>
                  <div className="form-group" style={{ marginBottom:0 }}>
                    <label style={{ fontSize:'0.75rem', color:'var(--text-muted)', marginBottom:'0.3rem', display:'block' }}>Display Name</label>
                    <input type="text" className="form-input" style={{ paddingLeft:'1rem' }} value={editingUser.name} onChange={e => setEditingUser({...editingUser, name: e.target.value})} required />
                  </div>
                  <div className="form-group" style={{ marginBottom:0 }}>
                    <label style={{ fontSize:'0.75rem', color:'var(--text-muted)', marginBottom:'0.3rem', display:'block' }}>Email Address</label>
                    <input type="email" className="form-input" style={{ paddingLeft:'1rem' }} value={editingUser.email} onChange={e => setEditingUser({...editingUser, email: e.target.value})} required />
                  </div>
                  <div className="form-group" style={{ marginBottom:0 }}>
                    <label style={{ fontSize:'0.75rem', color:'var(--text-muted)', marginBottom:'0.3rem', display:'block' }}>Phone Number</label>
                    <input type="text" className="form-input" style={{ paddingLeft:'1rem' }} value={editingUser.phone || ''} onChange={e => setEditingUser({...editingUser, phone: e.target.value})} />
                  </div>
                  <div className="form-group" style={{ marginBottom:0 }}>
                    <label style={{ fontSize:'0.75rem', color:'var(--text-muted)', marginBottom:'0.3rem', display:'block' }}>Farm / Clinic Name</label>
                    <input type="text" className="form-input" style={{ paddingLeft:'1rem' }} value={editingUser.farmName || ''} onChange={e => setEditingUser({...editingUser, farmName: e.target.value})} />
                  </div>
                  <div className="form-group" style={{ marginBottom:0 }}>
                    <label style={{ fontSize:'0.75rem', color:'var(--text-muted)', marginBottom:'0.3rem', display:'block' }}>System Role</label>
                    <select className="form-input" style={{ paddingLeft:'1rem', appearance:'none', cursor:'pointer' }} value={editingUser.role} onChange={e => setEditingUser({...editingUser, role: e.target.value})}>
                      <option value="farmer">Farmer</option>
                      <option value="vet">Veterinarian</option>
                      <option value="admin">Administrator</option>
                    </select>
                  </div>
                  <div style={{ display:'flex', gap:'0.75rem' }}>
                    <button type="submit" className="btn-primary" style={{ flex: 1, background:'linear-gradient(135deg,#c084fc 0%,#a855f7 100%)', color:'#060913' }}>
                      <Save size={16} /> Save Changes
                    </button>
                    <button type="button" className="btn-logout" style={{ margin:0 }} onClick={() => setEditingUser(null)}>
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                // PROVISION USER FORM
                <form onSubmit={handleAddUser} autoComplete="off" style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>
                  <div className="form-group" style={{ marginBottom:0 }}>
                    <div className="input-container">
                      <input
                        type="text"
                        className="form-input"
                        style={{ paddingLeft:'1rem' }}
                        placeholder=" "
                        value={newUserName}
                        onChange={e => { setNewUserName(e.target.value); setProvisionError(''); }}
                        required
                        disabled={isProvisioning}
                        autoComplete="off"
                        name="display-name-field"
                      />
                      <label className="floating-label" style={{ left:'1rem' }}>Display Name</label>
                    </div>
                  </div>
                  <div className="form-group" style={{ marginBottom:0 }}>
                    <div className="input-container">
                      <input
                        type="email"
                        className="form-input"
                        style={{ paddingLeft:'1rem' }}
                        placeholder=" "
                        value={newUserEmail}
                        onChange={e => { setNewUserEmail(e.target.value); setProvisionError(''); setTempPasswordInfo(null); }}
                        required
                        disabled={isProvisioning}
                        autoComplete="off"
                        name="provision-email-field"
                      />
                      <label className="floating-label" style={{ left:'1rem' }}>Email Address</label>
                    </div>
                  </div>
                  <div className="form-group" style={{ marginBottom:0 }}>
                    <div className="input-container">
                      <select className="form-input" style={{ paddingLeft:'1rem', appearance:'none', cursor:'pointer' }} value={newUserRole} onChange={e => setNewUserRole(e.target.value)} disabled={isProvisioning}>
                        <option value="farmer">Farmer</option>
                        <option value="vet">Veterinarian</option>
                        <option value="admin">Administrator</option>
                      </select>
                    </div>
                  </div>
                  <button type="submit" className="btn-primary" disabled={isProvisioning} style={{ background:'linear-gradient(135deg,#c084fc 0%,#a855f7 100%)', color:'#060913', boxShadow:'0 4px 15px rgba(192,132,252,0.3)' }}>
                    {isProvisioning ? (
                      <>
                        <span className="spinner" style={{ borderTopColor: '#060913' }}></span>
                        <span>Creating Account...</span>
                      </>
                    ) : (
                      <>
                        <Plus size={16} /> Register User Account
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </section>
        )}

        {/* ── Tab 2: Animals ─────────────────────────────────── */}
        {activeTab === 'animals' && (
          <section className="telemetry-grid">
            <div className="map-card-wrapper" style={{ padding:'1.5rem' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
                <h4 style={{ color:'#fff', fontFamily:'var(--font-heading)', fontSize:'1.2rem', margin:0, display:'flex', alignItems:'center', gap:'0.5rem' }}>
                  <PawPrint size={18} color="#c084fc" /> Manage Animal Records
                </h4>
                <div className="input-container" style={{ width:'200px' }}>
                  <Search size={14} style={{ position:'absolute', left:'0.75rem', top:'50%', transform:'translateY(-50%)', color:'var(--text-dark)' }} />
                  <input
                    type="text"
                    className="form-input"
                    style={{ paddingLeft:'2.25rem', height:'32px', fontSize:'0.75rem' }}
                    placeholder="Search tag or species..."
                    value={animalSearch}
                    onChange={e => setAnimalSearch(e.target.value)}
                  />
                </div>
              </div>

              <div className="inventory-list" style={{ maxHeight:'none' }}>
                {filteredAnimals.map(a => (
                  <div key={a.docId} className="inventory-item" style={{ cursor:'default' }}>
                    <div className="item-left">
                      <div className="avatar" style={{ width:'32px', height:'32px', backgroundColor:'rgba(16,185,129,0.1)' }}>
                        <PawPrint size={14} color="var(--primary)" />
                      </div>
                      <div className="item-title-block">
                        <h6>{a.name} <span style={{ fontSize:'0.75rem', color:'var(--text-muted)', fontWeight:400 }}>[Tag: {a.tagNumber}]</span></h6>
                        <span>{a.species} • {a.breed} • {a.gender} • {a.weight}kg</span>
                        <div style={{ display:'flex', gap:'0.5rem', marginTop:'0.25rem', flexWrap:'wrap' }}>
                          <span style={{ fontSize:'0.65rem', background:'rgba(255,255,255,0.03)', border:'1px solid var(--border-glass)', padding:'0.1rem 0.4rem', borderRadius:'4px' }}>
                            Collar: {a.deviceId || 'No Collar Assigned'}
                          </span>
                          <span style={{ fontSize:'0.65rem', background:'rgba(255,255,255,0.03)', border:'1px solid var(--border-glass)', padding:'0.1rem 0.4rem', borderRadius:'4px' }}>
                            Farmer: {users.find(u => u.uid === a.farmerId)?.name || 'Unassigned'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="item-right" style={{ gap:'1rem' }}>
                      <button
                        onClick={() => handleEditAnimalClick(a)}
                        style={{ background:'transparent', border:'none', color:'var(--text-dark)', cursor:'pointer', transition:'0.2s' }}
                        onMouseEnter={e => e.currentTarget.style.color='#c084fc'}
                        onMouseLeave={e => e.currentTarget.style.color='var(--text-dark)'}
                        title="Edit animal details"
                      >
                        <Edit3 size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteAnimal(a.docId, a.name)}
                        style={{ background:'transparent', border:'none', color:'var(--text-dark)', cursor:'pointer', transition:'0.2s' }}
                        onMouseEnter={e => e.currentTarget.style.color='var(--danger)'}
                        onMouseLeave={e => e.currentTarget.style.color='var(--text-dark)'}
                        title="Delete Animal"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
                {filteredAnimals.length === 0 && (
                  <p style={{ color:'var(--text-muted)', fontSize:'0.8rem', padding:'1rem 0' }}>No animal records match your filters.</p>
                )}
              </div>
            </div>

            {/* Register / Update Animal Form */}
            <div className="map-card-wrapper" style={{ padding:'1.5rem' }}>
              <h4 style={{ color:'#fff', fontFamily:'var(--font-heading)', fontSize:'1.2rem', marginBottom:'1.25rem', display:'flex', alignItems:'center', gap:'0.5rem' }}>
                {editingAnimal ? <Edit3 size={18} color="#c084fc" /> : <Plus size={18} color="#c084fc" />}
                {editingAnimal ? `Update Animal: ${editingAnimal.name}` : 'Register New Animal'}
              </h4>

              <form onSubmit={handleAnimalFormSubmit} style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'1rem' }}>
                  <div className="form-group" style={{ marginBottom:0 }}>
                    <label style={{ fontSize:'0.72rem', color:'var(--text-muted)', display:'block', marginBottom:'0.2rem' }}>Name</label>
                    <input type="text" className="form-input" style={{ paddingLeft:'1rem' }} value={animalForm.name} onChange={e => setAnimalForm({...animalForm, name: e.target.value})} required />
                  </div>
                  <div className="form-group" style={{ marginBottom:0 }}>
                    <label style={{ fontSize:'0.72rem', color:'var(--text-muted)', display:'block', marginBottom:'0.2rem' }}>Tag Number</label>
                    <input type="text" className="form-input" style={{ paddingLeft:'1rem' }} value={animalForm.tagNumber} onChange={e => setAnimalForm({...animalForm, tagNumber: e.target.value})} required />
                  </div>
                </div>

                <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'1rem' }}>
                  <div className="form-group" style={{ marginBottom:0 }}>
                    <label style={{ fontSize:'0.72rem', color:'var(--text-muted)', display:'block', marginBottom:'0.2rem' }}>Species</label>
                    <select className="form-input" style={{ paddingLeft:'1rem', appearance:'none', cursor:'pointer' }} value={animalForm.species} onChange={e => setAnimalForm({...animalForm, species: e.target.value})}>
                      <option value="Cattle">Cattle</option>
                      <option value="Sheep">Sheep</option>
                      <option value="Goats">Goats</option>
                      <option value="Pigs">Pigs</option>
                      <option value="Horses">Horses</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom:0 }}>
                    <label style={{ fontSize:'0.72rem', color:'var(--text-muted)', display:'block', marginBottom:'0.2rem' }}>Breed</label>
                    <input type="text" className="form-input" style={{ paddingLeft:'1rem' }} value={animalForm.breed} onChange={e => setAnimalForm({...animalForm, breed: e.target.value})} placeholder="e.g. Holstein" />
                  </div>
                </div>

                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'1rem' }}>
                  <div className="form-group" style={{ marginBottom:0 }}>
                    <label style={{ fontSize:'0.72rem', color:'var(--text-muted)', display:'block', marginBottom:'0.2rem' }}>Gender</label>
                    <select className="form-input" style={{ paddingLeft:'0.5rem', appearance:'none', cursor:'pointer' }} value={animalForm.gender} onChange={e => setAnimalForm({...animalForm, gender: e.target.value})}>
                      <option value="female">Female</option>
                      <option value="male">Male</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom:0 }}>
                    <label style={{ fontSize:'0.72rem', color:'var(--text-muted)', display:'block', marginBottom:'0.2rem' }}>Weight (kg)</label>
                    <input type="number" step="0.1" className="form-input" style={{ paddingLeft:'0.5rem' }} value={animalForm.weight} onChange={e => setAnimalForm({...animalForm, weight: e.target.value})} required />
                  </div>
                  <div className="form-group" style={{ marginBottom:0 }}>
                    <label style={{ fontSize:'0.72rem', color:'var(--text-muted)', display:'block', marginBottom:'0.2rem' }}>Color</label>
                    <input type="text" className="form-input" style={{ paddingLeft:'0.5rem' }} value={animalForm.color} onChange={e => setAnimalForm({...animalForm, color: e.target.value})} />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom:0 }}>
                  <label style={{ fontSize:'0.72rem', color:'var(--text-muted)', display:'block', marginBottom:'0.2rem' }}>Assign collar (ESP32 Device)</label>
                  <select className="form-input" style={{ paddingLeft:'1rem', appearance:'none', cursor:'pointer' }} value={animalForm.deviceId} onChange={e => setAnimalForm({...animalForm, deviceId: e.target.value})}>
                    <option value="">-- No Collar --</option>
                    {devices.map(d => (
                      <option key={d.docId} value={d.docId}>
                        {d.deviceId} {d.assignedAnimalId && d.assignedAnimalId !== editingAnimal?.docId ? `(Occupied: ${d.assignedAnimalId})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom:0 }}>
                  <label style={{ fontSize:'0.72rem', color:'var(--text-muted)', display:'block', marginBottom:'0.2rem' }}>Assign Owner (Farmer)</label>
                  <select className="form-input" style={{ paddingLeft:'1rem', appearance:'none', cursor:'pointer' }} value={animalForm.farmerId} onChange={e => setAnimalForm({...animalForm, farmerId: e.target.value})} required>
                    <option value="">-- Select Owner --</option>
                    {users.filter(u => u.role === 'farmer').map(u => (
                      <option key={u.docId} value={u.uid}>{u.name} ({u.email})</option>
                    ))}
                  </select>
                </div>

                <div style={{ display:'flex', gap:'0.75rem', marginTop:'0.5rem' }}>
                  <button type="submit" className="btn-primary" disabled={savingAnimal} style={{ flex:1, background:'linear-gradient(135deg,#c084fc 0%,#a855f7 100%)', color:'#060913' }}>
                    {savingAnimal ? 'Saving...' : (editingAnimal ? 'Save Changes' : 'Register Animal')}
                  </button>
                  {editingAnimal && (
                    <button type="button" className="btn-logout" style={{ margin:0 }} onClick={() => { setEditingAnimal(null); setAnimalForm(EMPTY_ANIMAL_FORM); }}>
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>
          </section>
        )}

        {/* ── Tab 3: Devices ─────────────────────────────────── */}
        {activeTab === 'devices' && (
          <section className="telemetry-grid">
            <div className="map-card-wrapper" style={{ padding:'1.5rem' }}>
              <h4 style={{ color:'#fff', fontFamily:'var(--font-heading)', fontSize:'1.2rem', marginBottom:'1.25rem', display:'flex', alignItems:'center', gap:'0.5rem' }}>
                <Cpu size={18} color="#c084fc" /> Smart Collars — {deviceStats.online} Online / {deviceStats.offline} Offline
              </h4>
              <div className="inventory-list" style={{ maxHeight:'none' }}>
                {devices.map(d => (
                  <div key={d.docId} className="inventory-item" style={{ cursor:'default' }}>
                    <div className="item-left">
                      <div className="avatar" style={{ width:'32px', height:'32px', backgroundColor: d.status==='online' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)' }}>
                        <Wifi size={14} color={d.status==='online' ? 'var(--primary)' : 'var(--danger)'} />
                      </div>
                      <div className="item-title-block">
                        <h6>{d.deviceId || d.docId} <span style={{ fontSize:'0.7rem', color:'var(--text-dark)', fontWeight:400 }}>({d.firmwareVersion || 'v1.0.4'})</span></h6>
                        <span>MAC: {d.macAddress}</span>
                        <div style={{ display:'flex', gap:'0.5rem', marginTop:'0.25rem' }}>
                          <span style={{ fontSize:'0.65rem', color:'var(--text-muted)' }}>
                            Animal: {animals.find(a => a.docId === d.assignedAnimalId)?.name || 'Unassigned'}
                          </span>
                          <span style={{ fontSize:'0.65rem', color:'var(--text-muted)' }}>
                            Farmer: {users.find(u => u.uid === d.assignedFarmerId)?.name || 'Unassigned'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="item-right" style={{ gap:'1rem' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'0.25rem', fontSize:'0.75rem', color: d.batteryLevel < 20 ? 'var(--danger)' : 'var(--text-muted)' }}>
                        <Battery size={14} /> {d.batteryLevel || 100}%
                      </div>
                      
                      <button
                        onClick={() => setEditingDevice(d)}
                        style={{ background:'transparent', border:'none', color:'var(--text-dark)', cursor:'pointer', transition:'0.2s' }}
                        onMouseEnter={e => e.currentTarget.style.color='#c084fc'}
                        onMouseLeave={e => e.currentTarget.style.color='var(--text-dark)'}
                        title="Configure firmware / assignments"
                      >
                        <Edit3 size={16} />
                      </button>

                      <button
                        onClick={() => handleDeleteDevice(d.docId)}
                        style={{ background:'transparent', border:'none', color:'var(--text-dark)', cursor:'pointer', transition:'0.2s' }}
                        onMouseEnter={e => e.currentTarget.style.color='var(--danger)'}
                        onMouseLeave={e => e.currentTarget.style.color='var(--text-dark)'}
                        title="Decommission"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Device Form: Register or Edit */}
            <div className="map-card-wrapper" style={{ padding:'1.5rem' }}>
              <h4 style={{ color:'#fff', fontFamily:'var(--font-heading)', fontSize:'1.2rem', marginBottom:'1.25rem', display:'flex', alignItems:'center', gap:'0.5rem' }}>
                {editingDevice ? <Edit3 size={18} color="#c084fc" /> : <Plus size={18} color="#c084fc" />}
                {editingDevice ? `Configure Collar: ${editingDevice.deviceId}` : 'Register ESP32 Device'}
              </h4>

              {editingDevice ? (
                // UPDATE / ASSIGN DEVICE FORM
                <form onSubmit={handleDeviceUpdate} style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>
                  <div className="form-group" style={{ marginBottom:0 }}>
                    <label style={{ fontSize:'0.75rem', color:'var(--text-muted)', marginBottom:'0.3rem', display:'block' }}>Firmware Version</label>
                    <input type="text" className="form-input" style={{ paddingLeft:'1rem' }} value={editingDevice.firmwareVersion || ''} onChange={e => setEditingDevice({...editingDevice, firmwareVersion: e.target.value})} required />
                  </div>

                  <div className="form-group" style={{ marginBottom:0 }}>
                    <label style={{ fontSize:'0.75rem', color:'var(--text-muted)', marginBottom:'0.3rem', display:'block' }}>Assign to Animal</label>
                    <select className="form-input" style={{ paddingLeft:'1rem', appearance:'none', cursor:'pointer' }} value={editingDevice.assignedAnimalId || ''} onChange={e => setEditingDevice({...editingDevice, assignedAnimalId: e.target.value})}>
                      <option value="">-- Unassigned --</option>
                      {animals.map(a => (
                        <option key={a.docId} value={a.docId}>{a.name} [Tag: {a.tagNumber}]</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group" style={{ marginBottom:0 }}>
                    <label style={{ fontSize:'0.75rem', color:'var(--text-muted)', marginBottom:'0.3rem', display:'block' }}>Assign to Owner (Farmer)</label>
                    <select className="form-input" style={{ paddingLeft:'1rem', appearance:'none', cursor:'pointer' }} value={editingDevice.assignedFarmerId || ''} onChange={e => setEditingDevice({...editingDevice, assignedFarmerId: e.target.value})}>
                      <option value="">-- Unassigned --</option>
                      {users.filter(u => u.role === 'farmer').map(u => (
                        <option key={u.docId} value={u.uid}>{u.name} ({u.email})</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'1rem' }}>
                    <div className="form-group" style={{ marginBottom:0 }}>
                      <label style={{ fontSize:'0.75rem', color:'var(--text-muted)', marginBottom:'0.3rem', display:'block' }}>Collar Telemetry Status</label>
                      <select className="form-input" style={{ paddingLeft:'1rem', appearance:'none', cursor:'pointer' }} value={editingDevice.status || 'online'} onChange={e => setEditingDevice({...editingDevice, status: e.target.value})}>
                        <option value="online">Online</option>
                        <option value="offline">Offline</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ marginBottom:0 }}>
                      <label style={{ fontSize:'0.75rem', color:'var(--text-muted)', marginBottom:'0.3rem', display:'block' }}>Battery charge (%)</label>
                      <input type="number" min="0" max="100" className="form-input" style={{ paddingLeft:'1rem' }} value={editingDevice.batteryLevel || 100} onChange={e => setEditingDevice({...editingDevice, batteryLevel: parseInt(e.target.value) || 100})} required />
                    </div>
                  </div>

                  <div style={{ display:'flex', gap:'0.75rem', marginTop:'0.5rem' }}>
                    <button type="submit" className="btn-primary" style={{ flex: 1, background:'linear-gradient(135deg,#c084fc 0%,#a855f7 100%)', color:'#060913' }}>
                      <Save size={16} /> Save Settings
                    </button>
                    <button type="button" className="btn-logout" style={{ margin:0 }} onClick={() => setEditingDevice(null)}>
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                // REGISTER NEW ESP32 FORM
                <form onSubmit={handleAddDevice} style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>
                  <div className="form-group" style={{ marginBottom:0 }}>
                    <div className="input-container">
                      <input type="text" className="form-input" style={{ paddingLeft:'1rem' }} placeholder=" " value={newDeviceId} onChange={e => setNewDeviceId(e.target.value)} required />
                      <label className="floating-label" style={{ left:'1rem' }}>Device ID (e.g. ESP32-A06)</label>
                    </div>
                  </div>
                  <div className="form-group" style={{ marginBottom:0 }}>
                    <div className="input-container">
                      <input type="text" className="form-input" style={{ paddingLeft:'1rem' }} placeholder=" " value={newDeviceMac} onChange={e => setNewDeviceMac(e.target.value)} required />
                      <label className="floating-label" style={{ left:'1rem' }}>Hardware MAC Address</label>
                    </div>
                  </div>
                  <button type="submit" className="btn-primary" style={{ background:'linear-gradient(135deg,#c084fc 0%,#a855f7 100%)', color:'#060913', boxShadow:'0 4px 15px rgba(192,132,252,0.3)' }}>
                    <Plus size={16} /> Register Smart Collar
                  </button>
                </form>
              )}
            </div>
          </section>
        )}

        {/* ── Tab 4: Livestock Alerts ────────────────────────── */}
        {activeTab === 'alerts' && (
          <section className="map-card-wrapper" style={{ padding:'2rem' }}>
            <h4 style={{ color:'#fff', fontFamily:'var(--font-heading)', fontSize:'1.25rem', marginBottom:'1.5rem', display:'flex', alignItems:'center', gap:'0.5rem' }}>
              <Bell size={20} color="#c084fc" /> Active Livestock Alerts Feed
            </h4>
            <div className="logs-feed" style={{ maxHeight:'500px' }}>
              {alerts.map(al => (
                <div key={al.docId} className="log-entry" style={{ borderBottomColor:'rgba(255,255,255,0.03)', padding:'1rem 0.5rem' }}>
                  <AlertTriangle size={16} style={{ color: al.severity === 'critical' ? 'var(--danger)' : '#f59e0b', flexShrink:0 }} />
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
                      <span style={{ fontWeight:600, color:'#fff' }}>{al.type?.toUpperCase()} Alert: {al.animalName || 'Livestock'}</span>
                      <span style={{ fontSize:'0.7rem', color: al.status === 'active' ? 'var(--danger)' : 'var(--success)' }}>
                        {al.status === 'active' ? '● ACTIVE' : 'RESOLVED'}
                      </span>
                    </div>
                    <p style={{ fontSize:'0.8rem', color:'var(--text-muted)', margin:'0.25rem 0' }}>{al.message}</p>
                    <div style={{ fontSize:'0.7rem', display:'flex', gap:'1rem', color:'var(--text-dark)' }}>
                      <span>Tag: {al.tagNumber}</span>
                      <span>Triggered: {formatTime(al.triggeredAt)}</span>
                      {al.resolvedAt && <span>Resolved: {formatTime(al.resolvedAt)}</span>}
                    </div>
                  </div>
                </div>
              ))}
              {alerts.length === 0 && (
                <p style={{ color:'var(--text-muted)', fontSize:'0.8rem' }}>No system alerts found.</p>
              )}
            </div>
          </section>
        )}

        {/* ── Tab 5: System Configuration ─────────────────────── */}
        {activeTab === 'config' && (
          <section className="map-card-wrapper" style={{ padding:'2rem', maxWidth:'800px', margin:'0 auto' }}>
            <h4 style={{ color:'#fff', fontFamily:'var(--font-heading)', fontSize:'1.25rem', marginBottom:'1.5rem', display:'flex', alignItems:'center', gap:'0.5rem' }}>
              <Sliders size={20} color="#c084fc" /> System Configurations & Boundaries
              {config && <span style={{ fontSize:'0.7rem', color:'var(--text-muted)', marginLeft:'auto' }}>Loaded from Firestore ✅</span>}
            </h4>
            <form onSubmit={handleSaveConfig} style={{ display:'flex', flexDirection:'column', gap:'1.5rem' }}>
              
              <div style={{ background:'rgba(255,255,255,0.015)', border:'1px solid var(--border-glass)', borderRadius:'16px', padding:'1.25rem' }}>
                <h5 style={{ color:'#fff', fontSize:'0.95rem', marginBottom:'1rem', fontFamily:'var(--font-heading)' }}>Body Temperature Alert Boundaries</h5>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'1.5rem' }}>
                  <div>
                    <label style={{ fontSize:'0.75rem', color:'var(--text-muted)', display:'block', marginBottom:'0.5rem' }}>CRITICAL HIGH: {tempHigh} °C</label>
                    <input type="range" min="39.0" max="41.5" step="0.1" value={tempHigh} onChange={e => setTempHigh(parseFloat(e.target.value))} style={{ width:'100%', accentColor:'var(--danger)' }} />
                  </div>
                  <div>
                    <label style={{ fontSize:'0.75rem', color:'var(--text-muted)', display:'block', marginBottom:'0.5rem' }}>CRITICAL LOW: {tempLow} °C</label>
                    <input type="range" min="36.5" max="38.5" step="0.1" value={tempLow} onChange={e => setTempLow(parseFloat(e.target.value))} style={{ width:'100%', accentColor:'var(--secondary)' }} />
                  </div>
                </div>
              </div>

              <div style={{ background:'rgba(255,255,255,0.015)', border:'1px solid var(--border-glass)', borderRadius:'16px', padding:'1.25rem' }}>
                <h5 style={{ color:'#fff', fontSize:'0.95rem', marginBottom:'1rem', fontFamily:'var(--font-heading)' }}>Heart Rate Alert Boundaries</h5>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'1.5rem' }}>
                  <div>
                    <label style={{ fontSize:'0.75rem', color:'var(--text-muted)', display:'block', marginBottom:'0.5rem' }}>HIGH PULSE: {hrHigh} BPM</label>
                    <input type="range" min="80" max="120" value={hrHigh} onChange={e => setHrHigh(parseInt(e.target.value))} style={{ width:'100%', accentColor:'var(--danger)' }} />
                  </div>
                  <div>
                    <label style={{ fontSize:'0.75rem', color:'var(--text-muted)', display:'block', marginBottom:'0.5rem' }}>LOW PULSE: {hrLow} BPM</label>
                    <input type="range" min="40" max="70" value={hrLow} onChange={e => setHrLow(parseInt(e.target.value))} style={{ width:'100%', accentColor:'var(--secondary)' }} />
                  </div>
                </div>
              </div>

              <div style={{ background:'rgba(255,255,255,0.015)', border:'1px solid var(--border-glass)', borderRadius:'16px', padding:'1.25rem' }}>
                <h5 style={{ color:'#fff', fontSize:'0.95rem', marginBottom:'1rem', fontFamily:'var(--font-heading)' }}>Geofence Boundaries</h5>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'1rem' }}>
                  <div>
                    <label style={{ fontSize:'0.72rem', color:'var(--text-muted)', display:'block', marginBottom:'0.2rem' }}>Geofence Radius (meters)</label>
                    <input type="number" className="form-input" style={{ paddingLeft:'0.5rem' }} value={geofenceRadius} onChange={e => setGeofenceRadius(parseInt(e.target.value) || 200)} />
                  </div>
                  <div>
                    <label style={{ fontSize:'0.72rem', color:'var(--text-muted)', display:'block', marginBottom:'0.2rem' }}>Center Latitude</label>
                    <input type="number" step="0.0001" className="form-input" style={{ paddingLeft:'0.5rem' }} value={geofenceCenterLat} onChange={e => setGeofenceCenterLat(parseFloat(e.target.value) || 6.9271)} />
                  </div>
                  <div>
                    <label style={{ fontSize:'0.72rem', color:'var(--text-muted)', display:'block', marginBottom:'0.2rem' }}>Center Longitude</label>
                    <input type="number" step="0.0001" className="form-input" style={{ paddingLeft:'0.5rem' }} value={geofenceCenterLng} onChange={e => setGeofenceCenterLng(parseFloat(e.target.value) || 79.8612)} />
                  </div>
                </div>
              </div>

              <div style={{ background:'rgba(255,255,255,0.015)', border:'1px solid var(--border-glass)', borderRadius:'16px', padding:'1.25rem' }}>
                <h5 style={{ color:'#fff', fontSize:'0.95rem', marginBottom:'1rem', fontFamily:'var(--font-heading)' }}>AI Model Parameters</h5>
                <label style={{ fontSize:'0.75rem', color:'var(--text-muted)', display:'block', marginBottom:'0.5rem' }}>MIN AI PREDICTION CONFIDENCE: {aiConfidence}%</label>
                <input type="range" min="50" max="95" value={aiConfidence} onChange={e => setAiConfidence(parseInt(e.target.value))} style={{ width:'100%', accentColor:'#c084fc' }} />
              </div>

              <div style={{ background:'rgba(255,255,255,0.015)', border:'1px solid var(--border-glass)', borderRadius:'16px', padding:'1.25rem' }}>
                <h5 style={{ color:'#fff', fontSize:'0.95rem', marginBottom:'1rem', fontFamily:'var(--font-heading)' }}>General System Settings</h5>
                <div style={{ display:'flex', flexDirection:'column', gap:'0.8rem' }}>
                  <label style={{ display:'flex', alignItems:'center', gap:'0.5rem', fontSize:'0.8rem', color:'#fff', cursor:'pointer' }}>
                    <input type="checkbox" checked={enableAutoClean} onChange={e => setEnableAutoClean(e.target.checked)} style={{ accentColor:'#c084fc' }} />
                    Auto-Clean Telemetry Logs (&gt; 30 days)
                  </label>
                  <label style={{ display:'flex', alignItems:'center', gap:'0.5rem', fontSize:'0.8rem', color:'#fff', cursor:'pointer' }}>
                    <input type="checkbox" checked={maintenanceMode} onChange={e => setMaintenanceMode(e.target.checked)} style={{ accentColor:'#c084fc' }} />
                    Enable DB Maintenance Mode
                  </label>
                  <label style={{ display:'flex', alignItems:'center', gap:'0.5rem', fontSize:'0.8rem', color:'#fff', cursor:'pointer' }}>
                    <input type="checkbox" checked={darkModeOverride} onChange={e => setDarkModeOverride(e.target.checked)} style={{ accentColor:'#c084fc' }} />
                    Default Dark Mode Override
                  </label>
                </div>
              </div>

              <button type="submit" className="btn-primary" style={{ background:'linear-gradient(135deg,#c084fc 0%,#a855f7 100%)', color:'#060913', padding:'0.85rem 1.5rem', width:'auto', alignSelf:'flex-start', display:'flex', gap:'0.5rem', alignItems:'center' }}>
                <Save size={16} /> Save Configurations
              </button>
              {saveSuccess && (
                <div className="feedback-message feedback-success" style={{ width:'100%', padding:'0.75rem' }}>
                  <Check size={16} /> Configuration thresholds updated and saved to system_config/global in Firestore.
                </div>
              )}
            </form>
          </section>
        )}

        {/* ── Tab 6: System Health & Logs ─────────────────────── */}
        {activeTab === 'audits' && (
          <section className="telemetry-grid">
            {/* System Health Snapshot */}
            <div className="map-card-wrapper" style={{ padding:'1.5rem' }}>
              <h4 style={{ color:'#fff', fontFamily:'var(--font-heading)', fontSize:'1.2rem', marginBottom:'1.25rem', display:'flex', alignItems:'center', gap:'0.5rem' }}>
                <Settings size={18} color="#c084fc" /> Gateway & System Vitals
              </h4>
              <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
                {[
                  ['Registered Users', `${users.length} active profiles`],
                  ['Active Animals', `${animals.length} livestock entries`],
                  ['ESP32 Collars Connected', `${deviceStats.online} online collars`],
                  ['Telemetry Latency', '14ms (Healthy)'],
                  ['Live Firestore Sync', 'Active — Listeners online'],
                  ['Database Status', maintenanceMode ? 'Maintenance Mode' : 'Operational'],
                  ['Audit Log Entries', `${auditLogs.length} total records`],
                ].map(([label, value]) => (
                  <div key={label} style={{ display:'flex', justifyContent:'space-between', borderBottom:'1px solid rgba(255,255,255,0.03)', paddingBottom:'0.5rem', fontSize:'0.8rem' }}>
                    <span style={{ color:'var(--text-muted)' }}>{label}:</span>
                    <span style={{ color:'var(--primary)', fontWeight:600 }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Live Audit Log Feed */}
            <div className="map-card-wrapper" style={{ padding:'1.5rem' }}>
              <h4 style={{ color:'#fff', fontFamily:'var(--font-heading)', fontSize:'1.2rem', marginBottom:'1.25rem', display:'flex', alignItems:'center', gap:'0.5rem' }}>
                <Terminal size={18} color="#c084fc" /> Security Audit Log Feed
              </h4>
              <div className="logs-feed" style={{ maxHeight:'380px' }}>
                {auditLogs.map(log => (
                  <div key={log.docId} className="log-entry" style={{ borderBottomColor:'rgba(255,255,255,0.03)' }}>
                    <Terminal size={12} className="log-ico" style={{ color:'#c084fc', flexShrink:0 }} />
                    <div className="log-text-block">
                      <p style={{ fontWeight:600, color:'#fff' }}>{log.action}</p>
                      <p style={{ fontSize:'0.75rem', marginTop:'0.1rem' }}>{log.details}</p>
                      <span style={{ fontSize:'0.65rem' }}>{log.actorEmail} • {formatTime(log.timestamp)}</span>
                    </div>
                  </div>
                ))}
                {auditLogs.length === 0 && (
                  <p style={{ color:'var(--text-muted)', fontSize:'0.8rem' }}>No audit log entries found.</p>
                )}
              </div>
            </div>
          </section>
        )}

      </main>
    </div>
  );
}
