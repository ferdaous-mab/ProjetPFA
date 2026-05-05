from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from auth.jwt_handler import decode_token
from db.crud import get_user_by_id
from config import SessionLocal

security = HTTPBearer()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


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