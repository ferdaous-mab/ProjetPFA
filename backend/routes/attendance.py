"""
routes/attendance.py — Reconnaissance faciale de classe + gestion présences
SmartCampus IA - ESISA Fes 2025

POST /api/attendance/analyze-photo         photo de classe → présences auto
POST /api/attendance/analyze-video         vidéo → présences auto (1 frame/15)
GET  /api/attendance/mes-sessions          séances du prof connecté
GET  /api/attendance/session/{session_id}  détail présences d'une séance
PUT  /api/attendance/session/{sid}/student/{stid}  correction manuelle
"""

import os
import uuid
import logging
import tempfile
from datetime import datetime, timezone

import cv2
import numpy as np

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth.dependencies import admin_or_prof, get_db
from db import crud
from db.models import Matiere, Session as SessionModel, Attendance, Student

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/attendance", tags=["Attendance"])

SIMILARITY_THRESHOLD = 0.62   # caméra haute/plafond : vues top-down scorent moins fort
                              # que le frontal (ArcFace est entraîné surtout en frontal)
SIMILARITY_MARGIN    = 0.08   # écart minimum entre 1er et 2ème candidat
FRAME_SAMPLE_RATE    = 30     # 1 frame analysée toutes les N frames (1/s à 30fps)
MAX_SAMPLED_FRAMES   = 60     # limite pour éviter un timeout sur très longues vidéos

# MiniFASNetV2 est entraîné sur des visages frontaux en gros plan.
# Pour une caméra haute (plafond), les visages sont petits, flous et vus de dessus
# → le modèle les classifie tous comme "faux" (faux positifs massifs).
# On désactive l'anti-spoofing pour les petits visages (< ANTISPOOF_MIN_PX px).
# Les risques de spoofing par photo brandie sont quasi nuls avec une caméra au plafond.
ANTISPOOF_MIN_PX = 80   # en dessous de cette taille, skip l'anti-spoofing


# ── Helpers ───────────────────────────────────────────────────────────────────

def _bytes_to_bgr(data: bytes) -> np.ndarray:
    arr = np.frombuffer(data, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Image invalide ou format non supporté.")
    return img


_spoof = None

def _get_spoof():
    global _spoof
    if _spoof is None:
        from ai.spoofing import get_anti_spoofing
        _spoof = get_anti_spoofing()
    return _spoof


def _spoof_crop(frame: np.ndarray, bbox: list, scale: float = 2.7) -> np.ndarray:
    """
    Extrait un crop 2.7× élargi centré sur le visage.
    MiniFASNetV2 a été entraîné sur des crops à ce facteur d'échelle —
    un crop serré ne contient pas assez de contexte de texture pour détecter les faux.
    """
    x1, y1, x2, y2 = bbox
    cx = (x1 + x2) // 2
    cy = (y1 + y2) // 2
    nw = int((x2 - x1) * scale)
    nh = int((y2 - y1) * scale)
    nx1 = max(0, cx - nw // 2)
    ny1 = max(0, cy - nh // 2)
    nx2 = min(frame.shape[1], cx + nw // 2)
    ny2 = min(frame.shape[0], cy + nh // 2)
    return frame[ny1:ny2, nx1:nx2]


def _process_frame(
    frame: np.ndarray,
    db: Session,
    seen: set,
) -> list[dict]:
    from ai.detector import detect_faces_classroom

    spoof = _get_spoof()
    recognized = []
    faces = detect_faces_classroom(frame, min_face_size=20, min_score=0.35)
    print(f"[ATTENDANCE] {len(faces)} visage(s) détecté(s)")

    for i, face in enumerate(faces):
        fw = face["width"]
        fh = face["height"]

        # Skip anti-spoofing pour les petits visages (caméra haute) :
        # MiniFASNetV2 est entraîné sur des gros plans frontaux → faux positifs massifs
        # sur des visages petits/flous vus de dessus. Le risque de spoofing est quasi nul
        # avec une caméra au plafond (il faudrait brandir une affiche géante).
        if fw >= ANTISPOOF_MIN_PX and fh >= ANTISPOOF_MIN_PX:
            crop_spoof = _spoof_crop(frame, face["bbox"], scale=2.7)
            is_real, spoof_conf = spoof.is_real(crop_spoof)
            print(f"[SPOOF #{i}] is_real={is_real}  conf={spoof_conf:.4f}  bbox={face['bbox']}")
            if not is_real:
                print(f"[SPOOF #{i}] ❌ Visage 2D REJETÉ")
                continue
        else:
            print(f"[SPOOF #{i}] visage {fw}×{fh}px — skip anti-spoof (trop petit pour MiniFASNet)")

        match = crud.find_student_by_embedding(
            db,
            face["normed_embedding"],
            threshold=SIMILARITY_THRESHOLD,
            margin=SIMILARITY_MARGIN,
        )
        print(f"[MATCH #{i}] {match}")
        if match and match["student_id"] not in seen:
            recognized.append({
                **match,
                "bbox":       face["bbox"],
                "confidence": face["confidence"],
            })

    return recognized


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/analyze-photo")
async def analyze_photo(
    session_id: str      = Form(...),
    image:      UploadFile = File(...),
    db: Session          = Depends(get_db),
    _user                = Depends(admin_or_prof),
):
    """
    Analyse une photo de classe et marque les présences automatiquement.
    Les étudiants du roster non détectés sont marqués absents.
    """
    # Valider la séance
    try:
        sid = uuid.UUID(session_id)
    except ValueError:
        raise HTTPException(400, "session_id invalide (UUID attendu).")

    session = crud.get_session_by_id(db, sid)
    if not session:
        raise HTTPException(404, f"Séance {session_id} introuvable.")

    # Décoder l'image
    try:
        img = _bytes_to_bgr(await image.read())
    except ValueError as exc:
        raise HTTPException(400, str(exc))

    # Traitement synchrone dans un thread (CPU-intensif)
    def _run():
        seen: set = set()
        recognized_list = _process_frame(img, db, seen)
        for r in recognized_list:
            seen.add(r["student_id"])
        return recognized_list

    recognized = await run_in_threadpool(_run)

    # Construire le résultat et marquer les présences / absences
    roster      = crud.get_session_roster(db, sid)
    roster_ids  = {str(s.id) for s in roster}
    present_ids = {r["student_id"] for r in recognized}

    presences_marquees = []
    for r in recognized:
        att = crud.mark_attendance(
            db, sid, uuid.UUID(r["student_id"]), "present",
            confidence=r["similarity"],
        )
        presences_marquees.append({
            "student_id":   r["student_id"],
            "nom":          r["nom"],
            "prenom":       r["prenom"],
            "similarity":   round(r["similarity"], 3),
        })

    # Marquer absents les étudiants du roster non reconnus
    absents_marques = []
    for s in roster:
        if str(s.id) not in present_ids:
            crud.mark_attendance(db, sid, s.id, "absent")
            absents_marques.append({"student_id": str(s.id), "nom": s.nom, "prenom": s.prenom})

    logger.info(
        "analyze-photo séance=%s visages=%d présents=%d absents=%d inconnus=%d",
        session_id,
        len(recognized) + sum(1 for r in recognized),
        len(presences_marquees),
        len(absents_marques),
        len(recognized) - len(presences_marquees),
    )

    return {
        "success":            True,
        "session_id":         session_id,
        "faces_detected":     len(recognized),
        "students_present":   len(presences_marquees),
        "students_absent":    len(absents_marques),
        "presences":          presences_marquees,
        "absences":           absents_marques,
    }


@router.post("/analyze-video")
async def analyze_video(
    session_id: str      = Form(...),
    video:      UploadFile = File(...),
    db: Session          = Depends(get_db),
    _user                = Depends(admin_or_prof),
):
    """
    Analyse une vidéo de classe (substitut temporaire du flux caméra).
    Échantillonne 1 frame toutes les FRAME_SAMPLE_RATE frames.
    Un étudiant est "présent" s'il est reconnu sur au moins 1 frame.
    Les étudiants du roster jamais détectés sont marqués absents.

    NOTE : la vidéo est un outil de test développeur uniquement.
    En production, le pipeline est alimenté par un flux RTSP (source = caméra école).
    """
    try:
        sid = uuid.UUID(session_id)
    except ValueError:
        raise HTTPException(400, "session_id invalide (UUID attendu).")

    session = crud.get_session_by_id(db, sid)
    if not session:
        raise HTTPException(404, f"Séance {session_id} introuvable.")

    video_bytes = await video.read()

    def _process_video() -> dict:
        # Écrire dans un fichier temporaire (cv2 n'accepte pas les bytes)
        suffix = os.path.splitext(video.filename or "video.mp4")[1] or ".mp4"
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
            f.write(video_bytes)
            tmp_path = f.name

        try:
            cap = cv2.VideoCapture(tmp_path)
            if not cap.isOpened():
                raise ValueError("Impossible d'ouvrir la vidéo.")

            seen: set[str]   = set()   # student_id déjà reconnu (au moins 1 fois)
            present_data: dict[str, dict] = {}
            frame_idx        = 0
            sampled          = 0
            frames_with_face = 0

            while sampled < MAX_SAMPLED_FRAMES:
                ret, frame = cap.read()
                if not ret:
                    break
                frame_idx += 1

                if frame_idx % FRAME_SAMPLE_RATE != 0:
                    continue

                sampled += 1
                recognized = _process_frame(frame, db, seen)

                if recognized:
                    frames_with_face += 1
                for r in recognized:
                    sid_str = r["student_id"]
                    if sid_str not in seen:
                        seen.add(sid_str)
                        present_data[sid_str] = r

            cap.release()
        finally:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass

        return {
            "total_frames":   frame_idx,
            "sampled_frames": sampled,
            "present_data":   present_data,
        }

    result = await run_in_threadpool(_process_video)

    # Marquer présences
    presences_marquees = []
    for sid_str, r in result["present_data"].items():
        crud.mark_attendance(
            db, sid, uuid.UUID(sid_str), "present",
            confidence=r["similarity"],
        )
        presences_marquees.append({
            "student_id": sid_str,
            "nom":        r["nom"],
            "prenom":     r["prenom"],
            "similarity": round(r["similarity"], 3),
        })

    # Marquer absents
    roster     = crud.get_session_roster(db, sid)
    present_ids = set(result["present_data"].keys())
    absents_marques = []
    for s in roster:
        if str(s.id) not in present_ids:
            crud.mark_attendance(db, sid, s.id, "absent")
            absents_marques.append({"student_id": str(s.id), "nom": s.nom, "prenom": s.prenom})

    logger.info(
        "analyze-video séance=%s frames=%d/%d présents=%d absents=%d",
        session_id,
        result["sampled_frames"],
        result["total_frames"],
        len(presences_marquees),
        len(absents_marques),
    )

    return {
        "success":          True,
        "session_id":       session_id,
        "total_frames":     result["total_frames"],
        "sampled_frames":   result["sampled_frames"],
        "students_present": len(presences_marquees),
        "students_absent":  len(absents_marques),
        "presences":        presences_marquees,
        "absences":         absents_marques,
    }


@router.get("/mes-sessions")
def mes_sessions(
    db: Session = Depends(get_db),
    user        = Depends(admin_or_prof),
):
    """
    Retourne toutes les séances des matières du professeur connecté,
    avec le résumé des présences pour chaque séance.
    """
    matieres = db.query(Matiere).filter(
        Matiere.professeur_id == user.id
    ).all()

    sessions_out = []
    for m in matieres:
        sessions = db.query(SessionModel).filter(
            SessionModel.matiere_id == m.id
        ).order_by(SessionModel.date.desc()).all()

        for s in sessions:
            atts = db.query(Attendance).filter(
                Attendance.session_id == s.id
            ).all()
            sessions_out.append({
                "session_id":   str(s.id),
                "matiere_id":   str(m.id),
                "matiere_nom":  m.nom,
                "classe":       s.classe,
                "date":         str(s.date),
                "heure_debut":  str(s.heure_debut) if s.heure_debut else None,
                "status":       s.status,
                "presents":     sum(1 for a in atts if a.status == "present"),
                "absents":      sum(1 for a in atts if a.status == "absent"),
                "retards":      sum(1 for a in atts if a.status == "retard"),
                "total":        len(atts),
            })

    sessions_out.sort(key=lambda x: x["date"], reverse=True)
    return sessions_out


@router.get("/session/{session_id}")
def get_session_attendance(
    session_id: str,
    db: Session   = Depends(get_db),
    _user         = Depends(admin_or_prof),
):
    """
    Détail des présences pour une séance : liste de tous les étudiants
    du roster avec leur statut (présent / absent / retard).
    """
    try:
        sid = uuid.UUID(session_id)
    except ValueError:
        raise HTTPException(400, "session_id invalide.")

    session = crud.get_session_by_id(db, sid)
    if not session:
        raise HTTPException(404, "Séance introuvable.")

    roster = crud.get_session_roster(db, sid)
    atts_map = {
        str(a.student_id): a
        for a in db.query(Attendance).filter(Attendance.session_id == sid).all()
    }

    result = []
    for student in roster:
        sid_str = str(student.id)
        att     = atts_map.get(sid_str)
        result.append({
            "student_id":  sid_str,
            "nom":         student.nom,
            "prenom":      student.prenom,
            "classe":      student.classe,
            "status":      att.status      if att else "absent",
            "confidence":  att.confidence  if att else None,
            "detected_at": str(att.detected_at) if att and att.detected_at else None,
        })

    result.sort(key=lambda x: (x["nom"], x["prenom"]))
    return {
        "session_id": session_id,
        "classe":     session.classe,
        "date":       str(session.date),
        "students":   result,
    }


class StatusUpdate(BaseModel):
    status: str   # present | absent | retard


@router.put("/session/{session_id}/student/{student_id}")
def update_attendance(
    session_id:  str,
    student_id:  str,
    body:        StatusUpdate,
    db: Session  = Depends(get_db),
    _user        = Depends(admin_or_prof),
):
    """
    Correction manuelle : basculer le statut d'un étudiant (présent ↔ absent).
    Crée l'enregistrement s'il n'existe pas encore.
    """
    if body.status not in ("present", "absent", "retard"):
        raise HTTPException(400, "status doit être : present | absent | retard")

    try:
        sid = uuid.UUID(session_id)
        stid = uuid.UUID(student_id)
    except ValueError:
        raise HTTPException(400, "UUID invalide.")

    att = crud.mark_attendance(db, sid, stid, body.status)
    if not att:
        raise HTTPException(500, "Erreur lors de la mise à jour.")

    return {
        "success":    True,
        "student_id": student_id,
        "session_id": session_id,
        "status":     att.status,
        "updated_at": str(att.detected_at),
    }


# ── Endpoint diagnostic ───────────────────────────────────────────────────────

@router.get("/debug-enrollments")
def debug_enrollments(
    db: Session = Depends(get_db),
    _user       = Depends(admin_or_prof),
):
    """
    Affiche le contenu de student_faces pour vérifier que les embeddings
    ont bien été recalculés après la dernière modification d'encoder.py.
    """
    from sqlalchemy import text as sqlt
    rows = db.execute(sqlt("""
        SELECT sf.id,
               s.nom,
               s.prenom,
               sf.det_score,
               sf.nb_images,
               sf.created_at
        FROM   student_faces sf
        JOIN   students s ON sf.student_id = s.id
        ORDER  BY sf.created_at DESC
    """)).fetchall()

    result = [
        {
            "id":         str(r.id),
            "nom":        r.nom,
            "prenom":     r.prenom,
            "det_score":  float(r.det_score) if r.det_score else None,
            "nb_images":  r.nb_images,
            "created_at": str(r.created_at),
        }
        for r in rows
    ]
    print(f"[DEBUG] {len(rows)} embedding(s) en base:")
    for r in result:
        print(f"  → {r['prenom']} {r['nom']}  created_at={r['created_at']}")
    return {"total": len(result), "embeddings": result}
