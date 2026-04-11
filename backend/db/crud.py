from sqlalchemy.orm import Session
from db.models import Student, StudentFace, StudentFaceTemp
import numpy as np

# ─── STUDENTS ────────────────────────────────────────────────────────────────

def create_student(db: Session, nom: str, prenom: str, email: str, classe: str, annee_scolaire: str):
    student = Student(
        nom=nom,
        prenom=prenom,
        email=email,
        classe=classe,
        annee_scolaire=annee_scolaire
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

def get_all_students(db: Session):
    return db.query(Student).all()

# ─── STUDENT FACES TEMP ───────────────────────────────────────────────────────

def create_temp_embedding(db: Session, student_id, embedding, det_score: float, quality_score: float):
    temp = StudentFaceTemp(
        student_id=student_id,
        embedding=embedding.tolist(),
        det_score=det_score,
        quality_score=quality_score
    )
    db.add(temp)
    db.commit()
    db.refresh(temp)
    return temp

def get_temp_embeddings(db: Session, student_id):
    return db.query(StudentFaceTemp).filter(
        StudentFaceTemp.student_id == student_id
    ).all()

def count_temp_embeddings(db: Session, student_id) -> int:
    return db.query(StudentFaceTemp).filter(
        StudentFaceTemp.student_id == student_id
    ).count()

def delete_temp_embeddings(db: Session, student_id):
    db.query(StudentFaceTemp).filter(
        StudentFaceTemp.student_id == student_id
    ).delete()
    db.commit()

# ─── STUDENT FACES FINAL ─────────────────────────────────────────────────────

def create_student_face(db: Session, student_id, embedding, det_score: float, nb_images: int = 15):
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

def get_all_faces(db: Session):
    return db.query(StudentFace).all()

def get_student_face(db: Session, student_id):
    return db.query(StudentFace).filter(
        StudentFace.student_id == student_id
    ).first()


def update_student_face(db: Session, student_id, embedding, det_score: float):
    """Met à jour l'embedding d'un étudiant existant — recalibrage"""
    face = get_student_face(db, student_id)
    if face:
        face.embedding  = embedding.tolist()
        face.det_score  = det_score
        db.commit()
        db.refresh(face)
    return face