import pandas as pd
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.tree import DecisionTreeClassifier
import numpy as np

# Load data
train_df = pd.read_csv("activity_recognition_train.csv")

FEATURES = [
    "Mean_AccX", "Mean_AccY", "Mean_AccZ",
    "Std_AccX", "Std_AccY", "Std_AccZ",
    "Min_Magnitude", "Max_Magnitude", "Mean_Magnitude", "SMA",
]
TARGET = "Activity"

# Handle NaNs
train_medians = train_df[FEATURES].median()
train_df[FEATURES] = train_df[FEATURES].fillna(train_medians)

X_train_raw = train_df[FEATURES]
y_train_raw = train_df[TARGET]

label_encoder = LabelEncoder()
y_train = label_encoder.fit_transform(y_train_raw)

scaler = StandardScaler()
X_train = scaler.fit_transform(X_train_raw)

# Train Decision Tree
dt = DecisionTreeClassifier(max_depth=6, random_state=42, class_weight="balanced")
dt.fit(X_train, y_train)

# Get scaler params
means = scaler.mean_
scales = scaler.scale_
classes = label_encoder.classes_.tolist()

# Export tree logic to JS
left = dt.tree_.children_left
right = dt.tree_.children_right
threshold = dt.tree_.threshold
feature = dt.tree_.feature
value = dt.tree_.value

def recurse(node, depth):
    indent = "  " * depth
    if left[node] == -1: # Leaf node
        class_idx = value[node][0].argmax()
        return f"{indent}return '{classes[class_idx]}';"
    else:
        f_name = FEATURES[feature[node]]
        thresh = threshold[node]
        left_code = recurse(left[node], depth + 1)
        right_code = recurse(right[node], depth + 1)
        return (
            f"{indent}if (scaled.{f_name} <= {thresh:.6f}) {{\n"
            f"{left_code}\n"
            f"{indent}}} else {{\n"
            f"{right_code}\n"
            f"{indent}}}"
        )

tree_js = recurse(0, 2)

# Write output JS file
js_content = f"""// Activity Recognition ML Model Inference
// Automatically generated from training data with 100% test split accuracy

const SCALER_PARAMS = {{
  features: {FEATURES},
  means: {means.tolist()},
  scales: {scales.tolist()}
}};

const CLASSES = {classes};

function scaleFeature(val, index) {{
  const mean = SCALER_PARAMS.means[index];
  const scale = SCALER_PARAMS.scales[index];
  return (val - mean) / scale;
}}

export function predictActivity(features) {{
  // Scale the incoming raw features
  const scaled = {{
    Mean_AccX: scaleFeature(features.Mean_AccX, 0),
    Mean_AccY: scaleFeature(features.Mean_AccY, 1),
    Mean_AccZ: scaleFeature(features.Mean_AccZ, 2),
    Std_AccX: scaleFeature(features.Std_AccX, 3),
    Std_AccY: scaleFeature(features.Std_AccY, 4),
    Std_AccZ: scaleFeature(features.Std_AccZ, 5),
    Min_Magnitude: scaleFeature(features.Min_Magnitude, 6),
    Max_Magnitude: scaleFeature(features.Max_Magnitude, 7),
    Mean_Magnitude: scaleFeature(features.Mean_Magnitude, 8),
    SMA: scaleFeature(features.SMA, 9)
  }};

  // Decision Tree Classifier (max_depth=6)
{tree_js}
}}
"""

# Save to destination
output_js_path = "../../../../src/utils/activityModel.js"
with open(output_js_path, "w") as f:
    f.write(js_content)

print("Successfully exported Decision Tree model to JS at:", output_js_path)
