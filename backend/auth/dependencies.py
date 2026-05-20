import logging
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from auth.jwt_handler import decode_token
from db.crud import get_user_by_id
from config import SessionLocal

logger = logging.getLogger(__name__)

security = HTTPBearer()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        try:
            db.close()
        except Exception:
            pass


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    """
    Vérifie le token JWT et retourne l'utilisateur connecté.
    Utilisé comme dépendance sur toutes les routes protégées.
    """
    token   = credentials.credentials
    payload = decode_token(token)

    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalide ou expiré",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token malformé"
        )

    user = get_user_by_id(db, user_id)
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Utilisateur introuvable ou désactivé"
        )

    # Auto-réparer : si un compte étudiant a perdu son student_id (ON DELETE SET NULL
    # ou bug d'insertion), retrouver l'étudiant par email et rétablir le lien.
    if user.role == "etudiant" and not user.student_id:
        logger.warning(f"[auto-repair] user_id={user.id} email={user.email} — student_id manquant, recherche par email...")
        from db.models import Student
        from sqlalchemy import func
        student = db.query(Student).filter(
            func.lower(Student.email) == func.lower(user.email)
        ).first()
        logger.warning(f"[auto-repair] student trouvé: {student is not None} (id={student.id if student else 'N/A'})")
        if student:
            user.student_id = student.id
            db.commit()
            db.refresh(user)
            logger.warning(f"[auto-repair] student_id rétabli: {user.student_id}")

    return user


def require_role(*roles: str):
    """
    Vérifie que l'utilisateur a le bon rôle.
    Usage : Depends(require_role("admin")) ou Depends(require_role("admin", "professeur"))
    """
    def checker(current_user=Depends(get_current_user)):
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Accès refusé — rôle requis : {', '.join(roles)}"
            )
        return current_user
    return checker


# ── Raccourcis pratiques ──────────────────────────────────────────────────────

def admin_only(current_user=Depends(get_current_user)):
    """Réservé aux admins uniquement."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé aux administrateurs"
        )
    return current_user


def admin_or_prof(current_user=Depends(get_current_user)):
    """Réservé aux admins et professeurs."""
    if current_user.role not in ["admin", "professeur"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé aux administrateurs et professeurs"
        )
    return current_user