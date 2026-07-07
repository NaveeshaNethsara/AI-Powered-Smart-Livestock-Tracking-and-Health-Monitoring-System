"""
AI Module 2 - Activity Recognition
Trains a Random Forest / Decision Tree classifier on windowed MPU6050
accelerometer features (Mean/Std per axis, magnitude, SMA).

IMPORTANT: This script trains ONLY on activity_recognition_train.csv.
The model is then evaluated on activity_recognition_test.csv, which the
model never sees during training. This is a clean train/test split
(80% / 20%, stratified by Activity class) prepared in advance so there is
no data leakage between training and evaluation.

Files required in the same folder:
    activity_recognition_train.csv   (1600 rows - training only)
    activity_recognition_test.csv    (400 rows  - testing only)

Live inference workflow on the ESP32/backend:
  1. Buffer AccX, AccY, AccZ at ~20Hz for a 2.5s window (50 samples).
  2. Compute the same features used here (mean, std, min/max magnitude, SMA).
  3. Feed the feature vector into the trained model to classify activity.

Usage:
    pip install pandas scikit-learn joblib --break-system-packages
    python train_activity_model.py
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
train_df = pd.read_csv("activity_recognition_train.csv")
test_df = pd.read_csv("activity_recognition_test.csv")

FEATURES = [
    "Mean_AccX", "Mean_AccY", "Mean_AccZ",
    "Std_AccX", "Std_AccY", "Std_AccZ",
    "Min_Magnitude", "Max_Magnitude", "Mean_Magnitude", "SMA",
]
TARGET = "Activity"

# Handle any sensor dropout (NaNs) - fit imputation values on TRAIN only,
# then apply the same values to TEST (prevents test data influencing training)
train_medians = train_df[FEATURES].median()
train_df[FEATURES] = train_df[FEATURES].fillna(train_medians)
test_df[FEATURES] = test_df[FEATURES].fillna(train_medians)

X_train_raw = train_df[FEATURES]
y_train_raw = train_df[TARGET]

X_test_raw = test_df[FEATURES]
y_test_raw = test_df[TARGET]

# ----------------------------------------------------------------------
# 2. Encode labels - fit on TRAIN, apply to TEST
# ----------------------------------------------------------------------
label_encoder = LabelEncoder()
y_train = label_encoder.fit_transform(y_train_raw)
y_test = label_encoder.transform(y_test_raw)

# ----------------------------------------------------------------------
# 3. Scale features - fit on TRAIN only, apply to TEST
# ----------------------------------------------------------------------
scaler = StandardScaler()
X_train = scaler.fit_transform(X_train_raw)
X_test = scaler.transform(X_test_raw)

# ----------------------------------------------------------------------
# 4. Train models on TRAINING data only
# ----------------------------------------------------------------------
rf = RandomForestClassifier(
    n_estimators=200, max_depth=10, random_state=42, class_weight="balanced"
)
rf.fit(X_train, y_train)

dt = DecisionTreeClassifier(max_depth=6, random_state=42, class_weight="balanced")
dt.fit(X_train, y_train)

# ----------------------------------------------------------------------
# 5. Evaluate on the held-out TEST data (never seen during training)
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
# 6. Save trained model + encoders (test data was never used in fitting)
# ----------------------------------------------------------------------
joblib.dump(rf, "activity_rf_model.pkl")
joblib.dump(scaler, "activity_scaler.pkl")
joblib.dump(label_encoder, "activity_label_encoder.pkl")
print("\nModel and encoders saved.")
