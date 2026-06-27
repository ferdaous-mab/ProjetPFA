#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
patch_sous_moyenne.py — Met des notes sous la moyenne (<10) pour des étudiants ciblés.
Usage : python patch_sous_moyenne.py
"""

import sys, os, random
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

from config import SessionLocal
from db.models import Student, Matiere, Grade
from datetime import date

random.seed(99)

# Noms à cibler (recherche insensible à la casse, partielle)
CIBLES = ["sbai", "chakour", "nawfal"]

DATE_CC     = date(2025, 11, 20)
DATE_EXAMEN = date(2026,  1, 15)

def note_sous_moyenne():
    """Note entre 5 et 9.75, arrondie au 0.25."""
    n = random.gauss(7.5, 1.5)
    return round(max(5.0, min(9.75, round(n * 4) / 4)), 2)


def patch():
    db = SessionLocal()
    try:
        # Trouver les étudiants ciblés
        etudiants_trouves = []
        for mot in CIBLES:
            resultats = (
                db.query(Student)
                .filter(
                    Student.annee_scolaire.ilike("%3%"),
                    Student.classe == "A",
                    (Student.nom.ilike(f"%{mot}%") | Student.prenom.ilike(f"%{mot}%"))
                )
                .all()
            )
            etudiants_trouves.extend(resultats)

        # Dédoublonnage
        seen_ids = set()
        etudiants = []
        for e in etudiants_trouves:
            if e.id not in seen_ids:
                seen_ids.add(e.id)
                etudiants.append(e)

        if not etudiants:
            print("Aucun étudiant trouvé pour les noms : " + str(CIBLES))
            return

        # Matières 3ème année
        matieres_raw = db.query(Matiere).filter(Matiere.annee_scolaire.ilike("%3%")).all()
        matieres_uniq = {}
        for m in matieres_raw:
            if m.nom not in matieres_uniq:
                matieres_uniq[m.nom] = m
        matieres = list(matieres_uniq.values())

        ids_mat = [m.id for m in matieres]

        print(f"\n{'='*55}")
        print("  Étudiants ciblés :")
        for e in etudiants:
            print(f"    → {e.prenom} {e.nom}  (groupe {e.classe})")

        # Supprimer les notes existantes
        ids_etu = [e.id for e in etudiants]
        nb_del = (
            db.query(Grade)
            .filter(Grade.student_id.in_(ids_etu), Grade.matiere_id.in_(ids_mat))
            .delete(synchronize_session=False)
        )
        db.commit()
        print(f"\n  [{nb_del} notes supprimées]")

        # Insérer nouvelles notes sous la moyenne
        inseres = 0
        for etudiant in etudiants:
            for mat in matieres:
                for type_note, date_note in [("controle", DATE_CC), ("examen", DATE_EXAMEN)]:
                    note = note_sous_moyenne()
                    db.add(Grade(
                        student_id  = etudiant.id,
                        matiere_id  = mat.id,
                        note        = note,
                        type        = type_note,
                        date        = date_note,
                    ))
                    inseres += 1
        db.commit()
        print(f"  [{inseres} notes insérées]\n")

        # Afficher les nouvelles moyennes
        print(f"  {'─'*50}")
        print("  Nouvelles moyennes :")
        print(f"  {'─'*50}")
        for etudiant in etudiants:
            grades = (
                db.query(Grade, Matiere)
                .join(Matiere, Grade.matiere_id == Matiere.id)
                .filter(Grade.student_id == etudiant.id, Grade.matiere_id.in_(ids_mat))
                .all()
            )
            if not grades:
                continue
            total_c = sum(m.coefficient for _, m in grades)
            moy = round(sum(g.note * m.coefficient for g, m in grades) / total_c, 2) if total_c else 0
            print(f"  ⚠  {etudiant.prenom:12} {etudiant.nom:15}  moy = {moy:.2f}/20")

        print(f"{'='*55}\n")

    except Exception as e:
        db.rollback()
        print(f"ERREUR : {e}")
        import traceback; traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    patch()
