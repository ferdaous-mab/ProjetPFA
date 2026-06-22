# -*- coding: utf-8 -*-
"""
Seed emplois du temps + matieres pour 3eme Annee (groupes A, B, C)
Supprime TOUS les emplois et matieres existants avant insertion.
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

ANNEE = "3ème année"   # 3ème année

# Matieres 3eme annee (noms corrects avec accents)
SUBJECTS = [
    "Projet PFA",
    "Business Intelligence",
    "Administration Systèmes Unix",      # Systèmes
    "UML",
    "Interconnexion réseaux",             # réseaux
    "DotNet",
    "Analyse de Données II",              # Données
    "Anglais",
    "Langage Java Avancée / WEB",         # Avancée
    "TEC/Droit, Civisme et Citoyenneté",  # Citoyenneté
]

# (classe, jour, matiere_nom, heure_debut, heure_fin, salle)
EMPLOIS = [

    # ========== GROUPE A ==========
    ("A", "Lundi",    "Projet PFA",                                   "09:00", "12:00", "LABO"),
    ("A", "Lundi",    "Business Intelligence",                         "14:30", "16:30", "Salle 15"),
    ("A", "Mardi",    "Administration Systèmes Unix",             "08:30", "10:00", "Salle 12"),
    ("A", "Mardi",    "UML",                                           "10:30", "12:00", "Salle 15"),
    ("A", "Mardi",    "Interconnexion réseaux",                   "14:30", "17:30", "Salle 13"),
    ("A", "Mercredi", "DotNet",                                        "08:30", "10:00", "Salle 15"),
    ("A", "Mercredi", "Analyse de Données II",                    "10:30", "12:00", "Salle 11"),
    ("A", "Jeudi",    "Anglais",                                       "10:30", "12:00", "Salle 17"),
    ("A", "Jeudi",    "Langage Java Avancée / WEB",               "14:30", "18:30", "Salle 14"),
    ("A", "Vendredi", "TEC/Droit, Civisme et Citoyenneté",        "10:30", "12:00", "Salle 18"),
    ("A", "Vendredi", "Langage Java Avancée / WEB",               "14:30", "16:00", "Salle 14"),
    ("A", "Vendredi", "Analyse de Données II",                    "16:30", "18:00", "Salle 11"),

    # ========== GROUPE B ==========
    ("B", "Lundi",    "Projet PFA",                                   "09:00", "12:00", "LABO"),
    ("B", "Lundi",    "Analyse de Données II",                    "14:30", "16:00", "Salle 14"),
    ("B", "Lundi",    "Business Intelligence",                         "16:30", "18:00", "Salle 15"),
    ("B", "Mardi",    "UML",                                           "08:30", "10:00", "Salle 15"),
    ("B", "Mardi",    "Administration Systèmes Unix",             "10:30", "12:00", "Salle 12"),
    ("B", "Mardi",    "Langage Java Avancée / WEB",               "14:30", "18:30", "Salle 14"),
    ("B", "Mercredi", "Langage Java Avancée / WEB",               "08:30", "10:00", "Salle 14"),
    ("B", "Mercredi", "DotNet",                                        "10:30", "12:00", "Salle 15"),
    ("B", "Jeudi",    "TEC/Droit, Civisme et Citoyenneté",        "10:30", "12:00", "Salle 26"),
    ("B", "Jeudi",    "Interconnexion réseaux",                   "14:30", "17:30", "Salle 13"),
    ("B", "Vendredi", "Analyse de Données II",                    "08:30", "10:00", "Salle 11"),
    ("B", "Vendredi", "Anglais",                                       "10:30", "12:00", "Salle 17"),

    # ========== GROUPE C ==========
    ("C", "Lundi",    "Projet PFA",                                   "09:00", "12:00", "LABO"),
    ("C", "Lundi",    "TEC/Droit, Civisme et Citoyenneté",        "14:30", "16:00", "Salle 16"),
    ("C", "Mardi",    "Langage Java Avancée / WEB",               "08:30", "12:00", "Salle 14"),
    ("C", "Mardi",    "Business Intelligence",                         "14:30", "16:00", "Salle 11"),
    ("C", "Mercredi", "Analyse de Données II",                    "08:30", "10:00", "Salle 15"),
    ("C", "Mercredi", "Langage Java Avancée / WEB",               "10:30", "12:00", "Salle 14"),
    ("C", "Mercredi", "Interconnexion réseaux",                   "14:30", "16:30", "Salle 13"),
    ("C", "Jeudi",    "UML",                                           "08:30", "10:00", "Salle 15"),
    ("C", "Jeudi",    "DotNet",                                        "10:30", "12:00", "Salle 15"),
    ("C", "Jeudi",    "Administration Systèmes Unix",             "16:30", "18:00", "Salle 12"),
    ("C", "Vendredi", "Anglais",                                       "08:30", "10:00", "Salle 17"),
    ("C", "Vendredi", "Analyse de Données II",                    "10:30", "12:00", "Salle 11"),
]


def run():
    print("[DEL] Suppression emplois du temps...")
    nb_e = db.query(EmploiTemps).delete()
    print("   %d emplois supprimes." % nb_e)

    print("[DEL] Suppression matieres...")
    nb_m = db.query(Matiere).delete()
    print("   %d matieres supprimees." % nb_m)
    db.flush()

    print("\n[MATIERES] Creation (%s)..." % ANNEE)
    mat_map = {}
    for nom in SUBJECTS:
        m = Matiere(nom=nom, annee_scolaire=ANNEE, coefficient=1.0)
        db.add(m)
        db.flush()
        mat_map[nom] = m
        print("   + " + nom)

    print("\n[EMPLOIS] Creation...")
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
        print("   + %s | %-10s | %-45s | %s-%s | %s" % (
            "3eme " + classe, jour, mat_nom, h_debut, h_fin, salle))

    db.commit()
    print("\nOK : %d emplois crees pour %d matieres." % (len(EMPLOIS), len(SUBJECTS)))


if __name__ == "__main__":
    try:
        run()
    except Exception as ex:
        db.rollback()
        print("ERREUR : " + str(ex))
        raise
    finally:
        db.close()
