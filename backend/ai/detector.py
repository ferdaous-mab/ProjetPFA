import cv2
import numpy as np
from ai.encoder import face_app

<<<<<<< HEAD
# Initialisation du modèle InsightFace (une seule fois)


=======
>>>>>>> ferdaous

def detect_faces(image: np.ndarray) -> list:
    """
    Détecte les visages dans une image.
    Retourne une liste de visages détectés par InsightFace.
    Chaque visage contient :
        - bbox       : [x1, y1, x2, y2] position du visage
        - det_score  : score de confiance (0 à 1)
        - kps        : 5 landmarks (yeux, nez, bouche)
    """
    faces = face_app.get(image)
    return faces


def crop_face(image: np.ndarray, bbox) -> np.ndarray:
    """
    Recadre le visage depuis l'image originale.
    bbox = [x1, y1, x2, y2]
    """
    x1, y1, x2, y2 = [int(v) for v in bbox[:4]]

    # Sécurité : ne pas dépasser les bords de l'image
    x1 = max(0, x1)
    y1 = max(0, y1)
    x2 = min(image.shape[1], x2)
    y2 = min(image.shape[0], y2)

    return image[y1:y2, x1:x2]


def get_best_face(faces: list):
    """
    Retourne le visage avec le meilleur score de confiance
    si plusieurs visages sont détectés.
    """
    if not faces:
        return None
    return max(faces, key=lambda f: f.det_score)