from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from auth.dependencies import admin_only, get_db
from db.models import (
    Student, StudentFace, Attendance, Grade,
    Matiere, Session as SessionModel, Alert, User
)
from db.crud import get_students_at_risk
from datetime import datetime, timezone, timedelta

router = APIRouter()


@router.get("/bi/overview")
async def get_overview(
    db: Session = Depends(get_db),
    _=Depends(admin_only)
):
    """
    Vue d'ensemble de la plateforme pour l'admin.
    Retourne les chiffres clés.
    """
    total_students  = db.query(Student).count()
    enrolled        = db.query(Student).filter(Student.is_enrolled == True).count()
    total_sessions  = db.query(SessionModel).count()
    total_matieres  = db.query(Matiere).count()
    total_profs     = db.query(User).filter(User.role == "professeur", User.is_active == True).count()
    total_alerts    = db.query(Alert).filter(Alert.is_read == False).count()

    # Taux de présence global
    total_att = db.query(Attendance).count()
    present   = db.query(Attendance).filter(Attendance.status == "present").count()
    taux_global = round((present / total_att * 100), 1) if total_att > 0 else 0

    return {
        "total_etudiants":  total_students,
        "enrolles":         enrolled,
        "non_enrolles":     total_students - enrolled,
        "total_sessions":   total_sessions,
        "total_matieres":   total_matieres,
        "total_profs":      total_profs,
        "alertes_non_lues": total_alerts,
        "taux_presence_global": taux_global,
    }


@router.get("/bi/presence-par-classe")
async def presence_par_classe(
    db: Session = Depends(get_db),
    _=Depends(admin_only)
):
    """Taux de présence moyen par classe — pour graphique barres."""
    classes = ["1A", "1B", "1C", "2A", "2B", "2C", "3A", "3B", "3C"]
    result  = []

    for classe in classes:
        students = db.query(Student).filter(Student.classe == classe).all()
        if not students:
            continue

        student_ids   = [s.id for s in students]
        total_att     = db.query(Attendance).filter(
            Attendance.student_id.in_(student_ids)
        ).count()
        total_present = db.query(Attendance).filter(
            Attendance.student_id.in_(student_ids),
            Attendance.status == "present"
        ).count()

        taux = round((total_present / total_att * 100), 1) if total_att > 0 else 0
        result.append({
            "classe":        classe,
            "taux_presence": taux,
            "nb_etudiants":  len(students),
        })

    return result


@router.get("/bi/presence-par-matiere")
async def presence_par_matiere(
    db: Session = Depends(get_db),
    _=Depends(admin_only)
):
    """Taux de présence par matière — pour graphique barres horizontales."""
    matieres = db.query(Matiere).all()
    result   = []

    for m in matieres:
        sessions = db.query(SessionModel).filter(
            SessionModel.matiere_id == m.id
        ).all()

        total_att = total_present = 0
        for s in sessions:
            att     = db.query(Attendance).filter(Attendance.session_id == s.id).count()
            present = db.query(Attendance).filter(
                Attendance.session_id == s.id,
                Attendance.status == "present"
            ).count()
            total_att     += att
            total_present += present

        taux = round((total_present / total_att * 100), 1) if total_att > 0 else 0
        result.append({
            "matiere":       m.nom,
            "code":          m.code,
            "taux_presence": taux,
            "nb_sessions":   len(sessions),
        })

    return result


@router.get("/bi/evolution-presences")
async def evolution_presences(
    db: Session = Depends(get_db),
    _=Depends(admin_only)
):
    """
    Évolution du taux de présence sur les 30 derniers jours.
    Pour graphique courbe.
    """
    result = []
    today  = datetime.now(timezone.utc).date()

    for i in range(29, -1, -1):
        day      = today - timedelta(days=i)
        sessions = db.query(SessionModel).filter(SessionModel.date == day).all()

        total = present = 0
        for s in sessions:
            t = db.query(Attendance).filter(Attendance.session_id == s.id).count()
            p = db.query(Attendance).filter(
                Attendance.session_id == s.id,
                Attendance.status == "present"
            ).count()
            total   += t
            present += p

        taux = round((present / total * 100), 1) if total > 0 else None
        result.append({
            "date":          str(day),
            "taux_presence": taux,
            "nb_sessions":   len(sessions),
        })

    return result


@router.get("/bi/repartition-statuts")
async def repartition_statuts(
    db: Session = Depends(get_db),
    _=Depends(admin_only)
):
    """Répartition présent/absent/retard — pour graphique camembert."""
    present = db.query(Attendance).filter(Attendance.status == "present").count()
    absent  = db.query(Attendance).filter(Attendance.status == "absent").count()
    retard  = db.query(Attendance).filter(Attendance.status == "retard").count()
    total   = present + absent + retard

    return {
        "present": present,
        "absent":  absent,
        "retard":  retard,
        "total":   total,
        "pct_present": round(present / total * 100, 1) if total else 0,
        "pct_absent":  round(absent  / total * 100, 1) if total else 0,
        "pct_retard":  round(retard  / total * 100, 1) if total else 0,
    }


@router.get("/bi/etudiants-a-risque")
async def etudiants_a_risque(
    db: Session = Depends(get_db),
    _=Depends(admin_only)
):
    """Liste des étudiants à risque (absences > 3 ou moyenne < 10)."""
    return get_students_at_risk(db, absence_threshold=3, grade_threshold=10.0)


@router.get("/bi/top-absences")
async def top_absences(
    db: Session = Depends(get_db),
    _=Depends(admin_only)
):
    """Top 10 étudiants avec le plus d'absences."""
    students = db.query(Student).filter(Student.is_enrolled == True).all()
    data     = []

    for s in students:
        absences = db.query(Attendance).filter(
            Attendance.student_id == s.id,
            Attendance.status == "absent"
        ).count()
        total = db.query(Attendance).filter(Attendance.student_id == s.id).count()
        taux  = round((absences / total * 100), 1) if total > 0 else 0

        data.append({
            "student_id":    str(s.id),
            "nom":           s.nom,
            "prenom":        s.prenom,
            "classe":        s.classe,
            "annee_scolaire": s.annee_scolaire,
            "absences":      absences,
            "taux_absence":  taux,
        })

    data.sort(key=lambda x: x["absences"], reverse=True)
    return data[:10]


@router.get("/bi/notes-par-matiere")
async def notes_par_matiere(
    db: Session = Depends(get_db),
    _=Depends(admin_only)
):
    """Moyenne des notes par matière — pour graphique barres."""
    matieres = db.query(Matiere).all()
    result   = []

    for m in matieres:
        grades = db.query(Grade).filter(Grade.matiere_id == m.id).all()
        if not grades:
            continue
        moyenne = round(sum(g.note for g in grades) / len(grades), 2)
        result.append({
            "matiere": m.nom,
            "code":    m.code,
            "moyenne": moyenne,
            "nb_notes": len(grades),
        })

    return result


@router.get("/bi/alertes-recentes")
async def alertes_recentes(
    db: Session = Depends(get_db),
    _=Depends(admin_only)
):
    """10 dernières alertes non lues."""
    alerts = db.query(Alert).filter(
        Alert.target_role == "admin",
        Alert.is_read == False
    ).order_by(Alert.created_at.desc()).limit(10).all()

    return [{
        "id":         str(a.id),
        "type":       a.type,
        "message":    a.message,
        "severity":   a.severity,
        "created_at": str(a.created_at),
        "student_id": str(a.student_id),
    } for a in alerts]