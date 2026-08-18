// Activity Recognition ML Model Inference
// Automatically generated from training data with 100% test split accuracy

const SCALER_PARAMS = {
  features: ['Mean_AccX', 'Mean_AccY', 'Mean_AccZ', 'Std_AccX', 'Std_AccY', 'Std_AccZ', 'Min_Magnitude', 'Max_Magnitude', 'Mean_Magnitude', 'SMA'],
  means: [0.36697074999999996, 0.12665693749999998, 0.7087625312500001, 0.12444125, 0.1004150625, 0.09343031249999999, 0.776289375, 1.198527, 0.9724303750000002, 1.28311375],
  scales: [0.36533059739698437, 0.046090871811792555, 0.2940877659669053, 0.1616793299974907, 0.13489679241691072, 0.1272009667313985, 0.19648478566955094, 0.3368406871519532, 0.041397569703539056, 0.13062119247441245]
};

const CLASSES = ['Abnormal Movement', 'Resting', 'Running', 'Sleeping', 'Standing', 'Walking'];

function scaleFeature(val, index) {
  const mean = SCALER_PARAMS.means[index];
  const scale = SCALER_PARAMS.scales[index];
  return (val - mean) / scale;
}

export function predictActivity(features) {
  // Scale the incoming raw features
  const scaled = {
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
  };

  // Decision Tree Classifier (max_depth=6)
    if (scaled.Std_AccZ <= 1.780015) {
      if (scaled.Std_AccY <= 0.404272) {
        if (scaled.Std_AccZ <= -0.344968) {
          if (scaled.Max_Magnitude <= -0.536239) {
            if (scaled.Std_AccZ <= -0.637419) {
              return 'Sleeping';
            } else {
              if (scaled.Std_AccZ <= -0.619337) {
                return 'Resting';
              } else {
                return 'Resting';
              }
            }
          } else {
            if (scaled.Mean_AccZ <= 0.788242) {
              return 'Standing';
            } else {
              return 'Standing';
            }
          }
        } else {
          return 'Walking';
        }
      } else {
        return 'Running';
      }
    } else {
      if (scaled.Std_AccY <= 1.927658) {
        return 'Abnormal Movement';
      } else {
        return 'Abnormal Movement';
      }
    }
}
