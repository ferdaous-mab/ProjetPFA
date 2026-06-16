"""
analyze_video.py — Analyse vidéo caméra surveillance → présences automatiques
SmartCampus IA - ESISA Fes 2025

Usage :
  python analyze_video.py <video.mp4>                     → analyse simple
  python analyze_video.py <video.mp4> --session <uuid>    → marque les présences en base
  python analyze_video.py <video.mp4> --fps 1             → 1 frame analysée par seconde

Exemples :
  python analyze_video.py "C:/videos/classe_lundi.mp4"
  python analyze_video.py "C:/videos/classe_lundi.mp4" --session abc123 --fps 2
"""

import sys
import os
import cv2
import argparse
import time

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from config import SessionLocal
from db import crud
from ai.detector import detect_faces_classroom


def analyze_video(video_path: str, session_uuid: str = None, fps_sample: float = 1.0):
    """
    Parcourt la vidéo, analyse 1 frame toutes les (1/fps_sample) secondes.
    Reconnaît les étudiants et marque leurs présences si session_uuid est fourni.
    """
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"[ERREUR] Impossible d'ouvrir : {video_path}")
        sys.exit(1)

    video_fps   = cap.get(cv2.CAP_PROP_FPS) or 25
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration_s  = total_frames / video_fps
    sample_step = max(1, int(video_fps / fps_sample))   # nb frames entre deux analyses

    print(f"\n{'='*55}")
    print(f"  Vidéo      : {os.path.basename(video_path)}")
    print(f"  Durée      : {duration_s:.0f}s  ({total_frames} frames @ {video_fps:.0f}fps)")
    print(f"  Analyse    : 1 frame / {sample_step} frames ({fps_sample:.1f}/s)")
    if session_uuid:
        print(f"  Session    : {session_uuid}")
    print(f"{'='*55}\n")

    db          = SessionLocal()
    seen        = set()          # student_id déjà reconnus (évite les doublons)
    recognized  = {}             # student_id → {nom, prenom, similarity, frame_idx}
    frame_idx   = 0
    analyzed    = 0
    t0          = time.time()

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            frame_idx += 1

            if frame_idx % sample_step != 0:
                continue

            analyzed += 1
            ts = frame_idx / video_fps
            print(f"[{ts:6.1f}s] Analyse frame {frame_idx}/{total_frames}...", end=" ", flush=True)

            # Détection + reconnaissance sur la frame
            faces = detect_faces_classroom(frame, min_face_size=20, min_score=0.35)
            print(f"{len(faces)} visage(s) détecté(s)", end="  ")

            found_this_frame = []
            for face in faces:
                match = crud.find_student_by_embedding(
                    db,
                    face["normed_embedding"],
                    threshold=0.62,
                    margin=0.08,
                )
                if match and match["student_id"] not in seen:
                    seen.add(match["student_id"])
                    recognized[match["student_id"]] = {
                        **match,
                        "frame_idx": frame_idx,
                        "timestamp": ts,
                    }
                    found_this_frame.append(f"{match['prenom']} {match['nom']}")

            if found_this_frame:
                print("→ " + ", ".join(found_this_frame))
            else:
                print()

        cap.release()

    finally:
        db.close()

    elapsed = time.time() - t0

    # ── Résultats ─────────────────────────────────────────────────────────────
    print(f"\n{'='*55}")
    print(f"  Analyse terminée en {elapsed:.1f}s")
    print(f"  Frames analysées   : {analyzed}")
    print(f"  Étudiants reconnus : {len(recognized)}")
    print(f"{'='*55}")
    for r in sorted(recognized.values(), key=lambda x: x["timestamp"]):
        print(f"  ✓  {r['prenom']:12s} {r['nom']:15s}  sim={r['similarity']:.3f}  @{r['timestamp']:.1f}s")
    print()

    # ── Marquage présences en base ────────────────────────────────────────────
    if session_uuid:
        import uuid as _uuid
        try:
            sid = _uuid.UUID(session_uuid)
        except ValueError:
            print(f"[ERREUR] session_id invalide : {session_uuid}")
            return

        db2 = SessionLocal()
        try:
            from db import crud as _crud
            from db.models import Student

            roster      = _crud.get_session_roster(db2, sid)
            present_ids = set(recognized.keys())
            presents    = 0
            absents     = 0

            for student in roster:
                sid_str = str(student.id)
                if sid_str in present_ids:
                    r = recognized[sid_str]
                    _crud.mark_attendance(db2, sid, student.id, "present",
                                          confidence=r["similarity"])
                    presents += 1
                else:
                    _crud.mark_attendance(db2, sid, student.id, "absent")
                    absents += 1

            print(f"[BASE] Présences marquées : {presents} présents, {absents} absents")
        finally:
            db2.close()


def main():
    parser = argparse.ArgumentParser(description="Analyse vidéo surveillance → présences")
    parser.add_argument("video",    help="Chemin vers la vidéo (mp4, avi, mkv...)")
    parser.add_argument("--session", default=None, help="UUID de la séance (pour marquer en base)")
    parser.add_argument("--fps",     type=float, default=1.0,
                        help="Nombre de frames analysées par seconde de vidéo (défaut: 1)")
    args = parser.parse_args()

    if not os.path.isfile(args.video):
        print(f"[ERREUR] Fichier introuvable : {args.video}")
        sys.exit(1)

    analyze_video(args.video, args.session, args.fps)


if __name__ == "__main__":
    main()
