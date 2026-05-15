from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from auth.dependencies import admin_or_prof, get_current_user, get_db
from auth.jwt_handler import hash_password, verify_password
from db.models import (
    Student, Attendance, Grade, Matiere,
    Session as SessionModel, Alert, User
)
from datetime import datetime, timezone, date

router = APIRouter()


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password:     str


@router.put("/prof/change-password")
async def change_password(
    req:  ChangePasswordRequest,
    db:   Session = Depends(get_db),
    user           = Depends(get_current_user)
):
    """Permet au professeur de changer son mot de passe."""
    if user.role not in ("professeur", "admin"):
        raise HTTPException(status_code=403, detail="Accès refusé")
    if not verify_password(req.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Mot de passe actuel incorrect")
    if len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail="Le nouveau mot de passe doit contenir au moins 6 caractères")
    db_user = db.query(User).filter(User.id == user.id).first()
    db_user.password_hash = hash_password(req.new_password)
    db.commit()
    return {"success": True, "message": "Mot de passe modifié avec succès"}


@router.get("/prof/overview")
async def prof_overview(
    db: Session  = Depends(get_db),
    user         = Depends(admin_or_prof)
):
    """Vue d'ensemble du professeur — ses matières + stats."""
    matieres = db.query(Matiere).filter(
        Matiere.professeur_id == user.id
    ).all()

    result = []
    for m in matieres:
        sessions = db.query(SessionModel).filter(
            SessionModel.matiere_id == m.id
        ).all()

        total = present = 0
        for s in sessions:
            t = db.query(Attendance).filter(Attendance.session_id == s.id).count()
            p = db.query(Attendance).filter(
                Attendance.session_id == s.id,
                Attendance.status == "present"
            ).count()
            total   += t
            present += p

        taux = round(present / total * 100, 1) if total > 0 else 0
        result.append({
            "matiere_id":    str(m.id),
            "nom":           m.nom,
            "code":          m.code,
            "classe":        m.classe,
            "annee_scolaire": m.annee_scolaire,
            "coefficient":   m.coefficient,
            "nb_sessions":   len(sessions),
            "taux_presence": taux,
        })

    return {
        "nb_matieres": len(matieres),
        "matieres":    result,
    }


@router.get("/prof/session-aujourd-hui")
async def session_aujourd_hui(
    db: Session = Depends(get_db),
    user        = Depends(admin_or_prof)
):
    """Présences de la session d'aujourd'hui."""
    today    = datetime.now(timezone.utc).date()
    matieres = db.query(Matiere).filter(
        Matiere.professeur_id == user.id
    ).all()

    sessions_today = []
    for m in matieres:
        sessions = db.query(SessionModel).filter(
            SessionModel.matiere_id == m.id,
            SessionModel.date == today
        ).all()
        for s in sessions:
            attendances = db.query(Attendance).filter(
                Attendance.session_id == s.id
            ).all()
            sessions_today.append({
                "session_id":    str(s.id),
                "matiere":       m.nom,
                "classe":        s.classe,
                "annee_scolaire": m.annee_scolaire,
                "heure_debut":   str(s.heure_debut) if s.heure_debut else None,
                "presents":      sum(1 for a in attendances if a.status == "present"),
                "absents":       sum(1 for a in attendances if a.status == "absent"),
                "retards":       sum(1 for a in attendances if a.status == "retard"),
                "total":         len(attendances),
            })

    return sessions_today


@router.get("/prof/etudiants-absents")
async def etudiants_absents(
    db: Session = Depends(get_db),
    user        = Depends(admin_or_prof)
):
    """Liste des étudiants absents avec leur historique."""
    matieres = db.query(Matiere).filter(
        Matiere.professeur_id == user.id
    ).all()

    absents = []
    seen    = set()

    for m in matieres:
        sessions = db.query(SessionModel).filter(
            SessionModel.matiere_id == m.id
        ).all()
        for s in sessions:
            atts = db.query(Attendance).filter(
                Attendance.session_id == s.id,
                Attendance.status == "absent"
            ).all()
            for a in atts:
                student = db.query(Student).filter(
                    Student.id == a.student_id
                ).first()
                if not student:
                    continue
                key = str(student.id)
                if key not in seen:
                    seen.add(key)
                    total_abs = db.query(Attendance).filter(
                        Attendance.student_id == student.id,
                        Attendance.status == "absent"
                    ).count()
                    absents.append({
                        "student_id":    key,
                        "nom":           student.nom,
                        "prenom":        student.prenom,
                        "classe":        student.classe,
                        "annee_scolaire": student.annee_scolaire,
                        "absences":      total_abs,
                    })

    absents.sort(key=lambda x: x["absences"], reverse=True)
    return absents


@router.get("/prof/alertes")
async def prof_alertes(
    db: Session = Depends(get_db),
    user        = Depends(admin_or_prof)
):
    """Alertes destinées au professeur."""
    alerts = db.query(Alert).filter(
        Alert.target_role == "professeur",
        Alert.is_read == False
    ).order_by(Alert.created_at.desc()).limit(10).all()

    return [{
        "id":       str(a.id),
        "type":     a.type,
        "message":  a.message,
        "severity": a.severity,
        "date":     str(a.created_at),
    } for a in alerts]