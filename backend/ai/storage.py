import os
import requests
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL    = os.getenv("SUPABASE_URL")
SUPABASE_KEY    = os.getenv("SUPABASE_KEY")
SUPABASE_BUCKET = os.getenv("SUPABASE_BUCKET", "Students_faces")


def upload_image(image_bytes: bytes, path: str) -> str | None:
    """
    Upload une image vers Supabase Storage.
    path ex: "students/uuid123/frame_1.jpg"
    Retourne l'URL publique ou None si erreur.
    """
    url = f"{SUPABASE_URL}/storage/v1/object/{SUPABASE_BUCKET}/{path}"

    headers = {
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "image/jpeg",
        "x-upsert": "true",  # écrase si existe déjà
    }

    try:
        resp = requests.post(url, headers=headers, data=image_bytes, timeout=10)
        if resp.status_code in (200, 201):
            public_url = (
                f"{SUPABASE_URL}/storage/v1/object/public"
                f"/{SUPABASE_BUCKET}/{path}"
            )
            return public_url
        else:
            print(f"[Storage] Upload échoué ({resp.status_code}): {resp.text}")
            return None
    except Exception as e:
        print(f"[Storage] Erreur upload: {e}")
        return None


def delete_folder(prefix: str):
    """Supprime tous les fichiers d'un préfixe (ex: dossier étudiant)."""
    url = f"{SUPABASE_URL}/storage/v1/object/{SUPABASE_BUCKET}"
    headers = {
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
    }
    # Liste les fichiers
    list_url = f"{SUPABASE_URL}/storage/v1/object/list/{SUPABASE_BUCKET}"
    try:
        resp = requests.post(list_url, headers=headers,
                             json={"prefix": prefix}, timeout=10)
        if resp.status_code == 200:
            files = [f["name"] for f in resp.json()]
            if files:
                requests.delete(url, headers=headers,
                                json={"prefixes": files}, timeout=10)
    except Exception as e:
        print(f"[Storage] Erreur suppression: {e}")