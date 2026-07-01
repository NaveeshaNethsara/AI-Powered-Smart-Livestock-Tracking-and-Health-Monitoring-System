// MonitoringTab.jsx — FR-F14 to FR-F19
// Real-time body temperature, activity, GPS, battery, sensor connectivity, sensor readings
import React, { useState } from 'react';
import { Thermometer, Heart, Activity, Battery, Wifi, WifiOff, Clock, AlertTriangle } from 'lucide-react';

export default function MonitoringTab({ animals, latestReadings, latestGps, devices }) {

  const [selectedId, setSelectedId] = useState(null);

  const getReading = (id) => latestReadings[id] || {};
  const getGps     = (id) => latestGps[id] || {};
  const getDevice  = (animalDeviceId) => devices.find(d => (d.deviceId || d.docId) === animalDeviceId);

  const fmtTime = (ts) => {
    if (!ts) return 'No data';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
    return `${Math.floor(diff/3600)}h ago`;
  };

  const tempColor = (t) => t > 40.0 ? 'var(--danger)' : t > 39.4 ? 'var(--warning)' : 'var(--primary)';
  const hrColor   = (hr) => hr > 95 ? 'var(--danger)' : hr > 85 ? 'var(--warning)' : '#fff';
  const battColor = (b) => b < 15 ? 'var(--danger)' : b < 30 ? 'var(--warning)' : 'var(--primary)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '0.5rem' }}>
        <div className="metric-card" style={{ padding: '1rem' }}>
          <div className="metric-icon bg-emerald"><Thermometer size={18} color="var(--primary)" /></div>
          <div className="metric-info">
            <span className="metric-label">FR-F14 Body Temperature</span>
            <h3 style={{ fontSize: '1rem' }}>Live from Firestore</h3>
          </div>
        </div>
        <div className="metric-card" style={{ padding: '1rem' }}>
          <div className="metric-icon bg-cyan"><Activity size={18} color="var(--secondary)" /></div>
          <div className="metric-info">
            <span className="metric-label">FR-F15 Activity Level</span>
            <h3 style={{ fontSize: '1rem' }}>Live from Firestore</h3>
          </div>
        </div>
        <div className="metric-card" style={{ padding: '1rem' }}>
          <div className="metric-icon bg-purple"><Battery size={18} color="#c084fc" /></div>
          <div className="metric-info">
            <span className="metric-label">FR-F17 Device Battery</span>
            <h3 style={{ fontSize: '1rem' }}>{devices.filter(d => d.batteryLevel < 20).length} Low</h3>
          </div>
        </div>
      </div>

      {/* Per-animal sensor cards — FR-F18, FR-F19 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1rem' }}>
        {animals.map(animal => {
          const r = getReading(animal.docId);
          const g = getGps(animal.docId);
          const dev = getDevice(animal.deviceId);
          const connected = r.sensorStatus === 'connected';
          const isSelected = selectedId === animal.docId;

          return (
            <div
              key={animal.docId}
              className="map-card-wrapper"
              style={{ padding: '1.25rem', cursor: 'pointer', borderColor: isSelected ? 'var(--primary)' : 'var(--border-glass)', transition: '0.2s' }}
              onClick={() => setSelectedId(isSelected ? null : animal.docId)}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div>
                  <h5 style={{ color: '#fff', fontFamily: 'var(--font-heading)', margin: 0 }}>{animal.name}</h5>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{animal.tagNumber} • {animal.species}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem' }}>
                  {connected
                    ? <><Wifi size={12} color="var(--primary)" /><span style={{ color: 'var(--primary)' }}>Connected</span></>
                    : <><WifiOff size={12} color="var(--danger)" /><span style={{ color: 'var(--danger)' }}>Offline</span></>
                  }
                </div>
              </div>

              {/* Vitals Grid — FR-F14, FR-F15, FR-F17, FR-F19 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
                <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '10px', padding: '0.75rem' }}>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block' }}>BODY TEMPERATURE</span>
                  <span style={{ fontSize: '1.3rem', fontWeight: 700, color: r.bodyTemperature ? tempColor(r.bodyTemperature) : 'var(--text-dark)' }}>
                    {r.bodyTemperature ? `${r.bodyTemperature}°C` : '—'}
                  </span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '10px', padding: '0.75rem' }}>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block' }}>HEART RATE</span>
                  <span style={{ fontSize: '1.3rem', fontWeight: 700, color: r.heartRate ? hrColor(r.heartRate) : 'var(--text-dark)' }}>
                    {r.heartRate ? `${r.heartRate} BPM` : '—'}
                  </span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '10px', padding: '0.75rem' }}>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block' }}>ACTIVITY</span>
                  <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#fff', textTransform: 'capitalize' }}>
                    {r.activityLevel || '—'}
                  </span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '10px', padding: '0.75rem' }}>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block' }}>DEVICE BATTERY</span>
                  <span style={{ fontSize: '0.95rem', fontWeight: 600, color: r.batteryLevel !== undefined ? battColor(r.batteryLevel) : 'var(--text-dark)' }}>
                    <Battery size={12} style={{ marginRight: '0.25rem' }} />{r.batteryLevel !== undefined ? `${r.batteryLevel}%` : '—'}
                  </span>
                </div>
              </div>

              {/* Extended info — FR-F18, FR-F19 */}
              {isSelected && (
                <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-glass)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Step Count:</span>
                    <span style={{ color: '#fff' }}>{r.stepCount ?? '—'} steps</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Accelerometer (X/Y/Z):</span>
                    <span style={{ color: '#fff' }}>{r.accelerometerX ?? '—'} / {r.accelerometerY ?? '—'} / {r.accelerometerZ ?? '—'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>GPS Position (FR-F16):</span>
                    <span style={{ color: 'var(--primary)' }}>{g.latitude?.toFixed(5) ?? '—'}, {g.longitude?.toFixed(5) ?? '—'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Geofence Status:</span>
                    <span style={{ color: g.isInsideGeofence ? 'var(--primary)' : 'var(--danger)' }}>
                      {g.isInsideGeofence !== undefined ? (g.isInsideGeofence ? '✅ Inside' : '⚠️ Outside') : '—'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Sensor Status (FR-F18):</span>
                    <span style={{ color: connected ? 'var(--primary)' : 'var(--danger)' }}>{r.sensorStatus || '—'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Device Firmware:</span>
                    <span style={{ color: '#fff' }}>{dev?.firmwareVersion || '—'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Last Ping:</span>
                    <span style={{ color: 'var(--text-muted)' }}><Clock size={10} /> {fmtTime(r.timestamp)}</span>
                  </div>
                  {r.isBuffered && (
                    <div style={{ fontSize: '0.72rem', color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.25rem' }}>
                      <AlertTriangle size={12} /> Data synced from offline buffer
                    </div>
                  )}
                </div>
              )}

              {/* Last updated */}
              <div style={{ marginTop: '0.75rem', fontSize: '0.68rem', color: 'var(--text-dark)', textAlign: 'right' }}>
                <Clock size={10} /> Last reading: {fmtTime(r.timestamp)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
