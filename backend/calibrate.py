"""
calibrate.py — Calibration automatique du seuil de reconnaissance
SmartCampus IA - ESISA Fes 2025

A executer UNE SEULE FOIS avec une image de classe où tu connais
quels visages sont dans la base et lesquels ne le sont pas.

Le script trouve automatiquement le meilleur seuil et le sauvegarde
dans attendance_config.json. Ensuite video_attendance.py l'utilise
automatiquement pour toutes les sessions, sans intervention manuelle.

Usage :
  python calibrate.py "image_classe.png" --connus 24 --inconnus 7

  Ou avec les numeros exacts des inconnus (visages non dans la DB) :
  python calibrate.py "image_classe.png" --inconnus-nums 2,7,15,18,23,27,30

  Ou mode interactif (le script te demande pour chaque visage) :
  python calibrate.py "image_classe.png" --interactif
"""

import sys, os, json, argparse
import numpy as np
import cv2

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

CONFIG_FILE = os.path.join(BACKEND_DIR, "attendance_config.json")
CACHE_FILE  = os.path.join(BACKEND_DIR, "embeddings_cache.json")

FONT = cv2.FONT_HERSHEY_SIMPLEX


def _load_embeddings(offline=False):
    if not offline:
        try:
            from config import SessionLocal
            from db.models import StudentFace, Student
            db = SessionLocal()
            try:
                rows = db.query(StudentFace, Student).join(
                    Student, StudentFace.student_id == Student.id
                ).all()
                result = []
                for sf, s in rows:
                    emb = sf.embedding
                    if hasattr(emb, "tolist"):
                        emb = emb.tolist()
                    result.append({
                        "student_id": str(s.id),
                        "nom":        s.nom,
                        "prenom":     s.prenom,
                        "embedding":  emb,
                    })
                print(f"[DB] {len(result)} embeddings charges.")
                return result
            finally:
                db.close()
        except Exception as e:
            print(f"[DB] Erreur : {e} → tentative cache local...")

    if os.path.isfile(CACHE_FILE):
        with open(CACHE_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        print(f"[CACHE] {len(data)} embeddings charges depuis {CACHE_FILE}")
        return data

    print("[ERREUR] Ni DB ni cache disponible.")
    sys.exit(1)


def _best_sim(embeddings_list, emb):
    """Similarite MAX de emb contre tous les embeddings de chaque etudiant."""
    best_per = {}
    for entry in embeddings_list:
        sid = entry["student_id"]
        ref = np.array(entry["embedding"], dtype=np.float32)
        sim = float(np.dot(emb, ref))
        if sid not in best_per or sim > best_per[sid]["sim"]:
            best_per[sid] = {
                "sim":    sim,
                "nom":    entry["nom"],
                "prenom": entry["prenom"],
            }
    ranked = sorted(best_per.values(), key=lambda x: x["sim"], reverse=True)
    top1 = ranked[0] if ranked else None
    top2 = ranked[1] if len(ranked) >= 2 else None
    return top1, top2


def _make_grid(frame, faces_data, cols=8, thumb=90):
    """Grille des visages numerotes pour aider l'utilisateur a identifier."""
    n = len(faces_data)
    rows = max(1, (n + cols - 1) // cols)
    CW, CH = thumb, thumb + 28
    grid = np.zeros((rows * CH, cols * CW, 3), dtype=np.uint8)
    grid[:] = (30, 30, 30)
    for idx, d in enumerate(faces_data):
        r, c = idx // cols, idx % cols
        xo, yo = c * CW, r * CH
        x1, y1, x2, y2 = d["bbox"]
        pad = max(6, int(max(x2-x1, y2-y1) * 0.2))
        crop = frame[max(0,y1-pad):min(frame.shape[0],y2+pad),
                     max(0,x1-pad):min(frame.shape[1],x2+pad)]
        if crop.size > 0:
            t = cv2.resize(crop, (thumb, thumb), interpolation=cv2.INTER_LANCZOS4)
        else:
            t = np.zeros((thumb, thumb, 3), dtype=np.uint8)
        cv2.rectangle(t, (0,0), (thumb-1,thumb-1), (100,100,200), 2)
        cv2.putText(t, f"#{idx+1}", (3,15), FONT, 0.45, (255,230,0), 1)
        grid[yo:yo+thumb, xo:xo+thumb] = t
        sim_txt = f"{d['top1_sim']:.2f}" if d['top1_sim'] else "?"
        cv2.putText(grid, f"#{idx+1} {sim_txt}", (xo+2, yo+thumb+16),
                    FONT, 0.28, (200,200,200), 1)
    return grid


def calibrate(image_path, offline, inconnus_nums=None, interactif=False):
    from ai.detector import detect_faces_classroom, compute_best_embedding

    frame = cv2.imread(image_path)
    if frame is None:
        print(f"[ERREUR] Image introuvable : {image_path}")
        sys.exit(1)

    embeddings_list = _load_embeddings(offline)

    print(f"\n[INFO] Detection des visages dans : {os.path.basename(image_path)}")
    faces = detect_faces_classroom(frame, min_face_size=15, min_score=0.30)
    faces = sorted(faces, key=lambda f: (f["bbox"][1], f["bbox"][0]))
    print(f"[INFO] {len(faces)} visages detectes.\n")

    # Calculer les scores pour chaque visage
    faces_data = []
    for i, face in enumerate(faces):
        emb = face["normed_embedding"]
        emb2 = compute_best_embedding(frame, face["bbox"])
        if emb2 is not None:
            s1 = max((float(np.dot(emb,  np.array(e["embedding"], dtype=np.float32))) for e in embeddings_list), default=0.0)
            s2 = max((float(np.dot(emb2, np.array(e["embedding"], dtype=np.float32))) for e in embeddings_list), default=0.0)
            emb = emb2 if s2 > s1 else emb
        top1, top2 = _best_sim(embeddings_list, emb)
        faces_data.append({
            "idx":      i + 1,
            "bbox":     face["bbox"],
            "emb":      emb,
            "top1_nom": f"{top1['prenom']} {top1['nom']}" if top1 else "?",
            "top1_sim": top1["sim"] if top1 else 0.0,
            "top2_sim": top2["sim"] if top2 else 0.0,
        })

    # Afficher la grille pour aider l'utilisateur
    grid = _make_grid(frame, faces_data)
    cv2.imshow("Calibration — numerotation des visages (ferme avec Q)", grid)

    # Afficher le tableau complet
    print(f"  {'N°':>3}  {'Top candidat':>26}  {'Sim':>5}  {'Sim2':>5}")
    print("  " + "-" * 48)
    for d in faces_data:
        print(f"  {d['idx']:>3}  {d['top1_nom']:>26}  {d['top1_sim']:.3f}  {d['top2_sim']:.3f}")

    # Identifier les inconnus
    if inconnus_nums is not None:
        unknown_set = set(inconnus_nums)
        print(f"\n[INFO] Inconnus fournis : {sorted(unknown_set)}")
    elif interactif:
        print("\n[INTERACTIF] Pour chaque visage, dis s'il est dans la base (o) ou non (n).")
        print("             Regarde la grille affichee pour identifier les numeros.\n")
        unknown_set = set()
        for d in faces_data:
            cv2.waitKey(1)
            rep = input(f"  Visage #{d['idx']:>2} — {d['top1_nom']} ({d['top1_sim']:.3f}) — dans la DB? [o/n] : ").strip().lower()
            if rep == "n":
                unknown_set.add(d["idx"])
        print(f"\n[INFO] Visages marques comme INCONNUS : {sorted(unknown_set)}")
    else:
        print("\n[ERREUR] Precise --inconnus-nums ou utilise --interactif")
        cv2.waitKey(0)
        cv2.destroyAllWindows()
        sys.exit(1)

    cv2.waitKey(500)
    cv2.destroyAllWindows()

    # Scores des vrais positifs (dans DB) et faux positifs (pas dans DB)
    known_sims   = [d["top1_sim"] for d in faces_data if d["idx"] not in unknown_set]
    unknown_sims = [d["top1_sim"] for d in faces_data if d["idx"] in unknown_set]

    print(f"\n  Etudiants connus   ({len(known_sims)}) — scores : min={min(known_sims):.3f}  max={max(known_sims):.3f}  moy={np.mean(known_sims):.3f}")
    print(f"  Etudiants inconnus ({len(unknown_sims)}) — scores : min={min(unknown_sims):.3f}  max={max(unknown_sims):.3f}  moy={np.mean(unknown_sims):.3f}")

    # Trouver le seuil optimal : maximise vrais positifs - faux positifs
    best_threshold = 0.50
    best_margin    = 0.08
    best_score     = -1

    # Cherche dans [0.38, 0.75] — jamais en dessous de 0.38.
    # Un seuil trop bas (ex: 0.25) donne 0 faux positifs sur l'image de calibration
    # mais génère des faux positifs catastrophiques sur d'autres photos où des visages
    # inconnus atteignent facilement 0.25 de similarité par hasard.
    MIN_SAFE_THRESHOLD = 0.38
    for thr in np.arange(MIN_SAFE_THRESHOLD, 0.75, 0.005):
        tp = sum(1 for s in known_sims   if s >= thr)   # vrais positifs
        fp = sum(1 for s in unknown_sims if s >= thr)   # faux positifs
        fn = sum(1 for s in known_sims   if s <  thr)   # faux negatifs

        # Objectif : zero faux positif ET maximum de vrais positifs
        # En cas d'egalite de TP, on prefere un seuil PLUS HAUT (plus securise)
        if fp == 0:
            score = tp * 10 - fn * 5 - thr  # -thr pour preferer les seuils plus hauts
            if score > best_score:
                best_score     = score
                best_threshold = round(float(thr), 3)

    # Marge : ecart entre 1er et 2e candidat pour les connus
    gaps = [d["top1_sim"] - d["top2_sim"] for d in faces_data
            if d["idx"] not in unknown_set and d["top1_sim"] >= best_threshold]
    best_margin = round(float(np.percentile(gaps, 10)), 3) if gaps else 0.08
    best_margin = max(0.05, min(best_margin, 0.15))

    print(f"\n{'='*55}")
    print(f"  Seuil optimal trouve  : {best_threshold}")
    print(f"  Marge optimale        : {best_margin}")
    tp_final = sum(1 for s in known_sims   if s >= best_threshold)
    fp_final = sum(1 for s in unknown_sims if s >= best_threshold)
    print(f"  Vrais positifs        : {tp_final}/{len(known_sims)}")
    print(f"  Faux positifs         : {fp_final}/{len(unknown_sims)}  (doit etre 0)")
    print(f"{'='*55}")

    # Sauvegarder dans attendance_config.json
    config = {
        "threshold": best_threshold,
        "margin":    best_margin,
        "calibrated_on": os.path.basename(image_path),
        "known_count":   len(known_sims),
        "unknown_count": len(unknown_sims),
        "tp_rate":  tp_final / len(known_sims) if known_sims else 0,
        "fp_count": fp_final,
    }
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2, ensure_ascii=False)

    print(f"\n[OK] Configuration sauvegardee dans : {CONFIG_FILE}")
    print(f"[OK] video_attendance.py utilisera automatiquement seuil={best_threshold}, marge={best_margin}")
    print(f"[OK] Plus besoin de toucher au code — la calibration est faite !\n")

    return best_threshold, best_margin


def main():
    parser = argparse.ArgumentParser(
        description="Calibration unique du seuil de reconnaissance faciale"
    )
    parser.add_argument("image", help="Image de classe avec visages connus et inconnus")
    parser.add_argument("--inconnus-nums", type=str, default=None,
                        help="Numeros des visages NON dans la DB, separes par virgule (ex: 2,7,15)")
    parser.add_argument("--interactif", action="store_true",
                        help="Mode interactif : le script demande pour chaque visage")
    parser.add_argument("--offline", action="store_true",
                        help="Utiliser le cache local (embeddings_cache.json)")
    args = parser.parse_args()

    if not os.path.isfile(args.image):
        print(f"[ERREUR] Image introuvable : {args.image}")
        sys.exit(1)

    inconnus_nums = None
    if args.inconnus_nums:
        try:
            inconnus_nums = [int(x.strip()) for x in args.inconnus_nums.split(",")]
        except ValueError:
            print("[ERREUR] --inconnus-nums doit etre une liste de nombres : 2,7,15")
            sys.exit(1)

    if not args.interactif and inconnus_nums is None:
        print("[ERREUR] Utilise --inconnus-nums OU --interactif")
        print("Exemple : python calibrate.py image.png --inconnus-nums 2,7,15,18,23,27,30")
        sys.exit(1)

    calibrate(args.image, args.offline, inconnus_nums, args.interactif)


if __name__ == "__main__":
    main()
