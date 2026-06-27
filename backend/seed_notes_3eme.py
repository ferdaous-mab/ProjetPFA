#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
seed_notes_3eme.py - Génère des notes aléatoires pour les étudiants de 3ème année (groupes A, B, C).

Pour chaque étudiant x chaque matière :
  - 1 note de type "controle"  (CC)
  - 1 note de type "examen"    (Final)

Moyenne générale = moyenne pondérée par coefficient (identique à get_average_by_student).

Usage (depuis backend/) :
    python seed_notes_3eme.py
    python seed_notes_3eme.py --force   # supprime les notes existantes de 3ème année avant insertion
"""

import sys, os, argparse, random
from datetime import date, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

from config import SessionLocal
from db.models import Student, Matiere, Grade

random.seed(42)  # reproductibilité


# ── Profil de difficulté par matière ─────────────────────────────────────────
# (moyenne_cible, ecart_type)  notes sur 20
DIFFICULTE = {
    "Projet PFA":                          (13.0, 2.5),
    "Business Intelligence":               (12.0, 3.0),
    "Administration Systèmes Unix":        (11.0, 3.5),
    "UML":                                 (13.5, 2.0),
    "Interconnexion réseaux":              (10.5, 3.5),
    "DotNet":                              (12.5, 3.0),
    "Analyse de Données II":               (11.5, 3.0),
    "Anglais":                             (13.0, 2.5),
    "Langage Java Avancée / WEB":          (11.0, 3.5),
    "TEC/Droit, Civisme et Citoyenneté":  (14.0, 2.0),
}
DEFAULT_DIFFICULTE = (12.0, 3.0)

# Dates fictives des épreuves (semestre en cours)
DATE_CC    = date(2025, 11, 20)
DATE_EXAMEN = date(2026,  1, 15)


def note_aleatoire(mu: float, sigma: float) -> float:
    """Note gaussienne arrondie à 0.25, bornée à [2, 20]."""
    n = random.gauss(mu, sigma)
    n = max(2.0, min(20.0, n))
    return round(round(n * 4) / 4, 2)  # arrondi au 0.25 le plus proche


def seed(force: bool = False):
    db = SessionLocal()
    try:
        # 1. Étudiants 3ème année groupes A, B, C
        etudiants = (
            db.query(Student)
            .filter(Student.annee_scolaire.ilike("%3%"))
            .filter(Student.classe.in_(["A", "B", "C"]))
            .order_by(Student.classe, Student.nom, Student.prenom)
            .all()
        )
        if not etudiants:
            print("ERREUR : Aucun étudiant de 3ème année (groupes A/B/C) trouvé en base.")
            return

        print(f"[OK] {len(etudiants)} étudiants de 3ème année chargés")
        for grp in ["A", "B", "C"]:
            nb = sum(1 for e in etudiants if e.classe == grp)
            print(f"     Groupe {grp} : {nb} étudiants")

        # 2. Matières 3ème année
        matieres = (
            db.query(Matiere)
            .filter(Matiere.annee_scolaire.ilike("%3%"))
            .all()
        )
        if not matieres:
            print("ERREUR : Aucune matière de 3ème année trouvée. Lancez seed_emplois_3eme.py d'abord.")
            return

        # Dédoublonnage par nom (une seule matière par nom, peu importe le groupe)
        matieres_uniq = {}
        for m in matieres:
            if m.nom not in matieres_uniq:
                matieres_uniq[m.nom] = m
        matieres = list(matieres_uniq.values())
        print(f"[OK] {len(matieres)} matières de 3ème année : {[m.nom for m in matieres]}\n")

        # 3. Suppression si --force
        if force:
            ids_etu = [e.id for e in etudiants]
            ids_mat = [m.id for m in matieres]
            nb = (
                db.query(Grade)
                .filter(Grade.student_id.in_(ids_etu), Grade.matiere_id.in_(ids_mat))
                .delete(synchronize_session=False)
            )
            db.commit()
            print(f"[FORCE] {nb} notes supprimées\n")

        # 4. Génération des notes
        inseres = 0
        ignores = 0

        # Chaque étudiant a un "biais" personnel [-2, +2] pour simuler des niveaux différents
        biais_etudiant = {e.id: random.uniform(-2.0, 2.0) for e in etudiants}

        for etudiant in etudiants:
            biais = biais_etudiant[etudiant.id]
            for mat in matieres:
                mu, sigma = DIFFICULTE.get(mat.nom, DEFAULT_DIFFICULTE)

                for type_note, date_note in [("controle", DATE_CC), ("examen", DATE_EXAMEN)]:
                    # Éviter les doublons
                    existe = (
                        db.query(Grade)
                        .filter(
                            Grade.student_id == etudiant.id,
                            Grade.matiere_id == mat.id,
                            Grade.type == type_note,
                        )
                        .first()
                    )
                    if existe:
                        ignores += 1
                        continue

                    # L'examen est légèrement plus difficile que le CC
                    mu_final = mu + biais + (-0.5 if type_note == "examen" else 0.5)
                    note = note_aleatoire(mu_final, sigma)

                    db.add(Grade(
                        student_id  = etudiant.id,
                        matiere_id  = mat.id,
                        note        = note,
                        type        = type_note,
                        date        = date_note,
                        commentaire = None,
                    ))
                    inseres += 1

        db.commit()
        print(f"[DONE] {inseres} notes insérées, {ignores} ignorées (déjà existantes)\n")

        # 5. Affichage des moyennes
        _afficher_moyennes(db, etudiants, matieres)

    except Exception as e:
        db.rollback()
        print(f"\nERREUR : {e}")
        import traceback; traceback.print_exc()
    finally:
        db.close()


def _afficher_moyennes(db, etudiants, matieres):
    """Calcule et affiche les moyennes par groupe et la moyenne générale."""
    mat_ids = {m.id for m in matieres}

    resultats = {}  # groupe -> liste de moyennes individuelles
    for etudiant in etudiants:
        grades = (
            db.query(Grade, Matiere)
            .join(Matiere, Grade.matiere_id == Matiere.id)
            .filter(Grade.student_id == etudiant.id, Grade.matiere_id.in_(mat_ids))
            .all()
        )
        if not grades:
            continue
        total_coeff  = sum(m.coefficient for _, m in grades)
        moyenne_pond = round(sum(g.note * m.coefficient for g, m in grades) / total_coeff, 2) if total_coeff else 0.0
        resultats.setdefault(etudiant.classe, []).append((etudiant, moyenne_pond))

    print("=" * 60)
    print("  MOYENNES GÉNÉRALES — 3ème ANNÉE")
    print("=" * 60)

    all_moyennes = []
    for grp in ["A", "B", "C"]:
        data = resultats.get(grp, [])
        if not data:
            continue
        moyennes = [m for _, m in data]
        moy_grp  = round(sum(moyennes) / len(moyennes), 2)
        min_grp  = min(moyennes)
        max_grp  = max(moyennes)
        nb_admis = sum(1 for m in moyennes if m >= 10)
        all_moyennes.extend(moyennes)

        print(f"\n  Groupe {grp} ({len(data)} étudiants)")
        print(f"    Moyenne  : {moy_grp}/20")
        print(f"    Min/Max  : {min_grp} / {max_grp}")
        print(f"    Admis    : {nb_admis}/{len(data)} ({round(nb_admis/len(data)*100)}%)")

        # Top 3
        top3 = sorted(data, key=lambda x: x[1], reverse=True)[:3]
        print("    Top 3    :", ", ".join(f"{e.prenom} {e.nom} ({m})" for e, m in top3))

    if all_moyennes:
        moy_gen = round(sum(all_moyennes) / len(all_moyennes), 2)
        nb_admis_total = sum(1 for m in all_moyennes if m >= 10)
        print(f"\n{'=' * 60}")
        print(f"  MOYENNE GÉNÉRALE 3ème ANNÉE : {moy_gen}/20")
        print(f"  Taux de réussite global     : {nb_admis_total}/{len(all_moyennes)} "
              f"({round(nb_admis_total/len(all_moyennes)*100)}%)")
        print("=" * 60)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true",
                        help="Supprimer les notes existantes de 3ème année avant insertion")
    args = parser.parse_args()
    seed(force=args.force)
