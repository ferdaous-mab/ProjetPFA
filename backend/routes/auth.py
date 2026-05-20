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
from db.models import PasswordResetToken, User as UserModel
from utils.email import send_reset_email
from datetime import timedelta, timezone, datetime
import secrets
import os


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
        student_id = student.id  # garder comme UUID object, pas str

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


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token:        str
    new_password: str


@router.post("/auth/forgot-password")
async def forgot_password(req: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Génère un token de reset et envoie un email. Toujours 200 pour ne pas révéler si l'email existe."""
    user = get_user_by_email(db, req.email)
    if user and user.is_active:
        # Invalider les anciens tokens de cet utilisateur
        db.query(PasswordResetToken).filter(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.used == False
        ).update({"used": True})
        db.commit()

        token      = secrets.token_urlsafe(32)
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)
        reset_token = PasswordResetToken(
            user_id    = user.id,
            token      = token,
            expires_at = expires_at,
        )
        db.add(reset_token)
        db.commit()

        sent = send_reset_email(user.email, user.prenom, token)
        if not sent:
            # En dev : retourner le lien directement pour tester sans email
            frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
            print(f"📧 Lien de reset (dev) : {frontend_url}?token={token}")

    return {"message": "Si cet email existe, un lien de réinitialisation a été envoyé."}


@router.post("/auth/reset-password")
async def reset_password(req: ResetPasswordRequest, db: Session = Depends(get_db)):
    """Valide le token et met à jour le mot de passe."""
    if len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail="Le mot de passe doit contenir au moins 6 caractères")

    reset_token = db.query(PasswordResetToken).filter(
        PasswordResetToken.token == req.token,
        PasswordResetToken.used  == False,
    ).first()

    if not reset_token:
        raise HTTPException(status_code=400, detail="Lien invalide ou déjà utilisé")

    if datetime.now(timezone.utc) > reset_token.expires_at:
        raise HTTPException(status_code=400, detail="Lien expiré — demandez un nouveau")

    db_user = db.query(UserModel).filter(UserModel.id == reset_token.user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")

    db_user.password_hash = hash_password(req.new_password)
    reset_token.used      = True
    db.commit()

    return {"success": True, "message": "Mot de passe modifié avec succès"}


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password:     str


@router.put("/auth/change-password")
async def change_password(
    req:         ChangePasswordRequest,
    db:          Session = Depends(get_db),
    current_user         = Depends(get_current_user),
):
    """Changement de mot de passe pour un utilisateur connecté."""
    if len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail="Le nouveau mot de passe doit contenir au moins 6 caractères")

    if not verify_password(req.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Mot de passe actuel incorrect")

    current_user.password_hash = hash_password(req.new_password)
    db.commit()
    return {"success": True, "message": "Mot de passe modifié avec succès"}