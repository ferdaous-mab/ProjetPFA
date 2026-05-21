from typing import Dict
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from pydantic import BaseModel
from db.models import Message, User
from auth.dependencies import get_current_user, get_db
from auth.jwt_handler import decode_token
from config import SessionLocal
import uuid

router = APIRouter(prefix="/messaging", tags=["messaging"])


# ── WebSocket Connection Manager ──────────────────────────────────────────────

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, user_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[str(user_id)] = websocket

    def disconnect(self, user_id: str):
        self.active_connections.pop(str(user_id), None)

    async def send_to_user(self, user_id: str, data: dict):
        ws = self.active_connections.get(str(user_id))
        if ws:
            try:
                await ws.send_json(data)
            except Exception:
                self.disconnect(str(user_id))

    def is_online(self, user_id: str) -> bool:
        return str(user_id) in self.active_connections


manager = ConnectionManager()


# ── Schemas ───────────────────────────────────────────────────────────────────

class SendMessageRequest(BaseModel):
    receiver_id: str
    content: str


# ── Contacts ──────────────────────────────────────────────────────────────────

@router.get("/contacts")
def get_contacts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role == "etudiant":
        contacts = db.query(User).filter(
            User.role.in_(["professeur", "admin"]),
            User.is_active == True
        ).order_by(User.nom).all()
    elif current_user.role == "professeur":
        contacts = db.query(User).filter(
            User.role.in_(["etudiant", "admin"]),
            User.is_active == True
        ).order_by(User.nom).all()
    else:  # admin
        contacts = db.query(User).filter(
            User.id != current_user.id,
            User.is_active == True
        ).order_by(User.nom).all()

    return [
        {
            "id": str(c.id),
            "nom": c.nom,
            "prenom": c.prenom,
            "role": c.role,
            "online": manager.is_online(str(c.id)),
            "unread": db.query(Message).filter(
                Message.sender_id == c.id,
                Message.receiver_id == current_user.id,
                Message.is_read == False
            ).count(),
        }
        for c in contacts
    ]


# ── Conversation history ──────────────────────────────────────────────────────

@router.get("/conversations/{other_user_id}")
def get_conversation(
    other_user_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        other_uuid = uuid.UUID(other_user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID invalide")

    other_user = db.query(User).filter(User.id == other_uuid, User.is_active == True).first()
    if not other_user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")

    _check_can_message(current_user, other_user)

    messages = db.query(Message).filter(
        or_(
            and_(Message.sender_id == current_user.id, Message.receiver_id == other_uuid),
            and_(Message.sender_id == other_uuid,      Message.receiver_id == current_user.id),
        )
    ).order_by(Message.created_at.asc()).all()

    # Mark received messages as read
    db.query(Message).filter(
        Message.sender_id == other_uuid,
        Message.receiver_id == current_user.id,
        Message.is_read == False
    ).update({"is_read": True})
    db.commit()

    return [
        {
            "id":          str(m.id),
            "sender_id":   str(m.sender_id),
            "receiver_id": str(m.receiver_id),
            "content":     m.content,
            "is_read":     m.is_read,
            "created_at":  m.created_at.isoformat(),
        }
        for m in messages
    ]


# ── Send message ──────────────────────────────────────────────────────────────

@router.post("/send")
async def send_message(
    req: SendMessageRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        receiver_uuid = uuid.UUID(req.receiver_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID invalide")

    receiver = db.query(User).filter(User.id == receiver_uuid, User.is_active == True).first()
    if not receiver:
        raise HTTPException(status_code=404, detail="Destinataire introuvable")

    _check_can_message(current_user, receiver)

    if not req.content.strip():
        raise HTTPException(status_code=400, detail="Le message ne peut pas être vide")

    msg = Message(
        sender_id=current_user.id,
        receiver_id=receiver_uuid,
        content=req.content.strip(),
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)

    payload = {
        "type": "new_message",
        "message": {
            "id":          str(msg.id),
            "sender_id":   str(msg.sender_id),
            "receiver_id": str(msg.receiver_id),
            "content":     msg.content,
            "is_read":     msg.is_read,
            "created_at":  msg.created_at.isoformat(),
        },
        "sender": {
            "id":     str(current_user.id),
            "nom":    current_user.nom,
            "prenom": current_user.prenom,
            "role":   current_user.role,
        },
    }

    await manager.send_to_user(str(receiver_uuid), payload)

    return payload["message"]


# ── Unread count ──────────────────────────────────────────────────────────────

@router.get("/unread-count")
def get_unread_count(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    count = db.query(Message).filter(
        Message.receiver_id == current_user.id,
        Message.is_read == False
    ).count()
    return {"count": count}


# ── Mark as read ──────────────────────────────────────────────────────────────

@router.put("/read/{sender_id}")
def mark_as_read(
    sender_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        sender_uuid = uuid.UUID(sender_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID invalide")

    db.query(Message).filter(
        Message.sender_id == sender_uuid,
        Message.receiver_id == current_user.id,
        Message.is_read == False
    ).update({"is_read": True})
    db.commit()
    return {"ok": True}


# ── WebSocket ─────────────────────────────────────────────────────────────────

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(...)):
    payload = decode_token(token)
    if not payload:
        await websocket.close(code=4001)
        return

    user_id = payload.get("sub")
    if not user_id:
        await websocket.close(code=4001)
        return

    db = SessionLocal()
    try:
        from db.crud import get_user_by_id
        user = get_user_by_id(db, user_id)
        if not user or not user.is_active:
            await websocket.close(code=4001)
            return
    finally:
        db.close()

    await manager.connect(user_id, websocket)
    try:
        while True:
            data = await websocket.receive_json()
            if data.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        manager.disconnect(user_id)
    except Exception:
        manager.disconnect(user_id)


# ── Privacy helper ────────────────────────────────────────────────────────────

def _check_can_message(sender: User, receiver: User):
    if sender.role == "admin":
        return
    if sender.role == "etudiant" and receiver.role in ("professeur", "admin"):
        return
    if sender.role == "professeur" and receiver.role in ("etudiant", "admin"):
        return
    raise HTTPException(
        status_code=403,
        detail="Vous ne pouvez pas envoyer de message à cet utilisateur"
    )
