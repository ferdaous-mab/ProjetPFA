import cv2
import numpy as np

MIN_SHARPNESS  = 40.0
MIN_BRIGHTNESS = 35.0
MAX_BRIGHTNESS = 225.0
MIN_FACE_SIZE  = 50


def verify_quality(img: np.ndarray, faces: list) -> dict:
    if len(faces) == 0:
        return {"ok": False, "reason": "Aucun visage — centrez votre visage",
                "sharpness": None, "brightness": None}
    if len(faces) > 1:
        return {"ok": False, "reason": "Plusieurs visages détectés",
                "sharpness": None, "brightness": None}

    gray       = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    sharpness  = round(float(cv2.Laplacian(gray, cv2.CV_64F).var()), 2)
    brightness = round(float(np.mean(gray)), 2)

    face = faces[0]
    x1, y1, x2, y2 = [int(v) for v in face.bbox]
    if (x2 - x1) < MIN_FACE_SIZE or (y2 - y1) < MIN_FACE_SIZE:
        return {"ok": False, "reason": "Rapprochez-vous de la caméra",
                "sharpness": sharpness, "brightness": brightness}
    if sharpness < MIN_SHARPNESS:
        return {"ok": False, "reason": "Restez immobile — image floue",
                "sharpness": sharpness, "brightness": brightness}
    if brightness < MIN_BRIGHTNESS:
        return {"ok": False, "reason": "Trop sombre — éclairez votre visage",
                "sharpness": sharpness, "brightness": brightness}
    if brightness > MAX_BRIGHTNESS:
        return {"ok": False, "reason": "Trop lumineux",
                "sharpness": sharpness, "brightness": brightness}

    return {"ok": True, "reason": None,
            "sharpness": sharpness, "brightness": brightness}