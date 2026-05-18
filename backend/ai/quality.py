"""
quality.py - Verification qualite image
SmartCampus IA - ESISA Fes 2025

Utilise pour deux contextes :
  1. Enrolement   : filtre les mauvaises frames avant stockage
  2. Reconnaissance : filtre les visages trop flous de la camera de classe

Compatible numpy==2.4.4 / opencv==4.13.0
"""

import cv2
import numpy as np
from dataclasses import dataclass


@dataclass
class QualityResult:
    ok:           bool
    score:        float   # score global 0.0 -> 1.0
    sharpness:    float   # variance Laplacien
    brightness:   float   # luminosite moyenne 0-255
    face_size:    tuple   # (width, height) en pixels
    reason:       str = ""

    # Pourcentages pour le frontend (0-100)
    sharpness_pct:  float = 0.0
    brightness_pct: float = 0.0
    size_pct:       float = 0.0

    def to_dict(self) -> dict:
        return {
            "ok":             self.ok,
            "score":          round(self.score, 3),
            "sharpness":      round(float(self.sharpness),   1),
            "brightness":     round(float(self.brightness),  1),
            "face_size":      list(self.face_size),
            "reason":         self.reason,
            "sharpness_pct":  round(self.sharpness_pct,  1),
            "brightness_pct": round(self.brightness_pct, 1),
            "size_pct":       round(self.size_pct,        1),
        }


def verify_quality(
    face_bgr:         np.ndarray,
    min_sharpness:    float = 35.0,
    brightness_range: tuple = (40.0, 225.0),
    min_face_px:      int   = 60,
    context:          str   = "enrollment",   # "enrollment" ou "recognition"
) -> QualityResult:
    """
    Verifie la qualite d'un crop de visage.

    Criteres (3 independants) :
      1. Taille minimale  : le visage doit etre assez grand
      2. Nettete          : variance du Laplacien (flou -> rejet)
      3. Luminosite       : pas trop sombre, pas trop surexpose

    Score global :
      score = 0.40 * nettete + 0.30 * luminosite + 0.30 * taille
      -> utilise pour le tri et la ponderation dans l'enrolement

    Args:
        face_bgr         : crop BGR du visage
        min_sharpness    : seuil nettete (35 = assez permissif pour mobile)
        brightness_range : (min, max) luminosite acceptable
        min_face_px      : taille minimum en px (largeur ET hauteur)
        context          : "enrollment" (strict) ou "recognition" (permissif)

    Returns:
        QualityResult avec ok=True si toutes les conditions sont remplies
    """
    # Seuils adaptes selon le contexte
    if context == "recognition":
        # Camera de classe : conditions moins bonnes, on est plus tolerant
        min_sharpness = 20.0
        brightness_range = (25.0, 235.0)
        min_face_px = 40

    h, w = face_bgr.shape[:2]
    gray = cv2.cvtColor(face_bgr, cv2.COLOR_BGR2GRAY)

    # ── 1. Taille ──────────────────────────────────────────────────────────────
    size_pct = float(min(w * h / (150 * 150) * 100, 100))

    if w < min_face_px or h < min_face_px:
        return QualityResult(
            ok=False, score=0.0,
            sharpness=0.0, brightness=0.0,
            face_size=(w, h),
            reason=f"Visage trop petit ({w}x{h}px). Approchez-vous.",
            sharpness_pct=0.0, brightness_pct=0.0, size_pct=size_pct,
        )

    # ── 2. Nettete (variance Laplacien) ───────────────────────────────────────
    sharpness    = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    sharpness_pct = float(min(sharpness / 200.0 * 100, 100))

    if sharpness < min_sharpness:
        return QualityResult(
            ok=False,
            score=round(sharpness_pct / 100 * 0.4, 3),
            sharpness=sharpness, brightness=0.0,
            face_size=(w, h),
            reason=f"Image floue (nettete={sharpness:.0f}). Restez immobile.",
            sharpness_pct=sharpness_pct, brightness_pct=0.0, size_pct=size_pct,
        )

    # ── 3. Luminosite ──────────────────────────────────────────────────────────
    brightness = float(gray.mean())
    bmin, bmax = brightness_range

    if brightness < bmin:
        brightness_pct = float(brightness / bmin * 100)
        return QualityResult(
            ok=False,
            score=round(sharpness_pct / 100 * 0.4, 3),
            sharpness=sharpness, brightness=brightness,
            face_size=(w, h),
            reason="Trop sombre. Allumez une lumiere.",
            sharpness_pct=sharpness_pct,
            brightness_pct=max(0.0, brightness_pct),
            size_pct=size_pct,
        )

    if brightness > bmax:
        brightness_pct = float((255 - brightness) / (255 - bmax) * 100)
        return QualityResult(
            ok=False,
            score=round(sharpness_pct / 100 * 0.4, 3),
            sharpness=sharpness, brightness=brightness,
            face_size=(w, h),
            reason="Trop lumineux. Evitez la lumiere directe.",
            sharpness_pct=sharpness_pct,
            brightness_pct=max(0.0, brightness_pct),
            size_pct=size_pct,
        )

    # Luminosite dans la zone ideale (80-190 = 100%)
    if 80 <= brightness <= 190:
        brightness_pct = 100.0
    elif brightness < 80:
        brightness_pct = float(brightness / 80.0 * 100)
    else:
        brightness_pct = float((255 - brightness) / 65.0 * 100)
    brightness_pct = max(0.0, min(100.0, brightness_pct))

    # ── Score global ───────────────────────────────────────────────────────────
    score = (
        0.40 * (sharpness_pct  / 100.0) +
        0.30 * (brightness_pct / 100.0) +
        0.30 * (size_pct       / 100.0)
    )

    return QualityResult(
        ok=True,
        score=round(score, 4),
        sharpness=sharpness,
        brightness=brightness,
        face_size=(w, h),
        reason="",
        sharpness_pct=round(sharpness_pct,  1),
        brightness_pct=round(brightness_pct, 1),
        size_pct=round(size_pct,             1),
    )


def top_k_frames(frames: list, k: int = 30) -> list:
    """
    Trie une liste de frames par score qualite et retourne les k meilleures.
    Chaque frame est un dict avec au minimum les cles 'crop' et 'score'.

    Args:
        frames : liste de { crop: np.ndarray, score: float, ... }
        k      : nombre de frames a retourner

    Returns:
        Liste triee (meilleure en premier), max k elements
    """
    sorted_frames = sorted(frames, key=lambda f: f["score"], reverse=True)
    return sorted_frames[:k]