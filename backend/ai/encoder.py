import cv2
import numpy as np
from ai.detector import face_app


def normalize_image(img: np.ndarray) -> np.ndarray:
    """Correction gamma + égalisation histogramme adaptative (CLAHE)."""
    # Correction gamma
    gamma = 1.2
    lut = np.array([((i / 255.0) ** (1.0 / gamma)) * 255 for i in range(256)], dtype=np.uint8)
    img = cv2.LUT(img, lut)

    # CLAHE sur canal L (LAB)
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    lab[:, :, 0] = clahe.apply(lab[:, :, 0])
    return cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)


def augment_image(img: np.ndarray) -> list[np.ndarray]:
    """
    5 variations ciblées — diversité maximale, vitesse optimale.
    Original + flip + rotation -10° + rotation +10° + luminosité réduite
    """
    h, w = img.shape[:2]
    cx, cy = w // 2, h // 2
    augmented = []

    # 1. Original normalisé
    augmented.append(normalize_image(img))

    # 2. Flip horizontal (profil opposé)
    augmented.append(normalize_image(cv2.flip(img, 1)))

    # 3. Rotation -10° (tête légèrement penchée gauche)
    M = cv2.getRotationMatrix2D((cx, cy), -10, 1.0)
    augmented.append(normalize_image(cv2.warpAffine(img, M, (w, h))))

    # 4. Rotation +10° (tête légèrement penchée droite)
    M = cv2.getRotationMatrix2D((cx, cy), 10, 1.0)
    augmented.append(normalize_image(cv2.warpAffine(img, M, (w, h))))

    # 5. Luminosité réduite (conditions sombres)
    dark = cv2.convertScaleAbs(img, alpha=0.75, beta=0)
    augmented.append(normalize_image(dark))

    return augmented


def encode_face(img: np.ndarray) -> tuple[np.ndarray | None, float]:
    """Encodage simple d'un visage — retourne (embedding, det_score)."""
    faces = face_app.get(img)
    if not faces:
        return None, 0.0
    face = max(faces, key=lambda f: f.det_score)
    embedding = face.normed_embedding.astype(np.float32)
    return embedding, float(face.det_score)


def encode_face_augmented(img: np.ndarray) -> tuple[np.ndarray | None, float]:
    """
    Encodage avec 5 augmentations + moyenne pondérée par det_score.
    5x plus rapide que l'ancienne version (5 au lieu de 12 augmentations).
    """
    variations = augment_image(img)
    embeddings = []
    weights = []

    for variation in variations:
        faces = face_app.get(variation)
        if not faces:
            continue
        face = max(faces, key=lambda f: f.det_score)
        if face.det_score < 0.5:  # ignorer détections faibles
            continue
        embeddings.append(face.normed_embedding.astype(np.float32))
        weights.append(float(face.det_score))

    if not embeddings:
        return None, 0.0

    # Moyenne pondérée par det_score
    weights_arr = np.array(weights)
    weights_arr = weights_arr / weights_arr.sum()
    averaged = np.average(embeddings, axis=0, weights=weights_arr)

    # Normalisation L2 finale
    norm = np.linalg.norm(averaged)
    if norm == 0:
        return None, 0.0
    averaged = averaged / norm

    return averaged.astype(np.float32), float(np.mean(weights))


def compute_similarity(emb1: np.ndarray, emb2: np.ndarray) -> float:
    """Similarité cosinus entre deux embeddings normalisés L2."""
    return float(np.dot(emb1, emb2))