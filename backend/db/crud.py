from sqlalchemy.orm import Session
from db.models import Student, StudentFace, StudentImage
import numpy as np

# ─── STUDENTS ────────────────────────────────────────────────────────────────

def create_student(db: Session, nom: str, prenom: str, email: str, classe: str):
    student = Student(
        nom=nom,
        prenom=prenom,
        email=email,
        classe=classe
    )
    db.add(student)
    db.commit()
    db.refresh(student)
    return student

def get_student_by_email(db: Session, email: str):
    return db.query(Student).filter(Student.email == email).first()

def get_student_by_id(db: Session, student_id):
    return db.query(Student).filter(Student.id == student_id).first()

def update_enrolled(db: Session, student_id):
    student = get_student_by_id(db, student_id)
    if student:
        student.is_enrolled = True
        db.commit()
        db.refresh(student)
    return student

# ─── STUDENT IMAGES ──────────────────────────────────────────────────────────

def create_student_image(
    db: Session,
    student_id,
    image_url: str,
    angle: str,
    quality_score: float,
    brightness: float,
    is_valid: bool = True
):
    """Sauvegarde une image capturée pendant l'enrôlement"""
    image = StudentImage(
        student_id=student_id,
        image_url=image_url,
        angle=angle,
        quality_score=quality_score,
        brightness=brightness,
        is_valid=is_valid
    )
    db.add(image)
    db.commit()
    db.refresh(image)
    return image

def get_student_images(db: Session, student_id):
    """Récupère toutes les images valides d'un étudiant"""
    return db.query(StudentImage).filter(
        StudentImage.student_id == student_id,
        StudentImage.is_valid == True
    ).all()

def count_student_images(db: Session, student_id) -> int:
    """Compte les images valides d'un étudiant"""
    return db.query(StudentImage).filter(
        StudentImage.student_id == student_id,
        StudentImage.is_valid == True
    ).count()

# ─── STUDENT FACES ───────────────────────────────────────────────────────────

def create_student_face(
    db: Session,
    student_id,
    embedding,
    det_score: float,
    nb_images: int = 20
):
    """Sauvegarde l'embedding final calculé depuis les 20 images"""
    face = StudentFace(
        student_id=student_id,
        embedding=embedding.tolist(),
        det_score=det_score,
        nb_images=nb_images
    )
    db.add(face)
    db.commit()
    db.refresh(face)
    return face

def get_student_face(db: Session, student_id):
    """Récupère l'embedding d'un étudiant"""
    return db.query(StudentFace).filter(
        StudentFace.student_id == student_id
    ).first()

def get_all_faces(db: Session):
    """Récupère tous les embeddings pour la reconnaissance"""
    return db.query(StudentFace).all()