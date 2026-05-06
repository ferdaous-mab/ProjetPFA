from fastapi import APIRouter, Depends, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel
from auth.dependencies import admin_only, get_db
import httpx
import os
import asyncio
from dotenv import load_dotenv

load_dotenv(override=True)

router = APIRouter()

ASSEMBLYAI_KEY = os.getenv("ASSEMBLYAI_API_KEY", "")


class ChatRequest(BaseModel):
    message: str


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
    total_profs    = db.query(User).filter(User.role == "professeur").count()
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


@router.post("/voice/transcribe")
async def transcribe_audio(
    audio: UploadFile = File(...),
    _=Depends(admin_only)
):
    try:
        audio_bytes = await audio.read()
        print(f"[ASSEMBLYAI] Audio reçu: {len(audio_bytes)} bytes")

        async with httpx.AsyncClient(timeout=60) as client:

            # Upload
            upload_res = await client.post(
                "https://api.assemblyai.com/v2/upload",
                headers={"authorization": ASSEMBLYAI_KEY},
                content=audio_bytes,
            )
            upload_url = upload_res.json().get("upload_url")
            print(f"[ASSEMBLYAI] Upload: {upload_res.status_code} → {upload_url[:40] if upload_url else 'FAILED'}")

            if not upload_url:
                return {"error": "Upload échoué"}

            # Transcription
            transcript_res = await client.post(
                "https://api.assemblyai.com/v2/transcript",
                headers={
                    "authorization": ASSEMBLYAI_KEY,
                    "content-type": "application/json"
                },
                json={
                    "audio_url": upload_url,
                    "speech_models": ["universal-2"]
                }
            )
            transcript_data = transcript_res.json()
            print(f"[ASSEMBLYAI] Transcript response: {transcript_data}")
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