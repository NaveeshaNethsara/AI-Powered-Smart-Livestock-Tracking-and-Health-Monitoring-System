// FarmerDashboard.jsx — Main Container
// Combines all tabs with sidebar navigation
// Shared Firestore listeners for all data
import React, { useState, useEffect } from 'react';
import {
  Activity, LogOut, User, LayoutDashboard, PawPrint,
  MonitorCheck, Brain, MapPin, Bell, FileBarChart, UserCircle,
  Thermometer, Heart, Compass, AlertTriangle, CheckCircle2,
  ChevronRight, Map, Search, Filter
} from 'lucide-react';
import {
  collection, query, onSnapshot, orderBy, limit, where, addDoc, Timestamp, doc
} from 'firebase/firestore';
import { ref, onValue } from 'firebase/database';
import { db, rtdb } from '../../firebase';

import AnimalsTab   from './AnimalsTab';
import MonitoringTab from './MonitoringTab';
import AIHealthTab  from './AIHealthTab';
import GPSTab       from './GPSTab';
import AlertsTab    from './AlertsTab';
import ReportsTab   from './ReportsTab';
import ProfileTab   from './ProfileTab';

const NAV_ITEMS = [
  { id: 'overview',    label: 'Overview',        Icon: LayoutDashboard },
  { id: 'animals',     label: 'My Animals',       Icon: PawPrint        },
  { id: 'monitoring',  label: 'Live Monitoring',  Icon: MonitorCheck    },
  { id: 'ai',          label: 'AI Health',        Icon: Brain           },
  { id: 'gps',         label: 'GPS & Geofence',   Icon: MapPin          },
  { id: 'alerts',      label: 'Alerts',           Icon: Bell            },
  { id: 'reports',     label: 'Reports',          Icon: FileBarChart    },
  { id: 'profile',     label: 'My Profile',       Icon: UserCircle      },
];

export default function FarmerDashboard({ onLogout, userEmail, userId }) {
  const [activeTab, setActiveTab] = useState('overview');

  // ── Shared Firestore state ─────────────────────────────────
  const [animals,        setAnimals]        = useState([]);
  const [devices,        setDevices]        = useState([]);
  const [alerts,         setAlerts]         = useState([]);
  const [geofences,      setGeofences]      = useState([]);
  const [latestReadings, setLatestReadings] = useState({});
  const [latestGps,      setLatestGps]      = useState({});
  const [latestAI,       setLatestAI]       = useState({});
  const [loading,        setLoading]        = useState(true);
  const [sysConfig,      setSysConfig]      = useState(null);
  const [laptopCoords,   setLaptopCoords]   = useState(null);

  const overviewMapContainerRef = React.useRef(null);
  const overviewMapInstanceRef = React.useRef(null);
  const overviewMarkersRef = React.useRef({});
  const overviewCircleRef = React.useRef(null);

  // ── 1. Animals ─────────────────────────────────────────────
  useEffect(() => {
    const q = query(collection(db, 'animals'), where('isActive', '==', true));
    const unsub = onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ docId: d.id, ...d.data() }));
      setAnimals(list);
      setLoading(false);
      list.forEach(a => {
        subscribeReadings(a.docId);
        subscribeGps(a.docId);
        subscribeAI(a.docId);
      });
    });
    return () => unsub();
  }, []);

  // ── 2. Sensor readings (latest per animal) ─────────────────
  const subscribeReadings = (id) => {
    const q = query(collection(db, 'animals', id, 'sensor_readings'), orderBy('timestamp', 'desc'), limit(1));
    onSnapshot(q, s => {
      if (!s.empty) setLatestReadings(p => ({ ...p, [id]: s.docs[0].data() }));
    });
  };

  // ── 3. GPS (latest per animal) ──────────────────────────────
  const subscribeGps = (id) => {
    const q = query(collection(db, 'animals', id, 'gps_locations'), orderBy('timestamp', 'desc'), limit(1));
    onSnapshot(q, s => {
      if (!s.empty) setLatestGps(p => ({ ...p, [id]: s.docs[0].data() }));
    });
  };

  // ── 4. AI predictions (latest per animal) ──────────────────
  const subscribeAI = (id) => {
    const q = query(collection(db, 'animals', id, 'ai_predictions'), orderBy('timestamp', 'desc'), limit(1));
    onSnapshot(q, s => {
      if (!s.empty) setLatestAI(p => ({ ...p, [id]: s.docs[0].data() }));
    });
  };

  // ── 5. Alerts ───────────────────────────────────────────────
  useEffect(() => {
    const q = query(collection(db, 'alerts'), orderBy('triggeredAt', 'desc'), limit(50));
    return onSnapshot(q, s => setAlerts(s.docs.map(d => ({ docId: d.id, ...d.data() }))));
  }, []);

  // ── 6. Devices ──────────────────────────────────────────────
  useEffect(() => {
    return onSnapshot(collection(db, 'devices'), s => setDevices(s.docs.map(d => ({ docId: d.id, ...d.data() }))));
  }, []);

  // ── 7. Geofences ───────────────────────────────────────────
  useEffect(() => {
    return onSnapshot(collection(db, 'geofences'), s => setGeofences(s.docs.map(d => ({ docId: d.id, ...d.data() }))));
  }, []);

  // ── 7.5. System Config ─────────────────────────────────────
  useEffect(() => {
    return onSnapshot(doc(db, 'system_config', 'global'), (snap) => {
      if (snap.exists()) {
        setSysConfig(snap.data());
      }
    });
  }, []);

  // ── 7.6. Laptop Geolocation ────────────────────────────────
  useEffect(() => {
    const getPos = () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setLaptopCoords({
              lat: position.coords.latitude,
              lng: position.coords.longitude
            });
          },
          (error) => {
            console.warn("Could not retrieve laptop geolocation:", error);
          },
          { enableHighAccuracy: true }
        );
      }
    };
    getPos();
    const interval = setInterval(getPos, 10000);
    return () => clearInterval(interval);
  }, []);

  // ── 7.7. Overview Leaflet Map ──────────────────────────────
  useEffect(() => {
    // Only initialize if tab is overview and element is rendered
    if (activeTab !== 'overview' || !overviewMapContainerRef.current) {
      if (overviewMapInstanceRef.current) {
        overviewMapInstanceRef.current.remove();
        overviewMapInstanceRef.current = null;
        overviewCircleRef.current = null;
        overviewMarkersRef.current = {};
      }
      return;
    }
    if (!window.L) return;

    const center = laptopCoords || { lat: 7.291, lng: 80.633 };

    if (!overviewMapInstanceRef.current) {
      const map = window.L.map(overviewMapContainerRef.current, {
        zoomControl: false, // hide zoom controls on overview map
        attributionControl: false
      }).setView([center.lat, center.lng], 14);

      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
      }).addTo(map);

      overviewMapInstanceRef.current = map;
    }

    const map = overviewMapInstanceRef.current;

    // Pan map to new center coordinates if laptop base location changes
    map.panTo([center.lat, center.lng]);

    // Redraw geofence circle
    if (overviewCircleRef.current) {
      overviewCircleRef.current.remove();
    }
    overviewCircleRef.current = window.L.circle([center.lat, center.lng], {
      color: '#ef4444',
      fillColor: '#ef4444',
      fillOpacity: 0.05,
      radius: sysConfig?.geofenceBounds?.radius ?? 200,
      weight: 1.5,
      dashArray: '5, 5'
    }).addTo(map);

  }, [activeTab, laptopCoords, sysConfig]);

  // Update overview markers
  useEffect(() => {
    const map = overviewMapInstanceRef.current;
    if (!map || activeTab !== 'overview' || !window.L) return;

    // Remove obsolete markers
    Object.keys(overviewMarkersRef.current).forEach(id => {
      if (!animals.some(a => a.docId === id)) {
        overviewMarkersRef.current[id].remove();
        delete overviewMarkersRef.current[id];
      }
    });

    // Add or update markers
    animals.forEach(a => {
      const g = latestGps[a.docId] || {};
      if (!g.latitude || !g.longitude) return;

      const lat = g.latitude;
      const lng = g.longitude;
      const hc = a.healthStatus === 'critical' ? 'critical' : a.healthStatus === 'at_risk' ? 'warning' : 'healthy';

      const customIcon = window.L.divIcon({
        className: 'custom-leaflet-pin',
        html: `
          <div class="map-animal-pin ${hc}" style="position: relative;">
            <span class="pin-pulse"></span>
            <span class="pin-center-dot"></span>
            <span class="pin-label-pop" style="visibility: visible; opacity: 1; transform: translate(-50%, -100%) translateY(-6px);">${a.name}</span>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      if (overviewMarkersRef.current[a.docId]) {
        overviewMarkersRef.current[a.docId].setLatLng([lat, lng]);
        overviewMarkersRef.current[a.docId].setIcon(customIcon);
      } else {
        const marker = window.L.marker([lat, lng], { icon: customIcon })
          .addTo(map)
          .on('click', () => setActiveTab('gps')); // Go to full map when clicked
        overviewMarkersRef.current[a.docId] = marker;
      }
    });
  }, [activeTab, animals, latestGps]);

  // Ref to track last sync times (throttling Firestore writes to save quota)
  const lastSyncTimes = React.useRef({});

  // Geofence checker helper using laptop coordinates as center and admin configured radius
  const checkGeofence = (lat, lng) => {
    const centerLat = laptopCoords?.lat ?? sysConfig?.geofenceBounds?.centerLat ?? 7.291;
    const centerLng = laptopCoords?.lng ?? sysConfig?.geofenceBounds?.centerLng ?? 80.633;
    const radiusMeters = sysConfig?.geofenceBounds?.radius ?? 200;

    const R = 6371e3; // Earth radius in meters
    const phi1 = lat * Math.PI / 180;
    const phi2 = centerLat * Math.PI / 180;
    const deltaPhi = (centerLat - lat) * Math.PI / 180;
    const deltaLambda = (centerLng - lng) * Math.PI / 180;

    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return distance <= radiusMeters;
  };

  // Evaluate and trigger alerts based on telemetry
  const evaluateAlerts = async (animal, vitals, gpsLoc) => {
    let severity = null;
    let type = null;
    let message = '';

    if (vitals.bodyTemperature > 39.8) {
      severity = 'critical';
      type = 'high_temp';
      message = `${animal.name} has a critical high temperature of ${vitals.bodyTemperature}°C! Suspected fever or heat stress.`;
    } else if (vitals.bodyTemperature < 37.8) {
      severity = 'warning';
      type = 'low_temp';
      message = `${animal.name} has a low temperature of ${vitals.bodyTemperature}°C. Monitor behavior closely.`;
    }

    if (gpsLoc.latitude && gpsLoc.longitude) {
      const inside = checkGeofence(gpsLoc.latitude, gpsLoc.longitude);
      if (!inside) {
        severity = 'critical';
        type = 'geofence_violation';
        message = `${animal.name} [Tag: ${animal.tagNumber}] has breached the geofence boundary!`;
      }
    }

    if (severity && type) {
      // Check if there is already an active alert of this type for this animal to avoid duplicates
      const dup = alerts.find(al => al.animalId === animal.docId && al.alertType === type && al.status === 'active');
      if (!dup) {
        await addDoc(collection(db, 'alerts'), {
          animalId: animal.docId,
          animalName: animal.name,
          tagNumber: animal.tagNumber,
          alertType: type,
          severity,
          message,
          status: 'active',
          isRead: false,
          isResolved: false,
          triggeredAt: Timestamp.now()
        });
      }
    }
  };

  // ── 8. Realtime Database listener for ESP32 ─────────────────
  useEffect(() => {
    if (animals.length === 0) return;

    const activeRTDBListeners = [];

    animals.forEach(a => {
      if (!a.deviceId) return; // e.g. "ESP32-A02" or a custom device ID

      // Resolve the MAC address from the devices list if possible
      const deviceDoc = devices.find(d => d.deviceId === a.deviceId || d.docId === a.deviceId);
      const listenerKey = deviceDoc?.macAddress ? deviceDoc.macAddress.toUpperCase().trim() : a.deviceId;

      const deviceRef = ref(rtdb, `livestock/${listenerKey}/latest`);
      
      const unsubscribe = onValue(deviceRef, async (snapshot) => {
        if (!snapshot.exists()) return;
        const val = snapshot.val();
        
        const temp = val.temperature || 38.5;
        const ax = val.accelerometer?.x || 0;
        const ay = val.accelerometer?.y || 0;
        const az = val.accelerometer?.z || 0;

        // activity level based on magnitude
        const magnitude = Math.sqrt(ax * ax + ay * ay + az * az);
        let activity = 'resting';
        let stepIncrement = 0;
        let heartRate = Math.floor(65 + (temp - 38.5) * 8);

        if (magnitude > 25000) {
          activity = 'running';
          stepIncrement = 3;
          heartRate += 25;
        } else if (magnitude > 16000) {
          activity = 'walking';
          stepIncrement = 1;
          heartRate += 12;
        }
        heartRate = Math.max(55, Math.min(115, heartRate));

        const prevSteps = latestReadings[a.docId]?.stepCount || 120;
        const newSteps = prevSteps + stepIncrement;

        const timestampDate = val.timestamp ? new Date(val.timestamp) : new Date();

        const readingData = {
          bodyTemperature: parseFloat(temp.toFixed(1)),
          heartRate,
          activityLevel: activity,
          stepCount: newSteps,
          accelerometerX: parseFloat((ax / 16384.0).toFixed(2)),
          accelerometerY: parseFloat((ay / 16384.0).toFixed(2)),
          accelerometerZ: parseFloat((az / 16384.0).toFixed(2)),
          batteryLevel: 85,
          sensorStatus: 'connected',
          isBuffered: false,
          timestamp: Timestamp.fromDate(timestampDate)
        };

        // Update dynamic readings state in-memory
        setLatestReadings(prev => ({ ...prev, [a.docId]: readingData }));

        // Map and update GPS state if gps object exists
        let gpsLoc = {};
        if (val.gps?.latitude && val.gps?.longitude) {
          const isInside = checkGeofence(val.gps.latitude, val.gps.longitude);
          gpsLoc = {
            latitude: val.gps.latitude,
            longitude: val.gps.longitude,
            altitude: 512,
            speed: activity === 'resting' ? 0.0 : activity === 'walking' ? 0.8 : 2.5,
            accuracy: 3.5,
            isInsideGeofence: isInside,
            timestamp: Timestamp.fromDate(timestampDate)
          };
          setLatestGps(prev => ({ ...prev, [a.docId]: gpsLoc }));

          // Save GPS to Firestore history (throttle to once per 15s)
          const nowMs = Date.now();
          const lastGpsSync = lastSyncTimes.current[`gps-${a.docId}`] || 0;
          if (nowMs - lastGpsSync > 15000) {
            lastSyncTimes.current[`gps-${a.docId}`] = nowMs;
            await addDoc(collection(db, 'animals', a.docId, 'gps_locations'), gpsLoc);
          }
        }

        // Save Vitals to Firestore history (throttle to once per 15s)
        const nowMs = Date.now();
        const lastVitalsSync = lastSyncTimes.current[`vitals-${a.docId}`] || 0;
        if (nowMs - lastVitalsSync > 15000) {
          lastSyncTimes.current[`vitals-${a.docId}`] = nowMs;
          await addDoc(collection(db, 'animals', a.docId, 'sensor_readings'), readingData);
          await evaluateAlerts(a, readingData, val.gps || {});
        }
      });

      activeRTDBListeners.push({ deviceId: a.deviceId, unsubscribe });
    });

    return () => {
      activeRTDBListeners.forEach(l => l.unsubscribe());
    };
  }, [animals, alerts, devices, laptopCoords, sysConfig]);

  // ── Computed values for Overview tab ──────────────────────
  const totalAnimals = animals.length;
  const unreadAlerts = alerts.filter(a => !a.isRead).length;
  const criticalCount = animals.filter(a => a.healthStatus === 'critical').length;
  const avgTemp = totalAnimals > 0
    ? (animals.reduce((acc, a) => acc + (latestReadings[a.docId]?.bodyTemperature || 0), 0) /
       animals.filter(a => latestReadings[a.docId]?.bodyTemperature).length || 1).toFixed(1)
    : '—';

  const healthCounts = animals.reduce((acc, a) => {
    if (a.healthStatus === 'healthy')  acc.healthy++;
    else if (a.healthStatus === 'at_risk') acc.warning++;
    else if (a.healthStatus === 'critical') acc.critical++;
    return acc;
  }, { healthy: 0, warning: 0, critical: 0 });

  const hClass = (s) => s === 'critical' ? 'critical' : s === 'at_risk' ? 'warning' : 'healthy';
  const fmtTime = (ts) => {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    const diff = Math.floor((Date.now() - d.getTime()) / 60000);
    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff}m ago`;
    return `${Math.floor(diff/60)}h ago`;
  };

  if (loading) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', flexDirection:'column', background:'#060913', color:'#fff' }}>
        <div className="spinner" style={{ width:'40px', height:'40px', borderWidth:'4px', borderTopColor:'var(--primary)', marginBottom:'1.5rem' }}></div>
        <p style={{ fontFamily:'Outfit,sans-serif', color:'var(--text-muted)', fontSize:'0.85rem', textTransform:'uppercase', letterSpacing:'0.08em' }}>Loading LiveTrack AI...</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', width: '100%', height: '100vh', overflow: 'hidden', background: 'var(--bg-main)' }}>

      {/* ── Sidebar Navigation ────────────────────────────── */}
      <aside style={{
        width: '220px', flexShrink: 0, background: 'rgba(10,14,30,0.95)',
        borderRight: '1px solid var(--border-glass)', display: 'flex',
        flexDirection: 'column', padding: '1.25rem 0', overflowY: 'auto'
      }}>
        {/* Brand */}
        <div style={{ padding: '0 1.25rem 1.25rem', borderBottom: '1px solid var(--border-glass)', marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div className="logo-icon-small" style={{ width: '30px', height: '30px' }}>
              <Activity size={15} color="#060913" strokeWidth={2.5} />
            </div>
            <div>
              <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '0.85rem', color: '#fff', display: 'block' }}>LIVETRACK</span>
              <span style={{ fontSize: '0.6rem', color: 'var(--primary)', letterSpacing: '0.08em' }}>FARMER PORTAL</span>
            </div>
          </div>
        </div>

        {/* Nav Items */}
        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.2rem', padding: '0 0.75rem' }}>
          {NAV_ITEMS.map(({ id, label, Icon }) => {
            const isActive = activeTab === id;
            const badgeCount = id === 'alerts' ? unreadAlerts : id === 'animals' ? criticalCount : 0;
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.65rem 0.9rem', borderRadius: '10px', border: 'none',
                  background: isActive ? 'rgba(16,185,129,0.1)' : 'transparent',
                  color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                  cursor: 'pointer', textAlign: 'left', fontSize: '0.83rem',
                  fontWeight: isActive ? 600 : 400, width: '100%',
                  borderLeft: isActive ? '2px solid var(--primary)' : '2px solid transparent',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = 'var(--text-muted)'; }}
              >
                <Icon size={15} />
                <span style={{ flex: 1 }}>{label}</span>
                {badgeCount > 0 && (
                  <span style={{ background: id === 'alerts' ? 'var(--danger)' : 'var(--warning)', color: '#fff', fontSize: '0.6rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: '10px', minWidth: '18px', textAlign: 'center' }}>
                    {badgeCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User info + Logout */}
        <div style={{ padding: '0.75rem', borderTop: '1px solid var(--border-glass)', marginTop: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.6rem', padding: '0 0.25rem' }}>
            <div className="avatar" style={{ width: '28px', height: '28px' }}>
              <User size={12} color="var(--primary)" />
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', wordBreak: 'break-all' }}>{userEmail}</span>
          </div>
          <button className="btn-logout" onClick={onLogout}
            style={{ width: '100%', justifyContent: 'center', fontSize: '0.78rem', padding: '0.5rem' }}>
            <LogOut size={13} /> Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main Content Area ─────────────────────────────── */}
      <main style={{ flex: 1, overflow: 'auto', padding: '1.75rem' }}>

        {/* Page Header */}
        <div style={{ marginBottom: '1.75rem' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', color: '#fff', fontSize: '1.5rem', margin: 0 }}>
            {NAV_ITEMS.find(n => n.id === activeTab)?.label}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: '0.25rem 0 0 0' }}>
            {activeTab === 'overview'   && `${totalAnimals} animals monitored • ${unreadAlerts} unread alerts • Live data from Firestore`}
            {activeTab === 'animals'    && 'FR-F06 to FR-F13 — Register, manage, and view medical records for your livestock'}
            {activeTab === 'monitoring' && 'FR-F14 to FR-F19 — Real-time sensor streams from ESP32 smart collars'}
            {activeTab === 'ai'         && 'FR-F20 to FR-F29 — AI-powered health analysis and detection algorithms'}
            {activeTab === 'gps'        && 'FR-F30 to FR-F33 — Live GPS tracking, movement history, and geofence management'}
            {activeTab === 'alerts'     && 'FR-F34 to FR-F41 — All alert types and notification history'}
            {activeTab === 'reports'    && 'FR-F42 to FR-F46 — Generate and export health and activity reports'}
            {activeTab === 'profile'    && 'FR-F04, FR-F05 — Manage your account and security settings'}
          </p>
        </div>

        {/* ── Overview Tab ─────────────────────────────────── */}
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            {/* KPI Row */}
            <section className="kpi-section">
              <div className="metric-card">
                <div className="metric-icon bg-emerald"><Thermometer size={20} color="var(--primary)" /></div>
                <div className="metric-info">
                  <span className="metric-label">Average Temperature</span>
                  <div className="metric-value-row">
                    <h3>{avgTemp}°C</h3>
                    <span className="status-indicator-badge positive">Live</span>
                  </div>
                  <p className="metric-sub">Target: 38.5°C – 39.5°C</p>
                </div>
              </div>
              <div className="metric-card">
                <div className="metric-icon bg-cyan"><Heart size={20} color="var(--secondary)" /></div>
                <div className="metric-info">
                  <span className="metric-label">Herd Health Status</span>
                  <div className="health-bar-container">
                    <div className="health-segment healthy" style={{ width: `${totalAnimals ? (healthCounts.healthy / totalAnimals) * 100 : 0}%` }} />
                    <div className="health-segment warning" style={{ width: `${totalAnimals ? (healthCounts.warning / totalAnimals) * 100 : 0}%` }} />
                    <div className="health-segment critical" style={{ width: `${totalAnimals ? (healthCounts.critical / totalAnimals) * 100 : 0}%` }} />
                  </div>
                  <div className="health-breakdown">
                    <span className="health-b-item green"><span className="indicator-dot"></span>{healthCounts.healthy} Healthy</span>
                    <span className="health-b-item orange"><span className="indicator-dot"></span>{healthCounts.warning} At Risk</span>
                    <span className="health-b-item red"><span className="indicator-dot"></span>{healthCounts.critical} Critical</span>
                  </div>
                </div>
              </div>
              <div className="metric-card">
                <div className="metric-icon bg-purple"><AlertTriangle size={20} color="#c084fc" /></div>
                <div className="metric-info">
                  <span className="metric-label">Active Alerts</span>
                  <div className="metric-value-row">
                    <h3>{unreadAlerts}</h3>
                    {unreadAlerts > 0 && <span className="status-indicator-badge" style={{ color: 'var(--danger)', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>Unread</span>}
                  </div>
                  <p className="metric-sub"><button onClick={() => setActiveTab('alerts')} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.75rem', padding: 0 }}>View all alerts →</button></p>
                </div>
              </div>
            </section>

            {/* GPS Map + Animal quick list */}
            <section className="telemetry-grid">
              {/* GPS Overview */}
              <div className="map-card-wrapper">
                <div className="map-card-header">
                  <div className="title-block"><Map size={18} color="var(--primary)" /><h4>Live GPS Overview</h4></div>
                  <button className="btn-logout" style={{ fontSize: '0.72rem', padding: '0.3rem 0.7rem' }} onClick={() => setActiveTab('gps')}>Full Map →</button>
                </div>
                <div className="gps-map-container" style={{ padding: 0 }}>
                  <div 
                    ref={overviewMapContainerRef} 
                    style={{ 
                      height: '240px', 
                      width: '100%', 
                      borderRadius: '12px',
                      position: 'relative',
                      zIndex: 1
                    }} 
                  />
                  <div className="map-help-tip">Click pins to go to the interactive map or go to GPS & Geofence tab for full tracking</div>
                </div>
              </div>

              {/* Right column: animals + alerts */}
              <div className="inventory-card-wrapper">
                {/* Animal quick list */}
                <div className="inventory-list">
                  {animals.slice(0, 5).map(a => {
                    const r = latestReadings[a.docId] || {};
                    return (
                      <div key={a.docId} className="inventory-item" onClick={() => setActiveTab('monitoring')} style={{ cursor: 'pointer' }}>
                        <div className="item-left">
                          <div className={`health-indicator-border ${hClass(a.healthStatus)}`}></div>
                          <div className="item-title-block">
                            <h6>{a.name}</h6>
                            <span>{a.tagNumber} • {a.species}</span>
                          </div>
                        </div>
                        <div className="item-right">
                          <div className="item-vital">
                            <Thermometer size={12} color="var(--text-muted)" />
                            <span>{r.bodyTemperature ? `${r.bodyTemperature}°C` : '—'}</span>
                          </div>
                          <div className={`activity-pill ${(r.activityLevel || 'unknown').toLowerCase()}`}>
                            {r.activityLevel || '—'}
                          </div>
                          <ChevronRight size={14} className="chevron" />
                        </div>
                      </div>
                    );
                  })}
                  {animals.length > 5 && (
                    <button onClick={() => setActiveTab('animals')}
                      style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--primary)', fontSize: '0.78rem', cursor: 'pointer', padding: '0.5rem' }}>
                      View all {animals.length} animals →
                    </button>
                  )}
                </div>

                {/* Recent alerts */}
                <div className="live-logs-section">
                  <div className="logs-header">
                    <Bell size={14} color="var(--primary)" />
                    <span>RECENT ALERTS</span>
                    <button onClick={() => setActiveTab('alerts')} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.68rem', marginLeft: 'auto' }}>See all</button>
                  </div>
                  <div className="logs-feed">
                    {alerts.slice(0, 4).map(alert => (
                      <div key={alert.docId} className={`log-entry ${alert.severity === 'critical' ? 'critical' : 'warning'}`}>
                        <AlertTriangle size={12} className="log-ico" />
                        <div className="log-text-block">
                          <p style={{ fontWeight: 600 }}>{alert.title}</p>
                          <p>{alert.message}</p>
                          <span>{fmtTime(alert.triggeredAt)}</span>
                        </div>
                      </div>
                    ))}
                    {alerts.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', padding: '0.5rem 0' }}>No alerts. All systems normal.</p>}
                  </div>
                </div>
              </div>
            </section>

            {/* Quick Actions */}
            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
              {[
                { label: 'Register Animal', sub: 'FR-F06', tab: 'animals', color: 'var(--primary)' },
                { label: 'View AI Health', sub: 'FR-F20–F29', tab: 'ai', color: 'var(--secondary)' },
                { label: 'GPS Tracking', sub: 'FR-F30–F33', tab: 'gps', color: '#c084fc' },
                { label: 'Export Report', sub: 'FR-F46', tab: 'reports', color: 'var(--warning)' },
              ].map(({ label, sub, tab, color }) => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)', borderRadius: '12px', padding: '1rem', cursor: 'pointer', textAlign: 'left', transition: '0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = color}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-glass)'}
                >
                  <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#fff', display: 'block' }}>{label}</span>
                  <span style={{ fontSize: '0.68rem', color, marginTop: '0.25rem', display: 'block' }}>{sub}</span>
                </button>
              ))}
            </section>
          </div>
        )}

        {/* ── Other Tabs ────────────────────────────────────── */}
        {activeTab === 'animals' && (
          <AnimalsTab animals={animals} devices={devices} farmerId={userId} />
        )}
        {activeTab === 'monitoring' && (
          <MonitoringTab animals={animals} latestReadings={latestReadings} latestGps={latestGps} devices={devices} />
        )}
        {activeTab === 'ai' && (
          <AIHealthTab animals={animals} latestAI={latestAI} />
        )}
        {activeTab === 'gps' && (
          <GPSTab 
            animals={animals} 
            latestGps={latestGps} 
            geofences={geofences} 
            laptopCoords={laptopCoords}
            geofenceRadius={sysConfig?.geofenceBounds?.radius ?? 200}
          />
        )}
        {activeTab === 'alerts' && (
          <AlertsTab alerts={alerts} />
        )}
        {activeTab === 'reports' && (
          <ReportsTab animals={animals} alerts={alerts} latestReadings={latestReadings} latestAI={latestAI} />
        )}
        {activeTab === 'profile' && (
          <ProfileTab userEmail={userEmail} userId={userId} />
        )}

      </main>
    </div>
  );
}
