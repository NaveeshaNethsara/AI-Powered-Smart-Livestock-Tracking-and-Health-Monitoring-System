// ECGHeartPulse.jsx — ECG Medical Monitor Heartbeat Waveform Animation
// Renders an authentic live ECG P-Q-R-S-T waveform with dynamic BPM heartbeat pulse.
import React from 'react';
import { Heart } from 'lucide-react';

export default function ECGHeartPulse({ 
  bpm = 72, 
  isRealSensor = false, 
  color = null, 
  height = 42,
  showLabel = true,
  showWave = true,
  compact = false 
}) {
  const numericBpm = parseInt(bpm, 10) || 72;
  
  // Calculate dynamic heartbeat pulse duration based on BPM (60 / BPM seconds per beat)
  const beatDuration = Math.max(0.3, Math.min(2.0, (60 / numericBpm))).toFixed(2);
  
  // Color classification based on BPM thresholds
  const strokeColor = color 
    ? color 
    : numericBpm > 110 
      ? '#ef4444' // Critical Tachycardia Red
      : numericBpm > 90 
        ? '#f59e0b' // Elevated Warning Amber
        : numericBpm < 50
          ? '#3b82f6' // Bradycardia Blue
          : '#06b6d4'; // Healthy Cyan Glow

  // Standard ECG P-Q-R-S-T wave pattern path string (repeated 2.5 cycles)
  // Baseline -> P wave -> Q dip -> R spike -> S dip -> T wave -> Baseline
  const ecgPath = `
    M 0 20 
    L 12 20 
    Q 16 16, 20 20 
    L 24 20 
    L 26 23 
    L 30 3 
    L 34 37 
    L 38 20 
    L 42 20 
    Q 48 13, 54 20 
    L 65 20
    
    L 77 20 
    Q 81 16, 85 20 
    L 89 20 
    L 91 23 
    L 95 3 
    L 99 37 
    L 103 20 
    L 107 20 
    Q 113 13, 119 20 
    L 130 20

    L 142 20 
    Q 146 16, 150 20 
    L 154 20 
    L 156 23 
    L 160 3 
    L 164 37 
    L 168 20 
    L 172 20 
    Q 178 13, 184 20 
    L 200 20
  `;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
      {/* Top Header: Heart icon + BPM value + Sensor badge */}
      {showLabel && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Heart 
              size={14} 
              color={strokeColor} 
              fill={strokeColor}
              style={{
                animation: `heart-pulse-beat ${beatDuration}s infinite ease-in-out`,
                filter: `drop-shadow(0 0 6px ${strokeColor})`
              }}
            />
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: strokeColor, fontFamily: 'var(--font-heading)' }}>
              {numericBpm} <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)' }}>BPM</span>
            </span>
          </div>

          {isRealSensor !== undefined && (
            <span style={{
              fontSize: '0.58rem',
              padding: '2px 6px',
              borderRadius: '4px',
              fontWeight: 700,
              letterSpacing: '0.04em',
              background: isRealSensor ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)',
              color: isRealSensor ? 'var(--primary)' : 'var(--text-muted)',
              border: isRealSensor ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(255,255,255,0.1)'
            }}>
              {isRealSensor ? '● REAL SENSOR' : '● SIMULATED'}
            </span>
          )}
        </div>
      )}

      {/* ECG Waveform Live Graphic */}
      {showWave && (
        <div style={{
          position: 'relative',
          width: '100%',
          height: `${height}px`,
          background: 'rgba(6, 12, 24, 0.85)',
          borderRadius: '8px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          boxShadow: 'inset 0 0 10px rgba(0,0,0,0.8)'
        }}>
          {/* Medical grid line background */}
          <div style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `
              linear-gradient(to right, rgba(0, 210, 255, 0.06) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(0, 210, 255, 0.06) 1px, transparent 1px)
            `,
            backgroundSize: '12px 10px',
            opacity: 0.8
          }} />

          {/* SVG Animated ECG Waveform */}
          <svg 
            viewBox="0 0 200 40" 
            preserveAspectRatio="none"
            style={{ width: '100%', height: '100%', position: 'relative', zIndex: 2 }}
          >
            {/* Soft background glow trace */}
            <path
              d={ecgPath}
              fill="none"
              stroke={strokeColor}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.25"
            />

            {/* Glowing sweep line */}
            <path
              d={ecgPath}
              fill="none"
              stroke={strokeColor}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                strokeDasharray: '200',
                strokeDashoffset: '200',
                animation: `ecg-sweep ${beatDuration * 1.6}s linear infinite`,
                filter: `drop-shadow(0 0 5px ${strokeColor})`
              }}
            />
          </svg>

          {/* Radar Scanline Fade Overlay */}
          <div style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: '40%',
            background: 'linear-gradient(90deg, transparent 0%, rgba(0, 210, 255, 0.15) 80%, rgba(255, 255, 255, 0.3) 100%)',
            animation: `ecg-scanline ${beatDuration * 1.6}s linear infinite`,
            zIndex: 3,
            pointerEvents: 'none'
          }} />
        </div>
      )}
    </div>
  );
}
