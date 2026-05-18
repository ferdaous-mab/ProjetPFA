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