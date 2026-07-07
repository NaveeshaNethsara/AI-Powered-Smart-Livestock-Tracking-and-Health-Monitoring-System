"""
AI Module 2 - Activity Recognition
Trains a Random Forest / Decision Tree classifier on windowed MPU6050
accelerometer features (Mean/Std per axis, magnitude, SMA).

Live inference workflow on the ESP32/backend:
  1. Buffer AccX, AccY, AccZ at ~20Hz for a 2.5s window (50 samples).
  2. Compute the same features used here (mean, std, min/max magnitude, SMA).
  3. Feed the feature vector into the trained model to classify activity.

Usage:
    pip install pandas scikit-learn joblib --break-system-packages
    python train_activity_model.py
"""

import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.ensemble import RandomForestClassifier
from sklearn.tree import DecisionTreeClassifier
from sklearn.metrics import classification_report
import joblib

df = pd.read_csv("activity_recognition_dataset.csv")

# Handle sensor dropout
for col in ["Mean_AccX", "Mean_AccY", "Mean_AccZ"]:
    df[col] = df[col].fillna(df[col].median())

FEATURES = [
    "Mean_AccX", "Mean_AccY", "Mean_AccZ",
    "Std_AccX", "Std_AccY", "Std_AccZ",
    "Min_Magnitude", "Max_Magnitude", "Mean_Magnitude", "SMA",
]
TARGET = "Activity"

X = df[FEATURES]
y = df[TARGET]

label_encoder = LabelEncoder()
y_encoded = label_encoder.fit_transform(y)

X_train, X_test, y_train, y_test = train_test_split(
    X, y_encoded, test_size=0.2, random_state=42, stratify=y_encoded
)

scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_test_scaled = scaler.transform(X_test)

# --- Random Forest (recommended) ---
rf = RandomForestClassifier(
    n_estimators=200, max_depth=10, random_state=42, class_weight="balanced"
)
rf.fit(X_train_scaled, y_train)
rf_preds = rf.predict(X_test_scaled)

print("=== Random Forest ===")
print(classification_report(y_test, rf_preds, target_names=label_encoder.classes_))

# --- Decision Tree (baseline) ---
dt = DecisionTreeClassifier(max_depth=6, random_state=42, class_weight="balanced")
dt.fit(X_train_scaled, y_train)
dt_preds = dt.predict(X_test_scaled)

print("=== Decision Tree (baseline) ===")
print(classification_report(y_test, dt_preds, target_names=label_encoder.classes_))

importances = pd.Series(rf.feature_importances_, index=FEATURES).sort_values(ascending=False)
print("\nFeature importance:\n", importances)

joblib.dump(rf, "activity_rf_model.pkl")
joblib.dump(scaler, "activity_scaler.pkl")
joblib.dump(label_encoder, "activity_label_encoder.pkl")
print("\nModel and encoders saved.")
