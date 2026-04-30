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

# ── Paramètres ────────────────────────────────────────────────────────────────
CAPTURES_PER_ANGLE  = 5      # 5 captures par angle
MIN_DET_SCORE       = 0.65
MIN_SHARPNESS       = 80.0
MIN_BRIGHTNESS      = 60.0
MAX_BRIGHTNESS      = 200.0
STABILITY_THRESHOLD = 0.92   # similarité min entre 2 frames consécutives → stable

# ── 7 Angles guidés ───────────────────────────────────────────────────────────
GUIDED_ANGLES = [
    {"id": 0, "yaw": (-10,  10), "pitch": ( -8,   8), "label": "face",            "instruction": "Regardez droit devant"},
    {"id": 1, "yaw": ( 20,  45), "pitch": ( -8,   8), "label": "droite",          "instruction": "Tournez a droite"},
    {"id": 2, "yaw": (-45, -20), "pitch": ( -8,   8), "label": "gauche",          "instruction": "Tournez a gauche"},
    {"id": 3, "yaw": (-10,  10), "pitch": ( 12,  30), "label": "haut",            "instruction": "Levez la tete"},
    {"id": 4, "yaw": (-10,  10), "pitch": (-30, -12), "label": "bas",             "instruction": "Baissez la tete"},
    {"id": 5, "yaw": ( 12,  25), "pitch": ( -8,   8), "label": "diagonal_droite", "instruction": "Tournez legerement a droite"},
    {"id": 6, "yaw": (-25, -12), "pitch": ( -8,   8), "label": "diagonal_gauche", "instruction": "Tournez legerement a gauche"},
]

TOTAL_CAPTURES = len(GUIDED_ANGLES) * CAPTURES_PER_ANGLE  # 35


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


def get_current_angle(records: list) -> dict | None:
    """
    Retourne l'angle en cours (pas encore complété à 5 captures).
    Logique : on remplit angle par angle dans l'ordre.
    """
    # Compter les captures par angle
    counts = {a["id"]: 0 for a in GUIDED_ANGLES}
    for r in records:
        angle_id = extract_angle_id(r)
        if angle_id in counts:
            counts[angle_id] += 1

    # Trouver le premier angle non complété
    for angle in GUIDED_ANGLES:
        if counts[angle["id"]] < CAPTURES_PER_ANGLE:
            return angle, counts[angle["id"]]
    return None, 0


def extract_angle_id(record) -> int:
    """Extrait l'angle_id depuis quality_score."""
    try:
        return round((record.quality_score % 1) * 10)
    except Exception:
        return -1


def check_quality_strict(img: np.ndarray) -> tuple[bool, str]:
    """Vérification qualité stricte avant stockage."""
    gray       = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    sharpness  = cv2.Laplacian(gray, cv2.CV_64F).var()
    brightness = float(np.mean(gray))

    if sharpness < MIN_SHARPNESS:
        return False, "Image floue — restez immobile"
    if brightness < MIN_BRIGHTNESS:
        return False, "Trop sombre — eclairez votre visage"
    if brightness > MAX_BRIGHTNESS:
        return False, "Trop lumineux — evitez la lumiere directe"
    return True, "ok"


def check_stability(embedding: np.ndarray, records: list,
                    current_angle_id: int) -> tuple[bool, str]:
    """
    Vérifie la stabilité : le visage ne doit pas trop bouger
    entre 2 captures du même angle.
    Similarité trop BASSE = visage instable (a bougé).
    """
    # Récupérer les embeddings du même angle
    same_angle = [
        r for r in records
        if extract_angle_id(r) == current_angle_id
    ]
    if not same_angle:
        return True, "ok"  # première capture de cet angle → OK

    # Comparer avec la dernière capture du même angle
    last_record = same_angle[-1]
    last_emb    = np.array(last_record.embedding, dtype=np.float32)
    norm        = np.linalg.norm(last_emb)
    if norm > 0:
        last_emb /= norm

    similarity = compute_similarity(embedding, last_emb)

    # Trop similaire = pas de mouvement entre captures → bon
    # Trop différent = visage instable → rejeter
    if similarity < 0.60:
        return False, "Restez stable — ne bougez pas trop"

    return True, "ok"


# ── Routes ────────────────────────────────────────────────────────────────────

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
        "student_id":        str(student.id),
        "message":           "Etudiant cree",
        "total_captures":    TOTAL_CAPTURES,
        "captures_per_angle": CAPTURES_PER_ANGLE,
        "total_angles":      len(GUIDED_ANGLES),
        "next_angle":        first_angle["instruction"],
        "next_angle_id":     first_angle["id"],
        "next_angle_label":  first_angle["label"],
    }


@router.post("/enroll/capture")
async def capture_frame(
    student_id: str = Form(...),
    image: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Capturer une frame pour un angle précis.
    Pipeline :
    1. Détecter visage
    2. Vérifier qualité de base
    3. Vérifier qualité stricte
    4. Vérifier angle correct
    5. Vérifier det_score
    6. Vérifier stabilité
    7. Encoder
    8. Upload Cloudinary
    9. Sauvegarder embedding + image
    """
    contents = await image.read()
    nparr    = np.frombuffer(contents, np.uint8)

    img_hq = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img_hq is None:
        raise HTTPException(status_code=400, detail="Image invalide")

    img_hq = cv2.resize(img_hq, (640, 480), interpolation=cv2.INTER_LANCZOS4)
    img_ai = cv2.resize(img_hq, (320, 240), interpolation=cv2.INTER_AREA)

    records                       = get_temp_embeddings(db, student_id)
    total_captured                = len(records)
    current_angle, angle_captures = get_current_angle(records)

    if current_angle is None:
        return {
            "accepted":          False,
            "reason":            "Tous les angles sont complets",
            "total_captured":    total_captured,
            "ready_to_finalize": True
        }

    # ── Étape 1 : Détection visage ────────────────────────────────────────────
    faces   = face_app.get(img_ai)
    quality = verify_quality(img_ai, faces)
    if not quality["ok"]:
        return _reject(quality["reason"], total_captured,
                       current_angle, angle_captures)

    # ── Étape 2 : Qualité stricte ─────────────────────────────────────────────
    ok, reason = check_quality_strict(img_hq)
    if not ok:
        return _reject(reason, total_captured, current_angle, angle_captures)

    # ── Étape 3 : Angle correct ───────────────────────────────────────────────
    face        = max(faces, key=lambda f: f.det_score)
    detected_id = detect_angle(face)

    if detected_id is None or detected_id != current_angle["id"]:
        return _reject(
            current_angle["instruction"],
            total_captured, current_angle, angle_captures
        )

    # ── Étape 4 : det_score ───────────────────────────────────────────────────
    det_score = float(face.det_score)
    if det_score < MIN_DET_SCORE:
        return _reject("Rapprochez-vous de la camera",
                       total_captured, current_angle, angle_captures)

    # ── Étape 5 : Encodage ────────────────────────────────────────────────────
    embedding, _ = encode_face(img_ai)
    if embedding is None:
        return _reject("Encodage echoue", total_captured,
                       current_angle, angle_captures)

    # ── Étape 6 : Stabilité ───────────────────────────────────────────────────
    stable, reason = check_stability(embedding, records, current_angle["id"])
    if not stable:
        return _reject(reason, total_captured, current_angle, angle_captures)

    # ── Étape 7 : Upload Cloudinary ───────────────────────────────────────────
    capture_n  = angle_captures + 1
    image_path = f"students/{student_id}/{current_angle['label']}/capture_{capture_n}"
    _, buffer  = cv2.imencode(".jpg", img_hq, [cv2.IMWRITE_JPEG_QUALITY, 95])
    image_url  = upload_image(buffer.tobytes(), image_path)

    # ── Étape 8 : Sauvegarder image ───────────────────────────────────────────
    is_primary = (current_angle["id"] == 0 and capture_n == 1)
    create_student_image(
        db,
        student_id = student_id,
        url        = image_url,
        angle      = f"{current_angle['label']}_{capture_n}",
        is_primary = is_primary,
    )

    # ── Étape 9 : Sauvegarder embedding ──────────────────────────────────────
    quality_score = round(det_score + current_angle["id"] / 10, 4)
    create_temp_embedding(db, student_id=student_id, embedding=embedding,
                          det_score=det_score, quality_score=quality_score)

    # Calculer prochain état
    new_total         = total_captured + 1
    new_angle_captures = angle_captures + 1
    next_angle, next_captures = get_current_angle(
        get_temp_embeddings(db, student_id)
    )

    return {
        "accepted":           True,
        "total_captured":     new_total,
        "total_needed":       TOTAL_CAPTURES,
        "progress":           round(new_total / TOTAL_CAPTURES * 100),
        "ready_to_finalize":  new_total >= TOTAL_CAPTURES,
        "current_angle": {
            "id":       current_angle["id"],
            "label":    current_angle["label"],
            "captures": new_angle_captures,
            "needed":   CAPTURES_PER_ANGLE,
            "done":     new_angle_captures >= CAPTURES_PER_ANGLE,
        },
        "next_angle": {
            "id":          next_angle["id"] if next_angle else -1,
            "label":       next_angle["label"] if next_angle else None,
            "instruction": next_angle["instruction"] if next_angle else "Enrolement termine !",
            "captures":    next_captures if next_angle else 0,
        },
        "image_url": image_url,
    }


@router.post("/enroll/finalize")
async def finalize_enrollment(
    student_id: str = Form(...),
    db: Session = Depends(get_db)
):
    """
    Finaliser l'enrôlement :
    - Moyenne pondérée de tous les embeddings (35 au total)
    - Embedding final ultra-robuste stocké dans StudentFace
    - Nettoyage StudentFaceTemp
    """
    records = get_temp_embeddings(db, student_id)

    if len(records) < 10:
        raise HTTPException(
            status_code=400,
            detail=f"Pas assez de captures ({len(records)}/{TOTAL_CAPTURES})"
        )

    records.sort(key=lambda r: r.det_score, reverse=True)

    embeddings = [np.array(r.embedding, dtype=np.float32) for r in records]
    weights    = np.array([r.det_score for r in records])
    weights   /= weights.sum()

    final = np.average(embeddings, axis=0, weights=weights)
    norm  = np.linalg.norm(final)
    if norm > 0:
        final /= norm

    create_student_face(
        db,
        student_id = student_id,
        embedding  = final,
        det_score  = float(np.mean([r.det_score for r in records])),
        nb_images  = len(records),
    )

    update_enrolled(db, student_id)
    delete_temp_embeddings(db, student_id)

    return {
        "success":      True,
        "message":      "Enrolement termine avec succes",
        "total_frames": len(records),
        "angles_used":  len(GUIDED_ANGLES),
    }


@router.get("/enroll/{student_id}/progress")
async def get_enrollment_progress(
    student_id: str,
    db: Session = Depends(get_db)
):
    """Retourne la progression de l'enrôlement."""
    records        = get_temp_embeddings(db, student_id)
    total_captured = len(records)

    counts = {a["id"]: 0 for a in GUIDED_ANGLES}
    for r in records:
        angle_id = extract_angle_id(r)
        if angle_id in counts:
            counts[angle_id] += 1

    angles_status = []
    for angle in GUIDED_ANGLES:
        captured = counts[angle["id"]]
        angles_status.append({
            "id":       angle["id"],
            "label":    angle["label"],
            "captured": captured,
            "needed":   CAPTURES_PER_ANGLE,
            "done":     captured >= CAPTURES_PER_ANGLE,
        })

    current_angle, angle_captures = get_current_angle(records)

    return {
        "total_captured":    total_captured,
        "total_needed":      TOTAL_CAPTURES,
        "progress":          round(total_captured / TOTAL_CAPTURES * 100),
        "angles_status":     angles_status,
        "current_angle":     current_angle["label"] if current_angle else None,
        "ready_to_finalize": total_captured >= TOTAL_CAPTURES,
    }


def _reject(reason: str, total: int, angle: dict, captures: int) -> dict:
    """Helper — réponse de rejet."""
    return {
        "accepted":       False,
        "reason":         reason,
        "total_captured": total,
        "current_angle": {
            "id":          angle["id"],
            "label":       angle["label"],
            "instruction": angle["instruction"],
            "captures":    captures,
            "needed":      CAPTURES_PER_ANGLE,
        }
    }