// SimulatorTab.jsx — Module 6: Telemetry & AI Health Status Simulator
// Simulates sensor telemetry for all AI Health Risk, Activity ML, Early Disease & Geofence statuses.
import React, { useState, useEffect } from 'react';
import { 
  Beaker, Thermometer, Heart, Activity, MapPin, 
  AlertTriangle, Play, Sliders, Send, CheckCircle2, 
  Zap, Moon, Footprints, ChevronDown, ChevronUp, RefreshCw,
  Shield, Brain, Stethoscope, Compass
} from 'lucide-react';
import { ref, set } from 'firebase/database';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db, rtdb } from '../../firebase';

const SCENARIO_CATEGORIES = [
  { id: 'all', label: 'All Scenarios', icon: '🧪' },
  { id: 'healthy', label: '🟢 Healthy Baselines', icon: '🟢' },
  { id: 'infection', label: '🫁 Respiratory & Infection', icon: '🫁' },
  { id: 'lameness', label: '🦶 Lameness & Hoof', icon: '🦶' },
  { id: 'metabolic', label: '🧪 Metabolic & Climate', icon: '🧪' },
  { id: 'distress', label: '🚨 Panic & Distress', icon: '🚨' },
  { id: 'geofence', label: '⚠️ Geofence & Escape', icon: '⚠️' },
];

const SCENARIOS = [
  // ── 🟢 Healthy Baselines ──────────────────────────────────────────────────
  {
    id: 'healthy_resting',
    category: 'healthy',
    name: 'Healthy Resting',
    diseaseTarget: 'Normal Baseline',
    icon: <Moon size={20} />,
    description: 'Normal vitals at rest. Baseline temperature and pulse.',
    severity: 'success',
    data: {
      temperature: 38.5,
      heartRate: 65,
      activityLevel: 'resting',
      accelerometer: { x: 0, y: -500, z: 16384 },
      gps: { latitude: 7.2906, longitude: 80.6337 }
    }
  },
  {
    id: 'walking_grazing',
    category: 'healthy',
    name: 'Active Grazing & Walking',
    diseaseTarget: 'Normal Active',
    icon: <Footprints size={20} />,
    description: 'Active healthy cow grazing peacefully in pasture.',
    severity: 'success',
    data: {
      temperature: 38.8,
      heartRate: 78,
      activityLevel: 'walking',
      accelerometer: { x: 3200, y: -8000, z: 14000 },
      gps: { latitude: 7.2910, longitude: 80.6340 }
    }
  },
  {
    id: 'healthy_running',
    category: 'healthy',
    name: 'Healthy Running',
    diseaseTarget: 'Normal Exercise',
    icon: <Zap size={20} />,
    description: 'High physical movement during herd movement.',
    severity: 'success',
    data: {
      temperature: 39.2,
      heartRate: 95,
      activityLevel: 'running',
      accelerometer: { x: 12000, y: -15000, z: 28000 },
      gps: { latitude: 7.2920, longitude: 80.6350 }
    }
  },
  {
    id: 'deep_sleep',
    category: 'healthy',
    name: 'Deep Sleep',
    diseaseTarget: 'Low Rest Baseline',
    icon: <Moon size={20} />,
    description: 'Lowest activity and resting heart rate.',
    severity: 'success',
    data: {
      temperature: 38.2,
      heartRate: 55,
      activityLevel: 'sleeping',
      accelerometer: { x: 0, y: 0, z: 16384 },
      gps: { latitude: 7.2906, longitude: 80.6337 }
    }
  },

  // ── 🫁 Infections & Respiratory ─────────────────────────────────────────
  {
    id: 'brd_respiratory',
    category: 'infection',
    name: 'Bovine Respiratory Disease (BRD)',
    diseaseTarget: 'Module 2 & 4 AI Alert',
    icon: <Stethoscope size={20} />,
    description: 'High fever (39.9°C), elevated HR (105 BPM) and lethargy.',
    severity: 'danger',
    data: {
      temperature: 39.9,
      heartRate: 105,
      activityLevel: 'resting',
      accelerometer: { x: 100, y: -300, z: 16000 },
      gps: { latitude: 7.2906, longitude: 80.6337 }
    }
  },
  {
    id: 'fever_infection',
    category: 'infection',
    name: 'Severe Fever / Mastitis',
    diseaseTarget: 'Module 2 & 4 AI Alert',
    icon: <Thermometer size={20} />,
    description: 'Critical high fever (40.8°C) + severe tachycardia (118 BPM).',
    severity: 'danger',
    data: {
      temperature: 40.8,
      heartRate: 118,
      activityLevel: 'resting',
      accelerometer: { x: 100, y: -300, z: 16000 },
      gps: { latitude: 7.2906, longitude: 80.6337 }
    }
  },
  {
    id: 'systemic_infection',
    category: 'infection',
    name: 'General Systemic Infection',
    diseaseTarget: 'Module 2 Health Risk',
    icon: <AlertTriangle size={20} />,
    description: 'Elevated temperature (40.2°C) with standing posture.',
    severity: 'warning',
    data: {
      temperature: 40.2,
      heartRate: 112,
      activityLevel: 'standing',
      accelerometer: { x: 500, y: -1000, z: 16000 },
      gps: { latitude: 7.2906, longitude: 80.6337 }
    }
  },

  // ── 🦶 Lameness & Hoof ───────────────────────────────────────────────────
  {
    id: 'lameness_fmd',
    category: 'lameness',
    name: 'Lameness / Foot-and-Mouth (FMD)',
    diseaseTarget: 'Module 4 AI Alert',
    icon: <Activity size={20} />,
    description: 'Fever (39.6°C) with near-zero movement & asymmetrical gait.',
    severity: 'warning',
    data: {
      temperature: 39.6,
      heartRate: 92,
      activityLevel: 'standing',
      accelerometer: { x: 150, y: -200, z: 16100 },
      gps: { latitude: 7.2906, longitude: 80.6337 }
    }
  },
  {
    id: 'prolonged_inactivity',
    category: 'lameness',
    name: 'Prolonged Inactivity / Recumbency',
    diseaseTarget: 'FR-F37 Alert',
    icon: <Moon size={20} />,
    description: 'Unable to rise or walk for >2 hours. Low step count.',
    severity: 'warning',
    data: {
      temperature: 38.6,
      heartRate: 62,
      activityLevel: 'resting',
      accelerometer: { x: 0, y: 0, z: 16384 },
      gps: { latitude: 7.2906, longitude: 80.6337 }
    }
  },

  // ── 🧪 Metabolic & Climate ──────────────────────────────────────────────
  {
    id: 'milk_fever',
    category: 'metabolic',
    name: 'Milk Fever (Hypocalcemia)',
    diseaseTarget: 'Module 4 Metabolic Alert',
    icon: <Thermometer size={20} />,
    description: 'Subnormal body temperature (37.2°C) + elevated HR (92 BPM).',
    severity: 'warning',
    data: {
      temperature: 37.2,
      heartRate: 92,
      activityLevel: 'resting',
      accelerometer: { x: 50, y: -100, z: 16200 },
      gps: { latitude: 7.2906, longitude: 80.6337 }
    }
  },
  {
    id: 'ketosis',
    category: 'metabolic',
    name: 'Ketosis / Energy Deficiency',
    diseaseTarget: 'Module 4 Metabolic Alert',
    icon: <Activity size={20} />,
    description: 'Subnormal temperature (37.4°C) with weakness & lethargy.',
    severity: 'warning',
    data: {
      temperature: 37.4,
      heartRate: 88,
      activityLevel: 'resting',
      accelerometer: { x: 80, y: -150, z: 16250 },
      gps: { latitude: 7.2906, longitude: 80.6337 }
    }
  },
  {
    id: 'heat_stress',
    category: 'metabolic',
    name: 'Severe Heat Stress',
    diseaseTarget: 'Module 4 Heat Stress',
    icon: <Thermometer size={20} />,
    description: 'High body temperature (40.3°C) + rapid panting (108 BPM).',
    severity: 'danger',
    data: {
      temperature: 40.3,
      heartRate: 108,
      activityLevel: 'resting',
      accelerometer: { x: 200, y: -400, z: 16000 },
      gps: { latitude: 7.2906, longitude: 80.6337 }
    }
  },

  // ── 🚨 Panic & Distress ──────────────────────────────────────────────────
  {
    id: 'predator_attack',
    category: 'distress',
    name: 'Predator Attack / Severe Panic',
    diseaseTarget: 'FR-F40 Distress Alert',
    icon: <AlertTriangle size={20} />,
    description: 'Extreme tachycardia (138 BPM) + violent erratic motion.',
    severity: 'danger',
    data: {
      temperature: 39.7,
      heartRate: 138,
      activityLevel: 'abnormal movement',
      accelerometer: { x: 15000, y: -18000, z: 32000 },
      gps: { latitude: 7.2908, longitude: 80.6339 }
    }
  },
  {
    id: 'tachycardia',
    category: 'distress',
    name: 'Tachycardia / Cardiac Pain',
    diseaseTarget: 'FR-F40 Alert',
    icon: <Heart size={20} />,
    description: 'Dangerously high heart rate (130 BPM) with restlessness.',
    severity: 'danger',
    data: {
      temperature: 39.5,
      heartRate: 130,
      activityLevel: 'standing',
      accelerometer: { x: 500, y: -1000, z: 16000 },
      gps: { latitude: 7.2906, longitude: 80.6337 }
    }
  },

  // ── ⚠️ Geofence & Escape ────────────────────────────────────────────────
  {
    id: 'geofence_breach',
    category: 'geofence',
    name: 'Geofence Breach / Escaped Animal',
    diseaseTarget: 'FR-F38 Geofence Alert',
    icon: <MapPin size={20} />,
    description: 'Animal moved far outside pasture fence boundary.',
    severity: 'danger',
    data: {
      temperature: 38.9,
      heartRate: 88,
      activityLevel: 'walking',
      accelerometer: { x: 5000, y: -7000, z: 15000 },
      gps: { latitude: 7.3100, longitude: 80.6500 }
    }
  }
];

export default function SimulatorTab({ 
  animals = [], 
  devices = [],
  dataFeedingMode = 'realtime',
  toggleDataFeedingMode = () => {},
  onSimulatedUpdate = null
}) {
  const [selectedAnimal, setSelectedAnimal] = useState(animals[0] || null);
  const [activeCategory, setActiveCategory] = useState('all');
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState(null);
  const [lastSent, setLastSent] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Custom values state
  const [customTemp, setCustomTemp] = useState(38.5);
  const [customHR, setCustomHR] = useState(65);
  const [customActivity, setCustomActivity] = useState('resting');
  const [customLat, setCustomLat] = useState(7.2906);
  const [customLng, setCustomLng] = useState(80.6337);

  useEffect(() => {
    if (animals.length > 0 && !selectedAnimal) {
      setSelectedAnimal(animals[0]);
    }
  }, [animals, selectedAnimal]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const getMacAddress = (animal) => {
    if (!animal) return null;
    const deviceDoc = devices.find(d => d.deviceId === animal.deviceId);
    return deviceDoc?.macAddress?.toUpperCase()?.trim() || animal.deviceId;
  };

  const sendData = async (scenarioName, payload) => {
    if (!selectedAnimal) {
      showToast('Please select an animal first', 'error');
      return;
    }

    // Ensure system is in Simulator Mode when executing a simulation scenario
    if (dataFeedingMode !== 'simulator') {
      toggleDataFeedingMode('simulator');
    }

    const mac = getMacAddress(selectedAnimal);
    if (!mac) {
      showToast('No valid MAC/Device ID found for this animal', 'error');
      return;
    }

    setSending(true);
    
    const timestampStr = new Date().toISOString();
    const dataToWrite = {
      ...payload,
      timestamp: timestampStr,
      isSimulated: true
    };

    const readingPayload = {
      bodyTemperature: payload.temperature,
      heartRate: payload.heartRate,
      activityLevel: payload.activityLevel,
      accelerometerX: payload.accelerometer?.x || 0,
      accelerometerY: payload.accelerometer?.y || 0,
      accelerometerZ: payload.accelerometer?.z || 16384,
      timestamp: Timestamp.now(),
      isSimulated: true,
      isRealHeartRate: false
    };

    const gpsPayload = {
      latitude: payload.gps?.latitude || 7.2906,
      longitude: payload.gps?.longitude || 80.6337,
      timestamp: Timestamp.now(),
      isSimulated: true
    };

    try {
      // 1. Write to Realtime Database (with graceful catch for security rules)
      try {
        const latestRef = ref(rtdb, `livestock/${mac}/latest`);
        await set(latestRef, dataToWrite);
      } catch (rtdbErr) {
        console.warn("[SimulatorTab] Realtime Database permission warning:", rtdbErr.message);
      }

      // 2. Write to Firestore subcollections with isSimulated: true
      try {
        await addDoc(collection(db, 'animals', selectedAnimal.docId, 'sensor_readings'), readingPayload);

        if (payload.gps?.latitude && payload.gps?.longitude) {
          await addDoc(collection(db, 'animals', selectedAnimal.docId, 'gps_locations'), gpsPayload);
        }
      } catch (fsErr) {
        console.warn("[SimulatorTab] Firestore permission warning:", fsErr.message);
      }

      // 3. Directly update parent dashboard state instantly
      if (onSimulatedUpdate) {
        onSimulatedUpdate(selectedAnimal.docId, readingPayload, gpsPayload);
      }
      
      setLastSent({
        scenario: scenarioName,
        time: new Date().toLocaleTimeString(),
        animalName: selectedAnimal.name
      });
      showToast(`Successfully injected test scenario: ${scenarioName}`);
    } catch (error) {
      console.error("Simulation error:", error);
      showToast(`Error sending data: ${error.message}`, 'error');
    } finally {
      setSending(false);
    }
  };

  const handleCustomSend = () => {
    const payload = {
      temperature: parseFloat(customTemp),
      heartRate: parseInt(customHR, 10),
      activityLevel: customActivity,
      accelerometer: { x: 0, y: 0, z: 16384 },
      gps: { latitude: parseFloat(customLat), longitude: parseFloat(customLng) }
    };
    sendData('Custom Manual Telemetry', payload);
  };

  const getSeverityColor = (severity) => {
    switch(severity) {
      case 'success': return 'var(--primary)';
      case 'warning': return 'var(--warning)';
      case 'danger': return 'var(--danger)';
      default: return '#fff';
    }
  };

  const filteredScenarios = activeCategory === 'all'
    ? SCENARIOS
    : SCENARIOS.filter(s => s.category === activeCategory);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed', top: '20px', right: '20px', padding: '12px 24px',
          borderRadius: '8px',
          backgroundColor: toast.type === 'success' ? 'rgba(16, 185, 129, 0.95)' : 'rgba(239, 68, 68, 0.95)',
          color: '#fff', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center',
          gap: '8px', zIndex: 1000, boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
          animation: 'fadeIn 0.3s ease'
        }}>
          {toast.type === 'success' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
          <span style={{ fontWeight: 600 }}>{toast.message}</span>
        </div>
      )}

      {/* Top Banner */}
      <div className="map-card-wrapper" style={{ padding: '24px', borderRadius: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '8px' }}>
          <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
            <Beaker size={28} color="var(--primary)" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.4rem', fontFamily: 'var(--font-heading)', color: '#fff' }}>
              Livestock AI Health & Sensor Telemetry Simulator
            </h2>
            <p style={{ margin: '0.2rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Simulate sensor telemetry for all 15+ AI health statuses (BRD, Mastitis, Lameness, Milk Fever, Heat Stress, Panic &amp; Geofence Escapes).
            </p>
          </div>
        </div>
      </div>

      {/* 1. Animal Selector */}
      <div>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '1.05rem', color: '#fff', fontFamily: 'var(--font-heading)' }}>
          1. Select Target Animal
        </h3>
        {animals.length === 0 ? (
          <div style={{ padding: '16px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', color: 'var(--text-muted)' }}>
            No animals available.
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px' }}>
            {animals.map(animal => (
              <div 
                key={animal.docId}
                onClick={() => setSelectedAnimal(animal)}
                style={{
                  padding: '12px 20px', borderRadius: '12px',
                  background: selectedAnimal?.docId === animal.docId ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                  border: `1px solid ${selectedAnimal?.docId === animal.docId ? 'var(--primary)' : 'var(--border-glass)'}`,
                  cursor: 'pointer', minWidth: '160px', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '12px'
                }}
              >
                <div style={{
                  width: '34px', height: '34px', borderRadius: '50%', background: '#333',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden'
                }}>
                  {animal.imageUrl ? (
                    <img src={animal.imageUrl} alt={animal.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: '1.2rem' }}>🐄</span>
                  )}
                </div>
                <div>
                  <div style={{ color: '#fff', fontWeight: '700', fontSize: '0.9rem' }}>{animal.name}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{animal.tagNumber || animal.species || 'Cattle'}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. Category Filter Tabs */}
      <div>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '1.05rem', color: '#fff', fontFamily: 'var(--font-heading)' }}>
          2. Filter Scenario Category
        </h3>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
          {SCENARIO_CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              style={{
                padding: '8px 16px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600,
                background: activeCategory === cat.id ? 'var(--primary)' : 'rgba(255,255,255,0.04)',
                color: activeCategory === cat.id ? '#000' : 'var(--text-muted)',
                border: `1px solid ${activeCategory === cat.id ? 'var(--primary)' : 'var(--border-glass)'}`,
                cursor: 'pointer', transition: 'all 0.2s'
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Scenarios Grid */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', 
          gap: '16px' 
        }}>
          {filteredScenarios.map(scenario => (
            <div 
              key={scenario.id}
              className="map-card-wrapper"
              onClick={() => sendData(scenario.name, scenario.data)}
              style={{ 
                padding: '16px', borderRadius: '12px', cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
                border: '1px solid var(--border-glass)', position: 'relative', overflow: 'hidden'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.borderColor = getSeverityColor(scenario.severity);
                e.currentTarget.style.boxShadow = `0 4px 12px ${getSeverityColor(scenario.severity)}20`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.borderColor = 'var(--border-glass)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ color: getSeverityColor(scenario.severity) }}>
                    {scenario.icon}
                  </div>
                  <div>
                    <h4 style={{ margin: 0, color: '#fff', fontSize: '0.95rem', fontWeight: 700 }}>{scenario.name}</h4>
                    <span style={{ fontSize: '0.65rem', color: getSeverityColor(scenario.severity), textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>
                      {scenario.diseaseTarget}
                    </span>
                  </div>
                </div>
                <div style={{ 
                  width: '8px', height: '8px', borderRadius: '50%', 
                  backgroundColor: getSeverityColor(scenario.severity),
                  boxShadow: `0 0 8px ${getSeverityColor(scenario.severity)}`
                }} />
              </div>
              
              <p style={{ margin: '8px 0 14px 0', color: 'var(--text-muted)', fontSize: '0.8rem', lineHeight: 1.4 }}>
                {scenario.description}
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.8rem' }}>
                <div style={{ background: 'rgba(255,255,255,0.04)', padding: '6px 8px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Thermometer size={14} color={scenario.data.temperature > 39.5 ? '#ef4444' : scenario.data.temperature < 37.5 ? '#f59e0b' : 'var(--primary)'} />
                  <span style={{ color: '#fff', fontWeight: 600 }}>{scenario.data.temperature}°C</span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.04)', padding: '6px 8px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Heart size={14} color={scenario.data.heartRate > 100 ? '#ef4444' : 'var(--primary)'} />
                  <span style={{ color: '#fff', fontWeight: 600 }}>{scenario.data.heartRate} bpm</span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.04)', padding: '6px 8px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '6px', gridColumn: 'span 2' }}>
                  <Activity size={14} color="var(--primary)" />
                  <span style={{ color: '#fff', textTransform: 'capitalize', fontWeight: 500 }}>{scenario.data.activityLevel}</span>
                </div>
              </div>

              {sending && (
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                  background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10
                }}>
                  <Zap className="spin-animation" color="var(--primary)" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Advanced Custom Values */}
      <div className="map-card-wrapper" style={{ borderRadius: '12px', overflow: 'hidden' }}>
        <div 
          onClick={() => setShowAdvanced(!showAdvanced)}
          style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', background: 'rgba(255,255,255,0.02)' }}
        >
          <Sliders size={20} color="var(--text-muted)" />
          <h3 style={{ margin: 0, fontSize: '1rem', color: '#fff', flex: 1 }}>Advanced: Custom Manual Telemetry Sliders</h3>
          {showAdvanced ? <ChevronUp size={20} color="var(--text-muted)"/> : <ChevronDown size={20} color="var(--text-muted)"/>}
        </div>
        
        {showAdvanced && (
          <div style={{ padding: '20px', borderTop: '1px solid var(--border-glass)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Body Temperature: <strong style={{ color: '#fff' }}>{customTemp}°C</strong>
                </label>
                <input 
                  type="range" min="35" max="42" step="0.1" 
                  value={customTemp} onChange={(e) => setCustomTemp(e.target.value)}
                  style={{ width: '100%', accentColor: 'var(--primary)' }}
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Heart Rate: <strong style={{ color: '#fff' }}>{customHR} bpm</strong>
                </label>
                <input 
                  type="range" min="40" max="160" step="1" 
                  value={customHR} onChange={(e) => setCustomHR(e.target.value)}
                  style={{ width: '100%', accentColor: 'var(--primary)' }}
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Activity Level
                </label>
                <select 
                  value={customActivity} onChange={(e) => setCustomActivity(e.target.value)}
                  style={{ 
                    width: '100%', padding: '8px', borderRadius: '8px', 
                    background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid var(--border-glass)' 
                  }}
                >
                  <option value="sleeping">Sleeping</option>
                  <option value="resting">Resting</option>
                  <option value="standing">Standing</option>
                  <option value="walking">Walking</option>
                  <option value="running">Running</option>
                  <option value="abnormal movement">Abnormal Movement</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  GPS Latitude
                </label>
                <input 
                  type="number" step="0.0001" 
                  value={customLat} onChange={(e) => setCustomLat(e.target.value)}
                  style={{ 
                    width: '100%', padding: '8px', borderRadius: '8px', 
                    background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid var(--border-glass)',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  GPS Longitude
                </label>
                <input 
                  type="number" step="0.0001" 
                  value={customLng} onChange={(e) => setCustomLng(e.target.value)}
                  style={{ 
                    width: '100%', padding: '8px', borderRadius: '8px', 
                    background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid var(--border-glass)',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            <button 
              onClick={handleCustomSend}
              disabled={sending || !selectedAnimal}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '10px 20px', borderRadius: '8px',
                background: 'var(--primary)', color: '#000', fontWeight: 'bold',
                border: 'none', cursor: (sending || !selectedAnimal) ? 'not-allowed' : 'pointer',
                opacity: (sending || !selectedAnimal) ? 0.6 : 1
              }}
            >
              <Send size={18} />
              Send Custom Telemetry
            </button>
          </div>
        )}
      </div>

      {/* Live Status Bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '16px',
        padding: '12px 16px', borderRadius: '12px',
        background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)',
        fontSize: '0.88rem', color: 'var(--text-muted)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ 
            width: '10px', height: '10px', borderRadius: '50%', 
            background: 'var(--primary)', boxShadow: '0 0 8px var(--primary)'
          }} />
          <span>Connected to RTDB</span>
        </div>
        <div style={{ width: '1px', height: '20px', background: 'var(--border-glass)' }} />
        {lastSent ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#fff' }}>Last Sent:</span>
            <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{lastSent.scenario}</span>
            <span>to {lastSent.animalName}</span>
            <span>at {lastSent.time}</span>
          </div>
        ) : (
          <div>Waiting for simulation trigger...</div>
        )}
      </div>

      <style jsx="true">{`
        .spin-animation {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          100% { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
