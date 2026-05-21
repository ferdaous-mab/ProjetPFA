from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from auth.dependencies import admin_only, get_db
from db.models import (
    Student, Attendance, Grade,
    Matiere, Session as SessionModel, Alert, User
)
from db.crud import get_absence_count, get_average_by_student
from datetime import datetime, timezone, timedelta
import anthropic
import os
import json as json_lib

router = APIRouter()


def _students(db, classe=None, annee_scolaire=None):
    """Retourne les étudiants filtrés par classe et/ou année scolaire."""
    q = db.query(Student)
    if classe:         q = q.filter(Student.classe == classe)
    if annee_scolaire: q = q.filter(Student.annee_scolaire == annee_scolaire)
    return q.all()


def _student_ids(db, classe=None, annee_scolaire=None):
    return [s.id for s in _students(db, classe, annee_scolaire)]


@router.get("/bi/overview")
async def get_overview(
    classe:         Optional[str] = None,
    annee_scolaire: Optional[str] = None,
    db: Session = Depends(get_db),
    _=Depends(admin_only)
):
    students = _students(db, classe, annee_scolaire)
    ids      = [s.id for s in students]
    enrolled = sum(1 for s in students if s.is_enrolled)

    sess_q = db.query(SessionModel)
    mat_q  = db.query(Matiere)
    if classe:
        sess_q = sess_q.filter(SessionModel.classe == classe)
        mat_q  = mat_q.filter(Matiere.classe == classe)

    if ids:
        total_att = db.query(Attendance).filter(Attendance.student_id.in_(ids)).count()
        present   = db.query(Attendance).filter(
            Attendance.student_id.in_(ids), Attendance.status == "present"
        ).count()
    else:
        total_att = present = 0

    taux_global = round((present / total_att * 100), 1) if total_att > 0 else 0

    return {
        "total_etudiants":      len(students),
        "enrolles":             enrolled,
        "non_enrolles":         len(students) - enrolled,
        "total_sessions":       sess_q.count(),
        "total_matieres":       mat_q.count(),
        "total_profs":          db.query(User).filter(User.role == "professeur", User.is_active == True).count(),
        "alertes_non_lues":     db.query(Alert).filter(Alert.is_read == False).count(),
        "taux_presence_global": taux_global,
    }


@router.get("/bi/presence-par-classe")
async def presence_par_classe(
    classe:         Optional[str] = None,
    annee_scolaire: Optional[str] = None,
    db: Session = Depends(get_db),
    _=Depends(admin_only)
):
    if classe:
        classes_to_query = [classe]
    else:
        q_cl = db.query(Student.classe).distinct()
        if annee_scolaire:
            q_cl = q_cl.filter(Student.annee_scolaire == annee_scolaire)
        classes_to_query = sorted([c[0] for c in q_cl.all() if c[0]])

    result = []
    for cl in classes_to_query:
        q = db.query(Student).filter(Student.classe == cl)
        if annee_scolaire:
            q = q.filter(Student.annee_scolaire == annee_scolaire)
        students = q.all()
        if not students:
            continue

        ids           = [s.id for s in students]
        total_att     = db.query(Attendance).filter(Attendance.student_id.in_(ids)).count()
        total_present = db.query(Attendance).filter(
            Attendance.student_id.in_(ids), Attendance.status == "present"
        ).count()

        taux = round((total_present / total_att * 100), 1) if total_att > 0 else 0
        result.append({
            "classe":        cl,
            "taux_presence": taux,
            "nb_etudiants":  len(students),
        })

    return result


@router.get("/bi/presence-par-matiere")
async def presence_par_matiere(
    classe:         Optional[str] = None,
    annee_scolaire: Optional[str] = None,
    db: Session = Depends(get_db),
    _=Depends(admin_only)
):
    mat_q = db.query(Matiere)
    if classe: mat_q = mat_q.filter(Matiere.classe == classe)
    matieres = mat_q.all()

    student_ids_scope = set(_student_ids(db, classe, annee_scolaire))
    result = []

    for m in matieres:
        sessions     = db.query(SessionModel).filter(SessionModel.matiere_id == m.id).all()
        total_att    = total_present = 0
        for s in sessions:
            att_q = db.query(Attendance).filter(Attendance.session_id == s.id)
            if student_ids_scope:
                att_q = att_q.filter(Attendance.student_id.in_(student_ids_scope))
            att     = att_q.count()
            present = att_q.filter(Attendance.status == "present").count()
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
    classe:         Optional[str] = None,
    annee_scolaire: Optional[str] = None,
    db: Session = Depends(get_db),
    _=Depends(admin_only)
):
    student_ids_scope = set(_student_ids(db, classe, annee_scolaire))
    result = []
    today  = datetime.now(timezone.utc).date()

    for i in range(29, -1, -1):
        day      = today - timedelta(days=i)
        sess_q   = db.query(SessionModel).filter(SessionModel.date == day)
        if classe: sess_q = sess_q.filter(SessionModel.classe == classe)
        sessions = sess_q.all()

        total = present = 0
        for s in sessions:
            att_q = db.query(Attendance).filter(Attendance.session_id == s.id)
            if student_ids_scope:
                att_q = att_q.filter(Attendance.student_id.in_(student_ids_scope))
            t = att_q.count()
            p = att_q.filter(Attendance.status == "present").count()
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
    classe:         Optional[str] = None,
    annee_scolaire: Optional[str] = None,
    db: Session = Depends(get_db),
    _=Depends(admin_only)
):
    ids = _student_ids(db, classe, annee_scolaire)
    if not ids:
        return {"present":0,"absent":0,"retard":0,"total":0,
                "pct_present":0,"pct_absent":0,"pct_retard":0}

    att_q   = db.query(Attendance).filter(Attendance.student_id.in_(ids))
    present = att_q.filter(Attendance.status == "present").count()
    absent  = att_q.filter(Attendance.status == "absent").count()
    retard  = att_q.filter(Attendance.status == "retard").count()
    total   = present + absent + retard

    return {
        "present": present, "absent": absent, "retard": retard, "total": total,
        "pct_present": round(present / total * 100, 1) if total else 0,
        "pct_absent":  round(absent  / total * 100, 1) if total else 0,
        "pct_retard":  round(retard  / total * 100, 1) if total else 0,
    }


@router.get("/bi/etudiants-a-risque")
async def etudiants_a_risque(
    classe:           Optional[str] = None,
    annee_scolaire:   Optional[str] = None,
    absence_threshold: int   = 3,
    grade_threshold:   float = 10.0,
    db: Session = Depends(get_db),
    _=Depends(admin_only)
):
    students = _students(db, classe, annee_scolaire)
    students = [s for s in students if s.is_enrolled]
    at_risk  = []

    for s in students:
        absences = get_absence_count(db, s.id)
        average  = get_average_by_student(db, s.id)
        reasons  = []
        if absences > absence_threshold:
            reasons.append(f"{absences} absences")
        if average < grade_threshold and average > 0:
            reasons.append(f"moyenne {average}/20")
        if reasons:
            at_risk.append({
                "student_id":     str(s.id),
                "nom":            s.nom,
                "prenom":         s.prenom,
                "classe":         s.classe,
                "annee_scolaire": s.annee_scolaire,
                "absences":       absences,
                "moyenne":        average,
                "raisons":        reasons,
            })

    return sorted(at_risk, key=lambda x: x["absences"], reverse=True)


@router.get("/bi/top-absences")
async def top_absences(
    classe:         Optional[str] = None,
    annee_scolaire: Optional[str] = None,
    db: Session = Depends(get_db),
    _=Depends(admin_only)
):
    students = _students(db, classe, annee_scolaire)
    students = [s for s in students if s.is_enrolled]
    data     = []

    for s in students:
        absences = db.query(Attendance).filter(
            Attendance.student_id == s.id, Attendance.status == "absent"
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
    classe:         Optional[str] = None,
    annee_scolaire: Optional[str] = None,
    db: Session = Depends(get_db),
    _=Depends(admin_only)
):
    mat_q = db.query(Matiere)
    if classe: mat_q = mat_q.filter(Matiere.classe == classe)
    matieres = mat_q.all()

    ids    = set(_student_ids(db, classe, annee_scolaire))
    result = []

    for m in matieres:
        grade_q = db.query(Grade).filter(Grade.matiere_id == m.id)
        if ids: grade_q = grade_q.filter(Grade.student_id.in_(ids))
        grades = grade_q.all()
        if not grades:
            continue
        moyenne = round(sum(g.note for g in grades) / len(grades), 2)
        result.append({
            "matiere":  m.nom,
            "code":     m.code,
            "moyenne":  moyenne,
            "nb_notes": len(grades),
        })

    return result


@router.get("/bi/filtres")
async def get_filtres(
    db: Session = Depends(get_db),
    _=Depends(admin_only)
):
    """Options de filtrage dynamiques — léger, appelé une seule fois au démarrage."""
    from sqlalchemy import distinct as sa_distinct
    groupes = sorted({r[0] for r in db.query(Student.annee_scolaire).distinct().all() if r[0]})
    classes = sorted({r[0] for r in db.query(Student.classe).distinct().all() if r[0]})
    # Associer chaque classe à son(ses) groupe(s)
    classe_groupes: dict = {}
    for s in db.query(Student.classe, Student.annee_scolaire).distinct().all():
        cl, gr = s[0], s[1]
        if cl and gr:
            classe_groupes.setdefault(cl, [])
            if gr not in classe_groupes[cl]:
                classe_groupes[cl].append(gr)
    return {"groupes": groupes, "classes": classes, "classe_groupes": classe_groupes}


@router.get("/bi/alertes-recentes")
async def alertes_recentes(
    classe:         Optional[str] = None,
    annee_scolaire: Optional[str] = None,
    db: Session = Depends(get_db),
    _=Depends(admin_only)
):
    ids = set(_student_ids(db, classe, annee_scolaire))

    q = db.query(Alert).filter(
        Alert.target_role == "admin",
        Alert.is_read == False
    )
    if ids: q = q.filter(Alert.student_id.in_(ids))

    alerts = q.order_by(Alert.created_at.desc()).limit(10).all()
    return [{
        "id":         str(a.id),
        "type":       a.type,
        "message":    a.message,
        "severity":   a.severity,
        "created_at": str(a.created_at),
        "student_id": str(a.student_id),
    } for a in alerts]


@router.get("/bi/prediction-risque")
async def prediction_risque(
    classe:         Optional[str] = None,
    annee_scolaire: Optional[str] = None,
    db: Session = Depends(get_db),
    _=Depends(admin_only)
):
    students = _students(db, classe, annee_scolaire)
    today   = datetime.now(timezone.utc).date()
    cutoff  = today - timedelta(days=14)

    results = []
    for s in students:
        total_att   = db.query(Attendance).filter(Attendance.student_id == s.id).count()
        nb_absences = db.query(Attendance).filter(
            Attendance.student_id == s.id, Attendance.status == "absent"
        ).count()
        taux_absence = round(nb_absences / total_att * 100, 1) if total_att > 0 else 0

        # Tendance sur les 14 derniers jours
        recent_sess_ids = [
            sess.id for sess in db.query(SessionModel).filter(
                SessionModel.classe == s.classe, SessionModel.date >= cutoff
            ).all()
        ]
        if recent_sess_ids:
            r_total = db.query(Attendance).filter(
                Attendance.student_id == s.id,
                Attendance.session_id.in_(recent_sess_ids)
            ).count()
            r_abs = db.query(Attendance).filter(
                Attendance.student_id == s.id,
                Attendance.session_id.in_(recent_sess_ids),
                Attendance.status == "absent"
            ).count()
            r_taux = round(r_abs / r_total * 100, 1) if r_total > 0 else taux_absence
            if r_taux > taux_absence * 1.25:
                tendance = "en hausse"
            elif r_taux < taux_absence * 0.75:
                tendance = "en amélioration"
            else:
                tendance = "stable"
        else:
            tendance = "stable"

        moyenne    = get_average_by_student(db, s.id)
        has_grades = db.query(Grade).filter(Grade.student_id == s.id).count() > 0

        # Score de risque (0-100)
        absence_score = (0.6 * min(nb_absences / 8.0, 1.0) + 0.4 * taux_absence / 100.0) * 100
        grade_score   = max(0, (10 - moyenne) / 10.0 * 100) if has_grades and moyenne > 0 else 0
        trend_score   = {"en hausse": 80, "stable": 30, "en amélioration": 0}.get(tendance, 30)
        score         = round(min(100, max(0, 0.45 * absence_score + 0.40 * grade_score + 0.15 * trend_score)), 1)

        if score >= 70:   niveau = "critique"
        elif score >= 45: niveau = "élevé"
        elif score >= 20: niveau = "modéré"
        else:             niveau = "faible"

        results.append({
            "student_id": str(s.id),
            "nom": s.nom, "prenom": s.prenom,
            "classe": s.classe, "annee_scolaire": s.annee_scolaire,
            "score_risque": score, "niveau_risque": niveau,
            "nb_absences": nb_absences, "taux_absence": taux_absence,
            "moyenne": moyenne, "tendance": tendance,
            "analyse_ia": None, "recommandations_ia": [],
        })

    results.sort(key=lambda x: x["score_risque"], reverse=True)

    # Analyse Claude pour les étudiants à risque modéré ou plus
    at_risk = [r for r in results if r["score_risque"] >= 20][:6]
    if at_risk:
        try:
            api_key = os.getenv("ANTHROPIC_API_KEY", "")
            if api_key:
                client = anthropic.Anthropic(api_key=api_key)
                students_list = "\n".join([
                    f"- {r['prenom']} {r['nom']} | Classe {r['classe']} {r['annee_scolaire']} | "
                    f"Score={r['score_risque']}/100 ({r['niveau_risque']}) | "
                    f"Absences={r['nb_absences']} ({r['taux_absence']}%) | "
                    f"Moyenne={r['moyenne']}/20 | Tendance={r['tendance']}"
                    for r in at_risk
                ])
                prompt = (
                    "Tu es un conseiller pédagogique dans un établissement supérieur marocain.\n"
                    "Analyse ces profils étudiants à risque et génère des recommandations personnalisées en français.\n\n"
                    f"{students_list}\n\n"
                    "Réponds UNIQUEMENT avec ce JSON (pas de texte avant/après) :\n"
                    '{\n  "etudiants": [\n    {\n'
                    '      "nom_complet": "Prénom Nom",\n'
                    '      "analyse": "Analyse concise du profil en 1-2 phrases.",\n'
                    '      "recommandations": ["Action concrète 1", "Action concrète 2"]\n'
                    "    }\n  ]\n}"
                )
                response = client.messages.create(
                    model="claude-haiku-4-5-20251001",
                    max_tokens=1400,
                    messages=[{"role": "user", "content": prompt}]
                )
                raw   = response.content[0].text
                start = raw.find("{"); end = raw.rfind("}") + 1
                if start != -1 and end > start:
                    ia_data  = json_lib.loads(raw[start:end])
                    name_map = {f"{r['prenom']} {r['nom']}".lower(): r for r in results}
                    for entry in ia_data.get("etudiants", []):
                        key = entry.get("nom_complet", "").lower()
                        if key in name_map:
                            name_map[key]["analyse_ia"]         = entry.get("analyse", "")
                            name_map[key]["recommandations_ia"] = entry.get("recommandations", [])
        except Exception:
            pass

    stats = {
        "critique": sum(1 for r in results if r["niveau_risque"] == "critique"),
        "eleve":    sum(1 for r in results if r["niveau_risque"] == "élevé"),
        "modere":   sum(1 for r in results if r["niveau_risque"] == "modéré"),
        "faible":   sum(1 for r in results if r["niveau_risque"] == "faible"),
        "total":    len(results),
    }
    return {"etudiants": results, "stats": stats}
