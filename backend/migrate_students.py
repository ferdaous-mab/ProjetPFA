"""
Script de migration : ajoute les nouvelles colonnes à la table students.
Lancer UNE SEULE FOIS : python migrate_students.py
"""
from config import engine
from sqlalchemy import text

MIGRATIONS = [
    "ALTER TABLE students ADD COLUMN IF NOT EXISTS telephone       VARCHAR(20)",
    "ALTER TABLE students ADD COLUMN IF NOT EXISTS date_naissance  DATE",
    "ALTER TABLE students ADD COLUMN IF NOT EXISTS lieu_naissance  VARCHAR(100)",
    "ALTER TABLE students ADD COLUMN IF NOT EXISTS sexe            VARCHAR(1)",
    "ALTER TABLE students ADD COLUMN IF NOT EXISTS adresse         VARCHAR(200)",
    "ALTER TABLE students ADD COLUMN IF NOT EXISTS ville           VARCHAR(100)",
    "ALTER TABLE students ADD COLUMN IF NOT EXISTS cin             VARCHAR(20)",
    "ALTER TABLE students ADD COLUMN IF NOT EXISTS matricule       VARCHAR(30)",
    "ALTER TABLE students ADD COLUMN IF NOT EXISTS nom_pere        VARCHAR(100)",
    "ALTER TABLE students ADD COLUMN IF NOT EXISTS tel_pere        VARCHAR(20)",
    "ALTER TABLE students ADD COLUMN IF NOT EXISTS profession_pere VARCHAR(100)",
    "ALTER TABLE students ADD COLUMN IF NOT EXISTS nom_mere        VARCHAR(100)",
    "ALTER TABLE students ADD COLUMN IF NOT EXISTS tel_mere        VARCHAR(20)",
    "ALTER TABLE students ADD COLUMN IF NOT EXISTS email_parent    VARCHAR(100)",
]

if __name__ == "__main__":
    with engine.connect() as conn:
        for sql in MIGRATIONS:
            print(f"+ {sql.split('ADD COLUMN')[1].strip().split()[0]}...", end=" ")
            conn.execute(text(sql))
            print("OK")
        conn.commit()
    print("\n✅ Migration terminée avec succès !")
