import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

load_dotenv()

# ── Neon PostgreSQL ───────────────────────────────────────────────────────────
DATABASE_URL = os.getenv("DB_URL")

if not DATABASE_URL:
    raise ValueError("DB_URL manquant dans le .env")

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping  = True,
    pool_recycle   = 300,
    pool_size      = 5,
    max_overflow   = 10,
    echo           = False,
)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)

# ── Auth JWT ──────────────────────────────────────────────────────────────────
SECRET_KEY                  = os.getenv("SECRET_KEY", "changeme_minimum_32_chars")
ALGORITHM                   = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 60))

# ── Claude API ────────────────────────────────────────────────────────────────
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")

# ── CORS ──────────────────────────────────────────────────────────────────────
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Créer toutes les tables + activer pgvector + appliquer migrations."""
    from db.models import Base
    with engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        # Migration : ON DELETE SET NULL → CASCADE sur users.student_id
        # N'affecte pas les données existantes, seulement les futures suppressions.
        # Idempotent : peut être relancé sans risque.
        try:
            conn.execute(text(
                "ALTER TABLE users DROP CONSTRAINT IF EXISTS users_student_id_fkey"
            ))
            conn.execute(text(
                "ALTER TABLE users ADD CONSTRAINT users_student_id_fkey "
                "FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE"
            ))
        except Exception:
            conn.rollback()
        conn.commit()
    Base.metadata.create_all(bind=engine)
    print("DB initialisée ✅")