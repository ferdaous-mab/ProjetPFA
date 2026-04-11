from sqlalchemy import Column, String, Boolean, Float, Integer, ForeignKey, DateTime
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.dialects.postgresql import UUID
from pgvector.sqlalchemy import Vector
from datetime import datetime, timezone
import uuid

Base = declarative_base()


class Student(Base):
    __tablename__ = "students"

    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nom            = Column(String, nullable=False)
    prenom         = Column(String, nullable=False)
    email          = Column(String, unique=True, nullable=False)
    classe         = Column(String(10), nullable=False)
    annee_scolaire = Column(String(20), nullable=False)
    is_enrolled    = Column(Boolean, default=False)
    created_at     = Column(DateTime(timezone=True),
                            default=lambda: datetime.now(timezone.utc))

    faces      = relationship("StudentFace",     back_populates="student", cascade="all, delete")
    faces_temp = relationship("StudentFaceTemp", back_populates="student", cascade="all, delete")


class StudentFace(Base):
    __tablename__ = "student_faces"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False)
    embedding  = Column(Vector(512), nullable=False)
    det_score  = Column(Float)
    nb_images  = Column(Integer, default=5)
    photo_url  = Column(String, nullable=True)   # ← URL photo principale (Supabase Storage)
    created_at = Column(DateTime(timezone=True),
                        default=lambda: datetime.now(timezone.utc))

    student = relationship("Student", back_populates="faces")


class StudentFaceTemp(Base):
    __tablename__ = "student_faces_temp"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id    = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False)
    embedding     = Column(Vector(512), nullable=False)
    det_score     = Column(Float)
    quality_score = Column(Float)
    image_url     = Column(String, nullable=True)   # ← URL frame dans Supabase Storage
    captured_at   = Column(DateTime(timezone=True),
                           default=lambda: datetime.now(timezone.utc))

    student = relationship("Student", back_populates="faces_temp")