import os
import cloudinary
import cloudinary.uploader
import cloudinary.api
from dotenv import load_dotenv

load_dotenv()

# ── Configuration Cloudinary ──────────────────────────────────────────────────
cloudinary.config(
    cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key    = os.getenv("CLOUDINARY_API_KEY"),
    api_secret = os.getenv("CLOUDINARY_API_SECRET"),
    secure     = True
)

FOLDER = "smartcampus"


def upload_image(image_bytes: bytes, path: str) -> str | None:
    """
    Upload une image vers Cloudinary.
    path ex: "students/uuid123/frame_centre"
    Retourne l URL publique sécurisée ou None si erreur.
    """
    try:
        result = cloudinary.uploader.upload(
            image_bytes,
            public_id     = f"{FOLDER}/{path}",
            resource_type = "image",
            format        = "jpg",
            quality       = 95,
            overwrite     = True,
            transformation = [
                {"width": 640, "height": 480, "crop": "fill"},
                {"fetch_format": "auto"}
            ]
        )
        return result.get("secure_url")
    except Exception as e:
        print(f"[Cloudinary] Erreur upload: {e}")
        return None


def delete_student_images(student_id: str):
    """
    Supprime toutes les images d'un étudiant depuis Cloudinary.
    """
    angles = ["centre", "droite", "gauche", "haut", "bas"]
    for angle in angles:
        try:
            cloudinary.uploader.destroy(
                f"{FOLDER}/students/{student_id}/frame_{angle}",
                resource_type = "image"
            )
        except Exception as e:
            print(f"[Cloudinary] Erreur suppression {angle}: {e}")


def get_image_url(student_id: str, angle: str) -> str | None:
    """
    Retourne l'URL d'une image spécifique d'un étudiant.
    angle ex: 'centre' | 'droite' | 'gauche' | 'haut' | 'bas'
    """
    try:
        result = cloudinary.api.resource(
            f"{FOLDER}/students/{student_id}/frame_{angle}"
        )
        return result.get("secure_url")
    except Exception:
        return None


def upload_video(video_bytes: bytes, session_id: str) -> str | None:
    """
    Upload une vidéo de séance vers Cloudinary.
    Utilisé pour l'analyse automatique des présences.
    """
    try:
        result = cloudinary.uploader.upload(
            video_bytes,
            public_id     = f"{FOLDER}/sessions/{session_id}/video",
            resource_type = "video",
            overwrite     = True,
        )
        return result.get("secure_url")
    except Exception as e:
        print(f"[Cloudinary] Erreur upload video: {e}")
        return None


def delete_session_video(session_id: str):
    """Supprime la vidéo d'une séance."""
    try:
        cloudinary.uploader.destroy(
            f"{FOLDER}/sessions/{session_id}/video",
            resource_type = "video"
        )
    except Exception as e:
        print(f"[Cloudinary] Erreur suppression video: {e}")