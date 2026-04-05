from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
import cv2
import numpy as np

from config import get_db
from db import crud
from ai.encoder import encode_face
from ai.quality import verify_quality

router = APIRouter()

# ─── ANGLES REQUIS ───────────────────────────────────────────────────────────
REQUIRED_ANGLES = ["front", "left", "right"]

# ─── ROUTE 1 : Formulaire étudiant ───────────────────────────────────────────
class StudentForm(BaseModel):
    nom: str
    prenom: str
    email: EmailStr
    classe: str

@router.post("/enroll")
def enroll_student(form: StudentForm, db: Session = Depends(get_db)):
    existing = crud.get_student_by_email(db, form.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email déjà enregistré")

    student = crud.create_student(
        db=db,
        nom=form.nom,
        prenom=form.prenom,
        email=form.email,
        classe=form.classe
    )

    return {
        "message": "Étudiant enregistré avec succès",
        "student_id": str(student.id)
    }

# ─── ROUTE 2 : Capture visage ─────────────────────────────────────────────────
@router.post("/enroll/face")
async def enroll_face(
    student_id: str = Form(...),
    angle: str     = Form(...),
    image: UploadFile = File(...),
    db: Session    = Depends(get_db)
):
    # Vérifier que l'angle est valide
    if angle not in REQUIRED_ANGLES:
        raise HTTPException(
            status_code=400,
            detail=f"Angle invalide. Angles acceptés : {REQUIRED_ANGLES}"
        )

    # Vérifier que l'étudiant existe
    student = crud.get_student_by_id(db, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Étudiant non trouvé")

    # Lire l'image envoyée
    contents = await image.read()
    nparr    = np.frombuffer(contents, np.uint8)
    img      = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        raise HTTPException(status_code=400, detail="Image invalide")

    # Encoder le visage
    result = encode_face(img)

    if not result["ok"]:
        raise HTTPException(status_code=400, detail=result["reason"])

    # Vérifier la qualité
    from ai.detector import detect_faces
    faces   = detect_faces(img)
    quality = verify_quality(img, faces)

    if not quality["ok"]:
        raise HTTPException(status_code=400, detail=quality["reason"])

    # Sauvegarder l'embedding
    crud.create_student_face(
        db=db,
        student_id=student_id,
        embedding=result["embedding"],
        angle=angle,
        quality_score=quality["sharpness"],
        det_score=result["det_score"]
    )

    # Vérifier si tous les angles sont capturés
    total_faces = crud.count_student_faces(db, student_id)

    if total_faces >= len(REQUIRED_ANGLES):
        crud.update_enrolled(db, student_id)
        return {
            "message": "Enrôlement complet — tous les angles capturés",
            "angle": angle,
            "total_captures": total_faces,
            "enrolled": True
        }

    return {
        "message": f"Angle '{angle}' capturé avec succès",
        "angle": angle,
        "total_captures": total_faces,
        "enrolled": False,
        "remaining": len(REQUIRED_ANGLES) - total_faces
    }