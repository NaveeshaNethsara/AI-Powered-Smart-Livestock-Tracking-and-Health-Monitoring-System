// CVDiseaseTab.jsx — Real-Time Camera AI Animal Disease Detection & Custom Photo Analysis
// Listens to Firebase Realtime Database path: animal_camera/latest
// Assigns real-time camera disease detections to specific cow (e.g. Daisy, MAC 28:05:A5:07:3B:94)
import React, { useState, useEffect, useMemo } from 'react';
import { Camera, Upload, AlertTriangle, CheckCircle, BrainCircuit, Sparkles, Image as ImageIcon, RefreshCw, Video, ShieldAlert, Tag, Cpu } from 'lucide-react';
import { ref, onValue } from 'firebase/database';
import { rtdb } from '../../firebase';

const SAMPLES = [
  { id: 'upload', name: '📸 [Upload Custom Photo...]', path: null, label: 'Custom Upload' },
  { id: 'healthy', name: '🟢 Healthy Cattle Skin (Healthy)', path: '/test_images/healthy_sample.jpg', label: 'healthy' },
  { id: 'fmd', name: '🔴 Foot & Mouth Lesion (FMD)', path: '/test_images/fmd_sample.jpg', label: 'foot-and-mouth' },
  { id: 'lumpy', name: '🟡 Lumpy Skin Nodules (LSD)', path: '/test_images/lumpy_sample.jpg', label: 'lumpy' },
  { id: 'mastitis', name: '🔵 Udder Swelling & Scabs (Mastitis)', path: '/test_images/mastitis_sample.jpg', label: 'mastitis' }
];

const DISEASE_MAP = {
  lumpy: {
    name: 'Lumpy Skin Disease (LSD)',
    icon: '🟡',
    color: 'var(--warning)',
    severity: 'warning',
    description: 'Lumpy Skin Disease is a viral infection characterized by firm skin nodules, fever, and lesions. Quarantine infected animals immediately.'
  },
  'foot-and-mouth': {
    name: 'Foot & Mouth Disease (FMD)',
    icon: '🔴',
    color: 'var(--danger)',
    severity: 'critical',
    description: 'Foot & Mouth Disease causes high fever, salivation, vesicles in mouth and hooves. Report to vet and isolate animal immediately.'
  },
  fmd: {
    name: 'Foot & Mouth Disease (FMD)',
    icon: '🔴',
    color: 'var(--danger)',
    severity: 'critical',
    description: 'Foot & Mouth Disease causes high fever, salivation, vesicles in mouth and hooves. Report to vet and isolate animal immediately.'
  },
  mastitis: {
    name: 'Mastitis Udder Infection',
    icon: '🔴',
    color: 'var(--danger)',
    severity: 'critical',
    description: 'Mastitis is an inflammatory udder infection caused by bacteria. Disinfect cow teats and consult a vet for antibiotic treatment.'
  },
  healthy: {
    name: 'Cattle Healthy (No Disease Detected)',
    icon: '🟢',
    color: 'var(--primary)',
    severity: 'healthy',
    description: 'No symptoms of FMD, LSD, or Mastitis detected by camera AI. Animal skin and posture appear normal.'
  }
};

export default function CVDiseaseTab({ animals = [], devices = [] }) {
  const [selectedSample, setSelectedSample] = useState(SAMPLES[0]);
  const [imagePreview, setImagePreview] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Real-time camera CV data from Firebase RTDB (animal_camera/latest)
  const [cameraCvData, setCameraCvData] = useState(null);

  // Subscribe to real-time camera CV predictions from RTDB
  useEffect(() => {
    const camRef = ref(rtdb, 'animal_camera/latest');
    const unsub = onValue(camRef, (snapshot) => {
      if (snapshot.exists()) {
        setCameraCvData(snapshot.val());
      }
    }, (err) => {
      console.warn('Realtime Database listener error for animal_camera/latest:', err);
    });
    return () => unsub();
  }, []);

  // Resolve assigned animal (e.g. Daisy, MAC 28:05:A5:07:3B:94)
  const assignedAnimal = useMemo(() => {
    if (!animals || animals.length === 0) return null;
    
    // Check if RTDB data specifies a MAC or animalId
    const macFromCam = cameraCvData?.macAddress || cameraCvData?.deviceId || cameraCvData?.animalId || '28:05:A5:07:3B:94';
    
    const matched = animals.find(a => {
      if ((a.deviceId || '').toUpperCase() === macFromCam.toUpperCase()) return true;
      const dev = devices.find(d => (d.deviceId || d.docId) === a.deviceId);
      return (dev?.macAddress || '').toUpperCase() === macFromCam.toUpperCase();
    });

    return matched || animals.find(a => a.name?.toLowerCase().includes('daisy')) || animals[0];
  }, [animals, devices, cameraCvData]);

  const getDiseaseInfo = (rawPrediction) => {
    if (!rawPrediction) return DISEASE_MAP.healthy;
    const key = rawPrediction.toLowerCase().trim();
    return DISEASE_MAP[key] || {
      name: rawPrediction.toUpperCase(),
      icon: '⚠️',
      color: 'var(--warning)',
      severity: 'warning',
      description: 'Custom pathology pattern detected by computer vision camera model.'
    };
  };

  // Handle image upload from file input
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setSelectedFile(file);
    setSelectedSample(SAMPLES[0]);
    setError(null);
    setResult(null);

    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  // Handle sample selection from dropdown
  const handleSampleChange = async (e) => {
    const sampleId = e.target.value;
    const sample = SAMPLES.find(s => s.id === sampleId);
    setSelectedSample(sample);
    setError(null);
    setResult(null);

    if (sample.id === 'upload') {
      setImagePreview(null);
      setSelectedFile(null);
    } else {
      setImagePreview(sample.path);
      try {
        const response = await fetch(sample.path);
        const blob = await response.blob();
        const file = new File([blob], `${sample.id}_sample.jpg`, { type: 'image/jpeg' });
        setSelectedFile(file);
      } catch (err) {
        console.error('Failed to load sample image blob:', err);
        setError('Failed to load sample image.');
      }
    }
  };

  // Run computer vision disease classification
  const handleAnalyze = async () => {
    if (!selectedFile) {
      setError('Please select a sample image or upload a custom photo first.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append('image', selectedFile);

    try {
      const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
      const response = await fetch(`${API_BASE_URL}/api/classify-disease`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Classification request failed. Ensure the backend server is running.');
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      console.error('CV classification failed:', err);
      setError(err.message || 'An error occurred during image classification.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%', overflowY: 'auto' }}>
      
      {/* Top Banner */}
      <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid var(--primary)' }}>
        <div style={{ background: 'rgba(16,185,129,0.1)', padding: '0.75rem', borderRadius: '12px' }}>
          <BrainCircuit size={28} color="var(--primary)" />
        </div>
        <div>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#fff', fontFamily: 'var(--font-heading)' }}>
            Computer Vision Real-Time Animal Disease Detection
          </h2>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0.2rem 0 0' }}>
            FR-F26 — Real-time automated Cattle Disease Identification via live AI camera stream (`animal_camera/latest`) and ResNet-18 image classification.
          </p>
        </div>
      </div>

      {/* ── 1. REALTIME AI CAMERA DETECTION DISPLAY ───────────────────────────── */}
      <div className="glass-card" style={{ 
        padding: '1.5rem', 
        borderLeft: '4px solid var(--primary)',
        background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.08) 0%, rgba(10, 14, 30, 0.95) 100%)',
        display: 'flex', flexDirection: 'column', gap: '1.25rem'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Video size={20} color="var(--primary)" />
            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              📹 Live AI Camera Stream Detection (Real-Time RTDB)
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ 
              width: '10px', height: '10px', borderRadius: '50%', 
              background: cameraCvData ? 'var(--primary)' : '#64748b',
              boxShadow: cameraCvData ? '0 0 10px var(--primary)' : 'none'
            }} />
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: cameraCvData ? 'var(--primary)' : 'var(--text-muted)' }}>
              {cameraCvData ? '🟢 Live Camera Connected' : '⚪ Waiting for Camera Stream'}
            </span>
          </div>
        </div>

        {/* Assigned Cow Info Badge */}
        {assignedAnimal && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)',
            borderRadius: '12px', padding: '0.75rem 1rem', flexWrap: 'wrap', gap: '0.75rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                width: '38px', height: '38px', borderRadius: '50%', background: '#1e293b',
                display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                border: '2px solid var(--primary)'
              }}>
                {assignedAnimal.imageUrl ? (
                  <img src={assignedAnimal.imageUrl} alt={assignedAnimal.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: '1.2rem' }}>🐄</span>
                )}
              </div>
              <div>
                <div style={{ color: '#fff', fontWeight: 800, fontSize: '0.95rem', fontFamily: 'var(--font-heading)' }}>
                  Assigned Cow: {assignedAnimal.name}
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.73rem' }}>
                  Tag Number: <strong style={{ color: '#fff' }}>{assignedAnimal.tagNumber || 'TAG-101'}</strong> • Breed: {assignedAnimal.species || 'Holstein Dairy Cow'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{
                background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-glass)',
                borderRadius: '20px', padding: '4px 12px', fontSize: '0.74rem', color: 'var(--primary)',
                fontWeight: 700
              }}>
                📶 Hardware MAC: 28:05:A5:07:3B:94
              </span>
            </div>
          </div>
        )}

        {cameraCvData ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', alignItems: 'center' }}>
            {/* Left Box: Realtime Disease Diagnosis */}
            <div style={{ background: 'rgba(5, 7, 18, 0.75)', padding: '1.25rem', borderRadius: '14px', border: '1px solid var(--border-glass)' }}>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.4rem' }}>
                REALTIME DETECTED DISEASE FOR {assignedAnimal ? assignedAnimal.name.toUpperCase() : 'DAISY'} (MAC: 28:05:A5:07:3B:94)
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.6rem' }}>
                <span style={{ fontSize: '1.8rem' }}>{getDiseaseInfo(cameraCvData.prediction).icon}</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: getDiseaseInfo(cameraCvData.prediction).color, fontFamily: 'var(--font-heading)' }}>
                    {getDiseaseInfo(cameraCvData.prediction).name}
                  </h3>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                    Raw Camera Model Label: <strong style={{ color: '#fff' }}>"{cameraCvData.prediction}"</strong>
                  </span>
                </div>
              </div>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                {getDiseaseInfo(cameraCvData.prediction).description}
              </p>
            </div>

            {/* Right Box: AI Confidence Level */}
            <div style={{ 
              background: 'rgba(5, 7, 18, 0.75)', padding: '1.25rem', borderRadius: '14px', 
              border: '1px solid var(--border-glass)', display: 'flex', flexDirection: 'column', 
              alignItems: 'center', justifyContent: 'center', gap: '0.4rem', textAlign: 'center' 
            }}>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Real-Time AI Model Confidence
              </span>
              <span style={{ 
                fontSize: '2.4rem', fontWeight: 800, 
                color: getDiseaseInfo(cameraCvData.prediction).color, 
                fontFamily: 'var(--font-heading)' 
              }}>
                {(cameraCvData.confidence_percent || (cameraCvData.confidence * 100) || 0).toFixed(2)}%
              </span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                Updated for <strong style={{ color: '#fff' }}>{assignedAnimal ? assignedAnimal.name : 'Daisy'}</strong> at <strong style={{ color: '#fff' }}>{cameraCvData.updated_at ? new Date(cameraCvData.updated_at).toLocaleTimeString() : 'Just now'}</strong>
              </span>
            </div>
          </div>
        ) : (
          <div style={{ padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.82rem', textAlign: 'center', background: 'rgba(5,7,18,0.5)', borderRadius: '10px' }}>
            Listening for live predictions from RTDB path <code style={{ color: 'var(--primary)' }}>animal_camera/latest</code> for assigned cow {assignedAnimal ? assignedAnimal.name : 'Daisy'} (MAC: 28:05:A5:07:3B:94)...
          </div>
        )}
      </div>

      {/* ── 2. UPLOAD & CUSTOM SAMPLE CLASSIFICATION ─────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem' }}>
        
        {/* Left Column: Image Input & Preview */}
        <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
            <Camera size={16} color="var(--primary)" /> Static Photo Input Selector
          </h3>

          {/* Select dropdown list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Choose Test Image Sources</label>
            <select
              value={selectedSample.id}
              onChange={handleSampleChange}
              style={{
                width: '100%', padding: '0.75rem', borderRadius: '10px', background: 'rgba(10,14,30,0.8)',
                border: '1px solid var(--border-glass)', color: '#fff', fontSize: '0.82rem', fontFamily: 'inherit',
                outline: 'none', cursor: 'pointer'
              }}
            >
              {SAMPLES.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Custom File Upload Button */}
          {selectedSample.id === 'upload' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Upload custom JPG/PNG image</label>
              <label style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                border: '2px dashed var(--border-glass)', borderRadius: '10px', padding: '1.5rem',
                cursor: 'pointer', color: 'var(--text-muted)', transition: 'all 0.15s ease', textAlign: 'center'
              }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-glass)'}
              >
                <Upload size={18} />
                <span style={{ fontSize: '0.78rem' }}>{selectedFile ? selectedFile.name : 'Select cow symptom photo...'}</span>
                <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
              </label>
            </div>
          )}

          {/* Image Preview Window */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1 }}>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Image Preview</label>
            <div style={{
              flex: 1, minHeight: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(5,7,18,0.6)', border: '1px solid var(--border-glass)', borderRadius: '12px',
              overflow: 'hidden', position: 'relative'
            }}>
              {imagePreview ? (
                <img src={imagePreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem', color: 'var(--text-muted)' }}>
                  <ImageIcon size={40} strokeWidth={1.2} />
                  <span style={{ fontSize: '0.76rem' }}>No image loaded</span>
                </div>
              )}
            </div>
          </div>

          {/* Action Button */}
          <button
            onClick={handleAnalyze}
            disabled={loading || !selectedFile}
            style={{
              width: '100%', padding: '0.85rem', borderRadius: '10px', border: 'none',
              background: loading || !selectedFile ? 'var(--border-glass)' : 'linear-gradient(135deg, var(--primary), #10b981)',
              color: '#060913', fontWeight: 700, fontSize: '0.85rem', cursor: loading || !selectedFile ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', transition: 'all 0.15s ease'
            }}
          >
            {loading ? (
              <>
                <RefreshCw size={16} className="spin" />
                <span>Classifying Disease...</span>
              </>
            ) : (
              <>
                <Sparkles size={16} />
                <span>Analyze Static Photo with AI</span>
              </>
            )}
          </button>
        </div>

        {/* Right Column: Classification Results & Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Results Card */}
          <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.2rem', minHeight: '250px' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
              <BrainCircuit size={16} color="var(--primary)" /> Static Photo Diagnostics Output
            </h3>

            {error && (
              <div style={{
                display: 'flex', gap: '0.6rem', background: 'rgba(239,68,68,0.1)', padding: '1rem',
                borderRadius: '10px', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--danger)', fontSize: '0.78rem'
              }}>
                <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            {!result && !error && !loading && (
              <div style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-muted)', gap: '0.5rem', textAlign: 'center'
              }}>
                <BrainCircuit size={36} strokeWidth={1.2} />
                <p style={{ fontSize: '0.76rem', margin: 0 }}>Feed an image to the deep learning model to see diagnostic outputs.</p>
              </div>
            )}

            {loading && (
              <div style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                color: 'var(--primary)', gap: '1rem'
              }}>
                <RefreshCw size={36} className="spin" />
                <p style={{ fontSize: '0.76rem', margin: 0, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Model running ResNet-18 forward pass...</p>
              </div>
            )}

            {result && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', animation: 'fadeIn 0.25s ease' }}>
                
                {/* Score Dial */}
                <div style={{
                  background: 'rgba(5,7,18,0.6)', borderRadius: '12px', padding: '1.2rem',
                  border: '1px solid var(--border-glass)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem'
                }}>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>AI Confidence Level</span>
                  <span style={{
                    fontSize: '2rem', fontWeight: 800,
                    color: result.rawClass.toLowerCase() === 'healthy' ? 'var(--primary)' : 'var(--warning)',
                    fontFamily: 'var(--font-heading)'
                  }}>
                    {(result.confidence * 100).toFixed(2)}%
                  </span>
                  <span style={{
                    fontSize: '0.76rem', display: 'flex', alignItems: 'center', gap: '0.3rem',
                    color: result.rawClass.toLowerCase() === 'healthy' ? 'var(--primary)' : 'var(--warning)'
                  }}>
                    {result.rawClass.toLowerCase() === 'healthy' ? <CheckCircle size={13} /> : <AlertTriangle size={13} />}
                    {result.rawClass.toLowerCase() === 'healthy' ? 'Cattle Healthy' : 'Symptoms Detected'}
                  </span>
                </div>

                {/* Disease Name */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Diagnosed Disease Classification</span>
                  <span style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff' }}>{result.disease}</span>
                </div>

                {/* Disease details block */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', borderTop: '1px solid var(--border-glass)', paddingTop: '0.8rem' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>CATTLE PATHOLOGY SUMMARY:</span>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, lineHeight: '1.4' }}>
                    {result.rawClass.toLowerCase() === 'healthy' && 'No signs of FMD, LSD, or Mastitis were found. Continue normal daily health checks and feed logs.'}
                    {result.rawClass.toLowerCase() === 'foot-and-mouth' && 'Foot and mouth disease causes high fever, salivation, vesicles in mouth and hooves. Report to vet, isolate animal immediately.'}
                    {result.rawClass.toLowerCase() === 'lumpy' && 'Lumpy Skin Disease is a viral infection characterized by firm skin nodules, fever, and lesions. Quarantine the infected cow.'}
                    {result.rawClass.toLowerCase() === 'mastitis' && 'Mastitis is an inflammatory infection of the udder caused by bacteria. Disinfect the cow teats, and consult a vet for antibiotic treatment.'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Quick Recommendations */}
          <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <h3 style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fff', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>CV Model Training Config</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.4rem' }}>
                <span>Model Architecture</span>
                <span style={{ color: '#fff', fontWeight: 600 }}>ResNet-18 (Deep CNN)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.4rem' }}>
                <span>Dataset Split Ratio</span>
                <span style={{ color: '#fff', fontWeight: 600 }}>Train: 80% | Validation: 20%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.4rem' }}>
                <span>Input Dimensions</span>
                <span style={{ color: '#fff', fontWeight: 600 }}>224 x 224 (RGB)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Classifier Classes</span>
                <span style={{ color: '#fff', fontWeight: 600 }}>FMD, LSD, Mastitis, Healthy</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
