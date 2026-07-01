import React, { useState, useEffect } from 'react';
import {
  Activity, MapPin, Thermometer, Heart, AlertTriangle,
  Search, Filter, LogOut, Map, ChevronRight,
  Bell, Compass, User, Wifi, WifiOff
} from 'lucide-react';
import {
  collection, query, where, onSnapshot, orderBy, limit
} from 'firebase/firestore';
import { db } from '../firebase';

export default function Dashboard({ onLogout, userEmail }) {
  const [animals, setAnimals]             = useState([]);
  const [alerts, setAlerts]               = useState([]);
  const [latestReadings, setLatestReadings] = useState({}); // { animalId: sensorDoc }
  const [latestGps, setLatestGps]         = useState({});   // { animalId: gpsDoc }
  const [selectedAnimal, setSelectedAnimal] = useState(null);
  const [searchQuery, setSearchQuery]     = useState('');
  const [filterHealth, setFilterHealth]   = useState('All');
  const [loading, setLoading]             = useState(true);

  // ── 1. Listen to animals collection ──────────────────────
  useEffect(() => {
    const q = query(collection(db, 'animals'), where('isActive', '==', true));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ docId: d.id, ...d.data() }));
      setAnimals(list);
      setLoading(false);

      // Once animals are loaded, subscribe to their subcollections
      list.forEach(animal => {
        subscribeToSensorReadings(animal.docId);
        subscribeToGps(animal.docId);
      });
    }, (err) => {
      console.error('Animals listener error:', err);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // ── 2. Live sensor readings per animal ───────────────────
  const subscribeToSensorReadings = (animalId) => {
    const q = query(
      collection(db, 'animals', animalId, 'sensor_readings'),
      orderBy('timestamp', 'desc'),
      limit(1)
    );
    onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const data = snap.docs[0].data();
        setLatestReadings(prev => ({ ...prev, [animalId]: data }));
      }
    });
  };

  // ── 3. Live GPS per animal ────────────────────────────────
  const subscribeToGps = (animalId) => {
    const q = query(
      collection(db, 'animals', animalId, 'gps_locations'),
      orderBy('timestamp', 'desc'),
      limit(1)
    );
    onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const data = snap.docs[0].data();
        setLatestGps(prev => ({ ...prev, [animalId]: data }));
      }
    });
  };

  // ── 4. Live alerts ────────────────────────────────────────
  useEffect(() => {
    const q = query(
      collection(db, 'alerts'),
      orderBy('triggeredAt', 'desc'),
      limit(10)
    );
    const unsub = onSnapshot(q, (snap) => {
      setAlerts(snap.docs.map(d => ({ docId: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  // ── Computed values ───────────────────────────────────────
  const enrichedAnimals = animals.map(a => {
    const reading = latestReadings[a.docId] || {};
    const gps     = latestGps[a.docId] || {};
    return {
      ...a,
      temp:       reading.bodyTemperature ?? '—',
      heartRate:  reading.heartRate       ?? '—',
      activity:   reading.activityLevel   ?? 'unknown',
      battery:    reading.batteryLevel    ?? '—',
      lat:        gps.latitude            ?? null,
      lng:        gps.longitude           ?? null,
      insideFence: gps.isInsideGeofence   ?? true,
    };
  });

  const totalAnimals  = enrichedAnimals.length;
  const avgTemp = totalAnimals > 0
    ? parseFloat(
        (enrichedAnimals
          .filter(a => typeof a.temp === 'number')
          .reduce((acc, a) => acc + a.temp, 0) /
         (enrichedAnimals.filter(a => typeof a.temp === 'number').length || 1)
        ).toFixed(1)
      )
    : 0;

  const healthCounts = enrichedAnimals.reduce((acc, a) => {
    const h = (a.healthStatus || 'healthy').toLowerCase();
    if (h === 'healthy')  acc.healthy++;
    else if (h === 'at_risk') acc.warning++;
    else if (h === 'critical') acc.critical++;
    return acc;
  }, { healthy: 0, warning: 0, critical: 0 });

  const activityCounts = enrichedAnimals.reduce((acc, a) => {
    const act = (a.activity || 'unknown').toLowerCase();
    if (act === 'walking') acc.walking++;
    else if (act === 'running') acc.running++;
    else if (act === 'resting') acc.resting++;
    return acc;
  }, { walking: 0, running: 0, resting: 0 });

  // ── Filters ───────────────────────────────────────────────
  const filteredAnimals = enrichedAnimals.filter(a => {
    const matchSearch =
      (a.tagNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (a.name      || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (a.species   || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchHealth =
      filterHealth === 'All' ||
      (filterHealth === 'Healthy'  && a.healthStatus === 'healthy')  ||
      (filterHealth === 'Warning'  && a.healthStatus === 'at_risk')  ||
      (filterHealth === 'Critical' && a.healthStatus === 'critical');
    return matchSearch && matchHealth;
  });

  // ── GPS map coords helper ─────────────────────────────────
  // Use Sri Lanka–centered bounding box around seeded coordinates
  const MIN_LAT = 7.280, MAX_LAT = 7.300;
  const MIN_LNG = 80.625, MAX_LNG = 80.645;
  const getMapCoords = (lat, lng) => {
    if (lat === null || lng === null) return { x: '50%', y: '50%' };
    const x = ((lng - MIN_LNG) / (MAX_LNG - MIN_LNG)) * 100;
    const y = 100 - (((lat - MIN_LAT) / (MAX_LAT - MIN_LAT)) * 100);
    return { x: `${Math.min(Math.max(x, 2), 96)}%`, y: `${Math.min(Math.max(y, 2), 92)}%` };
  };

  const healthClass = (status) => {
    if (status === 'critical') return 'critical';
    if (status === 'at_risk')  return 'warning';
    return 'healthy';
  };

  const formatTime = (ts) => {
    if (!ts) return '—';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    const diff = Math.floor((Date.now() - date.getTime()) / 60000);
    if (diff < 1)  return 'Just now';
    if (diff < 60) return `${diff}m ago`;
    return `${Math.floor(diff / 60)}h ago`;
  };

  if (loading) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', flexDirection:'column', background:'#060913', color:'#fff' }}>
        <div className="spinner" style={{ width:'36px', height:'36px', borderWidth:'3.5px', borderTopColor:'var(--primary)', marginBottom:'1.25rem' }}></div>
        <p style={{ fontFamily:'Outfit,sans-serif', color:'var(--text-muted)', fontSize:'0.8rem', textTransform:'uppercase', letterSpacing:'0.08em' }}>Loading herd telemetry...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Header */}
      <header className="dashboard-header-nav">
        <div className="nav-brand">
          <div className="logo-icon-small">
            <Activity size={18} color="#060913" strokeWidth={2.5} />
          </div>
          <span className="brand-text">LIVETRACK AI</span>
          <span className="badge-system">LIVE • {totalAnimals} Animals</span>
        </div>
        <div className="nav-actions">
          <div className="user-profile">
            <div className="avatar"><User size={14} color="var(--primary)" /></div>
            <span className="user-email">{userEmail}</span>
          </div>
          <button className="btn-logout" onClick={onLogout}>
            <LogOut size={16} /><span>Sign Out</span>
          </button>
        </div>
      </header>

      <main className="dashboard-content">

        {/* KPI Row */}
        <section className="kpi-section">

          {/* Avg Temp */}
          <div className="metric-card">
            <div className="metric-icon bg-emerald">
              <Thermometer size={20} color="var(--primary)" />
            </div>
            <div className="metric-info">
              <span className="metric-label">Average Temperature</span>
              <div className="metric-value-row">
                <h3>{avgTemp}°C</h3>
                <span className={`status-indicator-badge ${avgTemp > 39.8 ? '' : 'positive'}`}>
                  {avgTemp > 39.8 ? 'Elevated' : 'Normal'}
                </span>
              </div>
              <p className="metric-sub">Target Range: 38.5°C – 39.5°C</p>
            </div>
          </div>

          {/* Health Status */}
          <div className="metric-card">
            <div className="metric-icon bg-cyan">
              <Heart size={20} color="var(--secondary)" />
            </div>
            <div className="metric-info">
              <span className="metric-label">Herd Vitals Check</span>
              <div className="health-bar-container">
                <div className="health-segment healthy"  style={{ width: `${totalAnimals ? (healthCounts.healthy  / totalAnimals) * 100 : 0}%` }} />
                <div className="health-segment warning"  style={{ width: `${totalAnimals ? (healthCounts.warning  / totalAnimals) * 100 : 0}%` }} />
                <div className="health-segment critical" style={{ width: `${totalAnimals ? (healthCounts.critical / totalAnimals) * 100 : 0}%` }} />
              </div>
              <div className="health-breakdown">
                <span className="health-b-item green"><span className="indicator-dot"></span>{healthCounts.healthy} Healthy</span>
                <span className="health-b-item orange"><span className="indicator-dot"></span>{healthCounts.warning} At Risk</span>
                <span className="health-b-item red"><span className="indicator-dot"></span>{healthCounts.critical} Critical</span>
              </div>
            </div>
          </div>

          {/* Activity */}
          <div className="metric-card">
            <div className="metric-icon bg-purple">
              <Compass size={20} color="#c084fc" />
            </div>
            <div className="metric-info">
              <span className="metric-label">Current Animal Activity</span>
              <div className="activity-status-grid">
                <div className="act-status-item">
                  <span className="act-count">{activityCounts.resting}</span>
                  <span className="act-lbl">Resting</span>
                </div>
                <div className="act-status-item">
                  <span className="act-count">{activityCounts.walking}</span>
                  <span className="act-lbl">Walking</span>
                </div>
                <div className="act-status-item">
                  <span className="act-count">{activityCounts.running}</span>
                  <span className="act-lbl">Running</span>
                </div>
              </div>
            </div>
          </div>

        </section>

        {/* GPS + Inventory */}
        <section className="telemetry-grid">

          {/* GPS Map */}
          <div className="map-card-wrapper">
            <div className="map-card-header">
              <div className="title-block">
                <Map size={18} color="var(--primary)" />
                <h4>Live GPS Tracking Pasture</h4>
              </div>
              <div className="map-legend">
                <span className="legend-dot healthy"></span>Healthy
                <span className="legend-dot warning"></span>At Risk
                <span className="legend-dot critical"></span>Critical
              </div>
            </div>

            <div className="gps-map-container">
              <div className="map-grid-layer">
                <div className="scan-line"></div>
                <div className="boundary-marker">Green Valley Farm — Geofence Active</div>

                {enrichedAnimals.map(animal => {
                  const coords    = getMapCoords(animal.lat, animal.lng);
                  const isSelected = selectedAnimal?.docId === animal.docId;
                  const hClass    = healthClass(animal.healthStatus);
                  return (
                    <button
                      key={animal.docId}
                      className={`map-animal-pin ${hClass} ${isSelected ? 'selected' : ''}`}
                      style={{ left: coords.x, top: coords.y }}
                      onClick={() => setSelectedAnimal(animal)}
                      title={`${animal.name} (${animal.tagNumber})`}
                    >
                      <span className="pin-pulse"></span>
                      <span className="pin-center-dot"></span>
                      <span className="pin-label-pop">{animal.name}</span>
                    </button>
                  );
                })}
              </div>

              {selectedAnimal ? (
                <div className="map-detail-popover">
                  <div className="popover-header">
                    <h5>{selectedAnimal.name}</h5>
                    <span className="popover-tag">{selectedAnimal.tagNumber}</span>
                  </div>
                  <div className="popover-body">
                    <p><span>Species:</span> {selectedAnimal.species} ({selectedAnimal.breed})</p>
                    <p><span>Status:</span>
                      <span className={`status-text ${healthClass(selectedAnimal.healthStatus)}`}>
                        {' '}{selectedAnimal.healthStatus?.replace('_', ' ')}
                      </span>
                    </p>
                    <p><span>Temperature:</span> {selectedAnimal.temp !== '—' ? `${selectedAnimal.temp} °C` : '—'}</p>
                    <p><span>Heart Rate:</span> {selectedAnimal.heartRate !== '—' ? `${selectedAnimal.heartRate} BPM` : '—'}</p>
                    <p><span>Activity:</span> {selectedAnimal.activity}</p>
                    <p><span>Battery:</span> {selectedAnimal.battery !== '—' ? `${selectedAnimal.battery}%` : '—'}</p>
                    {selectedAnimal.lat && (
                      <p className="coords"><span>GPS:</span> {selectedAnimal.lat.toFixed(4)}, {selectedAnimal.lng.toFixed(4)}</p>
                    )}
                    <p><span>Geofence:</span> {selectedAnimal.insideFence ? '✅ Inside' : '⚠️ Outside'}</p>
                  </div>
                  <div className="popover-footer">
                    <button className="btn-close-pop" onClick={() => setSelectedAnimal(null)}>Dismiss</button>
                  </div>
                </div>
              ) : (
                <div className="map-help-tip">
                  Click any telemetry node to inspect live vitals from Firestore.
                </div>
              )}
            </div>
          </div>

          {/* Inventory + Alerts */}
          <div className="inventory-card-wrapper">

            {/* Search/Filter */}
            <div className="inventory-search-bar">
              <div className="search-input-wrapper">
                <Search size={16} className="search-ico" />
                <input
                  type="text"
                  placeholder="Search by tag, name, species..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="filter-dropdown-wrapper">
                <Filter size={14} className="filter-ico" />
                <select value={filterHealth} onChange={e => setFilterHealth(e.target.value)}>
                  <option value="All">All Health</option>
                  <option value="Healthy">Healthy</option>
                  <option value="Warning">At Risk</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>
            </div>

            {/* Animal List */}
            <div className="inventory-list">
              {filteredAnimals.length > 0 ? filteredAnimals.map(animal => {
                const isSelected = selectedAnimal?.docId === animal.docId;
                const hClass     = healthClass(animal.healthStatus);
                return (
                  <div
                    key={animal.docId}
                    className={`inventory-item ${isSelected ? 'active' : ''}`}
                    onClick={() => setSelectedAnimal(animal)}
                  >
                    <div className="item-left">
                      <div className={`health-indicator-border ${hClass}`}></div>
                      <div className="item-title-block">
                        <h6>{animal.name}</h6>
                        <span>{animal.tagNumber} • {animal.species} ({animal.breed})</span>
                      </div>
                    </div>
                    <div className="item-right">
                      <div className="item-vital">
                        <Thermometer size={12} color="var(--text-muted)" />
                        <span>{animal.temp !== '—' ? `${animal.temp}°C` : '—'}</span>
                      </div>
                      <div className={`activity-pill ${(animal.activity || 'unknown').toLowerCase()}`}>
                        {animal.activity || '—'}
                      </div>
                      <ChevronRight size={14} className="chevron" />
                    </div>
                  </div>
                );
              }) : (
                <div className="empty-herd-search">No animals match the specified filters.</div>
              )}
            </div>

            {/* Live Alerts from Firestore */}
            <div className="live-logs-section">
              <div className="logs-header">
                <Bell size={14} color="var(--primary)" />
                <span>LIVE ALERTS FROM DATABASE</span>
              </div>
              <div className="logs-feed">
                {alerts.length === 0 ? (
                  <div className="log-entry" style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                    No active alerts in system.
                  </div>
                ) : alerts.map(alert => (
                  <div key={alert.docId} className={`log-entry ${alert.severity === 'critical' ? 'critical' : 'warning'}`}>
                    <AlertTriangle size={12} className="log-ico" />
                    <div className="log-text-block">
                      <p style={{ fontWeight: 600 }}>{alert.title}</p>
                      <p>{alert.message}</p>
                      <span>{formatTime(alert.triggeredAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </section>
      </main>
    </div>
  );
}
