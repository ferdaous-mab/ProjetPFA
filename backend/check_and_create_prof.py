"""
Script utilitaire pour afficher les comptes existants et créer un prof de test.
Exécuter depuis backend\ : python check_and_create_prof.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from config import SessionLocal
from db.models import User
from auth.jwt_handler import hash_password

db = SessionLocal()

# --- Afficher les comptes existants ---
print("\n=== COMPTES EXISTANTS ===")
users = db.query(User).all()
if not users:
    print("  (aucun compte en base)")
else:
    for u in users:
        print(f"  [{u.role:12}]  {u.email:40}  actif={u.is_active}")

# --- Créer un prof si demandé ---
EMAIL    = "prof@smartcampus.ma"
PASSWORD = "prof1234"
NOM      = "Professeur"
PRENOM   = "Test"

existing = db.query(User).filter(User.email == EMAIL).first()
if existing:
    print(f"\n[INFO] Compte {EMAIL} existe déjà (role={existing.role})")
    print(f"       Remise à zéro du mot de passe → {PASSWORD}")
    existing.password_hash = hash_password(PASSWORD)
    existing.is_active = True
    db.commit()
else:
    prof = User(
        email         = EMAIL,
        password_hash = hash_password(PASSWORD),
        role          = "professeur",
        nom           = NOM,
        prenom        = PRENOM,
        is_active     = True,
    )
    db.add(prof)
    db.commit()
    print(f"\n[OK] Compte professeur créé :")

print(f"     Email    : {EMAIL}")
print(f"     Password : {PASSWORD}")
print(f"     Role     : professeur\n")

db.close()
