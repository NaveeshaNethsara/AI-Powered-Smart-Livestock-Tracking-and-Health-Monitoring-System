import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, update } from 'firebase/database';
import { getAuth, signInAnonymously } from 'firebase/auth';
import express from 'express';
import cors from 'cors';
import { predictActivity } from '../src/utils/activityModel.js';

const firebaseConfig = {
  apiKey: "AIzaSyDSHECu0Qzc6oJQ4jtpcj3bqTssq79dLzI",
  authDomain: "ai-powered-smart-livestock.firebaseapp.com",
  databaseURL: "https://ai-powered-smart-livestock-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "ai-powered-smart-livestock",
  storageBucket: "ai-powered-smart-livestock.firebasestorage.app",
  messagingSenderId: "640179266510",
  appId: "1:640179266510:web:6904f7523597770c09419f",
  measurementId: "G-HZDS6HTWT8"
};

const app = express();
app.use(cors());
app.use(express.json());

import multer from 'multer';
import { exec, execFile } from 'child_process';
import path from 'path';
import fs from 'fs';

// Ensure uploads folder exists
const uploadsDir = path.resolve('backend/uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer disk storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    cb(null, 'temp_' + Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Basic API status endpoint
app.get('/', (req, res) => {
  res.json({ status: 'online', service: 'AI Live Activity Recognition Classifier Engine' });
});

// API endpoint for Health Risk ML Prediction (Module 2)
app.post('/api/predict-health-risk', (req, res) => {
  const { temp, heartRate, activityLevel, stepCount, weight, species } = req.body;

  const tempVal = parseFloat(temp) || 38.5;
  const heartRateVal = parseFloat(heartRate) || 72.0;
  const stepsVal = parseInt(stepCount) || 120;
  const weightVal = parseFloat(weight) || (species === 'Goat' ? 40.0 : species === 'Buffalo' ? 650.0 : 450.0);
  const speciesVal = species || 'Cattle';
  const ageVal = 3.0; // Default baseline age

  // Map text activity to training dataset scale (0 to 100)
  let numericActivity = 25.0;
  const actLower = (activityLevel || 'resting').toLowerCase();
  if (actLower === 'sleeping') numericActivity = 10.0;
  else if (actLower === 'resting') numericActivity = 20.0;
  else if (actLower === 'standing') numericActivity = 35.0;
  else if (actLower === 'walking') numericActivity = 60.0;
  else if (actLower === 'running') numericActivity = 90.0;
  else if (actLower === 'abnormal movement') numericActivity = 80.0;

  // Approximate metrics based on steps
  const movementDuration = Math.min(480.0, (stepsVal / 100.0) * 10.0);
  const gpsDistance = (stepsVal / 1000.0) * 0.7;

  const pythonScript = path.resolve('ML Models/Health Risk Prediction/Traning Testing data split/files (1)/predict_health_risk.py');
  const pythonCwd = path.dirname(pythonScript);

  const command = `python "${pythonScript}" ${tempVal} ${heartRateVal} ${numericActivity} ${movementDuration.toFixed(2)} ${gpsDistance.toFixed(2)} ${ageVal} ${weightVal} "${speciesVal}"`;

  console.log(`[Backend] Executing Health Risk ML Command: ${command}`);

  exec(command, { cwd: pythonCwd }, (error, stdout, stderr) => {
    if (error) {
      console.error('[Backend] Health Risk script execution error:', error);
      console.error('[Backend] Health Risk stderr:', stderr);
      console.error('[Backend] Health Risk stdout:', stdout);
      return res.status(500).json({ error: 'Failed to run health risk model', details: stderr });
    }
    try {
      const output = JSON.parse(stdout.trim());
      res.json(output);
    } catch (parseErr) {
      console.error('[Backend] Failed to parse script output:', stdout);
      res.status(500).json({ error: 'Invalid response from health risk model' });
    }
  });
});
// ── Per-animal telemetry window buffer (kept in memory, 12 steps × 5-min windows) ────
const anomalyWindows = {};   // { animalId: [{temperature, heartRate, accMagnitude, activityScore, gpsSpeed}, ...] }
const WINDOW_SIZE    = 12;   // 12 × 5-min = 1 hour of history

// API endpoint for LSTM Autoencoder Early Disease Detection (Module 4)
app.post('/api/detect-anomaly', (req, res) => {
  const { animalId, window } = req.body;

  if (!animalId || !window || !Array.isArray(window) || window.length === 0) {
    return res.status(400).json({ error: 'animalId and window array are required.' });
  }

  // Maintain rolling window per animal
  if (!anomalyWindows[animalId] || req.body.isSimulated || req.body.resetBuffer) {
    // For simulated scenario readings, fill the entire 12-step window with the scenario payload
    const simReading = window[window.length - 1];
    anomalyWindows[animalId] = Array(WINDOW_SIZE).fill(simReading);
  }
  const buf = anomalyWindows[animalId];

  // Push latest reading(s) and keep buffer trimmed if not reset
  if (!req.body.isSimulated && !req.body.resetBuffer) {
    window.forEach(reading => buf.push(reading));
    while (buf.length > WINDOW_SIZE) buf.shift();
  }

  const inferenceWindow = buf.length >= WINDOW_SIZE
    ? [...buf]
    : Array(WINDOW_SIZE - buf.length).fill(buf[0]).concat(buf);

  const anomalyScript = path.resolve('ML Models/Early Disease Detection/anomaly_detector.py');
  const windowJson    = JSON.stringify(inferenceWindow);

  execFile('python', [anomalyScript, windowJson], { timeout: 20000 }, (error, stdout, stderr) => {
    if (error) {
      // If model not trained yet, return a graceful not-ready response
      if (stdout.includes('not trained yet') || stderr.includes('not trained yet')) {
        return res.json({ notReady: true, message: 'LSTM model not trained yet. Run train_lstm_autoencoder.py.' });
      }
      console.error('[Backend] Anomaly detection error:', stderr);
      return res.status(500).json({ error: 'Anomaly detection failed', details: stderr.substring(0, 200) });
    }
    try {
      const output = JSON.parse(stdout.trim());
      res.json(output);
    } catch (parseErr) {
      console.error('[Backend] Anomaly detector parse error:', stdout);
      res.status(500).json({ error: 'Invalid response from anomaly detector' });
    }
  });
});

// API endpoint for computer vision disease detection
app.post('/api/classify-disease', upload.single('image'), (req, res) => {

  if (!req.file) {
    return res.status(400).json({ error: 'No image file uploaded' });
  }

  const imagePath = req.file.path;
  const pythonScript = path.resolve('ML Models/Computer Vision/computer_vision_app/predict.py');

  console.log(`[Backend] CV Processing image: ${imagePath}`);

  // Run the predict.py script using Python
  exec(`python "${pythonScript}" "${imagePath}"`, (error, stdout, stderr) => {
    // Delete the temporary file
    fs.unlink(imagePath, (err) => {
      if (err) console.error('[Backend] Temp file deletion failed:', err);
    });

    if (error) {
      console.error('[Backend] Python execution error:', error);
      return res.status(500).json({ error: 'Failed to run prediction model', details: stderr });
    }

    console.log(`[Backend] Python output:\n${stdout}`);

    // Parse the output of predict.py
    const lines = stdout.split('\n');
    let prediction = 'Unknown';
    let confidence = 0;

    lines.forEach(line => {
      if (line.startsWith('Prediction:')) {
        prediction = line.replace('Prediction:', '').trim();
      } else if (line.startsWith('Confidence:')) {
        const confStr = line.replace('Confidence:', '').replace('%', '').trim();
        confidence = parseFloat(confStr) / 100.0;
      }
    });

    const friendlyNames = {
      'foot-and-mouth': 'Foot and Mouth Disease (FMD)',
      'lumpy': 'Lumpy Skin Disease (LSD)',
      'mastitis': 'Mastitis Infection',
      'healthy': 'Healthy Animal (No symptoms detected)'
    };

    res.json({
      rawClass: prediction,
      disease: friendlyNames[prediction.toLowerCase()] || prediction,
      confidence: confidence
    });
  });
});

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const rtdb = getDatabase(firebaseApp);

// Sliding window buffer store per device MAC address
const deviceBuffers = {};

function extractFeatures(readings) {
  const ax = readings.map(r => r.x);
  const ay = readings.map(r => r.y);
  const az = readings.map(r => r.z);
  const N = readings.length;

  const meanX = ax.reduce((s, v) => s + v, 0) / N;
  const meanY = ay.reduce((s, v) => s + v, 0) / N;
  const meanZ = az.reduce((s, v) => s + v, 0) / N;

  const stdX = Math.sqrt(ax.reduce((s, v) => s + Math.pow(v - meanX, 2), 0) / N);
  const stdY = Math.sqrt(ay.reduce((s, v) => s + Math.pow(v - meanY, 2), 0) / N);
  const stdZ = Math.sqrt(az.reduce((s, v) => s + Math.pow(v - meanZ, 2), 0) / N);

  const magnitudes = ax.map((_, i) => Math.sqrt(ax[i]**2 + ay[i]**2 + az[i]**2));
  const minMag = Math.min(...magnitudes);
  const maxMag = Math.max(...magnitudes);
  const meanMag = magnitudes.reduce((s, v) => s + v, 0) / N;

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
}

async function start() {
  console.log("[Backend] Authenticating anonymously with Firebase...");
  await signInAnonymously(auth);
  console.log("[Backend] Firebase Authentication successful.");

  const livestockRef = ref(rtdb, 'livestock');
  
  onValue(livestockRef, (snapshot) => {
    if (!snapshot.exists()) return;
    const data = snapshot.val();

    Object.keys(data).forEach(async (mac) => {
      // Skip static keys or dummy logs
      if (mac === 'accelerometer' || mac === 'cow_01') return;

      const deviceData = data[mac]?.latest;
      if (!deviceData || !deviceData.features) return;

      const features = {
        Mean_AccX: deviceData.features.Mean_AccX || 0,
        Mean_AccY: deviceData.features.Mean_AccY || 0,
        Mean_AccZ: deviceData.features.Mean_AccZ || 0,
        Std_AccX: deviceData.features.Std_AccX || 0,
        Std_AccY: deviceData.features.Std_AccY || 0,
        Std_AccZ: deviceData.features.Std_AccZ || 0,
        Min_Magnitude: deviceData.features.Min_Magnitude || 0,
        Max_Magnitude: deviceData.features.Max_Magnitude || 0,
        Mean_Magnitude: deviceData.features.Mean_Magnitude || 0,
        SMA: deviceData.features.SMA || 0
      };

      const activity = predictActivity(features);

      // Update the RTDB node only if the activity classification has changed
      if (deviceData.activityLevel !== activity) {
        console.log(`[Backend] Device: ${mac} | Classified Activity: ${activity}`);
        const activityRef = ref(rtdb, `livestock/${mac}/latest`);
        await update(activityRef, {
          activityLevel: activity
        });
      }
    });
  });

  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`[Backend] Express server running on port ${PORT}`);
  });
}

start().catch(console.error);
