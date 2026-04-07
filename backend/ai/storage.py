import os
import uuid
from supabase import create_client
from config import SUPABASE_URL, SUPABASE_KEY, SUPABASE_BUCKET

# Initialisation client Supabase
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def upload_image(image_bytes: bytes, student_id: str, angle: str) -> str:
    """
    Upload une image vers Supabase Storage.
    Retourne l'URL publique de l'image.
    """
    # Nom unique pour l'image
    filename = f"{student_id}/{angle}_{uuid.uuid4().hex}.jpg"

    # Upload vers Supabase Storage
    supabase.storage.from_(SUPABASE_BUCKET).upload(
        path=filename,
        file=image_bytes,
        file_options={"content-type": "image/jpeg"}
    )

    # Récupère l'URL publique
    url = supabase.storage.from_(SUPABASE_BUCKET).get_public_url(filename)
    return url