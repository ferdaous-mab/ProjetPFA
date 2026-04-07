import cv2
import numpy as np
from insightface.app import FaceAnalysis

face_app = FaceAnalysis(
    name="buffalo_l",
    allowed_modules=["detection", "recognition"]
)
face_app.prepare(ctx_id=-1)

def detect_faces(image: np.ndarray) -> list:
    """
    Détecte tous les visages dans une image.
    Retourne une liste de visages avec bbox, det_score, kps.
    """
    return face_app.get(image)

def crop_face(image: np.ndarray, bbox) -> np.ndarray:
    """
    Recadre le visage depuis l'image originale.
    bbox = [x1, y1, x2, y2]
    """
    x1, y1, x2, y2 = [int(v) for v in bbox[:4]]
    x1 = max(0, x1)
    y1 = max(0, y1)
    x2 = min(image.shape[1], x2)
    y2 = min(image.shape[0], y2)
    return image[y1:y2, x1:x2]

def get_best_face(faces: list):
    """
    Retourne le visage avec le meilleur score de confiance.
    """
    if not faces:
        return None
    return max(faces, key=lambda f: f.det_score)