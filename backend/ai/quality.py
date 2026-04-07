import cv2
import numpy as np

MIN_SHARPNESS  = 50.0    # était 100.0 — baissé pour webcam
MIN_BRIGHTNESS = 40.0    # était 60.0 — plus tolérant
MAX_BRIGHTNESS = 220.0   # était 200.0 — plus tolérant
MIN_FACE_SIZE  = 60      # était 80 — plus tolérant

def check_sharpness(image: np.ndarray) -> float:
    """
    Calcule le score de netteté de l'image.
    Plus le score est élevé, plus l'image est nette.
    """
    gray  = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    score = cv2.Laplacian(gray, cv2.CV_64F).var()
    return round(float(score), 2)

def check_brightness(image: np.ndarray) -> float:
    """
    Calcule la luminosité moyenne de l'image.
    Valeur entre 0 (noir total) et 255 (blanc total).
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    return round(float(np.mean(gray)), 2)

def check_face_size(bbox) -> bool:
    """
    Vérifie que le visage est suffisamment grand.
    bbox = [x1, y1, x2, y2]
    """
    x1, y1, x2, y2 = bbox[:4]
    width  = x2 - x1
    height = y2 - y1
    return width >= MIN_FACE_SIZE and height >= MIN_FACE_SIZE

def verify_quality(image: np.ndarray, faces: list) -> dict:
    """
    Vérifie la qualité complète d'une image avant encoding.
    Retourne un dict avec le résultat et la raison du rejet.
    """
    if len(faces) == 0:
        return {
            "ok": False,
            "reason": "Aucun visage détecté",
            "sharpness": None,
            "brightness": None
        }

    if len(faces) > 1:
        return {
            "ok": False,
            "reason": "Plusieurs visages détectés — cadrez un seul visage",
            "sharpness": None,
            "brightness": None
        }

    sharpness  = check_sharpness(image)
    brightness = check_brightness(image)
    face       = faces[0]

    if sharpness < MIN_SHARPNESS:
        return {
            "ok": False,
            "reason": f"Image trop floue (score: {sharpness})",
            "sharpness": sharpness,
            "brightness": brightness
        }

    if brightness < MIN_BRIGHTNESS:
        return {
            "ok": False,
            "reason": f"Image trop sombre (luminosité: {brightness})",
            "sharpness": sharpness,
            "brightness": brightness
        }

    if brightness > MAX_BRIGHTNESS:
        return {
            "ok": False,
            "reason": f"Image trop lumineuse (luminosité: {brightness})",
            "sharpness": sharpness,
            "brightness": brightness
        }

    if not check_face_size(face.bbox):
        return {
            "ok": False,
            "reason": "Visage trop petit — rapprochez-vous de la caméra",
            "sharpness": sharpness,
            "brightness": brightness
        }

    return {
        "ok": True,
        "reason": None,
        "sharpness": sharpness,
        "brightness": brightness
    }