from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from fastapi import Depends
from db.crud import (
    get_all_faces,
    get_student_by_id,
    update_student_face,
)
from ai.quality import verify_quality
from ai.encoder import encode_face_augmented, compute_similarity
from config import SessionLocal
import numpy as np
import cv2

router = APIRouter()

RECOGNITION_THRESHOLD = 0.42


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/recognize")
async def recognize_face(
    image: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    contents = await image.read()
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        raise HTTPException(status_code=400, detail="Image invalide")

    img = cv2.resize(img, (320, 240))

    quality_ok, quality_msg = verify_quality(img)
    if not quality_ok:
        return {"recognized": False, "reason": quality_msg, "student": None}

    embedding, det_score = encode_face_augmented(img)
    if embedding is None:
        return {"recognized": False, "reason": "Aucun visage détecté", "student": None}

    enrolled = get_all_faces(db)
    if not enrolled:
        return {"recognized": False, "reason": "Aucun étudiant enrôlé en base", "student": None}

    best_score = -1.0
    best_record = None

    for record in enrolled:
        stored_emb = np.array(record.embedding, dtype=np.float32)
        norm = np.linalg.norm(stored_emb)
        if norm > 0:
            stored_emb = stored_emb / norm
        score = compute_similarity(embedding, stored_emb)
        if score > best_score:
            best_score = score
            best_record = record

    if best_score >= RECOGNITION_THRESHOLD and best_record is not None:
        student = get_student_by_id(db, str(best_record.student_id))
        return {
            "recognized": True,
            "confidence": round(best_score, 4),
            "student": {
                "id": str(student.id),
                "nom": student.nom,
                "prenom": student.prenom,
                "email": student.email,
                "classe": student.classe,
                "annee_scolaire": student.annee_scolaire
            }
        }

    return {
        "recognized": False,
        "confidence": round(best_score, 4),
        "reason": f"Similarité insuffisante ({round(best_score, 4)} < {RECOGNITION_THRESHOLD})",
        "student": None
    }


@router.post("/recalibrate")
async def recalibrate_student(
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

    quality_ok, quality_msg = verify_quality(img)
    if not quality_ok:
        raise HTTPException(status_code=400, detail=quality_msg)

    embedding, det_score = encode_face_augmented(img)
    if embedding is None:
        raise HTTPException(status_code=400, detail="Visage non détecté")

    update_student_face(db, student_id, embedding, det_score)

    return {
        "success": True,
        "message": "Embedding mis à jour avec succès",
        "det_score": round(det_score, 4)
    }