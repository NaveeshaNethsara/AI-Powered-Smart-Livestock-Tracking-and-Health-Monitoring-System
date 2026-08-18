from pathlib import Path
from collections import Counter

import cv2
import torch
import torch.nn as nn

from ultralytics import YOLO
from torchvision import models, transforms
from PIL import Image



# Paths


BASE_DIR = Path(__file__).parent

MODEL_PATH = BASE_DIR / "best_model.pth"
YOLO_PATH = BASE_DIR / "yolo11n.pt"



# Load Checkpoint


checkpoint = torch.load(
    MODEL_PATH,
    map_location="cpu"
)

classes = checkpoint["classes"]



# Prediction Smoothing


prediction_history = []

HISTORY_SIZE = 20



# Load Disease Model


disease_model = models.resnet18(
    weights=None
)

disease_model.fc = nn.Linear(
    disease_model.fc.in_features,
    len(classes)
)

disease_model.load_state_dict(
    checkpoint["model_state_dict"]
)

disease_model.eval()

print("Disease model loaded")



# Load YOLO


animal_detector = YOLO(YOLO_PATH)

print("YOLO loaded")



# Image Transform


transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor()
])



# Camera


camera = cv2.VideoCapture(0)

while True:

    ret, frame = camera.read()

    if not ret:
        break

    results = animal_detector(frame)

    for result in results:

        for box in result.boxes:

            confidence = float(box.conf[0])

            class_id = int(box.cls[0])

            # COCO class 19 = cow
            if class_id == 19 and confidence > 0.5:

                x1, y1, x2, y2 = map(
                    int,
                    box.xyxy[0]
                )

                cow = frame[y1:y2, x1:x2]

                if cow.size == 0:
                    continue

                rgb = cv2.cvtColor(
                    cow,
                    cv2.COLOR_BGR2RGB
                )

                image = Image.fromarray(rgb)

                image = transform(image)

                image = image.unsqueeze(0)

                # Disease Prediction

                with torch.no_grad():

                    outputs = disease_model(image)

                    probabilities = torch.softmax(
                        outputs,
                        dim=1
                    )

                    disease_confidence, prediction = torch.max(
                        probabilities,
                        1
                    )

                current_prediction = classes[
                    prediction.item()
                ]

                # Prediction Smoothing

                prediction_history.append(
                    current_prediction
                )

                if len(prediction_history) > HISTORY_SIZE:
                    prediction_history.pop(0)

                final_prediction = Counter(
                    prediction_history
                ).most_common(1)[0][0]

                final_confidence = (
                    disease_confidence.item() * 100
                )

                # Draw 

                cv2.rectangle(
                    frame,
                    (x1, y1),
                    (x2, y2),
                    (0, 255, 0),
                    2
                )

                cv2.putText(
                    frame,
                    f"{final_prediction} ({final_confidence:.1f}%)",
                    (x1, y1 - 10),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.8,
                    (0, 255, 0),
                    2
                )

    cv2.imshow(
        "Animal Disease AI",
        frame
    )

    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

camera.release()
cv2.destroyAllWindows()