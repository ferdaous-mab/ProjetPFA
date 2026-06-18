#!/usr/bin/env python
"""
seed_data.py - Cree les matieres et emplois du temps pour tous les groupes.
Utilise les professeurs et etudiants existants, ne cree aucun nouvel etudiant.

Executer depuis backend/ :
    python seed_data.py
    python seed_data.py --force   # supprime et recrée les matieres existantes
"""

import sys, os, argparse
from datetime import time

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from config import SessionLocal
from db.models import User, Student, Matiere, EmploiTemps
from sqlalchemy import func

# ─── Matieres par niveau ─────────────────────────────────────────────────────
# (nom, code, coefficient)
MATIERES_NIVEAU = {
    "1ere annee": [
        ("Mathematiques",           "MAT101", 3.0),
        ("Algorithmique & Prog.",   "ALG101", 4.0),
        ("Architecture Ord.",       "ARC101", 2.0),
        ("Anglais Technique",       "ANG101", 1.0),
        ("Physique Appliquee",      "PHY101", 2.0),
        ("Logique & Circuits",      "LOG101", 2.0),
        ("Communication",           "COM101", 1.0),
    ],
    "2eme annee": [
        ("Probabilites & Stats",    "STA201", 2.0),
        ("Structures de Donnees",   "STD201", 3.0),
        ("Prog. Orientee Objet",    "POO201", 4.0),
        ("Systemes d Exploitation", "SYS201", 3.0),
        ("Reseaux Informatiques",   "RES201", 3.0),
        ("Bases de Donnees",        "BDD201", 3.0),
        ("Developpement Web",       "WEB201", 3.0),
    ],
    "3eme annee": [
        ("Intelligence Artificielle","IA301",  4.0),
        ("Genie Logiciel",           "GL301",  3.0),
        ("Securite Informatique",    "SEC301", 3.0),
        ("Developpement Mobile",     "MOB301", 3.0),
        ("Big Data",                 "BD301",  3.0),
        ("Machine Learning",         "ML301",  4.0),
        ("Gestion de Projet",        "GP301",  2.0),
    ],
    "4eme annee": [
        ("Deep Learning",            "DL401",  4.0),
        ("DevOps & Cloud",           "DEV401", 3.0),
        ("Systemes Distribues",      "SYS401", 3.0),
        ("Vision par Ordinateur",    "VIS401", 3.0),
        ("Audit & Securite Avancee", "AUD401", 3.0),
        ("Recherche & Innovation",   "REC401", 2.0),
        ("Projet de Fin d Etudes",   "PFE401", 4.0),
    ],
}

# Mapping souple: la valeur en base peut etre "1ere annee", "1ère année", etc.
MAPPING_NIVEAU = {}
for k in MATIERES_NIVEAU:
    MAPPING_NIVEAU[k] = k

def detecter_niveau(annee_scolaire: str) -> str | None:
    """Convertit la valeur brute de la base vers la cle du dict MATIERES_NIVEAU."""
    if not annee_scolaire:
        return None
    s = annee_scolaire.lower()
    if "1" in s:   return "1ere annee"
    if "2" in s:   return "2eme annee"
    if "3" in s:   return "3eme annee"
    if "4" in s:   return "4eme annee"
    return None

# ─── Creneaux horaires ────────────────────────────────────────────────────────
SLOTS = {
    "M1": (time(8,  0), time(10, 0)),
    "M2": (time(10, 0), time(12, 0)),
    "A1": (time(14, 0), time(16, 0)),
    "A2": (time(16, 0), time(18, 0)),
}

# Emploi du temps par index de matiere (0..6) selon le suffixe du groupe (A/B/C)
# Chaque entree = liste de (jour, slot_key, salle_suffix)
EDT_A = [
    [("Lundi",    "M1", "01"), ("Jeudi",    "M1", "01")],  # mat 0
    [("Lundi",    "M2", "02"), ("Jeudi",    "M2", "02")],  # mat 1
    [("Mardi",    "M1", "03"), ("Vendredi", "M1", "03")],  # mat 2
    [("Mardi",    "M2", "04"), ("Vendredi", "M2", "04")],  # mat 3
    [("Mercredi", "M1", "05"), ("Mercredi", "M2", "05")],  # mat 4
    [("Mercredi", "A1", "06")],                             # mat 5
    [("Mercredi", "A2", "06")],                             # mat 6
]
EDT_B = [
    [("Mardi",    "M1", "01"), ("Vendredi", "M1", "01")],
    [("Mardi",    "M2", "02"), ("Vendredi", "M2", "02")],
    [("Lundi",    "M1", "03"), ("Jeudi",    "M1", "03")],
    [("Lundi",    "M2", "04"), ("Jeudi",    "M2", "04")],
    [("Mercredi", "A1", "05"), ("Mercredi", "A2", "05")],
    [("Mercredi", "M1", "06")],
    [("Mercredi", "M2", "06")],
]
EDT_C = [
    [("Lundi",    "M1", "01"), ("Mercredi", "M1", "01")],
    [("Lundi",    "M2", "02"), ("Mercredi", "M2", "02")],
    [("Mardi",    "M1", "03"), ("Jeudi",    "M1", "03")],
    [("Mardi",    "M2", "04"), ("Jeudi",    "M2", "04")],
    [("Vendredi", "M1", "05"), ("Vendredi", "M2", "05")],
    [("Mercredi", "A1", "06")],
    [("Mercredi", "A2", "06")],
]

def get_edt(groupe: str) -> list:
    if groupe == "A":  return EDT_A
    elif groupe == "B": return EDT_B
    else:              return EDT_C

# Prefixe de salle selon le niveau
SALLE_PREFIX = {
    "1ere annee": "A",
    "2eme annee": "B",
    "3eme annee": "C",
    "4eme annee": "D",
}


# ─── Script principal ─────────────────────────────────────────────────────────
def seed(force: bool = False):
    db = SessionLocal()
    try:
        # 1. Professeurs existants
        profs = db.query(User).filter(User.role == "professeur").all()
        if not profs:
            print("ERREUR: Aucun professeur en base.")
            return
        prof_ids = [p.id for p in profs]
        print(f"[OK] {len(prof_ids)} professeurs charges")

        # 2. Groupes/niveaux existants (depuis les etudiants)
        groupes_db = (
            db.query(Student.annee_scolaire, Student.classe, func.count(Student.id))
            .group_by(Student.annee_scolaire, Student.classe)
            .order_by(Student.annee_scolaire, Student.classe)
            .all()
        )
        print(f"[OK] {len(groupes_db)} groupes detectes en base\n")

        # 3. Suppression si --force
        if force:
            nb = db.query(EmploiTemps).delete()
            db.commit()
            nb2 = db.query(Matiere).delete()
            db.commit()
            print(f"[FORCE] {nb} emplois et {nb2} matieres supprimes\n")

        # 4. Creation des matieres et emplois du temps
        prof_idx = 0
        total_mat = 0
        total_edt = 0

        for annee_scolaire, groupe, nb_etu in groupes_db:
            niveau_key = detecter_niveau(annee_scolaire)
            if not niveau_key:
                print(f"  [SKIP] niveau inconnu: {annee_scolaire!r}")
                continue

            matieres_def = MATIERES_NIVEAU[niveau_key]
            edt_def      = get_edt(groupe)
            salle_prefix = SALLE_PREFIX[niveau_key]

            created_mat = 0
            created_edt = 0

            for i, (nom, code, coeff) in enumerate(matieres_def):
                prof_id = prof_ids[prof_idx % len(prof_ids)]
                prof_idx += 1

                # Creer la matiere si elle n'existe pas
                mat = (db.query(Matiere)
                       .filter(Matiere.code == code,
                               Matiere.classe == groupe,
                               Matiere.annee_scolaire == annee_scolaire)
                       .first())
                if not mat:
                    mat = Matiere(
                        nom=nom,
                        code=code,
                        coefficient=coeff,
                        annee_scolaire=annee_scolaire,
                        classe=groupe,
                        professeur_id=prof_id,
                    )
                    db.add(mat)
                    db.flush()  # obtenir mat.id sans commit
                    created_mat += 1

                # Creneaux pour cette matiere
                creneaux = edt_def[i] if i < len(edt_def) else []
                for jour, slot_key, salle_sfx in creneaux:
                    hdeb, hfin = SLOTS[slot_key]
                    salle      = f"{salle_prefix}{salle_sfx}"
                    exists = (db.query(EmploiTemps)
                              .filter(EmploiTemps.matiere_id == mat.id,
                                      EmploiTemps.jour       == jour,
                                      EmploiTemps.heure_debut == hdeb)
                              .first())
                    if not exists:
                        db.add(EmploiTemps(
                            matiere_id  = mat.id,
                            classe      = groupe,
                            jour        = jour,
                            heure_debut = hdeb,
                            heure_fin   = hfin,
                            salle       = salle,
                        ))
                        created_edt += 1

            db.commit()
            total_mat += created_mat
            total_edt += created_edt
            prof = db.query(User).filter(User.id == prof_ids[(prof_idx - 1) % len(prof_ids)]).first()
            print(f"  {annee_scolaire} / {groupe} ({nb_etu} etu) "
                  f"-> {created_mat} matieres + {created_edt} creneaux EDT")

        print(f"\n[DONE] {total_mat} matieres creees, {total_edt} creneaux EDT crees")
        print(f"Total en base: {db.query(Matiere).count()} matieres, "
              f"{db.query(EmploiTemps).count()} creneaux EDT")

    except Exception as e:
        db.rollback()
        print(f"\nERREUR: {e}")
        import traceback; traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true",
                        help="Supprimer et recreer toutes les matieres/EDT")
    args = parser.parse_args()
    seed(force=args.force)
