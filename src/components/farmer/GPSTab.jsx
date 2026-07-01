// GPSTab.jsx — FR-F30 to FR-F33
// Live location, movement history, geofence boundary, locate missing animals
import React, { useState, useEffect } from 'react';
import { MapPin, Navigation, AlertTriangle, Clock, Map } from 'lucide-react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';

export default function GPSTab({ animals, latestGps, geofences }) {
  const [selectedAnimal, setSelectedAnimal] = useState(null);
  const [gpsHistory, setGpsHistory]         = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // FR-F31: Load movement history for selected animal
  useEffect(() => {
    if (!selectedAnimal) return;
    setLoadingHistory(true);
    const q = query(
      collection(db, 'animals', selectedAnimal.docId, 'gps_locations'),
      orderBy('timestamp', 'desc'),
      limit(20)
    );
    const unsub = onSnapshot(q, (snap) => {
      setGpsHistory(snap.docs.map(d => ({ docId: d.id, ...d.data() })));
      setLoadingHistory(false);
    });
    return () => unsub();
  }, [selectedAnimal?.docId]);

  const getGps = (id) => latestGps[id] || {};

  // FR-F33: Missing animals = outside geofence or no GPS data for >2hr
  const missingAnimals = animals.filter(a => {
    const g = getGps(a.docId);
    if (!g.timestamp) return true; // no data at all
    const lastSeen = g.timestamp?.toDate ? g.timestamp.toDate() : new Date(g.timestamp);
    const hoursAgo = (Date.now() - lastSeen.getTime()) / 3600000;
    return g.isInsideGeofence === false || hoursAgo > 2;
  });

  const fmtTime = (ts) => {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  // Simple CSS map with coordinate plotting (Sri Lanka region)
  const MIN_LAT = 7.280, MAX_LAT = 7.300, MIN_LNG = 80.625, MAX_LNG = 80.645;
  const toMapCoords = (lat, lng) => {
    if (!lat || !lng) return { x: '50%', y: '50%' };
    const x = Math.min(Math.max(((lng - MIN_LNG) / (MAX_LNG - MIN_LNG)) * 100, 2), 96);
    const y = Math.min(Math.max(100 - (((lat - MIN_LAT) / (MAX_LAT - MIN_LAT)) * 100), 4), 92);
    return { x: `${x}%`, y: `${y}%` };
  };

  const hClass = (s) => s === 'critical' ? 'critical' : s === 'at_risk' ? 'warning' : 'healthy';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* FR-F33: Missing animals alert banner */}
      {missingAnimals.length > 0 && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '12px', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <AlertTriangle size={18} color="var(--danger)" />
          <div>
            <strong style={{ color: 'var(--danger)', fontSize: '0.9rem' }}>FR-F33 — {missingAnimals.length} Animal{missingAnimals.length > 1 ? 's' : ''} Require Attention:</strong>
            <span style={{ color: '#fff', fontSize: '0.82rem', marginLeft: '0.5rem' }}>
              {missingAnimals.map(a => a.name).join(', ')} — outside geofence or no recent GPS signal
            </span>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '1.5rem' }}>

        {/* Left: Animal GPS list — FR-F30 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <h4 style={{ color: '#fff', fontFamily: 'var(--font-heading)', fontSize: '1rem', margin: 0 }}>
            <Navigation size={16} color="var(--primary)" style={{ marginRight: '0.5rem' }} />FR-F30 Live Animal Locations
          </h4>
          {animals.map(a => {
            const g = getGps(a.docId);
            const isSelected = selectedAnimal?.docId === a.docId;
            const isMissing  = missingAnimals.some(m => m.docId === a.docId);
            return (
              <div
                key={a.docId}
                className="map-card-wrapper"
                style={{ padding: '1rem', cursor: 'pointer', borderColor: isSelected ? 'var(--primary)' : isMissing ? 'rgba(239,68,68,0.3)' : 'var(--border-glass)' }}
                onClick={() => setSelectedAnimal(a)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <MapPin size={16} color={isMissing ? 'var(--danger)' : 'var(--primary)'} />
                    <div>
                      <h6 style={{ color: '#fff', margin: 0, fontSize: '0.9rem' }}>{a.name} <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.75rem' }}>({a.tagNumber})</span></h6>
                      <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.72rem' }}>
                        {g.latitude ? `${g.latitude.toFixed(5)}, ${g.longitude.toFixed(5)}` : 'No GPS data'}
                      </p>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.65rem', padding: '0.2rem 0.6rem', borderRadius: '20px', color: g.isInsideGeofence === false ? 'var(--danger)' : 'var(--primary)', background: g.isInsideGeofence === false ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)' }}>
                      {g.isInsideGeofence === false ? '⚠️ Outside' : '✅ Inside'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: Map + History */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* FR-F32: GPS Map with geofence */}
          <div className="map-card-wrapper" style={{ padding: '1rem' }}>
            <h4 style={{ color: '#fff', fontFamily: 'var(--font-heading)', fontSize: '1rem', margin: '0 0 0.75rem 0' }}>
              <Map size={16} color="var(--primary)" style={{ marginRight: '0.5rem' }} />FR-F32 Pasture Map & Geofence Boundary
            </h4>
            <div className="gps-map-container" style={{ height: '260px' }}>
              <div className="map-grid-layer">
                <div className="scan-line"></div>
                {/* Geofence circle visualization */}
                {geofences.map(fence => (
                  <div key={fence.docId} style={{
                    position: 'absolute',
                    left: '50%', top: '50%',
                    width: '60%', height: '60%',
                    transform: 'translate(-50%, -50%)',
                    border: '2px dashed rgba(16,185,129,0.4)',
                    borderRadius: '50%',
                    pointerEvents: 'none'
                  }}>
                    <span style={{ position: 'absolute', top: '-1.2rem', left: '50%', transform: 'translateX(-50%)', fontSize: '0.6rem', color: 'var(--primary)', whiteSpace: 'nowrap' }}>{fence.name}</span>
                  </div>
                ))}
                <div className="boundary-marker">Green Valley Farm — Geofence Active</div>
                {/* Animal pins */}
                {animals.map(a => {
                  const g = getGps(a.docId);
                  const coords = toMapCoords(g.latitude, g.longitude);
                  const hc = hClass(a.healthStatus);
                  const isSelected = selectedAnimal?.docId === a.docId;
                  return (
                    <button key={a.docId}
                      className={`map-animal-pin ${hc} ${isSelected ? 'selected' : ''}`}
                      style={{ left: coords.x, top: coords.y }}
                      onClick={() => setSelectedAnimal(a)}
                      title={a.name}
                    >
                      <span className="pin-pulse"></span>
                      <span className="pin-center-dot"></span>
                      <span className="pin-label-pop">{a.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* FR-F31: Movement history for selected animal */}
          {selectedAnimal && (
            <div className="map-card-wrapper" style={{ padding: '1rem' }}>
              <h4 style={{ color: '#fff', fontFamily: 'var(--font-heading)', fontSize: '1rem', margin: '0 0 0.75rem 0' }}>
                <Clock size={16} color="var(--secondary)" style={{ marginRight: '0.5rem' }} />FR-F31 Movement History — {selectedAnimal.name}
              </h4>
              {loadingHistory ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Loading history...</p>
              ) : (
                <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {gpsHistory.map((loc, i) => (
                    <div key={loc.docId} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '0.5rem', fontSize: '0.72rem', padding: '0.5rem 0.75rem', background: i === 0 ? 'rgba(16,185,129,0.05)' : 'rgba(255,255,255,0.01)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
                      <span style={{ color: '#fff' }}>{loc.latitude?.toFixed(5)}, {loc.longitude?.toFixed(5)}</span>
                      <span style={{ color: 'var(--text-muted)' }}>Alt: {loc.altitude?.toFixed(0)}m</span>
                      <span style={{ color: loc.isInsideGeofence ? 'var(--primary)' : 'var(--danger)' }}>
                        {loc.isInsideGeofence ? '✅ Inside' : '⚠️ Outside'}
                      </span>
                      <span style={{ color: 'var(--text-dark)' }}>{fmtTime(loc.timestamp)}</span>
                    </div>
                  ))}
                  {gpsHistory.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>No movement history available.</p>}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
