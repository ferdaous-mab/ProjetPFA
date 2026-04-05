from sqlalchemy import Column, String, Boolean, Float, DateTime, ForeignKey
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

    faces = relationship(
        "StudentFace",
        back_populates="student",
        cascade="all, delete-orphan"
    )

class StudentFace(Base):
    __tablename__ = "student_faces"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id    = Column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    embedding     = Column(Vector(512), nullable=False)
    det_score     = Column(Float, nullable=True)
    angle         = Column(String(20), nullable=True)
    quality_score = Column(Float, nullable=True)
    captured_at   = Column(DateTime(timezone=True), default=utcnow)

    student = relationship("Student", back_populates="faces")