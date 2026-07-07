"""
AI Module 1 - Health Risk Prediction
Trains a Random Forest / Decision Tree classifier on livestock sensor data
(temperature, activity, movement, GPS distance, age, weight, species).

IMPORTANT: This script trains ONLY on livestock_health_train.csv.
The model is then evaluated on livestock_health_test.csv, which the model
never sees during training. This is a clean train/test split (80% / 20%,
stratified by Health_Status class) prepared in advance so there is no data
leakage between training and evaluation.

Files required in the same folder:
    livestock_health_train.csv   (1280 rows - training only)
    livestock_health_test.csv    (320 rows  - testing only)

Usage:
    pip install pandas scikit-learn joblib --break-system-packages
    python train_health_risk_model.py
"""

import pandas as pd
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.ensemble import RandomForestClassifier
from sklearn.tree import DecisionTreeClassifier
from sklearn.metrics import classification_report, confusion_matrix
import joblib

# ----------------------------------------------------------------------
# 1. Load the PRE-SPLIT train and test files separately
#    (no train_test_split() call here - the split was already done once
#    and saved to disk, so training and testing always use the exact
#    same rows every run)
# ----------------------------------------------------------------------
train_df = pd.read_csv("livestock_health_train.csv")
test_df = pd.read_csv("livestock_health_test.csv")

NUMERIC_FEATURES = [
    "Body_Temperature_C", "Activity_Level", "Movement_Duration_min",
    "GPS_Distance_km", "Age_Years", "Weight_kg",
]
TARGET = "Health_Status"   # switch to "Risk_Level" to train the risk-tier model instead

# Handle any sensor dropout (NaNs) - fit imputation values on TRAIN only,
# then apply the same values to TEST (prevents test data influencing training)
train_medians = train_df[NUMERIC_FEATURES].median()
train_df[NUMERIC_FEATURES] = train_df[NUMERIC_FEATURES].fillna(train_medians)
test_df[NUMERIC_FEATURES] = test_df[NUMERIC_FEATURES].fillna(train_medians)

# ----------------------------------------------------------------------
# 2. Encode Species - fit on TRAIN, apply to TEST
# ----------------------------------------------------------------------
species_encoder = LabelEncoder()
train_df["Species_encoded"] = species_encoder.fit_transform(train_df["Species"])
test_df["Species_encoded"] = species_encoder.transform(test_df["Species"])

FEATURES = NUMERIC_FEATURES + ["Species_encoded"]

X_train_raw = train_df[FEATURES]
y_train_raw = train_df[TARGET]

X_test_raw = test_df[FEATURES]
y_test_raw = test_df[TARGET]

# ----------------------------------------------------------------------
# 3. Encode target labels - fit on TRAIN, apply to TEST
# ----------------------------------------------------------------------
label_encoder = LabelEncoder()
y_train = label_encoder.fit_transform(y_train_raw)
y_test = label_encoder.transform(y_test_raw)

# ----------------------------------------------------------------------
# 4. Scale features - fit on TRAIN only, apply to TEST
# ----------------------------------------------------------------------
scaler = StandardScaler()
X_train = scaler.fit_transform(X_train_raw)
X_test = scaler.transform(X_test_raw)

# ----------------------------------------------------------------------
# 5. Train models on TRAINING data only
# ----------------------------------------------------------------------
rf = RandomForestClassifier(
    n_estimators=200, max_depth=12, random_state=42, class_weight="balanced"
)
rf.fit(X_train, y_train)

dt = DecisionTreeClassifier(max_depth=8, random_state=42, class_weight="balanced")
dt.fit(X_train, y_train)

# ----------------------------------------------------------------------
# 6. Evaluate on the held-out TEST data (never seen during training)
# ----------------------------------------------------------------------
rf_preds = rf.predict(X_test)
dt_preds = dt.predict(X_test)

print(f"Training samples: {len(X_train)} | Testing samples: {len(X_test)}\n")

print("=== Random Forest (evaluated on test set) ===")
print(classification_report(y_test, rf_preds, target_names=label_encoder.classes_))
print("Confusion matrix (rows=actual, cols=predicted):")
print(pd.DataFrame(
    confusion_matrix(y_test, rf_preds),
    index=label_encoder.classes_, columns=label_encoder.classes_
))

print("\n=== Decision Tree baseline (evaluated on test set) ===")
print(classification_report(y_test, dt_preds, target_names=label_encoder.classes_))

importances = pd.Series(rf.feature_importances_, index=FEATURES).sort_values(ascending=False)
print("\nFeature importance (Random Forest):\n", importances)

# ----------------------------------------------------------------------
# 7. Save trained model + encoders (test data was never used in fitting)
# ----------------------------------------------------------------------
joblib.dump(rf, "health_risk_rf_model.pkl")
joblib.dump(scaler, "scaler.pkl")
joblib.dump(label_encoder, "label_encoder.pkl")
joblib.dump(species_encoder, "species_encoder.pkl")
print("\nModel and encoders saved.")
