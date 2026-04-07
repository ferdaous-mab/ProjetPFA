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
from ai.storage import upload_image

router = APIRouter()

REQUIRED_IMAGES = 20

ANGLES_INSTRUCTIONS = [
    {"angle": "front_1",      "instruction": "Regardez droit devant la caméra"},
    {"angle": "front_2",      "instruction": "Regardez droit devant — expression neutre"},
    {"angle": "left_1",       "instruction": "Tournez légèrement la tête à gauche"},
    {"angle": "left_2",       "instruction": "Tournez encore plus à gauche"},
    {"angle": "right_1",      "instruction": "Tournez légèrement la tête à droite"},
    {"angle": "right_2",      "instruction": "Tournez encore plus à droite"},
    {"angle": "up_1",         "instruction": "Inclinez la tête vers le haut"},
    {"angle": "up_2",         "instruction": "Regardez encore plus vers le haut"},
    {"angle": "down_1",       "instruction": "Inclinez la tête vers le bas"},
    {"angle": "down_2",       "instruction": "Regardez encore plus vers le bas"},
    {"angle": "left_far",     "instruction": "Tournez bien à gauche"},
    {"angle": "right_far",    "instruction": "Tournez bien à droite"},
    {"angle": "smile_1",      "instruction": "Souriez naturellement"},
    {"angle": "smile_2",      "instruction": "Souriez encore"},
    {"angle": "neutral_1",    "instruction": "Expression neutre"},
    {"angle": "neutral_2",    "instruction": "Expression neutre — regardez la caméra"},
    {"angle": "tilt_left",    "instruction": "Inclinez légèrement la tête à gauche"},
    {"angle": "tilt_right",   "instruction": "Inclinez légèrement la tête à droite"},
    {"angle": "close_1",      "instruction": "Rapprochez-vous légèrement de la caméra"},
    {"angle": "far_1",        "instruction": "Éloignez-vous légèrement de la caméra"},
]

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
        "student_id": str(student.id),
        "angles": ANGLES_INSTRUCTIONS
    }

# ─── ROUTE 2 : Upload image ───────────────────────────────────────────────────
@router.post("/enroll/image")
async def enroll_image(
    student_id: str    = Form(...),
    angle: str         = Form(...),
    image: UploadFile  = File(...),
    db: Session        = Depends(get_db)
):
    # Vérifier que l'étudiant existe
    student = crud.get_student_by_id(db, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Étudiant non trouvé")

    # Vérifier nombre d'images déjà capturées
    total = crud.count_student_images(db, student_id)
    if total >= REQUIRED_IMAGES:
        raise HTTPException(status_code=400, detail="20 images déjà capturées")

    # Lire l'image
    contents = await image.read()
    nparr    = np.frombuffer(contents, np.uint8)
    img      = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        raise HTTPException(status_code=400, detail="Image invalide")

    # Détection visage
    faces = detect_faces(img)

    # Vérification qualité
    quality = verify_quality(img, faces)

    if not quality["ok"]:
        return {
            "ok": False,
            "reason": quality["reason"],
            "total_captures": total
        }

    # Upload vers Supabase Storage
    image_url = upload_image(contents, student_id, angle)

    # Sauvegarder dans BD
    crud.create_student_image(
        db=db,
        student_id=student_id,
        image_url=image_url,
        angle=angle,
        quality_score=quality["sharpness"],
        brightness=quality["brightness"],
        is_valid=True
    )

    total_now = total + 1

    # Si 20 images capturées → déclencher calcul embedding
    if total_now >= REQUIRED_IMAGES:
        return {
            "ok": True,
            "message": "20 images capturées — prêt pour le calcul embedding",
            "angle": angle,
            "total_captures": total_now,
            "ready_for_compute": True
        }

    return {
        "ok": True,
        "message": f"Image '{angle}' capturée avec succès",
        "angle": angle,
        "total_captures": total_now,
        "ready_for_compute": False,
        "next_instruction": ANGLES_INSTRUCTIONS[total_now]["instruction"]
    }

# ─── ROUTE 3 : Calcul embedding final ────────────────────────────────────────
@router.post("/enroll/compute")
async def compute_embedding(
    student_id: str = Form(...),
    db: Session     = Depends(get_db)
):
    from ai.storage import supabase
    from config import SUPABASE_BUCKET
    import requests

    # Vérifier étudiant
    student = crud.get_student_by_id(db, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Étudiant non trouvé")

    # Récupérer les 20 images depuis BD
    images = crud.get_student_images(db, student_id)
    if len(images) < REQUIRED_IMAGES:
        raise HTTPException(
            status_code=400,
            detail=f"Seulement {len(images)} images — 20 requises"
        )

    embeddings = []
    det_scores = []

    for img_record in images:
        # Télécharger l'image depuis Supabase Storage
        response = requests.get(img_record.image_url)
        nparr    = np.frombuffer(response.content, np.uint8)
        img      = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            continue

        # Calculer embedding
        result = encode_face(img)
        if result["ok"]:
            embeddings.append(result["embedding"])
            det_scores.append(result["det_score"])

    if len(embeddings) < 10:
        raise HTTPException(
            status_code=400,
            detail="Pas assez d'images valides pour calculer l'embedding"
        )

    # Moyenne des embeddings
    mean_embedding = np.mean(embeddings, axis=0)
    mean_embedding = mean_embedding / np.linalg.norm(mean_embedding)
    mean_det_score = float(np.mean(det_scores))

    # Sauvegarder embedding final
    crud.create_student_face(
        db=db,
        student_id=student_id,
        embedding=mean_embedding,
        det_score=mean_det_score,
        nb_images=len(embeddings)
    )

    # Marquer étudiant comme enrôlé
    crud.update_enrolled(db, student_id)

    return {
        "message": "Embedding calculé avec succès",
        "student_id": student_id,
        "nb_images_used": len(embeddings),
        "det_score_moyen": mean_det_score,
        "enrolled": True
    }