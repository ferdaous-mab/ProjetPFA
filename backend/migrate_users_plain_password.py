"""
Migration : ajoute la colonne plain_password à la table users.
Lancer UNE SEULE FOIS : python migrate_users_plain_password.py
"""
from config import engine
from sqlalchemy import text

if __name__ == "__main__":
    with engine.connect() as conn:
        conn.execute(text(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS plain_password VARCHAR(200)"
        ))
        conn.commit()
    print("✅ Colonne plain_password ajoutée à la table users.")
