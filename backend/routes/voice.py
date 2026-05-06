from fastapi import APIRouter, Depends, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel
from auth.dependencies import admin_only, admin_or_prof, get_db
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
    _=Depends(admin_or_prof)
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