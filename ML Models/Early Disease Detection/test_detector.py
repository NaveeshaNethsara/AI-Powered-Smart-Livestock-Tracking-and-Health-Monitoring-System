"""Quick test for the anomaly detector — both normal and fever scenarios."""
import json, subprocess, sys, os

BASE = os.path.dirname(os.path.abspath(__file__))
SCRIPT = os.path.join(BASE, "anomaly_detector.py")

NORMAL_WINDOW = [
    {"temperature":38.5,"heartRate":65,"accMagnitude":1.05,"activityScore":20,"gpsSpeed":0.0},
    {"temperature":38.4,"heartRate":63,"accMagnitude":1.0, "activityScore":20,"gpsSpeed":0.0},
    {"temperature":38.6,"heartRate":66,"accMagnitude":1.08,"activityScore":22,"gpsSpeed":0.0},
    {"temperature":38.5,"heartRate":64,"accMagnitude":1.03,"activityScore":19,"gpsSpeed":0.0},
    {"temperature":38.5,"heartRate":65,"accMagnitude":1.05,"activityScore":20,"gpsSpeed":0.0},
    {"temperature":38.4,"heartRate":64,"accMagnitude":1.02,"activityScore":21,"gpsSpeed":0.0},
    {"temperature":38.6,"heartRate":67,"accMagnitude":1.07,"activityScore":20,"gpsSpeed":0.0},
    {"temperature":38.5,"heartRate":65,"accMagnitude":1.04,"activityScore":20,"gpsSpeed":0.0},
    {"temperature":38.5,"heartRate":66,"accMagnitude":1.06,"activityScore":21,"gpsSpeed":0.0},
    {"temperature":38.4,"heartRate":64,"accMagnitude":1.01,"activityScore":19,"gpsSpeed":0.0},
    {"temperature":38.5,"heartRate":65,"accMagnitude":1.05,"activityScore":20,"gpsSpeed":0.0},
    {"temperature":38.5,"heartRate":65,"accMagnitude":1.05,"activityScore":20,"gpsSpeed":0.0},
]

FEVER_WINDOW = [
    {"temperature":38.5,"heartRate":68,"accMagnitude":1.05,"activityScore":20,"gpsSpeed":0.0},
    {"temperature":38.9,"heartRate":78,"accMagnitude":1.1, "activityScore":18,"gpsSpeed":0.0},
    {"temperature":39.3,"heartRate":88,"accMagnitude":1.05,"activityScore":15,"gpsSpeed":0.0},
    {"temperature":39.8,"heartRate":98,"accMagnitude":1.0, "activityScore":12,"gpsSpeed":0.0},
    {"temperature":40.1,"heartRate":108,"accMagnitude":0.98,"activityScore":10,"gpsSpeed":0.0},
    {"temperature":40.4,"heartRate":112,"accMagnitude":0.97,"activityScore":8, "gpsSpeed":0.0},
    {"temperature":40.5,"heartRate":115,"accMagnitude":0.96,"activityScore":8, "gpsSpeed":0.0},
    {"temperature":40.5,"heartRate":116,"accMagnitude":0.95,"activityScore":8, "gpsSpeed":0.0},
    {"temperature":40.6,"heartRate":117,"accMagnitude":0.95,"activityScore":7, "gpsSpeed":0.0},
    {"temperature":40.5,"heartRate":115,"accMagnitude":0.96,"activityScore":8, "gpsSpeed":0.0},
    {"temperature":40.6,"heartRate":116,"accMagnitude":0.95,"activityScore":8, "gpsSpeed":0.0},
    {"temperature":40.5,"heartRate":115,"accMagnitude":0.95,"activityScore":7, "gpsSpeed":0.0},
]

def run_test(name, window):
    window_str = json.dumps(window)
    result = subprocess.run(
        [sys.executable, SCRIPT, window_str],
        capture_output=True, text=True
    )
    data = json.loads(result.stdout.strip())
    print(f"\n{'='*55}")
    print(f"  TEST: {name}")
    print(f"{'='*55}")
    print(f"  isAnomaly          : {data['isAnomaly']}")
    print(f"  anomalyScore       : {data.get('anomalyScore', '?')}/100")
    print(f"  reconstructionError: {data.get('reconstructionError', '?'):.6f}")
    print(f"  threshold          : {data.get('threshold', '?'):.6f}")
    print(f"  diseaseHint        : {data.get('diseaseHint', '?')}")
    print(f"  diseaseHintSeverity: {data.get('diseaseHintSeverity', '?')}")
    print(f"  confidence         : {data.get('confidence', '?'):.2%}")
    if data.get('featureErrors'):
        print("  featureErrors:")
        for k, v in data['featureErrors'].items():
            print(f"    {k:15s}: {v:.6f}")
    return data

run_test("NORMAL HEALTHY COW", NORMAL_WINDOW)
run_test("FEVER / BRD INFECTION", FEVER_WINDOW)
print("\n[TEST] Both scenarios completed successfully!")
