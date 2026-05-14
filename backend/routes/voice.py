from fastapi import APIRouter, Depends, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from auth.dependencies import admin_only, admin_or_prof, get_db
import httpx
import os
import re
import asyncio
from dotenv import load_dotenv

load_dotenv(override=True)

router = APIRouter()

ASSEMBLYAI_KEY = os.getenv("ASSEMBLYAI_API_KEY", "")


class ChatRequest(BaseModel):
    message: str
    pending_action: Optional[dict] = None


def generate_response(message: str, db: Session) -> str:
    from db.models import Student, Attendance, Matiere, Alert, User, Grade
    from db.crud import get_students_at_risk

    msg = message.lower()

    total_students = db.query(Student).count()
    enrolled       = db.query(Student).filter(Student.is_enrolled == True).count()
    total_att      = db.query(Attendance).count()
    present        = db.query(Attendance).filter(Attendance.status == "present").count()
    absent         = db.query(Attendance).filter(Attendance.status == "absent").count()
    taux_global    = round(present / total_att * 100, 1) if total_att > 0 else 0
    total_profs    = db.query(User).filter(User.role == "professeur", User.is_active == True).count()
    alertes        = db.query(Alert).filter(Alert.is_read == False).count()
    at_risk        = get_students_at_risk(db, absence_threshold=3, grade_threshold=10.0)

    if any(w in msg for w in ["présence", "presence", "taux", "global"]):
        return (f"Le taux de présence global est de {taux_global}%. "
                f"Sur {total_att} séances enregistrées, {present} présences et {absent} absences.")

    if any(w in msg for w in ["risque", "danger", "difficulté", "problème"]):
        if len(at_risk) == 0:
            return "Aucun étudiant à risque détecté pour le moment. Tout va bien !"
        noms = ", ".join([f"{s['prenom']} {s['nom']}" for s in at_risk[:3]])
        return (f"Il y a {len(at_risk)} étudiant(s) à risque. "
                f"Les plus concernés sont : {noms}.")

    if any(w in msg for w in ["alerte", "alert", "notification"]):
        if alertes == 0:
            return "Aucune alerte non lue pour le moment."
        return f"Il y a {alertes} alerte(s) non lue(s) en attente."

    if any(w in msg for w in ["étudiant", "etudiants", "élève", "inscrit", "enrôlé"]):
        return (f"La plateforme compte {total_students} étudiant(s) au total, "
                f"dont {enrolled} enrôlés avec reconnaissance faciale.")

    if any(w in msg for w in ["professeur", "prof", "enseignant"]):
        return f"Il y a {total_profs} professeur(s) enregistré(s) sur la plateforme."

    if any(w in msg for w in ["matière", "matiere", "cours"]):
        matieres = db.query(Matiere).count()
        return f"La plateforme compte {matieres} matière(s) enregistrée(s)."

    if any(w in msg for w in ["absent", "absence", "manqu"]):
        return (f"Il y a {absent} absence(s) enregistrée(s) au total. "
                f"Le taux d'absence global est de {round(100 - taux_global, 1)}%.")

    if any(w in msg for w in ["note", "moyenne", "résultat", "grade"]):
        grades = db.query(Grade).count()
        if grades == 0:
            return "Aucune note enregistrée pour le moment."
        from sqlalchemy import func
        avg = db.query(func.avg(Grade.note)).scalar()
        return f"Il y a {grades} note(s) enregistrée(s). La moyenne générale est de {round(avg, 2)}/20."

    if any(w in msg for w in ["bonjour", "salut", "hello", "bonsoir"]):
        return (f"Bonjour ! Je suis votre assistant SmartCampus. "
                f"Vous avez {total_students} étudiants, {total_profs} professeurs "
                f"et un taux de présence de {taux_global}%.")

    if any(w in msg for w in ["résumé", "resume", "overview", "bilan", "statistique"]):
        return (f"Voici le bilan : {total_students} étudiants ({enrolled} enrôlés), "
                f"taux de présence {taux_global}%, "
                f"{len(at_risk)} étudiant(s) à risque, "
                f"{alertes} alerte(s) non lue(s).")

    return (f"Je n'ai pas compris votre question. "
            f"Vous pouvez me demander : le taux de présence, "
            f"les étudiants à risque, les alertes, ou les statistiques générales.")


# ── Voice Command Parsing ─────────────────────────────────────────────────────

def extract_professor_params(message: str) -> dict:
    params = {}
    # Email
    email_match = re.search(r'[\w.+\-]+@[\w\-]+\.[a-zA-Z]{2,}', message)
    if email_match:
        params["email"] = email_match.group()
    # Password
    pwd_match = re.search(r'(?:mot\s+de\s+passe|password|mdp)\s*[:\s]+(\S+)', message, re.IGNORECASE)
    if pwd_match:
        params["password"] = pwd_match.group(1).rstrip('.,;')
    # Prénom
    prenom_match = re.search(r'(?:pr[eé]nom)\s*[:\s]+([A-Za-zÀ-ÿ\-]+)', message, re.IGNORECASE)
    if prenom_match:
        params["prenom"] = prenom_match.group(1).capitalize()
    # Nom (avoid "nom de passe")
    nom_match = re.search(r'\bnom\s*[:\s]+([A-Za-zÀ-ÿ\-]+)', message, re.IGNORECASE)
    if nom_match and nom_match.group(1).lower() not in ["de", "du", "la", "le", "passe"]:
        params["nom"] = nom_match.group(1).capitalize()
    # Fallback: "professeur/prof [Prenom] [Nom]"
    if "prenom" not in params or "nom" not in params:
        name_match = re.search(
            r'(?:professeur|prof|enseignant)\s+([A-Za-zÀ-ÿ\-]+)\s+([A-Za-zÀ-ÿ\-]+)',
            message, re.IGNORECASE
        )
        if name_match:
            if "prenom" not in params:
                params["prenom"] = name_match.group(1).capitalize()
            if "nom" not in params:
                params["nom"] = name_match.group(2).capitalize()
    # Fallback: "s'appelle [Prenom] [Nom]"
    if "prenom" not in params or "nom" not in params:
        name_match2 = re.search(r"s'?appelle\s+([A-Za-zÀ-ÿ\-]+)\s+([A-Za-zÀ-ÿ\-]+)", message, re.IGNORECASE)
        if name_match2:
            if "prenom" not in params:
                params["prenom"] = name_match2.group(1).capitalize()
            if "nom" not in params:
                params["nom"] = name_match2.group(2).capitalize()
    return params


def extract_matiere_params(message: str) -> dict:
    params = {}
    # Classe
    classe_match = re.search(r'\bclasse\s*[:\s]*([ABC])\b', message, re.IGNORECASE)
    params["classe"] = classe_match.group(1).upper() if classe_match else "A"
    # Coefficient
    coef_match = re.search(r'(?:coefficient|coeff?|coef)\s*[:\s]*(\d+(?:[.,]\d+)?)', message, re.IGNORECASE)
    params["coefficient"] = float(coef_match.group(1).replace(',', '.')) if coef_match else 1.0
    # Nom de la matière
    name_match = re.search(
        r'(?:mati[eè]re|cours|module)\s+(?:de\s+|d\')?([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s\-]+?)(?:\s+(?:pour|de la classe|classe|coeff|coefficient|avec)|$)',
        message, re.IGNORECASE
    )
    if name_match:
        params["nom"] = name_match.group(1).strip().title()
    else:
        name_match2 = re.search(
            r"(?:appel[lé][e]?|s'appelle|nommée?)\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s\-]+?)(?:\s+(?:pour|classe)|$)",
            message, re.IGNORECASE
        )
        if name_match2:
            params["nom"] = name_match2.group(1).strip().title()
    return params


def find_professor_by_name(message: str, db: Session):
    from db.models import User
    profs = db.query(User).filter(User.role == "professeur").all()
    msg_lower = message.lower()
    for p in profs:
        if p.nom.lower() in msg_lower and p.prenom.lower() in msg_lower:
            return p
    for p in profs:
        if p.nom.lower() in msg_lower or p.prenom.lower() in msg_lower:
            return p
    return None


# ── Constantes dialogue champ par champ ──────────────────────────────────────

PROF_FIELDS = ["prenom", "nom", "email", "password"]
PROF_QUESTIONS = {
    "prenom":   "Quel est le prénom du professeur ?",
    "nom":      "Quel est son nom de famille ?",
    "email":    "Quelle est son adresse email ?",
    "password": "Quel mot de passe souhaitez-vous lui attribuer ?",
}

MATIERE_FIELDS = ["nom", "classe", "coefficient"]
MATIERE_QUESTIONS = {
    "nom":         "Quel est le nom de la matière ?",
    "classe":      "Pour quelle classe ? Répondez A, B ou C.",
    "coefficient": "Quel est le coefficient ? (par défaut 1, appuyez sur Entrée pour ignorer)",
}

CANCEL_WORDS = ["annuler", "annule", "stop", "arrêter", "arrête", "non", "quitter", "abandonner"]


def parse_field_value(field: str, message: str):
    """Extrait la valeur d'un champ depuis une réponse courte."""
    val = message.strip().rstrip('.,;!?')
    if field == "email":
        m = re.search(r'[\w.+\-]+@[\w\-]+\.[a-zA-Z]{2,}', message)
        return m.group() if m else val.lower()
    if field == "classe":
        m = re.search(r'\b([ABC])\b', message.upper())
        return m.group(1) if m else "A"
    if field == "coefficient":
        m = re.search(r'(\d+(?:[.,]\d+)?)', message)
        return float(m.group(1).replace(',', '.')) if m else 1.0
    return val.capitalize() if field in ("prenom", "nom") else val


def _next_question(action: str, params: dict) -> tuple:
    """Retourne (field, question) du prochain champ manquant, ou (None, None)."""
    fields    = PROF_FIELDS    if action == "create_professor" else MATIERE_FIELDS
    questions = PROF_QUESTIONS if action == "create_professor" else MATIERE_QUESTIONS
    for f in fields:
        if f not in params:
            return f, questions[f]
    return None, None


def _incomplete(action: str, params: dict, field: str, question: str) -> dict:
    return {"type": "incomplete", "action": action, "params": params,
            "field": field, "reply": question}


def _complete_professor(params: dict) -> dict:
    return {
        "type":   "action",
        "action": "create_professor",
        "params": params,
        "reply":  f"Parfait ! Je vais créer le compte de {params['prenom']} {params['nom']} ({params['email']}). Confirmez-vous ?"
    }


def _complete_matiere(params: dict) -> dict:
    return {
        "type":   "action",
        "action": "create_matiere",
        "params": params,
        "reply":  f"Je vais créer la matière '{params['nom']}' pour la classe {params.get('classe', 'A')} (coefficient {params.get('coefficient', 1.0)}). Confirmez-vous ?"
    }


def parse_command(message: str, db: Session, pending: dict = None) -> dict:
    msg = message.lower()

    # ── Annulation ───────────────────────────────────────────────────────────
    if pending and any(w in msg for w in CANCEL_WORDS):
        return {"type": "cancelled", "reply": "Action annulée. Comment puis-je vous aider ?"}

    # ── Continuer un champ précis ─────────────────────────────────────────────
    if pending and pending.get("field"):
        action   = pending["action"]
        field    = pending["field"]
        existing = dict(pending.get("params", {}))

        if action in ("create_professor", "create_matiere"):
            existing[field] = parse_field_value(field, message)
            next_f, question = _next_question(action, existing)
            if next_f:
                return _incomplete(action, existing, next_f, question)
            return _complete_professor(existing) if action == "create_professor" else _complete_matiere(existing)

        if action == "deactivate_professor":
            professor = find_professor_by_name(message, db)
            if professor:
                return {
                    "type": "action", "action": "deactivate_professor",
                    "params": {"prof_id": str(professor.id), "nom": professor.nom,
                               "prenom": professor.prenom, "email": professor.email},
                    "reply": f"Je vais désactiver le compte de {professor.prenom} {professor.nom}. Confirmez-vous ?"
                }
            return _incomplete("deactivate_professor", {}, "name",
                               "Je n'ai pas trouvé ce professeur. Donnez-moi son nom de famille exact.")

    # ── Nouvelle commande ─────────────────────────────────────────────────────
    create_kw = ["ajouter", "ajoute", "créer", "crée", "creer", "cree", "nouveau", "nouvelle",
                 "enregistrer", "enregistre", "inscrire", "inscris"]

    # 1. CRÉER UN PROFESSEUR
    if any(w in msg for w in create_kw) and any(w in msg for w in ["professeur", "prof", "enseignant"]):
        params = extract_professor_params(message)
        next_f, question = _next_question("create_professor", params)
        if next_f:
            if not params:
                question = "Quel est le prénom du professeur ?"
            return _incomplete("create_professor", params, next_f, question)
        return _complete_professor(params)

    # 2. CRÉER UNE MATIÈRE
    if any(w in msg for w in create_kw) and any(w in msg for w in ["matière", "matiere", "cours", "module"]):
        params = extract_matiere_params(message)
        next_f, question = _next_question("create_matiere", params)
        if next_f:
            return _incomplete("create_matiere", params, next_f, question)
        return _complete_matiere(params)

    # 3. DÉSACTIVER UN PROFESSEUR
    if any(w in msg for w in ["désactiver", "desactiver", "suspendre", "bloquer", "désactivez"]) and \
       any(w in msg for w in ["professeur", "prof", "enseignant"]):
        professor = find_professor_by_name(message, db)
        if professor:
            return {
                "type": "action", "action": "deactivate_professor",
                "params": {"prof_id": str(professor.id), "nom": professor.nom,
                           "prenom": professor.prenom, "email": professor.email},
                "reply": f"Je vais désactiver le compte de {professor.prenom} {professor.nom}. Confirmez-vous ?"
            }
        return _incomplete("deactivate_professor", {}, "name",
                           "Quel est le nom de famille du professeur à désactiver ?")

    # Réponse informative par défaut
    reply = generate_response(message, db)
    return {"type": "query", "reply": reply}


@router.post("/voice/command")
async def voice_command(
    req: ChatRequest,
    db: Session = Depends(get_db),
    _=Depends(admin_only)
):
    try:
        print(f"[COMMAND] Message: {req.message} | Pending: {req.pending_action}")
        result = parse_command(req.message, db, pending=req.pending_action)
        print(f"[COMMAND] Type={result.get('type')} Action={result.get('action')}")
        return result
    except Exception as e:
        print(f"[COMMAND ERROR] {e}")
        return {"type": "query", "reply": "Erreur lors du traitement de votre commande."}


@router.post("/voice/transcribe")
async def transcribe_audio(
    audio: UploadFile = File(...),
    _=Depends(admin_or_prof)
):
    try:
        audio_bytes = await audio.read()
        print(f"[ASSEMBLYAI] Audio reçu: {len(audio_bytes)} bytes")
        if len(audio_bytes) < 1000:
            return {"error": "Audio trop court — parlez plus longtemps avant de cliquer stop"}

        async with httpx.AsyncClient(timeout=60) as client:

            # Upload
            upload_res = await client.post(
                "https://api.assemblyai.com/v2/upload",
                headers={
                    "authorization": ASSEMBLYAI_KEY,
                    "content-type":  "application/octet-stream",
                },
                content=audio_bytes,
            )
            print(f"[ASSEMBLYAI] Upload status: {upload_res.status_code}")
            if upload_res.status_code != 200 or not upload_res.text.strip():
                print(f"[ASSEMBLYAI] Upload body: {upload_res.text[:300]}")
                return {"error": f"Upload échoué (HTTP {upload_res.status_code})"}
            try:
                upload_url = upload_res.json().get("upload_url")
            except Exception:
                print(f"[ASSEMBLYAI] Upload réponse non-JSON: {upload_res.text[:300]}")
                return {"error": "Réponse upload invalide"}

            if not upload_url:
                return {"error": "Upload échoué — URL manquante"}
            print(f"[ASSEMBLYAI] Upload OK → {upload_url[:50]}")

            # Transcription
            transcript_res = await client.post(
                "https://api.assemblyai.com/v2/transcript",
                headers={
                    "authorization": ASSEMBLYAI_KEY,
                    "content-type": "application/json"
                },
                json={
                    "audio_url":     upload_url,
                    "speech_models": ["universal-2"],
                }
            )
            print(f"[ASSEMBLYAI] Transcript status: {transcript_res.status_code}")
            if transcript_res.status_code != 200 or not transcript_res.text.strip():
                print(f"[ASSEMBLYAI] Transcript body: {transcript_res.text[:300]}")
                return {"error": f"Transcription échouée (HTTP {transcript_res.status_code})"}
            try:
                transcript_data = transcript_res.json()
            except Exception:
                print(f"[ASSEMBLYAI] Transcript réponse non-JSON: {transcript_res.text[:300]}")
                return {"error": "Réponse transcription invalide"}

            print(f"[ASSEMBLYAI] Transcript data: {transcript_data}")
            transcript_id = transcript_data.get("id")

            if not transcript_id:
                api_error = transcript_data.get("error", "Transcription échouée")
                print(f"[ASSEMBLYAI] Erreur API: {api_error}")
                return {"error": api_error}

            # Polling
            for i in range(30):
                await asyncio.sleep(2)
                poll = await client.get(
                    f"https://api.assemblyai.com/v2/transcript/{transcript_id}",
                    headers={"authorization": ASSEMBLYAI_KEY}
                )
                data = poll.json()
                status = data.get("status")
                text  = data.get("text", "")
                print(f"[ASSEMBLYAI] Poll {i+1}: status={status} | text={repr(text)} | confidence={data.get('confidence')}")

                if status == "completed":
                    print(f"[ASSEMBLYAI] ✅ Texte final: {text}")
                    return {"text": text}
                if status == "error":
                    return {"error": data.get("error", "Erreur transcription")}

        return {"error": "Timeout — réessayez"}

    except Exception as e:
        print(f"[TRANSCRIBE ERROR] {e}")
        return {"error": str(e)}


@router.post("/voice/chat")
async def chat_smart(
    req: ChatRequest,
    db: Session = Depends(get_db),
    _=Depends(admin_only)
):
    try:
        print(f"[CHAT] Question: {req.message}")
        reply = generate_response(req.message, db)
        print(f"[CHAT] Réponse: {reply}")
        return {"reply": reply}
    except Exception as e:
        print(f"[CHAT ERROR] {e}")
        return {"reply": "Erreur lors du traitement de votre demande."}


def generate_response_prof(message: str, db: Session, user) -> str:
    from db.models import Student, Attendance, Matiere, Alert
    from db.models import Session as SessionModel
    from datetime import datetime, timezone

    msg = message.lower()

    matieres = db.query(Matiere).filter(Matiere.professeur_id == user.id).all()
    nb_matieres = len(matieres)

    # Calcul global présence sur toutes les matières du prof
    total_att = present = absent = 0
    for m in matieres:
        sessions = db.query(SessionModel).filter(SessionModel.matiere_id == m.id).all()
        for s in sessions:
            t = db.query(Attendance).filter(Attendance.session_id == s.id).count()
            p = db.query(Attendance).filter(
                Attendance.session_id == s.id, Attendance.status == "present"
            ).count()
            a = db.query(Attendance).filter(
                Attendance.session_id == s.id, Attendance.status == "absent"
            ).count()
            total_att += t
            present   += p
            absent    += a

    taux = round(present / total_att * 100, 1) if total_att > 0 else 0

    # Alertes professeur
    alertes = db.query(Alert).filter(
        Alert.target_role == "professeur", Alert.is_read == False
    ).count()

    # Sessions aujourd'hui
    today = datetime.now(timezone.utc).date()
    sessions_today = []
    for m in matieres:
        sessions = db.query(SessionModel).filter(
            SessionModel.matiere_id == m.id, SessionModel.date == today
        ).all()
        for s in sessions:
            sessions_today.append((m.nom, s))

    # Étudiants absents (tous cours confondus)
    seen = set()
    absents_list = []
    for m in matieres:
        sessions = db.query(SessionModel).filter(SessionModel.matiere_id == m.id).all()
        for s in sessions:
            atts = db.query(Attendance).filter(
                Attendance.session_id == s.id, Attendance.status == "absent"
            ).all()
            for a in atts:
                student = db.query(Student).filter(Student.id == a.student_id).first()
                if student and str(student.id) not in seen:
                    seen.add(str(student.id))
                    total_abs = db.query(Attendance).filter(
                        Attendance.student_id == student.id, Attendance.status == "absent"
                    ).count()
                    absents_list.append((student, total_abs))

    absents_list.sort(key=lambda x: x[1], reverse=True)

    if any(w in msg for w in ["bonjour", "salut", "hello", "bonsoir"]):
        return (f"Bonjour ! Vous enseignez {nb_matieres} matière(s) avec un taux de présence "
                f"moyen de {taux}%. {alertes} alerte(s) non lue(s).")

    if any(w in msg for w in ["présence", "presence", "taux"]):
        if nb_matieres == 0:
            return "Vous n'avez aucune matière assignée pour le moment."
        return (f"Taux de présence global dans vos cours : {taux}%. "
                f"Sur {total_att} présences enregistrées, {present} présents et {absent} absents.")

    if any(w in msg for w in ["absent", "absence", "manqu"]):
        if not absents_list:
            return "Aucun étudiant absent dans vos cours. Excellent !"
        top = ", ".join([f"{s.prenom} {s.nom} ({n} abs.)" for s, n in absents_list[:3]])
        return (f"Il y a {len(absents_list)} étudiant(s) avec des absences dans vos cours. "
                f"Les plus absents : {top}.")

    if any(w in msg for w in ["matière", "matiere", "cours", "enseign"]):
        if nb_matieres == 0:
            return "Aucune matière ne vous est assignée pour le moment."
        noms = ", ".join([m.nom for m in matieres])
        return f"Vous enseignez {nb_matieres} matière(s) : {noms}."

    if any(w in msg for w in ["aujourd", "session", "séance"]):
        if not sessions_today:
            return "Vous n'avez aucune séance prévue aujourd'hui."
        details = ", ".join([f"{nom}" for nom, _ in sessions_today])
        return f"Vous avez {len(sessions_today)} séance(s) aujourd'hui : {details}."

    if any(w in msg for w in ["alerte", "alert", "notification"]):
        if alertes == 0:
            return "Aucune alerte non lue pour le moment."
        return f"Il y a {alertes} alerte(s) non lue(s) vous concernant."

    if any(w in msg for w in ["résumé", "resume", "bilan", "statistique", "overview"]):
        return (f"Bilan : {nb_matieres} matière(s), taux de présence {taux}%, "
                f"{len(absents_list)} étudiant(s) avec absences, {alertes} alerte(s) non lue(s).")

    return ("Je n'ai pas compris votre question. Vous pouvez me demander : "
            "le taux de présence, vos matières, les absences, "
            "les sessions d'aujourd'hui, ou les alertes.")


@router.post("/voice/chat-prof")
async def chat_prof(
    req: ChatRequest,
    db: Session = Depends(get_db),
    current_user=Depends(admin_or_prof)
):
    try:
        print(f"[CHAT-PROF] Question: {req.message}")
        reply = generate_response_prof(req.message, db, current_user)
        print(f"[CHAT-PROF] Réponse: {reply}")
        return {"reply": reply}
    except Exception as e:
        print(f"[CHAT-PROF ERROR] {e}")
        return {"reply": "Erreur lors du traitement de votre demande."}