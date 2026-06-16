"""
video_attendance.py - Captures video -> detection -> reconnaissance -> presences
SmartCampus IA - ESISA Fes 2025

Fonctionne avec la base de donnees Neon (cloud) OU en mode hors-ligne
avec le fichier embeddings_cache.json (genere par export_embeddings.py).

Usage :
  python video_attendance.py <video.mp4>
  python video_attendance.py <video.mp4> --interval 3
  python video_attendance.py <video.mp4> --threshold 0.50
  python video_attendance.py <video.mp4> --save
  python video_attendance.py <video.mp4> --offline   # force le cache local
"""

import sys, os, cv2, argparse, json
import numpy as np

BACKEND_DIR    = os.path.dirname(os.path.abspath(__file__))
CACHE_FILE     = os.path.join(BACKEND_DIR, "embeddings_cache.json")
CONFIG_FILE    = os.path.join(BACKEND_DIR, "attendance_config.json")

if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from ai.detector import detect_faces_classroom, compute_best_embedding


def _load_config():
    """Charge le seuil calibre depuis attendance_config.json si disponible."""
    if os.path.isfile(CONFIG_FILE):
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            cfg = json.load(f)
        thr = cfg.get("threshold", 0.47)
        mrg = cfg.get("margin",    0.08)
        print(f"[CONFIG] Seuil calibre charge : threshold={thr}  marge={mrg}")
        return thr, mrg
    return None, None


# ── Source d'embeddings : DB ou cache local ───────────────────────────────────

def _load_embeddings_from_db():
    """Charge les embeddings depuis la base Neon. Leve une exception si pas de reseau."""
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
        return result
    finally:
        db.close()


def _load_embeddings_from_cache():
    """Charge les embeddings depuis embeddings_cache.json (mode hors-ligne)."""
    if not os.path.isfile(CACHE_FILE):
        return None
    with open(CACHE_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def _get_embeddings(offline: bool):
    """Retourne la liste des embeddings, DB en priorite puis cache local."""
    if not offline:
        try:
            data = _load_embeddings_from_db()
            print(f"[DB] {len(data)} embeddings charges depuis la base Neon.")
            return data
        except Exception as e:
            print(f"[DB] Impossible de joindre la base : {e}")
            print("[DB] Tentative avec le cache local...")

    data = _load_embeddings_from_cache()
    if data:
        print(f"[CACHE] {len(data)} embeddings charges depuis {CACHE_FILE}")
        return data

    print("[ERREUR] Ni la base ni le cache ne sont disponibles.")
    print(f"[ERREUR] Cree le cache avec : python export_embeddings.py")
    sys.exit(1)


def _find_match(embeddings_list: list, query_emb: np.ndarray,
                threshold: float, margin: float):
    """
    Cherche l'etudiant le plus proche dans la liste locale d'embeddings.
    Meme logique que crud.find_student_by_embedding :
      - MAX similarite par etudiant (plusieurs angles stockes)
      - Seuil absolu
      - Marge entre 1er et 2eme candidat
    """
    # Regrouper par student_id : prendre le MAX
    best_per_student = {}
    for entry in embeddings_list:
        sid = entry["student_id"]
        ref = np.array(entry["embedding"], dtype=np.float32)
        sim = float(np.dot(query_emb, ref))
        if sid not in best_per_student or sim > best_per_student[sid]["similarity"]:
            best_per_student[sid] = {
                "student_id": sid,
                "nom":        entry["nom"],
                "prenom":     entry["prenom"],
                "similarity": sim,
            }

    ranked = sorted(best_per_student.values(),
                    key=lambda x: x["similarity"], reverse=True)

    if not ranked:
        return None

    best = ranked[0]
    if best["similarity"] < threshold:
        return None

    if len(ranked) >= 2:
        gap = best["similarity"] - ranked[1]["similarity"]
        if gap < margin:
            return None

    return best

FONT    = cv2.FONT_HERSHEY_SIMPLEX
_margin = 0.08   # remplace par la valeur calibree au moment du lancement
COLOR_NEW  = (34, 197, 60)    # vert vif  — nouveau reconnu (premiere fois)
COLOR_CONF = (100, 210, 130)  # vert clair — confirme (deja vu avant)
COLOR_UNKN = (0, 0, 220)      # rouge — inconnu
COLOR_INFO = (255, 200, 0)    # cyan  — texte info


def _draw_results(frame: np.ndarray, faces_results: list) -> np.ndarray:
    out = frame.copy()
    for r in faces_results:
        x1, y1, x2, y2 = r["bbox"]
        if r["recognized"]:
            color = COLOR_NEW if r.get("is_new") else COLOR_CONF
            label = f"{r['prenom']} {r['nom']}  {r['similarity']:.2f}"
        else:
            color = COLOR_UNKN
            label = "inconnu"

        cv2.rectangle(out, (x1, y1), (x2, y2), color, 2)
        (tw, th), _ = cv2.getTextSize(label, FONT, 0.5, 1)
        bg_y = max(y1 - th - 6, 0)
        cv2.rectangle(out, (x1, bg_y), (x1 + tw + 6, y1), color, -1)
        cv2.putText(out, label, (x1 + 3, y1 - 3), FONT, 0.5, (255,255,255), 1, cv2.LINE_AA)
    return out


def _draw_summary(frame: np.ndarray, recognized: dict, ts: float) -> np.ndarray:
    h, w = frame.shape[:2]
    overlay = frame.copy()
    cv2.rectangle(overlay, (0, h - 32), (w, h), (0,0,0), -1)
    frame = cv2.addWeighted(overlay, 0.6, frame, 0.4, 0)

    noms = ", ".join(f"{v['prenom']} {v['nom']}" for v in list(recognized.values())[:5])
    if len(recognized) > 5:
        noms += f" +{len(recognized)-5} autres"
    txt = f"t={ts:.0f}s | reconnus total: {len(recognized)} | {noms}"
    cv2.putText(frame, txt, (8, h - 10), FONT, 0.42, COLOR_INFO, 1, cv2.LINE_AA)
    return frame


def process_video(video_path: str, interval_s: float, threshold: float,
                  save: bool, offline: bool, headless: bool = False):
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"[ERREUR] Impossible d'ouvrir : {video_path}")
        sys.exit(1)

    # Charger les embeddings (DB ou cache local)
    embeddings_list = _get_embeddings(offline)
    if not embeddings_list:
        print("[ERREUR] Aucun etudiant dans la source de donnees.")
        sys.exit(1)

    video_fps    = cap.get(cv2.CAP_PROP_FPS) or 25
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration_s   = total_frames / video_fps
    sample_step  = max(1, int(video_fps * interval_s))

    print(f"\n{'='*60}")
    print(f"  Video    : {os.path.basename(video_path)}")
    print(f"  Duree    : {duration_s:.0f}s  ({total_frames} frames @ {video_fps:.0f}fps)")
    print(f"  Captures : toutes les {interval_s}s  (= 1 frame / {sample_step} frames)")
    print(f"  Seuil    : {threshold}")
    print(f"{'='*60}\n")

    recognized = {}   # student_id -> dict avec nom/prenom/similarity/timestamp
    frame_idx  = 0
    capture_n  = 0
    save_dir   = None

    if save:
        save_dir = os.path.join(os.path.dirname(video_path), "captures_annotees")
        os.makedirs(save_dir, exist_ok=True)
        print(f"[INFO] Captures sauvegardees dans : {save_dir}\n")

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            frame_idx += 1

            if frame_idx % sample_step != 0:
                continue

            capture_n += 1
            ts = frame_idx / video_fps
            print(f"[{ts:6.1f}s] Capture #{capture_n} — detection...", end=" ", flush=True)

            faces = detect_faces_classroom(frame, min_face_size=15, min_score=0.30)
            print(f"{len(faces)} visage(s)", end="   ")

            faces_results  = []
            new_this_frame = []

            for face in faces:
                emb = face["normed_embedding"]

                # Passe 1 : matching strict (nouveaux etudiants)
                match = _find_match(embeddings_list, emb,
                                    threshold=threshold, margin=0.06)

                # Passe 2 : seuil assoupli pour confirmer un etudiant deja reconnu
                if not match and recognized:
                    match_soft = _find_match(embeddings_list, emb,
                                             threshold=threshold - 0.12,
                                             margin=0.04)
                    if match_soft and match_soft["student_id"] in recognized:
                        match = match_soft

                if match:
                    sid    = match["student_id"]
                    is_new = sid not in recognized
                    faces_results.append({
                        "bbox":       face["bbox"],
                        "recognized": True,
                        "is_new":     is_new,
                        "student_id": sid,
                        "nom":        match["nom"],
                        "prenom":     match["prenom"],
                        "similarity": round(match["similarity"], 3),
                    })
                    if is_new:
                        recognized[sid] = {**match, "timestamp": ts}
                        new_this_frame.append(
                            f"{match['prenom']} {match['nom']}({match['similarity']:.2f})"
                        )
                else:
                    faces_results.append({
                        "bbox": face["bbox"], "recognized": False,
                        "is_new": False, "nom": "", "prenom": "", "similarity": 0.0,
                    })

            if new_this_frame:
                print("NOUVEAU: " + ", ".join(new_this_frame))
            else:
                print()

            annotated = _draw_results(frame, faces_results)
            annotated = _draw_summary(annotated, recognized, ts)

            h, w = annotated.shape[:2]
            if w > 1280:
                sc = 1280 / w
                annotated = cv2.resize(annotated, (1280, int(h * sc)))

            if not headless:
                cv2.imshow(f"Capture #{capture_n}  t={ts:.0f}s", annotated)

            if save and save_dir:
                out_path = os.path.join(save_dir, f"capture_{capture_n:04d}_t{ts:.0f}s.jpg")
                cv2.imwrite(out_path, annotated)

            if not headless:
                key = cv2.waitKey(500)
                if key & 0xFF == ord('q'):
                    print("\n[INFO] Arret demande.")
                    break

    finally:
        cap.release()
        if not headless:
            cv2.destroyAllWindows()

    print(f"\n{'='*60}")
    print(f"  Captures analysees : {capture_n}")
    print(f"  Etudiants reconnus : {len(recognized)}")
    print(f"{'='*60}")
    for r in sorted(recognized.values(), key=lambda x: x["timestamp"]):
        print(f"  OK  {r['prenom']:12s} {r['nom']:15s}  sim={r['similarity']:.3f}  @t={r['timestamp']:.0f}s")
    print()


IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp", ".tiff"}


def _get_top_candidates(embeddings_list: list, query_emb: np.ndarray, top_n: int = 2):
    """Retourne les top_n meilleurs candidats (sans seuil) pour diagnostic."""
    best_per_student = {}
    for entry in embeddings_list:
        sid = entry["student_id"]
        ref = np.array(entry["embedding"], dtype=np.float32)
        sim = float(np.dot(query_emb, ref))
        if sid not in best_per_student or sim > best_per_student[sid]["similarity"]:
            best_per_student[sid] = {
                "student_id": sid,
                "nom":        entry["nom"],
                "prenom":     entry["prenom"],
                "similarity": sim,
            }
    return sorted(best_per_student.values(), key=lambda x: x["similarity"], reverse=True)[:top_n]


def _make_face_grid(frame: np.ndarray, faces_data: list,
                    thumb_size: int = 95, cols: int = 8) -> np.ndarray:
    """Grille de tous les crops de visages avec noms et scores."""
    CELL_W  = thumb_size
    CELL_H  = thumb_size + 32
    n       = len(faces_data)
    rows    = max(1, (n + cols - 1) // cols)

    grid = np.zeros((rows * CELL_H, cols * CELL_W, 3), dtype=np.uint8)
    grid[:] = (25, 25, 25)

    for idx, r in enumerate(faces_data):
        row   = idx // cols
        col   = idx % cols
        x_off = col * CELL_W
        y_off = row * CELL_H

        x1, y1, x2, y2 = r["bbox"]
        pad  = max(8, int(max(x2 - x1, y2 - y1) * 0.25))
        fx1  = max(0, x1 - pad)
        fy1  = max(0, y1 - pad)
        fx2  = min(frame.shape[1], x2 + pad)
        fy2  = min(frame.shape[0], y2 + pad)
        crop = frame[fy1:fy2, fx1:fx2]

        if crop.size > 0:
            thumb = cv2.resize(crop, (thumb_size, thumb_size),
                               interpolation=cv2.INTER_LANCZOS4)
        else:
            thumb = np.zeros((thumb_size, thumb_size, 3), dtype=np.uint8)

        border = (34, 197, 60) if r["recognized"] else (40, 40, 200)
        cv2.rectangle(thumb, (0, 0), (thumb_size - 1, thumb_size - 1), border, 2)
        cv2.putText(thumb, f"#{idx+1}", (3, 14),
                    FONT, 0.35, (255, 230, 0), 1, cv2.LINE_AA)

        grid[y_off:y_off + thumb_size, x_off:x_off + thumb_size] = thumb

        y_txt = y_off + thumb_size + 14
        if r["recognized"]:
            prenom = r["prenom"][:8]
            nom    = r["nom"][:6]
            label  = f"{prenom} {nom}"
            lcolor = (80, 255, 80)
            sscore = f"{r['similarity']:.2f}"
            scolor = (160, 255, 160)
        else:
            cand  = r.get("top_candidate", "")
            csim  = r.get("top_sim", 0.0)
            label = f"~{cand[:10]}?" if cand and csim > 0.35 else "Inconnu"
            lcolor = (100, 100, 255)
            sscore = f"({csim:.2f})" if csim > 0 else ""
            scolor = (160, 160, 200)

        cv2.putText(grid, label[:12], (x_off + 2, y_txt),
                    FONT, 0.30, lcolor, 1, cv2.LINE_AA)
        if sscore:
            cv2.putText(grid, sscore, (x_off + 2, y_txt + 13),
                        FONT, 0.28, scolor, 1, cv2.LINE_AA)

    return grid


def process_image(image_path: str, threshold: float, save: bool, offline: bool):
    frame = cv2.imread(image_path)
    if frame is None:
        print(f"[ERREUR] Impossible de lire : {image_path}")
        sys.exit(1)

    embeddings_list = _get_embeddings(offline)

    # Utiliser le seuil calibre si disponible, sinon celui passe en argument
    cfg_thr, cfg_mrg = _load_config()
    threshold  = cfg_thr if cfg_thr is not None else threshold
    global _margin
    _margin = cfg_mrg if cfg_mrg is not None else 0.08

    print(f"\n{'='*70}")
    print(f"  Image  : {os.path.basename(image_path)}")
    print(f"  Taille : {frame.shape[1]}x{frame.shape[0]} px")
    print(f"  Seuil  : {threshold}  marge: {_margin}")
    if cfg_thr is not None:
        print(f"  Source : attendance_config.json (calibration automatique)")
    print(f"{'='*70}\n")

    print("[INFO] Detection en cours...", flush=True)
    faces = detect_faces_classroom(frame, min_face_size=15, min_score=0.30)
    print(f"[INFO] {len(faces)} visage(s) detecte(s)\n")

    faces = sorted(faces, key=lambda f: (f["bbox"][1], f["bbox"][0]))

    recognized    = {}
    faces_results = []

    print(f"  {'N°':>3}  {'Taille':>9}  {'Conf':>5}  {'Statut':>28}  {'Sim':>5}  {'Top candidat':>22}  {'Sim2':>5}")
    print("  " + "-" * 90)

    for i, face in enumerate(faces):
        fw, fh = face["width"], face["height"]
        conf   = face["confidence"]

        # ── Étape 1 : obtenir UN embedding de qualité pour ce visage ──────────
        emb_detect = face["normed_embedding"]
        fw, fh     = face["width"], face["height"]

        # Re-embedding uniquement pour les PETITS visages (< 80px) :
        # Pour les grandes faces (photo téléphone), le crop 4×margin inclut tous
        # les autres visages → InsightFace peut choisir le mauvais → même embedding
        # pour des personnes différentes → faux positifs catastrophiques.
        # Pour les grandes faces, l'embedding de détection est déjà de haute qualité.
        if fw < 80 or fh < 80:
            emb_crop = compute_best_embedding(frame, face["bbox"])
            if emb_crop is not None:
                sim_det = max(
                    (float(np.dot(emb_detect, np.array(e["embedding"], dtype=np.float32)))
                     for e in embeddings_list), default=0.0)
                sim_crp = max(
                    (float(np.dot(emb_crop, np.array(e["embedding"], dtype=np.float32)))
                     for e in embeddings_list), default=0.0)
                emb = emb_crop if sim_crp > sim_det else emb_detect
            else:
                emb = emb_detect
        else:
            emb = emb_detect

        # ── Étape 2 : comparer avec la base ───────────────────────────────────
        # Passe principale : seuil calibré, marge calibrée
        match = _find_match(embeddings_list, emb, threshold=threshold, margin=_margin)

        # Passe "borderline" : visage juste sous le seuil calibré.
        # Condition double pour éviter les faux positifs :
        #   1. Similarité pas trop loin du seuil (max 0.13 en dessous)
        #   2. Écart 1er/2e candidat >= 0.13 → le bon étudiant est CLAIREMENT
        #      identifié, pas d'ambiguïté avec quelqu'un d'autre.
        # Pour un inconnu, même si sa similarité monte un peu, il n'aura jamais
        # une marge de 0.13 car il n'a pas de "vrai" match dans la DB.
        if not match:
            top_cands_pre = _get_top_candidates(embeddings_list, emb, top_n=2)
            t1 = top_cands_pre[0] if top_cands_pre else None
            t2 = top_cands_pre[1] if len(top_cands_pre) >= 2 else None
            if t1 and t2:
                gap   = t1["similarity"] - t2["similarity"]
                below = threshold - t1["similarity"]
                if 0 < below <= 0.13 and gap >= 0.14:
                    match = t1

        # ── Diagnostic : top 2 candidats ──────────────────────────────────────
        top_cands = _get_top_candidates(embeddings_list, emb, top_n=2)
        top1 = top_cands[0] if top_cands else None
        top2 = top_cands[1] if len(top_cands) >= 2 else None

        if match:
            sid   = match["student_id"]
            recognized[sid] = {**match, "timestamp": 0}
            name1 = f"{match['prenom']} {match['nom']}"
            name2 = f"{top2['prenom']} {top2['nom']}" if top2 else ""
            sim2  = top2["similarity"] if top2 else 0.0
            print(f"  {i+1:>3}  {fw:>4}x{fh:<4}  {conf:.2f}  OK   {name1:>24}  {match['similarity']:.3f}  {name2:>22}  {sim2:.3f}")
            faces_results.append({
                "bbox":       face["bbox"],
                "recognized": True,
                "is_new":     True,
                "student_id": sid,
                "nom":        match["nom"],
                "prenom":     match["prenom"],
                "similarity": round(match["similarity"], 3),
            })
        else:
            name1 = f"{top1['prenom']} {top1['nom']}" if top1 else "?"
            sim1  = top1["similarity"] if top1 else 0.0
            print(f"  {i+1:>3}  {fw:>4}x{fh:<4}  {conf:.2f}  --  {'INCONNU':>24}         {name1:>22}  {sim1:.3f}")
            faces_results.append({
                "bbox":          face["bbox"],
                "recognized":    False,
                "is_new":        False,
                "nom":           "",
                "prenom":        "",
                "similarity":    0.0,
                "top_candidate": name1,
                "top_sim":       sim1,
            })

    print(f"\n  {'='*70}")
    print(f"  Reconnus : {len(recognized)}/{len(faces)} visages")
    print(f"  {'='*70}")

    # Numéroter chaque visage sur l'image annotée
    annotated = _draw_results(frame, faces_results)
    for i, r in enumerate(faces_results):
        x1, y1 = r["bbox"][0], r["bbox"][1]
        cv2.putText(annotated, f"#{i+1}", (x1 + 2, max(y1 - 18, 14)),
                    FONT, 0.38, (255, 240, 0), 1, cv2.LINE_AA)

    h, w = annotated.shape[:2]
    overlay = annotated.copy()
    cv2.rectangle(overlay, (0, h - 36), (w, h), (0, 0, 0), -1)
    annotated = cv2.addWeighted(overlay, 0.65, annotated, 0.35, 0)
    txt = (f"Reconnus: {len(recognized)}/{len(faces)}   "
           f"inconnus: {len(faces)-len(recognized)}/{len(faces)}   seuil={threshold}")
    cv2.putText(annotated, txt, (8, h - 12), FONT, 0.42, COLOR_INFO, 1, cv2.LINE_AA)

    grid = _make_face_grid(frame, faces_results)

    dw = annotated.shape[1]
    if dw > 1280:
        sc = 1280 / dw
        annotated = cv2.resize(annotated, (1280, int(annotated.shape[0] * sc)))

    if save:
        base      = os.path.splitext(image_path)[0]
        out_annot = base + "_resultat.jpg"
        out_grid  = base + "_grille.jpg"
        cv2.imwrite(out_annot, annotated)
        cv2.imwrite(out_grid, grid)
        print(f"\n  Sauvegarde : {out_annot}")
        print(f"  Grille     : {out_grid}")

    cv2.imshow(f"Resultat — {os.path.basename(image_path)}", annotated)
    cv2.imshow(f"Grille des visages — {os.path.basename(image_path)}", grid)
    print("\n[INFO] Appuie sur une touche pour fermer.")
    cv2.waitKey(0)
    cv2.destroyAllWindows()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("fichier",       help="Chemin vers la video ou l'image")
    parser.add_argument("--interval",    type=float, default=2.0,
                        help="(video) Secondes entre deux captures (defaut: 2)")
    parser.add_argument("--threshold",   type=float, default=0.47,
                        help="Seuil de reconnaissance (defaut: 0.47)")
    parser.add_argument("--save",        action="store_true",
                        help="Sauvegarder le resultat annote")
    parser.add_argument("--offline",     action="store_true",
                        help="Forcer le mode hors-ligne (cache local)")
    parser.add_argument("--headless",    action="store_true",
                        help="Sans affichage (pour serveur/Colab/PC distant)")
    args = parser.parse_args()

    if not os.path.isfile(args.fichier):
        print(f"[ERREUR] Fichier introuvable : {args.fichier}")
        sys.exit(1)

    ext = os.path.splitext(args.fichier)[1].lower()
    if ext in IMAGE_EXTS:
        process_image(args.fichier, args.threshold, args.save, args.offline)
    else:
        process_video(args.fichier, args.interval, args.threshold, args.save,
                      args.offline, headless=args.headless)


if __name__ == "__main__":
    main()
