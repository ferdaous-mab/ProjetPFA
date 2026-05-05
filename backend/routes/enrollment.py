from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from fastapi import Depends
from db.models import StudentFaceTemp
from db.crud import (
    create_student, get_student_by_email,
    create_temp_embedding, get_temp_embeddings,
    create_student_face, delete_temp_embeddings, update_enrolled,
    create_student_image, delete_student_images_db,
)
from ai.quality import verify_quality
from ai.encoder import encode_face, compute_similarity
from ai.detector import face_app
from ai.pose_estimator import (
    estimate_pose, detect_angle_id, get_angle_by_id, GUIDED_ANGLES
)
from ai.storage import upload_image
from config import SessionLocal
import numpy as np
import cv2

router = APIRouter()

CAPTURES_PER_ANGLE = 5
MIN_DET_SCORE      = 0.40
TOTAL_CAPTURES     = len(GUIDED_ANGLES) * CAPTURES_PER_ANGLE  # 35


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def extract_angle_id(record) -> int:
    """Angle encodé : quality_score = angle_id * 10 + det_score"""
    try:
        return int(record.quality_score) // 10
    except Exception:
        return -1


def get_current_angle(records: list):
    """Retourne l'angle en cours et son nombre de captures."""
    counts = {a["id"]: 0 for a in GUIDED_ANGLES}
    for r in records:
        aid = extract_angle_id(r)
        if aid in counts:
            counts[aid] += 1
    for angle in GUIDED_ANGLES:
        if counts[angle["id"]] < CAPTURES_PER_ANGLE:
            return angle, counts[angle["id"]]
    return None, 0


def crop_face(img: np.ndarray, face) -> np.ndarray | None:
    """Crop le visage avec marge."""
    try:
        x1, y1, x2, y2 = [int(v) for v in face.bbox]
        h, w    = img.shape[:2]
        margin  = int((x2 - x1) * 0.2)
        x1 = max(0, x1 - margin); y1 = max(0, y1 - margin)
        x2 = min(w, x2 + margin); y2 = min(h, y2 + margin)
        crop = img[y1:y2, x1:x2]
        if crop.size == 0:
            return None
        return cv2.resize(crop, (112, 112))
    except Exception:
        return None


def augment_for_classroom(img_112: np.ndarray) -> list[np.ndarray]:
    """
    Génère des variations pour simuler les conditions de salle de classe :
    - Flou (caméra loin)
    - Luminosité réduite (salle sombre)
    - Contraste bas
    - Légère occlusion basse du visage (masque, main)
    - Légère occlusion haute (capuche)
    """
    augmented = [img_112]  # original

    # Flou — caméra éloignée
    augmented.append(cv2.GaussianBlur(img_112, (5, 5), 1.5))

    # Sombre
    augmented.append(cv2.convertScaleAbs(img_112, alpha=0.6, beta=-20))

    # Lumineux
    augmented.append(cv2.convertScaleAbs(img_112, alpha=1.3, beta=20))

    # Occlusion basse (masque) — cacher 30% bas du visage
    occ_low = img_112.copy()
    h       = occ_low.shape[0]
    occ_low[int(h * 0.7):, :] = 0
    augmented.append(occ_low)

    # Occlusion haute (capuche) — cacher 20% haut
    occ_top = img_112.copy()
    occ_top[:int(h * 0.2), :] = 0
    augmented.append(occ_top)

    return augmented


@router.post("/enroll")
async def enroll_student(
    nom: str = Form(...), prenom: str = Form(...),
    email: str = Form(...), classe: str = Form(...),
    annee_scolaire: str = Form(...), db: Session = Depends(get_db)
):
    if get_student_by_email(db, email):
        raise HTTPException(status_code=400, detail="Email déjà utilisé")
    student = create_student(db, nom=nom, prenom=prenom, email=email,
                             classe=classe, annee_scolaire=annee_scolaire)
    fa = GUIDED_ANGLES[0]
    return {
        "student_id":         str(student.id),
        "message":            "Étudiant créé",
        "total_captures":     TOTAL_CAPTURES,
        "captures_per_angle": CAPTURES_PER_ANGLE,
        "total_angles":       len(GUIDED_ANGLES),
        "next_angle":         fa["instruction"],
        "next_angle_id":      fa["id"],
        "next_angle_label":   fa["label"],
    }


@router.post("/enroll/capture")
async def capture_frame(
    student_id: str = Form(...),
    image: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Pipeline complet avec vérification d'angle via 6DRepNet :
    1. Détecter visage (InsightFace)
    2. Vérifier qualité
    3. Crop visage 112×112
    4. 6DRepNet → yaw/pitch fiables
    5. Vérifier angle correspond à l'instruction
    6. Encoder ArcFace
    7. Upload Cloudinary
    8. Sauvegarder
    """
    contents = await image.read()
    nparr    = np.frombuffer(contents, np.uint8)
    img_orig = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img_orig is None:
        raise HTTPException(status_code=400, detail="Image invalide")

    img_hq = cv2.resize(img_orig, (640, 480), interpolation=cv2.INTER_LANCZOS4)

    records                       = get_temp_embeddings(db, student_id)
    total_captured                = len(records)
    current_angle, angle_captures = get_current_angle(records)

    print(f"\n{'='*40}")
    print(f"[DEBUG] total={total_captured}/{TOTAL_CAPTURES} angle={current_angle['label'] if current_angle else 'DONE'} cap={angle_captures}")

    if current_angle is None:
        return {"accepted": False, "reason": "Tous les angles complets",
                "total_captured": total_captured, "ready_to_finalize": True}

    # ── 1. Détection visage ───────────────────────────────────────────────────
    faces   = face_app.get(img_hq)
    quality = verify_quality(img_hq, faces)
    print(f"[DEBUG] faces={len(faces)} quality={quality['ok']}")

    if not quality["ok"]:
        return _reject(quality["reason"], total_captured, current_angle, angle_captures)

    face      = faces[0]
    det_score = float(face.det_score)

    if det_score < MIN_DET_SCORE:
        return _reject("Rapprochez-vous de la caméra", total_captured,
                       current_angle, angle_captures)

    # ── 2. Crop visage 112×112 ────────────────────────────────────────────────
    face_crop = crop_face(img_hq, face)
    if face_crop is None:
        return _reject("Visage mal cadré", total_captured, current_angle, angle_captures)

    # ── 3. 6DRepNet → yaw/pitch ───────────────────────────────────────────────
    yaw, pitch, roll = estimate_pose(face_crop)
    print(f"[DEBUG] 6DRepNet yaw={yaw}° pitch={pitch}° roll={roll}°")

    detected_id = detect_angle_id(yaw, pitch)
    print(f"[DEBUG] detected={detected_id} expected={current_angle['id']}")

    if detected_id is None:
        return _reject(
            f"{current_angle['instruction']} (yaw={yaw}°, pitch={pitch}°)",
            total_captured, current_angle, angle_captures
        )

    if detected_id != current_angle["id"]:
        return _reject(
            current_angle["instruction"],
            total_captured, current_angle, angle_captures
        )

    # ── 4. ArcFace embedding ──────────────────────────────────────────────────
    embedding = encode_face(face_crop)
    if embedding is None:
        return _reject("Encodage échoué", total_captured, current_angle, angle_captures)

    print(f"[DEBUG] ✅ embedding OK det_score={round(det_score, 3)}")

    # ── 5. Upload Cloudinary ──────────────────────────────────────────────────
    capture_n  = angle_captures + 1
    image_path = f"students/{student_id}/{current_angle['label']}/capture_{capture_n}"
    _, buffer  = cv2.imencode(".jpg", img_hq, [cv2.IMWRITE_JPEG_QUALITY, 95])
    image_url  = upload_image(buffer.tobytes(), image_path)

    is_primary = (current_angle["id"] == 0 and capture_n == 1)
    create_student_image(db, student_id=student_id, url=image_url,
                         angle=f"{current_angle['label']}_{capture_n}",
                         is_primary=is_primary)

    # ── 6. Sauvegarder embedding ──────────────────────────────────────────────
    quality_score = round(current_angle["id"] * 10 + det_score, 4)
    create_temp_embedding(db, student_id=student_id, embedding=embedding,
                          det_score=det_score, quality_score=quality_score)

    new_total          = total_captured + 1
    new_angle_captures = angle_captures + 1
    next_angle, next_cap = get_current_angle(get_temp_embeddings(db, student_id))

    print(f"[DEBUG] ✅ ACCEPTED {new_total}/{TOTAL_CAPTURES} angle={current_angle['label']} cap={new_angle_captures}")

    return {
        "accepted":          True,
        "total_captured":    new_total,
        "total_needed":      TOTAL_CAPTURES,
        "progress":          round(new_total / TOTAL_CAPTURES * 100),
        "ready_to_finalize": new_total >= TOTAL_CAPTURES,
        "pose": {"yaw": yaw, "pitch": pitch, "roll": roll},
        "current_angle": {
            "id":       current_angle["id"],
            "label":    current_angle["label"],
            "captures": new_angle_captures,
            "needed":   CAPTURES_PER_ANGLE,
            "done":     new_angle_captures >= CAPTURES_PER_ANGLE,
        },
        "next_angle": {
            "id":          next_angle["id"]         if next_angle else -1,
            "label":       next_angle["label"]       if next_angle else None,
            "instruction": next_angle["instruction"] if next_angle else "Enrôlement terminé !",
            "captures":    next_cap                  if next_angle else 0,
        },
        "image_url": image_url,
    }


@router.post("/enroll/finalize")
async def finalize_enrollment(
    student_id: str = Form(...), db: Session = Depends(get_db)
):
    """
    Finalisation avec augmentation pour conditions de classe :
    - Flou, sombre, occlusion masque/capuche
    - Embedding final = moyenne pondérée de tous les embeddings
    """
    records = get_temp_embeddings(db, student_id)
    if len(records) < 5:
        raise HTTPException(status_code=400,
                            detail=f"Pas assez de captures ({len(records)}/5 min)")

    all_embeddings = []
    all_weights    = []

    for r in records:
        base_emb = np.array(r.embedding, dtype=np.float32)
        all_embeddings.append(base_emb)
        all_weights.append(r.det_score * 2.0)  # poids double pour les réels

    print(f"[FINALIZE] {len(records)} embeddings réels")
    print(f"[FINALIZE] Calcul embedding final...")

    # Moyenne pondérée finale
    embeddings = np.array(all_embeddings, dtype=np.float32)
    weights    = np.array(all_weights)
    weights   /= weights.sum()

    final = np.average(embeddings, axis=0, weights=weights)
    norm  = np.linalg.norm(final)
    if norm > 0:
        final /= norm

    create_student_face(db, student_id=student_id, embedding=final,
                        det_score=float(np.mean([r.det_score for r in records])),
                        nb_images=len(records))
    update_enrolled(db, student_id)
    delete_temp_embeddings(db, student_id)

    print(f"[FINALIZE] ✅ Embedding final stocké ({len(records)} captures)")

    return {
        "success":       True,
        "message":       "Enrôlement terminé avec succès",
        "total_frames":  len(records),
        "angles_used":   len(GUIDED_ANGLES),
    }


@router.get("/enroll/{student_id}/progress")
async def get_enrollment_progress(
    student_id: str, db: Session = Depends(get_db)
):
    records = get_temp_embeddings(db, student_id)
    counts  = {a["id"]: 0 for a in GUIDED_ANGLES}
    for r in records:
        aid = extract_angle_id(r)
        if aid in counts:
            counts[aid] += 1
    current_angle, _ = get_current_angle(records)
    return {
        "total_captured":    len(records),
        "total_needed":      TOTAL_CAPTURES,
        "progress":          round(len(records) / TOTAL_CAPTURES * 100),
        "angles_status":     [{"id": a["id"], "label": a["label"],
                               "captured": counts[a["id"]],
                               "needed":   CAPTURES_PER_ANGLE,
                               "done":     counts[a["id"]] >= CAPTURES_PER_ANGLE}
                              for a in GUIDED_ANGLES],
        "current_angle":     current_angle["label"] if current_angle else None,
        "ready_to_finalize": len(records) >= TOTAL_CAPTURES,
    }


def _reject(reason, total, angle, captures):
    return {
        "accepted": False, "reason": reason, "total_captured": total,
        "current_angle": {
            "id": angle["id"], "label": angle["label"],
            "instruction": angle["instruction"],
            "captures": captures, "needed": CAPTURES_PER_ANGLE,
        }
    }