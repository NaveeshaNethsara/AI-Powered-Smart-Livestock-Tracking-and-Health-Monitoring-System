"""
AI Module 1 - Health Risk Prediction
Trains a Random Forest classifier on the livestock health dataset.

Usage:
    pip install pandas scikit-learn joblib --break-system-packages
    python train_health_risk_model.py
"""

import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.ensemble import RandomForestClassifier
from sklearn.tree import DecisionTreeClassifier
from sklearn.metrics import classification_report, confusion_matrix
import joblib

df = pd.read_csv("livestock_health_dataset.csv")

# Handle sensor dropout (missing values) with median imputation
for col in ["Activity_Level", "Movement_Duration_min", "GPS_Distance_km"]:
    df[col] = df[col].fillna(df[col].median())

# Encode species as a numeric feature
species_encoder = LabelEncoder()
df["Species_encoded"] = species_encoder.fit_transform(df["Species"])

FEATURES = [
    "Body_Temperature_C", "Activity_Level", "Movement_Duration_min",
    "GPS_Distance_km", "Age_Years", "Weight_kg", "Species_encoded",
]
TARGET = "Health_Status"   # or use "Risk_Level" for the risk-tier model

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
    n_estimators=200, max_depth=12, random_state=42, class_weight="balanced"
)
rf.fit(X_train_scaled, y_train)
rf_preds = rf.predict(X_test_scaled)

print("=== Random Forest ===")
print(classification_report(y_test, rf_preds, target_names=label_encoder.classes_))

# --- Decision Tree (baseline) ---
dt = DecisionTreeClassifier(max_depth=8, random_state=42, class_weight="balanced")
dt.fit(X_train_scaled, y_train)
dt_preds = dt.predict(X_test_scaled)

print("=== Decision Tree (baseline) ===")
print(classification_report(y_test, dt_preds, target_names=label_encoder.classes_))

# Feature importance (Random Forest)
importances = pd.Series(rf.feature_importances_, index=FEATURES).sort_values(ascending=False)
print("\nFeature importance:\n", importances)

# Save model + encoders for use in your Node.js/React backend (via a Python inference service)
joblib.dump(rf, "health_risk_rf_model.pkl")
joblib.dump(scaler, "scaler.pkl")
joblib.dump(label_encoder, "label_encoder.pkl")
joblib.dump(species_encoder, "species_encoder.pkl")
print("\nModel and encoders saved.")
