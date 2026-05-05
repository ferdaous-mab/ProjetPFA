from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from auth.dependencies import get_current_user, get_db
from db.models import Attendance, Grade, Matiere, Alert, StudentImage
from db.crud import (
    get_student_primary_image, get_absence_count,
    get_attendance_rate, get_average_by_student,
    get_grades_by_student
)

router = APIRouter()


@router.get("/student/profile")
async def student_profile(
    db: Session = Depends(get_db),
    user        = Depends(get_current_user)
):
    """Profil complet de l'étudiant connecté."""
    if user.role != "etudiant" or not user.student_id:
        raise HTTPException(status_code=403, detail="Accès réservé aux étudiants")

    sid           = str(user.student_id)
    primary_image = get_student_primary_image(db, sid)
    absences      = get_absence_count(db, sid)
    taux_presence = get_attendance_rate(db, sid)
    moyenne       = get_average_by_student(db, sid)

    return {
        "id":            str(user.id),
        "nom":           user.nom,
        "prenom":        user.prenom,
        "email":         user.email,
        "photo_url":     primary_image.url if primary_image else None,
        "stats": {
            "absences":      absences,
            "taux_presence": taux_presence,
            "moyenne":       moyenne,
        }
    }


@router.get("/student/absences")
async def student_absences(
    db: Session = Depends(get_db),
    user        = Depends(get_current_user)
):
    """Historique des absences de l'étudiant."""
    if user.role != "etudiant" or not user.student_id:
        raise HTTPException(status_code=403, detail="Accès réservé aux étudiants")

    from db.models import Session as SessionModel
    sid  = user.student_id
    atts = db.query(Attendance).filter(
        Attendance.student_id == sid
    ).order_by(Attendance.created_at.desc()).all()

    result = []
    for a in atts:
        session = db.query(SessionModel).filter(
            SessionModel.id == a.session_id
        ).first()
        matiere = db.query(Matiere).filter(
            Matiere.id == session.matiere_id
        ).first() if session else None

        result.append({
            "date":    str(session.date) if session else None,
            "matiere": matiere.nom if matiere else "Inconnu",
            "status":  a.status,
            "heure":   str(session.heure_debut) if session and session.heure_debut else None,
        })

    return result


@router.get("/student/notes")
async def student_notes(
    db: Session = Depends(get_db),
    user        = Depends(get_current_user)
):
    """Notes de l'étudiant par matière."""
    if user.role != "etudiant" or not user.student_id:
        raise HTTPException(status_code=403, detail="Accès réservé aux étudiants")

    sid    = user.student_id
    grades = get_grades_by_student(db, sid)

    result = []
    for g in grades:
        matiere = db.query(Matiere).filter(Matiere.id == g.matiere_id).first()
        result.append({
            "matiere":     matiere.nom if matiere else "Inconnu",
            "note":        g.note,
            "type":        g.type,
            "date":        str(g.date),
            "coefficient": matiere.coefficient if matiere else 1.0,
        })

    return {
        "notes":   result,
        "moyenne": get_average_by_student(db, sid),
    }


@router.get("/student/alertes")
async def student_alertes(
    db: Session = Depends(get_db),
    user        = Depends(get_current_user)
):
    """Alertes destinées à l'étudiant."""
    if user.role != "etudiant" or not user.student_id:
        raise HTTPException(status_code=403, detail="Accès réservé aux étudiants")

    alerts = db.query(Alert).filter(
        Alert.student_id == user.student_id,
        Alert.target_role == "etudiant",
        Alert.is_read == False
    ).order_by(Alert.created_at.desc()).all()

    return [{
        "id":       str(a.id),
        "type":     a.type,
        "message":  a.message,
        "severity": a.severity,
        "date":     str(a.created_at),
    } for a in alerts]