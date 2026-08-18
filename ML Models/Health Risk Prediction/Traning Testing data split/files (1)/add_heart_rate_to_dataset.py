import pandas as pd
import numpy as np

def generate_heart_rate(row):
    species = row["Species"]
    status = row["Health_Status"]
    
    # Define ranges based on clinical guidelines for species and health condition
    if species == "Cattle":
        if status == "Healthy":
            return np.random.randint(55, 81)
        elif status == "Fever":
            return np.random.randint(85, 121)
        elif status == "Possible Infection":
            return np.random.randint(90, 126)
        elif status == "Stress":
            return np.random.randint(80, 111)
        else: # Inactive
            return np.random.randint(45, 61)
            
    elif species == "Buffalo":
        if status == "Healthy":
            return np.random.randint(45, 61)
        elif status == "Fever":
            return np.random.randint(65, 91)
        elif status == "Possible Infection":
            return np.random.randint(70, 96)
        elif status == "Stress":
            return np.random.randint(60, 86)
        else: # Inactive
            return np.random.randint(38, 49)
            
    else: # Goat
        if status == "Healthy":
            return np.random.randint(75, 96)
        elif status == "Fever":
            return np.random.randint(100, 131)
        elif status == "Possible Infection":
            return np.random.randint(105, 136)
        elif status == "Stress":
            return np.random.randint(95, 121)
        else: # Inactive
            return np.random.randint(60, 76)

# Load the datasets
train_df = pd.read_csv("livestock_health_train.csv")
test_df = pd.read_csv("livestock_health_test.csv")

# Apply mapping to add Heart_Rate_BPM column
np.random.seed(42)  # For reproducibility
train_df["Heart_Rate_BPM"] = train_df.apply(generate_heart_rate, axis=1)
test_df["Heart_Rate_BPM"] = test_df.apply(generate_heart_rate, axis=1)

# Rearrange columns to keep it organized (optional, but good practice)
cols = list(train_df.columns)
# Target columns are last: ['Health_Status', 'Risk_Level']
# Insert Heart_Rate_BPM before Health_Status
cols.remove("Heart_Rate_BPM")
target_idx = cols.index("Health_Status")
cols.insert(target_idx, "Heart_Rate_BPM")

train_df = train_df[cols]
test_df = test_df[cols]

# Save modified datasets
train_df.to_csv("livestock_health_train.csv", index=False)
test_df.to_csv("livestock_health_test.csv", index=False)

print("Successfully injected Heart_Rate_BPM column into train and test datasets based on clinical profiles.")
