from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from fastapi import Depends
from db.models import StudentFaceTemp
from db.crud import (
    create_student,
    get_student_by_email,
    create_temp_embedding,
    get_temp_embeddings,
    create_student_face,
    delete_temp_embeddings,
    update_enrolled,
)
from ai.quality import verify_quality
from ai.encoder import encode_face_augmented
from ai.detector import face_app
from config import SessionLocal
import numpy as np
import cv2

router = APIRouter()

TARGET_FRAMES = 7


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


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
        "message": "Étudiant créé, prêt pour l'enrôlement",
        "target_frames": TARGET_FRAMES
    }


@router.post("/enroll/capture")
async def capture_frame(
    student_id: str = Form(...),
    image: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    contents = await image.read()
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        raise HTTPException(status_code=400, detail="Image invalide")

    img = cv2.resize(img, (320, 240))

    # Détection des visages d'abord
    faces = face_app.get(img)

    # Vérification qualité (image + faces)
    quality = verify_quality(img, faces)
    if not quality["ok"]:
        return {
            "accepted": False,
            "reason": quality["reason"],
            "frames_captured": _count_temp(db, student_id)
        }

    # Encodage augmenté
    embedding, det_score = encode_face_augmented(img)
    if embedding is None:
        return {
            "accepted": False,
            "reason": "Encodage échoué",
            "frames_captured": _count_temp(db, student_id)
        }

    create_temp_embedding(db,
        student_id=student_id,
        embedding=embedding,
        det_score=det_score,
        quality_score=det_score
    )

    frames_captured = _count_temp(db, student_id)
    return {
        "accepted": True,
        "frames_captured": frames_captured,
        "target_frames": TARGET_FRAMES,
        "progress": round(frames_captured / TARGET_FRAMES * 100),
        "ready_to_finalize": frames_captured >= TARGET_FRAMES
    }


@router.post("/enroll/finalize")
async def finalize_enrollment(
    student_id: str = Form(...),
    db: Session = Depends(get_db)
):
    temp_records = get_temp_embeddings(db, student_id)

    if len(temp_records) < 3:
        raise HTTPException(
            status_code=400,
            detail=f"Pas assez de frames valides ({len(temp_records)}/3 minimum)"
        )

    temp_records.sort(key=lambda r: r.quality_score * r.det_score, reverse=True)
    top_records = temp_records[:TARGET_FRAMES]

    embeddings = [np.array(r.embedding, dtype=np.float32) for r in top_records]
    weights = np.array([r.quality_score * r.det_score for r in top_records])
    weights = weights / weights.sum()

    final_embedding = np.average(embeddings, axis=0, weights=weights)
    norm = np.linalg.norm(final_embedding)
    if norm > 0:
        final_embedding = final_embedding / norm

    avg_det_score = float(np.mean([r.det_score for r in top_records]))

    create_student_face(db,
        student_id=student_id,
        embedding=final_embedding,
        det_score=avg_det_score,
        nb_images=len(top_records)
    )

    update_enrolled(db, student_id)
    delete_temp_embeddings(db, student_id)

    return {
        "success": True,
        "message": "Enrôlement terminé avec succès",
        "frames_used": len(top_records),
        "avg_det_score": round(avg_det_score, 4)
    }


def _count_temp(db: Session, student_id: str) -> int:
    return db.query(StudentFaceTemp).filter(
        StudentFaceTemp.student_id == student_id
    ).count()