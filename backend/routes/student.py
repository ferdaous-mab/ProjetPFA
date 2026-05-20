import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from typing import Optional
from auth.dependencies import get_current_user, get_db
from db.models import Attendance, Grade, Matiere, Alert, StudentImage, Student, EmploiTemps
from db.crud import (
    get_student_primary_image, get_absence_count,
    get_attendance_rate, get_average_by_student,
    get_grades_by_student
)

logger = logging.getLogger(__name__)
router = APIRouter()


class StudentBenignUpdate(BaseModel):
    email:          Optional[str] = None
    telephone:      Optional[str] = None
    adresse:        Optional[str] = None
    ville:          Optional[str] = None
    date_naissance: Optional[str] = None
    lieu_naissance: Optional[str] = None
    sexe:           Optional[str] = None
    cin:            Optional[str] = None


def _resolve_student(db: Session, user) -> Optional[Student]:
    """Retrouve le Student lié à un User, par student_id ou par email en fallback."""
    if user.student_id:
        s = db.query(Student).filter(Student.id == user.student_id).first()
        if s:
            return s
    return db.query(Student).filter(
        func.lower(Student.email) == func.lower(user.email)
    ).first()


@router.get("/student/profile")
async def student_profile(
    db: Session = Depends(get_db),
    user        = Depends(get_current_user)
):
    if user.role != "etudiant":
        raise HTTPException(status_code=403, detail="Accès réservé aux étudiants")

    student = _resolve_student(db, user)

    if student:
        sid           = student.id
        primary_image = get_student_primary_image(db, sid)
        absences      = get_absence_count(db, sid)
        taux_presence = get_attendance_rate(db, sid)
        moyenne       = get_average_by_student(db, sid)
    else:
        logger.warning(f"[student/profile] compte orphelin user_id={user.id} email={user.email}")
        primary_image = None
        absences      = 0
        taux_presence = 0.0
        moyenne       = 0.0

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
        },
        "telephone":      student.telephone      if student else None,
        "adresse":        student.adresse        if student else None,
        "ville":          student.ville          if student else None,
        "date_naissance": str(student.date_naissance) if student and student.date_naissance else None,
        "lieu_naissance": student.lieu_naissance if student else None,
        "sexe":           student.sexe           if student else None,
        "cin":            student.cin            if student else None,
        "numero_carte":   student.numero_carte   if student else None,
        "classe":         student.classe         if student else None,
        "annee_scolaire": student.annee_scolaire if student else None,
        # Infos parents
        "nom_pere":       student.nom_pere       if student else None,
        "tel_pere":       student.tel_pere       if student else None,
        "nom_mere":       student.nom_mere       if student else None,
        "tel_mere":       student.tel_mere       if student else None,
        "email_parent":   student.email_parent   if student else None,
    }


@router.put("/student/profile")
async def update_student_benign(
    req: StudentBenignUpdate,
    db: Session = Depends(get_db),
    user        = Depends(get_current_user)
):
    if user.role != "etudiant":
        raise HTTPException(status_code=403, detail="Accès réservé aux étudiants")

    student = _resolve_student(db, user)
    if not student:
        raise HTTPException(status_code=404, detail="Profil étudiant introuvable — contactez l'administration")

    if req.email:
        student.email = req.email
        user.email    = req.email
    if req.telephone      is not None: student.telephone      = req.telephone
    if req.adresse        is not None: student.adresse        = req.adresse
    if req.ville          is not None: student.ville          = req.ville
    if req.lieu_naissance is not None: student.lieu_naissance = req.lieu_naissance
    if req.sexe           is not None: student.sexe           = req.sexe
    if req.cin            is not None: student.cin            = req.cin
    if req.date_naissance is not None:
        from datetime import date as dateclass
        try:
            student.date_naissance = dateclass.fromisoformat(req.date_naissance)
        except ValueError:
            pass

    db.commit()
    return {"success": True, "message": "Informations mises à jour"}


@router.get("/student/emploi-du-temps")
async def student_emploi_du_temps(
    db: Session = Depends(get_db),
    user        = Depends(get_current_user)
):
    """Emploi du temps hebdomadaire de la classe de l'étudiant."""
    if user.role != "etudiant":
        raise HTTPException(status_code=403, detail="Accès réservé aux étudiants")

    student = _resolve_student(db, user)
    if not student or not student.classe:
        return []

    slots = db.query(EmploiTemps).filter(
        EmploiTemps.classe == student.classe
    ).order_by(EmploiTemps.jour, EmploiTemps.heure_debut).all()

    JOURS_ORDER = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"]

    result = []
    for s in slots:
        matiere = db.query(Matiere).filter(Matiere.id == s.matiere_id).first()
        result.append({
            "id":          str(s.id),
            "jour":        s.jour,
            "jour_index":  JOURS_ORDER.index(s.jour) if s.jour in JOURS_ORDER else 99,
            "heure_debut": str(s.heure_debut),
            "heure_fin":   str(s.heure_fin),
            "salle":       s.salle,
            "matiere":     matiere.nom  if matiere else "Inconnu",
            "professeur":  matiere.professeur.prenom + " " + matiere.professeur.nom
                           if matiere and matiere.professeur else None,
        })

    return sorted(result, key=lambda x: (x["jour_index"], x["heure_debut"]))


@router.get("/student/absences")
async def student_absences(
    db: Session = Depends(get_db),
    user        = Depends(get_current_user)
):
    if user.role != "etudiant":
        raise HTTPException(status_code=403, detail="Accès réservé aux étudiants")

    student = _resolve_student(db, user)
    if not student:
        return []

    from db.models import Session as SessionModel
    atts = db.query(Attendance).filter(
        Attendance.student_id == student.id
    ).order_by(Attendance.created_at.desc()).all()

    result = []
    for a in atts:
        session = db.query(SessionModel).filter(SessionModel.id == a.session_id).first()
        matiere = db.query(Matiere).filter(Matiere.id == session.matiere_id).first() if session else None
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
    if user.role != "etudiant":
        raise HTTPException(status_code=403, detail="Accès réservé aux étudiants")

    student = _resolve_student(db, user)
    if not student:
        return {"notes": [], "moyenne": 0.0, "stats_par_matiere": []}

    grades = get_grades_by_student(db, student.id)

    # Notes détaillées avec commentaire
    notes_list = []
    matieres_seen = {}
    for g in grades:
        matiere = db.query(Matiere).filter(Matiere.id == g.matiere_id).first()
        nom_mat = matiere.nom if matiere else "Inconnu"
        coef    = matiere.coefficient if matiere else 1.0
        notes_list.append({
            "matiere":     nom_mat,
            "note":        g.note,
            "type":        g.type,
            "date":        str(g.date),
            "coefficient": coef,
            "commentaire": g.commentaire,
        })
        # Accumuler pour stats par matière
        if nom_mat not in matieres_seen:
            matieres_seen[nom_mat] = {"notes": [], "coef": coef}
        matieres_seen[nom_mat]["notes"].append(g.note)

    # Stats par matière : moyenne + nombre de notes
    stats_par_matiere = []
    for nom, data in matieres_seen.items():
        moy = round(sum(data["notes"]) / len(data["notes"]), 2)
        stats_par_matiere.append({
            "matiere":     nom,
            "moyenne":     moy,
            "nb_notes":    len(data["notes"]),
            "coefficient": data["coef"],
            "mention":     "Bien" if moy >= 14 else "Assez bien" if moy >= 12 else
                           "Passable" if moy >= 10 else "Insuffisant",
        })

    return {
        "notes":             notes_list,
        "moyenne":           get_average_by_student(db, student.id),
        "stats_par_matiere": sorted(stats_par_matiere, key=lambda x: x["moyenne"], reverse=True),
    }


@router.get("/student/alertes")
async def student_alertes(
    db: Session = Depends(get_db),
    user        = Depends(get_current_user)
):
    if user.role != "etudiant":
        raise HTTPException(status_code=403, detail="Accès réservé aux étudiants")

    student = _resolve_student(db, user)
    if not student:
        return []

    alerts = db.query(Alert).filter(
        Alert.student_id == student.id,
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


@router.put("/student/alertes/{alert_id}/lue")
async def marquer_alerte_lue(
    alert_id: str,
    db: Session = Depends(get_db),
    user        = Depends(get_current_user)
):
    """Marque une alerte comme lue."""
    if user.role != "etudiant":
        raise HTTPException(status_code=403, detail="Accès réservé aux étudiants")

    student = _resolve_student(db, user)
    if not student:
        raise HTTPException(status_code=404, detail="Profil introuvable")

    alert = db.query(Alert).filter(
        Alert.id         == alert_id,
        Alert.student_id == student.id,
    ).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alerte introuvable")

    alert.is_read = True
    db.commit()
    return {"success": True}
