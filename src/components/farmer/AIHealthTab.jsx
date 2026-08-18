// AIHealthTab.jsx — Module 2 Health Risk Prediction (Random Forest)
// Uses real-time sensor telemetry and animal metadata to run local AI inference.
import React, { useState, useEffect, useRef } from 'react';
import ECGHeartPulse from './ECGHeartPulse';
import {
  Activity, AlertTriangle, Heart, ShieldCheck, Zap,
  TrendingDown, RefreshCw, Thermometer, Database
} from 'lucide-react';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';

export default function AIHealthTab({ animals, latestAI, latestReadings, alerts = [] }) {
  const [selectedId, setSelectedId] = useState(null);
  const [livePredictions, setLivePredictions] = useState({});
  const [loadingStates, setLoadingStates] = useState({});
  const [lastUpdated, setLastUpdated] = useState({});

  // Keep track of the last fetch keys to prevent duplicate network calls
  const lastFetchKeys = useRef({});

  // Trigger real-time prediction call when new sensor reading streams in
  useEffect(() => {
    animals.forEach(animal => {
      const r = latestReadings[animal.docId];
      if (!r) return;

      const cacheKey = `${r.bodyTemperature}-${r.heartRate}-${r.activityLevel}-${r.stepCount}`;
      if (lastFetchKeys.current[animal.docId] === cacheKey) return;
      lastFetchKeys.current[animal.docId] = cacheKey;

      fetchPrediction(animal, r);
    });
  }, [latestReadings, animals]);

  const fetchPrediction = async (animal, reading) => {
    const id = animal.docId;
    setLoadingStates(prev => ({ ...prev, [id]: true }));

    try {
      const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
      const response = await fetch(`${API_BASE_URL}/api/predict-health-risk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          temp: reading.bodyTemperature,
          heartRate: reading.heartRate,
          activityLevel: reading.activityLevel,
          stepCount: reading.stepCount,
          weight: animal.weight || 450,
          species: animal.species || 'Cattle'
        })
      });

      if (!response.ok) {
        throw new Error('Inference server failed');
      }

      const data = await response.json();
      setLivePredictions(prev => ({ ...prev, [id]: data }));
      setLastUpdated(prev => ({ ...prev, [id]: new Date() }));

      // Evaluate ML-based health alerts
      evaluateHealthAlerts(animal, data, reading);
    } catch (err) {
      console.error(`Failed to fetch ML health prediction for ${animal.name}:`, err);
    } finally {
      setLoadingStates(prev => ({ ...prev, [id]: false }));
    }
  };

  const getPrediction = (id) => livePredictions[id] || null;

  // ── ML Health Alert Evaluation ──────────────────────────────
  const firedAlertsRef = useRef({});

  const evaluateHealthAlerts = async (animal, prediction, reading) => {
    const alertsToFire = [];
    const status = (prediction.status || '').toLowerCase();
    const risk = (prediction.riskLevel || '').toLowerCase();
    const score = prediction.healthScore || 100;
    const hr = reading.heartRate || 0;
    const temp = reading.bodyTemperature || 0;

    // 1. Fever detected by ML model
    if (status === 'fever' || status === 'possible infection') {
      alertsToFire.push({
        alertType: 'high_temp',
        severity: 'critical',
        title: `🔴 ${animal.name} — Fever Detected by AI`,
        message: `ML Health Model classified ${animal.name} as "${prediction.status}" with ${(prediction.statusConfidence * 100).toFixed(0)}% confidence. Body temp: ${temp}°C, Heart rate: ${hr} BPM. Immediate veterinary attention recommended.`,
        sensorValue: temp,
        threshold: 39.5
      });
    }

    // 2. Stress detected
    if (status === 'stress') {
      alertsToFire.push({
        alertType: 'abnormal_activity',
        severity: 'warning',
        title: `⚠️ ${animal.name} — Stress Detected by AI`,
        message: `ML model detected stress indicators for ${animal.name}. Health score: ${score}%, Heart rate: ${hr} BPM. Monitor the animal closely and reduce environmental stressors.`,
        sensorValue: score,
        threshold: 70
      });
    }

    // 3. Inactivity / no movement concern
    if (status === 'inactive') {
      alertsToFire.push({
        alertType: 'no_movement',
        severity: 'warning',
        title: `⚠️ ${animal.name} — Inactivity Warning`,
        message: `${animal.name} has been classified as inactive by the health model. Health score: ${score}%. This could indicate illness, injury, or extreme lethargy. Please check on the animal.`,
        sensorValue: score,
        threshold: 65
      });
    }

    // 4. High disease risk from ML
    if (risk === 'high' || risk === 'medium') {
      alertsToFire.push({
        alertType: risk === 'high' ? 'injury' : 'distress',
        severity: risk === 'high' ? 'critical' : 'warning',
        title: `${risk === 'high' ? '🔴' : '⚠️'} ${animal.name} — ${risk.charAt(0).toUpperCase() + risk.slice(1)} Disease Risk`,
        message: `AI Health model predicts ${risk} disease risk for ${animal.name} (${prediction.riskLevel}). Health score: ${score}%, Confidence: ${(prediction.riskConfidence * 100).toFixed(0)}%. Temp: ${temp}°C, HR: ${hr} BPM. ${risk === 'high' ? 'Urgent veterinary intervention required.' : 'Schedule a health check soon.'}`,
        sensorValue: score,
        threshold: risk === 'high' ? 50 : 70
      });
    }

    // 5. Abnormal heart rate (tachycardia)
    if (hr > 100) {
      alertsToFire.push({
        alertType: 'abnormal_activity',
        severity: hr > 120 ? 'critical' : 'warning',
        title: `${hr > 120 ? '🔴' : '⚠️'} ${animal.name} — Elevated Heart Rate`,
        message: `${animal.name}'s heart rate is ${hr} BPM which is above the normal range. This may indicate fever, pain, stress, or respiratory issues. Current health score: ${score}%.`,
        sensorValue: hr,
        threshold: 100
      });
    }

    // Fire each alert (with deduplication)
    for (const alertData of alertsToFire) {
      const dedupeKey = `${animal.docId}_${alertData.alertType}_${alertData.title.substring(0, 30)}`;

      // Skip if we already fired this exact alert recently (within this session)
      if (firedAlertsRef.current[dedupeKey]) continue;

      // Skip if there is an active unresolved alert of this type for this animal in Firestore
      const existingAlert = alerts.find(
        a => a.animalId === animal.docId && a.alertType === alertData.alertType && !a.isResolved
      );
      if (existingAlert) continue;

      // Fire the alert
      try {
        await addDoc(collection(db, 'alerts'), {
          animalId: animal.docId,
          animalName: animal.name,
          tagNumber: animal.tagNumber || '',
          alertType: alertData.alertType,
          severity: alertData.severity,
          title: alertData.title,
          message: alertData.message,
          sensorValue: alertData.sensorValue,
          threshold: alertData.threshold,
          status: 'active',
          isRead: false,
          isResolved: false,
          triggeredAt: Timestamp.now()
        });
        firedAlertsRef.current[dedupeKey] = true;
        console.log(`[AIHealthTab] Alert fired: ${alertData.title}`);
      } catch (err) {
        console.error('[AIHealthTab] Failed to create alert:', err);
      }
    }
  };

  const scoreColor = (s) => s > 80 ? 'var(--primary)' : s > 65 ? 'var(--warning)' : 'var(--danger)';
  
  const riskColor = (lvl) => {
    const l = (lvl || '').toLowerCase();
    if (l === 'high') return 'var(--danger)';
    if (l === 'medium') return 'var(--warning)';
    return 'var(--primary)';
  };

  const statusColor = (st) => {
    const s = (st || '').toLowerCase();
    if (s === 'healthy') return 'var(--primary)';
    if (s === 'stress') return '#c084fc'; // Purple for stress
    return 'var(--danger)'; // Red for Fever, Inactive, Possible Infection
  };

  const formatTime = (date) => {
    if (!date) return '—';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const totalAnimals = animals.length;
  const criticalCount = animals.filter(a => {
    const pred = getPrediction(a.docId);
    return pred && (pred.riskLevel === 'High' || pred.status === 'Fever' || pred.status === 'Possible Infection');
  }).length;

  return (
    <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%', overflowY: 'auto' }}>
      
      {/* Summary Banner */}
      <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem', borderLeft: '4px solid var(--primary)' }}>
        <div style={{ background: 'rgba(16,185,129,0.1)', padding: '0.75rem', borderRadius: '12px' }}>
          <Heart size={28} color="var(--primary)" />
        </div>
        <div>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#fff', fontFamily: 'var(--font-heading)' }}>Cattle Health Risk Prediction</h2>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0.2rem 0 0' }}>
            Module 2 — Real-time Health Risk Assessment using a Random Forest Classifier trained on livestock vitals, activity, and metrics.
          </p>
        </div>
      </div>

      {/* KPI Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
        {[
          { label: 'Monitored Herd Size', value: totalAnimals, Icon: Activity, color: 'var(--primary)', bg: 'bg-emerald' },
          { label: 'Critical Risk Alerts', value: criticalCount, Icon: AlertTriangle, color: criticalCount > 0 ? 'var(--danger)' : 'var(--text-muted)', bg: criticalCount > 0 ? 'bg-purple' : 'bg-emerald' },
          { label: 'ML Model Engine', value: 'Random Forest', Icon: Database, color: '#c084fc', bg: 'bg-purple' }
        ].map(({ label, value, Icon, color, bg }) => (
          <div key={label} className="metric-card" style={{ padding: '1rem' }}>
            <div className={`metric-icon ${bg}`}><Icon size={18} color={color} /></div>
            <div className="metric-info">
              <span className="metric-label">{label}</span>
              <div className="metric-value-row">
                <h3 style={{ fontSize: '1.35rem', color: '#fff' }}>{value}</h3>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Grid List of Cattle Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1.25rem' }}>
        {animals.map(animal => {
          const r = latestReadings[animal.docId] || {};
          const pred = getPrediction(animal.docId);
          const loading = loadingStates[animal.docId];
          const isSelected = selectedId === animal.docId;

          // Baseline fallbacks if prediction isn't ready
          const score = pred ? pred.healthScore : 95;
          const status = pred ? pred.status : 'Healthy';
          const risk = pred ? pred.riskLevel : 'Healthy';
          const confidence = pred ? pred.statusConfidence : 1.0;

          return (
            <div
              key={animal.docId}
              className="map-card-wrapper"
              style={{
                padding: '1.5rem',
                cursor: 'pointer',
                borderColor: isSelected ? scoreColor(score) : 'var(--border-glass)',
                transition: 'all 0.2s ease',
                position: 'relative'
              }}
              onClick={() => setSelectedId(isSelected ? null : animal.docId)}
            >
              {/* Card Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div>
                  <h5 style={{ color: '#fff', fontFamily: 'var(--font-heading)', margin: 0, fontSize: '1rem' }}>{animal.name}</h5>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Tag: {animal.tagNumber} • {animal.species}</span>
                </div>
                
                {/* Health Score Dial */}
                <div style={{
                  textAlign: 'center',
                  background: 'rgba(255,255,255,0.03)',
                  border: `1px solid ${scoreColor(score)}40`,
                  borderRadius: '12px',
                  padding: '0.4rem 0.8rem',
                  minWidth: '70px'
                }}>
                  <span style={{ fontSize: '0.55rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>Health Score</span>
                  <span style={{ fontSize: '1.35rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: scoreColor(score) }}>{score}</span>
                  <span style={{ fontSize: '0.55rem', color: 'var(--text-dark)' }}>%</span>
                </div>
              </div>

              {/* Progress Bar */}
              <div style={{ marginBottom: '1.2rem' }}>
                <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${score}%`, background: `linear-gradient(90deg, ${scoreColor(score)}, ${scoreColor(score)}aa)`, transition: 'width 0.5s ease-out' }} />
                </div>
              </div>

              {/* Vitals & Predictions Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', marginBottom: '1rem' }}>
                <div style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid var(--border-glass)', borderRadius: '8px', padding: '0.5rem 0.65rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.15rem' }}>
                    <ShieldCheck size={11} color="var(--text-muted)" />
                    <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>Health Status</span>
                  </div>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: statusColor(status) }}>{status}</span>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid var(--border-glass)', borderRadius: '8px', padding: '0.5rem 0.65rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.15rem' }}>
                    <AlertTriangle size={11} color="var(--text-muted)" />
                    <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>Disease Risk</span>
                  </div>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: riskColor(risk) }}>{risk}</span>
                </div>

                {/* Heart Rate ECG Pulse Live Monitor Tile */}
                <div style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid var(--border-glass)', borderRadius: '8px', padding: '0.5rem 0.65rem', gridColumn: 'span 2' }}>
                  <ECGHeartPulse 
                    bpm={r.heartRate || 65}
                    isRealSensor={r.isRealHeartRate}
                    height={38}
                  />
                </div>

                <div style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid var(--border-glass)', borderRadius: '8px', padding: '0.5rem 0.65rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.15rem' }}>
                    <Thermometer size={11} color="var(--text-muted)" />
                    <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>Temperature</span>
                  </div>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: r.bodyTemperature > 39.3 ? 'var(--danger)' : '#fff' }}>
                    {r.bodyTemperature ? `${r.bodyTemperature}°C` : '38.5°C'}
                  </span>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid var(--border-glass)', borderRadius: '8px', padding: '0.5rem 0.65rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.15rem' }}>
                    <Activity size={11} color="var(--text-muted)" />
                    <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>Activity</span>
                  </div>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#fff', textTransform: 'capitalize' }}>
                    {r.activityLevel || 'resting'}
                  </span>
                </div>
              </div>

              {/* Last prediction timestamp */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.65rem', color: 'var(--text-dark)' }}>
                <span>LAST ML RUN: {formatTime(lastUpdated[animal.docId])}</span>
                {loading && <span style={{ color: 'var(--primary)' }}>Re-running...</span>}
              </div>

              {/* Extended Details Panel */}
              {isSelected && (
                <div style={{
                  marginTop: '1rem',
                  borderTop: '1px solid var(--border-glass)',
                  paddingTop: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  fontSize: '0.74rem',
                  color: 'var(--text-muted)',
                  animation: 'fadeIn 0.2s ease-in-out'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '0.3rem' }}>
                    <span>Animal Weight:</span>
                    <span style={{ color: '#fff', fontWeight: 600 }}>{animal.weight || 450} kg</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '0.3rem' }}>
                    <span>Current Activity:</span>
                    <span style={{ color: '#fff', fontWeight: 600, textTransform: 'capitalize' }}>{r.activityLevel || 'resting'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '0.3rem' }}>
                    <span>Calculated SMA:</span>
                    <span style={{ color: '#fff', fontWeight: 600 }}>{r.accelerometerX ? Math.sqrt(r.accelerometerX**2 + r.accelerometerY**2 + r.accelerometerZ**2).toFixed(2) : '1.00'} g</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Total Step Count:</span>
                    <span style={{ color: '#fff', fontWeight: 600 }}>{r.stepCount || 120} steps</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {animals.length === 0 && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', color: 'var(--text-muted)', padding: '3rem' }}>
            No cattle profiles registered to run health diagnostics.
          </div>
        )}
      </div>
    </div>
  );
}
