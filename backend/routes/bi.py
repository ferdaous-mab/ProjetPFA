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
import time

router = APIRouter()

# ── Cache mémoire TTL ─────────────────────────────────────────────────────────
_cache: dict = {}
_CACHE_TTL         = 60   # secondes — endpoints BI classiques
_CACHE_TTL_PREDICT = 300  # 5 min — prediction IA (appel Claude coûteux)

def _cache_get(key: str, ttl: int = _CACHE_TTL):
    entry = _cache.get(key)
    if entry and time.time() - entry["ts"] < ttl:
        return entry["val"]
    return None

def _cache_set(key: str, val):
    _cache[key] = {"val": val, "ts": time.time()}

def _cache_clear():
    _cache.clear()


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
    ck = f"overview|{classe}|{annee_scolaire}"
    cached = _cache_get(ck)
    if cached:
        return cached

    # Compter directement en SQL (plus rapide que charger toutes les lignes)
    q = db.query(Student)
    if classe:         q = q.filter(Student.classe == classe)
    if annee_scolaire: q = q.filter(Student.annee_scolaire == annee_scolaire)
    total_etudiants = q.count()
    enrolled = q.filter(Student.is_enrolled == True).count()

    ids = [r[0] for r in q.with_entities(Student.id).all()] if (classe or annee_scolaire) else None

    sess_q = db.query(SessionModel)
    mat_q  = db.query(Matiere)
    if classe:
        sess_q = sess_q.filter(SessionModel.classe == classe)
        mat_q  = mat_q.filter(Matiere.classe == classe)

    att_q = db.query(Attendance)
    if ids is not None:
        att_q = att_q.filter(Attendance.student_id.in_(ids))

    total_att = att_q.count()
    present   = att_q.filter(Attendance.status == "present").count()
    taux_global = round((present / total_att * 100), 1) if total_att > 0 else 0

    result = {
        "total_etudiants":      total_etudiants,
        "enrolles":             enrolled,
        "non_enrolles":         total_etudiants - enrolled,
        "total_sessions":       sess_q.count(),
        "total_matieres":       mat_q.count(),
        "total_profs":          db.query(User).filter(User.role == "professeur", User.is_active == True).count(),
        "alertes_non_lues":     db.query(Alert).filter(Alert.is_read == False).count(),
        "taux_presence_global": taux_global,
    }
    _cache_set(ck, result)
    return result


@router.get("/bi/presence-par-classe")
async def presence_par_classe(
    classe:         Optional[str] = None,
    annee_scolaire: Optional[str] = None,
    db: Session = Depends(get_db),
    _=Depends(admin_only)
):
    ck = f"pres_classe|{classe}|{annee_scolaire}"
    cached = _cache_get(ck)
    if cached: return cached

    if classe:
        classes_to_query = [classe]
    else:
        q_cl = db.query(Student.classe).distinct()
        if annee_scolaire:
            q_cl = q_cl.filter(Student.annee_scolaire == annee_scolaire)
        classes_to_query = sorted([c[0] for c in q_cl.all() if c[0]])

    result = []
    for cl in classes_to_query:
        q = db.query(Student.id).filter(Student.classe == cl)
        if annee_scolaire:
            q = q.filter(Student.annee_scolaire == annee_scolaire)
        ids = [r[0] for r in q.all()]
        if not ids: continue

        total_att     = db.query(Attendance).filter(Attendance.student_id.in_(ids)).count()
        total_present = db.query(Attendance).filter(
            Attendance.student_id.in_(ids), Attendance.status == "present"
        ).count()
        taux = round((total_present / total_att * 100), 1) if total_att > 0 else 0
        result.append({"classe": cl, "taux_presence": taux, "nb_etudiants": len(ids)})

    _cache_set(ck, result)
    return result


@router.get("/bi/presence-par-matiere")
async def presence_par_matiere(
    classe:         Optional[str] = None,
    annee_scolaire: Optional[str] = None,
    db: Session = Depends(get_db),
    _=Depends(admin_only)
):
    ck = f"pres_mat|{classe}|{annee_scolaire}"
    cached = _cache_get(ck)
    if cached: return cached

    from sqlalchemy import case
    mat_q = db.query(Matiere)
    if classe: mat_q = mat_q.filter(Matiere.classe == classe)
    matieres = mat_q.all()

    student_ids_scope = set(_student_ids(db, classe, annee_scolaire)) if (classe or annee_scolaire) else None
    result = []

    for m in matieres:
        sess_ids = [r[0] for r in db.query(SessionModel.id).filter(SessionModel.matiere_id == m.id).all()]
        if not sess_ids:
            result.append({"matiere": m.nom, "code": m.code, "taux_presence": 0, "nb_sessions": 0})
            continue

        att_q = db.query(Attendance).filter(Attendance.session_id.in_(sess_ids))
        if student_ids_scope:
            att_q = att_q.filter(Attendance.student_id.in_(student_ids_scope))
        total_att     = att_q.count()
        total_present = att_q.filter(Attendance.status == "present").count()
        taux = round((total_present / total_att * 100), 1) if total_att > 0 else 0
        result.append({"matiere": m.nom, "code": m.code, "taux_presence": taux, "nb_sessions": len(sess_ids)})

    _cache_set(ck, result)
    return result


@router.get("/bi/evolution-presences")
async def evolution_presences(
    classe:         Optional[str] = None,
    annee_scolaire: Optional[str] = None,
    db: Session = Depends(get_db),
    _=Depends(admin_only)
):
    ck = f"evolution|{classe}|{annee_scolaire}"
    cached = _cache_get(ck)
    if cached: return cached

    from sqlalchemy import case as sa_case
    student_ids_scope = set(_student_ids(db, classe, annee_scolaire)) if (classe or annee_scolaire) else None
    today = datetime.now(timezone.utc).date()
    since = today - timedelta(days=29)

    # Une seule requête pour toutes les sessions des 30 derniers jours
    sess_q = db.query(SessionModel).filter(SessionModel.date >= since, SessionModel.date <= today)
    if classe: sess_q = sess_q.filter(SessionModel.classe == classe)
    sessions = sess_q.all()

    # Indexer par date
    from collections import defaultdict
    sess_by_date = defaultdict(list)
    for s in sessions:
        sess_by_date[s.date].append(s.id)

    # Charger toutes les attendances d'un coup
    all_sess_ids = [s.id for s in sessions]
    att_data = {}
    if all_sess_ids:
        rows = db.query(Attendance.session_id, Attendance.status).filter(
            Attendance.session_id.in_(all_sess_ids),
            *([Attendance.student_id.in_(student_ids_scope)] if student_ids_scope else [])
        ).all()
        for sid, status in rows:
            if sid not in att_data:
                att_data[sid] = {"total": 0, "present": 0}
            att_data[sid]["total"] += 1
            if status == "present":
                att_data[sid]["present"] += 1

    result = []
    for i in range(29, -1, -1):
        day = today - timedelta(days=i)
        sess_ids = sess_by_date.get(day, [])
        total = present = 0
        for sid in sess_ids:
            d = att_data.get(sid, {})
            total   += d.get("total", 0)
            present += d.get("present", 0)
        taux = round((present / total * 100), 1) if total > 0 else None
        result.append({"date": str(day), "taux_presence": taux, "nb_sessions": len(sess_ids)})

    _cache_set(ck, result)
    return result


@router.get("/bi/repartition-statuts")
async def repartition_statuts(
    classe:         Optional[str] = None,
    annee_scolaire: Optional[str] = None,
    db: Session = Depends(get_db),
    _=Depends(admin_only)
):
    ck = f"repartition|{classe}|{annee_scolaire}"
    cached = _cache_get(ck)
    if cached: return cached

    ids = _student_ids(db, classe, annee_scolaire)
    if not ids:
        return {"present":0,"absent":0,"retard":0,"total":0,
                "pct_present":0,"pct_absent":0,"pct_retard":0}

    # Une seule requête avec GROUP BY
    rows = db.query(Attendance.status, func.count(Attendance.id)).filter(
        Attendance.student_id.in_(ids)
    ).group_by(Attendance.status).all()

    counts = {r[0]: r[1] for r in rows}
    present = counts.get("present", 0)
    absent  = counts.get("absent",  0)
    retard  = counts.get("retard",  0)
    total   = present + absent + retard

    result = {
        "present": present, "absent": absent, "retard": retard, "total": total,
        "pct_present": round(present / total * 100, 1) if total else 0,
        "pct_absent":  round(absent  / total * 100, 1) if total else 0,
        "pct_retard":  round(retard  / total * 100, 1) if total else 0,
    }
    _cache_set(ck, result)
    return result


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
    ck = f"top_abs|{classe}|{annee_scolaire}"
    cached = _cache_get(ck)
    if cached: return cached

    students = _students(db, classe, annee_scolaire)
    students = [s for s in students if s.is_enrolled]
    ids      = [s.id for s in students]
    data     = []

    if ids:
        # Une seule requête GROUP BY pour tous les étudiants
        abs_rows = db.query(Attendance.student_id, func.count(Attendance.id)).filter(
            Attendance.student_id.in_(ids), Attendance.status == "absent"
        ).group_by(Attendance.student_id).all()
        tot_rows = db.query(Attendance.student_id, func.count(Attendance.id)).filter(
            Attendance.student_id.in_(ids)
        ).group_by(Attendance.student_id).all()
        abs_map = {str(r[0]): r[1] for r in abs_rows}
        tot_map = {str(r[0]): r[1] for r in tot_rows}

        for s in students:
            sid      = str(s.id)
            absences = abs_map.get(sid, 0)
            total    = tot_map.get(sid, 0)
            taux     = round((absences / total * 100), 1) if total > 0 else 0
            data.append({
                "student_id": sid, "nom": s.nom, "prenom": s.prenom,
                "classe": s.classe, "annee_scolaire": s.annee_scolaire,
                "absences": absences, "taux_absence": taux,
            })

    data.sort(key=lambda x: x["absences"], reverse=True)
    result = data[:10]
    _cache_set(ck, result)
    return result


@router.get("/bi/notes-par-matiere")
async def notes_par_matiere(
    classe:         Optional[str] = None,
    annee_scolaire: Optional[str] = None,
    db: Session = Depends(get_db),
    _=Depends(admin_only)
):
    ck = f"notes_mat|{classe}|{annee_scolaire}"
    cached = _cache_get(ck)
    if cached: return cached

    mat_q = db.query(Matiere)
    if classe: mat_q = mat_q.filter(Matiere.classe == classe)
    matieres = mat_q.all()
    mat_ids  = [m.id for m in matieres]

    ids = set(_student_ids(db, classe, annee_scolaire)) if (classe or annee_scolaire) else None

    # Une seule requête GROUP BY pour toutes les matières
    grade_q = db.query(Grade.matiere_id, func.avg(Grade.note), func.count(Grade.id)).filter(
        Grade.matiere_id.in_(mat_ids)
    )
    if ids: grade_q = grade_q.filter(Grade.student_id.in_(ids))
    rows = grade_q.group_by(Grade.matiere_id).all()
    grade_map = {str(r[0]): {"moy": round(float(r[1]), 2), "nb": r[2]} for r in rows}

    result = []
    for m in matieres:
        d = grade_map.get(str(m.id))
        if not d: continue
        result.append({"matiere": m.nom, "code": m.code, "moyenne": d["moy"], "nb_notes": d["nb"]})

    _cache_set(ck, result)
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
    ck = f"alertes|{classe}|{annee_scolaire}"
    cached = _cache_get(ck)
    if cached: return cached

    ids = set(_student_ids(db, classe, annee_scolaire)) if (classe or annee_scolaire) else None
    q = db.query(Alert).filter(Alert.target_role == "admin", Alert.is_read == False)
    if ids: q = q.filter(Alert.student_id.in_(ids))
    alerts = q.order_by(Alert.created_at.desc()).limit(10).all()
    result = [{
        "id": str(a.id), "type": a.type, "message": a.message,
        "severity": a.severity, "created_at": str(a.created_at),
        "student_id": str(a.student_id),
    } for a in alerts]
    _cache_set(ck, result)
    return result


@router.post("/bi/cache-clear")
async def clear_cache(_=Depends(admin_only)):
    """Vider le cache BI (appelé automatiquement après modification de données)."""
    _cache_clear()
    return {"ok": True}


@router.get("/bi/prediction-risque")
async def prediction_risque(
    classe:         Optional[str] = None,
    annee_scolaire: Optional[str] = None,
    db: Session = Depends(get_db),
    _=Depends(admin_only)
):
    ck = f"prediction|{classe}|{annee_scolaire}"
    cached = _cache_get(ck, ttl=_CACHE_TTL_PREDICT)
    if cached is not None:
        return cached

    students = _students(db, classe, annee_scolaire)
    if not students:
        result = {"etudiants": [], "stats": {"critique": 0, "eleve": 0, "modere": 0, "faible": 0, "total": 0}}
        _cache_set(ck, result)
        return result

    today  = datetime.now(timezone.utc).date()
    cutoff = today - timedelta(days=14)
    s_ids  = [s.id for s in students]

    # ── Bulk query 1 : total attendances per student ──────────────────────────
    att_total_rows = db.query(Attendance.student_id, func.count(Attendance.id)).filter(
        Attendance.student_id.in_(s_ids)
    ).group_by(Attendance.student_id).all()
    att_total_map = {str(sid): cnt for sid, cnt in att_total_rows}

    # ── Bulk query 2 : absences per student ───────────────────────────────────
    att_abs_rows = db.query(Attendance.student_id, func.count(Attendance.id)).filter(
        Attendance.student_id.in_(s_ids), Attendance.status == "absent"
    ).group_by(Attendance.student_id).all()
    att_abs_map = {str(sid): cnt for sid, cnt in att_abs_rows}

    # ── Bulk query 3 : recent sessions (last 14 days) per classe ─────────────
    classes = list({s.classe for s in students if s.classe})
    recent_sessions = db.query(SessionModel).filter(
        SessionModel.classe.in_(classes), SessionModel.date >= cutoff
    ).all()
    sess_by_classe: dict = {}
    for sess in recent_sessions:
        sess_by_classe.setdefault(sess.classe, []).append(sess.id)
    all_recent_ids = [sess.id for sess in recent_sessions]

    # ── Bulk query 4 : recent total attendance ────────────────────────────────
    r_total_map: dict = {}
    r_abs_map:   dict = {}
    if all_recent_ids:
        r_total_rows = db.query(Attendance.student_id, func.count(Attendance.id)).filter(
            Attendance.student_id.in_(s_ids),
            Attendance.session_id.in_(all_recent_ids)
        ).group_by(Attendance.student_id).all()
        r_total_map = {str(sid): cnt for sid, cnt in r_total_rows}

        r_abs_rows = db.query(Attendance.student_id, func.count(Attendance.id)).filter(
            Attendance.student_id.in_(s_ids),
            Attendance.session_id.in_(all_recent_ids),
            Attendance.status == "absent"
        ).group_by(Attendance.student_id).all()
        r_abs_map = {str(sid): cnt for sid, cnt in r_abs_rows}

    # ── Bulk query 5 : weighted averages ─────────────────────────────────────
    from collections import defaultdict
    grade_rows = db.query(Grade, Matiere).join(
        Matiere, Grade.matiere_id == Matiere.id
    ).filter(Grade.student_id.in_(s_ids)).all()
    grade_map: dict = defaultdict(list)
    for g, m in grade_rows:
        grade_map[str(g.student_id)].append((g.note, m.coefficient))

    def _avg(pairs):
        if not pairs: return 0.0
        tw = sum(c for _, c in pairs)
        ws = sum(n * c for n, c in pairs)
        return round(ws / tw, 2) if tw > 0 else 0.0

    # ── Build results in Python (no more per-student queries) ────────────────
    results = []
    for s in students:
        sid          = str(s.id)
        total_att    = att_total_map.get(sid, 0)
        nb_absences  = att_abs_map.get(sid, 0)
        taux_absence = round(nb_absences / total_att * 100, 1) if total_att > 0 else 0

        r_total = r_total_map.get(sid, 0)
        r_abs   = r_abs_map.get(sid, 0)
        if r_total > 0:
            r_taux = round(r_abs / r_total * 100, 1)
            if r_taux > taux_absence * 1.25:   tendance = "en hausse"
            elif r_taux < taux_absence * 0.75: tendance = "en amélioration"
            else:                              tendance = "stable"
        else:
            tendance = "stable"

        pairs      = grade_map.get(sid, [])
        moyenne    = _avg(pairs)
        has_grades = bool(pairs)

        absence_score = (0.6 * min(nb_absences / 8.0, 1.0) + 0.4 * taux_absence / 100.0) * 100
        grade_score   = max(0, (10 - moyenne) / 10.0 * 100) if has_grades and moyenne > 0 else 0
        trend_score   = {"en hausse": 80, "stable": 30, "en amélioration": 0}.get(tendance, 30)
        score         = round(min(100, max(0, 0.45 * absence_score + 0.40 * grade_score + 0.15 * trend_score)), 1)

        if score >= 70:   niveau = "critique"
        elif score >= 45: niveau = "élevé"
        elif score >= 20: niveau = "modéré"
        else:             niveau = "faible"

        results.append({
            "student_id": sid,
            "nom": s.nom, "prenom": s.prenom,
            "classe": s.classe, "annee_scolaire": s.annee_scolaire,
            "score_risque": score, "niveau_risque": niveau,
            "nb_absences": nb_absences, "taux_absence": taux_absence,
            "moyenne": moyenne, "tendance": tendance,
            "analyse_ia": None, "recommandations_ia": [],
        })

    results.sort(key=lambda x: x["score_risque"], reverse=True)
    db.close()

    # ── Claude analysis (called once for all at-risk students) ────────────────
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
    payload = {"etudiants": results, "stats": stats}
    _cache_set(ck, payload)
    return payload
