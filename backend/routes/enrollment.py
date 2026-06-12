"""
enrollment.py - Pipeline enrolement facial
SmartCampus IA - ESISA Fes 2025
"""

import base64, uuid, time, logging, cv2, numpy as np
from concurrent.futures import ThreadPoolExecutor
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from config import get_db
from ai.storage import upload_image
from db import crud
from db.models import Student

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/enrollment", tags=["Enrollment"])

# ── Config ────────────────────────────────────────────────────────────────────
BEST_PER_ANGLE       = 5    # meilleures frames gardees par angle
MIN_FRAMES_TO_ENCODE = 3    # minimum angles avec au moins 1 bonne frame
MIN_FACE_PX          = 60
MIN_QUALITY_SCORE    = 0.12 # score minimum pour accepter une frame
MAX_MOVE_RATIO       = 0.18 # mouvement max tolere (ratio de la taille du visage)
CONFIDENCE_GOOD      = 0.75
CONFIDENCE_MEDIUM    = 0.55

# Seuils relatifs pour haut/bas (pitch = (nose_y - eye_mid_y) / eye_dist)
# Frontal : ~0.6-0.8.  Haut (regarde plafond) : pitch DIMINUE.  Bas (regarde sol) : pitch AUGMENTE.
DELTA_PITCH_HAUT = 0.10   # pitch doit DIMINUER de 0.10 sous le frontal calibré
DELTA_PITCH_BAS  = 0.09   # pitch doit AUGMENTER de 0.09 au-dessus du frontal calibré

_sessions: dict[str, dict] = {}
_detector = None
_encoder  = None

def get_detector():
    global _detector
    if _detector is None:
        from ai.detector import FaceDetector
        _detector = FaceDetector(conf_threshold=0.30, min_face_size=MIN_FACE_PX)
    return _detector

def get_encoder():
    global _encoder
    if _encoder is None:
        from ai.encoder import FaceEncoder
        _encoder = FaceEncoder()
    return _encoder


# ── Schemas ───────────────────────────────────────────────────────────────────
class StudentCreate(BaseModel):
    nom:            str
    prenom:         str
    email:          str
    classe:         str
    annee_scolaire: Optional[str] = "2024-2025"

class StartRequest(BaseModel):
    student_id: str

class CaptureRequest(BaseModel):
    session_id: str
    image_b64:  str
    angle:      Optional[str] = "face"

class FinalizeRequest(BaseModel):
    session_id: str


# ── Helpers qualite ───────────────────────────────────────────────────────────
def _quality_score(crop: np.ndarray) -> float:
    h, w = crop.shape[:2]
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    sharp      = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    sharp_score = min(sharp / 200.0, 1.0)
    bright = float(gray.mean())
    if 80 <= bright <= 190:
        bright_score = 1.0
    elif bright < 80:
        bright_score = max(bright / 80.0, 0.0)
    else:
        bright_score = max((255 - bright) / 65.0, 0.0)
    size_score = min((w * h) / (150 * 150), 1.0)
    return round(0.40 * sharp_score + 0.30 * bright_score + 0.30 * size_score, 4)


def _coherence_score(embeddings: list) -> float:
    if len(embeddings) < 2:
        return 0.0
    mat  = np.stack(embeddings, axis=0)
    sims = mat @ mat.T
    n    = len(embeddings)
    scores = [float(sims[i, j]) for i in range(n) for j in range(i + 1, n)]
    return round(float(np.mean(scores)), 4) if scores else 0.0


# ── Estimation de pose (yaw/pitch depuis les 5 keypoints SCRFD) ───────────────
def _estimate_pose(kps: list | None, bbox: list) -> tuple[float | None, float | None]:
    """
    Retourne (yaw, pitch) à partir des 5 keypoints SCRFD.
    kps : [[x,y]×5] left_eye, right_eye, nose, left_mouth, right_mouth

    yaw   : normalisé par eye_dist
            négatif → nez vers gauche caméra (utilisateur tourne la tête à DROITE)
            positif → nez vers droite caméra (utilisateur tourne la tête à GAUCHE)

    pitch : normalisé par eye_dist (distance inter-oculaire, stable au pitch)
            ~0.6-0.8 pour un visage frontal
            < 0.45   → utilisateur regarde vers le HAUT (nez se rapproche des yeux)
            > 0.95   → utilisateur regarde vers le BAS  (nez s'éloigne des yeux)

    NOTE : on normalise par eye_dist et NON par face_h.
    Quand l'utilisateur baisse la tête, la bbox grandit (menton dans le frame)
    ce qui ferait BAISSER un ratio /face_h alors que nose s'éloigne réellement
    des yeux — face_h est donc un normaliseur instable pour le pitch.
    """
    if not kps or len(kps) < 3:
        return None, None
    lx, ly = kps[0]   # left eye
    rx, ry = kps[1]   # right eye
    nx, ny = kps[2]   # nose

    eye_dist = rx - lx
    if eye_dist < 4:
        return None, None

    eye_mid_x = (lx + rx) / 2
    eye_mid_y = (ly + ry) / 2

    yaw   = round((nx - eye_mid_x) / eye_dist, 3)
    pitch = round((ny - eye_mid_y) / eye_dist, 3)   # ~0.6–0.8 frontal

    return yaw, pitch


# Consignes lisibles retournées au frontend pour chaque angle requis
_ANGLE_HINT = {
    "face":   "Regardez droit devant",
    "droite": "Tournez la tête à droite",
    "gauche": "Tournez la tête à gauche",
    "haut":   "Levez légèrement la tête",
    "bas":    "Baissez légèrement la tête",
}

def _pose_matches_angle(yaw: float | None, pitch: float | None,
                         angle_id: str,
                         calib_pitch: float | None = None,
                         calib_yaw:   float | None = None) -> bool:
    """
    Vérifie que la pose correspond à l'angle demandé.

    face / gauche / droite : vérification par yaw (fiable pour SCRFD).
    haut / bas             : vérifie yaw (pas de rotation latérale) + pitch relatif
                             au frontal calibré. pitch diminue pour haut, augmente pour bas.
    """
    if yaw is None:
        return True

    p  = pitch if pitch is not None else 0.70
    cy = calib_yaw if calib_yaw is not None else 0.0
    dw = yaw - cy

    if angle_id == "face":
        result = abs(dw) < 0.22 and 0.42 < p < 1.20

    elif angle_id == "droite":
        result = dw < -0.13

    elif angle_id == "gauche":
        result = dw > 0.13

    elif angle_id == "haut":
        # pitch DIMINUE quand on regarde en haut (nez se rapproche des yeux en image)
        if pitch is None:
            result = abs(dw) < 0.30
        else:
            cp = calib_pitch if calib_pitch is not None else 0.70
            result = abs(dw) < 0.30 and pitch < (cp - DELTA_PITCH_HAUT)

    elif angle_id == "bas":
        # pitch AUGMENTE quand on regarde en bas (nez s'éloigne des yeux en image)
        if pitch is None:
            result = abs(dw) < 0.30
        else:
            cp = calib_pitch if calib_pitch is not None else 0.70
            result = abs(dw) < 0.30 and pitch > (cp + DELTA_PITCH_BAS)

    else:
        result = True

    cp_log = calib_pitch if calib_pitch is not None else 0.70
    logger.info(
        f"[pose] angle={angle_id} yaw={yaw:.3f} pitch={p:.3f} "
        f"calib_p={cp_log:.3f} Δyaw={dw:.3f} "
        f"thresh_haut<{cp_log - DELTA_PITCH_HAUT:.3f} thresh_bas>{cp_log + DELTA_PITCH_BAS:.3f} → ok={result}"
    )
    return result


# ── Route creation etudiant ───────────────────────────────────────────────────
@router.post("/students")
def create_student(req: StudentCreate, db: Session = Depends(get_db)):
    existing = db.query(Student).filter(Student.email == req.email).first()
    if existing:
        raise HTTPException(400, "Cet email est deja utilise.")

    student = Student(
        nom=req.nom,
        prenom=req.prenom,
        email=req.email,
        classe=req.classe,
        annee_scolaire=req.annee_scolaire,
        is_enrolled=False,
    )
    db.add(student)
    db.commit()
    db.refresh(student)

    logger.info(f"Etudiant cree: {req.prenom} {req.nom} (id={student.id})")
    return {
        "id":         str(student.id),
        "student_id": str(student.id),
        "message":    f"Etudiant {req.prenom} {req.nom} cree.",
    }


# ── Demarrage session ─────────────────────────────────────────────────────────
@router.post("/start")
def start_enrollment(req: StartRequest, db: Session = Depends(get_db)):
    student = crud.get_student_by_id(db, req.student_id)
    if not student:
        raise HTTPException(404, "Etudiant introuvable.")

    session_id = str(uuid.uuid4())
    _sessions[session_id] = {
        "student_id":         req.student_id,
        "started_at":         time.time(),
        "frames_by_angle":    {},
        "frames_received":    0,
        "last_bbox_by_angle": {},
        "calib_pitches":      [],   # pitch des captures face → calibration relative
        "calib_yaws":         [],
        "calibrated_pitch":   None,
        "calibrated_yaw":     None,
    }

    logger.info(f"Enrolement demarre: session={session_id} etudiant={req.student_id}")
    return {
        "session_id":          session_id,
        "duration_seconds":    30,
        "capture_interval_ms": 1200,
        "instruction":         "Bougez lentement la tete : gauche, droite, haut, bas.",
    }


# ── Capture frame ─────────────────────────────────────────────────────────────
@router.post("/capture")
def capture_frame(req: CaptureRequest):
    session = _sessions.get(req.session_id)
    if not session:
        raise HTTPException(404, "Session introuvable.")

    session["frames_received"] += 1
    angle_id = req.angle or "face"

    # Decode image
    try:
        img_bytes = base64.b64decode(req.image_b64)
        arr   = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if frame is None:
            return {"ok": False, "reason": "Image invalide",
                    "stored": _count_stored(session)}
    except Exception:
        return {"ok": False, "reason": "Erreur decodage",
                "stored": _count_stored(session)}

    # Detection visage
    detector = get_detector()
    face = detector.detect_largest(frame)
    if face is None:
        return {
            "ok":     False,
            "reason": "Visage non detecte - centrez votre visage",
            "stored": _count_stored(session),
        }

    crop  = face["crop"]
    score = _quality_score(crop)

    # ── Validation de pose ────────────────────────────────────────────────────
    kps  = face.get("kps")
    bbox = face["bbox"]
    yaw, pitch = _estimate_pose(kps, bbox)

    # Mise a jour calibration (accumule les mesures de l'angle frontal)
    if angle_id == "face" and yaw is not None and pitch is not None:
        session["calib_pitches"].append(pitch)
        session["calib_yaws"].append(yaw)
        session["calibrated_pitch"] = float(np.mean(session["calib_pitches"]))
        session["calibrated_yaw"]   = float(np.mean(session["calib_yaws"]))

    pose_ok = _pose_matches_angle(
        yaw, pitch, angle_id,
        calib_pitch=session.get("calibrated_pitch"),
        calib_yaw  =session.get("calibrated_yaw"),
    )

    if not pose_ok:
        hint = _ANGLE_HINT.get(angle_id, "Ajustez votre angle")
        return {
            "ok":          False,
            "pose_ok":     False,
            "reason":      hint,
            "stored":      _count_stored(session),
            "yaw":         yaw,
            "pitch":       pitch,
            "calib_pitch": session.get("calibrated_pitch"),
        }

    # ── Indicateurs qualite ───────────────────────────────────────────────────
    gray           = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    sharp_raw      = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    bright_raw     = float(gray.mean())
    sharpness_pct  = min(sharp_raw / 200.0 * 100, 100)
    if 80 <= bright_raw <= 190:
        brightness_pct = 100.0
    elif bright_raw < 80:
        brightness_pct = bright_raw / 80.0 * 100
    else:
        brightness_pct = (255 - bright_raw) / 65.0 * 100
    brightness_pct = max(0, min(100, brightness_pct))

    # ── Verificiation qualite minimale ────────────────────────────────────────
    if score < MIN_QUALITY_SCORE:
        return {
            "ok":             False,
            "reason":         "Image floue ou mauvais éclairage — ajustez l'éclairage",
            "stored":         _count_stored(session),
            "sharpness_pct":  round(sharpness_pct, 1),
            "brightness_pct": round(brightness_pct, 1),
            "stability_pct":  100.0,
        }

    # ── Verification stabilite (mouvement entre frames du meme angle) ─────────
    last_bbox = session["last_bbox_by_angle"].get(angle_id)
    if last_bbox is not None:
        cx_prev = (last_bbox[0] + last_bbox[2]) / 2.0
        cy_prev = (last_bbox[1] + last_bbox[3]) / 2.0
        cx_curr = (bbox[0] + bbox[2]) / 2.0
        cy_curr = (bbox[1] + bbox[3]) / 2.0
        face_size = max(bbox[2] - bbox[0], bbox[3] - bbox[1])
        move_ratio = ((cx_curr - cx_prev) ** 2 + (cy_curr - cy_prev) ** 2) ** 0.5 / max(face_size, 1)
        stability_pct = max(0.0, min(100.0, (1.0 - move_ratio / MAX_MOVE_RATIO) * 100))
    else:
        move_ratio    = 0.0
        stability_pct = 100.0

    session["last_bbox_by_angle"][angle_id] = bbox

    if move_ratio > MAX_MOVE_RATIO:
        return {
            "ok":             False,
            "reason":         "Stabilisez votre tête et attendez un instant",
            "stored":         _count_stored(session),
            "sharpness_pct":  round(sharpness_pct, 1),
            "brightness_pct": round(brightness_pct, 1),
            "stability_pct":  round(stability_pct, 1),
        }

    # ── Crop avec contexte pour l'encodage ArcFace ────────────────────────────
    x1, y1, x2, y2 = bbox
    h_img, w_img = frame.shape[:2]
    fw, fh = x2 - x1, y2 - y1
    pad_x = max(int(fw * 0.50), 30)
    pad_y = max(int(fh * 0.50), 30)
    crop_x0 = max(0, x1 - pad_x)
    crop_y0 = max(0, y1 - pad_y)
    enc_crop = frame[
        crop_y0 : min(h_img, y2 + pad_y),
        crop_x0 : min(w_img, x2 + pad_x),
    ].copy()

    # Keypoints traduits dans les coordonnées du crop (pour norm_crop lors du finalize)
    kps_in_crop = None
    if kps is not None:
        kps_in_crop = [[float(p[0]) - crop_x0, float(p[1]) - crop_y0] for p in kps]

    # Stockage par angle - garde les BEST_PER_ANGLE meilleures
    angle_frames = session["frames_by_angle"].setdefault(angle_id, [])
    angle_frames.append({"crop": enc_crop, "score": score, "kps": kps_in_crop})
    angle_frames.sort(key=lambda x: x["score"], reverse=True)
    session["frames_by_angle"][angle_id] = angle_frames[:BEST_PER_ANGLE]

    stored      = _count_stored(session)
    angles_done = len(session["frames_by_angle"])

    return {
        "ok":             True,
        "pose_ok":        True,
        "quality_score":  score,
        "stored":         stored,
        "angles_done":    angles_done,
        "reason":         "Bonne position ✓",
        "sharpness_pct":  round(sharpness_pct,  1),
        "brightness_pct": round(brightness_pct, 1),
        "stability_pct":  round(stability_pct,  1),
        "bbox":           face["bbox"],
        "yaw":            yaw,
        "pitch":          pitch,
    }


def _count_stored(session: dict) -> int:
    return sum(len(v) for v in session["frames_by_angle"].values())


# ── Finalisation ──────────────────────────────────────────────────────────────
@router.post("/finalize")
def finalize_enrollment(req: FinalizeRequest, db: Session = Depends(get_db)):
    session = _sessions.get(req.session_id)
    if not session:
        raise HTTPException(404, "Session introuvable.")

    frames_by_angle = session["frames_by_angle"]

    if len(frames_by_angle) < MIN_FRAMES_TO_ENCODE:
        raise HTTPException(
            400,
            f"Pas assez d'angles captures ({len(frames_by_angle)}/{MIN_FRAMES_TO_ENCODE}). "
            "Recommencez avec une meilleure lumiere."
        )

    # Pipeline unifié : même get_face_app().get() → .normed_embedding que la reconnaissance
    from ai.detector import get_face_app
    face_app   = get_face_app()

    embeddings = []
    weights    = []
    student_id = session["student_id"]

    # ── Etape 1 : encoder la MEILLEURE image de chaque angle ─────────────────
    for angle_id, frames in frames_by_angle.items():
        if not frames:
            continue
        best = frames[0]
        try:
            crop_rgb = cv2.cvtColor(best["crop"], cv2.COLOR_BGR2RGB)
            detected = face_app.get(crop_rgb)
            if not detected:
                print(f"[ENROLL] ⚠️ angle={angle_id} aucun visage dans le crop — ignoré")
                continue
            face  = max(detected, key=lambda f: f.det_score)
            emb   = face.normed_embedding.astype(np.float32)
            print(f"[ENROLL] ✅ angle={angle_id} normed_embedding OK  score={best['score']:.3f}  det={face.det_score:.3f}")
            embeddings.append(emb)
            weights.append(best["score"])
        except Exception as e:
            logger.warning(f"[embed] echec angle={angle_id}: {e}")
            print(f"[ENROLL] ❌ angle={angle_id} erreur: {e}")

    if len(embeddings) < MIN_FRAMES_TO_ENCODE:
        raise HTTPException(400, "Trop peu de frames encodees. Verifiez l'eclairage.")

    coherence = _coherence_score(embeddings)

    if coherence >= CONFIDENCE_GOOD:
        confidence_label = "excellent"
        warning = None
    elif coherence >= CONFIDENCE_MEDIUM:
        confidence_label = "acceptable"
        warning = None
    else:
        confidence_label = "faible"
        warning = f"Qualite faible (coherence={coherence:.2f}). Re-enrolement recommande."

    # ── Etape 2 : sauvegarde UN embedding PAR ANGLE (pas de moyenne) ─────────
    # Stocker chaque angle séparément permet au moteur de reconnaissance
    # de choisir le meilleur match selon l'orientation actuelle du visage,
    # et réduit fortement les faux positifs entre membres d'une même famille.
    crud.delete_student_face(db, student_id)
    crud.delete_student_images_db(db, student_id)
    for emb, w in zip(embeddings, weights):
        crud.create_student_face(
            db,
            student_id = student_id,
            embedding  = emb.tolist() if hasattr(emb, "tolist") else list(emb),
            det_score  = float(w),
            nb_images  = 1,
        )

    student = crud.get_student_by_id(db, student_id)
    if student:
        student.is_enrolled = True
        db.commit()

    student_code = str(student.id).replace('-', '')[:8].upper()

    # ── Etape 3 : upload des 5 images de chaque angle en parallele ────────────
    # Preparer la liste complete : (angle_id, rank, crop, is_best)
    upload_tasks = []
    for angle_id, frames in frames_by_angle.items():
        for rank, frame_data in enumerate(frames):    # rank 0 = meilleure
            is_best = (rank == 0)
            upload_tasks.append((angle_id, rank + 1, frame_data["crop"], is_best))

    def _do_upload(task):
        angle_id, rank, crop, is_best = task
        try:
            _, buf = cv2.imencode(".jpg", crop, [cv2.IMWRITE_JPEG_QUALITY, 92])
            path   = f"enrollment/{student_id}/{angle_id}_{rank}"
            url    = upload_image(buf.tobytes(), path=path)
            return (angle_id, rank, url, is_best) if url else None
        except Exception as e:
            logger.warning(f"[upload] echec {angle_id}_{rank}: {e}")
            return None

    uploaded = 0
    with ThreadPoolExecutor(max_workers=5) as pool:
        for result in pool.map(_do_upload, upload_tasks):
            if result:
                angle_id, rank, url, is_best = result
                # is_primary = meilleure image de l'angle face (photo de profil)
                crud.create_student_image(
                    db,
                    student_id = student_id,
                    url        = url,
                    angle      = f"{angle_id}_{rank}",
                    is_primary = (is_best and angle_id == "face"),
                )
                uploaded += 1

    del _sessions[req.session_id]

    # ── Etape 4 : réactiver le compte si désactivé ────────────────────────────
    if student:
        from db.models import User as UserModel
        existing_user = db.query(UserModel).filter(
            UserModel.student_id == student.id
        ).first()
        if not existing_user:
            existing_user = db.query(UserModel).filter(
                UserModel.email == student.email
            ).first()
        if existing_user and not existing_user.is_active:
            existing_user.is_active   = True
            existing_user.student_id  = student.id
            db.commit()
            logger.info(f"[finalize] compte réactivé pour {student.email}")

    logger.info(
        f"[finalize] etudiant={student_id} angles={len(embeddings)} "
        f"images={uploaded} coherence={coherence:.3f} code={student_code}"
    )
    return {
        "success":         True,
        "student_id":      student_id,
        "student_code":    student_code,
        "angles_used":     len(embeddings),
        "images_stored":   uploaded,
        "coherence_score": coherence,
        "confidence":      confidence_label,
        "warning":         warning,
        "message":         f"Enrolement termine ! {uploaded} images stockees. Qualite : {confidence_label}.",
    }


# ── Status ────────────────────────────────────────────────────────────────────
@router.get("/status/{session_id}")
def get_status(session_id: str):
    session = _sessions.get(session_id)
    if not session:
        raise HTTPException(404, "Session introuvable.")
    frames_by_angle = session["frames_by_angle"]
    all_frames = [f for frames in frames_by_angle.values() for f in frames]
    avg_q = round(float(np.mean([f["score"] for f in all_frames])), 3) if all_frames else 0
    return {
        "session_id":      session_id,
        "student_id":      session["student_id"],
        "frames_stored":   len(all_frames),
        "frames_received": session["frames_received"],
        "avg_quality":     avg_q,
        "angles_done":     list(frames_by_angle.keys()),
        "ready":           len(frames_by_angle) >= MIN_FRAMES_TO_ENCODE,
    }


# ── Annulation ────────────────────────────────────────────────────────────────
@router.delete("/cancel/{session_id}")
def cancel(session_id: str):
    if session_id in _sessions:
        del _sessions[session_id]
        return {"message": "Session annulee."}
    raise HTTPException(404, "Session introuvable.")
