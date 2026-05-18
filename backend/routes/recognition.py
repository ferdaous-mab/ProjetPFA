"""
routes/recognition.py - Routes reconnaissance faciale
SmartCampus IA - ESISA Fes 2025

POST /api/recognition/identify     <- identifie un visage depuis une image base64
POST /api/recognition/class-photo  <- analyse photo de classe, marque les presences
GET  /api/recognition/session/{id} <- resultats d'une session de reconnaissance
"""

import base64, uuid, logging
import cv2, numpy as np
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from config import get_db
from db import crud

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/recognition", tags=["Recognition"])

# Singleton
_recognizer = None

def get_recognizer():
    global _recognizer
    if _recognizer is None:
        from ai.recognition import FaceRecognizer
        _recognizer = FaceRecognizer()
    return _recognizer


# ── Schemas ───────────────────────────────────────────────────────────────────
class IdentifyRequest(BaseModel):
    image_b64:  str
    session_id: int = None   # id de seance pour marquer la presence

class ClassPhotoRequest(BaseModel):
    image_b64:  str
    session_id: int          # id de seance obligatoire


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/identify")
def identify_face(req: IdentifyRequest, db: Session = Depends(get_db)):
    """
    Identifie un seul visage depuis une image base64.
    Utile pour tester la reconnaissance ou valider un etudiant.
    """
    # Decode image
    try:
        img_bytes = base64.b64decode(req.image_b64)
        arr   = np.frombuffer(img_bytes, np.uint8)
        image = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if image is None:
            raise HTTPException(400, "Image invalide.")
    except Exception:
        raise HTTPException(400, "Erreur decodage image.")

    # Charge les embeddings de la base
    db_embeddings = crud.get_all_embeddings(db)
    if not db_embeddings:
        raise HTTPException(404, "Aucun etudiant enrole dans la base.")

    # Reconnaissance
    rec = get_recognizer()
    results = rec.recognize_class(image, db_embeddings=db_embeddings)

    if not results:
        return {"identified": False, "message": "Aucun visage detecte."}

    best = max(results, key=lambda r: r.score)
    return {
        "identified":   best.identified,
        "student_id":   best.student_id,
        "student_name": best.student_name,
        "score":        best.score,
        "faces_found":  len(results),
    }


@router.post("/class-photo")
def analyze_class_photo(req: ClassPhotoRequest, db: Session = Depends(get_db)):
    """
    Analyse une photo de classe et marque automatiquement les presences.
    Appele depuis le dashboard professeur apres avoir pris une photo de la classe.
    """
    # Verifie que la seance existe
    session = crud.get_session(db, req.session_id)
    if not session:
        raise HTTPException(404, f"Seance {req.session_id} introuvable.")

    # Decode image
    try:
        img_bytes = base64.b64decode(req.image_b64)
        arr   = np.frombuffer(img_bytes, np.uint8)
        image = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if image is None:
            raise HTTPException(400, "Image invalide.")
    except Exception:
        raise HTTPException(400, "Erreur decodage image.")

    # Charge embeddings
    db_embeddings = crud.get_all_embeddings(db)
    if not db_embeddings:
        raise HTTPException(404, "Aucun etudiant enrole.")

    # Reconnaissance
    rec = get_recognizer()
    results = rec.recognize_class(
        image,
        db_embeddings=db_embeddings,
        session_id=str(req.session_id),
    )

    # Marque les presences
    presences_marquees = []
    inconnus = 0

    for r in results:
        if r.identified and r.student_id > 0:
            try:
                crud.mark_attendance(
                    db,
                    session_id=req.session_id,
                    student_id=r.student_id,
                    status="present",
                )
                presences_marquees.append({
                    "student_id":   r.student_id,
                    "student_name": r.student_name,
                    "score":        round(r.score, 3),
                })
            except Exception as e:
                logger.warning(f"Erreur marquage presence etudiant {r.student_id}: {e}")
        else:
            inconnus += 1

    logger.info(
        f"Classe analysee: seance={req.session_id} "
        f"visages={len(results)} identifies={len(presences_marquees)} inconnus={inconnus}"
    )

    return {
        "success":            True,
        "session_id":         req.session_id,
        "faces_detected":     len(results),
        "students_identified": len(presences_marquees),
        "unknown_faces":      inconnus,
        "presences":          presences_marquees,
    }


@router.get("/health")
def recognition_health():
    """Verifie que le module de reconnaissance est charge."""
    try:
        rec = get_recognizer()
        return {"status": "ok", "model": "InsightFace buffalo_l"}
    except Exception as e:
        return {"status": "error", "message": str(e)}