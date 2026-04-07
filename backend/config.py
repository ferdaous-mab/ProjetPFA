import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Charger les variables depuis .env
load_dotenv()

# --- Variables de connexion DB ---
DB_USER     = os.getenv("DB_USER", "postgres")       # fallback si vide
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_HOST     = os.getenv("DB_HOST", "localhost")
DB_PORT     = os.getenv("DB_PORT", "5432")           # fallback sur 5432 si vide
DB_NAME     = os.getenv("DB_NAME", "postgres")

# Vérification rapide (debug, à supprimer après)
print(f"DB_USER={DB_USER}, DB_HOST={DB_HOST}, DB_PORT={DB_PORT}, DB_NAME={DB_NAME}")

# --- Supabase (optionnel) ---
SUPABASE_URL    = os.getenv("SUPABASE_URL")
SUPABASE_KEY    = os.getenv("SUPABASE_KEY")
SUPABASE_BUCKET = os.getenv("SUPABASE_BUCKET")

# --- URL de connexion SQLAlchemy (PostgreSQL) ---
DATABASE_URL = (
    f"postgresql+psycopg2://{DB_USER}:{DB_PASSWORD}"
    f"@{DB_HOST}:{DB_PORT}/{DB_NAME}"
)

# --- Engine SQLAlchemy ---
engine = create_engine(
    DATABASE_URL,
    connect_args={"sslmode": "require"}  # SSL obligatoire pour Supabase
)

# --- Session ---
SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False
)

# --- Base ORM ---
Base = declarative_base()

# --- Dependency FastAPI ---
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()