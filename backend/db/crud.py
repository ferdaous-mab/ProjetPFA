from sqlalchemy.orm import Session
from sqlalchemy import func
from db.models import (
    Student, StudentFace, StudentFaceTemp, StudentImage,
    User, Matiere, EmploiTemps, Session as SessionModel,
    Attendance, Grade, Alert
)
from datetime import datetime, timezone
import uuid


# ─── STUDENTS ────────────────────────────────────────────────────────────────

def create_student(db: Session, nom: str, prenom: str, email: str,
                   classe: str, annee_scolaire: str) -> Student:
    student = Student(nom=nom, prenom=prenom, email=email,
                      classe=classe, annee_scolaire=annee_scolaire)
    db.add(student)
    db.commit()
    db.refresh(student)
    return student


def get_student_by_email(db: Session, email: str) -> Student | None:
    return db.query(Student).filter(Student.email == email).first()


def get_student_by_id(db: Session, student_id) -> Student | None:
    return db.query(Student).filter(Student.id == student_id).first()


def get_all_students(db: Session) -> list[Student]:
    return db.query(Student).all()


def get_students_by_classe(db: Session, classe: str) -> list[Student]:
    return db.query(Student).filter(Student.classe == classe).all()


def update_enrolled(db: Session, student_id) -> Student | None:
    student = get_student_by_id(db, student_id)
    if student:
        student.is_enrolled = True
        db.commit()
        db.refresh(student)
    return student


def delete_student(db: Session, student_id) -> bool:
    student = get_student_by_id(db, student_id)
    if student:
        db.delete(student)
        db.commit()
        return True
    return False


# ─── STUDENT FACES ───────────────────────────────────────────────────────────

def create_student_face(db: Session, student_id, embedding,
                        det_score: float, nb_images: int = 35) -> StudentFace:
    emb  = embedding.tolist() if hasattr(embedding, "tolist") else embedding
    face = StudentFace(student_id=student_id, embedding=emb,
                       det_score=det_score, nb_images=nb_images)
    db.add(face)
    db.commit()
    db.refresh(face)
    return face


def get_student_face(db: Session, student_id) -> StudentFace | None:
    return db.query(StudentFace).filter(
        StudentFace.student_id == student_id).first()


def get_all_faces(db: Session) -> list[StudentFace]:
    return db.query(StudentFace).all()


def update_student_face(db: Session, student_id, embedding,
                        det_score: float) -> StudentFace | None:
    face = get_student_face(db, student_id)
    if face:
        emb          = embedding.tolist() if hasattr(embedding, "tolist") else embedding
        face.embedding = emb
        face.det_score = det_score
        db.commit()
        db.refresh(face)
    return face


# ─── STUDENT FACES TEMP ──────────────────────────────────────────────────────

def create_temp_embedding(db: Session, student_id, embedding,
                          det_score: float, quality_score: float) -> StudentFaceTemp:
    emb  = embedding.tolist() if hasattr(embedding, "tolist") else embedding
    temp = StudentFaceTemp(student_id=student_id, embedding=emb,
                           det_score=det_score, quality_score=quality_score)
    db.add(temp)
    db.commit()
    db.refresh(temp)
    return temp


def get_temp_embeddings(db: Session, student_id) -> list[StudentFaceTemp]:
    return db.query(StudentFaceTemp).filter(
        StudentFaceTemp.student_id == student_id).all()


def delete_temp_embeddings(db: Session, student_id):
    db.query(StudentFaceTemp).filter(
        StudentFaceTemp.student_id == student_id).delete()
    db.commit()


# ─── STUDENT IMAGES ──────────────────────────────────────────────────────────

def create_student_image(db: Session, student_id, url: str,
                         angle: str = None,
                         is_primary: bool = False) -> StudentImage:
    image = StudentImage(student_id=student_id, url=url,
                         angle=angle, is_primary=is_primary)
    db.add(image)
    db.commit()
    db.refresh(image)
    return image


def get_student_images(db: Session, student_id) -> list[StudentImage]:
    return db.query(StudentImage).filter(
        StudentImage.student_id == student_id).all()


def get_student_primary_image(db: Session, student_id) -> StudentImage | None:
    return db.query(StudentImage).filter(
        StudentImage.student_id == student_id,
        StudentImage.is_primary == True
    ).first()


def get_student_images_by_angle(db: Session, student_id,
                                angle: str) -> list[StudentImage]:
    return db.query(StudentImage).filter(
        StudentImage.student_id == student_id,
        StudentImage.angle.like(f"{angle}%")
    ).all()


def delete_student_images_db(db: Session, student_id):
    db.query(StudentImage).filter(
        StudentImage.student_id == student_id).delete()
    db.commit()


# ─── USERS ───────────────────────────────────────────────────────────────────

def create_user(db: Session, email: str, password_hash: str, role: str,
                nom: str, prenom: str, student_id=None) -> User:
    user = User(email=email, password_hash=password_hash, role=role,
                nom=nom, prenom=prenom, student_id=student_id)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.query(User).filter(User.email == email).first()


def get_user_by_id(db: Session, user_id) -> User | None:
    return db.query(User).filter(User.id == user_id).first()


def get_users_by_role(db: Session, role: str) -> list[User]:
    return db.query(User).filter(User.role == role).all()


# ─── MATIERES ────────────────────────────────────────────────────────────────

def create_matiere(db: Session, nom: str, code: str = None,
                   coefficient: float = 1.0, annee_scolaire: str = None,
                   classe: str = None, professeur_id=None) -> Matiere:
    matiere = Matiere(nom=nom, code=code, coefficient=coefficient,
                      annee_scolaire=annee_scolaire, classe=classe,
                      professeur_id=professeur_id)
    db.add(matiere)
    db.commit()
    db.refresh(matiere)
    return matiere


def get_all_matieres(db: Session) -> list[Matiere]:
    return db.query(Matiere).all()


def get_matieres_by_classe(db: Session, classe: str) -> list[Matiere]:
    return db.query(Matiere).filter(Matiere.classe == classe).all()


def get_matiere_by_id(db: Session, matiere_id) -> Matiere | None:
    return db.query(Matiere).filter(Matiere.id == matiere_id).first()


# ─── EMPLOIS DU TEMPS ────────────────────────────────────────────────────────

def create_emploi_temps(db: Session, matiere_id, classe: str, jour: str,
                        heure_debut, heure_fin,
                        salle: str = None) -> EmploiTemps:
    emploi = EmploiTemps(matiere_id=matiere_id, classe=classe, jour=jour,
                         heure_debut=heure_debut, heure_fin=heure_fin,
                         salle=salle)
    db.add(emploi)
    db.commit()
    db.refresh(emploi)
    return emploi


def get_emplois_by_classe(db: Session, classe: str) -> list[EmploiTemps]:
    return db.query(EmploiTemps).filter(
        EmploiTemps.classe == classe).all()


def get_emplois_by_jour(db: Session, classe: str,
                        jour: str) -> list[EmploiTemps]:
    return db.query(EmploiTemps).filter(
        EmploiTemps.classe == classe,
        EmploiTemps.jour == jour
    ).all()


# ─── SESSIONS ────────────────────────────────────────────────────────────────

def create_session(db: Session, matiere_id, classe: str, date,
                   heure_debut=None, heure_fin=None,
                   salle: str = None) -> SessionModel:
    session = SessionModel(matiere_id=matiere_id, classe=classe,
                           date=date, heure_debut=heure_debut,
                           heure_fin=heure_fin, salle=salle)
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def get_sessions_by_classe(db: Session, classe: str) -> list[SessionModel]:
    return db.query(SessionModel).filter(
        SessionModel.classe == classe
    ).order_by(SessionModel.date.desc()).all()


def get_session_by_id(db: Session, session_id) -> SessionModel | None:
    return db.query(SessionModel).filter(
        SessionModel.id == session_id).first()


def update_session_status(db: Session, session_id,
                          status: str) -> SessionModel | None:
    session = get_session_by_id(db, session_id)
    if session:
        session.status = status
        db.commit()
        db.refresh(session)
    return session


# ─── ATTENDANCES ─────────────────────────────────────────────────────────────

def create_attendance(db: Session, student_id, session_id,
                      status: str = "absent", detected_at=None,
                      confidence: float = None) -> Attendance:
    attendance = Attendance(student_id=student_id, session_id=session_id,
                            status=status, detected_at=detected_at,
                            confidence=confidence)
    db.add(attendance)
    db.commit()
    db.refresh(attendance)
    return attendance


def get_attendances_by_session(db: Session,
                               session_id) -> list[Attendance]:
    return db.query(Attendance).filter(
        Attendance.session_id == session_id).all()


def get_attendances_by_student(db: Session,
                               student_id) -> list[Attendance]:
    return db.query(Attendance).filter(
        Attendance.student_id == student_id).all()


def update_attendance_status(db: Session, student_id, session_id,
                             status: str,
                             confidence: float = None) -> Attendance | None:
    attendance = db.query(Attendance).filter(
        Attendance.student_id == student_id,
        Attendance.session_id == session_id
    ).first()
    if attendance:
        attendance.status      = status
        attendance.detected_at = datetime.now(timezone.utc)
        if confidence:
            attendance.confidence = confidence
        db.commit()
        db.refresh(attendance)
    return attendance


def get_absence_count(db: Session, student_id) -> int:
    return db.query(Attendance).filter(
        Attendance.student_id == student_id,
        Attendance.status == "absent"
    ).count()


def get_attendance_rate(db: Session, student_id) -> float:
    total = db.query(Attendance).filter(
        Attendance.student_id == student_id).count()
    if total == 0:
        return 0.0
    present = db.query(Attendance).filter(
        Attendance.student_id == student_id,
        Attendance.status == "present"
    ).count()
    return round((present / total) * 100, 2)


# ─── GRADES ──────────────────────────────────────────────────────────────────

def create_grade(db: Session, student_id, matiere_id, note: float,
                 type: str = "controle",
                 commentaire: str = None) -> Grade:
    grade = Grade(student_id=student_id, matiere_id=matiere_id,
                  note=note, type=type, commentaire=commentaire)
    db.add(grade)
    db.commit()
    db.refresh(grade)
    return grade


def get_grades_by_student(db: Session, student_id) -> list[Grade]:
    return db.query(Grade).filter(
        Grade.student_id == student_id).all()


def get_average_by_student(db: Session, student_id) -> float:
    grades = db.query(Grade, Matiere).join(
        Matiere, Grade.matiere_id == Matiere.id
    ).filter(Grade.student_id == student_id).all()
    if not grades:
        return 0.0
    total_weight = sum(m.coefficient for _, m in grades)
    weighted_sum = sum(g.note * m.coefficient for g, m in grades)
    return round(weighted_sum / total_weight, 2) if total_weight > 0 else 0.0


# ─── ALERTS ──────────────────────────────────────────────────────────────────

def create_alert(db: Session, student_id, type: str, message: str,
                 severity: str = "medium",
                 target_role: str = "admin") -> Alert:
    alert = Alert(student_id=student_id, type=type, message=message,
                  severity=severity, target_role=target_role)
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert


def get_alerts_by_role(db: Session, target_role: str) -> list[Alert]:
    return db.query(Alert).filter(
        Alert.target_role == target_role,
        Alert.is_read == False
    ).order_by(Alert.created_at.desc()).all()


def mark_alert_read(db: Session, alert_id) -> Alert | None:
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if alert:
        alert.is_read = True
        db.commit()
        db.refresh(alert)
    return alert


# ─── STATISTIQUES BI ─────────────────────────────────────────────────────────

def get_stats_by_classe(db: Session, classe: str) -> dict:
    students = get_students_by_classe(db, classe)
    total    = len(students)
    if total == 0:
        return {"total": 0, "enrolled": 0,
                "avg_attendance": 0, "avg_grade": 0}
    enrolled       = sum(1 for s in students if s.is_enrolled)
    avg_attendance = sum(
        get_attendance_rate(db, s.id) for s in students) / total
    avg_grade      = sum(
        get_average_by_student(db, s.id) for s in students) / total
    return {
        "classe":               classe,
        "total_etudiants":      total,
        "enrolles":             enrolled,
        "taux_presence_moyen":  round(avg_attendance, 2),
        "moyenne_generale":     round(avg_grade, 2),
    }


def get_students_at_risk(db: Session, absence_threshold: int = 3,
                         grade_threshold: float = 10.0) -> list[dict]:
    at_risk  = []
    students = db.query(Student).filter(
        Student.is_enrolled == True).all()
    for student in students:
        absences = get_absence_count(db, student.id)
        average  = get_average_by_student(db, student.id)
        reasons  = []
        if absences > absence_threshold:
            reasons.append(f"{absences} absences")
        if average < grade_threshold and average > 0:
            reasons.append(f"moyenne {average}/20")
        if reasons:
            at_risk.append({
                "student_id": str(student.id),
                "nom":        student.nom,
                "prenom":     student.prenom,
                "classe":     student.classe,
                "absences":   absences,
                "moyenne":    average,
                "raisons":    reasons,
            })
    return at_risk



def delete_student_face(db: Session, student_id) -> bool:
    deleted = db.query(StudentFace).filter(
        StudentFace.student_id == student_id).delete()
    db.commit()
    return deleted > 0


# À la fin de crud.py
delete_student_images = delete_student_images_db