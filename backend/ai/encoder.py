import numpy as np
from ai.detector import face_app

def encode_face(image: np.ndarray) -> dict:
    """
    Détecte et encode le visage dans une image.
    Retourne un dict avec :
        - embedding   : vecteur 512-d normalisé
        - det_score   : score de confiance détection
        - bbox        : position du visage
        - faces       : liste complète des visages détectés
    """
    faces = face_app.get(image)

    if not faces:
        return {
            "ok": False,
            "reason": "Aucun visage détecté",
            "embedding": None,
            "det_score": None,
            "bbox": None,
            "faces": []
        }

    if len(faces) > 1:
        return {
            "ok": False,
            "reason": "Plusieurs visages détectés",
            "embedding": None,
            "det_score": None,
            "bbox": None,
            "faces": faces
        }

    face      = faces[0]
    embedding = face.embedding
    embedding = embedding / np.linalg.norm(embedding)

    return {
        "ok": True,
        "reason": None,
        "embedding": embedding,
        "det_score": float(face.det_score),
        "bbox": face.bbox.tolist(),
        "faces": faces
    }

def compute_similarity(embedding1: np.ndarray, embedding2: np.ndarray) -> float:
    """
    Calcule la similarité cosinus entre deux embeddings.
    Retourne un score entre 0 et 1.
    """
    return float(np.dot(embedding1, embedding2))