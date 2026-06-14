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

ASSEMBLYAI_KEY = os.getenv("ASSEMBLYAI_API_KEY", "")
GROQ_KEY       = os.getenv("GROQ_API_KEY", "")
GEMINI_KEY     = os.getenv("GEMINI_API_KEY", "")  # fallback si Groq absent


class ChatRequest(BaseModel):
    message: str
    pending_action: Optional[dict] = None


# ── Configuration des actions ─────────────────────────────────────────────────

ACTION_FIELDS = {
    "create_professor":     ["prenom", "nom", "email"],
    "create_matiere":       ["nom", "annee_scolaire", "coefficient"],
    "create_note":          ["student_name", "matiere_name", "note"],
    "create_alert":         ["message", "annee_scolaire"],
    "create_schedule":      ["matiere_name", "classe", "jour", "heure_debut", "heure_fin"],
    "deactivate_professor": ["prof_name"],
    "reactivate_professor": ["prof_name"],
    "deactivate_student":   ["student_name"],
    "reactivate_student":   ["student_name"],
    "reset_password_prof":  ["prof_name"],
    "delete_matiere":       ["matiere_name"],
}

ACTION_QUESTIONS = {
    "create_professor": {
        "prenom": "Quel est le prénom du professeur ?",
        "nom":    "Quel est son nom de famille ?",
        "email":  "Quelle est son adresse email ?",
    },
    "create_matiere": {
        "nom":            "Quel est le nom de la matière ?",
        "annee_scolaire": "Pour quel niveau ? (1ère, 2ème, 3ème, 4ème ou 5ème année)",
        "coefficient":    "Quel est le coefficient ? (ex: 1, 2, 3)",
    },
    "create_note": {
        "student_name": "Pour quel étudiant ? (prénom et nom)",
        "matiere_name": "Pour quelle matière ?",
        "note":         "Quelle est la note sur 20 ? (ex: 14.5)",
    },
    "create_alert": {
        "message":      "Quel est le contenu de l'alerte ?",
        "annee_scolaire": "Pour quel niveau ? (1ère, 2ème, 3ème, 4ème, 5ème année, ou dites 'tous')",
    },
    "create_schedule": {
        "matiere_name": "Pour quelle matière ?",
        "classe":       "Pour quel groupe/classe ? (ex: A, B, C)",
        "jour":         "Quel jour ? (lundi, mardi, mercredi, jeudi, vendredi, samedi)",
        "heure_debut":  "Heure de début ? (ex: 08:00)",
        "heure_fin":    "Heure de fin ? (ex: 10:00)",
    },
    "deactivate_professor": {
        "prof_name": "Quel est le nom du professeur à désactiver ?",
    },
    "reactivate_professor": {
        "prof_name": "Quel est le nom du professeur à réactiver ?",
    },
    "deactivate_student": {
        "student_name": "Quel est le nom de l'étudiant à désactiver ?",
    },
    "reactivate_student": {
        "student_name": "Quel est le nom de l'étudiant à réactiver ?",
    },
    "reset_password_prof": {
        "prof_name": "Pour quel professeur réinitialiser le mot de passe ?",
    },
    "delete_matiere": {
        "matiere_name": "Quelle matière voulez-vous supprimer ?",
    },
}

CANCEL_WORDS = ["annuler", "annule", "stop", "arrêter", "arrête", "non", "quitter", "abandonner"]

NIVEAU_MAP = {
    "1": "1ère année", "première": "1ère année", "premières": "1ère année",
    "premier": "1ère année", "premiers": "1ère année",
    "1ère": "1ère année", "1ere": "1ère année",
    "2": "2ème année", "deuxième": "2ème année", "deuxièmes": "2ème année",
    "deuxieme": "2ème année", "2ème": "2ème année", "2eme": "2ème année",
    "3": "3ème année", "troisième": "3ème année", "troisièmes": "3ème année",
    "troisieme": "3ème année", "3ème": "3ème année", "3eme": "3ème année",
    "4": "4ème année", "quatrième": "4ème année", "quatrièmes": "4ème année",
    "quatrieme": "4ème année", "4ème": "4ème année", "4eme": "4ème année",
    "5": "5ème année", "cinquième": "5ème année", "cinquièmes": "5ème année",
    "cinquieme": "5ème année", "5ème": "5ème année", "5eme": "5ème année",
}

_NIVEAUX_VALIDES = ["1ère année", "2ème année", "3ème année", "4ème année", "5ème année"]

MOTS_COMMUNS_PROF = {
    "le", "la", "les", "un", "une", "des", "et", "dans", "pour", "avec",
    "nom", "prénom", "prenom", "nouveau", "nouvelle", "ajouter", "créer",
    "creer", "professeur", "prof", "monsieur", "madame", "mademoiselle",
    "mr", "mme", "de", "du", "en", "est", "son", "sa", "puis",
}


# ── Helpers DB ────────────────────────────────────────────────────────────────

def _find_student_by_name(name: str, db: Session):
    from db.models import Student
    name_lower = name.lower().strip()
    students = db.query(Student).all()
    for s in students:
        if name_lower == f"{s.prenom} {s.nom}".lower():
            return s
    for s in students:
        if name_lower in f"{s.prenom} {s.nom}".lower() or f"{s.prenom} {s.nom}".lower() in name_lower:
            return s
    for s in students:
        if s.nom.lower() in name_lower or s.prenom.lower() in name_lower:
            return s
    return None


def _find_matiere_by_name(name: str, db: Session):
    from db.models import Matiere
    name_lower = name.lower().strip()
    matieres = db.query(Matiere).all()
    for m in matieres:
        if name_lower == m.nom.lower():
            return m
    for m in matieres:
        if name_lower in m.nom.lower() or m.nom.lower() in name_lower:
            return m
    return None


def _find_professor_by_name(name: str, db: Session):
    from db.models import User
    name_lower = name.lower().strip()
    profs = db.query(User).filter(User.role == "professeur").all()
    for p in profs:
        if name_lower == f"{p.prenom} {p.nom}".lower():
            return p
    for p in profs:
        if name_lower in f"{p.prenom} {p.nom}".lower() or f"{p.prenom} {p.nom}".lower() in name_lower:
            return p
    for p in profs:
        if p.nom.lower() in name_lower or p.prenom.lower() in name_lower:
            return p
    return None


# ── Helpers ───────────────────────────────────────────────────────────────────

def parse_annee_scolaire(text: str):
    t = text.strip().lower().rstrip('.,;!?')
    t_clean = re.sub(r'(?:coefficient|coeff?|coef)[^0-9]{0,20}\d+(?:[.,]\d+)?', '', t, flags=re.IGNORECASE)
    for key in sorted(NIVEAU_MAP, key=len, reverse=True):
        if key in t_clean:
            return NIVEAU_MAP[key]
    m = re.search(r'\b([1-5])\b', t_clean)
    if m:
        return NIVEAU_MAP.get(m.group(1), "1ère année")
    return None


def _next_missing_field(action: str, params: dict):
    for f in ACTION_FIELDS.get(action, []):
        if f not in params:
            return f, ACTION_QUESTIONS.get(action, {}).get(f, f"Valeur pour {f} ?")
    return None, None


def _normalize_params(intent: str, params: dict) -> dict:
    result = {}
    for k, v in params.items():
        if v is None or v == "":
            continue
        if k == "annee_scolaire":
            normalized = parse_annee_scolaire(str(v))
            if normalized:
                result[k] = normalized
        elif k == "coefficient":
            try:
                result[k] = float(str(v).replace(',', '.'))
            except Exception:
                pass
        elif k == "note":
            try:
                result[k] = float(str(v).replace(',', '.'))
            except Exception:
                pass
        elif k in ("prenom", "nom") and isinstance(v, str):
            v = v.strip()
            if v and v.lower() not in MOTS_COMMUNS_PROF:
                result[k] = v.capitalize()
        elif k == "email" and "@" in str(v):
            result[k] = str(v).strip().lower()
        else:
            result[k] = v
    return result


def _parse_field_for_action(action: str, field: str, message: str) -> object:
    val = message.strip().rstrip('.,;!?')

    if field == "email":
        m = re.search(r'[\w.+\-]+@[\w\-]+\.[a-zA-Z]{2,}', message)
        return m.group() if m else val.lower()

    if field == "annee_scolaire":
        if any(w in message.lower() for w in ["tous", "toutes", "all"]):
            return "tous"
        return parse_annee_scolaire(message) or "1ère année"

    if field == "coefficient":
        m = re.search(r'(\d+(?:[.,]\d+)?)', message)
        return float(m.group(1).replace(',', '.')) if m else 1.0

    if field == "note":
        m = re.search(r'(\d+(?:[.,]\d+)?)', message)
        return float(m.group(1).replace(',', '.')) if m else 0.0

    if field == "jour":
        jours = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]
        for j in jours:
            if j in message.lower():
                return j.capitalize()
        return val.capitalize()

    if field in ("heure_debut", "heure_fin"):
        m = re.search(r'(\d{1,2})[h:](\d{0,2})', message)
        if m:
            h = int(m.group(1))
            mn = int(m.group(2)) if m.group(2) else 0
            return f"{h:02d}:{mn:02d}"
        m2 = re.search(r'(\d{1,2})', message)
        if m2:
            return f"{int(m2.group(1)):02d}:00"
        return val

    if field == "classe":
        m = re.search(r'\b([A-Da-d])\b', message)
        return m.group(1).upper() if m else val.upper()[:1] or "A"

    if field in ("prenom", "nom"):
        llm = _extract_name_fields_llm(message)
        if llm.get(field):
            return llm[field]
        cleaned = re.sub(r'\b(?:je|suis|c\'est|est|mon|ma|le|la|les|un|une)\b', ' ', message, flags=re.IGNORECASE)
        return ' '.join(cleaned.split()).strip().capitalize() or val.capitalize()

    if field in ("student_name", "prof_name", "matiere_name"):
        return _extract_single_name_llm(field, message) or val.strip()

    return val


def _call_llm(prompt: str) -> str:
    """Appelle Groq (priorité) ou Gemini (fallback). Retourne le texte brut."""
    if GROQ_KEY:
        try:
            from groq import Groq
            client = Groq(api_key=GROQ_KEY)
            resp = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[{"role": "user", "content": prompt}],
                temperature=0,
                max_tokens=512,
            )
            return resp.choices[0].message.content.strip()
        except Exception as e:
            print(f"[GROQ] Erreur: {e}")
    if GEMINI_KEY:
        try:
            from google import genai as genai_new
            client = genai_new.Client(api_key=GEMINI_KEY)
            response = client.models.generate_content(model="gemini-2.0-flash-lite", contents=prompt)
            return response.text.strip()
        except Exception as e:
            print(f"[GEMINI] Erreur: {e}")
    return ""


def _extract_name_fields_llm(message: str) -> dict:
    if not (GROQ_KEY or GEMINI_KEY):
        return {}
    try:
        prompt = f"""Extrait le prénom et le nom depuis cette phrase.
Réponds UNIQUEMENT avec du JSON: {{"prenom": "...", "nom": "..."}}
Ignore les mots communs (le, la, est, pour, etc.)
Phrase: "{message}"
JSON:"""
        raw = _call_llm(prompt)
        if not raw:
            return {}
        m = re.search(r'\{[^}]+\}', raw, re.DOTALL)
        if m:
            data = json.loads(m.group())
            result = {}
            for k in ("prenom", "nom"):
                v = data.get(k, "").strip()
                if v and v.lower() not in MOTS_COMMUNS_PROF:
                    result[k] = v.capitalize()
            return result
    except Exception:
        pass
    return {}


def _extract_single_name_llm(field: str, message: str) -> str:
    if not (GROQ_KEY or GEMINI_KEY):
        return ""
    labels = {
        "student_name": "nom complet de l'étudiant (prénom + nom)",
        "prof_name":    "nom du professeur (prénom et/ou nom)",
        "matiere_name": "nom de la matière ou du cours",
    }
    try:
        prompt = f"""Extrait uniquement le {labels.get(field, field)} depuis cette réponse.
Réponds UNIQUEMENT avec le nom, sans ponctuation ni explication.
Réponse: "{message}"
Nom:"""
        result = _call_llm(prompt).strip('"\'').strip()
        return result if result and len(result) < 60 else ""
    except Exception:
        return ""


# ── LLM : Détection d'intention ───────────────────────────────────────────────

def detect_intent_llm(message: str) -> dict:
    if not (GROQ_KEY or GEMINI_KEY):
        return {"intent": "unknown", "params": {}}
    try:
        prompt = f"""Tu es un assistant vocal pour une application de gestion scolaire (SmartCampus).
Analyse ce message en français et détermine l'intention + extrait les paramètres disponibles.

Intentions possibles:
- create_professor    : créer/ajouter un nouveau professeur
- create_matiere      : créer/ajouter une matière ou cours
- create_note         : ajouter/enregistrer une note pour un étudiant
- create_alert        : créer/envoyer une alerte ou notification
- create_schedule     : ajouter un créneau horaire au planning
- deactivate_professor: désactiver/suspendre/bloquer un professeur
- reactivate_professor: réactiver/débloquer un professeur
- deactivate_student  : désactiver/suspendre un étudiant
- reactivate_student  : réactiver un étudiant
- reset_password_prof : réinitialiser le mot de passe d'un professeur
- delete_matiere      : supprimer une matière
- query_stats         : question sur statistiques, présences, absences, étudiants, notes, alertes, etc.
- unknown             : autre

Paramètres selon intention:
- create_professor    : prenom, nom, email
- create_matiere      : nom (nom de la matière), annee_scolaire (exactement: "1ère année","2ème année","3ème année","4ème année","5ème année"), coefficient (nombre)
- create_note         : student_name (prénom+nom complet), matiere_name, note (nombre sur 20)
- create_alert        : message (texte de l'alerte), annee_scolaire (niveau ou "tous")
- create_schedule     : matiere_name, classe (A/B/C/D), jour, heure_debut (HH:MM), heure_fin (HH:MM)
- deactivate_professor: prof_name (prénom et/ou nom)
- reactivate_professor: prof_name
- deactivate_student  : student_name
- reactivate_student  : student_name
- reset_password_prof : prof_name
- delete_matiere      : matiere_name

IMPORTANT: Réponds UNIQUEMENT avec du JSON valide, rien d'autre, sans markdown.
Exemples:
{{"intent": "create_matiere", "params": {{"nom": "Mathématiques", "annee_scolaire": "2ème année", "coefficient": 4}}}}
{{"intent": "create_professor", "params": {{"prenom": "Ahmed", "nom": "Benali", "email": "ahmed@example.com"}}}}
{{"intent": "query_stats", "params": {{}}}}

Message: "{message}"
JSON:"""
        raw = _call_llm(prompt)
        if not raw:
            return {"intent": "unknown", "params": {}}
        m = re.search(r'\{.*\}', raw, re.DOTALL)
        if not m:
            return {"intent": "unknown", "params": {}}
        data = json.loads(m.group())
        return data
    except Exception as e:
        print(f"[INTENT] Erreur: {e}")
        return {"intent": "unknown", "params": {}}


# ── LLM : Extraction matière ──────────────────────────────────────────────────

def extract_matiere_params_llm(message: str) -> dict:
    if not (GROQ_KEY or GEMINI_KEY):
        return {}
    try:
        prompt = f"""Extrait les informations d'une matière scolaire depuis cette phrase en français.
Réponds UNIQUEMENT avec du JSON valide, sans markdown, rien d'autre.

Champs à extraire :
- "nom" : le nom de la matière (ex: "Mathématiques", "Algorithmique", "Physique")
- "annee_scolaire" : le niveau, OBLIGATOIREMENT l'une de ces valeurs exactes : {_NIVEAUX_VALIDES}
- "coefficient" : un nombre (défaut 1 si non mentionné)

Si un champ est absent de la phrase, ne l'inclus pas dans le JSON.

Phrase : "{message}"

JSON :"""
        raw = _call_llm(prompt)
        if not raw:
            return {}
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


# ── LLM : Extraction professeur ───────────────────────────────────────────────

def extract_professor_params_llm(message: str) -> dict:
    if not (GROQ_KEY or GEMINI_KEY):
        return {}
    try:
        prompt = f"""Extrait les informations d'un professeur depuis cette phrase en français.
Réponds UNIQUEMENT avec du JSON valide, sans markdown, rien d'autre.

Champs à extraire :
- "prenom" : le prénom du professeur (un vrai prénom humain uniquement)
- "nom" : le nom de famille du professeur (un vrai nom de famille uniquement)
- "email" : l'adresse email si mentionnée

Ignore absolument tous les mots communs : le, la, et, dans, pour, avec, nom, prénom, nouveau, ajouter, créer, professeur, monsieur, madame, puis, son, etc.
Si un champ est absent ou ambigu, ne l'inclus pas dans le JSON.

Phrase : "{message}"

JSON :"""
        raw = _call_llm(prompt)
        if not raw:
            return {}
        json_match = re.search(r'\{[^}]+\}', raw, re.DOTALL)
        if not json_match:
            return {}
        data = json.loads(json_match.group())
        result = {}
        if "prenom" in data and isinstance(data["prenom"], str):
            v = data["prenom"].strip()
            if v and v.lower() not in MOTS_COMMUNS_PROF:
                result["prenom"] = v.capitalize()
        if "nom" in data and isinstance(data["nom"], str):
            v = data["nom"].strip()
            if v and v.lower() not in MOTS_COMMUNS_PROF:
                result["nom"] = v.capitalize()
        if "email" in data and isinstance(data["email"], str) and "@" in data["email"]:
            result["email"] = data["email"].strip().lower()
        return result
    except Exception as e:
        print(f"[LLM PROF EXTRACT] Erreur: {e}")
        return {}


# ── Résolution finale de l'action ─────────────────────────────────────────────

def _resolve_action(action: str, params: dict, db: Session) -> dict:
    if action == "create_professor":
        return {
            "type": "action", "action": action, "params": params,
            "reply": f"Je vais créer le compte de {params['prenom']} {params['nom']} ({params['email']}). Un mot de passe temporaire sera généré. Confirmez-vous ?"
        }

    if action == "create_matiere":
        return {
            "type": "action", "action": action, "params": params,
            "reply": f"Je vais créer la matière '{params['nom']}' — {params.get('annee_scolaire', '?')}, coefficient {params.get('coefficient', 1)}. Confirmez-vous ?"
        }

    if action == "create_note":
        student = _find_student_by_name(params.get("student_name", ""), db)
        matiere = _find_matiere_by_name(params.get("matiere_name", ""), db)
        if not student:
            params.pop("student_name", None)
            return {"type": "incomplete", "action": action, "params": params,
                    "field": "student_name",
                    "reply": f"Je n'ai pas trouvé l'étudiant '{params.get('student_name', '')}'. Quel est son nom exact ?"}
        if not matiere:
            params.pop("matiere_name", None)
            return {"type": "incomplete", "action": action, "params": params,
                    "field": "matiere_name",
                    "reply": f"Je n'ai pas trouvé la matière '{params.get('matiere_name', '')}'. Quel est son nom exact ?"}
        params["student_id"]      = str(student.id)
        params["matiere_id"]      = str(matiere.id)
        params["student_display"] = f"{student.prenom} {student.nom}"
        params["matiere_display"] = matiere.nom
        return {
            "type": "action", "action": action, "params": params,
            "reply": f"Je vais ajouter la note {params['note']}/20 à {student.prenom} {student.nom} pour {matiere.nom}. Confirmez-vous ?"
        }

    if action == "create_alert":
        niveau = params.get("annee_scolaire", "tous")
        if any(w in str(niveau).lower() for w in ["tous", "toutes", "all"]):
            params["annee_scolaire"] = "tous"
            cible_txt = "tous les étudiants"
        else:
            cible_txt = f"les étudiants de {niveau}"
        return {
            "type": "action", "action": action, "params": params,
            "reply": f"Je vais envoyer l'alerte '{params['message']}' à {cible_txt}. Confirmez-vous ?"
        }

    if action == "create_schedule":
        matiere = _find_matiere_by_name(params.get("matiere_name", ""), db)
        if not matiere:
            params.pop("matiere_name", None)
            return {"type": "incomplete", "action": action, "params": params,
                    "field": "matiere_name",
                    "reply": f"Je n'ai pas trouvé la matière '{params.get('matiere_name', '')}'. Quel est son nom exact ?"}
        params["matiere_id"]      = str(matiere.id)
        params["matiere_display"] = matiere.nom
        return {
            "type": "action", "action": action, "params": params,
            "reply": (f"Je vais ajouter {matiere.nom} — groupe {params.get('classe', '?')}, "
                      f"{params.get('jour', '?')} de {params.get('heure_debut', '?')} à {params.get('heure_fin', '?')}. Confirmez-vous ?")
        }

    if action == "deactivate_professor":
        prof = _find_professor_by_name(params.get("prof_name", ""), db)
        if not prof:
            return {"type": "incomplete", "action": action, "params": {},
                    "field": "prof_name",
                    "reply": f"Je n'ai pas trouvé '{params.get('prof_name', '')}'. Quel est le nom exact du professeur ?"}
        params["prof_id"]      = str(prof.id)
        params["display_name"] = f"{prof.prenom} {prof.nom}"
        return {
            "type": "action", "action": action, "params": params,
            "reply": f"Je vais désactiver le compte de {prof.prenom} {prof.nom}. Confirmez-vous ?"
        }

    if action == "reactivate_professor":
        prof = _find_professor_by_name(params.get("prof_name", ""), db)
        if not prof:
            return {"type": "incomplete", "action": action, "params": {},
                    "field": "prof_name",
                    "reply": f"Je n'ai pas trouvé '{params.get('prof_name', '')}'. Quel est le nom exact du professeur ?"}
        params["prof_id"]      = str(prof.id)
        params["display_name"] = f"{prof.prenom} {prof.nom}"
        return {
            "type": "action", "action": action, "params": params,
            "reply": f"Je vais réactiver le compte de {prof.prenom} {prof.nom}. Confirmez-vous ?"
        }

    if action == "deactivate_student":
        student = _find_student_by_name(params.get("student_name", ""), db)
        if not student:
            return {"type": "incomplete", "action": action, "params": {},
                    "field": "student_name",
                    "reply": f"Je n'ai pas trouvé '{params.get('student_name', '')}'. Quel est le nom exact de l'étudiant ?"}
        params["student_id"]   = str(student.id)
        params["display_name"] = f"{student.prenom} {student.nom}"
        return {
            "type": "action", "action": action, "params": params,
            "reply": f"Je vais désactiver le compte de {student.prenom} {student.nom}. Confirmez-vous ?"
        }

    if action == "reactivate_student":
        student = _find_student_by_name(params.get("student_name", ""), db)
        if not student:
            return {"type": "incomplete", "action": action, "params": {},
                    "field": "student_name",
                    "reply": f"Je n'ai pas trouvé '{params.get('student_name', '')}'. Quel est le nom exact de l'étudiant ?"}
        params["student_id"]   = str(student.id)
        params["display_name"] = f"{student.prenom} {student.nom}"
        return {
            "type": "action", "action": action, "params": params,
            "reply": f"Je vais réactiver le compte de {student.prenom} {student.nom}. Confirmez-vous ?"
        }

    if action == "reset_password_prof":
        prof = _find_professor_by_name(params.get("prof_name", ""), db)
        if not prof:
            return {"type": "incomplete", "action": action, "params": {},
                    "field": "prof_name",
                    "reply": f"Je n'ai pas trouvé '{params.get('prof_name', '')}'. Quel est le nom exact du professeur ?"}
        params["prof_id"]      = str(prof.id)
        params["display_name"] = f"{prof.prenom} {prof.nom}"
        return {
            "type": "action", "action": action, "params": params,
            "reply": f"Je vais réinitialiser le mot de passe de {prof.prenom} {prof.nom}. Confirmez-vous ?"
        }

    if action == "delete_matiere":
        matiere = _find_matiere_by_name(params.get("matiere_name", ""), db)
        if not matiere:
            return {"type": "incomplete", "action": action, "params": {},
                    "field": "matiere_name",
                    "reply": f"Je n'ai pas trouvé '{params.get('matiere_name', '')}'. Quel est le nom exact de la matière ?"}
        params["matiere_id"]   = str(matiere.id)
        params["display_name"] = matiere.nom
        return {
            "type": "action", "action": action, "params": params,
            "reply": f"Je vais supprimer la matière '{matiere.nom}'. Action irréversible. Confirmez-vous ?"
        }

    return {"type": "query", "reply": "Action non reconnue."}


# ── Réponses conversationnelles ───────────────────────────────────────────────

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

    KW = {
        "presence":  ["présence", "presence", "taux", "global", "attendance", "devam", "حضور", "نسبة"],
        "risk":      ["risque", "danger", "difficulté", "problème", "risk", "at risk", "riskli", "خطر"],
        "alert":     ["alerte", "alert", "notification", "bildiri", "uyarı", "تنبيه", "إشعار"],
        "student":   ["étudiant", "etudiants", "élève", "inscrit", "enrôlé", "student", "öğrenci", "طالب"],
        "professor": ["professeur", "prof", "enseignant", "teacher", "öğretmen", "أستاذ"],
        "subject":   ["matière", "matiere", "cours", "course", "subject", "ders", "مادة"],
        "absence":   ["absent", "absence", "manqu", "absentee", "devamsız", "غياب"],
        "grade":     ["note", "moyenne", "résultat", "grade", "score", "not", "puan", "درجة"],
        "hello":     ["bonjour", "salut", "hello", "bonsoir", "hi", "merhaba", "selam", "مرحبا"],
        "summary":   ["résumé", "resume", "overview", "bilan", "statistique", "summary", "özet", "ملخص"],
    }

    if any(w in msg for w in KW["presence"]):
        return (f"Le taux de présence global est de {taux_global}%. "
                f"Sur {total_att} séances, {present} présences et {absent} absences.")
    if any(w in msg for w in KW["risk"]):
        if not at_risk:
            return "Aucun étudiant à risque détecté. Tout va bien !"
        noms = ", ".join([f"{s['prenom']} {s['nom']}" for s in at_risk[:3]])
        return f"Il y a {len(at_risk)} étudiant(s) à risque. Les plus concernés : {noms}."
    if any(w in msg for w in KW["alert"]):
        if alertes == 0:
            return "Aucune alerte non lue."
        return f"Il y a {alertes} alerte(s) non lue(s)."
    if any(w in msg for w in KW["student"]):
        return f"La plateforme compte {total_students} étudiant(s), dont {enrolled} enrôlés."
    if any(w in msg for w in KW["professor"]):
        return f"Il y a {total_profs} professeur(s) actif(s)."
    if any(w in msg for w in KW["subject"]):
        matieres = db.query(Matiere).count()
        return f"La plateforme compte {matieres} matière(s)."
    if any(w in msg for w in KW["absence"]):
        return f"Il y a {absent} absence(s). Taux d'absence : {round(100 - taux_global, 1)}%."
    if any(w in msg for w in KW["grade"]):
        from sqlalchemy import func
        grades = db.query(Grade).count()
        if grades == 0:
            return "Aucune note enregistrée."
        avg = db.query(func.avg(Grade.note)).scalar()
        return f"{grades} note(s) enregistrée(s). Moyenne générale : {round(avg, 2)}/20."
    if any(w in msg for w in KW["hello"]):
        return (f"Bonjour ! Je suis votre assistant SmartCampus. "
                f"{total_students} étudiants, {total_profs} professeurs, taux de présence {taux_global}%.")
    if any(w in msg for w in KW["summary"]):
        return (f"Bilan : {total_students} étudiants ({enrolled} enrôlés), "
                f"taux de présence {taux_global}%, {len(at_risk)} étudiant(s) à risque, "
                f"{alertes} alerte(s) non lue(s).")

    return ("Je n'ai pas compris. Vous pouvez me demander : le taux de présence, "
            "les étudiants à risque, les alertes, ou les statistiques générales. "
            "Vous pouvez aussi créer un professeur, une matière, ajouter une note, etc.")


# ── Extraction regex matière ─────────────────────────────────────────────────

def _extract_matiere_regex(message: str) -> dict:
    params = {}
    msg = message

    # Coefficient
    coef_m = re.search(r'(?:coefficient|coeff?|coef)[^\d]{0,10}(\d+(?:[.,]\d+)?)', msg, re.IGNORECASE)
    if coef_m:
        params["coefficient"] = float(coef_m.group(1).replace(',', '.'))

    # Année scolaire
    nv = parse_annee_scolaire(msg)
    if nv:
        params["annee_scolaire"] = nv

    # Nom de la matière — patterns du plus précis au moins précis
    nom = None
    patterns = [
        r'nom\s+(?:est|sera|c\'est)\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s\-]{1,30}?)(?:\s+(?:le|la|les|et|avec|pour|coefficient|coeff?|\d)|[,.]|$)',
        r"(?:s'appelle|appel[lé][e]?|nommée?)\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s\-]{1,30}?)(?:\s+(?:le|la|les|et|coefficient|coeff?|\d)|[,.]|$)",
        r"(?:matière|matiere|cours|module)\s+(?:de\s+|d')?([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s\-]{1,30}?)(?:\s+(?:le|la|les|et|coefficient|coeff?|\d)|[,.]|$)",
        r"(?:c'est|c est)\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s\-]{1,30}?)(?:\s+(?:le|la|les|et|coefficient|coeff?|\d)|[,.]|$)",
    ]
    for pat in patterns:
        m = re.search(pat, msg, re.IGNORECASE)
        if m:
            candidate = m.group(1).strip().rstrip('.,;').strip()
            STOP = {"le", "la", "les", "de", "du", "un", "une", "et", "est", "dans", "pour"}
            if candidate.lower() not in STOP and len(candidate) > 1:
                nom = candidate.title()
                break

    if nom:
        params["nom"] = nom

    return params


# ── Fallback mots-clés ───────────────────────────────────────────────────────

def _keyword_intent_fallback(message: str) -> tuple:
    msg = message.lower()
    CREATE_KW     = ["ajouter", "ajoute", "créer", "crée", "creer", "cree", "nouveau",
                     "nouvelle", "enregistrer", "enregistre", "inscrire", "inscris", "mettre", "mets"]
    DEACT_KW      = ["désactiver", "desactiver", "suspendre", "bloquer", "désactivez", "désactive"]
    REACT_KW      = ["réactiver", "reactiver", "réactiver", "débloquer", "réactivez", "réactive"]
    RESET_KW      = ["réinitialiser", "reinitialiser", "reset", "nouveau mot de passe", "changer le mot"]
    DELETE_KW     = ["supprimer", "supprime", "effacer", "efface", "enlever", "enlève", "retirer"]
    PROF_KW       = ["professeur", "prof", "enseignant"]
    MATIERE_KW    = ["matière", "matiere", "cours", "module"]
    STUDENT_KW    = ["étudiant", "etudiants", "élève", "eleve"]
    NOTE_KW       = ["note", "noter", "score", "résultat", "résultat"]
    ALERT_KW      = ["alerte", "alert", "notification", "avertissement"]
    SCHEDULE_KW   = ["créneau", "creneau", "horaire", "emploi du temps", "planning", "séance", "seance"]
    PASSWORD_KW   = ["mot de passe", "password", "mdp"]

    is_create = any(w in msg for w in CREATE_KW)
    is_deact  = any(w in msg for w in DEACT_KW)
    is_react  = any(w in msg for w in REACT_KW)
    is_reset  = any(w in msg for w in RESET_KW) or (any(w in msg for w in PASSWORD_KW) and not is_create)
    is_delete = any(w in msg for w in DELETE_KW)
    has_prof  = any(w in msg for w in PROF_KW)
    has_mat   = any(w in msg for w in MATIERE_KW)
    has_stu   = any(w in msg for w in STUDENT_KW)

    if is_create and has_prof:
        params = extract_professor_params_llm(message)
        return "create_professor", params

    if is_create and has_mat:
        params = extract_matiere_params_llm(message)
        if not params:
            params = _extract_matiere_regex(message)
        return "create_matiere", params

    if is_create and any(w in msg for w in NOTE_KW):
        return "create_note", {}

    if is_create and any(w in msg for w in ALERT_KW):
        return "create_alert", {}

    if is_create and any(w in msg for w in SCHEDULE_KW):
        return "create_schedule", {}

    if is_deact and has_prof:
        return "deactivate_professor", {}

    if is_react and has_prof:
        return "reactivate_professor", {}

    if is_deact and has_stu:
        return "deactivate_student", {}

    if is_react and has_stu:
        return "reactivate_student", {}

    if is_reset and has_prof:
        return "reset_password_prof", {}

    if is_delete and has_mat:
        return "delete_matiere", {}

    return "unknown", {}


# ── parse_command ─────────────────────────────────────────────────────────────

def parse_command(message: str, db: Session, pending: dict = None) -> dict:
    msg = message.lower()

    # Annulation
    if pending and any(w in msg for w in CANCEL_WORDS):
        return {"type": "cancelled", "reply": "Action annulée. Comment puis-je vous aider ?"}

    # Continuer un champ manquant
    if pending and pending.get("field"):
        action   = pending["action"]
        field    = pending["field"]
        existing = dict(pending.get("params", {}))

        existing[field] = _parse_field_for_action(action, field, message)

        # Essayer d'extraire d'autres champs manquants depuis la même réponse
        if action in ("create_professor",):
            extra = extract_professor_params_llm(message)
            for f, v in extra.items():
                if f not in existing:
                    existing[f] = v
        elif action in ("create_matiere",):
            extra = extract_matiere_params_llm(message)
            for f, v in extra.items():
                if f not in existing:
                    existing[f] = v

        next_f, question = _next_missing_field(action, existing)
        if next_f:
            return {"type": "incomplete", "action": action, "params": existing,
                    "field": next_f, "reply": question}
        return _resolve_action(action, existing, db)

    # Nouvelle commande — détecter l'intention via Gemini
    detected = detect_intent_llm(message)
    intent   = detected.get("intent", "unknown")
    params   = _normalize_params(intent, detected.get("params", {}))

    print(f"[INTENT] {intent} | params: {params}")

    # Si Gemini n'a pas trouvé d'intention d'action, fallback par mots-clés
    if intent not in ACTION_FIELDS:
        intent, params = _keyword_intent_fallback(message)
        print(f"[INTENT FALLBACK] {intent} | params: {params}")

    if intent in ACTION_FIELDS:
        next_f, question = _next_missing_field(intent, params)
        if next_f:
            return {"type": "incomplete", "action": intent, "params": params,
                    "field": next_f, "reply": question}
        return _resolve_action(intent, params, db)

    # Fallback conversationnel
    return {"type": "query", "reply": generate_response(message, db)}


# ── Routes HTTP ───────────────────────────────────────────────────────────────

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
            upload_res = await client.post(
                "https://api.assemblyai.com/v2/upload",
                headers={"authorization": ASSEMBLYAI_KEY, "content-type": "application/octet-stream"},
                content=audio_bytes,
            )
            if upload_res.status_code != 200 or not upload_res.text.strip():
                return {"error": f"Upload échoué (HTTP {upload_res.status_code})"}
            try:
                upload_url = upload_res.json().get("upload_url")
            except Exception:
                return {"error": "Réponse upload invalide"}
            if not upload_url:
                return {"error": "Upload échoué — URL manquante"}

            transcript_res = await client.post(
                "https://api.assemblyai.com/v2/transcript",
                headers={"authorization": ASSEMBLYAI_KEY, "content-type": "application/json"},
                json={"audio_url": upload_url, "speech_models": ["universal-2"]},
            )
            if transcript_res.status_code != 200:
                return {"error": f"Transcription échouée (HTTP {transcript_res.status_code})"}
            try:
                transcript_data = transcript_res.json()
            except Exception:
                return {"error": "Réponse transcription invalide"}

            transcript_id = transcript_data.get("id")
            if not transcript_id:
                return {"error": transcript_data.get("error", "Transcription échouée")}

            for i in range(30):
                await asyncio.sleep(2)
                poll = await client.get(
                    f"https://api.assemblyai.com/v2/transcript/{transcript_id}",
                    headers={"authorization": ASSEMBLYAI_KEY}
                )
                data   = poll.json()
                status = data.get("status")
                text   = data.get("text", "")
                if status == "completed":
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
        reply = generate_response(req.message, db)
        return {"reply": reply}
    except Exception as e:
        print(f"[CHAT ERROR] {e}")
        return {"reply": "Erreur lors du traitement."}


def generate_response_prof(message: str, db: Session, user) -> str:
    from db.models import Student, Attendance, Matiere, Alert
    from db.models import Session as SessionModel
    from datetime import datetime, timezone

    msg = message.lower()

    matieres    = db.query(Matiere).filter(Matiere.professeur_id == user.id).all()
    nb_matieres = len(matieres)

    total_att = present = absent = 0
    for m in matieres:
        sessions = db.query(SessionModel).filter(SessionModel.matiere_id == m.id).all()
        for s in sessions:
            t = db.query(Attendance).filter(Attendance.session_id == s.id).count()
            p = db.query(Attendance).filter(Attendance.session_id == s.id, Attendance.status == "present").count()
            a = db.query(Attendance).filter(Attendance.session_id == s.id, Attendance.status == "absent").count()
            total_att += t; present += p; absent += a

    taux    = round(present / total_att * 100, 1) if total_att > 0 else 0
    alertes = db.query(Alert).filter(Alert.target_role == "professeur", Alert.is_read == False).count()

    today          = datetime.now(timezone.utc).date()
    sessions_today = []
    for m in matieres:
        for s in db.query(SessionModel).filter(SessionModel.matiere_id == m.id, SessionModel.date == today).all():
            sessions_today.append((m.nom, s))

    seen = set()
    absents_list = []
    for m in matieres:
        for s in db.query(SessionModel).filter(SessionModel.matiere_id == m.id).all():
            for a in db.query(Attendance).filter(Attendance.session_id == s.id, Attendance.status == "absent").all():
                student = db.query(Student).filter(Student.id == a.student_id).first()
                if student and str(student.id) not in seen:
                    seen.add(str(student.id))
                    total_abs = db.query(Attendance).filter(Attendance.student_id == student.id, Attendance.status == "absent").count()
                    absents_list.append((student, total_abs))
    absents_list.sort(key=lambda x: x[1], reverse=True)

    KW = {
        "hello":    ["bonjour", "salut", "hello", "bonsoir", "hi", "merhaba", "مرحبا"],
        "presence": ["présence", "presence", "taux", "attendance", "حضور"],
        "absence":  ["absent", "absence", "manqu", "غياب"],
        "subject":  ["matière", "matiere", "cours", "enseign", "مادة"],
        "session":  ["aujourd", "session", "séance", "today", "اليوم"],
        "alert":    ["alerte", "alert", "notification", "تنبيه"],
        "summary":  ["résumé", "resume", "bilan", "statistique", "ملخص"],
    }

    if any(w in msg for w in KW["hello"]):
        return f"Bonjour ! Vous enseignez {nb_matieres} matière(s), taux de présence {taux}%. {alertes} alerte(s)."
    if any(w in msg for w in KW["presence"]):
        if not matieres:
            return "Aucune matière assignée."
        return f"Taux de présence : {taux}%. {present} présents, {absent} absents sur {total_att} séances."
    if any(w in msg for w in KW["absence"]):
        if not absents_list:
            return "Aucun étudiant absent dans vos cours."
        top = ", ".join([f"{s.prenom} {s.nom} ({n} abs.)" for s, n in absents_list[:3]])
        return f"{len(absents_list)} étudiant(s) avec absences. Les plus absents : {top}."
    if any(w in msg for w in KW["subject"]):
        if not matieres:
            return "Aucune matière assignée."
        return f"Vous enseignez {nb_matieres} matière(s) : {', '.join([m.nom for m in matieres])}."
    if any(w in msg for w in KW["session"]):
        if not sessions_today:
            return "Aucune séance prévue aujourd'hui."
        return f"{len(sessions_today)} séance(s) aujourd'hui : {', '.join([n for n, _ in sessions_today])}."
    if any(w in msg for w in KW["alert"]):
        return f"{alertes} alerte(s) non lue(s)." if alertes else "Aucune alerte non lue."
    if any(w in msg for w in KW["summary"]):
        return (f"Bilan : {nb_matieres} matière(s), taux {taux}%, "
                f"{len(absents_list)} étudiant(s) avec absences, {alertes} alerte(s).")

    return "Vous pouvez me demander : taux de présence, matières, absences, séances d'aujourd'hui, alertes."


@router.post("/voice/chat-prof")
async def chat_prof(
    req: ChatRequest,
    db: Session = Depends(get_db),
    current_user=Depends(admin_or_prof)
):
    try:
        reply = generate_response_prof(req.message, db, current_user)
        return {"reply": reply}
    except Exception as e:
        print(f"[CHAT-PROF ERROR] {e}")
        return {"reply": "Erreur lors du traitement."}
