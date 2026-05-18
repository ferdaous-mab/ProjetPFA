"""
encoder.py - Encodeur ArcFace via InsightFace buffalo_l
SmartCampus IA - ESISA Fes 2025

buffalo_l contient SCRFD (detection) + ArcFace (reconnaissance 512D).
Aucun fichier ONNX a telecharger separement.
Compatible onnxruntime==1.24.4 / numpy==2.4.4
"""

import cv2
import numpy as np
import logging

logger = logging.getLogger(__name__)


class FaceEncoder:
    """
    Encodeur ArcFace via InsightFace buffalo_l.
    Produit un embedding L2-normalise de 512 dimensions.
    """

    def __init__(self, use_gpu: bool = False):
        from insightface.app import FaceAnalysis

        providers = (
            ["CUDAExecutionProvider", "CPUExecutionProvider"]
            if use_gpu
            else ["CPUExecutionProvider"]
        )

        self.app = FaceAnalysis(
            name="buffalo_l",
            allowed_modules=["detection", "recognition"],
            providers=providers,
        )
        self.app.prepare(ctx_id=-1, det_size=(640, 640))
        self.model_name = "ArcFace buffalo_l"
        logger.info(f"FaceEncoder ({self.model_name}) pret.")

    # ── Encodage ──────────────────────────────────────────────────────────────
    def encode(self, face_bgr: np.ndarray) -> np.ndarray:
        """
        Encode un crop de visage (BGR) -> embedding 512D normalise L2.

        Strategie :
          1. InsightFace detecte + encode dans le crop
          2. Si echoue (visage trop petit) -> resize 224x224 et reessaie
          3. Normalisation L2 finale

        Args:
            face_bgr : crop BGR issu de FaceDetector.detect()

        Returns:
            np.ndarray (512,) float32, ||emb|| = 1.0
        """
        if face_bgr is None or face_bgr.size == 0:
            raise ValueError("Image visage vide.")

        emb = self._try_encode(face_bgr)

        # Fallback 1 : agrandissement si trop petit
        if emb is None:
            h, w = face_bgr.shape[:2]
            target = max(w * 2, h * 2, 320)
            face_big = cv2.resize(face_bgr, (target, target), interpolation=cv2.INTER_CUBIC)
            emb = self._try_encode(face_big)

        # Fallback 2 : ajout de marges (réplication des bords) pour donner
        # du contexte à SCRFD qui tourne en interne dans FaceAnalysis
        if emb is None:
            h, w = face_bgr.shape[:2]
            ph, pw = h // 2, w // 2
            face_padded = cv2.copyMakeBorder(
                face_bgr, ph, ph, pw, pw, cv2.BORDER_REPLICATE
            )
            emb = self._try_encode(face_padded)

        # Fallback 3 : miroir horizontal (peut aider pour les angles extrêmes)
        if emb is None:
            emb = self._try_encode(cv2.flip(face_bgr, 1))

        if emb is None:
            raise ValueError(
                "Visage non encode. "
                "Verifiez que le visage est bien visible et eclaire."
            )

        # Normalisation L2
        norm = np.linalg.norm(emb)
        if norm < 1e-10:
            raise ValueError("Embedding degenere (norme nulle).")
        return (emb / norm).astype(np.float32)

    def _try_encode(self, face_bgr: np.ndarray):
        """Tente l'encodage, retourne None si echec."""
        try:
            img_rgb = cv2.cvtColor(face_bgr, cv2.COLOR_BGR2RGB)
            faces   = self.app.get(img_rgb)
            if faces:
                best = max(faces, key=lambda f: f.det_score)
                return best.embedding.astype(np.float32)
        except Exception as e:
            logger.debug(f"_try_encode echoue : {e}")
        return None

    def encode_batch(self, faces: list) -> list:
        """Encode une liste de crops, ignore les echecs."""
        results = []
        for face in faces:
            try:
                results.append(self.encode(face))
            except Exception as e:
                logger.warning(f"Encodage ignore : {e}")
        return results

    # ── Similarite ────────────────────────────────────────────────────────────
    @staticmethod
    def cosine_similarity(emb1: np.ndarray, emb2: np.ndarray) -> float:
        """Similarite cosinus entre deux embeddings normalises L2."""
        return float(np.dot(emb1, emb2))

    @staticmethod
    def is_same_person(
        emb1: np.ndarray,
        emb2: np.ndarray,
        threshold: float = 0.45,
    ) -> tuple:
        """
        Compare deux embeddings.
        threshold 0.45 = bon equilibre precision/rappel pour ArcFace buffalo_l
        """
        score = float(np.dot(emb1, emb2))
        return score >= threshold, score

    # ── Agregation enrolement ─────────────────────────────────────────────────
    @staticmethod
    def weighted_average(
        embeddings: list,
        weights: list = None,
    ) -> np.ndarray:
        """
        Calcule l'embedding final par moyenne ponderee + normalisation L2.
        Utilise apres l'enrolement pour fusionner les N meilleures frames.

        Args:
            embeddings : liste de np.ndarray (512,)
            weights    : liste de float (scores qualite) - None = poids egaux

        Returns:
            np.ndarray (512,) normalise L2
        """
        if not embeddings:
            raise ValueError("Liste embeddings vide.")

        mat = np.stack(embeddings, axis=0).astype(np.float32)   # (N, 512)

        if weights is None:
            avg = mat.mean(axis=0)
        else:
            w = np.array(weights, dtype=np.float32)
            w = np.clip(w, 0, None)
            total = w.sum()
            if total < 1e-10:
                avg = mat.mean(axis=0)
            else:
                w /= total
                avg = (mat * w[:, None]).sum(axis=0)

        norm = np.linalg.norm(avg)
        if norm < 1e-10:
            raise ValueError("Embedding moyen degenere.")
        return (avg / norm).astype(np.float32)