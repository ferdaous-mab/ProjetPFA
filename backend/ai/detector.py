"""
detector.py - Detection visage InsightFace SCRFD + ArcFace
SmartCampus IA - ESISA Fes 2025

Optimisé caméra plafond classe :
  - det_size=1280×1280 pour détecter les visages petits et lointains
  - Tiling sur les grandes images (> 1600 px)
  - CLAHE pour l'éclairage zénithal plat
  - Re-embedding des petits visages depuis un crop upscalé
"""

import cv2
import numpy as np
import logging

logger = logging.getLogger(__name__)

_face_app    = None
_face_app_hd = None


def get_face_app():
    global _face_app
    if _face_app is None:
        from insightface.app import FaceAnalysis
        _face_app = FaceAnalysis(
            name="buffalo_l",
            allowed_modules=["detection", "recognition"],
            providers=["CPUExecutionProvider"],
        )
        _face_app.prepare(ctx_id=-1, det_size=(640, 640))
    return _face_app


def get_face_app_hd():
    global _face_app_hd
    if _face_app_hd is None:
        from insightface.app import FaceAnalysis
        _face_app_hd = FaceAnalysis(
            name="buffalo_l",
            allowed_modules=["detection", "recognition"],
            providers=["CPUExecutionProvider"],
        )
        _face_app_hd.prepare(ctx_id=-1, det_size=(1280, 1280))
    return _face_app_hd


_MAX_INPUT_DIM    = 3840
_TILE_TRIGGER_DIM = 1600
_TILE_SIZE        = 1280
_TILE_OVERLAP     = 0.25


def _clahe_enhance(img_bgr: np.ndarray) -> np.ndarray:
    lab = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l = clahe.apply(l)
    return cv2.cvtColor(cv2.merge([l, a, b]), cv2.COLOR_LAB2BGR)


def _iou_bbox(a, b):
    xi1, yi1 = max(a[0], b[0]), max(a[1], b[1])
    xi2, yi2 = min(a[2], b[2]), min(a[3], b[3])
    inter = max(0, xi2 - xi1) * max(0, yi2 - yi1)
    union = (a[2]-a[0])*(a[3]-a[1]) + (b[2]-b[0])*(b[3]-b[1]) - inter
    return inter / (union + 1e-6)


def _nms_faces(faces, iou_threshold=0.35):
    faces_sorted = sorted(faces, key=lambda f: f["confidence"], reverse=True)
    kept = []
    for face in faces_sorted:
        if not any(_iou_bbox(face["bbox"], k["bbox"]) > iou_threshold for k in kept):
            kept.append(face)
    return kept


def _detect_tiled(app, img_rgb, img_bgr):
    h, w = img_rgb.shape[:2]
    step = int(_TILE_SIZE * (1 - _TILE_OVERLAP))

    def _origins(dim):
        if dim <= _TILE_SIZE:
            return [0]
        origins = list(range(0, dim - _TILE_SIZE, step))
        last = max(0, dim - _TILE_SIZE)
        if not origins or origins[-1] < last:
            origins.append(last)
        return origins

    all_faces = []
    for y0 in _origins(h):
        for x0 in _origins(w):
            y1 = min(y0 + _TILE_SIZE, h)
            x1 = min(x0 + _TILE_SIZE, w)
            th, tw = y1 - y0, x1 - x0
            tile_rgb = img_rgb[y0:y1, x0:x1]
            tile_bgr = img_bgr[y0:y1, x0:x1]
            try:
                raw = app.get(tile_rgb)
            except Exception:
                continue
            for face in raw:
                if face.normed_embedding is None:
                    continue
                fx1, fy1, fx2, fy2 = [int(v) for v in face.bbox.tolist()]
                fx1 = max(0, fx1); fy1 = max(0, fy1)
                fx2 = min(tw, fx2); fy2 = min(th, fy2)
                fw, fh = fx2 - fx1, fy2 - fy1
                all_faces.append({
                    "bbox":             [fx1+x0, fy1+y0, fx2+x0, fy2+y0],
                    "confidence":       float(face.det_score),
                    "normed_embedding": face.normed_embedding.astype(np.float32),
                    "width":            fw,
                    "height":           fh,
                    "crop":             tile_bgr[fy1:fy2, fx1:fx2].copy(),
                })
    return all_faces


def _reembed_from_crop(app, img_bgr, bbox):
    """
    Recalcule l'embedding depuis un crop large de l'image originale.
    UNIQUEMENT CLAHE + upscale Lanczos — identique au preprocessing d'enrôlement.
    Aide pour les visages petits (< 80px) dont l'embedding de détection est flou.
    """
    x1, y1, x2, y2 = bbox
    fw, fh    = x2 - x1, y2 - y1
    face_size = max(fw, fh, 1)
    h_img, w_img = img_bgr.shape[:2]

    cx, cy = (x1 + x2) // 2, (y1 + y2) // 2
    margin = face_size * 4
    px1 = max(0, cx - margin)
    py1 = max(0, cy - margin)
    px2 = min(w_img, cx + margin)
    py2 = min(h_img, cy + margin)

    crop = img_bgr[py1:py2, px1:px2].copy()
    if crop.size == 0:
        return None

    crop = _clahe_enhance(crop)

    cw, ch   = crop.shape[1], crop.shape[0]
    scale_up = min(max(2.0, 160.0 / face_size), 8.0)
    new_w = min(int(cw * scale_up), 1280)
    new_h = min(int(ch * scale_up), 1280)
    crop_up = cv2.resize(crop, (new_w, new_h), interpolation=cv2.INTER_LANCZOS4)

    crop_rgb = cv2.cvtColor(crop_up, cv2.COLOR_BGR2RGB)
    try:
        detected = app.get(crop_rgb)
        if not detected:
            return None
        cx_c, cy_c = new_w // 2, new_h // 2
        best = min(
            detected,
            key=lambda f: abs((f.bbox[0]+f.bbox[2])/2 - cx_c)
                        + abs((f.bbox[1]+f.bbox[3])/2 - cy_c),
        )
        if best.normed_embedding is not None:
            return best.normed_embedding.astype(np.float32)
    except Exception as exc:
        logger.debug("_reembed_from_crop: %s", exc)
    return None


def compute_best_embedding(img_bgr: np.ndarray, bbox: list):
    """Recalcule l'embedding depuis l'image originale (utilisé par process_image)."""
    app = get_face_app_hd()
    return _reembed_from_crop(app, img_bgr, bbox)


def detect_faces_classroom(img, min_face_size=20, min_score=0.35):
    """
    Détecte tous les visages dans une photo de classe.
    Retourne liste de dicts : bbox, confidence, normed_embedding, width, height, crop.
    """
    app = get_face_app_hd()

    img = _clahe_enhance(img)

    h_orig, w_orig = img.shape[:2]
    scale = 1.0
    if max(h_orig, w_orig) > _MAX_INPUT_DIM:
        scale = _MAX_INPUT_DIM / max(h_orig, w_orig)
        img = cv2.resize(img, (int(w_orig * scale), int(h_orig * scale)),
                         interpolation=cv2.INTER_AREA)

    img_rgb  = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    h_img, w_img = img.shape[:2]

    if max(h_img, w_img) > _TILE_TRIGGER_DIM:
        raw_faces = _detect_tiled(app, img_rgb, img)
    else:
        raw_faces = []
        try:
            for face in app.get(img_rgb):
                if face.normed_embedding is None:
                    continue
                x1, y1, x2, y2 = [int(v) for v in face.bbox.tolist()]
                x1 = max(0, x1); y1 = max(0, y1)
                x2 = min(w_img, x2); y2 = min(h_img, y2)
                fw, fh = x2 - x1, y2 - y1
                raw_faces.append({
                    "bbox":             [x1, y1, x2, y2],
                    "confidence":       float(face.det_score),
                    "normed_embedding": face.normed_embedding.astype(np.float32),
                    "width":            fw,
                    "height":           fh,
                    "crop":             img[y1:y2, x1:x2].copy(),
                })
        except Exception:
            return []

    faces = [
        f for f in raw_faces
        if f["confidence"] >= min_score
        and f["width"]  >= min_face_size
        and f["height"] >= min_face_size
    ]
    faces = _nms_faces(faces)

    # Re-embedding pour les petits visages (< 80px) depuis l'image originale
    for face in faces:
        if face["width"] < 80 or face["height"] < 80:
            better = _reembed_from_crop(app, img, face["bbox"])
            if better is not None:
                face["normed_embedding"] = better

    if scale != 1.0:
        inv = 1.0 / scale
        for f in faces:
            bx1, by1, bx2, by2 = f["bbox"]
            f["bbox"] = [int(bx1*inv), int(by1*inv), int(bx2*inv), int(by2*inv)]

    return faces


class FaceDetector:
    def __init__(self, conf_threshold=0.45, min_face_size=60, det_size=(640, 640)):
        from insightface.app import FaceAnalysis
        self.conf          = conf_threshold
        self.min_face_size = min_face_size
        self.app = FaceAnalysis(
            name="buffalo_l",
            allowed_modules=["detection"],
            providers=["CPUExecutionProvider"],
        )
        self.app.prepare(ctx_id=-1, det_size=det_size)

    def detect(self, image):
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
                "center":     ((x1+x2)//2, (y1+y2)//2),
                "crop":       image[y1:y2, x1:x2].copy(),
                "kps":        kps,
            })
        faces.sort(key=lambda f: f["confidence"], reverse=True)
        return faces

    def detect_largest(self, image):
        faces = self.detect(image)
        if not faces:
            return None
        return max(faces, key=lambda f: f["width"] * f["height"])

    def draw_boxes(self, image, faces):
        out = image.copy()
        for f in faces:
            x1, y1, x2, y2 = f["bbox"]
            cv2.rectangle(out, (x1, y1), (x2, y2), (0, 255, 0), 2)
            cv2.putText(out, f"{f['confidence']:.2f}", (x1, y1-8),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 255, 0), 1)
        return out
