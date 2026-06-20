"""
Seed emplois du temps + matières pour 3ème Année (groupes A, B, C)
⚠️  Supprime TOUS les emplois et matières existants avant d'insérer.
Usage : python seed_emplois_3eme.py
"""
import os, sys
from dotenv import load_dotenv

load_dotenv()
sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from db.models import Matiere, EmploiTemps

engine  = create_engine(os.getenv("DB_URL"))
Session = sessionmaker(bind=engine)
db      = Session()

ANNEE = "3ème année"

# ── Matières 3ème année ────────────────────────────────────────────────────────
SUBJECTS = [
    "Analyse Numérique II",
    "Python Avancé",
    "Analyse de Données I",
    "Recherche Opérationnelle",
    "Langage Java",
    "Anglais",
    "Langage C#",
    "Systèmes d'Information",
    "Systèmes de Gestion de Contenu (CMS)",
    "Programmation R",
    "Systèmes d'Exploitation",
]

# ── Emplois du temps : (classe, jour, matiere_nom, heure_debut, heure_fin, salle) ──
# Groupe A — Image 1
# Groupe B — Image 2
# Groupe C — Image 3
EMPLOIS = [
    # ═══ 3ème A ══════════════════════════════════════════════════════════════
    ("A", "Lundi",    "Systèmes de Gestion de Contenu (CMS)", "09:00", "11:00", "Salle 24"),
    ("A", "Lundi",    "Recherche Opérationnelle",              "15:00", "18:30", "Salle 16"),

    ("A", "Mardi",    "Analyse Numérique II",                  "08:30", "10:00", "Salle 11"),
    ("A", "Mardi",    "Python Avancé",                         "10:30", "12:00", "Salle 12"),
    ("A", "Mardi",    "Systèmes d'Information",                "14:00", "17:00", "Salle 13"),

    ("A", "Jeudi",    "Anglais",                               "08:30", "10:00", "Salle 17"),
    ("A", "Jeudi",    "Langage C#",                            "10:30", "12:00", "Salle 15"),
    ("A", "Jeudi",    "Analyse Numérique II",                  "14:30", "16:00", "Salle 13"),
    ("A", "Jeudi",    "Langage Java",                          "16:30", "18:30", "Salle 14"),

    ("A", "Vendredi", "Programmation R",                       "08:30", "10:00", "Salle 101"),
    ("A", "Vendredi", "Analyse de Données I",                  "10:30", "12:00", "Salle 16"),
    ("A", "Vendredi", "Systèmes d'Exploitation",               "14:30", "16:00", "Salle 14"),
    ("A", "Vendredi", "Analyse de Données I",                  "16:30", "18:00", "Salle 16"),

    # ═══ 3ème B ══════════════════════════════════════════════════════════════
    ("B", "Lundi",    "Analyse Numérique II",                  "08:30", "10:00", "Salle 13"),
    ("B", "Lundi",    "Analyse Numérique II",                  "10:30", "12:00", "Salle 13"),

    ("B", "Mardi",    "Python Avancé",                         "09:00", "10:30", "Salle 12"),
    ("B", "Mardi",    "Analyse de Données I",                  "10:30", "12:00", "Salle 15"),
    ("B", "Mardi",    "Langage Java",                          "14:00", "16:30", "Salle 14"),

    ("B", "Mercredi", "Recherche Opérationnelle",              "09:00", "11:30", "Salle 16"),
    ("B", "Mercredi", "Langage C#",                            "16:30", "18:30", "Salle 15"),

    ("B", "Jeudi",    "Programmation R",                       "08:30", "10:00", "Salle 101"),
    ("B", "Jeudi",    "Analyse de Données I",                  "10:30", "12:00", "Salle 101"),
    ("B", "Jeudi",    "Systèmes d'Information",                "14:00", "16:30", "Salle 13"),

    ("B", "Vendredi", "Systèmes de Gestion de Contenu (CMS)", "09:00", "12:00", "Salle 24"),
    ("B", "Vendredi", "Anglais",                               "14:30", "16:00", "Salle 17"),
    ("B", "Vendredi", "Systèmes d'Exploitation",               "16:00", "18:00", "Salle 14"),

    # ═══ 3ème C ══════════════════════════════════════════════════════════════
    ("C", "Lundi",    "Recherche Opérationnelle",              "09:00", "11:30", "Salle 16"),
    ("C", "Lundi",    "Programmation R",                       "14:00", "15:30", "Salle 101"),

    ("C", "Mardi",    "Analyse Numérique II",                  "10:30", "12:00", "Salle 13"),
    ("C", "Mardi",    "Python Avancé",                         "14:00", "16:30", "Salle 12"),

    ("C", "Mercredi", "Analyse de Données I",                  "08:30", "10:00", "Salle 15"),
    ("C", "Mercredi", "Systèmes d'Exploitation",               "10:30", "12:00", "Salle 14"),
    ("C", "Mercredi", "Systèmes d'Information",                "14:00", "16:30", "Salle 13"),

    ("C", "Jeudi",    "Langage C#",                            "08:30", "10:00", "Salle 15"),
    ("C", "Jeudi",    "Anglais",                               "10:30", "12:00", "Salle 17"),
    ("C", "Jeudi",    "Langage Java",                          "14:00", "16:30", "Salle 14"),

    ("C", "Vendredi", "Analyse de Données I",                  "08:30", "10:00", "Salle 15"),
    ("C", "Vendredi", "Analyse Numérique II",                  "10:30", "12:00", "Salle 13"),
    ("C", "Vendredi", "Systèmes de Gestion de Contenu (CMS)", "14:00", "16:30", "Salle 24"),
]


def run():
    # ── 1. Supprimer TOUS les emplois et matières existants ──────────────────
    print("[DEL] Suppression de tous les emplois du temps...")
    nb_e = db.query(EmploiTemps).delete()
    print(f"   {nb_e} emplois supprimés.")

    print("[DEL] Suppression de toutes les matieres...")
    nb_m = db.query(Matiere).delete()
    print(f"   {nb_m} matières supprimées.")
    db.flush()

    # ── 2. Créer les matières de 3ème année ──────────────────────────────────
    print(f"\n[MATIERES] Creation des matieres ({ANNEE})...")
    mat_map = {}
    for nom in SUBJECTS:
        m = Matiere(nom=nom, annee_scolaire=ANNEE, coefficient=1.0)
        db.add(m)
        db.flush()
        mat_map[nom] = m
        print(f"   + {nom}")

    # ── 3. Créer les emplois du temps ────────────────────────────────────────
    print(f"\n[EMPLOIS] Creation des emplois du temps...")
    for classe, jour, mat_nom, h_debut, h_fin, salle in EMPLOIS:
        mat = mat_map[mat_nom]
        e = EmploiTemps(
            matiere_id  = mat.id,
            classe      = classe,
            jour        = jour,
            heure_debut = h_debut,
            heure_fin   = h_fin,
            salle       = salle,
        )
        db.add(e)
        print(f"   + 3eme {classe} | {jour:10} | {mat_nom:45} | {h_debut}-{h_fin} | {salle}")

    db.commit()
    print(f"\nOK : {len(EMPLOIS)} emplois crees pour {len(SUBJECTS)} matieres.")


if __name__ == "__main__":
    try:
        run()
    except Exception as e:
        db.rollback()
        print(f"\nERREUR : {e}")
        raise
    finally:
        db.close()
