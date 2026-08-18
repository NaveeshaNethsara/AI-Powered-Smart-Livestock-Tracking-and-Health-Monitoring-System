// EarlyDetectionTab.jsx — Module 4: LSTM Autoencoder Early Disease Detection
// Real-time anomaly detection using rolling sensor windows.
// Detects: BRD, Lameness/FMD, Mastitis, Metabolic Disorders, Heat Stress, Distress
import React, { useState, useEffect, useRef, useCallback } from 'react';
import ECGHeartPulse from './ECGHeartPulse';
import {
  Stethoscope, AlertTriangle, CheckCircle2, Activity,
  Thermometer, Heart, Zap, RefreshCw, TrendingUp, TrendingDown,
  Shield, Brain, Clock, ChevronDown, ChevronUp, Info
} from 'lucide-react';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';

// ─── Disease colour mapping ────────────────────────────────────────────────────
const DISEASE_COLORS = {
  normal:   'var(--primary)',
  warning:  'var(--warning)',
  critical: 'var(--danger)',
};

const DISEASE_ICONS = {
  'Bovine Respiratory Disease (BRD)':              '🫁',
  'Severe Fever / Mastitis':                       '🤒',
  'Lameness / Foot-and-Mouth Disease (FMD)':       '🦶',
  'Metabolic Disorder (Milk Fever / Ketosis)':     '🧪',
  'Heat Stress':                                   '🌡️',
  'Predator Attack / Severe Distress':             '🚨',
  'General Infection / Early Fever':               '🦠',
  'Stress / Pain Response':                        '😰',
  'Abnormal Pattern Detected':                     '⚠️',
  'Normal':                                        '✅',
};

// ─── Sparkline mini-chart ──────────────────────────────────────────────────────
function Sparkline({ data, color = 'var(--primary)', height = 40, threshold = null }) {
  if (!data || data.length < 2) return null;
  const max   = Math.max(...data, threshold || 0) * 1.15;
  const min   = 0;
  const range = max - min || 1;
  const w     = 160;
  const h     = height;
  const pts   = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(' ');

  const thresholdY = threshold != null
    ? h - ((threshold - min) / range) * h
    : null;

  return (
    <svg width={w} height={h} style={{ overflow: 'visible' }}>
      {thresholdY != null && (
        <line x1={0} y1={thresholdY} x2={w} y2={thresholdY}
          stroke="var(--danger)" strokeWidth={1} strokeDasharray="4 3" opacity={0.7} />
      )}
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2}
        strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={(data.length - 1) / (data.length - 1) * w}
        cy={h - ((data[data.length - 1] - min) / range) * h}
        r={3} fill={color} />
    </svg>
  );
}

// ─── Anomaly score gauge ───────────────────────────────────────────────────────
function AnomalyGauge({ score = 0, isAnomaly = false }) {
  const capped     = Math.min(100, Math.max(0, score));
  const color      = capped > 70 ? 'var(--danger)' : capped > 40 ? 'var(--warning)' : 'var(--primary)';
  const radius     = 36;
  const circ       = 2 * Math.PI * radius;
  const dashOffset = circ - (capped / 100) * circ;

  return (
    <div style={{ position: 'relative', width: 90, height: 90, flexShrink: 0 }}>
      <svg width={90} height={90} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={45} cy={45} r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={8} />
        <circle cx={45} cy={45} r={radius} fill="none" stroke={color} strokeWidth={8}
          strokeDasharray={circ} strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.4s ease' }}
          strokeLinecap="round" />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center'
      }}>
        <span style={{ fontSize: '1.1rem', fontWeight: 800, color, fontFamily: 'var(--font-heading)' }}>
          {capped}
        </span>
        <span style={{ fontSize: '0.55rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {isAnomaly ? 'RISK' : 'SCORE'}
        </span>
      </div>
    </div>
  );
}

// ─── Feature error bar ─────────────────────────────────────────────────────────
function FeatureErrorBar({ label, value, maxVal }) {
  const pct   = Math.min(100, (value / (maxVal || 1)) * 100);
  const color = pct > 70 ? 'var(--danger)' : pct > 40 ? 'var(--warning)' : 'var(--primary)';
  return (
    <div style={{ marginBottom: '0.4rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem',
        color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
        <span>{label}</span>
        <span style={{ color }}>{(value * 1000).toFixed(2)}</span>
      </div>
      <div style={{ height: 4, borderRadius: 4, background: 'rgba(255,255,255,0.06)' }}>
        <div style={{ height: '100%', borderRadius: 4, background: color, width: `${pct}%`,
          transition: 'width 0.5s ease' }} />
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function EarlyDetectionTab({ animals = [], latestReadings = {}, alerts = [] }) {
  const [detectionResults, setDetectionResults]   = useState({});   // { animalId: result }
  const [errorHistory, setErrorHistory]           = useState({});   // { animalId: [errors] }
  const [loadingStates, setLoadingStates]         = useState({});
  const [lastUpdated, setLastUpdated]             = useState({});
  const [expandedCard, setExpandedCard]           = useState(null);
  const [modelReady, setModelReady]               = useState(null);  // null=unknown, true, false
  const [pollingActive, setPollingActive]         = useState(true);

  const firedAlertsRef  = useRef({});
  const lastFetchRef    = useRef({});

  // ── Convert latestReadings to anomaly window payload ──────────────────────
  const buildWindowReading = useCallback((animalId) => {
    const r = latestReadings[animalId];
    if (!r) return null;

    const activityMap = {
      sleeping: 10, resting: 20, standing: 35,
      walking: 60, running: 90, 'abnormal movement': 80
    };
    const actScore = activityMap[(r.activityLevel || 'resting').toLowerCase()] || 20;
    const accMag   = Math.sqrt(
      (r.accelerometerX || 0) ** 2 +
      (r.accelerometerY || 0) ** 2 +
      (r.accelerometerZ || 0) ** 2
    );

    const rawTemp = r.bodyTemperature ?? 38.5;
    const normTemp = rawTemp < 35.0 ? 38.5 : rawTemp;

    return {
      temperature:   normTemp,
      heartRate:     r.heartRate ?? 65,
      accMagnitude:  parseFloat(accMag.toFixed(4)) || 1.05,
      activityScore: actScore,
      gpsSpeed:      r.activityLevel === 'walking' ? 0.8 : r.activityLevel === 'running' ? 2.5 : 0.0,
      isSimulated:   !!r.isSimulated
    };
  }, [latestReadings]);

  // ── Fetch anomaly detection for one animal ────────────────────────────────
  const detectAnomaly = useCallback(async (animal) => {
    const id      = animal.docId;
    const reading = buildWindowReading(id);
    if (!reading) return;

    // Debounce: only refetch if reading actually changed
    const key = `${reading.temperature}_${reading.heartRate}_${reading.accMagnitude}_${reading.isSimulated}`;
    if (lastFetchRef.current[id] === key) return;
    lastFetchRef.current[id] = key;

    setLoadingStates(prev => ({ ...prev, [id]: true }));
    try {
      const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
      const resp = await fetch(`${API_BASE_URL}/api/detect-anomaly`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ animalId: id, window: [reading], isSimulated: reading.isSimulated }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();

      if (data.notReady) {
        setModelReady(false);
        return;
      }
      setModelReady(true);

      setDetectionResults(prev => ({ ...prev, [id]: data }));
      setLastUpdated(prev => ({ ...prev, [id]: new Date() }));

      // Maintain rolling error history (last 20 points)
      setErrorHistory(prev => {
        const hist = [...(prev[id] || []), data.reconstructionError];
        if (hist.length > 20) hist.shift();
        return { ...prev, [id]: hist };
      });

      // Fire alert if anomaly detected
      if (data.isAnomaly && data.diseaseHintSeverity !== 'normal') {
        await maybeFireAlert(animal, data);
      }
    } catch (err) {
      console.warn(`[EarlyDetection] Failed for ${animal.name}:`, err.message);
    } finally {
      setLoadingStates(prev => ({ ...prev, [id]: false }));
    }
  }, [buildWindowReading, alerts]);

  // ── Firestore alert generator ──────────────────────────────────────────────
  const maybeFireAlert = async (animal, data) => {
    const id      = animal.docId;
    const severity = data.diseaseHintSeverity === 'critical' ? 'critical' : 'warning';
    const alertType = severity === 'critical' ? 'disease_risk' : 'distress';
    const dedupeKey = `${id}_lstm_${data.diseaseHint.substring(0, 20)}`;

    if (firedAlertsRef.current[dedupeKey]) return;
    const existing = alerts.find(
      a => a.animalId === id && a.alertType === alertType && !a.isResolved
    );
    if (existing) return;

    try {
      await addDoc(collection(db, 'alerts'), {
        animalId:    id,
        animalName:  animal.name,
        tagNumber:   animal.tagNumber || '',
        alertType,
        severity,
        title:       `${data.diseaseHintSeverity === 'critical' ? '🔴' : '⚠️'} ${animal.name} — ${data.diseaseHint}`,
        message:     data.diseaseHintDetail,
        sensorValue: parseFloat((data.anomalyScore || 0).toFixed(1)),
        threshold:   parseFloat((data.threshold * 1000).toFixed(2)),
        status:      'active',
        isRead:      false,
        isResolved:  false,
        triggeredAt: Timestamp.now(),
      });
      firedAlertsRef.current[dedupeKey] = true;
      console.log(`[EarlyDetection] 🚨 Alert fired: ${data.diseaseHint} for ${animal.name}`);
    } catch (err) {
      console.error('[EarlyDetection] Failed to create alert:', err);
    }
  };

  // ── Poll all animals every 30 seconds ────────────────────────────────────
  useEffect(() => {
    if (!pollingActive || animals.length === 0) return;
    animals.forEach(a => detectAnomaly(a));
    const interval = setInterval(() => {
      animals.forEach(a => detectAnomaly(a));
    }, 30000);
    return () => clearInterval(interval);
  }, [animals, pollingActive, detectAnomaly]);

  // ── Re-run when readings change ───────────────────────────────────────────
  useEffect(() => {
    if (!pollingActive) return;
    animals.forEach(a => detectAnomaly(a));
  }, [latestReadings]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const fmtTime = (d) => {
    if (!d) return '—';
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  };

  const anomalyCount   = Object.values(detectionResults).filter(r => r?.isAnomaly).length;
  const criticalCount  = Object.values(detectionResults).filter(r => r?.diseaseHintSeverity === 'critical').length;
  const maxError       = Math.max(...Object.values(errorHistory).flat(), 0.001);

  const FEATURE_LABELS = {
    temperature:   'Temperature',
    heartRate:     'Heart Rate',
    accMagnitude:  'Motion (Acc)',
    activityScore: 'Activity',
    gpsSpeed:      'GPS Speed',
    deltaTemp:     'Temp Change',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="map-card-wrapper" style={{ padding: '1.25rem 1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(59,130,246,0.15))',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <Stethoscope size={22} color="var(--primary)" />
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ color: '#fff', fontSize: '1.05rem', fontWeight: 700,
              fontFamily: 'var(--font-heading)', margin: 0 }}>
              Early Disease Detection — LSTM Autoencoder
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: '0.2rem 0 0' }}>
              Learns normal behaviour patterns · Flags anomalies before symptoms appear ·
              Detects BRD, Lameness, Mastitis, Metabolic Disorders, Heat Stress &amp; Distress
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: modelReady === false ? 'var(--warning)' : modelReady ? 'var(--primary)' : 'rgba(255,255,255,0.3)',
              animation: modelReady ? 'pulse 2s infinite' : 'none'
            }} />
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {modelReady === false ? 'Model training…' : modelReady ? 'Model Active' : 'Connecting…'}
            </span>
            <button
              onClick={() => { lastFetchRef.current = {}; animals.forEach(a => detectAnomaly(a)); }}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)',
                cursor: 'pointer', padding: '0.3rem', borderRadius: 6 }}
              title="Refresh all">
              <RefreshCw size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Model Not Ready Banner ─────────────────────────────────────────── */}
      {modelReady === false && (
        <div className="map-card-wrapper" style={{
          padding: '1rem 1.25rem', border: '1px solid rgba(245,158,11,0.3)',
          background: 'rgba(245,158,11,0.05)'
        }}>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
            <Brain size={18} color="var(--warning)" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <p style={{ color: 'var(--warning)', fontWeight: 600, fontSize: '0.88rem', margin: '0 0 0.3rem' }}>
                LSTM Model Training Required
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: 0 }}>
                Run the training script once to generate the model weights. Open a terminal and execute:<br />
                <code style={{ color: '#a5f3fc', background: 'rgba(0,0,0,0.3)',
                  padding: '0.15rem 0.5rem', borderRadius: 4, marginTop: '0.4rem', display: 'inline-block' }}>
                  python "ML Models/Early Disease Detection/train_lstm_autoencoder.py"
                </code>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── KPI Summary Row ────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
        {[
          { label: 'Animals Monitored', value: animals.length, color: '#fff' },
          { label: 'Anomalies Detected', value: anomalyCount,
            color: anomalyCount > 0 ? 'var(--warning)' : 'var(--primary)' },
          { label: 'Critical Alerts', value: criticalCount,
            color: criticalCount > 0 ? 'var(--danger)' : 'var(--primary)' },
          { label: 'All Clear', value: animals.length - anomalyCount,
            color: 'var(--primary)' },
        ].map(({ label, value, color }) => (
          <div key={label} className="map-card-wrapper" style={{ padding: '0.9rem', textAlign: 'center' }}>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {label}
            </span>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color }}>
              {value}
            </span>
          </div>
        ))}
      </div>

      {/* ── Animal Detection Cards ─────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1rem' }}>
        {animals.map(animal => {
          const id       = animal.docId;
          const result   = detectionResults[id];
          const history  = errorHistory[id] || [];
          const loading  = loadingStates[id];
          const updated  = lastUpdated[id];
          const expanded = expandedCard === id;
          const reading  = latestReadings[id];

          const isAnomaly  = result?.isAnomaly || false;
          const score      = result?.anomalyScore || 0;
          const hint       = result?.diseaseHint || 'Normal';
          const severity   = result?.diseaseHintSeverity || 'normal';
          const borderColor = isAnomaly
            ? (severity === 'critical' ? 'rgba(239,68,68,0.4)' : 'rgba(245,158,11,0.35)')
            : 'var(--border-glass)';
          const bgColor   = isAnomaly
            ? (severity === 'critical' ? 'rgba(239,68,68,0.04)' : 'rgba(245,158,11,0.03)')
            : 'rgba(255,255,255,0.01)';

          return (
            <div key={id}
              className="map-card-wrapper"
              style={{
                border: `1px solid ${borderColor}`,
                background: bgColor,
                transition: 'all 0.35s ease',
                cursor: 'pointer',
              }}
              onClick={() => setExpandedCard(expanded ? null : id)}
            >
              {/* Card Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem',
                padding: '0.9rem 1rem', borderBottom: '1px solid var(--border-glass)' }}>
                {/* Animal icon */}
                <div style={{
                  width: 40, height: 40, borderRadius: 10, flexShrink: 0, overflow: 'hidden',
                  background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  {animal.imageUrl
                    ? <img src={animal.imageUrl} alt={animal.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontSize: '1.3rem' }}>🐄</span>}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.95rem',
                    fontFamily: 'var(--font-heading)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {animal.name}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                    {animal.tagNumber || animal.species} · {fmtTime(updated)}
                  </div>
                </div>

                {/* Status badge */}
                <div style={{
                  padding: '0.2rem 0.7rem', borderRadius: 20,
                  background: isAnomaly
                    ? (severity === 'critical' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.12)')
                    : 'rgba(16,185,129,0.1)',
                  border: `1px solid ${isAnomaly
                    ? (severity === 'critical' ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.25)')
                    : 'rgba(16,185,129,0.25)'}`,
                  display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0
                }}>
                  {isAnomaly
                    ? <AlertTriangle size={12} color={severity === 'critical' ? 'var(--danger)' : 'var(--warning)'} />
                    : <CheckCircle2 size={12} color="var(--primary)" />}
                  <span style={{
                    fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.04em',
                    color: isAnomaly
                      ? (severity === 'critical' ? 'var(--danger)' : 'var(--warning)')
                      : 'var(--primary)'
                  }}>
                    {isAnomaly ? severity.toUpperCase() : 'NORMAL'}
                  </span>
                </div>
              </div>

              {/* Card Body */}
              <div style={{ padding: '0.85rem 1rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <AnomalyGauge score={score} isAnomaly={isAnomaly} />

                <div style={{ flex: 1 }}>
                  {/* Disease hint */}
                  <div style={{ marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>
                      AI Disease Hint
                    </span>
                    <span style={{ fontSize: '0.88rem', fontWeight: 600, color: DISEASE_COLORS[severity] }}>
                      {DISEASE_ICONS[hint] || '⚠️'} {hint}
                    </span>
                  </div>

                  {/* Sensor quick stats */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.3rem' }}>
                    {[
                      { icon: Thermometer, label: 'Temp', value: reading ? `${reading.bodyTemperature}°C` : '—',
                        alert: reading?.bodyTemperature > 39.8 },
                      { icon: Heart, label: 'HR', value: reading ? `${reading.heartRate} BPM` : '—',
                        alert: reading?.heartRate > 100 },
                    ].map(({ icon: Icon, label, value, alert }) => (
                      <div key={label} style={{
                        display: 'flex', alignItems: 'center', gap: '0.3rem',
                        background: 'rgba(255,255,255,0.02)', borderRadius: 6, padding: '0.25rem 0.4rem'
                      }}>
                        <Icon size={11} color={alert ? 'var(--danger)' : 'var(--text-muted)'} />
                        <span style={{ fontSize: '0.68rem', color: alert ? 'var(--danger)' : 'var(--text-muted)' }}>
                          {label}:
                        </span>
                        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: alert ? 'var(--danger)' : '#fff' }}>
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sparkline */}
                {history.length > 1 && (
                  <div style={{ flexShrink: 0 }}>
                    <Sparkline data={history}
                      color={isAnomaly ? DISEASE_COLORS[severity] : 'var(--primary)'}
                      height={44}
                      threshold={result?.threshold} />
                    <div style={{ textAlign: 'center', fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                      Reconstruction Error
                    </div>
                  </div>
                )}

                {loading && (
                  <RefreshCw size={14} color="var(--text-muted)"
                    style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />
                )}

                {expanded
                  ? <ChevronUp size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                  : <ChevronDown size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />}
              </div>

              {/* ── Expanded Details ─────────────────────────────────────────── */}
              {expanded && result && (
                <div style={{
                  padding: '0.85rem 1rem',
                  borderTop: '1px solid var(--border-glass)',
                  display: 'flex', flexDirection: 'column', gap: '0.85rem'
                }}>
                  {/* Disease hint detail text */}
                  {isAnomaly && (
                    <div style={{
                      background: severity === 'critical' ? 'rgba(239,68,68,0.06)' : 'rgba(245,158,11,0.05)',
                      border: `1px solid ${severity === 'critical' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'}`,
                      borderRadius: 10, padding: '0.75rem 0.9rem', display: 'flex', gap: '0.6rem'
                    }}>
                      <AlertTriangle size={14} color={DISEASE_COLORS[severity]} style={{ flexShrink: 0, marginTop: 2 }} />
                      <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-dark)', lineHeight: 1.5 }}>
                        {result.diseaseHintDetail}
                      </p>
                    </div>
                  )}

                  {/* ECG Heart Pulse Live Monitor */}
                  <div style={{ margin: '0.2rem 0' }}>
                    <ECGHeartPulse 
                      bpm={reading?.heartRate || 65} 
                      isRealSensor={reading?.isRealHeartRate}
                      height={40}
                    />
                  </div>

                  {/* Reconstruction error metrics */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase',
                        letterSpacing: '0.05em' }}>
                        Feature Reconstruction Errors
                      </span>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                        Error: {(result.reconstructionError * 1000).toFixed(3)} ·
                        Threshold: {(result.threshold * 1000).toFixed(3)}
                      </span>
                    </div>
                    {Object.entries(result.featureErrors || {}).map(([key, val]) => (
                      <FeatureErrorBar key={key}
                        label={FEATURE_LABELS[key] || key}
                        value={val}
                        maxVal={maxError} />
                    ))}
                  </div>

                  {/* Reconstruction error trend */}
                  {history.length > 3 && (
                    <div>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>
                        Error Trend (last {history.length} readings)
                      </span>
                      <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: '0.5rem',
                        display: 'flex', justifyContent: 'center' }}>
                        <Sparkline data={history}
                          color={isAnomaly ? DISEASE_COLORS[severity] : 'var(--primary)'}
                          height={55}
                          threshold={result.threshold} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem',
                        fontSize: '0.62rem', color: 'var(--text-muted)' }}>
                        <span>Older</span>
                        <span style={{ color: 'rgba(239,68,68,0.6)' }}>— Threshold</span>
                        <span>Now</span>
                      </div>
                    </div>
                  )}

                  {/* Model info */}
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {[
                      { label: 'Anomaly Score', value: `${result.anomalyScore}/100` },
                      { label: 'Confidence', value: `${(result.confidence * 100).toFixed(1)}%` },
                      { label: 'Severity', value: severity.toUpperCase() },
                    ].map(({ label, value }) => (
                      <div key={label} style={{
                        flex: 1, minWidth: 80, background: 'rgba(255,255,255,0.02)',
                        border: '1px solid var(--border-glass)', borderRadius: 8, padding: '0.4rem 0.6rem',
                        textAlign: 'center'
                      }}>
                        <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginBottom: '0.15rem' }}>{label}</div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fff' }}>{value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Disease Reference Guide ────────────────────────────────────────── */}
      <div className="map-card-wrapper" style={{ padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
          <Info size={14} color="var(--text-muted)" />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase',
            letterSpacing: '0.05em' }}>
            Disease Detection Reference
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.6rem' }}>
          {[
            { icon: '🫁', name: 'BRD / Respiratory', triggers: 'Temp > 39.8°C + HR > 100 + Low Activity', severity: 'critical' },
            { icon: '🤒', name: 'Fever / Mastitis',  triggers: 'Temp > 40.5°C + HR > 110 + Lethargy',   severity: 'critical' },
            { icon: '🦶', name: 'Lameness / FMD',    triggers: 'Activity < 15% + Speed < 0.15 m/s + Fever', severity: 'warning' },
            { icon: '🧪', name: 'Metabolic Disorder', triggers: 'Low Temp < 37.5°C + HR > 85',            severity: 'warning' },
            { icon: '🌡️', name: 'Heat Stress',       triggers: 'Temp > 40°C + HR > 105 + Low Activity',  severity: 'critical' },
            { icon: '🚨', name: 'Distress / Attack',  triggers: 'HR > 120 + Erratic Motion (Acc > 2.0g)', severity: 'critical' },
          ].map(({ icon, name, triggers, severity }) => (
            <div key={name} style={{
              background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)',
              borderRadius: 10, padding: '0.6rem 0.8rem', display: 'flex', gap: '0.6rem'
            }}>
              <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{icon}</span>
              <div>
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: DISEASE_COLORS[severity], marginBottom: '0.15rem' }}>
                  {name}
                </div>
                <div style={{ fontSize: '0.67rem', color: 'var(--text-muted)' }}>{triggers}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
