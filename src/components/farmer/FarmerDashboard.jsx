// FarmerDashboard.jsx — Main Container
// Combines all tabs with sidebar navigation
// Shared Firestore listeners for all data
import React, { useState, useEffect } from 'react';
import {
  Activity, LogOut, User, LayoutDashboard, PawPrint,
  MonitorCheck, Brain, MapPin, Bell, FileBarChart, UserCircle,
  Thermometer, Heart, Compass, AlertTriangle, CheckCircle2,
  ChevronRight, Map, Search, Filter, Cpu, Camera, Beaker, Stethoscope
} from 'lucide-react';
import {
  collection, query, onSnapshot, orderBy, limit, where, addDoc, Timestamp, doc, setDoc
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
import ActivityRecognitionTab from './ActivityRecognitionTab';
import CVDiseaseTab      from './CVDiseaseTab';
import SimulatorTab      from './SimulatorTab';
import EarlyDetectionTab from './EarlyDetectionTab';

const NAV_ITEMS = [
  { id: 'overview',    label: 'Overview',        Icon: LayoutDashboard },
  { id: 'animals',     label: 'My Animals',       Icon: PawPrint        },
  { id: 'monitoring',  label: 'Live Monitoring',  Icon: MonitorCheck    },
  { id: 'ai',          label: 'AI Health',        Icon: Brain           },
  { id: 'activity_rec',label: 'Activity ML',      Icon: Cpu             },
  { id: 'cv_disease',  label: 'CV Disease ML',    Icon: Camera          },
  { id: 'gps',         label: 'GPS & Geofence',   Icon: MapPin          },
  { id: 'alerts',          label: 'Alerts',           Icon: Bell            },
  { id: 'early_detection', label: 'Early Detection',  Icon: Stethoscope     },
  { id: 'reports',         label: 'Reports',          Icon: FileBarChart    },
  { id: 'simulator',       label: 'Simulator',        Icon: Beaker          },
  { id: 'profile',         label: 'My Profile',       Icon: UserCircle      },
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
  const [tick,           setTick]           = useState(0);

  // ── Data Feeding Mode Switcher (Realtime IoT vs Simulator) ──
  const [dataFeedingMode, setDataFeedingMode] = useState(() => {
    return localStorage.getItem('livetrack_data_mode') || 'realtime';
  });

  const toggleDataFeedingMode = async (newMode) => {
    setDataFeedingMode(newMode);
    localStorage.setItem('livetrack_data_mode', newMode);
    try {
      await setDoc(doc(db, 'system_config', 'global'), {
        dataFeedingMode: newMode
      }, { merge: true });
    } catch (err) {
      console.warn("Could not sync dataFeedingMode to Firestore:", err);
    }
  };

  const dataFeedingModeRef = React.useRef(dataFeedingMode);
  useEffect(() => {
    dataFeedingModeRef.current = dataFeedingMode;
  }, [dataFeedingMode]);

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
    const q = query(collection(db, 'animals', id, 'sensor_readings'), orderBy('timestamp', 'desc'), limit(10));
    onSnapshot(q, s => {
      if (!s.empty) {
        if (dataFeedingModeRef.current === 'simulator') {
          const simDoc = s.docs.find(d => d.data().isSimulated);
          if (simDoc) {
            setLatestReadings(p => ({ ...p, [id]: simDoc.data() }));
          }
        } else {
          setLatestReadings(p => ({ ...p, [id]: s.docs[0].data() }));
        }
      }
    });
  };

  // ── 3. GPS (latest per animal) ──────────────────────────────
  const subscribeGps = (id) => {
    const q = query(collection(db, 'animals', id, 'gps_locations'), orderBy('timestamp', 'desc'), limit(10));
    onSnapshot(q, s => {
      if (!s.empty) {
        if (dataFeedingModeRef.current === 'simulator') {
          const simDoc = s.docs.find(d => d.data().isSimulated);
          if (simDoc) {
            setLatestGps(p => ({ ...p, [id]: simDoc.data() }));
          }
        } else {
          setLatestGps(p => ({ ...p, [id]: s.docs[0].data() }));
        }
      }
    });
  };

  // ── 4. AI predictions (latest per animal) ──────────────────
  const subscribeAI = (id) => {
    const q = query(collection(db, 'animals', id, 'ai_predictions'), orderBy('timestamp', 'desc'), limit(10));
    onSnapshot(q, s => {
      if (!s.empty) {
        if (dataFeedingModeRef.current === 'simulator') {
          const simDoc = s.docs.find(d => d.data().isSimulated);
          if (simDoc) {
            setLatestAI(p => ({ ...p, [id]: simDoc.data() }));
          }
        } else {
          setLatestAI(p => ({ ...p, [id]: s.docs[0].data() }));
        }
      }
    });
  };

  const handleSimulatedUpdate = (animalId, readingPayload, gpsPayload) => {
    setLatestReadings(p => ({ ...p, [animalId]: readingPayload }));
    if (gpsPayload) {
      setLatestGps(p => ({ ...p, [animalId]: gpsPayload }));
    }
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

  // ── 6.5. Realtime Camera CV predictions ──────────────────────
  const [cameraCvData, setCameraCvData] = useState(null);
  useEffect(() => {
    const camRef = ref(rtdb, 'animal_camera/latest');
    return onValue(camRef, snap => {
      if (snap.exists()) setCameraCvData(snap.val());
    });
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

  // ── 7.8. Periodic UI tick for status checks ─────────────────
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 5000);
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

      const isInside = g.isInsideGeofence !== undefined ? g.isInsideGeofence : checkGeofence(lat, lng);
      const pinColor = !isInside
        ? '#ef4444'
        : (a.healthStatus === 'critical' ? '#ef4444' : a.healthStatus === 'at_risk' ? '#f59e0b' : '#10b981');

      const customIcon = window.L.divIcon({
        className: 'custom-leaflet-pin',
        html: `
          <div class="leaflet-animal-pin" style="position: relative;">
            <span class="pin-pulse" style="border: 2px solid ${pinColor}; animation: radar-ping 2s infinite;"></span>
            <span class="pin-center-dot" style="background-color: ${pinColor} !important; border: 2px solid #ffffff; box-shadow: 0 0 10px ${pinColor};"></span>
            <span class="pin-label-pop" style="visibility: visible !important; opacity: 1 !important; transform: translate(-50%, -100%) translateY(-8px) !important; background: rgba(12, 17, 30, 0.95) !important; color: #ffffff !important; border: 1px solid var(--border-glass) !important; font-weight: 700; padding: 3px 8px; border-radius: 6px; white-space: nowrap; box-shadow: 0 4px 12px rgba(0,0,0,0.6); pointer-events: auto;">${a.name}</span>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18]
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
  }, [activeTab, animals, latestGps, tick]);

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

  const anyDeviceOnline = Object.values(latestReadings).some(r => {
    if (!r.timestamp) return false;
    const ts = r.timestamp.toDate ? r.timestamp.toDate() : new Date(r.timestamp);
    return (Date.now() - ts.getTime()) < 15000;
  });

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

        {/* Page Header with Data Feeding Mode Switcher */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
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
              {activeTab === 'simulator'  && 'Module 6 — Test all AI health, activity & geofence scenarios without hardware'}
            </p>
          </div>

          {/* Mode Switcher Toggle Widget */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            background: 'rgba(10, 14, 30, 0.95)', border: '1px solid var(--border-glass)',
            borderRadius: '30px', padding: '4px 6px', boxShadow: '0 4px 14px rgba(0,0,0,0.4)'
          }}>
            <button
              onClick={() => toggleDataFeedingMode('realtime')}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '6px 14px', borderRadius: '20px', border: 'none',
                fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
                background: dataFeedingMode === 'realtime' ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                color: dataFeedingMode === 'realtime' ? 'var(--primary)' : 'var(--text-muted)',
                boxShadow: dataFeedingMode === 'realtime' ? '0 0 10px rgba(16, 185, 129, 0.3)' : 'none',
                border: dataFeedingMode === 'realtime' ? '1px solid var(--primary)' : '1px solid transparent'
              }}
            >
              <span style={{
                width: '8px', height: '8px', borderRadius: '50%',
                background: dataFeedingMode === 'realtime' ? 'var(--primary)' : '#64748b',
                boxShadow: dataFeedingMode === 'realtime' ? '0 0 8px var(--primary)' : 'none'
              }} />
              🟢 Real-time IoT Mode
            </button>

            <button
              onClick={() => toggleDataFeedingMode('simulator')}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '6px 14px', borderRadius: '20px', border: 'none',
                fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
                background: dataFeedingMode === 'simulator' ? 'rgba(168, 85, 247, 0.2)' : 'transparent',
                color: dataFeedingMode === 'simulator' ? '#c084fc' : 'var(--text-muted)',
                boxShadow: dataFeedingMode === 'simulator' ? '0 0 10px rgba(168, 85, 247, 0.3)' : 'none',
                border: dataFeedingMode === 'simulator' ? '1px solid #c084fc' : '1px solid transparent'
              }}
            >
              <span style={{
                width: '8px', height: '8px', borderRadius: '50%',
                background: dataFeedingMode === 'simulator' ? '#c084fc' : '#64748b',
                boxShadow: dataFeedingMode === 'simulator' ? '0 0 8px #c084fc' : 'none'
              }} />
              🧪 Simulator Mode
            </button>
          </div>
        </div>

        {/* Mode Notification Banner when Simulator Mode Active */}
        {dataFeedingMode === 'simulator' && (
          <div style={{
            background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.3)',
            borderRadius: '12px', padding: '0.75rem 1.25rem', marginBottom: '1.5rem',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            fontSize: '0.82rem', color: '#e9d5ff', flexWrap: 'wrap', gap: '0.75rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Beaker size={18} color="#c084fc" />
              <span>
                <strong>🧪 SIMULATOR DATA FEEDING MODE ACTIVE:</strong> System is operating in test mode. Simulated test scenarios injected from the Simulator tab will feed all AI models &amp; dashboards.
              </span>
            </div>
            <button
              onClick={() => toggleDataFeedingMode('realtime')}
              style={{
                background: 'rgba(16, 185, 129, 0.2)', border: '1px solid var(--primary)',
                color: 'var(--primary)', padding: '5px 12px', borderRadius: '8px',
                fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer'
              }}
            >
              Switch to Real-time IoT Mode →
            </button>
          </div>
        )}

        {/* Real-time AI Camera Stream Detection Banner */}
        {cameraCvData && cameraCvData.prediction && cameraCvData.prediction.toLowerCase() !== 'healthy' && (
          <div style={{
            background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.4)',
            borderRadius: '12px', padding: '0.75rem 1.25rem', marginBottom: '1.5rem',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            fontSize: '0.82rem', color: '#fef3c7', flexWrap: 'wrap', gap: '0.75rem',
            animation: 'fadeIn 0.3s ease'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Camera size={18} color="var(--warning)" />
              <span>
                <strong>📹 LIVE AI CAMERA DETECTION:</strong> Camera CV model detected <strong style={{ color: 'var(--warning)', textTransform: 'uppercase' }}>{cameraCvData.prediction}</strong> for <strong>Daisy (MAC: 28:05:A5:07:3B:94)</strong> with <strong>{(cameraCvData.confidence_percent || cameraCvData.confidence * 100 || 0).toFixed(1)}% confidence</strong>!
              </span>
            </div>
            <button
              onClick={() => setActiveTab('cv_disease')}
              style={{
                background: 'rgba(245, 158, 11, 0.2)', border: '1px solid var(--warning)',
                color: 'var(--warning)', padding: '5px 12px', borderRadius: '8px',
                fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer'
              }}
            >
              View Realtime Camera CV →
            </button>
          </div>
        )}

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
                    {anyDeviceOnline ? (
                      <span className="status-indicator-badge positive">Live</span>
                    ) : (
                      <span className="status-indicator-badge" style={{ color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>Offline</span>
                    )}
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
                    const isOnline = r.timestamp && (Date.now() - (r.timestamp.toDate ? r.timestamp.toDate() : new Date(r.timestamp)).getTime()) < 15000;
                    return (
                      <div key={a.docId} className="inventory-item" onClick={() => setActiveTab('monitoring')} style={{ cursor: 'pointer' }}>
                        <div className="item-left">
                          <div className={`health-indicator-border ${hClass(a.healthStatus)}`}></div>
                          <div className="item-title-block">
                            <h6 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                              {a.name}
                              {!isOnline && r.timestamp && (
                                <span style={{ fontSize: '0.58rem', color: 'var(--danger)', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', padding: '1px 3px', borderRadius: '3px' }}>Offline</span>
                              )}
                            </h6>
                            <span>{a.tagNumber} • {a.species}</span>
                            {!isOnline && r.timestamp && (
                              <span style={{ fontSize: '0.62rem', color: 'var(--text-dark)', display: 'block', marginTop: '0.15rem' }}>Last seen: {fmtTime(r.timestamp)}</span>
                            )}
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
                { label: 'Activity ML', sub: 'FR-F20–F29', tab: 'activity_rec', color: 'var(--secondary)' },
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
          <AIHealthTab animals={animals} latestAI={latestAI} latestReadings={latestReadings} alerts={alerts} />
        )}
        {activeTab === 'activity_rec' && (
          <ActivityRecognitionTab animals={animals} latestReadings={latestReadings} />
        )}
        {activeTab === 'cv_disease' && (
          <CVDiseaseTab animals={animals} devices={devices} />
        )}
        {activeTab === 'gps' && (
          <GPSTab 
            animals={animals} 
            latestGps={latestGps} 
            geofences={geofences} 
            laptopCoords={laptopCoords}
            geofenceRadius={sysConfig?.geofenceBounds?.radius ?? 200}
            tick={tick}
          />
        )}
        {activeTab === 'alerts' && (
          <AlertsTab alerts={alerts} />
        )}
        {activeTab === 'reports' && (
          <ReportsTab animals={animals} alerts={alerts} latestReadings={latestReadings} latestAI={latestAI} />
        )}
        {activeTab === 'early_detection' && (
          <EarlyDetectionTab animals={animals} latestReadings={latestReadings} alerts={alerts} />
        )}
        {activeTab === 'profile' && (
          <ProfileTab userEmail={userEmail} userId={userId} />
        )}
        {activeTab === 'simulator' && (
          <SimulatorTab 
            animals={animals} 
            devices={devices} 
            dataFeedingMode={dataFeedingMode}
            toggleDataFeedingMode={toggleDataFeedingMode}
            onSimulatedUpdate={handleSimulatedUpdate}
          />
        )}

      </main>
    </div>
  );
}
