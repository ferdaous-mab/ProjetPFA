from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from auth.dependencies import admin_only, get_db
from auth.jwt_handler import hash_password
from db.crud import (
    create_user, get_user_by_email, get_users_by_role,
    create_matiere, get_all_matieres, get_matiere_by_id,
    create_emploi_temps, get_emplois_by_classe,
    get_all_students, delete_student,
)
from db.models import User, Matiere, EmploiTemps
from datetime import time

router = APIRouter()


# ── Schémas ───────────────────────────────────────────────────────────────────

class ProfCreate(BaseModel):
    nom:      str
    prenom:   str
    email:    str
    password: str


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


@router.post("/gestion/professeurs")
async def create_professeur(
    req: ProfCreate,
    db: Session = Depends(get_db),
    _=Depends(admin_only)
):
    """Créer un compte professeur."""
    if get_user_by_email(db, req.email):
        raise HTTPException(status_code=400, detail="Email déjà utilisé")
    user = create_user(
        db, email=req.email,
        password_hash=hash_password(req.password),
        role="professeur", nom=req.nom, prenom=req.prenom,
    )
    return {"success": True, "id": str(user.id),
            "message": f"Compte créé pour {req.prenom} {req.nom}"}


@router.delete("/gestion/professeurs/{prof_id}")
async def delete_professeur(
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
    """Liste tous les étudiants."""
    from db.models import StudentImage
    students = get_all_students(db)
    result   = []
    for s in students:
        photo = db.query(StudentImage).filter(
            StudentImage.student_id == s.id,
            StudentImage.is_primary == True
        ).first()
        result.append({
            "id":          str(s.id),
            "nom":         s.nom,
            "prenom":      s.prenom,
            "email":       s.email,
            "classe":      s.classe,
            "is_enrolled": s.is_enrolled,
            "photo_url":   photo.url if photo else None,
        })
    return result


@router.delete("/gestion/etudiants/{student_id}")
async def delete_etudiant(
    student_id: str,
    db: Session = Depends(get_db),
    _=Depends(admin_only)
):
    """Supprimer un étudiant."""
    success = delete_student(db, student_id)
    if not success:
        raise HTTPException(status_code=404, detail="Étudiant introuvable")
    return {"success": True, "message": "Étudiant supprimé"}