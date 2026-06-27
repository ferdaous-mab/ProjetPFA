#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
seed_grp_a_complet.py — Seed complet pour le groupe A (3ème année)
SmartCampus IA - ESISA Fes 2025

Actions effectuées :
  1. Supprime et recrée les notes du groupe A (avec 4 étudiants à risque <8/20)
  2. Crée une session par jour de la semaine courante (Lundi→Vendredi)
  3. Distribue les absences : certains étudiants ont >3 absences
  4. Génère les alertes pour les étudiants du groupe A avec >3 absences

Usage :
    python seed_grp_a_complet.py
    python seed_grp_a_complet.py --force   # recrée aussi les sessions/absences/alertes
"""

import sys, os, argparse, random
from datetime import date, time, timedelta, datetime, timezone

# Fix encodage Windows (cp1252 → utf-8)
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

from config import SessionLocal
from db.models import Student, Matiere, Grade, Session as SessionModel, Attendance, Alert

random.seed(7)  # reproductibilité

# ── Semaine courante (Lundi → Vendredi) ──────────────────────────────────────
TODAY = date(2026, 6, 26)          # Vendredi
LUNDI = TODAY - timedelta(days=TODAY.weekday())   # => 2026-06-22

JOURS = [
    ("Lundi",    LUNDI),
    ("Mardi",    LUNDI + timedelta(1)),
    ("Mercredi", LUNDI + timedelta(2)),
    ("Jeudi",    LUNDI + timedelta(3)),
    ("Vendredi", LUNDI + timedelta(4)),
]

# Créneaux horaires par session
CRENEAUX = [
    (time(8, 30),  time(10, 30)),
    (time(10, 45), time(12, 45)),
    (time(14, 0),  time(16, 0)),
    (time(16, 15), time(18, 15)),
    (time(8, 30),  time(10, 30)),
]

SEUIL_ABSENCES = 3   # alerte si nb_absences > SEUIL

# ── Profil de notes par matière ───────────────────────────────────────────────
DIFFICULTE = {
    "Projet PFA":                         (13.5, 2.5),
    "Business Intelligence":              (12.5, 3.0),
    "Administration Systèmes Unix":       (11.0, 3.5),
    "UML":                                (14.0, 2.0),
    "Interconnexion réseaux":             (10.5, 3.5),
    "DotNet":                             (12.5, 3.0),
    "Analyse de Données II":              (11.5, 3.0),
    "Anglais":                            (13.5, 2.5),
    "Langage Java Avancée / WEB":         (11.0, 3.5),
    "TEC/Droit, Civisme et Citoyenneté": (14.0, 2.0),
}
DEFAULT_DIFFICULTE = (12.0, 3.0)

DATE_CC     = date(2025, 11, 20)
DATE_EXAMEN = date(2026,  1, 15)


def note_normale(mu, sigma):
    n = random.gauss(mu, sigma)
    return round(max(2.0, min(20.0, round(n * 4) / 4)), 2)


def note_risque():
    """Note très basse pour étudiant à risque : entre 2 et 7.75."""
    n = random.gauss(5.5, 1.5)
    return round(max(2.0, min(7.75, round(n * 4) / 4)), 2)


# ─────────────────────────────────────────────────────────────────────────────

def seed(force: bool = False):
    db = SessionLocal()
    try:
        # ── 1. Étudiants groupe A 3ème année ─────────────────────────────────
        etudiants = (
            db.query(Student)
            .filter(Student.annee_scolaire.ilike("%3%"), Student.classe == "A")
            .order_by(Student.nom, Student.prenom)
            .all()
        )
        if not etudiants:
            print("ERREUR : Aucun étudiant de 3ème année groupe A trouvé.")
            return

        print(f"\n{'='*60}")
        print(f"  Groupe A — {len(etudiants)} étudiants")
        print(f"{'='*60}")

        # ── 2. Matières 3ème année ────────────────────────────────────────────
        matieres_raw = (
            db.query(Matiere)
            .filter(Matiere.annee_scolaire.ilike("%3%"))
            .all()
        )
        matieres_uniq = {}
        for m in matieres_raw:
            if m.nom not in matieres_uniq:
                matieres_uniq[m.nom] = m
        matieres = list(matieres_uniq.values())

        if not matieres:
            print("ERREUR : Aucune matière de 3ème année. Lancez seed_emplois_3eme.py d'abord.")
            return

        print(f"  Matières : {len(matieres)} ({[m.nom[:20] for m in matieres]})\n")

        # ── 3. Mise à jour des notes groupe A ─────────────────────────────────
        _seed_notes(db, etudiants, matieres, force)

        # ── 4. Sessions + Absences + Alertes ──────────────────────────────────
        _seed_sessions_absences_alertes(db, etudiants, matieres, force)

    except Exception as e:
        db.rollback()
        print(f"\nERREUR : {e}")
        import traceback; traceback.print_exc()
    finally:
        db.close()


# ─── Notes ───────────────────────────────────────────────────────────────────

def _seed_notes(db, etudiants, matieres, force):
    print(f"\n{'─'*60}")
    print("  ÉTAPE 1 — Notes groupe A")
    print(f"{'─'*60}")

    ids_etu = [e.id for e in etudiants]
    ids_mat = [m.id for m in matieres]

    # Toujours supprimer les notes existantes du groupe A
    nb_del = (
        db.query(Grade)
        .filter(Grade.student_id.in_(ids_etu), Grade.matiere_id.in_(ids_mat))
        .delete(synchronize_session=False)
    )
    db.commit()
    print(f"  [{nb_del} notes supprimées]")

    # Choisir 4 étudiants à risque (indices fixes pour reproductibilité)
    nb = len(etudiants)
    indices_risque = sorted(random.sample(range(nb), min(4, nb)))
    etudiants_risque = {etudiants[i].id for i in indices_risque}

    print(f"\n  Étudiants À RISQUE (notes < 8/20) :")
    for i in indices_risque:
        e = etudiants[i]
        print(f"    ⚠  {e.prenom} {e.nom}")

    biais = {e.id: random.uniform(-1.5, 1.5) for e in etudiants}
    inseres = 0

    for etudiant in etudiants:
        at_risk = etudiant.id in etudiants_risque
        for mat in matieres:
            mu, sigma = DIFFICULTE.get(mat.nom, DEFAULT_DIFFICULTE)
            for type_note, date_note in [("controle", DATE_CC), ("examen", DATE_EXAMEN)]:
                if at_risk:
                    note = note_risque()
                else:
                    mu_adj = mu + biais[etudiant.id] + (0.5 if type_note == "controle" else -0.5)
                    note = note_normale(mu_adj, sigma)

                db.add(Grade(
                    student_id  = etudiant.id,
                    matiere_id  = mat.id,
                    note        = note,
                    type        = type_note,
                    date        = date_note,
                ))
                inseres += 1

    db.commit()
    print(f"\n  → {inseres} notes insérées")
    _afficher_moyennes(db, etudiants, matieres)
    return etudiants_risque


# ─── Sessions / Absences / Alertes ───────────────────────────────────────────

def _seed_sessions_absences_alertes(db, etudiants, matieres, force):
    print(f"\n{'─'*60}")
    print("  ÉTAPE 2 — Sessions semaine (Lundi→Vendredi)")
    print(f"{'─'*60}")

    # Supprimer les anciennes sessions de la semaine pour groupe A si --force
    if force:
        dates_semaine = [d for _, d in JOURS]
        anciennes = (
            db.query(SessionModel)
            .filter(
                SessionModel.classe == "A",
                SessionModel.date.in_(dates_semaine)
            )
            .all()
        )
        for s in anciennes:
            db.delete(s)
        db.commit()
        print(f"  [{len(anciennes)} sessions supprimées (--force)]")

    # Supprimer les alertes d'absences existantes du groupe A si --force
    if force:
        ids_etu = [e.id for e in etudiants]
        nb_alerts = (
            db.query(Alert)
            .filter(
                Alert.student_id.in_(ids_etu),
                Alert.type == "absences_excessives"
            )
            .delete(synchronize_session=False)
        )
        db.commit()
        print(f"  [{nb_alerts} alertes absences supprimées (--force)]")

    # Rotation des matières sur les 5 jours
    matieres_cycle = matieres[:5] if len(matieres) >= 5 else (matieres * 5)[:5]

    sessions_creees = []
    for idx, (jour, date_session) in enumerate(JOURS):
        mat = matieres_cycle[idx]
        h_deb, h_fin = CRENEAUX[idx]

        # Vérifier si la session existe déjà
        existe = (
            db.query(SessionModel)
            .filter(
                SessionModel.classe == "A",
                SessionModel.matiere_id == mat.id,
                SessionModel.date == date_session,
            )
            .first()
        )
        if existe:
            print(f"  [{jour} {date_session}] Session déjà existante — conservée")
            sessions_creees.append(existe)
            continue

        session = SessionModel(
            matiere_id  = mat.id,
            classe      = "A",
            date        = date_session,
            heure_debut = h_deb,
            heure_fin   = h_fin,
            salle       = "Salle 101",
            status      = "terminee" if date_session <= TODAY else "planifiee",
        )
        db.add(session)
        db.flush()
        sessions_creees.append(session)
        print(f"  ✓ {jour} {date_session}  [{mat.nom[:30]}]  {h_deb}→{h_fin}")

    db.commit()
    print(f"\n  → {len(sessions_creees)} sessions disponibles")

    # ── Absences ─────────────────────────────────────────────────────────────
    print(f"\n{'─'*60}")
    print("  ÉTAPE 3 — Absences groupe A")
    print(f"{'─'*60}")

    nb_etu = len(etudiants)

    # Plan d'absences : pour chaque session, liste des indices étudiants absents
    # On veut que ~3-4 étudiants aient >3 absences au total
    # Sessions terminées seulement (passées)
    sessions_passees = [s for s in sessions_creees if s.date <= TODAY]

    # Matrice absences : student_idx -> nb absences cumulées
    absences_count = {e.id: 0 for e in etudiants}

    # Étudiants qui auront >3 absences : les 4 premiers
    nb_absents_graves = min(4, nb_etu)
    etudiants_abs_graves = etudiants[:nb_absents_graves]

    print(f"\n  Étudiants avec >3 absences prévues :")
    for e in etudiants_abs_graves:
        print(f"    ⚠  {e.prenom} {e.nom}")

    abs_inseres = 0
    abs_ignores = 0

    for session in sessions_passees:
        for i, etudiant in enumerate(etudiants):
            # Vérifier si présence déjà enregistrée
            existe = (
                db.query(Attendance)
                .filter(
                    Attendance.session_id == session.id,
                    Attendance.student_id == etudiant.id,
                )
                .first()
            )
            if existe:
                abs_ignores += 1
                continue

            # Décider du statut
            if etudiant in etudiants_abs_graves:
                # Toujours absent sur toutes les sessions passées → max abs
                statut = "absent"
            elif i < nb_etu // 2:
                # Présent la plupart du temps, absent 1-2 fois max
                statut = "absent" if random.random() < 0.15 else "present"
            else:
                # Très assidu
                statut = "absent" if random.random() < 0.05 else "present"

            db.add(Attendance(
                student_id  = etudiant.id,
                session_id  = session.id,
                status      = statut,
                detected_at = datetime.now(timezone.utc) if statut == "present" else None,
                confidence  = round(random.uniform(0.72, 0.95), 3) if statut == "present" else None,
            ))
            if statut == "absent":
                absences_count[etudiant.id] += 1
            abs_inseres += 1

    db.commit()
    print(f"\n  → {abs_inseres} présences enregistrées ({abs_ignores} ignorées)")

    # ── Alertes ──────────────────────────────────────────────────────────────
    print(f"\n{'─'*60}")
    print("  ÉTAPE 4 — Alertes absences excessives")
    print(f"{'─'*60}\n")

    # Recalculer les vraies absences depuis la BD
    alertes_creees = 0
    for etudiant in etudiants:
        nb_abs = (
            db.query(Attendance)
            .filter(
                Attendance.student_id == etudiant.id,
                Attendance.status == "absent",
            )
            .count()
        )
        if nb_abs > SEUIL_ABSENCES:
            # Vérifier si alerte déjà existante non lue
            alerte_existe = (
                db.query(Alert)
                .filter(
                    Alert.student_id == etudiant.id,
                    Alert.type == "absences_excessives",
                    Alert.is_read == False,
                )
                .first()
            )
            if alerte_existe:
                print(f"  [SKIP] {etudiant.prenom} {etudiant.nom} — alerte déjà présente ({nb_abs} abs)")
                continue

            msg = (
                f"{etudiant.prenom} {etudiant.nom} (Groupe A) a enregistré "
                f"{nb_abs} absence(s) cette semaine — seuil de {SEUIL_ABSENCES} dépassé."
            )
            for role in ("admin", "professeur"):
                db.add(Alert(
                    student_id  = etudiant.id,
                    type        = "absences_excessives",
                    message     = msg,
                    severity    = "high",
                    target_role = role,
                    is_read     = False,
                ))
            alertes_creees += 1
            print(f"  🔔 Alerte créée : {etudiant.prenom} {etudiant.nom}  ({nb_abs} absences)")

    db.commit()
    print(f"\n  → {alertes_creees} étudiant(s) avec alerte générée (×2 rôles = {alertes_creees*2} alertes)")

    # ── Bilan final ───────────────────────────────────────────────────────────
    print(f"\n{'='*60}")
    print("  BILAN FINAL — GROUPE A")
    print(f"{'='*60}")
    print(f"  Étudiants  : {len(etudiants)}")
    print(f"  Sessions   : {len(sessions_creees)} (semaine du {LUNDI} au {LUNDI+timedelta(4)})")
    print(f"  Alertes    : {alertes_creees} étudiant(s) — absences excessives\n")


# ─── Affichage moyennes ───────────────────────────────────────────────────────

def _afficher_moyennes(db, etudiants, matieres):
    mat_ids = {m.id for m in matieres}
    print(f"\n  {'─'*56}")
    print("   Moyennes groupe A après mise à jour :")
    print(f"  {'─'*56}")
    data = []
    for e in etudiants:
        grades = (
            db.query(Grade, Matiere)
            .join(Matiere, Grade.matiere_id == Matiere.id)
            .filter(Grade.student_id == e.id, Grade.matiere_id.in_(mat_ids))
            .all()
        )
        if not grades:
            continue
        total_c = sum(m.coefficient for _, m in grades)
        moy = round(sum(g.note * m.coefficient for g, m in grades) / total_c, 2) if total_c else 0
        risque = " ⚠ À RISQUE" if moy < 8 else ""
        data.append((e, moy))
        print(f"   {'→' if moy < 8 else ' '} {e.prenom:12} {e.nom:15}  moy={moy:5.2f}/20{risque}")

    if data:
        moyennes = [m for _, m in data]
        print(f"  {'─'*56}")
        print(f"   Moyenne du groupe : {round(sum(moyennes)/len(moyennes), 2)}/20")
        print(f"   Admis (≥10)       : {sum(1 for m in moyennes if m >= 10)}/{len(moyennes)}")
        print(f"   À risque (<8)     : {sum(1 for m in moyennes if m < 8)}/{len(moyennes)}")


# ─── Main ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--force", action="store_true",
        help="Supprime et recrée les sessions/absences/alertes existantes de la semaine"
    )
    args = parser.parse_args()
    seed(force=args.force)
