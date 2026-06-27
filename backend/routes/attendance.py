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

from typing import List
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth.dependencies import admin_or_prof, get_db
from db import crud
from db.models import Matiere, Session as SessionModel, Attendance, Student

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/attendance", tags=["Attendance"])

SIMILARITY_THRESHOLD  = 0.42   # seuil vidéo surveillance (angle plafond + HEVC)
SIMILARITY_MARGIN     = 0.10   # marge plus stricte pour compenser le seuil bas
SAMPLE_INTERVAL_SEC   = 5      # analyser 1 frame toutes les N secondes de vidéo
MAX_SAMPLED_FRAMES    = 120    # max frames analysées par vidéo (120 × 5s = 10 min couverts)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _bytes_to_bgr(data: bytes) -> np.ndarray:
    arr = np.frombuffer(data, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Image invalide ou format non supporté.")
    return img


def _process_frame(
    frame: np.ndarray,
    db: Session,
    seen: set,
) -> list[dict]:
    from ai.detector import detect_faces_classroom

    recognized = []
    faces = detect_faces_classroom(frame, min_face_size=20, min_score=0.35)
    print(f"[ATTENDANCE] {len(faces)} visage(s) détecté(s)")

    for i, face in enumerate(faces):
        match = crud.find_student_by_embedding(
            db,
            face["normed_embedding"],
            threshold=SIMILARITY_THRESHOLD,
            margin=SIMILARITY_MARGIN,
        )
        if match:
            print(f"[MATCH #{i}] RECONNU → {match['prenom']} {match['nom']}  sim={match['similarity']:.3f}")
            if match["student_id"] not in seen:
                recognized.append({
                    **match,
                    "bbox":       face["bbox"],
                    "confidence": face["confidence"],
                })
        # find_student_by_embedding loggue déjà le meilleur candidat rejeté avec sim=

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


def _scan_video_bytes(video_bytes: bytes, filename: str, db: Session,
                      seen: set, present_data: dict) -> tuple[int, int]:
    """
    Scanne une vidéo (bytes) et remplit seen + present_data partagés.
    Utilise cap.set(CAP_PROP_POS_MSEC) pour sauter directement aux bonnes frames
    sans lire séquentiellement toute la vidéo.
    Retourne (total_frames, sampled_frames).
    """
    suffix = os.path.splitext(filename or "video.mp4")[1] or ".mp4"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
        f.write(video_bytes)
        tmp_path = f.name

    total_frames = 0
    sampled      = 0
    try:
        cap = cv2.VideoCapture(tmp_path)
        if not cap.isOpened():
            raise ValueError(f"Impossible d'ouvrir la vidéo : {filename}")

        video_fps    = cap.get(cv2.CAP_PROP_FPS) or 25
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        # Nombre de frames à sauter entre chaque analyse
        skip_n = max(1, int(video_fps * SAMPLE_INTERVAL_SEC))

        while sampled < MAX_SAMPLED_FRAMES:
            # Avancer skip_n-1 frames sans décoder (grab = rapide, pas de décompression)
            skip_ok = True
            for _ in range(skip_n - 1):
                if not cap.grab():
                    skip_ok = False
                    break
            if not skip_ok:
                break

            ret, frame = cap.read()
            if not ret:
                break
            sampled += 1

            for r in _process_frame(frame, db, seen):
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

    return total_frames, sampled


@router.post("/analyze-video")
async def analyze_video(
    session_id: str             = Form(...),
    videos:     List[UploadFile] = File(...),
    db: Session                 = Depends(get_db),
    _user                       = Depends(admin_or_prof),
):
    """
    Analyse une ou plusieurs vidéos de classe pour la même séance.
    Toutes les vidéos sont fusionnées avant de marquer présents/absents :
    un étudiant présent dans n'importe quelle vidéo est marqué présent.
    """
    try:
        sid = uuid.UUID(session_id)
    except ValueError:
        raise HTTPException(400, "session_id invalide (UUID attendu).")

    session = crud.get_session_by_id(db, sid)
    if not session:
        raise HTTPException(404, f"Séance {session_id} introuvable.")

    # Lire tous les fichiers en mémoire avant de passer au thread
    videos_data = [(await v.read(), v.filename) for v in videos]

    def _process_all() -> dict:
        seen: set[str]            = set()
        present_data: dict[str, dict] = {}
        total_frames  = 0
        total_sampled = 0

        for video_bytes, filename in videos_data:
            tf, ts = _scan_video_bytes(video_bytes, filename, db, seen, present_data)
            total_frames  += tf
            total_sampled += ts

        return {
            "total_frames":   total_frames,
            "sampled_frames": total_sampled,
            "present_data":   present_data,
        }

    result = await run_in_threadpool(_process_all)

    # Marquer présences
    presences_marquees = []
    for sid_str, r in result["present_data"].items():
        crud.mark_attendance(db, sid, uuid.UUID(sid_str), "present",
                             confidence=r["similarity"])
        presences_marquees.append({
            "student_id": sid_str,
            "nom":        r["nom"],
            "prenom":     r["prenom"],
            "similarity": round(r["similarity"], 3),
        })

    # Marquer absents (une seule fois, après fusion de toutes les vidéos)
    roster      = crud.get_session_roster(db, sid)
    present_ids = set(result["present_data"].keys())
    absents_marques = []
    for s in roster:
        if str(s.id) not in present_ids:
            crud.mark_attendance(db, sid, s.id, "absent")
            absents_marques.append({"student_id": str(s.id), "nom": s.nom, "prenom": s.prenom})

    logger.info(
        "analyze-video séance=%s vidéos=%d frames=%d/%d présents=%d absents=%d",
        session_id, len(videos_data),
        result["sampled_frames"], result["total_frames"],
        len(presences_marquees), len(absents_marques),
    )

    return {
        "success":          True,
        "session_id":       session_id,
        "videos_analyzed":  len(videos_data),
        "total_frames":     result["total_frames"],
        "sampled_frames":   result["sampled_frames"],
        "students_present": len(presences_marquees),
        "students_absent":  len(absents_marques),
        "presences":        presences_marquees,
        "absences":         absents_marques,
    }


@router.post("/analyze-stream")
async def analyze_stream(
    session_id: str  = Form(...),
    stream_url: str  = Form(...),
    db: Session      = Depends(get_db),
    _user            = Depends(admin_or_prof),
):
    """
    Analyse un flux vidéo via URL (RTSP, HTTP, fichier réseau).
    Simule la connexion à une caméra de surveillance en temps réel.
    cv2.VideoCapture accepte rtsp://, http://, et les URLs de fichiers distants.
    """
    try:
        sid = uuid.UUID(session_id)
    except ValueError:
        raise HTTPException(400, "session_id invalide (UUID attendu).")

    session = crud.get_session_by_id(db, sid)
    if not session:
        raise HTTPException(404, f"Séance {session_id} introuvable.")

    def _process_stream() -> dict:
        import time as _time
        cap = cv2.VideoCapture(stream_url)
        if not cap.isOpened():
            raise ValueError(f"Impossible d'ouvrir le flux : {stream_url}")

        seen: set[str]          = set()
        present_data: dict[str, dict] = {}
        frame_idx               = 0
        sampled                 = 0
        last_analyzed           = 0.0

        try:
            while sampled < MAX_SAMPLED_FRAMES:
                ret, frame = cap.read()
                if not ret:
                    break
                frame_idx += 1
                now = _time.time()
                if now - last_analyzed < SAMPLE_INTERVAL_SEC:
                    continue
                last_analyzed = now
                sampled += 1
                recognized = _process_frame(frame, db, seen)
                for r in recognized:
                    sid_str = r["student_id"]
                    if sid_str not in seen:
                        seen.add(sid_str)
                        present_data[sid_str] = r
        finally:
            cap.release()

        return {"total_frames": frame_idx, "sampled_frames": sampled, "present_data": present_data}

    try:
        result = await run_in_threadpool(_process_stream)
    except ValueError as exc:
        raise HTTPException(400, str(exc))

    presences_marquees = []
    for sid_str, r in result["present_data"].items():
        crud.mark_attendance(db, sid, uuid.UUID(sid_str), "present", confidence=r["similarity"])
        presences_marquees.append({
            "student_id": sid_str,
            "nom":        r["nom"],
            "prenom":     r["prenom"],
            "similarity": round(r["similarity"], 3),
        })

    roster      = crud.get_session_roster(db, sid)
    present_ids = set(result["present_data"].keys())
    absents_marques = []
    for s in roster:
        if str(s.id) not in present_ids:
            crud.mark_attendance(db, sid, s.id, "absent")
            absents_marques.append({"student_id": str(s.id), "nom": s.nom, "prenom": s.prenom})

    logger.info(
        "analyze-stream séance=%s url=%s frames=%d/%d présents=%d absents=%d",
        session_id, stream_url, result["sampled_frames"], result["total_frames"],
        len(presences_marquees), len(absents_marques),
    )

    return {
        "success":          True,
        "session_id":       session_id,
        "stream_url":       stream_url,
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


@router.get("/diagnostic/{session_id}")
def diagnostic_session(
    session_id: str,
    db: Session = Depends(get_db),
    _user       = Depends(admin_or_prof),
):
    """
    Pour chaque étudiant du roster de la séance :
    - is_enrolled : a-t-il un embedding en base ?
    - nb_embeddings : combien d'angles enrôlés ?
    - det_score_avg : qualité moyenne de ses embeddings (0-1)
    - status : present/absent dans cette séance
    Permet de diagnostiquer pourquoi un étudiant n'est pas reconnu.
    """
    from sqlalchemy import text as sqlt

    try:
        sid = uuid.UUID(session_id)
    except ValueError:
        raise HTTPException(400, "session_id invalide.")

    session = crud.get_session_by_id(db, sid)
    if not session:
        raise HTTPException(404, "Séance introuvable.")

    roster = crud.get_session_roster(db, sid)

    rows = db.execute(sqlt("""
        SELECT sf.student_id::text,
               COUNT(*)            AS nb_emb,
               AVG(sf.det_score)   AS avg_score
        FROM   student_faces sf
        GROUP  BY sf.student_id
    """)).fetchall()
    emb_map = {r.student_id: {"nb": int(r.nb_emb), "avg": float(r.avg_score or 0)}
               for r in rows}

    att_map = {
        str(a.student_id): a.status
        for a in db.query(Attendance).filter(Attendance.session_id == sid).all()
    }

    result = []
    for s in sorted(roster, key=lambda x: (x.nom, x.prenom)):
        sid_str  = str(s.id)
        emb_info = emb_map.get(sid_str)
        result.append({
            "nom":           s.nom,
            "prenom":        s.prenom,
            "is_enrolled":   emb_info is not None,
            "nb_embeddings": emb_info["nb"]  if emb_info else 0,
            "qualite_moy":   round(emb_info["avg"], 3) if emb_info else None,
            "statut_seance": att_map.get(sid_str, "—"),
            "probleme":      (
                "NON ENRÔLÉ"      if not emb_info else
                "1 SEUL ANGLE"    if emb_info["nb"] < 2 else
                "QUALITÉ FAIBLE"  if emb_info["avg"] < 0.25 else
                "OK"
            ),
        })

    non_enrolles  = [r for r in result if not r["is_enrolled"]]
    peu_dangles   = [r for r in result if r["is_enrolled"] and r["nb_embeddings"] < 2]
    qualite_faible = [r for r in result if r["is_enrolled"] and r["qualite_moy"] and r["qualite_moy"] < 0.25]

    return {
        "session_id":        session_id,
        "classe":            session.classe,
        "total_roster":      len(roster),
        "non_enrolles":      len(non_enrolles),
        "peu_dangles":       len(peu_dangles),
        "qualite_faible":    len(qualite_faible),
        "etudiants":         result,
    }
