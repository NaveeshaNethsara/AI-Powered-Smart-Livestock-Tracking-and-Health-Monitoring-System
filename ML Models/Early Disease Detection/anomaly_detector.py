"""
anomaly_detector.py
===================
Early Disease Detection — Real-Time Inference Service

Called by Node.js backend with a JSON window of sensor readings.
Returns anomaly classification + disease hint + reconstruction error.

Usage (from Node.js backend):
  python anomaly_detector.py '<JSON_WINDOW_STRING>'

Input JSON format:
  [
    {"temperature": 38.5, "heartRate": 65, "accMagnitude": 1.05,
     "activityScore": 20, "gpsSpeed": 0.0},
    ... (12 entries for 1-hour history)
  ]

Output JSON:
  {
    "isAnomaly": false,
    "reconstructionError": 0.0023,
    "threshold": 0.0412,
    "anomalyScore": 12,
    "diseaseHint": "Normal",
    "diseaseHintDetail": "All vitals within normal range.",
    "confidence": 0.95,
    "featureErrors": {
      "temperature": 0.001, "heartRate": 0.002, ...
    }
  }
"""

import json
import os
import sys
import warnings
warnings.filterwarnings('ignore')

import numpy as np
import torch
import torch.nn as nn
import joblib

# ─── Paths ────────────────────────────────────────────────────────────────────
BASE_DIR       = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH     = os.path.join(BASE_DIR, 'lstm_autoencoder.pth')
SCALER_PATH    = os.path.join(BASE_DIR, 'scaler.pkl')
THRESHOLD_PATH = os.path.join(BASE_DIR, 'threshold.json')

SEQ_LEN    = 12
N_FEATURES = 6
HIDDEN_DIM = 64
NUM_LAYERS = 2

FEATURE_NAMES = ['temperature', 'heartRate', 'accMagnitude', 'activityScore', 'gpsSpeed', 'deltaTemp']


# ─── LSTM Autoencoder (must match training architecture) ──────────────────────
class LSTMAutoencoder(nn.Module):
    def __init__(self, n_features=N_FEATURES, hidden_dim=HIDDEN_DIM, num_layers=NUM_LAYERS, seq_len=SEQ_LEN):
        super(LSTMAutoencoder, self).__init__()
        self.seq_len    = seq_len
        self.n_features = n_features

        self.encoder = nn.LSTM(input_size=n_features, hidden_size=hidden_dim,
                               num_layers=num_layers, batch_first=True,
                               dropout=0.2 if num_layers > 1 else 0.0)
        self.bottleneck = nn.Linear(hidden_dim, hidden_dim // 2)
        self.expand     = nn.Linear(hidden_dim // 2, hidden_dim)
        self.decoder = nn.LSTM(input_size=hidden_dim, hidden_size=hidden_dim,
                               num_layers=num_layers, batch_first=True,
                               dropout=0.2 if num_layers > 1 else 0.0)
        self.output_fc = nn.Linear(hidden_dim, n_features)

    def forward(self, x):
        _, (h_n, _) = self.encoder(x)
        context    = h_n[-1]
        bottleneck = torch.relu(self.bottleneck(context))
        expanded   = torch.relu(self.expand(bottleneck))
        repeated   = expanded.unsqueeze(1).repeat(1, self.seq_len, 1)
        decoded, _ = self.decoder(repeated)
        return self.output_fc(decoded)


# ─── Disease Hint Rules ────────────────────────────────────────────────────────
def classify_disease_hint(readings):
    """
    Rule-based post-processing layer that maps abnormal sensor patterns
    to the most likely disease condition.

    readings: list of dicts with keys temperature, heartRate, activityScore,
              accMagnitude, gpsSpeed
    """
    # Use last 3 readings as the "current" window for rule evaluation
    recent = readings[-3:] if len(readings) >= 3 else readings

    avg_temp     = np.mean([r.get('temperature',  38.5) for r in recent])
    avg_hr       = np.mean([r.get('heartRate',     65.0) for r in recent])
    avg_activity = np.mean([r.get('activityScore', 25.0) for r in recent])
    avg_acc_mag  = np.mean([r.get('accMagnitude',  1.05) for r in recent])
    avg_speed    = np.mean([r.get('gpsSpeed',      0.0)  for r in recent])

    # ── Disease rules (ordered by severity) ─────────────────────────────────
    if avg_hr > 120 and avg_acc_mag > 2.0:
        return ("Predator Attack / Severe Distress",
                f"Extreme tachycardia ({avg_hr:.0f} BPM) with violent motion detected. "
                "Possible predator threat or physical trauma. Check animal location immediately!",
                "critical")

    if avg_temp > 40.5 and avg_hr > 110 and avg_activity < 30:
        return ("Severe Fever / Mastitis",
                f"Body temperature {avg_temp:.1f}°C with heart rate {avg_hr:.0f} BPM and low activity. "
                "Classic signs of mastitis or severe systemic infection. Vet attention required urgently.",
                "critical")

    if avg_temp > 39.8 and avg_hr > 100 and avg_activity < 35:
        return ("Bovine Respiratory Disease (BRD)",
                f"Fever ({avg_temp:.1f}°C), elevated HR ({avg_hr:.0f} BPM), and lethargy detected. "
                "Early signs of respiratory infection. Isolate animal and check for nasal discharge.",
                "critical")

    if avg_temp > 40.0 and avg_hr > 105 and avg_activity < 25:
        return ("Heat Stress",
                f"High body temperature ({avg_temp:.1f}°C) with elevated HR ({avg_hr:.0f} BPM). "
                "Animal may be suffering heat stress. Move to shade, provide fresh water.",
                "critical")

    if avg_activity < 15 and avg_speed < 0.15 and avg_temp > 39.3:
        return ("Lameness / Foot-and-Mouth Disease (FMD)",
                f"Near-zero movement ({avg_speed:.2f} m/s) with reduced activity and elevated temperature. "
                "Possible lameness or FMD. Inspect hooves and check for lesions.",
                "warning")

    if avg_temp < 37.5 and avg_hr > 85:
        return ("Metabolic Disorder (Milk Fever / Ketosis)",
                f"Subnormal temperature ({avg_temp:.1f}°C) with elevated HR ({avg_hr:.0f} BPM). "
                "Possible hypocalcemia or ketosis. Check calcium levels and energy balance.",
                "warning")

    if avg_temp > 39.5 and avg_hr > 95:
        return ("General Infection / Early Fever",
                f"Elevated temperature ({avg_temp:.1f}°C) and heart rate ({avg_hr:.0f} BPM). "
                "Early signs of infection. Monitor closely and check for other symptoms.",
                "warning")

    if avg_hr > 100 and avg_activity < 30:
        return ("Stress / Pain Response",
                f"Elevated heart rate ({avg_hr:.0f} BPM) with low activity may indicate pain or stress. "
                "Observe for signs of injury or digestive discomfort (bloat).",
                "warning")

    return ("Abnormal Pattern Detected",
            f"Sensor readings deviate from the animal's normal baseline. "
            "Avg temp: {avg_temp:.1f}°C, HR: {avg_hr:.0f} BPM, Activity: {avg_activity:.0f}. "
            "Continue monitoring closely.",
            "warning")


# ─── Main Inference Function ───────────────────────────────────────────────────
def detect(window_json: str):
    # Load model artifacts
    if not os.path.exists(MODEL_PATH):
        return {"error": "Model not trained yet. Run train_lstm_autoencoder.py first.",
                "isAnomaly": False, "reconstructionError": 0, "threshold": 0}

    with open(THRESHOLD_PATH, 'r') as f:
        cfg = json.load(f)
    threshold = cfg['threshold']

    scaler = joblib.load(SCALER_PATH)
    model  = LSTMAutoencoder()
    model.load_state_dict(torch.load(MODEL_PATH, map_location='cpu', weights_only=True))
    model.eval()

    # Parse input window
    readings = json.loads(window_json)

    # Build feature matrix with deltaTemp
    feature_matrix = []
    prev_temp = None
    for r in readings:
        raw_temp   = float(r.get('temperature',  38.5))
        # If temp < 35.0°C, it's an ambient room/bench sensor reading.
        # Normalize to normal healthy cattle baseline (38.5°C) to prevent false positive anomalies.
        temp       = 38.5 if raw_temp < 35.0 else raw_temp
        hr         = float(r.get('heartRate',     65.0))
        acc_mag    = float(r.get('accMagnitude',  1.05))
        act_score  = float(r.get('activityScore', 20.0))
        gps_speed  = float(r.get('gpsSpeed',      0.0))
        delta_temp = (temp - prev_temp) if prev_temp is not None else 0.0
        feature_matrix.append([temp, hr, acc_mag, act_score, gps_speed, delta_temp])
        prev_temp = temp

    # Pad or trim to SEQ_LEN
    if len(feature_matrix) < SEQ_LEN:
        pad = [feature_matrix[0]] * (SEQ_LEN - len(feature_matrix))
        feature_matrix = pad + feature_matrix
    else:
        feature_matrix = feature_matrix[-SEQ_LEN:]

    X_raw    = np.array(feature_matrix, dtype=np.float32)
    X_scaled = scaler.transform(X_raw)
    X_tensor = torch.tensor(X_scaled, dtype=torch.float32).unsqueeze(0)  # [1, 12, 6]

    with torch.no_grad():
        reconstructed = model(X_tensor)

    # Per-sample reconstruction error (MSE)
    error_per_step    = ((reconstructed - X_tensor) ** 2).squeeze(0)  # [12, 6]
    recon_error       = error_per_step.mean().item()
    feature_errors    = error_per_step.mean(dim=0).numpy().tolist()   # per-feature

    is_anomaly   = recon_error > threshold
    anomaly_score = min(100, int((recon_error / max(threshold, 1e-9)) * 50))

    # Confidence: how far above/below threshold (sigmoid-like)
    ratio      = recon_error / max(threshold, 1e-9)
    confidence = 1.0 / (1.0 + np.exp(-(ratio - 1.0) * 3.0))  # sigmoid centred at threshold

    result = {
        "isAnomaly":          is_anomaly,
        "reconstructionError": round(recon_error, 6),
        "threshold":          round(threshold, 6),
        "anomalyScore":       anomaly_score,
        "confidence":         round(float(confidence), 4),
        "featureErrors": {
            FEATURE_NAMES[i]: round(feature_errors[i], 6)
            for i in range(len(FEATURE_NAMES))
        },
        "diseaseHint":        "Normal",
        "diseaseHintDetail":  "All vitals within normal range.",
        "diseaseHintSeverity": "normal"
    }

    if is_anomaly:
        hint, detail, severity = classify_disease_hint(readings)
        result["diseaseHint"]         = hint
        result["diseaseHintDetail"]   = detail
        result["diseaseHintSeverity"] = severity

    return result


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No window data provided"}))
        sys.exit(1)

    try:
        output = detect(sys.argv[1])
        print(json.dumps(output))
    except Exception as e:
        print(json.dumps({"error": str(e), "isAnomaly": False,
                          "reconstructionError": 0, "threshold": 0}))
        sys.exit(1)
