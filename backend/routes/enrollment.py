from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from fastapi import Depends
from db.models import StudentFaceTemp
from db.crud import (
    create_student, get_student_by_email,
    create_temp_embedding, get_temp_embeddings,
    create_student_face, delete_temp_embeddings, update_enrolled,
    create_student_image, delete_student_images,
)
from ai.quality import verify_quality
from ai.encoder import encode_face, compute_similarity
from ai.detector import face_app
from ai.storage import upload_image
from config import SessionLocal
import numpy as np
import cv2

router = APIRouter()

TARGET_FRAMES       = 5
MIN_DET_SCORE       = 0.65
MIN_SHARPNESS       = 80.0
MIN_BRIGHTNESS      = 60.0
MAX_BRIGHTNESS      = 200.0

# ── 5 Angles guidés ──────────────────────────────────────────────────────────
GUIDED_ANGLES = [
    {"id": 0, "yaw": (-10,  10), "pitch": (-10, 10), "label": "centre",  "instruction": "Regardez droit devant"},
    {"id": 1, "yaw": ( 15,  40), "pitch": (-10, 10), "label": "droite",  "instruction": "Tournez a droite"},
    {"id": 2, "yaw": (-40, -15), "pitch": (-10, 10), "label": "gauche",  "instruction": "Tournez a gauche"},
    {"id": 3, "yaw": (-15,  15), "pitch": ( 10, 30), "label": "haut",    "instruction": "Levez la tete"},
    {"id": 4, "yaw": (-15,  15), "pitch": (-30,-10), "label": "bas",     "instruction": "Baissez la tete"},
]


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def detect_angle(face) -> int | None:
    """Retourne l'id de l'angle détecté ou None."""
    try:
        yaw   = float(face.pose[0])
        pitch = float(face.pose[1])
        for angle in GUIDED_ANGLES:
            if (angle["yaw"][0] <= yaw <= angle["yaw"][1] and
                    angle["pitch"][0] <= pitch <= angle["pitch"][1]):
                return angle["id"]
        return None
    except Exception:
        return None


def get_next_angle(used_ids: list[int]) -> dict | None:
    """Retourne le prochain angle à capturer."""
    for angle in GUIDED_ANGLES:
        if angle["id"] not in used_ids:
            return angle
    return None


def check_quality_strict(img: np.ndarray) -> tuple[bool, str]:
    """Vérification qualité stricte avant stockage."""
    gray       = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    sharpness  = cv2.Laplacian(gray, cv2.CV_64F).var()
    brightness = float(np.mean(gray))

    if sharpness < MIN_SHARPNESS:
        return False, f"Restez immobile — image floue"
    if brightness < MIN_BRIGHTNESS:
        return False, "Eclairez votre visage"
    if brightness > MAX_BRIGHTNESS:
        return False, "Evitez la lumiere directe"
    return True, "ok"


def extract_angle_id(record) -> int:
    """Extrait l'angle_id depuis quality_score."""
    try:
        return round((record.quality_score % 1) * 10)
    except Exception:
        return -1


# ── Routes ───────────────────────────────────────────────────────────────────

@router.post("/enroll")
async def enroll_student(
    nom: str = Form(...),
    prenom: str = Form(...),
    email: str = Form(...),
    classe: str = Form(...),
    annee_scolaire: str = Form(...),
    db: Session = Depends(get_db)
):
    """Créer un nouvel étudiant."""
    existing = get_student_by_email(db, email)
    if existing:
        raise HTTPException(status_code=400, detail="Email deja utilise")

    student = create_student(db, nom=nom, prenom=prenom, email=email,
                             classe=classe, annee_scolaire=annee_scolaire)

    first_angle = GUIDED_ANGLES[0]
    return {
        "student_id": str(student.id),
        "message": "Etudiant cree",
        "target_frames": TARGET_FRAMES,
        "next_angle": first_angle["instruction"],
        "next_angle_id": first_angle["id"],
    }


@router.post("/enroll/capture")
async def capture_frame(
    student_id: str = Form(...),
    image: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Capturer une frame :
    1. Vérifier qualité
    2. Vérifier angle attendu
    3. Encoder
    4. Uploader image HQ vers Cloudinary → StudentImage
    5. Sauvegarder embedding → StudentFaceTemp
    """
    contents = await image.read()
    nparr    = np.frombuffer(contents, np.uint8)

    # Image HQ pour stockage Cloudinary
    img_hq = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img_hq is None:
        raise HTTPException(status_code=400, detail="Image invalide")

    img_hq = cv2.resize(img_hq, (640, 480), interpolation=cv2.INTER_LANCZOS4)
    img_ai = cv2.resize(img_hq, (320, 240), interpolation=cv2.INTER_AREA)

    current_count = _count_temp(db, student_id)
    records       = get_temp_embeddings(db, student_id)
    used_ids      = list({extract_angle_id(r) for r in records})
    next_angle    = get_next_angle(used_ids)

    if next_angle is None:
        return {
            "accepted": False,
            "reason": "Tous les angles sont captures",
            "frames_captured": current_count,
            "ready_to_finalize": True
        }

    # ── Étape 1 : Détection visage ────────────────────────────────────────────
    faces = face_app.get(img_ai)
    quality = verify_quality(img_ai, faces)
    if not quality["ok"]:
        return {
            "accepted": False,
            "reason": quality["reason"],
            "frames_captured": current_count,
            "next_angle": next_angle["instruction"],
            "next_angle_id": next_angle["id"],
        }

    # ── Étape 2 : Qualité stricte ─────────────────────────────────────────────
    ok, reason = check_quality_strict(img_hq)
    if not ok:
        return {
            "accepted": False,
            "reason": reason,
            "frames_captured": current_count,
            "next_angle": next_angle["instruction"],
            "next_angle_id": next_angle["id"],
        }

    # ── Étape 3 : Vérifier angle détecté ─────────────────────────────────────
    face        = max(faces, key=lambda f: f.det_score)
    detected_id = detect_angle(face)

    if detected_id is None or detected_id != next_angle["id"]:
        return {
            "accepted": False,
            "reason": next_angle["instruction"],
            "frames_captured": current_count,
            "next_angle": next_angle["instruction"],
            "next_angle_id": next_angle["id"],
        }

    # ── Étape 4 : det_score suffisant ────────────────────────────────────────
    det_score = float(face.det_score)
    if det_score < MIN_DET_SCORE:
        return {
            "accepted": False,
            "reason": "Rapprochez-vous de la camera",
            "frames_captured": current_count,
            "next_angle": next_angle["instruction"],
            "next_angle_id": next_angle["id"],
        }

    # ── Étape 5 : Encodage ────────────────────────────────────────────────────
    embedding, _ = encode_face(img_ai)
    if embedding is None:
        return {
            "accepted": False,
            "reason": "Encodage echoue",
            "frames_captured": current_count,
            "next_angle": next_angle["instruction"],
            "next_angle_id": next_angle["id"],
        }

    quality_score = round(det_score + next_angle["id"] / 10, 4)

    # ── Étape 6 : Upload image HQ vers Cloudinary ─────────────────────────────
    angle_label = next_angle["label"]
    image_path  = f"students/{student_id}/frame_{angle_label}"
    _, buffer   = cv2.imencode(".jpg", img_hq, [cv2.IMWRITE_JPEG_QUALITY, 95])
    image_url   = upload_image(buffer.tobytes(), image_path)

    # ── Étape 7 : Sauvegarder image dans StudentImage ────────────────────────
    is_primary = (next_angle["id"] == 0)  # centre = photo principale
    create_student_image(
        db,
        student_id = student_id,
        url        = image_url,
        angle      = angle_label,
        is_primary = is_primary,
    )

    # ── Étape 8 : Sauvegarder embedding temporaire ────────────────────────────
    create_temp_embedding(
        db,
        student_id    = student_id,
        embedding     = embedding,
        det_score     = det_score,
        quality_score = quality_score,
    )

    frames_captured = _count_temp(db, student_id)
    remaining_angle = get_next_angle(used_ids + [detected_id])

    return {
        "accepted": True,
        "frames_captured": frames_captured,
        "target_frames": TARGET_FRAMES,
        "progress": round(frames_captured / TARGET_FRAMES * 100),
        "ready_to_finalize": frames_captured >= TARGET_FRAMES,
        "angle_captured": angle_label,
        "image_url": image_url,
        "next_angle": remaining_angle["instruction"] if remaining_angle else "Parfait !",
        "next_angle_id": remaining_angle["id"] if remaining_angle else -1,
    }


@router.post("/enroll/finalize")
async def finalize_enrollment(
    student_id: str = Form(...),
    db: Session = Depends(get_db)
):
    """
    Finaliser l'enrôlement :
    1. Moyenne pondérée des embeddings temporaires
    2. Stocker embedding final dans StudentFace
    3. Marquer is_enrolled = True
    4. Supprimer StudentFaceTemp
    """
    records = get_temp_embeddings(db, student_id)

    if len(records) < 3:
        raise HTTPException(
            status_code=400,
            detail=f"Pas assez de frames ({len(records)}/3 minimum)"
        )

    records.sort(key=lambda r: r.det_score, reverse=True)
    top = records[:TARGET_FRAMES]

    embeddings = [np.array(r.embedding, dtype=np.float32) for r in top]
    weights    = np.array([r.det_score for r in top])
    weights   /= weights.sum()

    final = np.average(embeddings, axis=0, weights=weights)
    norm  = np.linalg.norm(final)
    if norm > 0:
        final /= norm

    # Sauvegarder embedding final
    create_student_face(
        db,
        student_id = student_id,
        embedding  = final,
        det_score  = float(np.mean([r.det_score for r in top])),
        nb_images  = len(top),
    )

    update_enrolled(db, student_id)
    delete_temp_embeddings(db, student_id)

    return {
        "success": True,
        "message": "Enrolement termine avec succes",
        "frames_used": len(top),
    }


def _count_temp(db: Session, student_id: str) -> int:
    return db.query(StudentFaceTemp).filter(
        StudentFaceTemp.student_id == student_id).count()