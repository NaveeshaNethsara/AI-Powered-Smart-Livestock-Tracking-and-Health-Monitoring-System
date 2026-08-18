import sys
import json
import numpy as np
import joblib
import warnings
warnings.filterwarnings("ignore")

# Load models and transformers
try:
    scaler = joblib.load("scaler.pkl")
    species_encoder = joblib.load("species_encoder.pkl")
    rf_status = joblib.load("health_status_rf_model.pkl")
    status_encoder = joblib.load("health_status_label_encoder.pkl")
    rf_risk = joblib.load("risk_level_rf_model.pkl")
    risk_encoder = joblib.load("risk_level_label_encoder.pkl")
except Exception as e:
    print(json.dumps({"error": f"Failed to load model files: {str(e)}"}))
    sys.exit(1)

def main():
    if len(sys.argv) < 9:
        print(json.dumps({"error": "Usage: python predict_health_risk.py <temp> <heart_rate> <activity_level> <movement_duration> <gps_distance> <age> <weight> <species>"}))
        sys.exit(1)

    try:
        temp = float(sys.argv[1])
        heart_rate = float(sys.argv[2])
        activity_level = float(sys.argv[3])
        movement_duration = float(sys.argv[4])
        gps_distance = float(sys.argv[5])
        age = float(sys.argv[6])
        weight = float(sys.argv[7])
        species = sys.argv[8]
    except Exception as e:
        print(json.dumps({"error": f"Invalid arguments format: {str(e)}"}))
        sys.exit(1)

    # Encode Species
    try:
        species_encoded = species_encoder.transform([species])[0]
    except Exception:
        # Fallback to Cattle (0) if species is unknown
        species_encoded = 0

    # Build feature vector
    features = np.array([[temp, heart_rate, activity_level, movement_duration, gps_distance, age, weight, species_encoded]])

    # Scale features
    features_scaled = scaler.transform(features)

    # Predict Health Status
    status_pred_idx = rf_status.predict(features_scaled)[0]
    status_pred = status_encoder.inverse_transform([status_pred_idx])[0]
    status_proba = rf_status.predict_proba(features_scaled)[0]
    status_conf = float(status_proba[status_pred_idx])

    # Predict Risk Level
    risk_pred_idx = rf_risk.predict(features_scaled)[0]
    risk_pred = risk_encoder.inverse_transform([risk_pred_idx])[0]
    risk_proba = rf_risk.predict_proba(features_scaled)[0]
    risk_conf = float(risk_proba[risk_pred_idx])

    # Clinical Scenario Rule Engine Override
    # This prevents normal resting/sleeping states from being incorrectly flagged as sick/inactive.
    if temp <= 39.3:
        if status_pred == "Inactive" and movement_duration >= 5.0:
            status_pred = "Healthy"
            risk_pred = "Healthy"
            status_conf = 0.95
            risk_conf = 0.95
        elif status_pred == "Inactive" and movement_duration < 5.0:
            # True lethargy/inactivity
            status_pred = "Inactive"
            risk_pred = "Low"
            status_conf = 0.85
            risk_conf = 0.85
        elif status_pred in ["Fever", "Possible Infection"]:
            # Normal temp cannot have fever
            status_pred = "Healthy"
            risk_pred = "Healthy"
            status_conf = 0.90
            risk_conf = 0.90
    elif temp >= 39.4:
        # Fever or infection condition
        if status_pred not in ["Fever", "Possible Infection"]:
            status_pred = "Fever"
            status_conf = 0.92
        if risk_pred not in ["Medium", "High"]:
            risk_pred = "High" if temp >= 40.5 else "Medium"
            risk_conf = 0.90

    # Calculate Health Score based on healthy class probability
    try:
        healthy_idx = list(status_encoder.classes_).index("Healthy")
        healthy_proba = float(status_proba[healthy_idx])
    except ValueError:
        healthy_proba = 1.0 if status_pred == "Healthy" else 0.0

    if status_pred == "Healthy":
        health_score = int(max(90, min(100, healthy_proba * 100)))
    elif status_pred == "Stress":
        health_score = int(max(65, min(85, healthy_proba * 100)))
    elif status_pred == "Inactive":
        health_score = int(max(50, min(70, healthy_proba * 100)))
    elif status_pred == "Fever":
        health_score = int(max(40, min(60, healthy_proba * 100)))
    else: # Possible Infection
        health_score = int(max(20, min(45, healthy_proba * 100)))

    output = {
        "status": status_pred,
        "statusConfidence": status_conf,
        "riskLevel": risk_pred,
        "riskConfidence": risk_conf,
        "healthScore": health_score
    }
    print(json.dumps(output))

if __name__ == "__main__":
    main()
