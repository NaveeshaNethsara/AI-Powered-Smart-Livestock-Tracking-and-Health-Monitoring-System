// ============================================================
// seed.mjs — Firestore Database Seeder
// AI-Powered Smart Livestock Tracking & Health Monitoring System
// Run with: node scripts/seed.mjs
// ============================================================

import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  setDoc,
  addDoc,
  collection,
  Timestamp,
  GeoPoint
} from 'firebase/firestore';

// ── Firebase Config ──────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyDSHECu0Qzc6oJQ4jtpcj3bqTssq79dLzI",
  authDomain: "ai-powered-smart-livestock.firebaseapp.com",
  projectId: "ai-powered-smart-livestock",
  storageBucket: "ai-powered-smart-livestock.firebasestorage.app",
  messagingSenderId: "640179266510",
  appId: "1:640179266510:web:6904f7523597770c09419f",
  measurementId: "G-HZDS6HTWT8"
};

const app  = initializeApp(firebaseConfig);
const db   = getFirestore(app);

// ── Helpers ──────────────────────────────────────────────────
const now     = Timestamp.now();
const daysAgo = (n) => Timestamp.fromMillis(Date.now() - n * 86400000);
const daysAhead = (n) => Timestamp.fromMillis(Date.now() + n * 86400000);

function log(msg)  { console.log(`  ✅  ${msg}`); }
function info(msg) { console.log(`\n📦  ${msg}`); }

// ── Seed Data ────────────────────────────────────────────────

// 1. USERS
const USERS = [
  {
    id: 'farmer-uid-001',
    data: {
      uid: 'farmer-uid-001',
      name: 'Frank Miller',
      email: 'farmer@livetrack.ai',
      role: 'farmer',
      phone: '+94 77 123 4567',
      profileImageUrl: '',
      farmName: 'Green Valley Farm',
      licenseNumber: '',
      assignedAnimals: [],
      isActive: true,
      createdAt: daysAgo(90),
      updatedAt: daysAgo(5),
      lastLoginAt: now
    }
  },
  {
    id: 'vet-uid-001',
    data: {
      uid: 'vet-uid-001',
      name: 'Dr. Sarah Carter',
      email: 'vet@livetrack.ai',
      role: 'vet',
      phone: '+94 71 987 6543',
      profileImageUrl: '',
      farmName: '',
      licenseNumber: 'VET-LK-20198',
      assignedAnimals: ['animal-001', 'animal-002', 'animal-003', 'animal-004', 'animal-005'],
      isActive: true,
      createdAt: daysAgo(85),
      updatedAt: daysAgo(2),
      lastLoginAt: daysAgo(1)
    }
  },
  {
    id: 'admin-uid-001',
    data: {
      uid: 'admin-uid-001',
      name: 'Admin Controller',
      email: 'admin@livetrack.ai',
      role: 'admin',
      phone: '+94 70 000 0001',
      profileImageUrl: '',
      farmName: '',
      licenseNumber: '',
      assignedAnimals: [],
      isActive: true,
      createdAt: daysAgo(100),
      updatedAt: daysAgo(1),
      lastLoginAt: now
    }
  }
];

// 2. ANIMALS
const ANIMALS = [
  {
    id: 'animal-001',
    data: {
      animalId: 'animal-001',
      tagNumber: 'TAG-101',
      name: 'Bessie',
      species: 'Cattle',
      breed: 'Holstein Friesian',
      gender: 'female',
      dateOfBirth: daysAgo(1460),
      weight: 520,
      color: 'Black and White',
      imageUrl: '',
      farmerId: 'farmer-uid-001',
      assignedVetId: 'vet-uid-001',
      deviceId: 'ESP32-A04',
      healthStatus: 'healthy',
      currentHealthScore: 88,
      isActive: true,
      registeredAt: daysAgo(80),
      updatedAt: daysAgo(1)
    }
  }
];

// 3. DEVICES
const DEVICES = [
  {
    id: 'ESP32-A01',
    data: {
      deviceId: 'ESP32-A01',
      macAddress: '24:0A:C4:8B:58:A2',
      firmwareVersion: 'v1.0.4',
      assignedAnimalId: 'animal-003',
      assignedFarmerId: 'farmer-uid-001',
      status: 'online',
      batteryLevel: 12,
      signalStrength: 'Poor (-85dBm)',
      lastSeen: daysAgo(1),
      isBuffering: false,
      lastSyncedAt: daysAgo(1),
      registeredAt: daysAgo(75),
      registeredBy: 'admin-uid-001'
    }
  },
  {
    id: 'ESP32-A02',
    data: {
      deviceId: 'ESP32-A02',
      macAddress: '3C:61:05:4E:9A:12',
      firmwareVersion: 'v1.0.4',
      assignedAnimalId: 'animal-002',
      assignedFarmerId: 'farmer-uid-001',
      status: 'online',
      batteryLevel: 92,
      signalStrength: 'Excellent (-42dBm)',
      lastSeen: now,
      isBuffering: false,
      lastSyncedAt: now,
      registeredAt: daysAgo(78),
      registeredBy: 'admin-uid-001'
    }
  },
  {
    id: 'ESP32-A03',
    data: {
      deviceId: 'ESP32-A03',
      macAddress: '80:7D:3A:5B:C4:F1',
      firmwareVersion: 'v1.0.4',
      assignedAnimalId: 'animal-005',
      assignedFarmerId: 'farmer-uid-001',
      status: 'online',
      batteryLevel: 48,
      signalStrength: 'Good (-65dBm)',
      lastSeen: now,
      isBuffering: false,
      lastSyncedAt: now,
      registeredAt: daysAgo(55),
      registeredBy: 'admin-uid-001'
    }
  },
  {
    id: 'ESP32-A04',
    data: {
      deviceId: 'ESP32-A04',
      macAddress: 'A4:CF:12:F0:85:63',
      firmwareVersion: 'v1.0.4',
      assignedAnimalId: 'animal-001',
      assignedFarmerId: 'farmer-uid-001',
      status: 'online',
      batteryLevel: 84,
      signalStrength: 'Excellent (-48dBm)',
      lastSeen: now,
      isBuffering: false,
      lastSyncedAt: now,
      registeredAt: daysAgo(80),
      registeredBy: 'admin-uid-001'
    }
  },
  {
    id: 'ESP32-A05',
    data: {
      deviceId: 'ESP32-A05',
      macAddress: '2C:F4:32:0A:BC:7E',
      firmwareVersion: 'v1.0.3',
      assignedAnimalId: 'animal-004',
      assignedFarmerId: 'farmer-uid-001',
      status: 'offline',
      batteryLevel: 5,
      signalStrength: 'No Signal',
      lastSeen: daysAgo(2),
      isBuffering: true,
      lastSyncedAt: daysAgo(2),
      registeredAt: daysAgo(60),
      registeredBy: 'admin-uid-001'
    }
  }
];

// 4. SENSOR READINGS per animal
const SENSOR_READINGS = {
  'animal-001': [
    { bodyTemperature: 38.6, heartRate: 68, activityLevel: 'resting', stepCount: 120, accelerometerX: 0.1, accelerometerY: 0.0, accelerometerZ: 9.8, batteryLevel: 84, sensorStatus: 'connected', isBuffered: false, timestamp: daysAgo(0) },
    { bodyTemperature: 38.8, heartRate: 72, activityLevel: 'walking', stepCount: 540, accelerometerX: 0.8, accelerometerY: 0.3, accelerometerZ: 9.6, batteryLevel: 84, sensorStatus: 'connected', isBuffered: false, timestamp: daysAgo(1) },
    { bodyTemperature: 39.1, heartRate: 80, activityLevel: 'walking', stepCount: 820, accelerometerX: 1.2, accelerometerY: 0.5, accelerometerZ: 9.4, batteryLevel: 85, sensorStatus: 'connected', isBuffered: false, timestamp: daysAgo(2) }
  ],
  'animal-002': [
    { bodyTemperature: 38.4, heartRate: 65, activityLevel: 'resting', stepCount: 80, accelerometerX: 0.0, accelerometerY: 0.1, accelerometerZ: 9.8, batteryLevel: 92, sensorStatus: 'connected', isBuffered: false, timestamp: daysAgo(0) },
    { bodyTemperature: 38.5, heartRate: 70, activityLevel: 'walking', stepCount: 460, accelerometerX: 0.6, accelerometerY: 0.2, accelerometerZ: 9.5, batteryLevel: 93, sensorStatus: 'connected', isBuffered: false, timestamp: daysAgo(1) }
  ],
  'animal-003': [
    { bodyTemperature: 40.2, heartRate: 94, activityLevel: 'resting', stepCount: 30, accelerometerX: 0.0, accelerometerY: 0.0, accelerometerZ: 9.8, batteryLevel: 12, sensorStatus: 'connected', isBuffered: false, timestamp: daysAgo(0) },
    { bodyTemperature: 39.9, heartRate: 91, activityLevel: 'resting', stepCount: 10, accelerometerX: 0.1, accelerometerY: 0.0, accelerometerZ: 9.8, batteryLevel: 13, sensorStatus: 'connected', isBuffered: false, timestamp: daysAgo(1) }
  ],
  'animal-004': [
    { bodyTemperature: 41.5, heartRate: 110, activityLevel: 'resting', stepCount: 5, accelerometerX: 0.0, accelerometerY: 0.0, accelerometerZ: 9.8, batteryLevel: 5, sensorStatus: 'error', isBuffered: true, timestamp: daysAgo(2) }
  ],
  'animal-005': [
    { bodyTemperature: 38.9, heartRate: 75, activityLevel: 'walking', stepCount: 340, accelerometerX: 0.5, accelerometerY: 0.2, accelerometerZ: 9.6, batteryLevel: 48, sensorStatus: 'connected', isBuffered: false, timestamp: daysAgo(0) }
  ]
};

// 5. GPS LOCATIONS per animal
const GPS_LOCATIONS = {
  'animal-001': [
    { latitude: 7.2906, longitude: 80.6337, altitude: 512, accuracy: 3.5, speed: 0.0, isInsideGeofence: true, geofenceId: 'geofence-001', isBuffered: false, timestamp: daysAgo(0) },
    { latitude: 7.2912, longitude: 80.6342, altitude: 514, accuracy: 4.1, speed: 0.8, isInsideGeofence: true, geofenceId: 'geofence-001', isBuffered: false, timestamp: daysAgo(1) }
  ],
  'animal-002': [
    { latitude: 7.2895, longitude: 80.6328, altitude: 508, accuracy: 3.2, speed: 0.5, isInsideGeofence: true, geofenceId: 'geofence-001', isBuffered: false, timestamp: daysAgo(0) }
  ],
  'animal-003': [
    { latitude: 7.2933, longitude: 80.6358, altitude: 520, accuracy: 5.8, speed: 0.0, isInsideGeofence: false, geofenceId: 'geofence-001', isBuffered: false, timestamp: daysAgo(0) }
  ],
  'animal-004': [
    { latitude: 7.2878, longitude: 80.6310, altitude: 502, accuracy: 8.5, speed: 0.0, isInsideGeofence: true, geofenceId: 'geofence-001', isBuffered: true, timestamp: daysAgo(2) }
  ],
  'animal-005': [
    { latitude: 7.2901, longitude: 80.6330, altitude: 510, accuracy: 3.9, speed: 0.4, isInsideGeofence: true, geofenceId: 'geofence-001', isBuffered: false, timestamp: daysAgo(0) }
  ]
};

// 6. HEALTH RECORDS per animal
const HEALTH_RECORDS = {
  'animal-003': [
    {
      animalId: 'animal-003',
      vetId: 'vet-uid-001',
      farmerId: 'farmer-uid-001',
      recordType: 'diagnosis',
      diagnosisNotes: 'Animal presenting with elevated body temperature (40.2°C) and reduced activity. Suspected early-stage respiratory infection. Monitoring recommended.',
      symptoms: ['high temperature', 'reduced activity', 'loss of appetite'],
      treatment: 'Administer anti-inflammatory medication. Isolate from herd. Increase water access.',
      medications: [
        { name: 'Meloxicam', dosage: '0.5 mg/kg', frequency: 'Once daily', duration: '5 days' },
        { name: 'Oxytetracycline', dosage: '10 mg/kg', frequency: 'Every 48 hours', duration: '3 doses' }
      ],
      followUpDate: daysAhead(3),
      severity: 'moderate',
      outcome: 'ongoing',
      attachments: [],
      createdAt: daysAgo(1),
      updatedAt: daysAgo(1)
    }
  ],
  'animal-004': [
    {
      animalId: 'animal-004',
      vetId: 'vet-uid-001',
      farmerId: 'farmer-uid-001',
      recordType: 'diagnosis',
      diagnosisNotes: 'Critical case. Body temp 41.5°C, heart rate 110 BPM. Suspected severe infection. Device battery critically low — physical inspection required immediately.',
      symptoms: ['very high temperature', 'elevated heart rate', 'no movement', 'distress sounds'],
      treatment: 'Immediate physical examination required. IV fluids and broad-spectrum antibiotic therapy.',
      medications: [
        { name: 'Ampicillin', dosage: '15 mg/kg', frequency: 'Twice daily', duration: '7 days' },
        { name: 'Dexamethasone', dosage: '0.1 mg/kg', frequency: 'Once daily', duration: '3 days' }
      ],
      followUpDate: daysAhead(1),
      severity: 'severe',
      outcome: 'ongoing',
      attachments: [],
      createdAt: daysAgo(2),
      updatedAt: daysAgo(2)
    }
  ],
  'animal-001': [
    {
      animalId: 'animal-001',
      vetId: 'vet-uid-001',
      farmerId: 'farmer-uid-001',
      recordType: 'checkup',
      diagnosisNotes: 'Routine health checkup. Animal is in excellent condition. No concerns.',
      symptoms: [],
      treatment: 'No treatment required.',
      medications: [],
      followUpDate: daysAhead(90),
      severity: 'mild',
      outcome: 'recovered',
      attachments: [],
      createdAt: daysAgo(30),
      updatedAt: daysAgo(30)
    }
  ]
};

// 7. VACCINATIONS per animal
const VACCINATIONS = {
  'animal-001': [
    {
      animalId: 'animal-001',
      vetId: 'vet-uid-001',
      vaccineName: 'Blackleg Booster',
      vaccineCategory: 'blackleg',
      batchNumber: 'BL-2024-0892',
      dosage: '2ml intramuscular',
      administeredOn: daysAgo(120),
      nextDueDate: daysAhead(245),
      notes: 'No adverse reactions observed.',
      createdAt: daysAgo(120)
    },
    {
      animalId: 'animal-001',
      vetId: 'vet-uid-001',
      vaccineName: 'FMD Vaccine',
      vaccineCategory: 'fmd',
      batchNumber: 'FMD-2024-1204',
      dosage: '3ml subcutaneous',
      administeredOn: daysAgo(60),
      nextDueDate: daysAhead(120),
      notes: 'Mild swelling at injection site — resolved within 24h.',
      createdAt: daysAgo(60)
    }
  ],
  'animal-002': [
    {
      animalId: 'animal-002',
      vetId: 'vet-uid-001',
      vaccineName: 'Anthrax Vaccine',
      vaccineCategory: 'anthrax',
      batchNumber: 'ANT-2024-0441',
      dosage: '1ml subcutaneous',
      administeredOn: daysAgo(90),
      nextDueDate: daysAhead(275),
      notes: 'Annual dosage administered.',
      createdAt: daysAgo(90)
    }
  ],
  'animal-003': [
    {
      animalId: 'animal-003',
      vetId: 'vet-uid-001',
      vaccineName: 'Respiratory Vaccine',
      vaccineCategory: 'respiratory',
      batchNumber: 'RES-2024-0670',
      dosage: '2ml intramuscular',
      administeredOn: daysAgo(45),
      nextDueDate: daysAhead(135),
      notes: 'Vaccination given prior to current illness onset.',
      createdAt: daysAgo(45)
    }
  ]
};

// 8. AI PREDICTIONS per animal
const AI_PREDICTIONS = {
  'animal-001': [
    {
      animalId: 'animal-001',
      timestamp: daysAgo(0),
      healthScore: 88,
      diseaseRisk: { level: 'low', diseases: [{ name: 'Respiratory Infection', probability: 8 }, { name: 'Mastitis', probability: 5 }] },
      activityStatus: 'normal',
      postureStatus: 'normal',
      postureDetails: 'Standing upright — no abnormalities detected.',
      injuryDetected: false,
      injuryDetails: '',
      feedingBehavior: 'normal',
      coughDetected: false,
      coughCount: 0,
      distressDetected: false,
      stressLevel: 'low',
      animalCount: 5,
      modelVersion: 'v2.3.1',
      confidence: 94,
      imageUrl: '',
      audioUrl: ''
    }
  ],
  'animal-003': [
    {
      animalId: 'animal-003',
      timestamp: daysAgo(0),
      healthScore: 61,
      diseaseRisk: { level: 'medium', diseases: [{ name: 'Respiratory Infection', probability: 68 }, { name: 'Fever', probability: 42 }] },
      activityStatus: 'abnormal',
      postureStatus: 'abnormal',
      postureDetails: 'Hunched back detected — possible abdominal discomfort.',
      injuryDetected: false,
      injuryDetails: '',
      feedingBehavior: 'reduced',
      coughDetected: true,
      coughCount: 14,
      distressDetected: true,
      stressLevel: 'high',
      animalCount: 5,
      modelVersion: 'v2.3.1',
      confidence: 87,
      imageUrl: '',
      audioUrl: ''
    }
  ],
  'animal-004': [
    {
      animalId: 'animal-004',
      timestamp: daysAgo(2),
      healthScore: 42,
      diseaseRisk: { level: 'high', diseases: [{ name: 'Septicemia', probability: 82 }, { name: 'Pneumonia', probability: 74 }] },
      activityStatus: 'abnormal',
      postureStatus: 'abnormal',
      postureDetails: 'Animal lying flat — unable to stand detected.',
      injuryDetected: true,
      injuryDetails: 'Possible left hind leg injury. Severity: moderate.',
      feedingBehavior: 'absent',
      coughDetected: true,
      coughCount: 28,
      distressDetected: true,
      stressLevel: 'high',
      animalCount: 5,
      modelVersion: 'v2.3.1',
      confidence: 91,
      imageUrl: '',
      audioUrl: ''
    }
  ]
};

// 9. ALERTS
const ALERTS = [
  {
    alertId: 'alert-001',
    animalId: 'animal-003',
    farmerId: 'farmer-uid-001',
    deviceId: 'ESP32-A01',
    alertType: 'high_temp',
    severity: 'warning',
    title: 'High Temperature Detected — Molly (TAG-103)',
    message: 'Body temperature reading of 40.2°C has exceeded the configured threshold of 39.8°C. Immediate attention required.',
    sensorValue: 40.2,
    threshold: 39.8,
    isRead: false,
    isResolved: false,
    resolvedAt: null,
    resolvedBy: '',
    triggeredAt: daysAgo(0)
  },
  {
    alertId: 'alert-002',
    animalId: 'animal-004',
    farmerId: 'farmer-uid-001',
    deviceId: 'ESP32-A05',
    alertType: 'high_temp',
    severity: 'critical',
    title: 'CRITICAL Temperature — Wooly (TAG-104)',
    message: 'Body temperature reading of 41.5°C is critically high. Animal may be in severe distress.',
    sensorValue: 41.5,
    threshold: 39.8,
    isRead: false,
    isResolved: false,
    resolvedAt: null,
    resolvedBy: '',
    triggeredAt: daysAgo(2)
  },
  {
    alertId: 'alert-003',
    animalId: 'animal-003',
    farmerId: 'farmer-uid-001',
    deviceId: 'ESP32-A01',
    alertType: 'geofence_violation',
    severity: 'warning',
    title: 'Geofence Violation — Molly (TAG-103)',
    message: 'Molly has moved outside the North Pasture boundary zone.',
    sensorValue: 0,
    threshold: 0,
    isRead: true,
    isResolved: false,
    resolvedAt: null,
    resolvedBy: '',
    triggeredAt: daysAgo(1)
  },
  {
    alertId: 'alert-004',
    animalId: 'animal-004',
    farmerId: 'farmer-uid-001',
    deviceId: 'ESP32-A05',
    alertType: 'distress',
    severity: 'critical',
    title: 'Distress Sound Detected — Wooly (TAG-104)',
    message: 'AI audio analysis detected 28 distress vocalisations in the last monitoring cycle.',
    sensorValue: 28,
    threshold: 10,
    isRead: false,
    isResolved: false,
    resolvedAt: null,
    resolvedBy: '',
    triggeredAt: daysAgo(2)
  },
  {
    alertId: 'alert-005',
    animalId: 'animal-001',
    farmerId: 'farmer-uid-001',
    deviceId: 'ESP32-A04',
    alertType: 'no_movement',
    severity: 'warning',
    title: 'No Movement Detected — Bessie (TAG-101)',
    message: 'No movement detected from Bessie for the past 4 hours during daytime hours.',
    sensorValue: 0,
    threshold: 0,
    isRead: true,
    isResolved: true,
    resolvedAt: daysAgo(5),
    resolvedBy: 'farmer-uid-001',
    triggeredAt: daysAgo(5)
  }
];

// 10. GEOFENCES
const GEOFENCES = [
  {
    id: 'geofence-001',
    data: {
      geofenceId: 'geofence-001',
      farmerId: 'farmer-uid-001',
      name: 'North Pasture',
      shape: 'circle',
      center: new GeoPoint(7.2906, 80.6337),
      radius: 500,
      polygon: [],
      assignedAnimals: ['animal-001', 'animal-002', 'animal-003', 'animal-004', 'animal-005'],
      isActive: true,
      alertOnExit: true,
      createdAt: daysAgo(80)
    }
  },
  {
    id: 'geofence-002',
    data: {
      geofenceId: 'geofence-002',
      farmerId: 'farmer-uid-001',
      name: 'South Water Zone',
      shape: 'circle',
      center: new GeoPoint(7.2855, 80.6290),
      radius: 150,
      polygon: [],
      assignedAnimals: [],
      isActive: true,
      alertOnExit: false,
      createdAt: daysAgo(60)
    }
  }
];

// 11. AUDIT LOGS
const AUDIT_LOGS = [
  {
    actorId: 'admin-uid-001',
    actorRole: 'admin',
    actorEmail: 'admin@livetrack.ai',
    action: 'device.registered',
    targetId: 'ESP32-A05',
    targetType: 'device',
    details: 'Registered ESP32 Smart Collar ESP32-A05 [MAC: 2C:F4:32:0A:BC:7E]',
    ipAddress: '192.168.1.100',
    timestamp: daysAgo(60)
  },
  {
    actorId: 'admin-uid-001',
    actorRole: 'admin',
    actorEmail: 'admin@livetrack.ai',
    action: 'user.created',
    targetId: 'vet-uid-001',
    targetType: 'user',
    details: 'Created Veterinarian account for Dr. Sarah Carter [vet@livetrack.ai]',
    ipAddress: '192.168.1.100',
    timestamp: daysAgo(85)
  },
  {
    actorId: 'admin-uid-001',
    actorRole: 'admin',
    actorEmail: 'admin@livetrack.ai',
    action: 'config.updated',
    targetId: 'global',
    targetType: 'config',
    details: 'Updated temperature high threshold from 39.5°C to 39.8°C',
    ipAddress: '192.168.1.100',
    timestamp: daysAgo(10)
  },
  {
    actorId: 'farmer-uid-001',
    actorRole: 'farmer',
    actorEmail: 'farmer@livetrack.ai',
    action: 'alert.resolved',
    targetId: 'alert-005',
    targetType: 'alert',
    details: 'Farmer resolved no-movement alert for Bessie (TAG-101)',
    ipAddress: '192.168.1.105',
    timestamp: daysAgo(5)
  },
  {
    actorId: 'vet-uid-001',
    actorRole: 'vet',
    actorEmail: 'vet@livetrack.ai',
    action: 'health_record.created',
    targetId: 'animal-003',
    targetType: 'animal',
    details: 'Vet created diagnosis record for Molly (TAG-103) — suspected respiratory infection',
    ipAddress: '192.168.1.110',
    timestamp: daysAgo(1)
  }
];

// 12. SYSTEM CONFIG
const SYSTEM_CONFIG = {
  id: 'global',
  data: {
    temperatureThresholds: {
      highAlert: 39.8,
      lowAlert: 37.8,
      criticalHigh: 41.0,
      criticalLow: 37.0
    },
    heartRateThresholds: {
      highAlert: 95,
      lowAlert: 55,
      criticalHigh: 110,
      criticalLow: 45
    },
    geofenceSettings: {
      defaultRadius: 500,
      violationCooldownMinutes: 5
    },
    alertSettings: {
      enablePush: true,
      enableEmail: true,
      cooldownMinutes: 15,
      coughCountThreshold: 10,
      distressCooldownMinutes: 30
    },
    aiModelParams: {
      minConfidence: 75,
      postureSensitivity: 'medium',
      activityWindowMinutes: 60,
      healthScoreWeights: {
        temperature: 0.30,
        heartRate: 0.20,
        activity: 0.20,
        ai_risk: 0.30
      }
    },
    dataRetentionDays: 365,
    sensorReadingIntervalSec: 30,
    updatedAt: daysAgo(10),
    updatedBy: 'admin-uid-001'
  }
};

// ── Main Seed Function ───────────────────────────────────────
async function seed() {
  console.log('\n🚀  Starting Firestore seed for LiveTrack AI...\n');

  // ── 1. Users
  info('Seeding: users');
  for (const user of USERS) {
    await setDoc(doc(db, 'users', user.id), user.data);
    log(`users/${user.id} — ${user.data.email} [${user.data.role}]`);
  }

  // ── 2. Animals
  info('Seeding: animals');
  for (const animal of ANIMALS) {
    await setDoc(doc(db, 'animals', animal.id), animal.data);
    log(`animals/${animal.id} — ${animal.data.name} (${animal.data.tagNumber})`);
  }

  // ── 3. Devices
  info('Seeding: devices');
  for (const device of DEVICES) {
    await setDoc(doc(db, 'devices', device.id), device.data);
    log(`devices/${device.id} — MAC ${device.data.macAddress}`);
  }

  // ── 4. Sensor Readings (subcollections)
  info('Seeding: sensor_readings (subcollections)');
  for (const [animalId, readings] of Object.entries(SENSOR_READINGS)) {
    for (const reading of readings) {
      const ref = collection(db, 'animals', animalId, 'sensor_readings');
      await addDoc(ref, { ...reading, animalId, deviceId: ANIMALS.find(a => a.id === animalId)?.data.deviceId || '' });
      log(`animals/${animalId}/sensor_readings — temp: ${reading.bodyTemperature}°C, HR: ${reading.heartRate}bpm`);
    }
  }

  // ── 5. GPS Locations (subcollections)
  info('Seeding: gps_locations (subcollections)');
  for (const [animalId, locations] of Object.entries(GPS_LOCATIONS)) {
    for (const location of locations) {
      const ref = collection(db, 'animals', animalId, 'gps_locations');
      await addDoc(ref, { ...location, animalId, deviceId: ANIMALS.find(a => a.id === animalId)?.data.deviceId || '' });
      log(`animals/${animalId}/gps_locations — lat: ${location.latitude}, lng: ${location.longitude}`);
    }
  }

  // ── 6. Health Records (subcollections)
  info('Seeding: health_records (subcollections)');
  for (const [animalId, records] of Object.entries(HEALTH_RECORDS)) {
    for (const record of records) {
      const ref = collection(db, 'animals', animalId, 'health_records');
      await addDoc(ref, record);
      log(`animals/${animalId}/health_records — type: ${record.recordType}`);
    }
  }

  // ── 7. Vaccinations (subcollections)
  info('Seeding: vaccinations (subcollections)');
  for (const [animalId, vaccinations] of Object.entries(VACCINATIONS)) {
    for (const vacc of vaccinations) {
      const ref = collection(db, 'animals', animalId, 'vaccinations');
      await addDoc(ref, vacc);
      log(`animals/${animalId}/vaccinations — ${vacc.vaccineName}`);
    }
  }

  // ── 8. AI Predictions (subcollections)
  info('Seeding: ai_predictions (subcollections)');
  for (const [animalId, predictions] of Object.entries(AI_PREDICTIONS)) {
    for (const pred of predictions) {
      const ref = collection(db, 'animals', animalId, 'ai_predictions');
      await addDoc(ref, pred);
      log(`animals/${animalId}/ai_predictions — score: ${pred.healthScore}, risk: ${pred.diseaseRisk.level}`);
    }
  }

  // ── 9. Alerts
  info('Seeding: alerts');
  for (const alert of ALERTS) {
    await setDoc(doc(db, 'alerts', alert.alertId), alert);
    log(`alerts/${alert.alertId} — ${alert.alertType} [${alert.severity}]`);
  }

  // ── 10. Geofences
  info('Seeding: geofences');
  for (const fence of GEOFENCES) {
    await setDoc(doc(db, 'geofences', fence.id), fence.data);
    log(`geofences/${fence.id} — ${fence.data.name}`);
  }

  // ── 11. Audit Logs
  info('Seeding: audit_logs');
  for (const log_entry of AUDIT_LOGS) {
    const ref = collection(db, 'audit_logs');
    await addDoc(ref, log_entry);
    log(`audit_logs — ${log_entry.action} by ${log_entry.actorEmail}`);
  }

  // ── 12. System Config
  info('Seeding: system_config');
  await setDoc(doc(db, 'system_config', SYSTEM_CONFIG.id), SYSTEM_CONFIG.data);
  log(`system_config/global — thresholds and AI parameters written`);

  console.log('\n');
  console.log('═══════════════════════════════════════════════════');
  console.log('🎉  DATABASE SEED COMPLETE!');
  console.log('═══════════════════════════════════════════════════');
  console.log('  Collections created: 13');
  console.log('  Animals seeded: 1  (Bessie)');
  console.log('  Devices seeded: 5  (ESP32-A01 to ESP32-A05)');
  console.log('  Users seeded: 3  (farmer, vet, admin)');
  console.log('  Alerts seeded: 5  (2 critical, 3 warning)');
  console.log('  Subcollections: sensor_readings, gps_locations,');
  console.log('                  health_records, vaccinations, ai_predictions');
  console.log('═══════════════════════════════════════════════════\n');

  process.exit(0);
}

seed().catch((err) => {
  console.error('\n❌  Seed failed:', err.message);
  console.error(err);
  process.exit(1);
});
