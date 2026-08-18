// GPSTab.jsx — FR-F30 to FR-F33
// Live location, movement history, geofence boundary, locate missing animals
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, Navigation, AlertTriangle, Clock, Map as MapIcon } from 'lucide-react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';

export default function GPSTab({ animals, latestGps, geofences, laptopCoords, geofenceRadius, tick }) {
  const [selectedAnimal, setSelectedAnimal] = useState(null);
  const [gpsHistory, setGpsHistory]         = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef({});
  const circleRef = useRef(null);
  const laptopMarkerRef = useRef(null);

  // Auto select first animal if none selected
  useEffect(() => {
    if (!selectedAnimal && animals.length > 0) {
      setSelectedAnimal(animals[0]);
    }
  }, [animals, selectedAnimal]);

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

  // Geofence distance calculation helper
  const checkGeofence = useCallback((lat, lng) => {
    if (!lat || !lng) return true;
    const center = laptopCoords || { lat: 7.291, lng: 80.633 };
    const radiusMeters = geofenceRadius || 200;

    const R = 6371000;
    const dLat = (lat - center.lat) * Math.PI / 180;
    const dLng = (lng - center.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(center.lat * Math.PI / 180) * Math.cos(lat * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;

    return distance <= radiusMeters;
  }, [laptopCoords, geofenceRadius]);

  // Animal marker updates helper
  const updateAnimalMarkers = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map || !window.L) return;

    // Clear old markers no longer in current list
    Object.keys(markersRef.current).forEach(id => {
      if (!animals.some(a => a.docId === id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });

    // Create or update marker per animal coordinates
    animals.forEach(a => {
      const g = latestGps[a.docId] || {};
      if (!g.latitude || !g.longitude) return;

      const lat = g.latitude;
      const lng = g.longitude;
      const isSelected = selectedAnimal?.docId === a.docId;

      // Geofence containment check
      const isInside = g.isInsideGeofence !== undefined ? g.isInsideGeofence : checkGeofence(lat, lng);

      // Color logic:
      // If outside geofence -> vibrant red
      // If critical health -> vibrant red
      // If at risk -> warning amber
      // Otherwise -> VIBRANT EMERALD GREEN!
      const pinColor = !isInside
        ? '#ef4444'
        : (a.healthStatus === 'critical' ? '#ef4444' : a.healthStatus === 'at_risk' ? '#f59e0b' : '#10b981');

      const statusTag = !isInside ? '⚠️ Outside' : '✅ Inside';

      const customIcon = window.L.divIcon({
        className: 'custom-leaflet-pin',
        html: `
          <div class="leaflet-animal-pin" style="position: relative; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;">
            <div style="position: absolute; width: 34px; height: 34px; border-radius: 50%; border: 2.5px solid ${pinColor}; animation: radar-ping 2s infinite; pointer-events: none;"></div>
            <div style="width: 18px; height: 18px; border-radius: 50%; background: ${pinColor}; border: 3px solid #ffffff; box-shadow: 0 0 14px ${pinColor}, 0 2px 8px rgba(0,0,0,0.8); z-index: 10; cursor: pointer; display: flex; align-items: center; justify-content: center;">
              <div style="width: 6px; height: 6px; border-radius: 50%; background: #ffffff;"></div>
            </div>
            <div style="position: absolute; bottom: 36px; left: 50%; transform: translateX(-50%); background: rgba(12, 17, 30, 0.95); color: #ffffff; border: 1.5px solid ${isSelected ? 'var(--primary)' : 'var(--border-glass)'}; font-weight: 700; font-size: 0.72rem; padding: 4px 10px; border-radius: 8px; white-space: nowrap; box-shadow: 0 4px 14px rgba(0,0,0,0.8); z-index: 20; pointer-events: auto; display: flex; align-items: center; gap: 5px;">
              <span style="width: 8px; height: 8px; border-radius: 50%; background: ${pinColor}; display: inline-block;"></span>
              <span>${a.name}</span>
              <span style="font-weight: 500; font-size: 0.65rem; color: ${!isInside ? 'var(--danger)' : 'var(--primary)'};">(${statusTag})</span>
            </div>
          </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
      });

      if (markersRef.current[a.docId]) {
        markersRef.current[a.docId].setLatLng([lat, lng]);
        markersRef.current[a.docId].setIcon(customIcon);
        markersRef.current[a.docId].setZIndexOffset(isSelected ? 4000 : 3000);
      } else {
        const marker = window.L.marker([lat, lng], { 
          icon: customIcon,
          zIndexOffset: isSelected ? 4000 : 3000 
        })
          .addTo(map)
          .on('click', () => setSelectedAnimal(a));
        markersRef.current[a.docId] = marker;
      }
    });
  }, [animals, latestGps, selectedAnimal, checkGeofence]);

  // Leaflet Map Initialization and Geofence Circle Setup
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (!window.L) {
      console.warn("Leaflet library not loaded yet.");
      return;
    }

    const center = laptopCoords || { lat: 7.291, lng: 80.633 };

    if (!mapInstanceRef.current) {
      // Initialize map instance
      const map = window.L.map(mapContainerRef.current, {
        zoomControl: true,
        attributionControl: false
      }).setView([center.lat, center.lng], 15);

      // Add OpenStreetMap tiles
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
      }).addTo(map);

      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;

    // Pan map to new center coordinates if laptop base location changes
    map.panTo([center.lat, center.lng]);

    // Redraw geofence circle around the laptop base location
    if (circleRef.current) {
      circleRef.current.remove();
    }
    circleRef.current = window.L.circle([center.lat, center.lng], {
      color: '#ef4444',
      fillColor: '#ef4444',
      fillOpacity: 0.08,
      radius: geofenceRadius || 200,
      weight: 1.5,
      dashArray: '5, 5'
    }).addTo(map);

    // Redraw laptop beacon marker (subtle blue center beacon)
    if (laptopMarkerRef.current) {
      laptopMarkerRef.current.remove();
    }
    const laptopIcon = window.L.divIcon({
      className: 'custom-leaflet-pin',
      html: `<div style="width: 10px; height: 10px; background: #3b82f6; border: 2px solid rgba(255,255,255,0.8); border-radius: 50%; opacity: 0.6;" title="Geofence Base Center"></div>`,
      iconSize: [10, 10],
      iconAnchor: [5, 5]
    });
    laptopMarkerRef.current = window.L.marker([center.lat, center.lng], { icon: laptopIcon, zIndexOffset: 10 })
      .addTo(map)
      .bindPopup('<b>Laptop Base Location (Geofence Center)</b>');

    // Render animal markers immediately on map setup
    updateAnimalMarkers();

  }, [laptopCoords, geofenceRadius, updateAnimalMarkers]);

  // Animal marker updates effect
  useEffect(() => {
    updateAnimalMarkers();
  }, [updateAnimalMarkers, tick]);

  // Pan to selected animal coordinate change
  useEffect(() => {
    if (!selectedAnimal) return;
    const g = latestGps[selectedAnimal.docId] || {};
    if (g.latitude && g.longitude && mapInstanceRef.current) {
      mapInstanceRef.current.setView([g.latitude, g.longitude], 16, { animate: true });
    }
  }, [selectedAnimal?.docId, latestGps]);

  // Clean map instance on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

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
            const isInside   = g.isInsideGeofence !== undefined ? g.isInsideGeofence : checkGeofence(g.latitude, g.longitude);

            return (
              <div
                key={a.docId}
                className="map-card-wrapper"
                style={{ padding: '1rem', cursor: 'pointer', borderColor: isSelected ? 'var(--primary)' : !isInside ? 'rgba(239,68,68,0.4)' : 'var(--border-glass)' }}
                onClick={() => setSelectedAnimal(a)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <MapPin size={18} color={!isInside ? 'var(--danger)' : 'var(--primary)'} />
                    <div>
                      <h6 style={{ color: '#fff', margin: 0, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                        {a.name} 
                        <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.75rem' }}>({a.tagNumber})</span>
                      </h6>
                      <p style={{ color: 'var(--text-muted)', margin: '0.15rem 0 0 0', fontSize: '0.72rem' }}>
                        {g.latitude ? `${g.latitude.toFixed(5)}, ${g.longitude.toFixed(5)}` : 'No GPS data'}
                      </p>
                      {g.timestamp && (
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-dark)', display: 'block', marginTop: '0.2rem' }}>
                          Last update: {fmtTime(g.timestamp)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.65rem', padding: '0.25rem 0.7rem', borderRadius: '20px', fontWeight: 600, color: !isInside ? 'var(--danger)' : 'var(--primary)', background: !isInside ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)', border: `1px solid ${!isInside ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}` }}>
                      {!isInside ? '⚠️ Outside' : '✅ Inside'}
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
              <MapIcon size={16} color="var(--primary)" style={{ marginRight: '0.5rem' }} />FR-F32 Pasture Map & Geofence Boundary
            </h4>
            
            {/* Interactive Leaflet Map Container */}
            <div 
              ref={mapContainerRef} 
              style={{ 
                height: '350px', 
                width: '100%', 
                borderRadius: '12px',
                position: 'relative',
                zIndex: 1
              }} 
            />
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
