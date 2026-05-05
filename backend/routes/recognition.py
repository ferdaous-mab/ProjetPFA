from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from fastapi import Depends
from db.crud import (
    get_all_faces, get_student_by_id,
    update_student_face, get_student_primary_image,
    create_alert, get_absence_count, get_attendance_rate,
)
from ai.quality import verify_quality
from ai.encoder import encode_face, compute_similarity
from ai.detector import face_app
from config import SessionLocal
import numpy as np
import cv2

router = APIRouter()

RECOGNITION_THRESHOLD   = 0.42
ABSENCE_ALERT_THRESHOLD = 3


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/recognize")
async def recognize_face(
    image: UploadFile = File(...),
    session_id: str = Form(None),
    db: Session = Depends(get_db)
):
    contents = await image.read()
    nparr    = np.frombuffer(contents, np.uint8)
    img      = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        raise HTTPException(status_code=400, detail="Image invalide")

    img   = cv2.resize(img, (640, 480))
    faces = face_app.get(img)

    quality = verify_quality(img, faces)
    if not quality["ok"]:
        return {"recognized": False, "reason": quality["reason"], "student": None}

    # Crop visage + encode
    face   = faces[0]
    x1, y1, x2, y2 = [int(v) for v in face.bbox]
    h, w   = img.shape[:2]
    margin = int((x2 - x1) * 0.2)
    x1 = max(0, x1 - margin); y1 = max(0, y1 - margin)
    x2 = min(w, x2 + margin); y2 = min(h, y2 + margin)
    face_crop = img[y1:y2, x1:x2]

    embedding = encode_face(face_crop)
    if embedding is None:
        return {"recognized": False, "reason": "Encodage échoué", "student": None}

    enrolled = get_all_faces(db)
    if not enrolled:
        return {"recognized": False, "reason": "Aucun étudiant enrôlé", "student": None}

    best_score, best_record = -1.0, None
    for record in enrolled:
        stored = np.array(record.embedding, dtype=np.float32)
        norm   = np.linalg.norm(stored)
        if norm > 0: stored /= norm
        score = compute_similarity(embedding, stored)
        if score > best_score:
            best_score, best_record = score, record

    if best_score >= RECOGNITION_THRESHOLD and best_record is not None:
        student       = get_student_by_id(db, str(best_record.student_id))
        primary_image = get_student_primary_image(db, str(student.id))
        absences      = get_absence_count(db, str(student.id))
        taux_presence = get_attendance_rate(db, str(student.id))

        if absences > ABSENCE_ALERT_THRESHOLD:
            create_alert(db, student_id=str(student.id),
                         type="absences_excessives",
                         message=f"{student.prenom} {student.nom} a {absences} absences",
                         severity="high" if absences > 5 else "medium",
                         target_role="professeur")

        return {
            "recognized": True,
            "confidence": round(best_score, 4),
            "student": {
                "id":             str(student.id),
                "nom":            student.nom,
                "prenom":         student.prenom,
                "email":          student.email,
                "classe":         student.classe,
                "annee_scolaire": student.annee_scolaire,
                "photo_url":      primary_image.url if primary_image else None,
                "absences":       absences,
                "taux_presence":  taux_presence,
            }
        }

    return {
        "recognized": False,
        "confidence": round(best_score, 4),
        "reason":     f"Non reconnu (score={round(best_score, 4)} < {RECOGNITION_THRESHOLD})",
        "student":    None
    }


@router.post("/recalibrate")
async def recalibrate_student(
    student_id: str = Form(...),
    image: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    contents = await image.read()
    nparr    = np.frombuffer(contents, np.uint8)
    img      = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(status_code=400, detail="Image invalide")

    img   = cv2.resize(img, (640, 480))
    faces = face_app.get(img)

    quality = verify_quality(img, faces)
    if not quality["ok"]:
        raise HTTPException(status_code=400, detail=quality["reason"])

    face   = faces[0]
    x1, y1, x2, y2 = [int(v) for v in face.bbox]
    h, w   = img.shape[:2]
    margin = int((x2 - x1) * 0.2)
    x1 = max(0, x1 - margin); y1 = max(0, y1 - margin)
    x2 = min(w, x2 + margin); y2 = min(h, y2 + margin)
    face_crop = img[y1:y2, x1:x2]

    embedding = encode_face(face_crop)
    if embedding is None:
        raise HTTPException(status_code=400, detail="Encodage échoué")

    update_student_face(db, student_id, embedding, float(face.det_score))
    return {"success": True, "message": "Embedding mis à jour",
            "det_score": round(float(face.det_score), 4)}


@router.get("/students/{student_id}/profile")
async def get_student_profile(student_id: str, db: Session = Depends(get_db)):
    student = get_student_by_id(db, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Étudiant introuvable")

    primary_image = get_student_primary_image(db, student_id)
    return {
        "id":             str(student.id),
        "nom":            student.nom,
        "prenom":         student.prenom,
        "email":          student.email,
        "classe":         student.classe,
        "annee_scolaire": student.annee_scolaire,
        "is_enrolled":    student.is_enrolled,
        "photo_url":      primary_image.url if primary_image else None,
        "stats": {
            "absences":      get_absence_count(db, student_id),
            "taux_presence": get_attendance_rate(db, student_id),
        }
    }