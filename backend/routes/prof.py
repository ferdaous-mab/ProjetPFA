from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from auth.dependencies import admin_or_prof, get_current_user, get_db
from auth.jwt_handler import hash_password, verify_password
from db.models import (
    Student, Attendance, Grade, Matiere,
    Session as SessionModel, Alert, User
)
from datetime import datetime, timezone, date

router = APIRouter()


class NoteCreate(BaseModel):
    student_id: str
    matiere_id: str
    note: float
    type: str = "controle"
    commentaire: Optional[str] = None


class NoteUpdate(BaseModel):
    note: Optional[float] = None
    type: Optional[str] = None
    commentaire: Optional[str] = None


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


@router.get("/prof/alertes-absences")
async def prof_alertes_absences(
    db: Session = Depends(get_db),
    user        = Depends(admin_or_prof)
):
    """Étudiants ayant > 3 absences dans une matière du professeur."""
    matieres = db.query(Matiere).filter(
        Matiere.professeur_id == user.id
    ).all()

    alertes = []
    for m in matieres:
        sessions = db.query(SessionModel).filter(
            SessionModel.matiere_id == m.id
        ).all()
        if not sessions:
            continue
        session_ids = [s.id for s in sessions]

        if m.classe:
            students = db.query(Student).filter(Student.classe == m.classe).all()
        elif m.annee_scolaire:
            students = db.query(Student).filter(Student.annee_scolaire == m.annee_scolaire).all()
        else:
            continue

        for s in students:
            abs_count = db.query(Attendance).filter(
                Attendance.student_id == s.id,
                Attendance.session_id.in_(session_ids),
                Attendance.status == "absent"
            ).count()
            if abs_count > 3:
                alertes.append({
                    "student_id": str(s.id),
                    "nom":        s.nom,
                    "prenom":     s.prenom,
                    "matiere":    m.nom,
                    "matiere_id": str(m.id),
                    "classe":     s.classe or m.annee_scolaire,
                    "absences":   abs_count,
                    "severity":   "high" if abs_count > 6 else "medium",
                })

    alertes.sort(key=lambda x: x["absences"], reverse=True)
    return alertes


@router.get("/prof/etudiants")
async def prof_etudiants(
    db: Session = Depends(get_db),
    user        = Depends(admin_or_prof)
):
    """Étudiants par matière du professeur, groupés par groupe (A/B/C/D)."""
    matieres = db.query(Matiere).filter(
        Matiere.professeur_id == user.id
    ).all()

    result = []
    for m in matieres:
        # Récupérer les étudiants selon classe ou annee_scolaire
        if m.classe:
            students = (
                db.query(Student)
                .filter(Student.classe == m.classe)
                .order_by(Student.nom)
                .all()
            )
        elif m.annee_scolaire:
            students = (
                db.query(Student)
                .filter(Student.annee_scolaire == m.annee_scolaire)
                .order_by(Student.classe, Student.nom)
                .all()
            )
        else:
            students = []

        # Sessions pour calcul absences
        sessions = db.query(SessionModel).filter(
            SessionModel.matiere_id == m.id
        ).all()
        session_ids = [s.id for s in sessions]

        # Grouper par classe réelle (A / B / C / D …)
        classe_map: dict = {}
        seen: set = set()
        for s in students:
            if str(s.id) in seen:
                continue
            seen.add(str(s.id))
            cls = s.classe or "?"
            if cls not in classe_map:
                classe_map[cls] = []
            abs_count = (
                db.query(Attendance).filter(
                    Attendance.student_id == s.id,
                    Attendance.session_id.in_(session_ids),
                    Attendance.status == "absent"
                ).count() if session_ids else 0
            )
            classe_map[cls].append({
                "id":       str(s.id),
                "nom":      s.nom,
                "prenom":   s.prenom,
                "email":    s.email,
                "absences": abs_count,
            })

        groupes = [
            {"classe": cls, "etudiants": etu_list}
            for cls, etu_list in sorted(classe_map.items())
        ]

        result.append({
            "matiere_id":     str(m.id),
            "matiere_nom":    m.nom,
            "matiere_code":   m.code,
            "annee_scolaire": m.annee_scolaire,
            "classe":         m.classe,
            "nb_etudiants":   len(seen),
            "groupes":        groupes,
        })

    return result


@router.get("/prof/notes")
async def prof_notes(
    matiere_id: Optional[str] = None,
    db: Session = Depends(get_db),
    user        = Depends(admin_or_prof)
):
    """Notes pour les matières du professeur."""
    matieres = db.query(Matiere).filter(
        Matiere.professeur_id == user.id
    ).all()
    matiere_ids = [m.id for m in matieres]

    if not matiere_ids:
        return []

    query = db.query(Grade).filter(Grade.matiere_id.in_(matiere_ids))
    if matiere_id:
        try:
            mid = UUID(matiere_id)
            query = query.filter(Grade.matiere_id == mid)
        except Exception:
            pass

    grades = query.order_by(Grade.created_at.desc()).all()
    result = []
    for g in grades:
        student = db.query(Student).filter(Student.id == g.student_id).first()
        matiere = db.query(Matiere).filter(Matiere.id == g.matiere_id).first()
        result.append({
            "id":          str(g.id),
            "student_id":  str(g.student_id),
            "nom":         student.nom    if student else "?",
            "prenom":      student.prenom if student else "?",
            "matiere_id":  str(g.matiere_id),
            "matiere_nom": matiere.nom    if matiere else "?",
            "note":        g.note,
            "type":        g.type,
            "date":        str(g.date),
            "commentaire": g.commentaire,
        })
    return result


@router.post("/prof/notes")
async def prof_add_note(
    req:  NoteCreate,
    db:   Session = Depends(get_db),
    user          = Depends(admin_or_prof)
):
    """Ajouter une note pour un étudiant dans une matière du professeur."""
    try:
        mid = UUID(req.matiere_id)
        sid = UUID(req.student_id)
    except Exception:
        raise HTTPException(status_code=400, detail="IDs invalides")

    matiere = db.query(Matiere).filter(
        Matiere.id == mid,
        Matiere.professeur_id == user.id
    ).first()
    if not matiere:
        raise HTTPException(status_code=403, detail="Matière non autorisée")

    if not (0 <= req.note <= 20):
        raise HTTPException(status_code=400, detail="La note doit être entre 0 et 20")

    grade = Grade(
        student_id  = sid,
        matiere_id  = mid,
        note        = req.note,
        type        = req.type,
        commentaire = req.commentaire,
    )
    db.add(grade)
    db.commit()
    db.refresh(grade)
    return {"success": True, "id": str(grade.id)}


@router.put("/prof/notes/{note_id}")
async def prof_update_note(
    note_id: str,
    req:     NoteUpdate,
    db:      Session = Depends(get_db),
    user             = Depends(admin_or_prof)
):
    """Modifier une note dans une matière du professeur."""
    try:
        nid = UUID(note_id)
    except Exception:
        raise HTTPException(status_code=400, detail="ID invalide")

    grade = db.query(Grade).filter(Grade.id == nid).first()
    if not grade:
        raise HTTPException(status_code=404, detail="Note introuvable")

    matiere = db.query(Matiere).filter(
        Matiere.id == grade.matiere_id,
        Matiere.professeur_id == user.id
    ).first()
    if not matiere:
        raise HTTPException(status_code=403, detail="Matière non autorisée")

    if req.note is not None:
        if not (0 <= req.note <= 20):
            raise HTTPException(status_code=400, detail="La note doit être entre 0 et 20")
        grade.note = req.note
    if req.type is not None:
        grade.type = req.type
    if req.commentaire is not None:
        grade.commentaire = req.commentaire

    db.commit()
    return {"success": True}


@router.delete("/prof/notes/{note_id}")
async def prof_delete_note(
    note_id: str,
    db:      Session = Depends(get_db),
    user             = Depends(admin_or_prof)
):
    """Supprimer une note dans une matière du professeur."""
    try:
        nid = UUID(note_id)
    except Exception:
        raise HTTPException(status_code=400, detail="ID invalide")

    grade = db.query(Grade).filter(Grade.id == nid).first()
    if not grade:
        raise HTTPException(status_code=404, detail="Note introuvable")

    matiere = db.query(Matiere).filter(
        Matiere.id == grade.matiere_id,
        Matiere.professeur_id == user.id
    ).first()
    if not matiere:
        raise HTTPException(status_code=403, detail="Matière non autorisée")

    db.delete(grade)
    db.commit()
    return {"success": True}