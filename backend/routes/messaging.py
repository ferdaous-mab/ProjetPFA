from typing import Dict, Optional
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, desc
from pydantic import BaseModel
from db.models import Message, User
from auth.dependencies import get_current_user, get_db
from auth.jwt_handler import decode_token
from config import SessionLocal
import uuid

router = APIRouter(prefix="/messaging", tags=["messaging"])


# ── Connection Manager ────────────────────────────────────────────────────────

class ConnectionManager:
    def __init__(self):
        self.active: Dict[str, WebSocket] = {}

    async def connect(self, user_id: str, ws: WebSocket):
        await ws.accept()
        self.active[str(user_id)] = ws

    def disconnect(self, user_id: str):
        self.active.pop(str(user_id), None)

    async def send(self, user_id: str, data: dict):
        ws = self.active.get(str(user_id))
        if ws:
            try:
                await ws.send_json(data)
            except Exception:
                self.disconnect(str(user_id))

    def is_online(self, user_id: str) -> bool:
        return str(user_id) in self.active


manager = ConnectionManager()


# ── Schemas ───────────────────────────────────────────────────────────────────

class SendMessageRequest(BaseModel):
    receiver_id: str
    content:     str
    reply_to_id: Optional[str] = None


# ── Contacts (avec dernier message) ──────────────────────────────────────────

@router.get("/contacts")
def get_contacts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role == "etudiant":
        users = db.query(User).filter(
            User.role.in_(["professeur", "admin"]), User.is_active == True
        ).order_by(User.nom).all()
    elif current_user.role == "professeur":
        users = db.query(User).filter(
            User.role.in_(["etudiant", "admin"]), User.is_active == True
        ).order_by(User.nom).all()
    else:
        users = db.query(User).filter(
            User.id != current_user.id, User.is_active == True
        ).order_by(User.nom).all()

    result = []
    for c in users:
        unread = db.query(Message).filter(
            Message.sender_id   == c.id,
            Message.receiver_id == current_user.id,
            Message.is_read     == False,
            Message.is_deleted  == False,
        ).count()

        last = db.query(Message).filter(
            or_(
                and_(Message.sender_id == current_user.id, Message.receiver_id == c.id),
                and_(Message.sender_id == c.id, Message.receiver_id == current_user.id),
            )
        ).order_by(desc(Message.created_at)).first()

        last_msg = None
        if last:
            preview = "Message supprimé" if last.is_deleted else last.content
            last_msg = {
                "content":    preview[:60] + ("…" if len(preview) > 60 else ""),
                "created_at": last.created_at.isoformat(),
                "is_mine":    last.sender_id == current_user.id,
            }

        result.append({
            "id":           str(c.id),
            "nom":          c.nom,
            "prenom":       c.prenom,
            "role":         c.role,
            "online":       manager.is_online(str(c.id)),
            "unread":       unread,
            "last_message": last_msg,
        })

    # Trier : conversations récentes d'abord, sans conversation en bas
    result.sort(key=lambda x: x["last_message"]["created_at"] if x["last_message"] else "", reverse=True)
    return result


# ── Historique de conversation ────────────────────────────────────────────────

@router.get("/conversations/{other_user_id}")
async def get_conversation(
    other_user_id: str,
    current_user:  User    = Depends(get_current_user),
    db:            Session = Depends(get_db)
):
    try:
        other_uuid = uuid.UUID(other_user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID invalide")

    other = db.query(User).filter(User.id == other_uuid, User.is_active == True).first()
    if not other:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")

    _check_can_message(current_user, other)

    messages = db.query(Message).filter(
        or_(
            and_(Message.sender_id == current_user.id, Message.receiver_id == other_uuid),
            and_(Message.sender_id == other_uuid,      Message.receiver_id == current_user.id),
        )
    ).order_by(Message.created_at.asc()).all()

    # Marquer reçus comme lus
    marked = db.query(Message).filter(
        Message.sender_id   == other_uuid,
        Message.receiver_id == current_user.id,
        Message.is_read     == False,
    ).update({"is_read": True})
    db.commit()

    # Notifier l'expéditeur : ses messages ont été lus
    if marked > 0:
        await manager.send(str(other_uuid), {
            "type": "read_receipt",
            "from": str(current_user.id),
        })

    # Pré-charger les messages cités
    rt_ids = {m.reply_to_id for m in messages if m.reply_to_id}
    rt_map = {}
    if rt_ids:
        rts = db.query(Message).filter(Message.id.in_(rt_ids)).all()
        rt_map = {m.id: m for m in rts}

    return [_ser(m, rt_map) for m in messages]


# ── Envoyer un message ────────────────────────────────────────────────────────

@router.post("/send")
async def send_message(
    req:          SendMessageRequest,
    current_user: User    = Depends(get_current_user),
    db:           Session = Depends(get_db)
):
    try:
        recv_uuid = uuid.UUID(req.receiver_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID invalide")

    receiver = db.query(User).filter(User.id == recv_uuid, User.is_active == True).first()
    if not receiver:
        raise HTTPException(status_code=404, detail="Destinataire introuvable")

    _check_can_message(current_user, receiver)

    content = req.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Message vide")

    rt_uuid = None
    if req.reply_to_id:
        try:
            rt_uuid = uuid.UUID(req.reply_to_id)
        except ValueError:
            pass

    msg = Message(
        sender_id=current_user.id,
        receiver_id=recv_uuid,
        content=content,
        reply_to_id=rt_uuid,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)

    rt_map = {}
    if msg.reply_to_id:
        rt = db.query(Message).filter(Message.id == msg.reply_to_id).first()
        if rt:
            rt_map[rt.id] = rt

    serialized = _ser(msg, rt_map)

    await manager.send(str(recv_uuid), {
        "type":    "new_message",
        "message": serialized,
        "sender":  {
            "id":     str(current_user.id),
            "nom":    current_user.nom,
            "prenom": current_user.prenom,
            "role":   current_user.role,
        },
    })

    return serialized


# ── Supprimer un message (soft) ───────────────────────────────────────────────

@router.delete("/messages/{message_id}")
async def delete_message(
    message_id:   str,
    current_user: User    = Depends(get_current_user),
    db:           Session = Depends(get_db)
):
    try:
        msg_uuid = uuid.UUID(message_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID invalide")

    msg = db.query(Message).filter(Message.id == msg_uuid).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message introuvable")
    if msg.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="Vous ne pouvez supprimer que vos messages")

    msg.is_deleted = True
    db.commit()

    other_id = str(msg.receiver_id)
    await manager.send(other_id, {"type": "message_deleted", "message_id": str(msg.id)})

    return {"ok": True}


# ── Nombre de non-lus ─────────────────────────────────────────────────────────

@router.get("/unread-count")
def get_unread_count(
    current_user: User    = Depends(get_current_user),
    db:           Session = Depends(get_db)
):
    count = db.query(Message).filter(
        Message.receiver_id == current_user.id,
        Message.is_read     == False,
        Message.is_deleted  == False,
    ).count()
    return {"count": count}


# ── Marquer comme lus ─────────────────────────────────────────────────────────

@router.put("/read/{sender_id}")
async def mark_as_read(
    sender_id:    str,
    current_user: User    = Depends(get_current_user),
    db:           Session = Depends(get_db)
):
    try:
        s_uuid = uuid.UUID(sender_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID invalide")

    marked = db.query(Message).filter(
        Message.sender_id   == s_uuid,
        Message.receiver_id == current_user.id,
        Message.is_read     == False,
    ).update({"is_read": True})
    db.commit()

    if marked > 0:
        await manager.send(str(s_uuid), {"type": "read_receipt", "from": str(current_user.id)})

    return {"ok": True}


# ── WebSocket ─────────────────────────────────────────────────────────────────

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(...)):
    payload = decode_token(token)
    if not payload:
        await websocket.close(code=4001); return

    user_id = payload.get("sub")
    if not user_id:
        await websocket.close(code=4001); return

    db = SessionLocal()
    try:
        from db.crud import get_user_by_id
        user = get_user_by_id(db, user_id)
        if not user or not user.is_active:
            await websocket.close(code=4001); return
        prenom = user.prenom
    finally:
        db.close()

    await manager.connect(user_id, websocket)

    try:
        while True:
            data = await websocket.receive_json()
            t = data.get("type")

            if t == "ping":
                await websocket.send_json({"type": "pong"})

            elif t in ("typing", "stop_typing"):
                to = data.get("to")
                if to:
                    await manager.send(to, {"type": t, "from": user_id, "from_name": prenom})

    except WebSocketDisconnect:
        manager.disconnect(user_id)
    except Exception:
        manager.disconnect(user_id)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _check_can_message(sender: User, receiver: User):
    if sender.role == "admin": return
    if sender.role == "etudiant"  and receiver.role in ("professeur", "admin"): return
    if sender.role == "professeur" and receiver.role in ("etudiant",  "admin"): return
    raise HTTPException(status_code=403, detail="Vous ne pouvez pas envoyer de message à cet utilisateur")


def _ser(m: Message, rt_map: dict) -> dict:
    rt = rt_map.get(m.reply_to_id) if m.reply_to_id else None
    return {
        "id":          str(m.id),
        "sender_id":   str(m.sender_id),
        "receiver_id": str(m.receiver_id),
        "content":     "Message supprimé" if m.is_deleted else m.content,
        "is_deleted":  m.is_deleted,
        "is_read":     m.is_read,
        "created_at":  m.created_at.isoformat(),
        "reply_to":    {
            "id":        str(rt.id),
            "content":   "Message supprimé" if rt.is_deleted else rt.content[:100],
            "sender_id": str(rt.sender_id),
        } if rt else None,
    }
