// ActivityRecognitionTab.jsx — Animals Activity Recognition ML Tab
// Implements client-side MPU6050 feature extraction and Decision Tree ML classifier
import React, { useState, useEffect } from 'react';
import { Cpu, Activity, Play, CheckCircle2, AlertTriangle, RefreshCw, BarChart2, Table, HelpCircle, Layers } from 'lucide-react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { predictActivity } from '../../utils/activityModel';

export default function ActivityRecognitionTab({ animals, latestReadings }) {
  const [activeSubTab, setActiveSubTab] = useState('live'); // 'live' or 'validation'
  const [selectedAnimal, setSelectedAnimal] = useState(animals[0] || null);
  const [readingsHistory, setReadingsHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);

  // Test Dataset states
  const [testRows, setTestRows] = useState([]);
  const [loadingTest, setLoadingTest] = useState(false);
  const [accuracy, setAccuracy] = useState(0);
  const [confusionMatrix, setConfusionMatrix] = useState({});
  const [testFilter, setTestFilter] = useState('All');
  const [selectedTestRow, setSelectedTestRow] = useState(null);

  // Set default selected animal once list loads
  useEffect(() => {
    if (!selectedAnimal && animals.length > 0) {
      setSelectedAnimal(animals[0]);
    }
  }, [animals, selectedAnimal]);

  // Load Firestore readings history for selected animal (last 50 rows)
  useEffect(() => {
    if (!selectedAnimal) return;
    setLoadingHistory(true);
    const q = query(
      collection(db, 'animals', selectedAnimal.docId, 'sensor_readings'),
      orderBy('timestamp', 'desc'),
      limit(50)
    );
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ docId: d.id, ...d.data() }));
      // Firestore returns latest first. Reverse to make it chronological
      setReadingsHistory(list.reverse());
      setLoadingHistory(false);
    });
    return () => unsub();
  }, [selectedAnimal?.docId]);

  // Merge incoming live readings from props into history buffer
  useEffect(() => {
    if (!selectedAnimal) return;
    const latest = latestReadings[selectedAnimal.docId];
    if (!latest) return;

    setReadingsHistory(prev => {
      // Avoid duplicate timestamps
      const dup = prev.some(r => {
        if (!r.timestamp || !latest.timestamp) return false;
        const t1 = r.timestamp.seconds || new Date(r.timestamp).getTime()/1000;
        const t2 = latest.timestamp.seconds || new Date(latest.timestamp).getTime()/1000;
        return Math.abs(t1 - t2) < 0.5;
      });
      if (dup) return prev;

      const next = [...prev, latest];
      if (next.length > 50) next.shift();
      return next;
    });
  }, [latestReadings, selectedAnimal?.docId]);

  // Load test dataset CSV from public folder
  useEffect(() => {
    if (activeSubTab !== 'validation' || testRows.length > 0) return;
    setLoadingTest(true);
    fetch('/activity_recognition_test.csv')
      .then(res => res.text())
      .then(text => {
        const parsed = parseCSV(text);
        
        // Compute predictions and stats
        let correct = 0;
        const matrix = {
          'Abnormal Movement': { 'Abnormal Movement': 0, 'Resting': 0, 'Running': 0, 'Sleeping': 0, 'Standing': 0, 'Walking': 0 },
          'Resting': { 'Abnormal Movement': 0, 'Resting': 0, 'Running': 0, 'Sleeping': 0, 'Standing': 0, 'Walking': 0 },
          'Running': { 'Abnormal Movement': 0, 'Resting': 0, 'Running': 0, 'Sleeping': 0, 'Standing': 0, 'Walking': 0 },
          'Sleeping': { 'Abnormal Movement': 0, 'Resting': 0, 'Running': 0, 'Sleeping': 0, 'Standing': 0, 'Walking': 0 },
          'Standing': { 'Abnormal Movement': 0, 'Resting': 0, 'Running': 0, 'Sleeping': 0, 'Standing': 0, 'Walking': 0 },
          'Walking': { 'Abnormal Movement': 0, 'Resting': 0, 'Running': 0, 'Sleeping': 0, 'Standing': 0, 'Walking': 0 }
        };

        const scoredRows = parsed.map((row, index) => {
          const pred = predictActivity(row);
          const isCorrect = pred === row.Activity;
          if (isCorrect) correct++;
          
          if (matrix[row.Activity] && matrix[row.Activity][pred] !== undefined) {
            matrix[row.Activity][pred]++;
          }

          return {
            rowId: index + 1,
            ...row,
            Predicted: pred,
            isCorrect
          };
        });

        setTestRows(scoredRows);
        setAccuracy((correct / scoredRows.length) * 100);
        setConfusionMatrix(matrix);
        setLoadingTest(false);
      })
      .catch(err => {
        console.error("Error reading test dataset:", err);
        setLoadingTest(false);
      });
  }, [activeSubTab, testRows.length]);

  // Helper: custom lightweight CSV parser
  const parseCSV = (text) => {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const headers = lines[0].split(',');
    return lines.slice(1).map(line => {
      const values = line.split(',');
      return headers.reduce((obj, header, i) => {
        const val = values[i];
        obj[header] = isNaN(val) ? val : parseFloat(val);
        return obj;
      }, {});
    });
  };

  // Helper: JavaScript feature extraction from raw accelerometer arrays
  const extractFeatures = (readings) => {
    if (!readings || readings.length < 5) return null;

    const ax = readings.map(r => r.accelerometerX ?? 0);
    const ay = readings.map(r => r.accelerometerY ?? 0);
    const az = readings.map(r => r.accelerometerZ ?? 1); // gravity defaults to 1g
    const N = readings.length;

    // Means
    const meanX = ax.reduce((s, v) => s + v, 0) / N;
    const meanY = ay.reduce((s, v) => s + v, 0) / N;
    const meanZ = az.reduce((s, v) => s + v, 0) / N;

    // Standard Deviations
    const stdX = Math.sqrt(ax.reduce((s, v) => s + Math.pow(v - meanX, 2), 0) / N);
    const stdY = Math.sqrt(ay.reduce((s, v) => s + Math.pow(v - meanY, 2), 0) / N);
    const stdZ = Math.sqrt(az.reduce((s, v) => s + Math.pow(v - meanZ, 2), 0) / N);

    // Magnitudes
    const magnitudes = ax.map((_, i) => Math.sqrt(ax[i]**2 + ay[i]**2 + az[i]**2));
    const minMag = Math.min(...magnitudes);
    const maxMag = Math.max(...magnitudes);
    const meanMag = magnitudes.reduce((s, v) => s + v, 0) / N;

    // Signal Magnitude Area (SMA)
    const absSumX = ax.reduce((s, v) => s + Math.abs(v), 0);
    const absSumY = ay.reduce((s, v) => s + Math.abs(v), 0);
    const absSumZ = az.reduce((s, v) => s + Math.abs(v), 0);
    const sma = (absSumX + absSumY + absSumZ) / N;

    return {
      Mean_AccX: meanX,
      Mean_AccY: meanY,
      Mean_AccZ: meanZ,
      Std_AccX: stdX,
      Std_AccY: stdY,
      Std_AccZ: stdZ,
      Min_Magnitude: minMag,
      Max_Magnitude: maxMag,
      Mean_Magnitude: meanMag,
      SMA: sma
    };
  };

  // Run feature extraction and classify activity
  const features = extractFeatures(readingsHistory);
  const prediction = features ? predictActivity(features) : 'Insufficient Data';

  // Activity UI styling definitions
  const getActivityColor = (act) => {
    switch (act) {
      case 'Sleeping': return 'var(--primary-glow)';
      case 'Resting': return 'rgba(255,255,255,0.05)';
      case 'Walking': return 'rgba(16, 185, 129, 0.1)';
      case 'Running': return 'rgba(245, 158, 11, 0.15)';
      case 'Standing': return 'rgba(59, 130, 246, 0.1)';
      case 'Abnormal Movement': return 'rgba(239, 68, 68, 0.15)';
      default: return 'rgba(255,255,255,0.02)';
    }
  };

  const getActivityBorder = (act) => {
    switch (act) {
      case 'Sleeping': return 'var(--primary)';
      case 'Resting': return 'var(--border-glass)';
      case 'Walking': return 'var(--primary)';
      case 'Running': return '#f59e0b';
      case 'Standing': return '#3b82f6';
      case 'Abnormal Movement': return 'var(--danger)';
      default: return 'var(--border-glass)';
    }
  };

  const getActivityTextColor = (act) => {
    switch (act) {
      case 'Sleeping': return 'var(--primary)';
      case 'Resting': return 'var(--text-muted)';
      case 'Walking': return 'var(--primary)';
      case 'Running': return '#f59e0b';
      case 'Standing': return '#3b82f6';
      case 'Abnormal Movement': return 'var(--danger)';
      default: return '#fff';
    }
  };

  // Generate simulated activity telemetry bursts for testing
  const startSimulation = (type) => {
    if (isSimulating) return;
    setIsSimulating(true);
    let count = 0;
    
    // Set baseline telemetry amplitudes depending on activity type
    let amp = 0.05, noise = 0.02, zBias = 1.0;
    if (type === 'Running') { amp = 1.2; noise = 0.3; zBias = 0.5; }
    else if (type === 'Walking') { amp = 0.4; noise = 0.1; zBias = 0.9; }
    else if (type === 'Abnormal Movement') { amp = 2.5; noise = 0.6; zBias = 1.5; }
    else if (type === 'Sleeping') { amp = 0.01; noise = 0.005; zBias = 1.02; }

    const interval = setInterval(() => {
      const theta = count * 0.5;
      const rawX = Math.sin(theta) * amp + (Math.random() - 0.5) * noise;
      const rawY = Math.cos(theta * 1.2) * amp + (Math.random() - 0.5) * noise;
      const rawZ = zBias + Math.sin(theta * 0.8) * (amp * 0.5) + (Math.random() - 0.5) * noise;

      const reading = {
        accelerometerX: parseFloat(rawX.toFixed(3)),
        accelerometerY: parseFloat(rawY.toFixed(3)),
        accelerometerZ: parseFloat(rawZ.toFixed(3)),
        bodyTemperature: type === 'Running' ? 39.4 : type === 'Sleeping' ? 38.2 : 38.6,
        timestamp: { seconds: Date.now() / 1000 }
      };

      setReadingsHistory(prev => {
        const next = [...prev, reading];
        if (next.length > 50) next.shift();
        return next;
      });

      count++;
      if (count >= 50) {
        clearInterval(interval);
        setIsSimulating(false);
      }
    }, 100);
  };

  const filteredTestRows = testFilter === 'All'
    ? testRows
    : testFilter === 'Correct'
      ? testRows.filter(r => r.isCorrect)
      : testRows.filter(r => !r.isCorrect);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Header Banner */}
      <div className="map-card-wrapper" style={{ padding: '1.25rem 1.5rem', background: 'linear-gradient(135deg, rgba(6,182,212,0.05) 0%, rgba(99,102,241,0.05) 100%)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ color: '#fff', fontSize: '1.25rem', fontFamily: 'var(--font-heading)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Cpu size={22} color="var(--primary)" />FR-F20–FR-F29 Animals Activity Recognition
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0.4rem 0 0 0' }}>
              Embedded Decision Tree classifier model using standard MPU6050 accelerometer sliding-window features (10 statistics per axis) to classify cattle behaviors.
            </p>
          </div>
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.02)', padding: '0.2rem', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
            <button 
              onClick={() => setActiveSubTab('live')}
              className={`btn-logout ${activeSubTab === 'live' ? 'active' : ''}`}
              style={{ padding: '0.4rem 1rem', fontSize: '0.78rem', background: activeSubTab === 'live' ? 'var(--primary-glow)' : 'transparent', border: 'none', color: activeSubTab === 'live' ? 'var(--primary)' : 'var(--text-muted)' }}
            >
              Live Classifier
            </button>
            <button 
              onClick={() => setActiveSubTab('validation')}
              className={`btn-logout ${activeSubTab === 'validation' ? 'active' : ''}`}
              style={{ padding: '0.4rem 1rem', fontSize: '0.78rem', background: activeSubTab === 'validation' ? 'var(--primary-glow)' : 'transparent', border: 'none', color: activeSubTab === 'validation' ? 'var(--primary)' : 'var(--text-muted)' }}
            >
              Model Validation
            </button>
          </div>
        </div>
      </div>

      {activeSubTab === 'live' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: '1.5rem' }}>
          
          {/* Left panel: Animal selector list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <h5 style={{ color: '#fff', fontFamily: 'var(--font-heading)', fontSize: '0.9rem', margin: 0 }}>Select Livestock Subject</h5>
            {animals.map(a => {
              const isSelected = selectedAnimal?.docId === a.docId;
              return (
                <div 
                  key={a.docId}
                  className="map-card-wrapper"
                  style={{ padding: '0.85rem 1rem', cursor: 'pointer', borderColor: isSelected ? 'var(--primary)' : 'var(--border-glass)', background: isSelected ? 'rgba(6,182,212,0.02)' : 'rgba(255,255,255,0.01)' }}
                  onClick={() => setSelectedAnimal(a)}
                >
                  <h6 style={{ color: '#fff', margin: 0, fontSize: '0.88rem' }}>{a.name} <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.72rem' }}>({a.tagNumber})</span></h6>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{a.species} • {a.breed}</span>
                </div>
              );
            })}
          </div>

          {/* Right panel: Active Classifier */}
          {selectedAnimal ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* Prediction results HUD */}
              <div 
                className="map-card-wrapper" 
                style={{ 
                  padding: '1.5rem', 
                  background: getActivityColor(prediction), 
                  borderColor: getActivityBorder(prediction),
                  transition: 'all 0.3s ease'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '0.68rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>CLASSIFICATION OUTPUT</span>
                    <h2 style={{ fontSize: '2rem', fontWeight: 800, color: getActivityTextColor(prediction), margin: '0.2rem 0 0 0', fontFamily: 'var(--font-heading)' }}>
                      {prediction}
                    </h2>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.5rem' }}>
                      Window buffer: <strong>{readingsHistory.length} / 50 samples</strong> {isSimulating && '(simulating raw stream...)'}
                    </span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ width: '45px', height: '45px', borderRadius: '50%', background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.05)', margin: '0 0 0.5rem auto' }}>
                      <Activity size={20} color={getActivityTextColor(prediction)} className={prediction === 'Running' || prediction === 'Abnormal Movement' ? 'spin-slow' : ''} />
                    </div>
                    <span style={{ fontSize: '0.72rem', color: '#fff' }}>Subject: <strong>{selectedAnimal.name}</strong></span>
                  </div>
                </div>
              </div>

              {/* Accel raw graph monitor simulation */}
              <div className="map-card-wrapper" style={{ padding: '1rem 1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Activity size={14} color="var(--primary)" />
                    <h5 style={{ color: '#fff', fontSize: '0.88rem', margin: 0 }}>MPU6050 Accelerometer Raw Stream (20Hz)</h5>
                  </div>
                  
                  {/* Simulation controls */}
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {['Sleeping', 'Walking', 'Running', 'Abnormal Movement'].map(type => (
                      <button 
                        key={type}
                        onClick={() => startSimulation(type)}
                        disabled={isSimulating}
                        className="btn-logout"
                        style={{ fontSize: '0.65rem', padding: '0.25rem 0.6rem', border: '1px solid rgba(255,255,255,0.05)', cursor: isSimulating ? 'not-allowed' : 'pointer' }}
                      >
                        Simulate {type}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Simulated Sparkline / Graph */}
                <div style={{ height: '120px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.02)', borderRadius: '8px', padding: '0.5rem', display: 'flex', alignItems: 'flex-end', gap: '2px', overflow: 'hidden', position: 'relative' }}>
                  {readingsHistory.map((r, i) => {
                    const mag = Math.sqrt((r.accelerometerX||0)**2 + (r.accelerometerY||0)**2 + (r.accelerometerZ||1)**2);
                    // Map magnitude 0-3g to height 5-95%
                    const heightPercent = Math.min(Math.max((mag / 3) * 100, 5), 95);
                    let color = 'rgba(6,182,212,0.4)';
                    if (mag > 2.0) color = 'rgba(239,68,68,0.6)';
                    else if (mag > 1.2) color = 'rgba(245,158,11,0.5)';

                    return (
                      <div 
                        key={i} 
                        style={{ 
                          flex: 1, 
                          height: `${heightPercent}%`, 
                          background: color, 
                          borderRadius: '1px',
                          minWidth: '2px'
                        }} 
                        title={`Mag: ${mag.toFixed(3)}g`}
                      />
                    );
                  })}
                  {readingsHistory.length === 0 && (
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: 0, textAlign: 'center' }}>
                        No raw readings in buffer. Click one of the simulation buttons above to stream fake telemetry, or connect your physical ESP32 device!
                      </p>
                    </div>
                  )}
                  <div style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', fontSize: '0.62rem', color: 'var(--text-dark)' }}>
                    Buffer size: {readingsHistory.length} / 50 samples
                  </div>
                </div>
              </div>

              {/* Statistical features output */}
              <div className="map-card-wrapper" style={{ padding: '1.25rem' }}>
                <h5 style={{ color: '#fff', fontSize: '0.88rem', margin: '0 0 1rem 0', fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Layers size={14} color="var(--secondary)" />Window Statistical Features Extraction (13-Column Format)
                </h5>
                {features ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem' }}>
                    {[
                      { label: 'Mean AccX', val: features.Mean_AccX },
                      { label: 'Mean AccY', val: features.Mean_AccY },
                      { label: 'Mean AccZ', val: features.Mean_AccZ },
                      { label: 'Std AccX', val: features.Std_AccX },
                      { label: 'Std AccY', val: features.Std_AccY },
                      { label: 'Std AccZ', val: features.Std_AccZ },
                      { label: 'Min Magnitude', val: features.Min_Magnitude },
                      { label: 'Max Magnitude', val: features.Max_Magnitude },
                      { label: 'Mean Magnitude', val: features.Mean_Magnitude },
                      { label: 'SMA', val: features.SMA }
                    ].map(({ label, val }) => (
                      <div key={label} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.03)', padding: '0.5rem 0.75rem', borderRadius: '8px' }}>
                        <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', display: 'block' }}>{label}</span>
                        <strong style={{ fontSize: '0.88rem', color: '#fff' }}>{val.toFixed(4)}</strong>
                      </div>
                    ))}
                    <div style={{ background: 'rgba(6,182,212,0.04)', border: '1px solid rgba(6,182,212,0.1)', padding: '0.5rem 0.75rem', borderRadius: '8px', gridColumn: 'span 2' }}>
                      <span style={{ fontSize: '0.62rem', color: 'var(--primary)', display: 'block' }}>Window Label Prediction</span>
                      <strong style={{ fontSize: '0.88rem', color: 'var(--primary)' }}>{prediction}</strong>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.03)', padding: '0.5rem 0.75rem', borderRadius: '8px', gridColumn: 'span 3' }}>
                      <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', display: 'block' }}>Window ID</span>
                      <strong style={{ fontSize: '0.88rem', color: 'var(--text-dark)' }}>W{Math.floor(Date.now() / 2500).toString().slice(-5)} (Auto-sliced every 2.5s)</strong>
                    </div>
                  </div>
                ) : (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: 0, textAlign: 'center', padding: '1.5rem' }}>
                    Gathering window frames to extract statistical variables... Send raw accelerometer values or trigger a simulator.
                  </p>
                )}
              </div>

            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)' }}>Loading cattle list...</p>
          )}

        </div>
      ) : (
        /* Validation Sub Tab: test dataset analysis */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {loadingTest ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem', flexDirection: 'column', gap: '1rem' }}>
              <RefreshCw size={24} className="spin-slow" color="var(--primary)" />
              <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Processing 400 test cases from activity_recognition_test.csv...</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* Test stats HUD */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: '1.5rem' }}>
                
                {/* Accuracy */}
                <div className="map-card-wrapper" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(16,185,129,0.03)', borderColor: 'rgba(16,185,129,0.2)' }}>
                  <div>
                    <span style={{ fontSize: '0.65rem', color: 'var(--primary)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Classification Accuracy</span>
                    <h3 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary)', margin: '0.2rem 0 0 0', fontFamily: 'var(--font-heading)' }}>
                      {accuracy.toFixed(1)}%
                    </h3>
                  </div>
                  <CheckCircle2 size={36} color="var(--primary)" style={{ opacity: 0.8 }} />
                </div>

                {/* Total test cases */}
                <div className="map-card-wrapper" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Total Test Samples</span>
                    <h3 style={{ fontSize: '2rem', fontWeight: 800, color: '#fff', margin: '0.2rem 0 0 0', fontFamily: 'var(--font-heading)' }}>
                      {testRows.length}
                    </h3>
                  </div>
                  <Table size={36} color="var(--secondary)" style={{ opacity: 0.8 }} />
                </div>

                {/* Wrong predictions */}
                <div className="map-card-wrapper" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: accuracy === 100 ? 'rgba(255,255,255,0.01)' : 'rgba(239,68,68,0.03)', borderColor: accuracy === 100 ? 'var(--border-glass)' : 'rgba(239,68,68,0.2)' }}>
                  <div>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Missed Classifications</span>
                    <h3 style={{ fontSize: '2rem', fontWeight: 800, color: accuracy === 100 ? 'var(--text-dark)' : 'var(--danger)', margin: '0.2rem 0 0 0', fontFamily: 'var(--font-heading)' }}>
                      {testRows.filter(r => !r.isCorrect).length}
                    </h3>
                  </div>
                  <AlertTriangle size={36} color={accuracy === 100 ? '#64748b' : 'var(--danger)'} style={{ opacity: 0.8 }} />
                </div>

              </div>

              {/* Confusion Matrix Table */}
              <div className="map-card-wrapper" style={{ padding: '1.25rem' }}>
                <h5 style={{ color: '#fff', fontSize: '0.9rem', margin: '0 0 1rem 0', fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <BarChart2 size={16} color="var(--primary)" />Confusion Matrix — True Activity vs Predicted Activity
                </h5>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-glass)', background: 'rgba(255,255,255,0.01)' }}>
                        <th style={{ padding: '0.6rem 0.8rem', color: 'var(--text-muted)', textAlign: 'left' }}>Actual Class \ Predicted</th>
                        {CLASSES.map(cls => (
                          <th key={cls} style={{ padding: '0.6rem 0.8rem', color: '#fff', textAlign: 'center', fontWeight: 600 }}>{cls}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {CLASSES.map(actual => (
                        <tr key={actual} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                          <td style={{ padding: '0.6rem 0.8rem', color: '#fff', fontWeight: 600 }}>{actual}</td>
                          {CLASSES.map(pred => {
                            const count = confusionMatrix[actual]?.[pred] || 0;
                            const isDiag = actual === pred;
                            return (
                              <td 
                                key={pred} 
                                style={{ 
                                  padding: '0.6rem 0.8rem', 
                                  textAlign: 'center', 
                                  color: count > 0 ? (isDiag ? 'var(--primary)' : 'var(--danger)') : 'var(--text-dark)',
                                  fontWeight: count > 0 ? '700' : '400',
                                  background: isDiag && count > 0 ? 'rgba(16,185,129,0.03)' : 'transparent'
                                }}
                              >
                                {count}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Test rows list inspector */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '1.5rem' }}>
                
                {/* Left side: test rows list */}
                <div className="map-card-wrapper" style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                    <h5 style={{ color: '#fff', fontSize: '0.9rem', margin: 0, fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Table size={14} color="var(--secondary)" />Test Dataset Window Records
                    </h5>
                    <div style={{ display: 'flex', gap: '0.3rem' }}>
                      {['All', 'Correct', 'Incorrect'].map(filter => (
                        <button 
                          key={filter}
                          onClick={() => setTestFilter(filter)}
                          className={`btn-logout ${testFilter === filter ? 'active' : ''}`}
                          style={{ fontSize: '0.65rem', padding: '0.2rem 0.5rem', background: testFilter === filter ? 'var(--primary-glow)' : 'transparent', border: '1px solid rgba(255,255,255,0.03)', color: testFilter === filter ? 'var(--primary)' : 'var(--text-muted)' }}
                        >
                          {filter}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* Table listing */}
                  <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.74rem' }}>
                      <thead>
                        <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-glass)', background: 'rgba(255,255,255,0.01)' }}>
                          <th style={{ padding: '0.5rem', textAlign: 'left' }}>Win ID</th>
                          <th style={{ padding: '0.5rem', textAlign: 'left' }}>Species</th>
                          <th style={{ padding: '0.5rem', textAlign: 'left' }}>SMA</th>
                          <th style={{ padding: '0.5rem', textAlign: 'left' }}>Actual</th>
                          <th style={{ padding: '0.5rem', textAlign: 'left' }}>Predicted</th>
                          <th style={{ padding: '0.5rem', textAlign: 'center' }}>Result</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTestRows.map(row => (
                          <tr 
                            key={row.rowId} 
                            style={{ 
                              borderBottom: '1px solid rgba(255,255,255,0.02)', 
                              cursor: 'pointer',
                              background: selectedTestRow?.rowId === row.rowId ? 'rgba(6,182,212,0.03)' : 'transparent'
                            }}
                            onClick={() => setSelectedTestRow(row)}
                          >
                            <td style={{ padding: '0.5rem', color: '#fff' }}>{row.Window_ID}</td>
                            <td style={{ padding: '0.5rem', color: 'var(--text-muted)' }}>{row.Species}</td>
                            <td style={{ padding: '0.5rem', color: '#fff' }}>{(row.SMA || 0).toFixed(4)}</td>
                            <td style={{ padding: '0.5rem', color: '#fff', fontWeight: 600 }}>{row.Activity}</td>
                            <td style={{ padding: '0.5rem', color: row.isCorrect ? 'var(--primary)' : 'var(--danger)', fontWeight: 600 }}>{row.Predicted}</td>
                            <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                              <span style={{ fontSize: '0.62rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: row.isCorrect ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', color: row.isCorrect ? 'var(--primary)' : 'var(--danger)' }}>
                                {row.isCorrect ? 'Pass' : 'Fail'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Right side: selected test row features details inspector */}
                <div className="map-card-wrapper" style={{ padding: '1rem' }}>
                  <h5 style={{ color: '#fff', fontSize: '0.9rem', margin: '0 0 1rem 0', fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <HelpCircle size={14} color="var(--primary)" />Record Inspector
                  </h5>
                  {selectedTestRow ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                      
                      {/* Comparison card */}
                      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)', borderRadius: '8px', padding: '0.75rem' }}>
                        <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', display: 'block' }}>WINDOW ID: {selectedTestRow.Window_ID}</span>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
                          <div>
                            <span style={{ fontSize: '0.6rem', color: 'var(--text-dark)', display: 'block' }}>ACTUAL LABEL</span>
                            <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.85rem' }}>{selectedTestRow.Activity}</span>
                          </div>
                          <div>
                            <span style={{ fontSize: '0.6rem', color: 'var(--text-dark)', display: 'block' }}>MODEL PREDICTION</span>
                            <span style={{ color: selectedTestRow.isCorrect ? 'var(--primary)' : 'var(--danger)', fontWeight: 700, fontSize: '0.85rem' }}>{selectedTestRow.Predicted}</span>
                          </div>
                        </div>
                      </div>

                      {/* Detail features grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                        {[
                          { label: 'Species', val: selectedTestRow.Species },
                          { label: 'Mean AccX', val: selectedTestRow.Mean_AccX?.toFixed(4) },
                          { label: 'Mean AccY', val: selectedTestRow.Mean_AccY?.toFixed(4) },
                          { label: 'Mean AccZ', val: selectedTestRow.Mean_AccZ?.toFixed(4) },
                          { label: 'Std AccX', val: selectedTestRow.Std_AccX?.toFixed(4) },
                          { label: 'Std AccY', val: selectedTestRow.Std_AccY?.toFixed(4) },
                          { label: 'Std AccZ', val: selectedTestRow.Std_AccZ?.toFixed(4) },
                          { label: 'Min Magnitude', val: selectedTestRow.Min_Magnitude?.toFixed(4) },
                          { label: 'Max Magnitude', val: selectedTestRow.Max_Magnitude?.toFixed(4) },
                          { label: 'Mean Magnitude', val: selectedTestRow.Mean_Magnitude?.toFixed(4) },
                          { label: 'SMA', val: selectedTestRow.SMA?.toFixed(4) }
                        ].map(({ label, val }) => (
                          <div key={label} style={{ background: 'rgba(0,0,0,0.15)', padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.01)' }}>
                            <span style={{ fontSize: '0.58rem', color: 'var(--text-muted)', display: 'block' }}>{label}</span>
                            <strong style={{ fontSize: '0.78rem', color: '#fff' }}>{val}</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: 0, textAlign: 'center', padding: '2rem' }}>
                      Click any row in the test dataset list to inspect its 13 training feature values and view prediction path verification.
                    </p>
                  )}
                </div>

              </div>

            </div>
          )}
        </div>
      )}

    </div>
  );
}
