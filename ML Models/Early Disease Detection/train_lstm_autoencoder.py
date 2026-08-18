"""
train_lstm_autoencoder.py
=========================
Early Disease Detection — LSTM Autoencoder Training Script

Trains an LSTM Autoencoder on synthetic "normal" livestock sensor data.
The model learns to reconstruct healthy sensor windows. High reconstruction
error at inference time flags an anomaly (potential disease).

Feature vector per time-step (6 features):
  [temperature, heartRate, accMagnitude, activityScore, gpsSpeed, deltaTemp]

Sequence length: 12 steps  (each step = 5-minute rolling average = 1 hr history)

Output files:
  - lstm_autoencoder.pth   : trained PyTorch model weights
  - scaler.pkl             : StandardScaler fitted on training data
  - threshold.json         : 95th-percentile reconstruction error threshold

Usage:
  python train_lstm_autoencoder.py
"""

import json
import os
import random
import sys

import joblib
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from sklearn.preprocessing import StandardScaler

# ─── Reproducibility ──────────────────────────────────────────────────────────
SEED = 42
random.seed(SEED)
np.random.seed(SEED)
torch.manual_seed(SEED)

# ─── Hyperparameters ──────────────────────────────────────────────────────────
SEQ_LEN    = 12    # 12 × 5-min windows = 1 hour of context
N_FEATURES = 6     # temp, heartRate, accMag, activityScore, gpsSpeed, deltaTemp
HIDDEN_DIM = 64
NUM_LAYERS = 2
BATCH_SIZE = 64
EPOCHS     = 150
LR         = 0.001
THRESHOLD_PERCENTILE = 95   # anomaly threshold = 95th percentile of train errors

BASE_DIR   = os.path.dirname(os.path.abspath(__file__))

# ─── LSTM Autoencoder Architecture ────────────────────────────────────────────
class LSTMAutoencoder(nn.Module):
    def __init__(self, n_features=N_FEATURES, hidden_dim=HIDDEN_DIM, num_layers=NUM_LAYERS, seq_len=SEQ_LEN):
        super(LSTMAutoencoder, self).__init__()
        self.seq_len    = seq_len
        self.n_features = n_features
        self.hidden_dim = hidden_dim

        # Encoder
        self.encoder = nn.LSTM(
            input_size=n_features,
            hidden_size=hidden_dim,
            num_layers=num_layers,
            batch_first=True,
            dropout=0.2 if num_layers > 1 else 0.0
        )

        # Bottleneck projection
        self.bottleneck = nn.Linear(hidden_dim, hidden_dim // 2)
        self.expand     = nn.Linear(hidden_dim // 2, hidden_dim)

        # Decoder
        self.decoder = nn.LSTM(
            input_size=hidden_dim,
            hidden_size=hidden_dim,
            num_layers=num_layers,
            batch_first=True,
            dropout=0.2 if num_layers > 1 else 0.0
        )

        # Output projection back to feature space
        self.output_fc = nn.Linear(hidden_dim, n_features)

    def forward(self, x):
        # x: [batch, seq_len, n_features]
        _, (h_n, _) = self.encoder(x)           # h_n: [num_layers, batch, hidden]
        context = h_n[-1]                         # last layer hidden: [batch, hidden]
        bottleneck = torch.relu(self.bottleneck(context))
        expanded   = torch.relu(self.expand(bottleneck))
        # Repeat context vector for each decoder timestep
        repeated = expanded.unsqueeze(1).repeat(1, self.seq_len, 1)  # [batch, seq, hidden]
        decoded, _ = self.decoder(repeated)
        output = self.output_fc(decoded)          # [batch, seq, n_features]
        return output


# ─── Synthetic Normal Data Generator ──────────────────────────────────────────
def generate_normal_sample(species='Cattle', activity='resting'):
    """
    Generate one 12-step sequence of normal healthy sensor readings.
    Realistic ranges based on veterinary literature.
    """
    # Species baselines
    baselines = {
        'Cattle':  {'temp': 38.5, 'hr': 65,  'hr_std': 5},
        'Buffalo': {'temp': 38.2, 'hr': 50,  'hr_std': 4},
        'Goat':    {'temp': 39.0, 'hr': 80,  'hr_std': 6},
    }
    b = baselines.get(species, baselines['Cattle'])

    # Activity → activity score & GPS speed & accelerometer magnitude
    activity_map = {
        'sleeping':  {'score': 10,  'speed': 0.0,  'acc_mag': 1.0,  'acc_std': 0.05},
        'resting':   {'score': 20,  'speed': 0.0,  'acc_mag': 1.05, 'acc_std': 0.08},
        'standing':  {'score': 35,  'speed': 0.1,  'acc_mag': 1.1,  'acc_std': 0.10},
        'walking':   {'score': 60,  'speed': 0.8,  'acc_mag': 1.6,  'acc_std': 0.25},
        'running':   {'score': 90,  'speed': 2.5,  'acc_mag': 2.8,  'acc_std': 0.50},
    }
    am = activity_map.get(activity, activity_map['resting'])

    sequence = []
    prev_temp = None
    for _ in range(SEQ_LEN):
        temp        = b['temp']  + np.random.normal(0, 0.15)
        heart_rate  = b['hr']    + np.random.normal(0, b['hr_std'])
        acc_mag     = am['acc_mag'] + np.random.normal(0, am['acc_std'])
        act_score   = am['score'] + np.random.normal(0, 3)
        gps_speed   = am['speed'] + np.random.normal(0, 0.05)
        delta_temp  = (temp - prev_temp) if prev_temp is not None else 0.0

        # Clamp to realistic limits
        temp       = np.clip(temp,       36.5, 40.0)
        heart_rate = np.clip(heart_rate, 40.0, 90.0)
        acc_mag    = np.clip(acc_mag,    0.8,  3.0)
        act_score  = np.clip(act_score,  5.0,  95.0)
        gps_speed  = np.clip(gps_speed,  0.0,  3.0)

        sequence.append([temp, heart_rate, acc_mag, act_score, gps_speed, delta_temp])
        prev_temp = temp

    return np.array(sequence, dtype=np.float32)


def build_dataset(n_samples=6000):
    """Generate diverse normal samples across species and activities."""
    species_list   = ['Cattle', 'Buffalo', 'Goat']
    activity_list  = ['sleeping', 'resting', 'standing', 'walking', 'running']
    X = []
    for _ in range(n_samples):
        sp  = random.choice(species_list)
        act = random.choice(activity_list)
        X.append(generate_normal_sample(sp, act))
    return np.stack(X)   # [n_samples, SEQ_LEN, N_FEATURES]


# ─── Training Loop ────────────────────────────────────────────────────────────
def train():
    print("[LSTM] Generating synthetic normal training data...")
    X_raw = build_dataset(n_samples=8000)

    # Fit scaler on flattened features
    X_flat = X_raw.reshape(-1, N_FEATURES)
    scaler = StandardScaler()
    scaler.fit(X_flat)
    X_scaled = scaler.transform(X_flat).reshape(-1, SEQ_LEN, N_FEATURES)

    # Split train / val
    split     = int(0.85 * len(X_scaled))
    X_train   = torch.tensor(X_scaled[:split],  dtype=torch.float32)
    X_val     = torch.tensor(X_scaled[split:],  dtype=torch.float32)

    train_loader = torch.utils.data.DataLoader(
        torch.utils.data.TensorDataset(X_train, X_train),
        batch_size=BATCH_SIZE, shuffle=True
    )

    model     = LSTMAutoencoder()
    criterion = nn.MSELoss()
    optimizer = optim.Adam(model.parameters(), lr=LR, weight_decay=1e-5)
    scheduler = optim.lr_scheduler.StepLR(optimizer, step_size=50, gamma=0.5)

    print(f"[LSTM] Training for {EPOCHS} epochs on {len(X_train)} samples...")
    best_val_loss = float('inf')

    for epoch in range(1, EPOCHS + 1):
        model.train()
        train_loss = 0.0
        for xb, _ in train_loader:
            optimizer.zero_grad()
            output = model(xb)
            loss   = criterion(output, xb)
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            train_loss += loss.item() * len(xb)

        scheduler.step()
        train_loss /= len(X_train)

        # Validation
        model.eval()
        with torch.no_grad():
            val_out  = model(X_val)
            val_loss = criterion(val_out, X_val).item()

        if val_loss < best_val_loss:
            best_val_loss = val_loss
            torch.save(model.state_dict(), os.path.join(BASE_DIR, 'lstm_autoencoder.pth'))

        if epoch % 25 == 0 or epoch == 1:
            print(f"  Epoch {epoch:4d}/{EPOCHS} | Train Loss: {train_loss:.6f} | Val Loss: {val_loss:.6f}")

    print(f"[LSTM] Training complete. Best val loss: {best_val_loss:.6f}")

    # ─── Calculate Anomaly Threshold ──────────────────────────────────────────
    print("[LSTM] Calculating anomaly threshold from training data...")
    model.load_state_dict(torch.load(os.path.join(BASE_DIR, 'lstm_autoencoder.pth'), weights_only=True))
    model.eval()

    reconstruction_errors = []
    with torch.no_grad():
        for i in range(0, len(X_train), BATCH_SIZE):
            batch = X_train[i:i+BATCH_SIZE]
            out   = model(batch)
            # Per-sample MSE
            errors = ((out - batch) ** 2).mean(dim=(1, 2)).numpy()
            reconstruction_errors.extend(errors.tolist())

    threshold = float(np.percentile(reconstruction_errors, THRESHOLD_PERCENTILE))
    print(f"[LSTM] Anomaly threshold (p{THRESHOLD_PERCENTILE}): {threshold:.6f}")

    # ─── Save Artifacts ───────────────────────────────────────────────────────
    joblib.dump(scaler, os.path.join(BASE_DIR, 'scaler.pkl'))
    with open(os.path.join(BASE_DIR, 'threshold.json'), 'w') as f:
        json.dump({
            'threshold': threshold,
            'percentile': THRESHOLD_PERCENTILE,
            'n_features': N_FEATURES,
            'seq_len': SEQ_LEN,
            'hidden_dim': HIDDEN_DIM,
            'num_layers': NUM_LAYERS,
            'best_val_loss': best_val_loss,
            'feature_names': ['temperature', 'heartRate', 'accMagnitude', 'activityScore', 'gpsSpeed', 'deltaTemp']
        }, f, indent=2)

    print("[LSTM] Saved: lstm_autoencoder.pth, scaler.pkl, threshold.json")
    print("[LSTM] Ready for inference with anomaly_detector.py")


if __name__ == '__main__':
    train()
