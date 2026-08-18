import pandas as pd
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.ensemble import RandomForestClassifier
import joblib

# Load datasets
train_df = pd.read_csv("livestock_health_train.csv")
test_df = pd.read_csv("livestock_health_test.csv")

NUMERIC_FEATURES = [
    "Body_Temperature_C", "Heart_Rate_BPM", "Activity_Level", "Movement_Duration_min",
    "GPS_Distance_km", "Age_Years", "Weight_kg",
]

# Impute missing values
train_medians = train_df[NUMERIC_FEATURES].median()
train_df[NUMERIC_FEATURES] = train_df[NUMERIC_FEATURES].fillna(train_medians)
test_df[NUMERIC_FEATURES] = test_df[NUMERIC_FEATURES].fillna(train_medians)

# Encode Species
species_encoder = LabelEncoder()
train_df["Species_encoded"] = species_encoder.fit_transform(train_df["Species"])
test_df["Species_encoded"] = species_encoder.transform(test_df["Species"])

FEATURES = NUMERIC_FEATURES + ["Species_encoded"]

X_train_raw = train_df[FEATURES]
X_test_raw = test_df[FEATURES]

# Fit Scaler
scaler = StandardScaler()
X_train = scaler.fit_transform(X_train_raw)
X_test = scaler.transform(X_test_raw)

# 1. Train Health Status Model
y_train_status_raw = train_df["Health_Status"]
y_test_status_raw = test_df["Health_Status"]

status_encoder = LabelEncoder()
y_train_status = status_encoder.fit_transform(y_train_status_raw)
y_test_status = status_encoder.transform(y_test_status_raw)

rf_status = RandomForestClassifier(n_estimators=200, max_depth=12, random_state=42, class_weight="balanced")
rf_status.fit(X_train, y_train_status)

# 2. Train Risk Level Model
y_train_risk_raw = train_df["Risk_Level"]
y_test_risk_raw = test_df["Risk_Level"]

risk_encoder = LabelEncoder()
y_train_risk = risk_encoder.fit_transform(y_train_risk_raw)
y_test_risk = risk_encoder.transform(y_test_risk_raw)

rf_risk = RandomForestClassifier(n_estimators=200, max_depth=12, random_state=42, class_weight="balanced")
rf_risk.fit(X_train, y_train_risk)

# Save everything
joblib.dump(scaler, "scaler.pkl")
joblib.dump(species_encoder, "species_encoder.pkl")
joblib.dump(rf_status, "health_status_rf_model.pkl")
joblib.dump(status_encoder, "health_status_label_encoder.pkl")
joblib.dump(rf_risk, "risk_level_rf_model.pkl")
joblib.dump(risk_encoder, "risk_level_label_encoder.pkl")

print("Both models and encoders trained and saved successfully.")
