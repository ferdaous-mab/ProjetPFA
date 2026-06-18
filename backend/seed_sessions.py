#!/usr/bin/env python
"""
seed_sessions.py - Cree sessions, presences, notes et alertes
en utilisant UNIQUEMENT les etudiants et matieres existants.

Executer depuis backend/ :
    python seed_sessions.py
    python seed_sessions.py --force   # supprime et recrée
"""

import sys, os, random, argparse
from datetime import date, time, timedelta, datetime, timezone

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from config import SessionLocal
from db.models import (
    Student, Matiere, EmploiTemps,
    Session as SessionModel, Attendance, Grade, Alert,
)
from sqlalchemy import func

random.seed(42)

START_DATE  = date(2025, 9, 15)   # debut du semestre
NB_SEMAINES = 12                   # semaines de cours a generer

WEEKDAY = {"Lundi":0, "Mardi":1, "Mercredi":2, "Jeudi":3, "Vendredi":4}

def dates_du_jour(jour: str, start: date, n: int) -> list[date]:
    wd = WEEKDAY.get(jour)
    if wd is None:
        return []
    d = start
    while d.weekday() != wd:
        d += timedelta(days=1)
    today = date.today()
    return [d + timedelta(weeks=i) for i in range(n) if d + timedelta(weeks=i) <= today]

def note_aleatoire(mu=13.0, sigma=3.5):
    return round(max(0.0, min(20.0, random.gauss(mu, sigma))), 2)


def seed(force=False):
    db = SessionLocal()
    try:
        today = date.today()

        # ── Verifications ────────────────────────────────────────────────────
        nb_sess = db.query(SessionModel).count()
        if nb_sess > 0 and not force:
            print(f"[INFO] {nb_sess} sessions existent deja. Utilisez --force pour recrèer.")
            return

        if force:
            db.query(Attendance).delete(); db.commit()
            db.query(Grade).delete();      db.commit()
            db.query(Alert).delete();      db.commit()
            db.query(SessionModel).delete(); db.commit()
            print("[FORCE] Sessions, presences, notes et alertes supprimees.")

        # ── Toutes les matieres (sessions pour tous niveaux/groupes) ────────
        matieres = db.query(Matiere).all()
        print(f"[OK] {len(matieres)} matieres au total")

        # Pre-charger les etudiants par (annee_scolaire, classe)
        etu_map: dict[tuple, list] = {}
        for stu in db.query(Student).filter(Student.is_enrolled == True).all():
            key = (stu.annee_scolaire, stu.classe)
            etu_map.setdefault(key, []).append(stu)

        total_sess = 0
        total_att  = 0
        total_grd  = 0

        for mat in matieres:
            etudiants = etu_map.get((mat.annee_scolaire, mat.classe), [])

            # Creneaux EDT pour cette matiere
            creneaux = db.query(EmploiTemps).filter(
                EmploiTemps.matiere_id == mat.id
            ).all()
            if not creneaux:
                continue

            # ── Sessions ─────────────────────────────────────────────────────
            sessions_mat = []
            for creneau in creneaux:
                for d in dates_du_jour(creneau.jour, START_DATE, NB_SEMAINES):
                    sess = (db.query(SessionModel)
                            .filter(SessionModel.matiere_id  == mat.id,
                                    SessionModel.date        == d,
                                    SessionModel.heure_debut == creneau.heure_debut)
                            .first())
                    if not sess:
                        sess = SessionModel(
                            matiere_id  = mat.id,
                            classe      = mat.classe,
                            date        = d,
                            heure_debut = creneau.heure_debut,
                            heure_fin   = creneau.heure_fin,
                            salle       = creneau.salle,
                            status      = "terminee",
                        )
                        db.add(sess)
                        db.flush()
                    sessions_mat.append((sess, creneau))
            db.commit()
            total_sess += len(sessions_mat)

            # ── Presences ────────────────────────────────────────────────────
            for sess, _ in sessions_mat:
                existing = {
                    r[0] for r in
                    db.query(Attendance.student_id)
                    .filter(Attendance.session_id == sess.id).all()
                }
                for stu in etudiants:
                    if stu.id in existing:
                        continue
                    rnd = random.random()
                    if rnd < 0.04:
                        status = "retard"
                    elif rnd < 0.14:
                        status = "absent"
                    else:
                        status = "present"
                    db.add(Attendance(
                        student_id  = stu.id,
                        session_id  = sess.id,
                        status      = status,
                        detected_at = datetime.now(timezone.utc) if status != "absent" else None,
                        confidence  = round(random.uniform(0.80, 0.99), 3) if status == "present" else None,
                    ))
                    total_att += 1
            db.commit()

            # ── Notes ────────────────────────────────────────────────────────
            for stu in etudiants:
                existing_types = {
                    r[0] for r in
                    db.query(Grade.type)
                    .filter(Grade.student_id == stu.id,
                            Grade.matiere_id == mat.id).all()
                }
                nouvelles = []
                if "controle" not in existing_types:
                    nouvelles += [
                        Grade(student_id=stu.id, matiere_id=mat.id,
                              note=note_aleatoire(13.5, 3.0), type="controle",
                              date=START_DATE + timedelta(weeks=4)),
                        Grade(student_id=stu.id, matiere_id=mat.id,
                              note=note_aleatoire(12.5, 3.5), type="controle",
                              date=START_DATE + timedelta(weeks=8)),
                    ]
                if "examen" not in existing_types:
                    nouvelles.append(
                        Grade(student_id=stu.id, matiere_id=mat.id,
                              note=note_aleatoire(12.0, 4.0), type="examen",
                              date=START_DATE + timedelta(weeks=12))
                    )
                if "tp" not in existing_types and mat.coefficient >= 3.0:
                    nouvelles.append(
                        Grade(student_id=stu.id, matiere_id=mat.id,
                              note=note_aleatoire(14.0, 2.5), type="tp",
                              date=START_DATE + timedelta(weeks=6))
                    )
                for g in nouvelles:
                    db.add(g)
                total_grd += len(nouvelles)
            db.commit()

        # ── Alertes ──────────────────────────────────────────────────────────
        total_alr = 0
        all_students = db.query(Student).filter(Student.is_enrolled == True).all()

        for stu in all_students:
            if db.query(Alert).filter(Alert.student_id == stu.id).count():
                continue

            # Calculer le taux d'absence reel
            total_att_stu = db.query(Attendance).filter(Attendance.student_id == stu.id).count()
            nb_abs        = db.query(Attendance).filter(
                Attendance.student_id == stu.id,
                Attendance.status     == "absent"
            ).count()
            taux_abs = (nb_abs / total_att_stu * 100) if total_att_stu > 0 else 0

            # Calculer la moyenne reelle
            grades = db.query(Grade).filter(Grade.student_id == stu.id).all()
            if grades:
                moy = sum(g.note for g in grades) / len(grades)
            else:
                moy = 0

            if taux_abs > 20:
                db.add(Alert(
                    student_id  = stu.id,
                    type        = "absences_excessives",
                    message     = (f"{stu.prenom} {stu.nom} a un taux d'absence de "
                                   f"{taux_abs:.0f}% ({nb_abs} absences)."),
                    severity    = "high" if taux_abs > 30 else "medium",
                    target_role = "professeur",
                    is_read     = False,
                ))
                total_alr += 1

            if 0 < moy < 10:
                db.add(Alert(
                    student_id  = stu.id,
                    type        = "notes_faibles",
                    message     = (f"La moyenne de {stu.prenom} {stu.nom} est "
                                   f"de {moy:.1f}/20."),
                    severity    = "high" if moy < 7 else "medium",
                    target_role = "admin",
                    is_read     = False,
                ))
                total_alr += 1

        db.commit()

        # ── Resume ───────────────────────────────────────────────────────────
        print()
        print("=" * 50)
        print("  Resume")
        print("=" * 50)
        print(f"  Sessions   : {db.query(SessionModel).count()}")
        print(f"  Presences  : {db.query(Attendance).count()}")
        print(f"  Notes      : {db.query(Grade).count()}")
        print(f"  Alertes    : {db.query(Alert).count()}")
        print("=" * 50)
        print("Seed termine avec succes!")

    except Exception as e:
        db.rollback()
        import traceback; traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    seed(force=args.force)
