from ultralytics import YOLO
import cv2


model = YOLO(
    "yolo11n.pt"
)


camera = cv2.VideoCapture(0)


while True:

    ret, frame = camera.read()

    if not ret:
        break


    results = model(frame)


    annotated = results[0].plot()


    cv2.imshow(
        "YOLO Cow Detection",
        annotated
    )


    if cv2.waitKey(1) == ord("q"):
        break


camera.release()
cv2.destroyAllWindows()