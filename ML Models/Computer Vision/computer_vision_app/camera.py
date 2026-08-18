from pathlib import Path

import cv2
import torch
import torch.nn as nn

from torchvision import models, transforms
from PIL import Image



# Paths

BASE_DIR = Path(__file__).parent
MODEL_PATH = BASE_DIR / "best_model.pth"


# Load Checkpoint


checkpoint = torch.load(
    MODEL_PATH,
    map_location="cpu"
)

classes = checkpoint["classes"]


# Build Model


model = models.resnet18(
    weights=None
)

model.fc = nn.Linear(
    model.fc.in_features,
    len(classes)
)

model.load_state_dict(
    checkpoint["model_state_dict"]
)

model.eval()

print("Model loaded!")


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

    rgb = cv2.cvtColor(
        frame,
        cv2.COLOR_BGR2RGB
    )

    image = Image.fromarray(rgb)

    image = transform(image)

    image = image.unsqueeze(0)

   
    # Prediction


    with torch.no_grad():

        outputs = model(image)

        probabilities = torch.softmax(
            outputs,
            dim=1
        )

        confidence, prediction = torch.max(
            probabilities,
            1
        )

    label = classes[prediction.item()]

    text = f"{label} ({confidence.item()*100:.1f}%)"

    cv2.putText(
        frame,
        text,
        (20, 50),
        cv2.FONT_HERSHEY_SIMPLEX,
        1,
        (0, 255, 0),
        2
    )

    cv2.imshow(
        "Disease Classifier",
        frame
    )

    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

camera.release()
cv2.destroyAllWindows()