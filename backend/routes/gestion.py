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
    create_matiere, get_matiere_by_id,
    create_emploi_temps,
    get_all_students, delete_student,
)
from db.models import User, Matiere, EmploiTemps, StudentImage, Attendance, Grade, Student, Alert, Salle
from datetime import time

router = APIRouter()


# ── Schémas ───────────────────────────────────────────────────────────────────

class ProfCreate(BaseModel):
    nom:      str
    prenom:   str
    email:    str
    password: Optional[str] = None


class ProfUpdate(BaseModel):
    nom:    Optional[str] = None
    prenom: Optional[str] = None
    email:  Optional[str] = None


class MatiereCreate(BaseModel):
    nom:           str
    code:          Optional[str] = None
    coefficient:   float = 1.0
    classe:        Optional[str] = None
    annee_scolaire: str = "1ère année"
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


# ── SALLES ────────────────────────────────────────────────────────────────────

class SalleCreate(BaseModel):
    nom:        str
    numero:     Optional[str] = None
    batiment:   Optional[str] = None
    capacite:   Optional[int] = None
    camera_url: Optional[str] = None

class SalleUpdate(BaseModel):
    nom:        Optional[str] = None
    numero:     Optional[str] = None
    batiment:   Optional[str] = None
    capacite:   Optional[int] = None
    camera_url: Optional[str] = None


@router.get("/gestion/salles")
def list_salles(db: Session = Depends(get_db), _=Depends(admin_only)):
    salles = db.query(Salle).order_by(Salle.nom).all()
    return [
        {
            "id":         str(s.id),
            "nom":        s.nom,
            "numero":     s.numero,
            "batiment":   s.batiment,
            "capacite":   s.capacite,
            "camera_url": s.camera_url,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        }
        for s in salles
    ]


@router.post("/gestion/salles")
def create_salle(data: SalleCreate, db: Session = Depends(get_db), _=Depends(admin_only)):
    existing = db.query(Salle).filter(Salle.nom == data.nom).first()
    if existing:
        raise HTTPException(status_code=400, detail="Une salle avec ce nom existe déjà")
    salle = Salle(**data.dict())
    db.add(salle)
    db.commit()
    db.refresh(salle)
    return {"success": True, "id": str(salle.id)}


@router.put("/gestion/salles/{salle_id}")
def update_salle(salle_id: str, data: SalleUpdate, db: Session = Depends(get_db), _=Depends(admin_only)):
    salle = db.query(Salle).filter(Salle.id == salle_id).first()
    if not salle:
        raise HTTPException(status_code=404, detail="Salle introuvable")
    for field, value in data.dict(exclude_none=True).items():
        setattr(salle, field, value)
    db.commit()
    return {"success": True}


@router.delete("/gestion/salles/{salle_id}")
def delete_salle(salle_id: str, db: Session = Depends(get_db), _=Depends(admin_only)):
    salle = db.query(Salle).filter(Salle.id == salle_id).first()
    if not salle:
        raise HTTPException(status_code=404, detail="Salle introuvable")
    db.delete(salle)
    db.commit()
    return {"success": True}


# ── PROFESSEURS ───────────────────────────────────────────────────────────────

@router.get("/gestion/professeurs")
async def get_professeurs(
    db: Session = Depends(get_db),
    _=Depends(admin_only)
):
    """Liste tous les professeurs."""
    profs = get_users_by_role(db, "professeur")
    if not profs:
        return []

    prof_ids = [p.id for p in profs]

    # Récupérer toutes les matières liées en une seule requête
    matieres_rows = db.query(Matiere.professeur_id, Matiere.nom).filter(
        Matiere.professeur_id.in_(prof_ids)
    ).all()

    # Regrouper par prof_id
    matieres_map: dict = {}
    for pid, nom in matieres_rows:
        matieres_map.setdefault(pid, []).append(nom)

    result = []
    for p in profs:
        ms = matieres_map.get(p.id, [])
        result.append({
            "id":          str(p.id),
            "nom":         p.nom,
            "prenom":      p.prenom,
            "email":       p.email,
            "is_active":   p.is_active,
            "nb_matieres": len(ms),
            "matieres":    ms,
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


@router.put("/gestion/professeurs/{prof_id}")
async def update_professeur(
    prof_id: str,
    req: ProfUpdate,
    db: Session = Depends(get_db),
    _=Depends(admin_only)
):
    """Modifier les informations d'un professeur."""
    user = db.query(User).filter(User.id == prof_id, User.role == "professeur").first()
    if not user:
        raise HTTPException(status_code=404, detail="Professeur introuvable")
    if req.email and req.email != user.email:
        if db.query(User).filter(User.email == req.email).first():
            raise HTTPException(status_code=400, detail="Email déjà utilisé")
        user.email = req.email
    if req.nom:    user.nom    = req.nom
    if req.prenom: user.prenom = req.prenom
    db.commit()
    return {"success": True, "message": "Professeur mis à jour"}


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
    """Liste toutes les matières (JOIN unique sur User)."""
    rows = (
        db.query(Matiere, User)
        .outerjoin(User, Matiere.professeur_id == User.id)
        .order_by(Matiere.annee_scolaire, Matiere.classe, Matiere.nom)
        .all()
    )
    return [
        {
            "id":             str(m.id),
            "nom":            m.nom,
            "code":           m.code,
            "coefficient":    m.coefficient,
            "classe":         m.classe,
            "annee_scolaire": m.annee_scolaire,
            "professeur":     f"{u.prenom} {u.nom}" if u else None,
            "professeur_id":  str(m.professeur_id) if m.professeur_id else None,
        }
        for m, u in rows
    ]


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
    """Liste tous les créneaux (JOIN unique sur Matiere)."""
    rows = (
        db.query(EmploiTemps, Matiere)
        .join(Matiere, EmploiTemps.matiere_id == Matiere.id)
        .order_by(Matiere.annee_scolaire, EmploiTemps.classe,
                  EmploiTemps.jour, EmploiTemps.heure_debut)
        .all()
    )
    return [
        {
            "id":          str(e.id),
            "matiere":     m.nom,
            "matiere_id":  str(e.matiere_id),
            "niveau":      m.annee_scolaire,
            "groupe":      e.classe,
            "jour":        e.jour,
            "heure_debut": str(e.heure_debut),
            "heure_fin":   str(e.heure_fin),
            "salle":       e.salle,
        }
        for e, m in rows
    ]


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
    """Supprimer définitivement un étudiant (le compte lié est supprimé automatiquement via CASCADE)."""
    success = delete_student(db, student_id)
    if not success:
        raise HTTPException(status_code=404, detail="Étudiant introuvable")
    return {"success": True, "message": "Étudiant et compte supprimés"}


# ── CRÉER COMPTE POUR UN ÉTUDIANT ─────────────────────────────────────────────

@router.post("/gestion/etudiants/{student_id}/creer-compte")
async def creer_compte_etudiant(
    student_id: str,
    db: Session = Depends(get_db),
    _=Depends(admin_only)
):
    """Créer (ou réactiver) un compte pour un étudiant enrôlé sans compte."""
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Étudiant introuvable")

    # Vérifier si un compte existe déjà (par student_id ou par email)
    existing = db.query(User).filter(User.student_id == student.id).first()
    if not existing:
        existing = db.query(User).filter(User.email == student.email).first()

    if existing:
        changed = False
        if existing.student_id != student.id:
            existing.student_id = student.id   # réparer le lien manquant
            changed = True
        if not existing.is_active:
            existing.is_active = True
            changed = True
        if changed:
            db.commit()
            return {"success": True, "reactivated": True, "already_active": False, "message": "Compte lié et activé"}
        return {"success": True, "reactivated": False, "already_active": True, "message": "Compte déjà actif"}

    # Générer un mot de passe provisoire
    import secrets, string
    alphabet = string.ascii_letters + string.digits
    temp_pwd = ''.join(secrets.choice(alphabet) for _ in range(10))

    new_user = User(
        email         = student.email,
        password_hash = hash_password(temp_pwd),
        role          = "etudiant",
        nom           = student.nom,
        prenom        = student.prenom,
        student_id    = student.id,
        is_active     = True,
    )
    db.add(new_user)
    db.commit()
    return {"success": True, "reactivated": False, "password": temp_pwd, "message": "Compte créé"}


# ── COMPTES ORPHELINS ─────────────────────────────────────────────────────────

@router.get("/gestion/comptes-orphelins")
async def get_comptes_orphelins(
    db: Session = Depends(get_db),
    _=Depends(admin_only)
):
    """Liste les comptes étudiants sans lien vers un profil (student_id NULL)."""
    users = db.query(User).filter(
        User.role == "etudiant",
        User.student_id == None  # noqa: E711
    ).all()
    return [{
        "user_id":   str(u.id),
        "nom":       u.nom,
        "prenom":    u.prenom,
        "email":     u.email,
        "is_active": u.is_active,
    } for u in users]


class CreerProfilRequest(BaseModel):
    classe:         str
    annee_scolaire: str = "2025-2026"


@router.post("/gestion/comptes-orphelins/{user_id}/creer-profil")
async def creer_profil_orphelin(
    user_id: str,
    req: CreerProfilRequest,
    db: Session = Depends(get_db),
    _=Depends(admin_only)
):
    """Crée un profil Student pour un compte orphelin et les lie."""
    user = db.query(User).filter(
        User.id == user_id,
        User.role == "etudiant",
        User.student_id == None  # noqa: E711
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="Compte orphelin introuvable")

    # Vérifier qu'aucun Student avec cet email n'existe déjà
    existing_student = db.query(Student).filter(Student.email == user.email).first()
    if existing_student:
        # Lier au student existant
        user.student_id = existing_student.id
        user.is_active  = True
        db.commit()
        return {"success": True, "message": f"Lié au profil existant de {existing_student.prenom} {existing_student.nom}"}

    student = Student(
        nom            = user.nom,
        prenom         = user.prenom,
        email          = user.email,
        classe         = req.classe,
        annee_scolaire = req.annee_scolaire,
        is_enrolled    = False,
    )
    db.add(student)
    db.flush()

    user.student_id = student.id
    user.is_active  = True
    db.commit()
    return {"success": True, "message": f"Profil créé et lié pour {user.prenom} {user.nom}"}


@router.delete("/gestion/comptes-orphelins/{user_id}")
async def delete_compte_orphelin(
    user_id: str,
    db: Session = Depends(get_db),
    _=Depends(admin_only)
):
    """Supprimer un compte orphelin."""
    user = db.query(User).filter(
        User.id == user_id,
        User.role == "etudiant",
        User.student_id == None  # noqa: E711
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="Compte orphelin introuvable")
    db.delete(user)
    db.commit()
    return {"success": True, "message": "Compte supprimé"}


class LienCompteRequest(BaseModel):
    user_id:    str
    student_id: str


@router.post("/gestion/lier-compte-etudiant")
async def lier_compte_etudiant(
    req: LienCompteRequest,
    db: Session = Depends(get_db),
    _=Depends(admin_only)
):
    """Lie manuellement un compte User à un profil Student."""
    user = db.query(User).filter(User.id == req.user_id, User.role == "etudiant").first()
    if not user:
        raise HTTPException(status_code=404, detail="Compte étudiant introuvable")

    student = db.query(Student).filter(Student.id == req.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Profil étudiant introuvable")

    existing = db.query(User).filter(
        User.student_id == student.id,
        User.id != user.id
    ).first()
    if existing:
        raise HTTPException(status_code=400,
            detail=f"Ce profil est déjà lié au compte {existing.email}")

    user.student_id = student.id
    if not user.is_active:
        user.is_active = True
    db.commit()
    return {"success": True, "message": f"Compte {user.email} lié à {student.prenom} {student.nom}"}


# ── NOTES ─────────────────────────────────────────────────────────────────────

class NoteCreate(BaseModel):
    student_id:  str
    matiere_id:  str
    note:        float
    type:        str = "controle"   # controle | examen | tp
    commentaire: Optional[str] = None
    date:        Optional[str] = None   # "YYYY-MM-DD"


class NoteUpdate(BaseModel):
    note:        Optional[float] = None
    type:        Optional[str]   = None
    commentaire: Optional[str]   = None


@router.get("/gestion/notes")
async def get_notes(
    classe:     Optional[str] = None,
    student_id: Optional[str] = None,
    matiere_id: Optional[str] = None,
    db: Session = Depends(get_db),
    _=Depends(admin_only)
):
    """Liste toutes les notes, filtrables par classe / étudiant / matière."""
    q = db.query(Grade)
    if student_id:
        q = q.filter(Grade.student_id == student_id)
    if matiere_id:
        q = q.filter(Grade.matiere_id == matiere_id)

    grades = q.order_by(Grade.created_at.desc()).all()
    result = []
    for g in grades:
        student = db.query(Student).filter(Student.id == g.student_id).first()
        matiere = db.query(Matiere).filter(Matiere.id == g.matiere_id).first()
        if classe and (not student or student.classe != classe):
            continue
        result.append({
            "id":          str(g.id),
            "student_id":  str(g.student_id),
            "etudiant":    f"{student.prenom} {student.nom}" if student else "?",
            "classe":      student.classe if student else "?",
            "matiere_id":  str(g.matiere_id),
            "matiere":     matiere.nom if matiere else "?",
            "note":        g.note,
            "type":        g.type,
            "commentaire": g.commentaire,
            "date":        str(g.date),
        })
    return result


@router.post("/gestion/notes")
async def add_note(
    req: NoteCreate,
    db: Session = Depends(get_db),
    _=Depends(admin_only)
):
    """Ajouter une note pour un étudiant."""
    from datetime import date as date_type
    grade = Grade(
        student_id  = req.student_id,
        matiere_id  = req.matiere_id,
        note        = req.note,
        type        = req.type,
        commentaire = req.commentaire,
        date        = date_type.fromisoformat(req.date) if req.date else date_type.today(),
    )
    db.add(grade)
    db.commit()
    return {"success": True, "id": str(grade.id)}


@router.put("/gestion/notes/{note_id}")
async def update_note(
    note_id: str,
    req: NoteUpdate,
    db: Session = Depends(get_db),
    _=Depends(admin_only)
):
    """Modifier une note."""
    grade = db.query(Grade).filter(Grade.id == note_id).first()
    if not grade:
        raise HTTPException(status_code=404, detail="Note introuvable")
    if req.note        is not None: grade.note        = req.note
    if req.type        is not None: grade.type        = req.type
    if req.commentaire is not None: grade.commentaire = req.commentaire
    db.commit()
    return {"success": True}


@router.delete("/gestion/notes/{note_id}")
async def delete_note(
    note_id: str,
    db: Session = Depends(get_db),
    _=Depends(admin_only)
):
    """Supprimer une note."""
    grade = db.query(Grade).filter(Grade.id == note_id).first()
    if not grade:
        raise HTTPException(status_code=404, detail="Note introuvable")
    db.delete(grade)
    db.commit()
    return {"success": True}


# ── ALERTES MANUELLES ─────────────────────────────────────────────────────────

class AlerteManuelle(BaseModel):
    message:        str
    type:           str = "information"   # information | avertissement | convocation
    severity:       str = "low"           # low | medium | high
    student_id:     Optional[str] = None  # cibler un étudiant précis
    classe:         Optional[str] = None  # cibler toute une classe
    annee_scolaire: Optional[str] = None  # niveau scolaire pour filtrer la classe
    target_role:    str = "etudiant"


@router.post("/gestion/alertes")
async def creer_alerte_manuelle(
    req: AlerteManuelle,
    db: Session = Depends(get_db),
    _=Depends(admin_only)
):
    """Créer une alerte manuelle pour un étudiant ou tous les étudiants d'une classe/niveau."""
    if not req.student_id and not req.classe:
        raise HTTPException(status_code=400, detail="Fournir un student_id ou une classe")

    targets = []
    if req.student_id:
        s = db.query(Student).filter(Student.id == req.student_id).first()
        if not s:
            raise HTTPException(status_code=404, detail="Étudiant introuvable")
        targets = [s]
    else:
        query = db.query(Student).filter(Student.classe == req.classe)
        if req.annee_scolaire:
            query = query.filter(Student.annee_scolaire == req.annee_scolaire)
        targets = query.all()
        if not targets:
            raise HTTPException(status_code=404, detail="Aucun étudiant dans cette classe")

    for s in targets:
        alerte = Alert(
            student_id  = s.id,
            type        = req.type,
            message     = req.message,
            severity    = req.severity,
            target_role = req.target_role,
            is_read     = False,
        )
        db.add(alerte)

    db.commit()
    return {"success": True, "nb_alertes": len(targets)}


# ── SESSIONS ──────────────────────────────────────────────────────────────────

@router.get("/gestion/sessions")
async def get_sessions(
    classe:     Optional[str] = None,
    matiere_id: Optional[str] = None,
    niveau:     Optional[str] = None,
    limit:      int = 60,
    offset:     int = 0,
    db: Session = Depends(get_db),
    _=Depends(admin_only)
):
    from db.models import Session as SessionModel
    from sqlalchemy import case, func as sqlfunc

    # ── Une seule requête : sessions + matière + stats présence ──────────────
    total_att  = sqlfunc.count(Attendance.id).label("total_att")
    present_ct = sqlfunc.sum(
        case((Attendance.status == "present", 1), else_=0)
    ).label("present_ct")

    q = (
        db.query(SessionModel, Matiere, total_att, present_ct)
        .join(Matiere, SessionModel.matiere_id == Matiere.id)
        .outerjoin(Attendance, Attendance.session_id == SessionModel.id)
        .group_by(SessionModel.id, Matiere.id)
        .order_by(SessionModel.date.desc(), SessionModel.heure_debut)
    )

    if classe:
        q = q.filter(SessionModel.classe == classe)
    if matiere_id:
        q = q.filter(SessionModel.matiere_id == matiere_id)
    if niveau:
        q = q.filter(Matiere.annee_scolaire == niveau)

    rows = q.offset(offset).limit(limit).all()

    result = []
    for s, mat, total, present in rows:
        total   = total   or 0
        present = present or 0
        result.append({
            "id":          str(s.id),
            "matiere":     mat.nom,
            "matiere_id":  str(s.matiere_id),
            "niveau":      mat.annee_scolaire,
            "classe":      s.classe,
            "date":        str(s.date),
            "heure_debut": str(s.heure_debut)[:5] if s.heure_debut else None,
            "heure_fin":   str(s.heure_fin)[:5]   if s.heure_fin   else None,
            "salle":       s.salle,
            "status":      s.status,
            "total_att":   total,
            "present":     present,
            "taux":        round(present / total * 100, 1) if total else 0,
        })
    return result


@router.get("/gestion/sessions/{session_id}/presences")
async def get_presences_session(
    session_id: str,
    db: Session = Depends(get_db),
    _=Depends(admin_only)
):
    """Retourne la liste des étudiants avec leur statut de présence pour une séance."""
    from db.models import Session as SessionModel
    sess = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not sess:
        raise HTTPException(status_code=404, detail="Séance introuvable")

    matiere = db.query(Matiere).filter(Matiere.id == sess.matiere_id).first()

    # Tous les étudiants du groupe
    query = db.query(Student).filter(Student.classe == sess.classe)
    if matiere and matiere.annee_scolaire:
        query = query.filter(Student.annee_scolaire == matiere.annee_scolaire)
    etudiants = query.order_by(Student.nom, Student.prenom).all()

    # Présences enregistrées pour cette séance
    att_map = {
        str(a.student_id): a
        for a in db.query(Attendance).filter(Attendance.session_id == session_id).all()
    }

    result = []
    for s in etudiants:
        att = att_map.get(str(s.id))
        result.append({
            "student_id": str(s.id),
            "nom":        s.nom,
            "prenom":     s.prenom,
            "status":     att.status if att else "absent",
            "detected_at": att.detected_at.strftime("%H:%M") if att and att.detected_at else None,
            "confidence": round(att.confidence * 100) if att and att.confidence else None,
        })

    presents = sum(1 for r in result if r["status"] == "present")
    retards  = sum(1 for r in result if r["status"] == "retard")
    absents  = sum(1 for r in result if r["status"] == "absent")

    return {
        "session": {
            "id":          session_id,
            "matiere":     matiere.nom if matiere else "?",
            "classe":      sess.classe,
            "niveau":      matiere.annee_scolaire if matiere else "?",
            "date":        str(sess.date),
            "heure_debut": str(sess.heure_debut)[:5] if sess.heure_debut else None,
            "heure_fin":   str(sess.heure_fin)[:5]   if sess.heure_fin   else None,
            "salle":       sess.salle,
        },
        "stats": {"presents": presents, "retards": retards, "absents": absents, "total": len(result)},
        "etudiants": result,
    }


@router.delete("/gestion/sessions/{session_id}")
async def delete_session(
    session_id: str,
    db: Session = Depends(get_db),
    _=Depends(admin_only)
):
    """Supprimer une séance (et ses présences via CASCADE)."""
    from db.models import Session as SessionModel
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Séance introuvable")
    db.delete(session)
    db.commit()
    return {"success": True}