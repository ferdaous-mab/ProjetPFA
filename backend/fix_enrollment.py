"""
fix_enrollment.py - Ajoute des embeddings depuis une image de classe
SmartCampus IA - ESISA Fes 2025

Pour les étudiants dont l'enrôlement est de mauvaise qualité (photo d'enrôlement
trop différente de leur apparence réelle), ce script extrait leur embedding
directement depuis une image de classe où leur visage est bien visible,
et l'AJOUTE dans la DB sans supprimer l'embedding existant.

Usage interactif :
  python fix_enrollment.py "image_classe.png"

Usage direct (si tu connais les numéros de visage depuis calibrate.py) :
  python fix_enrollment.py "image_classe.png" --faces "2:98157c38-87a3-490f-9df5-b717b8f8e9cc,9:0a701af3-56ad-4f03-b570-098ce3aa95fa,13:15e0bf68-0b5d-4e14-ba6c-3ea85754dfe6"
"""

import sys, os, json, argparse
import numpy as np
import cv2

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

CACHE_FILE = os.path.join(BACKEND_DIR, "embeddings_cache.json")
FONT = cv2.FONT_HERSHEY_SIMPLEX


def _load_students_from_db():
    from config import SessionLocal
    from db.models import Student
    db = SessionLocal()
    try:
        students = db.query(Student).filter(Student.is_enrolled == True).all()
        return [{"id": str(s.id), "nom": s.nom, "prenom": s.prenom} for s in students]
    finally:
        db.close()


def _add_embedding_to_db(student_id, embedding):
    from config import SessionLocal
    from db import crud
    db = SessionLocal()
    try:
        emb_list = embedding.tolist() if hasattr(embedding, "tolist") else list(embedding)
        crud.create_student_face(
            db,
            student_id=student_id,
            embedding=emb_list,
            det_score=0.95,
            nb_images=1,
        )
        print(f"[DB] Embedding ajouté pour student_id={student_id}")
    finally:
        db.close()


def _update_cache(student_id, nom, prenom, embedding):
    cache = []
    if os.path.isfile(CACHE_FILE):
        with open(CACHE_FILE, "r", encoding="utf-8") as f:
            cache = json.load(f)
    emb_list = embedding.tolist() if hasattr(embedding, "tolist") else list(embedding)
    cache.append({
        "student_id": student_id,
        "nom":        nom,
        "prenom":     prenom,
        "classe":     "",
        "embedding":  emb_list,
        "det_score":  0.95,
    })
    with open(CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False, indent=2)
    print(f"[CACHE] Embedding ajouté dans {CACHE_FILE}")


def _make_grid(frame, faces, cols=8, thumb=100):
    n = len(faces)
    rows = max(1, (n + cols - 1) // cols)
    CW, CH = thumb, thumb + 22
    grid = np.zeros((rows * CH, cols * CW, 3), dtype=np.uint8)
    grid[:] = (30, 30, 30)
    for idx, face in enumerate(faces):
        r, c = idx // cols, idx % cols
        xo, yo = c * CW, r * CH
        x1, y1, x2, y2 = face["bbox"]
        pad = max(6, int(max(x2-x1, y2-y1) * 0.2))
        crop = frame[max(0, y1-pad):min(frame.shape[0], y2+pad),
                     max(0, x1-pad):min(frame.shape[1], x2+pad)]
        if crop.size > 0:
            t = cv2.resize(crop, (thumb, thumb), interpolation=cv2.INTER_LANCZOS4)
        else:
            t = np.zeros((thumb, thumb, 3), dtype=np.uint8)
        cv2.rectangle(t, (0, 0), (thumb-1, thumb-1), (100, 150, 255), 2)
        cv2.putText(t, f"#{idx+1}", (4, 16), FONT, 0.48, (255, 230, 0), 1)
        grid[yo:yo+thumb, xo:xo+thumb] = t
        cv2.putText(grid, f"#{idx+1}", (xo+2, yo+thumb+15), FONT, 0.30, (200, 200, 200), 1)
    return grid


def fix_enrollment(image_path, face_student_map=None):
    from ai.detector import detect_faces_classroom

    frame = cv2.imread(image_path)
    if frame is None:
        print(f"[ERREUR] Image introuvable : {image_path}")
        sys.exit(1)

    print(f"\n[INFO] Détection des visages dans : {os.path.basename(image_path)}")
    faces = detect_faces_classroom(frame, min_face_size=15, min_score=0.30)
    faces = sorted(faces, key=lambda f: (f["bbox"][1], f["bbox"][0]))
    print(f"[INFO] {len(faces)} visages détectés\n")

    # Charger la liste des étudiants pour mode interactif
    try:
        students = _load_students_from_db()
    except Exception as e:
        print(f"[DB] Impossible de charger les étudiants : {e}")
        students = []

    # Afficher la grille pour identification
    grid = _make_grid(frame, faces)
    cv2.imshow("Grille - identifie les numeros des etudiants mal reconnus", grid)
    cv2.waitKey(500)

    if face_student_map:
        # Mode direct : face_num -> student_id
        assignments = face_student_map
    else:
        # Mode interactif
        print("  Regarde la grille affichée et note les numéros des visages non reconnus.")
        print("  Pour chaque visage à corriger, donne son numéro et l'étudiant correspondant.")
        print("  Tape 'fin' pour terminer.\n")

        if students:
            print("  Étudiants disponibles :")
            for i, s in enumerate(students, 1):
                print(f"    {i:>3}. {s['prenom']} {s['nom']}  (id={s['id']})")
            print()

        assignments = {}
        while True:
            cv2.waitKey(1)
            face_num = input("  Numéro du visage (ou 'fin') : ").strip()
            if face_num.lower() == "fin" or face_num == "":
                break
            try:
                face_num = int(face_num)
                if face_num < 1 or face_num > len(faces):
                    print(f"  [ERREUR] Numéro invalide (1-{len(faces)})")
                    continue
            except ValueError:
                print("  [ERREUR] Entre un nombre entier")
                continue

            student_num = input(f"  Numéro de l'étudiant pour visage #{face_num} : ").strip()
            try:
                student_idx = int(student_num) - 1
                if 0 <= student_idx < len(students):
                    assignments[face_num] = students[student_idx]["id"]
                    print(f"  ✓ Visage #{face_num} → {students[student_idx]['prenom']} {students[student_idx]['nom']}\n")
                else:
                    print("  [ERREUR] Numéro d'étudiant invalide")
            except ValueError:
                print("  [ERREUR] Entre un nombre entier")

    cv2.destroyAllWindows()

    if not assignments:
        print("\n[INFO] Aucune correction. Terminé.")
        return

    # Ajouter les embeddings
    print(f"\n[INFO] Ajout de {len(assignments)} embedding(s)...\n")
    for face_num, student_id in assignments.items():
        idx = face_num - 1
        if idx < 0 or idx >= len(faces):
            print(f"[ERREUR] Visage #{face_num} introuvable")
            continue

        emb = faces[idx]["normed_embedding"]

        # Trouver nom/prenom depuis la liste
        student_info = next((s for s in students if s["id"] == student_id), None)
        nom    = student_info["nom"]    if student_info else "?"
        prenom = student_info["prenom"] if student_info else "?"

        print(f"  Visage #{face_num} → {prenom} {nom}  (sim max actuelle avec cet embedding : calcul...)")

        # Vérification : score avant ajout
        if os.path.isfile(CACHE_FILE):
            with open(CACHE_FILE) as f:
                cache = json.load(f)
            sims = [float(np.dot(emb, np.array(e["embedding"], dtype=np.float32)))
                    for e in cache if e["student_id"] == student_id]
            old_best = max(sims) if sims else 0.0
            print(f"    Score AVANT : {old_best:.3f}")

        try:
            _add_embedding_to_db(student_id, emb)
            _update_cache(student_id, nom, prenom, emb)
            print(f"    Score APRES : ~0.95+ (embedding extrait directement de cette image)")
            print(f"    ✓ {prenom} {nom} sera reconnu(e) sur cette image et images similaires\n")
        except Exception as e:
            print(f"    [ERREUR] {e}\n")

    print(f"\n{'='*55}")
    print(f"  Correction terminée. Lance maintenant :")
    print(f"  python video_attendance.py \"{image_path}\" --save")
    print(f"{'='*55}\n")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("image", help="Image de classe")
    parser.add_argument("--faces", type=str, default=None,
                        help="Mapping face:student_id séparés par virgules. Ex: 2:uuid1,9:uuid2")
    args = parser.parse_args()

    face_student_map = None
    if args.faces:
        face_student_map = {}
        for part in args.faces.split(","):
            face_num, sid = part.strip().split(":")
            face_student_map[int(face_num)] = sid.strip()

    fix_enrollment(args.image, face_student_map)


if __name__ == "__main__":
    main()
