from sqlalchemy import Column, String, Boolean, Float, DateTime, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from pgvector.sqlalchemy import Vector
import uuid

from config import Base

def utcnow():
    return datetime.now(timezone.utc)


class Student(Base):
    __tablename__ = "students"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nom         = Column(String(100), nullable=False)
    prenom      = Column(String(100), nullable=False)
    email       = Column(String(255), unique=True, nullable=False, index=True)
    classe      = Column(String(50),  nullable=True)
    is_enrolled = Column(Boolean, default=False)
    created_at  = Column(DateTime(timezone=True), default=utcnow)

    images = relationship(
        "StudentImage",
        back_populates="student",
        cascade="all, delete-orphan"
    )
    faces = relationship(
        "StudentFace",
        back_populates="student",
        cascade="all, delete-orphan"
    )


class StudentImage(Base):
    """
    Stocke les 20 images brutes capturées pendant l'enrôlement.
    Utilisées ensuite pour calculer l'embedding final.
    """
    __tablename__ = "student_images"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id    = Column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    image_url     = Column(String(500), nullable=False)   # URL Supabase Storage
    angle         = Column(String(20),  nullable=True)    # front, left, right, up, down...
    quality_score = Column(Float,       nullable=True)    # score netteté
    brightness    = Column(Float,       nullable=True)    # luminosité
    is_valid      = Column(Boolean,     default=True)     # image valide ou rejetée
    captured_at   = Column(DateTime(timezone=True), default=utcnow)

    student = relationship("Student", back_populates="images")


class StudentFace(Base):
    """
    Stocke l'embedding final calculé depuis les 20 images.
    Utilisé pour la reconnaissance en temps réel.
    """
    __tablename__ = "student_faces"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id    = Column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    embedding     = Column(Vector(512), nullable=False)   # moyenne des 20 embeddings
    det_score     = Column(Float,       nullable=True)    # score de confiance moyen
    nb_images     = Column(Integer,     default=20)       # nombre d'images utilisées
    created_at    = Column(DateTime(timezone=True), default=utcnow)

    student = relationship("Student", back_populates="faces")