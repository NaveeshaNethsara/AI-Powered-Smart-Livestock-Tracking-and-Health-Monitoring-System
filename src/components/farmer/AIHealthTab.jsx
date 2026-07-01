// AIHealthTab.jsx — FR-F20 to FR-F29
// Health score, disease risk, abnormal activity, posture, injury,
// animal count, feeding behavior, cough, stress, distress detection
import React, { useState } from 'react';
import {
  Activity, AlertTriangle, Eye, Volume2, Heart,
  ShieldCheck, Zap, Wind, TrendingDown
} from 'lucide-react';

export default function AIHealthTab({ animals, latestAI }) {
  const [selectedId, setSelectedId] = useState(null);

  const getAI = (id) => latestAI[id] || {};

  const scoreColor = (s) => s > 80 ? 'var(--primary)' : s > 60 ? 'var(--warning)' : 'var(--danger)';
  const riskColor  = (l) => l === 'high' ? 'var(--danger)' : l === 'medium' ? 'var(--warning)' : 'var(--primary)';

  const totalAnimals = animals.length; // FR-F25
  const criticalCount = animals.filter(a => a.healthStatus === 'critical').length;
  const coughCount    = animals.filter(a => getAI(a.docId).coughDetected).length;   // FR-F27
  const distressCount = animals.filter(a => getAI(a.docId).distressDetected).length; // FR-F29
  const injuryCount   = animals.filter(a => getAI(a.docId).injuryDetected).length;  // FR-F24

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* FR-F25: Animal count summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
        {[
          { label: 'FR-F25 Total Animals', value: totalAnimals, Icon: Activity, color: 'var(--primary)', bg: 'bg-emerald' },
          { label: 'FR-F24 Injury Detected', value: injuryCount, Icon: AlertTriangle, color: 'var(--danger)', bg: 'bg-purple' },
          { label: 'FR-F27 Cough Anomalies', value: coughCount, Icon: Volume2, color: '#c084fc', bg: 'bg-purple' },
          { label: 'FR-F29 Distress Detected', value: distressCount, Icon: Zap, color: 'var(--warning)', bg: 'bg-cyan' },
        ].map(({ label, value, Icon, color, bg }) => (
          <div key={label} className="metric-card" style={{ padding: '1rem' }}>
            <div className={`metric-icon ${bg}`}><Icon size={18} color={color} /></div>
            <div className="metric-info">
              <span className="metric-label">{label}</span>
              <div className="metric-value-row">
                <h3 style={{ fontSize: '1.4rem' }}>{value}</h3>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Per-animal AI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '1.25rem' }}>
        {animals.map(animal => {
          const ai = getAI(animal.docId);
          const hs = ai.healthScore ?? animal.currentHealthScore ?? 0;
          const isSelected = selectedId === animal.docId;

          return (
            <div
              key={animal.docId}
              className="map-card-wrapper"
              style={{ padding: '1.5rem', cursor: 'pointer', borderColor: isSelected ? scoreColor(hs) : 'var(--border-glass)' }}
              onClick={() => setSelectedId(isSelected ? null : animal.docId)}
            >
              {/* Animal header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div>
                  <h5 style={{ color: '#fff', fontFamily: 'var(--font-heading)', margin: 0 }}>{animal.name}</h5>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{animal.tagNumber}</span>
                </div>
                {/* FR-F20: Health Score */}
                <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', border: `1px solid ${scoreColor(hs)}30`, borderRadius: '12px', padding: '0.5rem 1rem' }}>
                  <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', display: 'block' }}>HEALTH SCORE</span>
                  <span style={{ fontSize: '1.5rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: scoreColor(hs) }}>{hs}</span>
                  <span style={{ fontSize: '0.6rem', color: 'var(--text-dark)' }}>/100</span>
                </div>
              </div>

              {/* Health Score Bar */}
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${hs}%`, background: `linear-gradient(90deg, ${scoreColor(hs)}, ${scoreColor(hs)}cc)`, borderRadius: '3px', transition: '0.5s' }} />
                </div>
              </div>

              {/* FR-F21: Disease Risk */}
              {ai.diseaseRisk?.diseases?.length > 0 && (
                <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '10px', padding: '0.75rem', marginBottom: '1rem' }}>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>FR-F21 DISEASE RISK PREDICTION</span>
                  {ai.diseaseRisk.diseases.slice(0, 2).map((d, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.2rem' }}>
                      <span style={{ color: '#fff' }}>{d.name}</span>
                      <span style={{ color: riskColor(ai.diseaseRisk.level), fontWeight: 600 }}>{d.probability}%</span>
                    </div>
                  ))}
                </div>
              )}

              {/* FR-F22 to FR-F29: AI feature flags grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                {[
                  { label: 'FR-F22 Activity', value: ai.activityStatus || '—', alert: ai.activityStatus === 'abnormal', Icon: Activity },
                  { label: 'FR-F23 Posture', value: ai.postureStatus || '—', alert: ai.postureStatus === 'abnormal', Icon: Eye },
                  { label: 'FR-F24 Injury', value: ai.injuryDetected ? 'Detected ⚠️' : 'None', alert: ai.injuryDetected, Icon: AlertTriangle },
                  { label: 'FR-F26 Feeding', value: ai.feedingBehavior || '—', alert: ai.feedingBehavior === 'absent', Icon: TrendingDown },
                  { label: 'FR-F27 Cough', value: ai.coughDetected ? `${ai.coughCount || '?'} coughs` : 'Normal', alert: ai.coughDetected, Icon: Wind },
                  { label: 'FR-F28 Stress', value: ai.stressLevel || '—', alert: ai.stressLevel === 'high', Icon: Zap },
                  { label: 'FR-F29 Distress', value: ai.distressDetected ? 'Detected' : 'Normal', alert: ai.distressDetected, Icon: Volume2 },
                  { label: 'AI Confidence', value: ai.confidence ? `${ai.confidence}%` : '—', alert: false, Icon: ShieldCheck },
                ].map(({ label, value, alert, Icon }) => (
                  <div key={label} style={{ background: alert ? 'rgba(239,68,68,0.06)' : 'rgba(255,255,255,0.02)', border: `1px solid ${alert ? 'rgba(239,68,68,0.2)' : 'var(--border-glass)'}`, borderRadius: '8px', padding: '0.6rem 0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                      <Icon size={11} color={alert ? 'var(--danger)' : 'var(--text-muted)'} />
                      <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>{label}</span>
                    </div>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: alert ? 'var(--danger)' : '#fff', textTransform: 'capitalize' }}>{value}</span>
                  </div>
                ))}
              </div>

              {/* Posture detail & injury detail */}
              {isSelected && (
                <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-glass)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ fontSize: '0.78rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Posture Detail: </span>
                    <span style={{ color: '#fff' }}>{ai.postureDetails || 'No data'}</span>
                  </div>
                  {ai.injuryDetected && (
                    <div style={{ fontSize: '0.78rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Injury Detail: </span>
                      <span style={{ color: 'var(--warning)' }}>{ai.injuryDetails}</span>
                    </div>
                  )}
                  <div style={{ fontSize: '0.78rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Model Version: </span>
                    <span style={{ color: '#fff' }}>{ai.modelVersion || '—'}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {animals.length === 0 && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', color: 'var(--text-muted)', padding: '3rem' }}>
            No AI prediction data available. Ensure ESP32 devices are sending data.
          </div>
        )}
      </div>
    </div>
  );
}
