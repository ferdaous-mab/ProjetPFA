from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from fastapi import Depends
from db.models import StudentFaceTemp
from db.crud import (
    create_student, get_student_by_email,
    create_temp_embedding, get_temp_embeddings,
    create_student_face, delete_temp_embeddings, update_enrolled,
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
DIVERSITY_THRESHOLD = 0.80

YAW_SECTORS = [
    (-90, -25),
    (-25,  -8),
    ( -8,  +8),
    (  8, +25),
    ( 25, +90),
]


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_yaw_sector(face) -> int:
    try:
        yaw = float(face.pose[0])
        for i, (lo, hi) in enumerate(YAW_SECTORS):
            if lo <= yaw < hi:
                return i
        return 2
    except Exception:
        return -1


@router.post("/enroll")
async def enroll_student(
    nom: str = Form(...),
    prenom: str = Form(...),
    email: str = Form(...),
    classe: str = Form(...),
    annee_scolaire: str = Form(...),
    db: Session = Depends(get_db)
):
    existing = get_student_by_email(db, email)
    if existing:
        raise HTTPException(status_code=400, detail="Email déjà utilisé")

    student = create_student(db, nom=nom, prenom=prenom, email=email,
                             classe=classe, annee_scolaire=annee_scolaire)
    return {
        "student_id": str(student.id),
        "message": "Étudiant créé",
        "target_frames": TARGET_FRAMES
    }


@router.post("/enroll/capture")
async def capture_frame(
    student_id: str = Form(...),
    image: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    contents = await image.read()
    nparr    = np.frombuffer(contents, np.uint8)
    img      = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        raise HTTPException(status_code=400, detail="Image invalide")

    img           = cv2.resize(img, (320, 240))
    current_count = _count_temp(db, student_id)
    faces         = face_app.get(img)

    quality = verify_quality(img, faces)
    if not quality["ok"]:
        return {"accepted": False, "reason": quality["reason"], "frames_captured": current_count}

    embedding, det_score = encode_face(img)
    if embedding is None:
        return {"accepted": False, "reason": "Visage non détecté", "frames_captured": current_count}

    face    = max(faces, key=lambda f: f.det_score)
    sector  = get_yaw_sector(face)
    records = get_temp_embeddings(db, student_id)

    if sector != -1:
        used_sectors = [round((r.quality_score % 1) * 1000) for r in records]
        if sector in used_sectors:
            return {"accepted": False, "reason": "Tournez davantage la tête", "frames_captured": current_count}
        quality_score = round(det_score + sector / 1000, 6)
    else:
        for r in records:
            if compute_similarity(embedding, np.array(r.embedding, dtype=np.float32)) > DIVERSITY_THRESHOLD:
                return {"accepted": False, "reason": "Tournez davantage la tête", "frames_captured": current_count}
        quality_score = det_score

    # ── Upload vers Supabase Storage ──────────────────────────────────────────
    frame_n    = current_count + 1
    image_path = f"students/{student_id}/frame_{frame_n}.jpg"
    _, buffer  = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 85])
    image_url  = upload_image(buffer.tobytes(), image_path)
    # ─────────────────────────────────────────────────────────────────────────

    create_temp_embedding(db,
        student_id=student_id,
        embedding=embedding,
        det_score=det_score,
        quality_score=quality_score,
        image_url=image_url,
    )

    frames_captured = _count_temp(db, student_id)
    instructions = [
        "Regardez droit devant",
        "Tournez à droite",
        "Tournez à gauche",
        "Tournez plus à droite",
        "Presque terminé !",
    ]

    return {
        "accepted": True,
        "frames_captured": frames_captured,
        "target_frames": TARGET_FRAMES,
        "progress": round(frames_captured / TARGET_FRAMES * 100),
        "ready_to_finalize": frames_captured >= TARGET_FRAMES,
        "next_instruction": instructions[min(frames_captured, len(instructions) - 1)]
    }


@router.post("/enroll/finalize")
async def finalize_enrollment(
    student_id: str = Form(...),
    db: Session = Depends(get_db)
):
    records = get_temp_embeddings(db, student_id)

    if len(records) < 3:
        raise HTTPException(status_code=400,
                            detail=f"Pas assez de frames ({len(records)}/3 minimum)")

    records.sort(key=lambda r: r.det_score, reverse=True)
    top = records[:TARGET_FRAMES]

    embeddings = [np.array(r.embedding, dtype=np.float32) for r in top]
    weights    = np.array([r.det_score for r in top])
    weights   /= weights.sum()

    final = np.average(embeddings, axis=0, weights=weights)
    norm  = np.linalg.norm(final)
    if norm > 0:
        final /= norm

    # Meilleure frame = photo principale
    best_record = max(top, key=lambda r: r.det_score)
    photo_url   = best_record.image_url

    create_student_face(db,
        student_id=student_id,
        embedding=final,
        det_score=float(np.mean([r.det_score for r in top])),
        nb_images=len(top),
        photo_url=photo_url,
    )

    update_enrolled(db, student_id)
    delete_temp_embeddings(db, student_id)

    return {
        "success": True,
        "message": "Enrôlement terminé",
        "frames_used": len(top),
        "photo_url": photo_url,
    }


def _count_temp(db: Session, student_id: str) -> int:
    return db.query(StudentFaceTemp).filter(
        StudentFaceTemp.student_id == student_id).count()