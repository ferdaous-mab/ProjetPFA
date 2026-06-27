#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
patch_alertes_risque.py — Crée des alertes "notes_faibles" + "risque_echec"
pour Taha Sbai, Manal Chakour et Zairi Nawfal (groupe A, 3ème année).
Usage : python patch_alertes_risque.py
"""

import sys, os
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

from config import SessionLocal
from db.models import Student, Matiere, Grade, Alert

CIBLES = ["sbai", "chakour", "nawfal"]


def get_moyenne(db, student_id):
    rows = (
        db.query(Grade, Matiere)
        .join(Matiere, Grade.matiere_id == Matiere.id)
        .filter(Grade.student_id == student_id)
        .all()
    )
    if not rows:
        return 0.0
    total_c = sum(m.coefficient for _, m in rows)
    return round(sum(g.note * m.coefficient for g, m in rows) / total_c, 2) if total_c else 0.0


def patch():
    db = SessionLocal()
    try:
        # Trouver les 3 étudiants
        etudiants = []
        for mot in CIBLES:
            res = (
                db.query(Student)
                .filter(
                    Student.annee_scolaire.ilike("%3%"),
                    Student.classe == "A",
                    (Student.nom.ilike(f"%{mot}%") | Student.prenom.ilike(f"%{mot}%"))
                )
                .all()
            )
            for e in res:
                if e.id not in {x.id for x in etudiants}:
                    etudiants.append(e)

        if not etudiants:
            print("Aucun étudiant trouvé.")
            return

        print(f"\n{'='*55}")
        print("  Alertes À RISQUE — notes faibles")
        print(f"{'='*55}\n")

        creees = 0
        for etudiant in etudiants:
            moy = get_moyenne(db, etudiant.id)
            print(f"  {etudiant.prenom} {etudiant.nom}  moy={moy}/20")

            for role in ("admin", "professeur"):
                # Supprimer les alertes non lues existantes du même type
                db.query(Alert).filter(
                    Alert.student_id == etudiant.id,
                    Alert.type.in_(["notes_faibles", "risque_echec"]),
                    Alert.is_read == False,
                    Alert.target_role == role,
                ).delete(synchronize_session=False)

                # Alerte notes faibles
                db.add(Alert(
                    student_id  = etudiant.id,
                    type        = "notes_faibles",
                    message     = (
                        f"{etudiant.prenom} {etudiant.nom} (Groupe A, 3ème année) "
                        f"a une moyenne de {moy}/20 — en dessous du seuil de 10/20."
                    ),
                    severity    = "high",
                    target_role = role,
                    is_read     = False,
                ))

                # Alerte risque d'échec
                db.add(Alert(
                    student_id  = etudiant.id,
                    type        = "risque_echec",
                    message     = (
                        f"{etudiant.prenom} {etudiant.nom} (Groupe A) est en risque d'échec : "
                        f"moyenne {moy}/20. Intervention recommandée."
                    ),
                    severity    = "high",
                    target_role = role,
                    is_read     = False,
                ))
            creees += 1
            print(f"    → 2 alertes créées (notes_faibles + risque_echec) pour admin & professeur")

        db.commit()
        print(f"\n  TOTAL : {creees} étudiants, {creees * 4} alertes insérées")
        print(f"{'='*55}\n")

    except Exception as e:
        db.rollback()
        print(f"ERREUR : {e}")
        import traceback; traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    patch()
