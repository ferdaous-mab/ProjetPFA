from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from fastapi import Depends
from db.crud import (
    get_all_faces, get_student_by_id,
    update_student_face, get_student_primary_image,
    create_alert, get_absence_count, get_attendance_rate,
)
from ai.quality import verify_quality
from ai.encoder import encode_face_augmented, compute_similarity
from ai.detector import face_app
from config import SessionLocal
import numpy as np
import cv2

router = APIRouter()

# ── Seuils ───────────────────────────────────────────────────────────────────
RECOGNITION_THRESHOLD  = 0.42
ABSENCE_ALERT_THRESHOLD = 3     # alerter si absences > 3
GRADE_ALERT_THRESHOLD   = 10.0  # alerter si moyenne < 10


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/recognize")
async def recognize_face(
    image: UploadFile = File(...),
    session_id: str = Form(None),   # optionnel — pour marquer présence
    db: Session = Depends(get_db)
):
    """
    Reconnaissance faciale :
    1. Vérifier qualité
    2. Encoder le visage (5 augmentations)
    3. Comparer avec tous les embeddings en BD
    4. Retourner l'étudiant + sa photo + infos si reconnu
    5. Déclencher alertes si nécessaire
    """
    contents = await image.read()
    nparr    = np.frombuffer(contents, np.uint8)
    img      = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        raise HTTPException(status_code=400, detail="Image invalide")

    img = cv2.resize(img, (320, 240))

    # ── Étape 1 : Qualité ─────────────────────────────────────────────────────
    faces   = face_app.get(img)
    quality = verify_quality(img, faces)
    if not quality["ok"]:
        return {
            "recognized": False,
            "reason": quality["reason"],
            "student": None
        }

    # ── Étape 2 : Encodage ────────────────────────────────────────────────────
    embedding, det_score = encode_face_augmented(img)
    if embedding is None:
        return {
            "recognized": False,
            "reason": "Aucun visage detecte",
            "student": None
        }

    # ── Étape 3 : Comparaison avec la BD ──────────────────────────────────────
    enrolled = get_all_faces(db)
    if not enrolled:
        return {
            "recognized": False,
            "reason": "Aucun etudiant enrole en base",
            "student": None
        }

    best_score  = -1.0
    best_record = None

    for record in enrolled:
        stored_emb = np.array(record.embedding, dtype=np.float32)
        norm = np.linalg.norm(stored_emb)
        if norm > 0:
            stored_emb /= norm
        score = compute_similarity(embedding, stored_emb)
        if score > best_score:
            best_score  = score
            best_record = record

    # ── Étape 4 : Décision ────────────────────────────────────────────────────
    if best_score >= RECOGNITION_THRESHOLD and best_record is not None:
        student = get_student_by_id(db, str(best_record.student_id))
        if not student:
            return {"recognized": False, "reason": "Etudiant introuvable", "student": None}

        # Photo principale de l'étudiant
        primary_image = get_student_primary_image(db, str(student.id))
        photo_url     = primary_image.url if primary_image else None

        # Statistiques de l'étudiant
        absences      = get_absence_count(db, str(student.id))
        taux_presence = get_attendance_rate(db, str(student.id))

        # ── Étape 5 : Alertes automatiques ───────────────────────────────────
        if absences > ABSENCE_ALERT_THRESHOLD:
            create_alert(
                db,
                student_id  = str(student.id),
                type        = "absences_excessives",
                message     = f"{student.prenom} {student.nom} a {absences} absences",
                severity    = "high" if absences > 5 else "medium",
                target_role = "professeur"
            )
            create_alert(
                db,
                student_id  = str(student.id),
                type        = "absences_excessives",
                message     = f"Attention : {student.prenom} {student.nom} ({student.classe}) a {absences} absences",
                severity    = "high" if absences > 5 else "medium",
                target_role = "admin"
            )

        return {
            "recognized": True,
            "confidence": round(best_score, 4),
            "student": {
                "id":            str(student.id),
                "nom":           student.nom,
                "prenom":        student.prenom,
                "email":         student.email,
                "classe":        student.classe,
                "annee_scolaire": student.annee_scolaire,
                "photo_url":     photo_url,
                "absences":      absences,
                "taux_presence": taux_presence,
            }
        }

    # ── Non reconnu ───────────────────────────────────────────────────────────
    return {
        "recognized": False,
        "confidence": round(best_score, 4),
        "reason": f"Visage non reconnu (score {round(best_score, 4)} < {RECOGNITION_THRESHOLD})",
        "student": None
    }


@router.post("/recalibrate")
async def recalibrate_student(
    student_id: str = Form(...),
    image: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Mettre à jour l'embedding d'un étudiant existant.
    Utile si la précision baisse (nouvelle coupe, lunettes, etc.)
    """
    contents = await image.read()
    nparr    = np.frombuffer(contents, np.uint8)
    img      = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        raise HTTPException(status_code=400, detail="Image invalide")

    img = cv2.resize(img, (320, 240))

    faces   = face_app.get(img)
    quality = verify_quality(img, faces)
    if not quality["ok"]:
        raise HTTPException(status_code=400, detail=quality["reason"])

    embedding, det_score = encode_face_augmented(img)
    if embedding is None:
        raise HTTPException(status_code=400, detail="Visage non detecte")

    update_student_face(db, student_id, embedding, det_score)

    return {
        "success": True,
        "message": "Embedding mis a jour avec succes",
        "det_score": round(det_score, 4)
    }


@router.get("/students/{student_id}/profile")
async def get_student_profile(
    student_id: str,
    db: Session = Depends(get_db)
):
    """
    Retourne le profil complet d'un étudiant :
    infos + photo + stats présence.
    """
    student = get_student_by_id(db, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Etudiant introuvable")

    primary_image = get_student_primary_image(db, student_id)
    absences      = get_absence_count(db, student_id)
    taux_presence = get_attendance_rate(db, student_id)

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
            "absences":      absences,
            "taux_presence": taux_presence,
        }
    }