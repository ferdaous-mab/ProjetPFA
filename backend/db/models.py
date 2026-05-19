from sqlalchemy import (
    Column, String, Boolean, Float, Integer,
    ForeignKey, DateTime, Date, Time, Text, CheckConstraint
)
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.dialects.postgresql import UUID
from pgvector.sqlalchemy import Vector
from datetime import datetime, timezone
import uuid

Base = declarative_base()


# ─── ÉTUDIANTS ────────────────────────────────────────────────────────────────

class Student(Base):
    __tablename__ = "students"

    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nom            = Column(String, nullable=False)
    prenom         = Column(String, nullable=False)
    email          = Column(String, unique=True, nullable=False)
    classe         = Column(String(10), nullable=False)
    annee_scolaire = Column(String(20), nullable=False)
    is_enrolled    = Column(Boolean, default=False)
    created_at     = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Informations personnelles
    telephone      = Column(String(20),  nullable=True)
    date_naissance = Column(Date,        nullable=True)
    lieu_naissance = Column(String(100), nullable=True)
    sexe           = Column(String(1),   nullable=True)   # M / F
    adresse        = Column(String(200), nullable=True)
    ville          = Column(String(100), nullable=True)
    cin            = Column(String(20),  nullable=True)   # Carte d'identité nationale
    numero_carte   = Column(String(30),  nullable=True)   # Numéro carte étudiant

    # Informations du père
    nom_pere        = Column(String(100), nullable=True)
    tel_pere        = Column(String(20),  nullable=True)

    # Informations de la mère
    nom_mere        = Column(String(100), nullable=True)
    tel_mere        = Column(String(20),  nullable=True)

    # Contact parent général
    email_parent    = Column(String(100), nullable=True)

    # Relations
    faces       = relationship("StudentFace",     back_populates="student", cascade="all, delete")
    faces_temp  = relationship("StudentFaceTemp", back_populates="student", cascade="all, delete")
    images      = relationship("StudentImage",    back_populates="student", cascade="all, delete")
    user        = relationship("User",            back_populates="student", uselist=False)
    attendances = relationship("Attendance",      back_populates="student", cascade="all, delete")
    grades      = relationship("Grade",           back_populates="student", cascade="all, delete")
    alerts      = relationship("Alert",           back_populates="student", cascade="all, delete")


class StudentFace(Base):
    """Embedding facial final — 1 seul par étudiant."""
    __tablename__ = "student_faces"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    embedding  = Column(Vector(512), nullable=False)
    det_score  = Column(Float)
    nb_images  = Column(Integer, default=5)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    student = relationship("Student", back_populates="faces")


class StudentFaceTemp(Base):
    """Embeddings temporaires pendant l'enrôlement — supprimés après finalisation."""
    __tablename__ = "student_faces_temp"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id    = Column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    embedding     = Column(Vector(512), nullable=False)
    det_score     = Column(Float)
    quality_score = Column(Float)
    captured_at   = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    student = relationship("Student", back_populates="faces_temp")


class StudentImage(Base):
    """
    Images des étudiants stockées sur Cloudinary.
    Un étudiant peut avoir plusieurs photos (5 angles).
    """
    __tablename__ = "student_images"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    url        = Column(String, nullable=False)       # URL Cloudinary
    angle      = Column(String(20), nullable=True)    # centre | droite | gauche | haut | bas
    is_primary = Column(Boolean, default=False)       # photo principale (avatar)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    student = relationship("Student", back_populates="images")


# ─── UTILISATEURS & RÔLES ────────────────────────────────────────────────────

class User(Base):
    """Comptes utilisateurs avec 3 rôles : admin, professeur, etudiant."""
    __tablename__ = "users"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email         = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role          = Column(String(20), nullable=False)
    student_id    = Column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="SET NULL"), nullable=True)
    nom           = Column(String, nullable=False)
    prenom        = Column(String, nullable=False)
    is_active     = Column(Boolean, default=True)
    created_at    = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        CheckConstraint("role IN ('admin', 'professeur', 'etudiant')", name="check_role"),
    )

    student  = relationship("Student", back_populates="user")
    matieres = relationship("Matiere", back_populates="professeur")


# ─── GESTION ACADÉMIQUE ───────────────────────────────────────────────────────

class Matiere(Base):
    """Matières / cours par classe."""
    __tablename__ = "matieres"

    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nom            = Column(String, nullable=False)
    code           = Column(String(10), nullable=True)
    coefficient    = Column(Float, default=1.0)
    annee_scolaire = Column(String(20), nullable=True)
    classe         = Column(String(10), nullable=True)
    professeur_id  = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at     = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    professeur    = relationship("User", back_populates="matieres")
    emplois_temps = relationship("EmploiTemps", back_populates="matiere", cascade="all, delete")
    sessions      = relationship("Session",     back_populates="matiere", cascade="all, delete")
    grades        = relationship("Grade",       back_populates="matiere", cascade="all, delete")


class EmploiTemps(Base):
    """Planning hebdomadaire par classe."""
    __tablename__ = "emplois_temps"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    matiere_id  = Column(UUID(as_uuid=True), ForeignKey("matieres.id", ondelete="CASCADE"), nullable=False)
    classe      = Column(String(10), nullable=False)
    jour        = Column(String(10), nullable=False)   # Lundi | Mardi | ...
    heure_debut = Column(Time, nullable=False)
    heure_fin   = Column(Time, nullable=False)
    salle       = Column(String(20), nullable=True)
    created_at  = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    matiere = relationship("Matiere", back_populates="emplois_temps")


class Session(Base):
    """Séance de cours réelle avec présences."""
    __tablename__ = "sessions"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    matiere_id  = Column(UUID(as_uuid=True), ForeignKey("matieres.id", ondelete="CASCADE"), nullable=False)
    classe      = Column(String(10), nullable=False)
    date        = Column(Date, nullable=False)
    heure_debut = Column(Time, nullable=True)
    heure_fin   = Column(Time, nullable=True)
    salle       = Column(String(20), nullable=True)
    video_url   = Column(String, nullable=True)        # URL vidéo analysée
    status      = Column(String(20), default="planifiee")  # planifiee | en_cours | terminee
    created_at  = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    matiere     = relationship("Matiere",    back_populates="sessions")
    attendances = relationship("Attendance", back_populates="session", cascade="all, delete")


class Attendance(Base):
    """Présences par étudiant et par séance."""
    __tablename__ = "attendances"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id  = Column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    session_id  = Column(UUID(as_uuid=True), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False)
    status      = Column(String(20), default="absent")  # present | absent | retard
    detected_at = Column(DateTime(timezone=True), nullable=True)
    confidence  = Column(Float, nullable=True)
    created_at  = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    student = relationship("Student", back_populates="attendances")
    session = relationship("Session", back_populates="attendances")


class Grade(Base):
    """Notes par étudiant et par matière."""
    __tablename__ = "grades"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id  = Column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    matiere_id  = Column(UUID(as_uuid=True), ForeignKey("matieres.id", ondelete="CASCADE"), nullable=False)
    note        = Column(Float, nullable=False)           # 0 à 20
    type        = Column(String(20), default="controle")  # controle | examen | tp
    date        = Column(Date, default=lambda: datetime.now(timezone.utc).date())
    commentaire = Column(Text, nullable=True)
    created_at  = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    student = relationship("Student", back_populates="grades")
    matiere = relationship("Matiere", back_populates="grades")


class PasswordResetToken(Base):
    """Tokens de réinitialisation de mot de passe (usage unique, expire en 15 min)."""
    __tablename__ = "password_reset_tokens"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id    = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token      = Column(String(64), unique=True, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used       = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class Alert(Base):
    """Alertes IA pour professeurs et admins."""
    __tablename__ = "alerts"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id  = Column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    type        = Column(String(30), nullable=False)   # absences_excessives | notes_faibles | risque_echec
    message     = Column(Text, nullable=False)
    severity    = Column(String(10), default="medium") # low | medium | high
    is_read     = Column(Boolean, default=False)
    target_role = Column(String(20), nullable=False)   # professeur | admin | etudiant
    created_at  = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    student = relationship("Student", back_populates="alerts")