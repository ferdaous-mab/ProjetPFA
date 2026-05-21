from fastapi import APIRouter, Depends, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from auth.dependencies import admin_only, admin_or_prof, get_db
import httpx
import os
import re
import json
import asyncio
from dotenv import load_dotenv

load_dotenv(override=True)

router = APIRouter()

ASSEMBLYAI_KEY  = os.getenv("ASSEMBLYAI_API_KEY", "")
ANTHROPIC_KEY   = os.getenv("ANTHROPIC_API_KEY", "")


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

    # Mots-clés multilingues (FR · EN · TR · AR)
    KW = {
        "presence":  ["présence", "presence", "taux", "global",
                      "attendance", "devam", "حضور", "نسبة"],
        "risk":      ["risque", "danger", "difficulté", "problème",
                      "risk", "at risk", "riskli", "tehlike", "خطر", "في خطر"],
        "alert":     ["alerte", "alert", "notification",
                      "bildiri", "uyarı", "تنبيه", "إشعار"],
        "student":   ["étudiant", "etudiants", "élève", "inscrit", "enrôlé",
                      "student", "öğrenci", "طالب", "تلميذ"],
        "professor": ["professeur", "prof", "enseignant",
                      "teacher", "öğretmen", "أستاذ", "معلم"],
        "subject":   ["matière", "matiere", "cours",
                      "course", "subject", "ders", "مادة"],
        "absence":   ["absent", "absence", "manqu",
                      "absentee", "devamsız", "غياب"],
        "grade":     ["note", "moyenne", "résultat", "grade",
                      "score", "not", "puan", "درجة", "علامة"],
        "hello":     ["bonjour", "salut", "hello", "bonsoir",
                      "hi", "merhaba", "selam", "مرحبا", "السلام"],
        "summary":   ["résumé", "resume", "overview", "bilan", "statistique",
                      "summary", "özet", "istatistik", "ملخص", "إحصاء"],
    }

    if any(w in msg for w in KW["presence"]):
        return (f"Le taux de présence global est de {taux_global}%. "
                f"Sur {total_att} séances enregistrées, {present} présences et {absent} absences.")

    if any(w in msg for w in KW["risk"]):
        if len(at_risk) == 0:
            return "Aucun étudiant à risque détecté pour le moment. Tout va bien !"
        noms = ", ".join([f"{s['prenom']} {s['nom']}" for s in at_risk[:3]])
        return (f"Il y a {len(at_risk)} étudiant(s) à risque. "
                f"Les plus concernés sont : {noms}.")

    if any(w in msg for w in KW["alert"]):
        if alertes == 0:
            return "Aucune alerte non lue pour le moment."
        return f"Il y a {alertes} alerte(s) non lue(s) en attente."

    if any(w in msg for w in KW["student"]):
        return (f"La plateforme compte {total_students} étudiant(s) au total, "
                f"dont {enrolled} enrôlés avec reconnaissance faciale.")

    if any(w in msg for w in KW["professor"]):
        return f"Il y a {total_profs} professeur(s) enregistré(s) sur la plateforme."

    if any(w in msg for w in KW["subject"]):
        matieres = db.query(Matiere).count()
        return f"La plateforme compte {matieres} matière(s) enregistrée(s)."

    if any(w in msg for w in KW["absence"]):
        return (f"Il y a {absent} absence(s) enregistrée(s) au total. "
                f"Le taux d'absence global est de {round(100 - taux_global, 1)}%.")

    if any(w in msg for w in KW["grade"]):
        grades = db.query(Grade).count()
        if grades == 0:
            return "Aucune note enregistrée pour le moment."
        from sqlalchemy import func
        avg = db.query(func.avg(Grade.note)).scalar()
        return f"Il y a {grades} note(s) enregistrée(s). La moyenne générale est de {round(avg, 2)}/20."

    if any(w in msg for w in KW["hello"]):
        return (f"Bonjour ! Je suis votre assistant SmartCampus. "
                f"Vous avez {total_students} étudiants, {total_profs} professeurs "
                f"et un taux de présence de {taux_global}%.")

    if any(w in msg for w in KW["summary"]):
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


NIVEAU_MAP = {
    "1": "1ère année", "première": "1ère année", "premières": "1ère année",
    "premier": "1ère année", "premiers": "1ère année",
    "1ère": "1ère année", "1ere": "1ère année",
    "première année": "1ère année", "premières années": "1ère année",
    "2": "2ème année", "deuxième": "2ème année", "deuxièmes": "2ème année",
    "deuxieme": "2ème année", "2ème": "2ème année", "2eme": "2ème année",
    "deuxième année": "2ème année", "deuxièmes années": "2ème année",
    "3": "3ème année", "troisième": "3ème année", "troisièmes": "3ème année",
    "troisieme": "3ème année", "3ème": "3ème année", "3eme": "3ème année",
    "troisième année": "3ème année", "troisièmes années": "3ème année",
    "4": "4ème année", "quatrième": "4ème année", "quatrièmes": "4ème année",
    "quatrieme": "4ème année", "4ème": "4ème année", "4eme": "4ème année",
    "quatrième année": "4ème année", "quatrièmes années": "4ème année",
    "5": "5ème année", "cinquième": "5ème année", "cinquièmes": "5ème année",
    "cinquieme": "5ème année", "5ème": "5ème année", "5eme": "5ème année",
    "cinquième année": "5ème année", "cinquièmes années": "5ème année",
}

_STOP = r'(?=\s+(?:et\s+(?:le|la|il)|avec|pour|coeff?|coefficient|\d)|[,.]|$)'

_NIVEAUX_VALIDES = ["1ère année", "2ème année", "3ème année", "4ème année", "5ème année"]

def extract_matiere_params_llm(message: str) -> dict:
    """Utilise Claude pour extraire les paramètres d'une matière depuis du langage naturel."""
    if not ANTHROPIC_KEY:
        return {}
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=ANTHROPIC_KEY)
        prompt = f"""Extrait les informations d'une matière scolaire depuis cette phrase en français.
Réponds UNIQUEMENT avec du JSON valide, rien d'autre.

Champs à extraire :
- "nom" : le nom de la matière (ex: "Mathématiques", "Algorithmique", "Physique")
- "annee_scolaire" : le niveau, OBLIGATOIREMENT l'une de ces valeurs exactes : {_NIVEAUX_VALIDES}
- "coefficient" : un nombre (défaut 1 si non mentionné)

Si un champ est absent de la phrase, ne l'inclus pas dans le JSON.

Phrase : "{message}"

JSON :"""
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=150,
            messages=[{"role": "user", "content": prompt}]
        )
        raw = response.content[0].text.strip()
        # Extraire le JSON même si du texte l'entoure
        json_match = re.search(r'\{[^}]+\}', raw, re.DOTALL)
        if not json_match:
            return {}
        data = json.loads(json_match.group())
        result = {}
        if "nom" in data and isinstance(data["nom"], str) and data["nom"].strip():
            result["nom"] = data["nom"].strip().title()
        if "annee_scolaire" in data and data["annee_scolaire"] in _NIVEAUX_VALIDES:
            result["annee_scolaire"] = data["annee_scolaire"]
        if "coefficient" in data:
            try:
                result["coefficient"] = float(data["coefficient"])
            except (ValueError, TypeError):
                pass
        return result
    except Exception as e:
        print(f"[LLM EXTRACT] Erreur: {e}")
        return {}


def parse_annee_scolaire(text: str):
    """Convertit une réponse vocale en valeur annee_scolaire normalisée."""
    t = text.strip().lower().rstrip('.,;!?')
    # Supprimer les expressions coefficient pour éviter les faux positifs sur les chiffres
    t_clean = re.sub(r'(?:coefficient|coeff?|coef)[^0-9]{0,20}\d+(?:[.,]\d+)?', '', t, flags=re.IGNORECASE)
    for key in sorted(NIVEAU_MAP, key=len, reverse=True):
        if key in t_clean:
            return NIVEAU_MAP[key]
    m = re.search(r'\b([1-5])\b', t_clean)
    if m:
        return NIVEAU_MAP.get(m.group(1), "1ère année")
    return None


def _extract_name(message: str):
    """Extrait le nom d'une matière depuis une phrase naturelle."""
    patterns = [
        # "le nom est X" / "nom sera X"  — en premier car le plus précis
        r'nom\s+(?:est|sera|c\'est)\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s\-]+?)' + _STOP,
        # "s'appelle X", "appelée X", "nommée X"
        r"(?:s'appelle|appel[lé][e]?|nommée?)\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s\-]+?)" + _STOP,
        # "c'est X"
        r"c'est\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s\-]+?)" + _STOP,
        # "matière de X" / "cours de X"  — exige "de" pour ne pas capter "matière dans..."
        r"(?:mati[eè]re|cours|module)\s+de\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s\-]+?)" + _STOP,
        r"(?:mati[eè]re|cours|module)\s+d'([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s\-]+?)" + _STOP,
    ]
    for pat in patterns:
        m = re.search(pat, message, re.IGNORECASE)
        if m:
            return m.group(1).strip().title()
    return None


def extract_matiere_params(message: str) -> dict:
    # ── 1. Essayer Claude en priorité ─────────────────────────────────────────
    params = extract_matiere_params_llm(message)
    if params:
        return params

    # ── 2. Fallback regex si Claude indisponible ───────────────────────────────
    params = {}
    nv = parse_annee_scolaire(message)
    if nv:
        params["annee_scolaire"] = nv
    classe_match = re.search(r'(?:classe|groupe)\s*[:\s]*([ABCD])\b', message, re.IGNORECASE)
    if classe_match:
        params["classe"] = classe_match.group(1).upper()
    coef_match = re.search(r'(?:coefficient|coeff?|coef)[^0-9]{0,20}(\d+(?:[.,]\d+)?)', message, re.IGNORECASE)
    if coef_match:
        params["coefficient"] = float(coef_match.group(1).replace(',', '.'))
    name = _extract_name(message)
    if not name:
        residual = re.sub(r'(?:coefficient|coeff?|coef)[^0-9]{0,20}\d+(?:[.,]\d+)?', '', message, flags=re.IGNORECASE)
        residual = re.sub(
            r'\b(?:\d+ème?s?|premières?|deuxièmes?|troisièmes?|quatrièmes?|cinquièmes?)\s+ann[ée]es?\b',
            '', residual, flags=re.IGNORECASE
        )
        residual = re.sub(
            r"\b(?:comment|tu|vas|je|veux|voudrais|ajouter|créer|mettre|nouvelle?|nouveau"
            r"|une|un|la|le|les|des|du|dans|pour|avec|et|il|de|l'|l'ajouter|c'est|est|sera"
            r"|matière|cours|module|nom|appel[lé]e?|s'appelle|nommée?)\b",
            ' ', residual, flags=re.IGNORECASE
        )
        residual = ' '.join(residual.split()).strip()
        if residual and len(residual.split()) <= 5:
            name = residual.title()
    if name:
        params["nom"] = name
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

PROF_FIELDS = ["prenom", "nom", "email"]
PROF_QUESTIONS = {
    "prenom": "Quel est le prénom du professeur ?",
    "nom":    "Quel est son nom de famille ?",
    "email":  "Quelle est son adresse email ?",
}

MATIERE_FIELDS = ["nom", "annee_scolaire", "coefficient"]
MATIERE_QUESTIONS = {
    "nom":            "Quel est le nom de la matière ?",
    "annee_scolaire": "Pour quel niveau ? Dites 1, 2, 3, 4 ou 5 (ex: première année, 2ème année…)",
    "coefficient":    "Quel est le coefficient de cette matière ? (dites un nombre, ex: 1, 2, 3)",
}

CANCEL_WORDS = ["annuler", "annule", "stop", "arrêter", "arrête", "non", "quitter", "abandonner"]


def parse_field_value(field: str, message: str):
    """Extrait la valeur d'un champ depuis une réponse courte."""
    val = message.strip().rstrip('.,;!?')
    if field == "email":
        m = re.search(r'[\w.+\-]+@[\w\-]+\.[a-zA-Z]{2,}', message)
        return m.group() if m else val.lower()
    if field == "annee_scolaire":
        return parse_annee_scolaire(message) or "1ère année"
    if field == "classe":
        m = re.search(r'\b([ABCD])\b', message.upper())
        return m.group(1) if m else "A"
    if field == "coefficient":
        m = re.search(r'(\d+(?:[.,]\d+)?)', message)
        return float(m.group(1).replace(',', '.')) if m else 1.0
    if field == "nom":
        # Essayer Claude d'abord
        llm = extract_matiere_params_llm(message)
        if llm.get("nom"):
            return llm["nom"]
        # Fallback regex
        name = _extract_name(message)
        if name:
            return name
        cleaned = re.sub(r'(?:coefficient|coeff?|coef)[^0-9]{0,20}\d+(?:[.,]\d+)?', '', message, flags=re.IGNORECASE)
        cleaned = re.sub(r'\b(?:\d+ème?|première?|deuxième?|troisième?|quatrième?|cinquième?)\s+ann[ée]e?\b', '', cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r'\b(?:je|la|le|les|un|une|des|du|c\'est|est|sera|pour|avec|et|il|de|nom|matière|cours|module|ajouter|créer|veux|nouvelle?|nouveau|appel[lé]e?)\b', ' ', cleaned, flags=re.IGNORECASE)
        cleaned = ' '.join(cleaned.split()).strip()
        return cleaned.title() if cleaned else val.capitalize()
    return val.capitalize() if field == "prenom" else val


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
        "reply":  f"Je vais créer le compte de {params['prenom']} {params['nom']} ({params['email']}). Un mot de passe temporaire sera généré automatiquement. Confirmez-vous ?"
    }


def _complete_matiere(params: dict) -> dict:
    final = {
        **params,
        "annee_scolaire": params.get("annee_scolaire", "1ère année"),
        "coefficient":    params.get("coefficient", 1.0),
    }
    return {
        "type":   "action",
        "action": "create_matiere",
        "params": final,
        "reply":  (
            f"Je vais créer la matière '{final['nom']}' — "
            f"{final['annee_scolaire']}, coefficient {final['coefficient']}. Confirmez-vous ?"
        ),
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
            # Extraire le champ demandé
            existing[field] = parse_field_value(field, message)
            # Essayer aussi d'extraire les autres champs manquants depuis la même réponse
            if action == "create_matiere":
                extra = extract_matiere_params(message)
                for f, v in extra.items():
                    if f not in existing:
                        existing[f] = v
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

    KW = {
        "hello":    ["bonjour", "salut", "hello", "bonsoir", "hi", "merhaba", "selam", "مرحبا"],
        "presence": ["présence", "presence", "taux", "attendance", "devam", "حضور"],
        "absence":  ["absent", "absence", "manqu", "absentee", "devamsız", "غياب"],
        "subject":  ["matière", "matiere", "cours", "enseign", "course", "ders", "مادة"],
        "session":  ["aujourd", "session", "séance", "today", "bugün", "اليوم"],
        "alert":    ["alerte", "alert", "notification", "uyarı", "تنبيه"],
        "summary":  ["résumé", "resume", "bilan", "statistique", "overview", "özet", "ملخص"],
    }

    if any(w in msg for w in KW["hello"]):
        return (f"Bonjour ! Vous enseignez {nb_matieres} matière(s) avec un taux de présence "
                f"moyen de {taux}%. {alertes} alerte(s) non lue(s).")

    if any(w in msg for w in KW["presence"]):
        if nb_matieres == 0:
            return "Vous n'avez aucune matière assignée pour le moment."
        return (f"Taux de présence global dans vos cours : {taux}%. "
                f"Sur {total_att} présences enregistrées, {present} présents et {absent} absents.")

    if any(w in msg for w in KW["absence"]):
        if not absents_list:
            return "Aucun étudiant absent dans vos cours. Excellent !"
        top = ", ".join([f"{s.prenom} {s.nom} ({n} abs.)" for s, n in absents_list[:3]])
        return (f"Il y a {len(absents_list)} étudiant(s) avec des absences dans vos cours. "
                f"Les plus absents : {top}.")

    if any(w in msg for w in KW["subject"]):
        if nb_matieres == 0:
            return "Aucune matière ne vous est assignée pour le moment."
        noms = ", ".join([m.nom for m in matieres])
        return f"Vous enseignez {nb_matieres} matière(s) : {noms}."

    if any(w in msg for w in KW["session"]):
        if not sessions_today:
            return "Vous n'avez aucune séance prévue aujourd'hui."
        details = ", ".join([f"{nom}" for nom, _ in sessions_today])
        return f"Vous avez {len(sessions_today)} séance(s) aujourd'hui : {details}."

    if any(w in msg for w in KW["alert"]):
        if alertes == 0:
            return "Aucune alerte non lue pour le moment."
        return f"Il y a {alertes} alerte(s) non lue(s) vous concernant."

    if any(w in msg for w in KW["summary"]):
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