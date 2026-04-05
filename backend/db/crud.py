from sqlalchemy.orm import Session
from db.models import Student, StudentFace

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

# ─── STUDENT FACES ───────────────────────────────────────────────────────────

def create_student_face(
    db: Session,
    student_id,
    embedding,
    angle: str,
    quality_score: float,
    det_score: float
):
    face = StudentFace(
        student_id=student_id,
        embedding=embedding.tolist(),
        angle=angle,
        quality_score=quality_score,
        det_score=det_score
    )
    db.add(face)
    db.commit()
    db.refresh(face)
    return face

def count_student_faces(db: Session, student_id) -> int:
    return db.query(StudentFace).filter(
        StudentFace.student_id == student_id
    ).count()