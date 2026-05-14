from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from typing import Optional
from auth.dependencies import admin_only, get_db
from auth.jwt_handler import hash_password
import secrets
import string
from db.crud import (
    create_user, get_user_by_email, get_users_by_role,
    create_matiere, get_all_matieres, get_matiere_by_id,
    create_emploi_temps, get_emplois_by_classe,
    get_all_students, delete_student,
)
from db.models import User, Matiere, EmploiTemps, StudentImage, Attendance, Grade
from datetime import time

router = APIRouter()


# ── Schémas ───────────────────────────────────────────────────────────────────

class ProfCreate(BaseModel):
    nom:      str
    prenom:   str
    email:    str
    password: Optional[str] = None


class MatiereCreate(BaseModel):
    nom:           str
    code:          Optional[str] = None
    coefficient:   float = 1.0
    classe:        str
    annee_scolaire: str = "2025-2026"
    professeur_id: Optional[str] = None


class MatiereUpdate(BaseModel):
    nom:           Optional[str] = None
    code:          Optional[str] = None
    coefficient:   Optional[float] = None
    professeur_id: Optional[str] = None


class EmploiCreate(BaseModel):
    matiere_id:  str
    classe:      str
    jour:        str
    heure_debut: str   # "08:30"
    heure_fin:   str   # "10:30"
    salle:       Optional[str] = None


# ── PROFESSEURS ───────────────────────────────────────────────────────────────

@router.get("/gestion/professeurs")
async def get_professeurs(
    db: Session = Depends(get_db),
    _=Depends(admin_only)
):
    """Liste tous les professeurs."""
    profs = get_users_by_role(db, "professeur")
    result = []
    for p in profs:
        matieres = db.query(Matiere).filter(
            Matiere.professeur_id == p.id
        ).all()
        result.append({
            "id":         str(p.id),
            "nom":        p.nom,
            "prenom":     p.prenom,
            "email":      p.email,
            "is_active":  p.is_active,
            "nb_matieres": len(matieres),
            "matieres":   [m.nom for m in matieres],
        })
    return result


def _generate_password(length: int = 12) -> str:
    alphabet = string.ascii_letters + string.digits + "!@#$%"
    return "".join(secrets.choice(alphabet) for _ in range(length))


@router.post("/gestion/professeurs")
async def create_professeur(
    req: ProfCreate,
    db: Session = Depends(get_db),
    _=Depends(admin_only)
):
    """Créer un compte professeur avec mot de passe aléatoire si non fourni."""
    if get_user_by_email(db, req.email):
        raise HTTPException(status_code=400, detail="Email déjà utilisé")
    temp_password = req.password if req.password else _generate_password()
    user = create_user(
        db, email=req.email,
        password_hash=hash_password(temp_password),
        role="professeur", nom=req.nom, prenom=req.prenom,
    )
    return {
        "success": True,
        "id": str(user.id),
        "message": f"Compte créé pour {req.prenom} {req.nom}",
        "temp_password": temp_password,
    }


@router.post("/gestion/professeurs/{prof_id}/reset-password")
async def reset_prof_password(
    prof_id: str,
    db: Session = Depends(get_db),
    _=Depends(admin_only)
):
    """Génère un nouveau mot de passe aléatoire pour un professeur (affiché une seule fois)."""
    user = db.query(User).filter(User.id == prof_id, User.role == "professeur").first()
    if not user:
        raise HTTPException(status_code=404, detail="Professeur introuvable")
    new_password = _generate_password()
    user.password_hash = hash_password(new_password)
    db.commit()
    return {"success": True, "password": new_password}


@router.delete("/gestion/professeurs/{prof_id}")
async def deactivate_professeur(
    prof_id: str,
    db: Session = Depends(get_db),
    _=Depends(admin_only)
):
    """Désactiver un compte professeur."""
    user = db.query(User).filter(User.id == prof_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Professeur introuvable")
    user.is_active = False
    db.commit()
    return {"success": True, "message": "Compte désactivé"}


@router.put("/gestion/professeurs/{prof_id}/reactivate")
async def reactivate_professeur(
    prof_id: str,
    db: Session = Depends(get_db),
    _=Depends(admin_only)
):
    """Réactiver un compte professeur."""
    user = db.query(User).filter(User.id == prof_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Professeur introuvable")
    user.is_active = True
    db.commit()
    return {"success": True, "message": "Compte réactivé"}


@router.delete("/gestion/professeurs/{prof_id}/permanent")
async def permanently_delete_professeur(
    prof_id: str,
    db: Session = Depends(get_db),
    _=Depends(admin_only)
):
    """Supprimer définitivement un compte professeur."""
    user = db.query(User).filter(User.id == prof_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Professeur introuvable")
    db.delete(user)
    db.commit()
    return {"success": True, "message": "Compte supprimé définitivement"}


# ── MATIÈRES ──────────────────────────────────────────────────────────────────

@router.get("/gestion/matieres")
async def get_matieres(
    db: Session = Depends(get_db),
    _=Depends(admin_only)
):
    """Liste toutes les matières."""
    matieres = get_all_matieres(db)
    result   = []
    for m in matieres:
        prof = db.query(User).filter(User.id == m.professeur_id).first() if m.professeur_id else None
        result.append({
            "id":           str(m.id),
            "nom":          m.nom,
            "code":         m.code,
            "coefficient":  m.coefficient,
            "classe":       m.classe,
            "annee_scolaire": m.annee_scolaire,
            "professeur":   f"{prof.prenom} {prof.nom}" if prof else None,
            "professeur_id": str(m.professeur_id) if m.professeur_id else None,
        })
    return result


@router.post("/gestion/matieres")
async def add_matiere(
    req: MatiereCreate,
    db: Session = Depends(get_db),
    _=Depends(admin_only)
):
    """Créer une matière."""
    matiere = create_matiere(
        db, nom=req.nom, code=req.code,
        coefficient=req.coefficient, classe=req.classe,
        annee_scolaire=req.annee_scolaire,
        professeur_id=req.professeur_id,
    )
    return {"success": True, "id": str(matiere.id),
            "message": f"Matière '{req.nom}' créée"}


@router.put("/gestion/matieres/{matiere_id}")
async def update_matiere(
    matiere_id: str,
    req: MatiereUpdate,
    db: Session = Depends(get_db),
    _=Depends(admin_only)
):
    """Modifier une matière."""
    matiere = get_matiere_by_id(db, matiere_id)
    if not matiere:
        raise HTTPException(status_code=404, detail="Matière introuvable")
    if req.nom:           matiere.nom           = req.nom
    if req.code:          matiere.code          = req.code
    if req.coefficient:   matiere.coefficient   = req.coefficient
    if req.professeur_id: matiere.professeur_id = req.professeur_id
    db.commit()
    return {"success": True, "message": "Matière mise à jour"}


@router.delete("/gestion/matieres/{matiere_id}")
async def delete_matiere_route(
    matiere_id: str,
    db: Session = Depends(get_db),
    _=Depends(admin_only)
):
    """Supprimer une matière."""
    matiere = get_matiere_by_id(db, matiere_id)
    if not matiere:
        raise HTTPException(status_code=404, detail="Matière introuvable")
    db.delete(matiere)
    db.commit()
    return {"success": True, "message": "Matière supprimée"}


# ── EMPLOI DU TEMPS ───────────────────────────────────────────────────────────

@router.get("/gestion/emplois")
async def get_emplois(
    db: Session = Depends(get_db),
    _=Depends(admin_only)
):
    """Liste tous les créneaux de toutes les classes."""
    classes = ["A", "B", "C"]
    result  = {}
    for classe in classes:
        emplois = get_emplois_by_classe(db, classe)
        result[classe] = []
        for e in emplois:
            matiere = get_matiere_by_id(db, str(e.matiere_id))
            result[classe].append({
                "id":          str(e.id),
                "matiere":     matiere.nom if matiere else "?",
                "matiere_id":  str(e.matiere_id),
                "jour":        e.jour,
                "heure_debut": str(e.heure_debut),
                "heure_fin":   str(e.heure_fin),
                "salle":       e.salle,
            })
    return result


@router.post("/gestion/emplois")
async def add_emploi(
    req: EmploiCreate,
    db: Session = Depends(get_db),
    _=Depends(admin_only)
):
    """Ajouter un créneau à l'emploi du temps."""
    h_debut = time.fromisoformat(req.heure_debut)
    h_fin   = time.fromisoformat(req.heure_fin)
    emploi  = create_emploi_temps(
        db, matiere_id=req.matiere_id,
        classe=req.classe, jour=req.jour,
        heure_debut=h_debut, heure_fin=h_fin,
        salle=req.salle,
    )
    return {"success": True, "id": str(emploi.id),
            "message": "Créneau ajouté"}


@router.delete("/gestion/emplois/{emploi_id}")
async def delete_emploi(
    emploi_id: str,
    db: Session = Depends(get_db),
    _=Depends(admin_only)
):
    """Supprimer un créneau."""
    emploi = db.query(EmploiTemps).filter(
        EmploiTemps.id == emploi_id
    ).first()
    if not emploi:
        raise HTTPException(status_code=404, detail="Créneau introuvable")
    db.delete(emploi)
    db.commit()
    return {"success": True, "message": "Créneau supprimé"}


# ── ÉTUDIANTS ─────────────────────────────────────────────────────────────────

@router.get("/gestion/etudiants")
async def get_etudiants_list(
    db: Session = Depends(get_db),
    _=Depends(admin_only)
):
    """Liste tous les étudiants — 6 requêtes bulk au lieu de N×6."""
    students = get_all_students(db)
    if not students:
        return []

    ids = [s.id for s in students]

    # ── 1. Photos principales ──────────────────────────────────────────────────
    photos = {
        r.student_id: r.url
        for r in db.query(StudentImage.student_id, StudentImage.url).filter(
            StudentImage.student_id.in_(ids),
            StudentImage.is_primary == True
        ).all()
    }

    # ── 2. Comptes utilisateurs ────────────────────────────────────────────────
    accounts = {
        r.student_id: r
        for r in db.query(User).filter(User.student_id.in_(ids)).all()
    }

    # ── 3. Nombre d'absences par étudiant ──────────────────────────────────────
    abs_rows = db.query(
        Attendance.student_id, func.count(Attendance.id)
    ).filter(
        Attendance.student_id.in_(ids),
        Attendance.status == "absent"
    ).group_by(Attendance.student_id).all()
    abs_map = {sid: cnt for sid, cnt in abs_rows}

    # ── 4. Total et présents par étudiant (deux requêtes agrégées) ────────────
    total_rows = db.query(
        Attendance.student_id, func.count(Attendance.id)
    ).filter(Attendance.student_id.in_(ids)).group_by(Attendance.student_id).all()
    total_map = {sid: cnt for sid, cnt in total_rows}

    present_rows = db.query(
        Attendance.student_id, func.count(Attendance.id)
    ).filter(
        Attendance.student_id.in_(ids),
        Attendance.status == "present"
    ).group_by(Attendance.student_id).all()
    present_map = {sid: cnt for sid, cnt in present_rows}

    taux_map = {
        sid: round(present_map.get(sid, 0) / total * 100, 2)
        for sid, total in total_map.items() if total > 0
    }

    # ── 5. Moyennes pondérées par étudiant ─────────────────────────────────────
    grade_rows = db.query(
        Grade.student_id, Grade.note, Matiere.coefficient
    ).join(Matiere, Grade.matiere_id == Matiere.id).filter(
        Grade.student_id.in_(ids)
    ).all()

    weighted: dict = {}
    for sid, note, coef in grade_rows:
        if sid not in weighted:
            weighted[sid] = [0.0, 0.0]
        weighted[sid][0] += note * coef
        weighted[sid][1] += coef

    moy_map = {
        sid: round(ws / wt, 2)
        for sid, (ws, wt) in weighted.items() if wt > 0
    }

    # ── Construction de la réponse ─────────────────────────────────────────────
    result = []
    for s in students:
        acc = accounts.get(s.id)
        result.append({
            "id":              str(s.id),
            "nom":             s.nom,
            "prenom":          s.prenom,
            "email":           s.email,
            "classe":          s.classe,
            "annee_scolaire":  s.annee_scolaire,
            "date_inscription": s.created_at.strftime("%d/%m/%Y") if s.created_at else None,
            "is_enrolled":     s.is_enrolled,
            "photo_url":       photos.get(s.id),
            "has_account":     acc is not None,
            "account_active":  acc.is_active if acc else None,
            "absences":        abs_map.get(s.id, 0),
            "taux_presence":   taux_map.get(s.id, 0.0),
            "moyenne":         moy_map.get(s.id, 0.0),
            "telephone":       s.telephone,
            "date_naissance":  str(s.date_naissance) if s.date_naissance else None,
            "lieu_naissance":  s.lieu_naissance,
            "sexe":            s.sexe,
            "adresse":         s.adresse,
            "ville":           s.ville,
            "cin":             s.cin,
            "numero_carte":    s.numero_carte,
            "nom_pere":        s.nom_pere,
            "tel_pere":        s.tel_pere,
            "nom_mere":        s.nom_mere,
            "tel_mere":        s.tel_mere,
            "email_parent":    s.email_parent,
        })
    return result


class EtudiantUpdate(BaseModel):
    nom:             Optional[str] = None
    prenom:          Optional[str] = None
    email:           Optional[str] = None
    classe:          Optional[str] = None
    annee_scolaire:  Optional[str] = None
    telephone:       Optional[str] = None
    date_naissance:  Optional[str] = None   # "YYYY-MM-DD"
    lieu_naissance:  Optional[str] = None
    sexe:            Optional[str] = None
    adresse:         Optional[str] = None
    ville:           Optional[str] = None
    cin:             Optional[str] = None
    numero_carte:    Optional[str] = None
    nom_pere:        Optional[str] = None
    tel_pere:        Optional[str] = None
    nom_mere:        Optional[str] = None
    tel_mere:        Optional[str] = None
    email_parent:    Optional[str] = None


@router.put("/gestion/etudiants/{student_id}")
async def update_etudiant(
    student_id: str,
    req: EtudiantUpdate,
    db: Session = Depends(get_db),
    _=Depends(admin_only)
):
    """Modifier les informations d'un étudiant."""
    from db.models import Student
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Étudiant introuvable")

    fields = [
        "nom", "prenom", "email", "classe", "annee_scolaire",
        "telephone", "lieu_naissance", "sexe", "adresse", "ville",
        "cin", "numero_carte", "nom_pere", "tel_pere",
        "nom_mere", "tel_mere", "email_parent",
    ]
    for field in fields:
        val = getattr(req, field, None)
        if val is not None:
            setattr(student, field, val)

    if req.date_naissance:
        from datetime import date as date_type
        try:
            student.date_naissance = date_type.fromisoformat(req.date_naissance)
        except ValueError:
            pass

    db.commit()
    return {"success": True, "message": "Étudiant mis à jour"}


@router.put("/gestion/etudiants/{student_id}/deactivate")
async def deactivate_etudiant(
    student_id: str,
    db: Session = Depends(get_db),
    _=Depends(admin_only)
):
    """Désactiver le compte d'un étudiant."""
    user = db.query(User).filter(User.student_id == student_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Aucun compte associé à cet étudiant")
    user.is_active = False
    db.commit()
    return {"success": True, "message": "Compte désactivé"}


@router.put("/gestion/etudiants/{student_id}/reactivate")
async def reactivate_etudiant(
    student_id: str,
    db: Session = Depends(get_db),
    _=Depends(admin_only)
):
    """Réactiver le compte d'un étudiant."""
    user = db.query(User).filter(User.student_id == student_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Aucun compte associé à cet étudiant")
    user.is_active = True
    db.commit()
    return {"success": True, "message": "Compte réactivé"}


@router.delete("/gestion/etudiants/{student_id}")
async def delete_etudiant(
    student_id: str,
    db: Session = Depends(get_db),
    _=Depends(admin_only)
):
    """Supprimer définitivement un étudiant."""
    success = delete_student(db, student_id)
    if not success:
        raise HTTPException(status_code=404, detail="Étudiant introuvable")
    return {"success": True, "message": "Étudiant supprimé"}