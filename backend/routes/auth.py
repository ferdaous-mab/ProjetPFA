from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from auth.jwt_handler import hash_password, verify_password, create_token
from auth.dependencies import get_current_user, get_db
from db.crud import (
    create_user, get_user_by_email, get_user_by_id,
    get_student_by_email, get_student_primary_image,
    get_absence_count, get_attendance_rate, get_average_by_student
)

router = APIRouter()


# ── Schémas Pydantic ──────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email:     str
    password:  str
    role:      str        # etudiant uniquement (profs créés par l'admin)
    nom:       str
    prenom:    str


class LoginRequest(BaseModel):
    email:    str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type:   str = "bearer"
    role:         str
    nom:          str
    prenom:       str
    user_id:      str


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/auth/register", response_model=TokenResponse)
async def register(req: RegisterRequest, db: Session = Depends(get_db)):
    """
    Créer un compte utilisateur.
    Si role=etudiant, lie le compte à l'étudiant correspondant (même email).
    """
    if req.role != "etudiant":
        raise HTTPException(
            status_code=400,
            detail="L'inscription publique est réservée aux étudiants. Les comptes professeurs sont créés par l'administrateur."
        )

    if get_user_by_email(db, req.email):
        raise HTTPException(status_code=400, detail="Email déjà utilisé")

    # Lier à un étudiant existant si rôle étudiant
    student_id = None
    if req.role == "etudiant":
        student = get_student_by_email(db, req.email)
        if not student:
            raise HTTPException(
                status_code=400,
                detail="Aucun étudiant enrôlé avec cet email — inscrivez-vous d'abord"
            )
        if not student.is_enrolled:
            raise HTTPException(
                status_code=400,
                detail="Enrôlement facial non complété"
            )
        student_id = str(student.id)

    user = create_user(
        db,
        email         = req.email,
        password_hash = hash_password(req.password),
        role          = req.role,
        nom           = req.nom,
        prenom        = req.prenom,
        student_id    = student_id,
    )

    token = create_token({"sub": str(user.id), "role": user.role})
    return TokenResponse(
        access_token = token,
        role         = user.role,
        nom          = user.nom,
        prenom       = user.prenom,
        user_id      = str(user.id),
    )


@router.post("/auth/login", response_model=TokenResponse)
async def login(req: LoginRequest, db: Session = Depends(get_db)):
    """Connexion avec email + mot de passe → token JWT."""
    user = get_user_by_email(db, req.email)

    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect"
        )

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Compte désactivé")

    token = create_token({"sub": str(user.id), "role": user.role})
    return TokenResponse(
        access_token = token,
        role         = user.role,
        nom          = user.nom,
        prenom       = user.prenom,
        user_id      = str(user.id),
    )


@router.get("/auth/me")
async def get_me(
    current_user = Depends(get_current_user),
    db: Session  = Depends(get_db)
):
    """
    Retourne le profil complet de l'utilisateur connecté.
    Pour les étudiants : inclut photo + stats présence + notes.
    """
    base = {
        "id":      str(current_user.id),
        "email":   current_user.email,
        "role":    current_user.role,
        "nom":     current_user.nom,
        "prenom":  current_user.prenom,
    }

    # Enrichir le profil étudiant
    if current_user.role == "etudiant" and current_user.student_id:
        sid           = str(current_user.student_id)
        primary_image = get_student_primary_image(db, sid)
        absences      = get_absence_count(db, sid)
        taux_presence = get_attendance_rate(db, sid)
        moyenne       = get_average_by_student(db, sid)

        base["student"] = {
            "student_id":   sid,
            "photo_url":    primary_image.url if primary_image else None,
            "absences":     absences,
            "taux_presence": taux_presence,
            "moyenne":      moyenne,
        }

    return base


@router.post("/auth/logout")
async def logout():
    """
    Côté serveur le JWT est stateless — le logout se fait côté frontend
    en supprimant le token du localStorage.
    """
    return {"message": "Déconnecté avec succès"}