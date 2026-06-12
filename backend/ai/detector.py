"""
detector.py - Detection visage InsightFace SCRFD
SmartCampus IA - ESISA Fes 2025

Utilise buffalo_l (insightface==0.7.3 deja installe).
Telecharge automatiquement au premier lancement (~300 MB).
Compatible numpy==2.4.4 / opencv==4.13.0
"""

import cv2
import numpy as np
import logging

logger = logging.getLogger(__name__)

# ── Singleton FaceAnalysis (detection + recognition) pour le pipeline classe ──
_face_app = None


def get_face_app():
    """
    Retourne un singleton FaceAnalysis buffalo_l avec détection ET reconnaissance.
    Utilisé par detect_faces_classroom() et test_live.py.
    Distinct du FaceDetector (détection seule) utilisé à l'enrôlement.
    """
    global _face_app
    if _face_app is None:
        from insightface.app import FaceAnalysis
        _face_app = FaceAnalysis(
            name="buffalo_l",
            allowed_modules=["detection", "recognition"],
            providers=["CPUExecutionProvider"],
        )
        # 480×480 : bon compromis vitesse CPU / détection visages lointains
        _face_app.prepare(ctx_id=-1, det_size=(480, 480))
        logger.info("face_app (buffalo_l det+rec) prêt.")
    return _face_app


_MAX_INPUT_DIM = 1280  # pixels — au-delà on redimensionne avant detection


def detect_faces_classroom(
    img: np.ndarray,
    min_face_size: int = 50,
    min_score: float = 0.5,
) -> list:
    """
    Détecte tous les visages dans une photo/frame de classe et calcule
    l'embedding L2-normalisé de chaque visage via face.normed_embedding.

    Filtre :
      - visages trop petits (étudiants au fond) : width ou height < min_face_size
      - détections incertaines : det_score < min_score

    Returns liste de dicts :
      bbox             : [x1, y1, x2, y2]
      confidence       : float
      normed_embedding : np.ndarray (512,) float32, norme = 1.0
      width, height    : int
      crop             : np.ndarray BGR (pour anti-spoofing)
    """
    app = get_face_app()

    # Réduire les grandes images avant detection pour accélérer le traitement
    h_orig, w_orig = img.shape[:2]
    scale = 1.0
    if max(h_orig, w_orig) > _MAX_INPUT_DIM:
        scale = _MAX_INPUT_DIM / max(h_orig, w_orig)
        img = cv2.resize(img, (int(w_orig * scale), int(h_orig * scale)),
                         interpolation=cv2.INTER_AREA)

    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    raw = app.get(img_rgb)

    h_img, w_img = img.shape[:2]
    faces = []

    for face in raw:
        score = float(face.det_score)
        if score < min_score:
            continue

        x1, y1, x2, y2 = [int(v) for v in face.bbox.tolist()]
        x1 = max(0, x1); y1 = max(0, y1)
        x2 = min(w_img, x2); y2 = min(h_img, y2)
        fw, fh = x2 - x1, y2 - y1

        if fw < min_face_size or fh < min_face_size:
            continue

        if face.normed_embedding is None:
            continue

        # Remettre les bbox à l'échelle originale si l'image a été réduite
        if scale != 1.0:
            inv = 1.0 / scale
            bx1, by1 = int(x1 * inv), int(y1 * inv)
            bx2, by2 = int(x2 * inv), int(y2 * inv)
        else:
            bx1, by1, bx2, by2 = x1, y1, x2, y2

        faces.append({
            "bbox":             [bx1, by1, bx2, by2],
            "confidence":       score,
            "normed_embedding": face.normed_embedding.astype(np.float32),
            "width":            fw,
            "height":           fh,
            "crop":             img[y1:y2, x1:x2].copy(),
        })

    return faces


class FaceDetector:
    """
    Detection InsightFace SCRFD buffalo_l.
    Interface simple : detect() et detect_largest()
    """

    def __init__(
        self,
        conf_threshold: float = 0.45,
        min_face_size:  int   = 60,
        det_size:       tuple = (640, 640),
    ):
        from insightface.app import FaceAnalysis

        self.conf          = conf_threshold
        self.min_face_size = min_face_size

        self.app = FaceAnalysis(
            name="buffalo_l",
            allowed_modules=["detection"],
            providers=["CPUExecutionProvider"],
        )
        self.app.prepare(ctx_id=-1, det_size=det_size)
        logger.info("FaceDetector (InsightFace SCRFD buffalo_l) pret.")

    def detect(self, image: np.ndarray) -> list:
        """
        Detecte tous les visages dans une image BGR.

        Returns liste de dicts :
          bbox       : [x1, y1, x2, y2]
          confidence : float 0-1
          width      : int
          height     : int
          center     : (cx, cy)
          crop       : np.ndarray BGR recadre sur le visage
        """
        # InsightFace attend RGB
        img_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        raw     = self.app.get(img_rgb)

        h_img, w_img = image.shape[:2]
        faces = []

        for face in raw:
            score = float(face.det_score)
            if score < self.conf:
                continue

            x1, y1, x2, y2 = [int(v) for v in face.bbox.tolist()]
            x1 = max(0, x1); y1 = max(0, y1)
            x2 = min(w_img, x2); y2 = min(h_img, y2)
            fw, fh = x2 - x1, y2 - y1

            if fw < self.min_face_size or fh < self.min_face_size:
                continue

            kps = face.kps.tolist() if face.kps is not None else None

            faces.append({
                "bbox":       [x1, y1, x2, y2],
                "confidence": score,
                "width":      fw,
                "height":     fh,
                "center":     ((x1 + x2) // 2, (y1 + y2) // 2),
                "crop":       image[y1:y2, x1:x2].copy(),
                "kps":        kps,   # [[x,y]×5] left_eye,right_eye,nose,left_mouth,right_mouth
            })

        faces.sort(key=lambda f: f["confidence"], reverse=True)
        return faces

    def detect_largest(self, image: np.ndarray):
        """Retourne uniquement le visage le plus grand (ou None)."""
        faces = self.detect(image)
        if not faces:
            return None
        return max(faces, key=lambda f: f["width"] * f["height"])

    def draw_boxes(self, image: np.ndarray, faces: list) -> np.ndarray:
        """Dessine les bounding boxes — utile pour debug."""
        out = image.copy()
        for f in faces:
            x1, y1, x2, y2 = f["bbox"]
            cv2.rectangle(out, (x1, y1), (x2, y2), (0, 255, 0), 2)
            cv2.putText(
                out, f"{f['confidence']:.2f}",
                (x1, y1 - 8),
                cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 255, 0), 1
            )
        return out