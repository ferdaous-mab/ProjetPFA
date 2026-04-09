from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
import cv2
import numpy as np

from config import get_db
from db import crud
from ai.encoder import encode_face
from ai.quality import verify_quality
from ai.detector import detect_faces

router = APIRouter()

# ─── ROUTE 1 : Formulaire étudiant ───────────────────────────────────────────

class StudentForm(BaseModel):
    nom: str
    prenom: str
    email: EmailStr
    classe: str
    annee_scolaire: str

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
        classe=form.classe,
        annee_scolaire=form.annee_scolaire
    )

    return {
        "message": "Étudiant enregistré avec succès",
        "student_id": str(student.id)
    }

# ─── ROUTE 2 : Capture frame ─────────────────────────────────────────────────

@router.post("/enroll/capture")
async def enroll_capture(
    student_id: str   = Form(...),
    image: UploadFile = File(...),
    db: Session       = Depends(get_db)
):
    student = crud.get_student_by_id(db, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Étudiant non trouvé")

    contents = await image.read()
    nparr    = np.frombuffer(contents, np.uint8)
    img      = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        return {"ok": False, "reason": "Image invalide", "total": 0}

    faces   = detect_faces(img)
    quality = verify_quality(img, faces)

    if not quality["ok"]:
        return {
            "ok": False,
            "reason": quality["reason"],
            "total": crud.count_temp_embeddings(db, student_id)
        }

    result = encode_face(img)
    if not result["ok"]:
        return {
            "ok": False,
            "reason": result["reason"],
            "total": crud.count_temp_embeddings(db, student_id)
        }

    crud.create_temp_embedding(
        db=db,
        student_id=student_id,
        embedding=result["embedding"],
        det_score=result["det_score"],
        quality_score=quality["sharpness"] or 0.0
    )

    total = crud.count_temp_embeddings(db, student_id)

    return {
        "ok": True,
        "total": total,
        "det_score": round(result["det_score"], 3),
        "quality": round(quality["sharpness"] or 0, 1)
    }

# ─── ROUTE 3 : Finalisation ───────────────────────────────────────────────────

@router.post("/enroll/finalize")
async def enroll_finalize(
    student_id: str = Form(...),
    db: Session     = Depends(get_db)
):
    student = crud.get_student_by_id(db, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Étudiant non trouvé")

    temp_faces = crud.get_temp_embeddings(db, student_id)

    if len(temp_faces) < 5:
        return {
            "ok": False,
            "retry": True,
            "detail": f"Seulement {len(temp_faces)} embeddings valides — veuillez réessayer la capture"
        }

    sorted_faces = sorted(
        temp_faces,
        key=lambda x: (x.quality_score or 0) * (x.det_score or 0),
        reverse=True
    )
    best_faces = sorted_faces[:15]

    embeddings = [np.array(f.embedding) for f in best_faces]
    mean_emb   = np.mean(embeddings, axis=0)
    mean_emb   = mean_emb / np.linalg.norm(mean_emb)
    mean_score = float(np.mean([f.det_score or 0 for f in best_faces]))

    crud.delete_temp_embeddings(db, student_id)

    crud.create_student_face(
        db=db,
        student_id=student_id,
        embedding=mean_emb,
        det_score=mean_score,
        nb_images=len(best_faces)
    )

    crud.update_enrolled(db, student_id)

    return {
        "ok": True,
        "message": "Enrôlement finalisé avec succès",
        "nb_embeddings_used": len(best_faces),
        "det_score_moyen": round(mean_score, 3)
    }