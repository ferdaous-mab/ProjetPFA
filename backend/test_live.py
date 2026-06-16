"""
test_live.py — Test reconnaissance faciale en temps réel
SmartCampus IA - ESISA Fes 2025

Affichage fluide (thread séparé pour l'analyse IA).
  ┌──────────────────────────────────────────┐
  │  [VERT]   Prénom Nom  sim=0.82           │ ← reconnu
  │  [ROUGE]  inconnu                        │ ← pas dans la DB / rejeté
  │  [ORANGE] ⚠ SPOOF     conf=0.12          │ ← faux visage
  └──────────────────────────────────────────┘

Usage :
  python test_live.py webcam              → webcam PC
  python test_live.py video  <fichier>    → vidéo mp4
  python test_live.py image  <fichier>    → photo (→ resultat.jpg)
  python test_live.py webcam --spoof      → active l'anti-spoofing

Contrôles : q = quitter
"""

import sys, os, cv2, threading
import numpy as np

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from config import SessionLocal
from db import crud

# ── Paramètres (identiques à attendance.py) ───────────────────────────────────
MIN_FACE_PX     = 8      # visages très petits (caméra haute)
DET_SCORE_MIN   = 0.20   # seuil bas : capture tout ce qui ressemble à un visage
MAX_FRAME_WIDTH = 960    # compromis vitesse / détection : det_size=640 interne
                          # 960px → SCRFD voit ~640×360 → faces ~20px détectables

COLOR_KNOWN   = (34,  197,  60)   # vert  — reconnu
COLOR_UNKNOWN = (34,   60, 230)   # rouge — inconnu / rejeté
COLOR_SPOOF   = (0,   165, 255)   # orange — faux visage
FONT          = cv2.FONT_HERSHEY_SIMPLEX

USE_SPOOF = "--spoof" in sys.argv


# ── Cache IoU : évite de relancer ArcFace sur les visages stables ─────────────
_face_cache: list[dict] = []
_CACHE_IOU_MIN = 0.40
_CACHE_TTL     = 8


def _iou(a: list, b: list) -> float:
    xi1, yi1 = max(a[0], b[0]), max(a[1], b[1])
    xi2, yi2 = min(a[2], b[2]), min(a[3], b[3])
    inter = max(0, xi2 - xi1) * max(0, yi2 - yi1)
    union = (a[2]-a[0])*(a[3]-a[1]) + (b[2]-b[0])*(b[3]-b[1]) - inter
    return inter / (union + 1e-6)


def _lookup_cache(bbox: list):
    best_iou, best_entry = 0.0, None
    for entry in _face_cache:
        iou = _iou(bbox, entry["bbox"])
        if iou > best_iou:
            best_iou, best_entry = iou, entry
    if best_entry and best_iou >= _CACHE_IOU_MIN and best_entry["ttl"] > 0:
        best_entry["ttl"] -= 1
        return best_entry["result"]
    return None


def _update_cache(bbox: list, result: dict):
    global _face_cache
    for entry in _face_cache:
        if _iou(bbox, entry["bbox"]) >= _CACHE_IOU_MIN:
            entry["bbox"]   = bbox
            entry["result"] = result
            entry["ttl"]    = _CACHE_TTL
            return
    _face_cache.append({"bbox": bbox, "result": result, "ttl": _CACHE_TTL})


def _expire_cache(current_bboxes: list):
    global _face_cache
    for entry in _face_cache:
        matched = any(_iou(entry["bbox"], b) >= _CACHE_IOU_MIN for b in current_bboxes)
        if not matched:
            entry["ttl"] -= 2
    _face_cache = [e for e in _face_cache if e["ttl"] > 0]


# ── Analyse d'un frame ────────────────────────────────────────────────────────

def _enhance(frame: np.ndarray) -> np.ndarray:
    lab  = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe   = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    l       = clahe.apply(l)
    return cv2.cvtColor(cv2.merge([l, a, b]), cv2.COLOR_LAB2BGR)


def analyze_frame(frame: np.ndarray, spoof) -> list[dict]:
    """
    Pipeline IDENTIQUE à attendance.py :
      - get_face_app_hd() singleton  (det_size=1280×1280 — précis pour petits visages)
      - crud.find_student_by_embedding() (threshold=0.62, margin=0.08)
    """
    from ai.detector import get_face_app_hd

    app = get_face_app_hd()
    h_orig, w_orig = frame.shape[:2]

    if w_orig > MAX_FRAME_WIDTH:
        sx    = MAX_FRAME_WIDTH / w_orig
        small = cv2.resize(frame, (MAX_FRAME_WIDTH, int(h_orig * sx)))
    else:
        sx    = 1.0
        small = frame
    h_s, w_s = small.shape[:2]

    img_rgb = cv2.cvtColor(_enhance(small), cv2.COLOR_BGR2RGB)
    try:
        raw = app.get(img_rgb)
    except Exception:
        return []

    n_total     = len(raw)
    n_emb_none  = 0
    n_too_small = 0
    n_low_score = 0

    results        = []
    current_bboxes = []

    db = SessionLocal()
    try:
        for face in raw:
            score = float(face.det_score)
            if score < DET_SCORE_MIN:
                n_low_score += 1
                continue

            rx1, ry1, rx2, ry2 = [int(v) for v in face.bbox.tolist()]
            rx1 = max(0, rx1); ry1 = max(0, ry1)
            rx2 = min(w_s, rx2); ry2 = min(h_s, ry2)
            if rx2 - rx1 < MIN_FACE_PX or ry2 - ry1 < MIN_FACE_PX:
                n_too_small += 1
                continue

            x1 = max(0,      int(rx1 / sx))
            y1 = max(0,      int(ry1 / sx))
            x2 = min(w_orig, int(rx2 / sx))
            y2 = min(h_orig, int(ry2 / sx))
            bbox = [x1, y1, x2, y2]
            current_bboxes.append(bbox)

            cached = _lookup_cache(bbox)
            if cached is not None:
                r = dict(cached)
                r["bbox"]      = bbox
                r["det_score"] = round(score, 2)
                results.append(r)
                continue

            if face.normed_embedding is None:
                n_emb_none += 1
                print(f"[DIAG] visage {rx2-rx1}x{ry2-ry1}px det={score:.2f} -> embedding=None")
                continue

            spoof_conf = 1.0
            face_w = rx2 - rx1
            face_h = ry2 - ry1
            spoof_eligible = face_w >= 80 and face_h >= 80
            if USE_SPOOF and spoof and spoof._available and spoof_eligible:
                crop = frame[y1:y2, x1:x2].copy()
                is_real, spoof_conf = spoof.is_real(crop)
                if not is_real:
                    r = {"bbox": bbox, "spoof": True, "recognized": False,
                         "nom": "SPOOF", "prenom": "",
                         "similarity": 0.0, "spoof_conf": spoof_conf,
                         "det_score": round(score, 2)}
                    _update_cache(bbox, r)
                    results.append(r)
                    continue

            q_emb = face.normed_embedding.astype(np.float32)
            match = crud.find_student_by_embedding(db, q_emb, threshold=0.62, margin=0.08)

            if match:
                r = {
                    "bbox":       bbox,
                    "spoof":      False,
                    "recognized": True,
                    "student_id": match["student_id"],
                    "nom":        match["nom"],
                    "prenom":     match["prenom"],
                    "similarity": round(match["similarity"], 3),
                    "spoof_conf": spoof_conf,
                    "det_score":  round(score, 2),
                }
            else:
                r = {
                    "bbox":       bbox,
                    "spoof":      False,
                    "recognized": False,
                    "student_id": None,
                    "nom":        "inconnu",
                    "prenom":     "",
                    "similarity": 0.0,
                    "spoof_conf": spoof_conf,
                    "det_score":  round(score, 2),
                }
            _update_cache(bbox, r)
            results.append(r)

        # Résumé diagnostique après le for loop
        if n_total > 0:
            print(f"[DIAG] {n_total} detect. | trop_petit={n_too_small} "
                  f"score_bas={n_low_score} emb_none={n_emb_none} "
                  f"traites={n_total-n_too_small-n_low_score-n_emb_none}")

    finally:
        db.close()

    _expire_cache(current_bboxes)
    return results


# ── Dessin ────────────────────────────────────────────────────────────────────

def annotate(frame: np.ndarray, results: list[dict]) -> np.ndarray:
    out = frame.copy()
    for r in results:
        x1, y1, x2, y2 = r["bbox"]

        if r["spoof"]:
            color = COLOR_SPOOF
            label = f"SPOOF {r['spoof_conf']:.2f}"
        elif r["recognized"]:
            color = COLOR_KNOWN
            label = f"{r['prenom']} {r['nom']}  {r['similarity']:.2f}"
        else:
            color = COLOR_UNKNOWN
            label = "inconnu"

        thickness = 3 if r.get("det_score", 0) > 0.6 else 2

        cv2.rectangle(out, (x1, y1), (x2, y2), color, thickness)
        (tw, th), _ = cv2.getTextSize(label, FONT, 0.52, 1)
        bg_y1 = max(y1 - th - 8, 0)
        cv2.rectangle(out, (x1, bg_y1), (x1 + tw + 8, y1), color, -1)
        cv2.putText(out, label, (x1 + 4, y1 - 4),
                    FONT, 0.52, (255, 255, 255), 1, cv2.LINE_AA)
    return out


def _draw_hud(frame: np.ndarray, fps: float, spoof_on: bool, n_known: int):
    h, w = frame.shape[:2]
    cv2.rectangle(frame, (0, h - 26), (w, h), (0, 0, 0), -1)
    spoof_lbl = "anti-spoof:ON" if spoof_on else "anti-spoof:OFF"
    spoof_col = COLOR_KNOWN if spoof_on else COLOR_SPOOF
    cv2.putText(frame, f"FPS:{fps:.0f}  {spoof_lbl}  reconnus:{n_known}",
                (8, h - 8), FONT, 0.42, spoof_col, 1, cv2.LINE_AA)
    cv2.putText(frame, "q=quitter", (w - 80, h - 8),
                FONT, 0.42, (120, 120, 120), 1, cv2.LINE_AA)


# ── Mode webcam / vidéo ───────────────────────────────────────────────────────

def run_live(source, spoof, window_title: str):
    cap = cv2.VideoCapture(source)
    if not cap.isOpened():
        print(f"[ERREUR] Impossible d'ouvrir : {source}")
        return

    if isinstance(source, int):
        # Résolution maximale pour mieux détecter les visages lointains
        cap.set(cv2.CAP_PROP_FRAME_WIDTH,  1920)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 1080)

    print("[INFO] Fenêtre ouverte — 'q' pour quitter.")

    lock         = threading.Lock()
    last_results = []
    busy         = threading.Event()

    recognized_data: dict = {}  # student_id → result dict

    def _worker(f):
        r = analyze_frame(f, spoof)
        with lock:
            last_results.clear()
            last_results.extend(r)
            for item in r:
                if item["recognized"] and not item["spoof"]:
                    sid = item["student_id"]
                    if sid and sid not in recognized_data:
                        recognized_data[sid] = item
        busy.clear()

    import time
    t0 = time.time()
    frames_shown = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        if not busy.is_set():
            busy.set()
            threading.Thread(target=_worker, args=(frame.copy(),), daemon=True).start()

        with lock:
            current = list(last_results)

        display = annotate(frame, current)
        frames_shown += 1
        elapsed = time.time() - t0
        fps = frames_shown / elapsed if elapsed > 0 else 0
        _draw_hud(display, fps, USE_SPOOF and spoof._available, len(recognized_data))

        cv2.imshow(window_title, display)
        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    cap.release()
    cv2.destroyAllWindows()
    _print_summary(recognized_data)


# ── Mode image ────────────────────────────────────────────────────────────────

def run_image(path: str, spoof):
    frame = cv2.imread(path)
    if frame is None:
        print(f"[ERREUR] Impossible de lire : {path}")
        return

    results = analyze_frame(frame, spoof)
    out     = annotate(frame, results)
    _draw_hud(out, 0, USE_SPOOF and spoof._available, 0)

    cv2.imwrite("resultat.jpg", out)
    print(f"\n[IMAGE] {len(results)} visage(s) :")
    for r in results:
        if r["spoof"]:
            print(f"  ⚠  SPOOF        conf_real={r['spoof_conf']:.3f}")
        elif r["recognized"]:
            print(f"  ✓  {r['prenom']} {r['nom']}  sim={r['similarity']:.3f}")
        else:
            print(f"  ✗  inconnu")
    print("\n→ Résultat sauvegardé : resultat.jpg")

    cv2.imshow("SmartCampus IA — Résultat (touche pour fermer)", out)
    cv2.waitKey(0)
    cv2.destroyAllWindows()


def _print_summary(recognized_data: dict):
    print("\n─── Bilan ─────────────────────────────────────────")
    if not recognized_data:
        print("  Aucune personne reconnue.")
    else:
        for sid, info in recognized_data.items():
            print(f"  ✓  {info['prenom']} {info['nom']}  sim={info['similarity']:.3f}")
    print("────────────────────────────────────────────────────\n")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not args:
        print(__doc__)
        sys.exit(1)

    mode = args[0].lower()

    spoof = None
    if USE_SPOOF:
        print("[INIT] Chargement anti-spoofing…")
        from ai.spoofing import get_anti_spoofing
        spoof = get_anti_spoofing()
        status = "actif" if spoof._available else "passthrough (modèle absent)"
        print(f"[INIT] Anti-spoofing : {status}")
    else:
        print("[INIT] Anti-spoofing désactivé (ajouter --spoof pour l'activer).")

        class _PassthroughSpoof:
            _available = False
            def is_real(self, _): return True, 1.0
        spoof = _PassthroughSpoof()

    print("[INIT] Démarrage...\n")

    if mode == "webcam":
        run_live(0, spoof, "SmartCampus IA — Webcam (q=quitter)")

    elif mode == "video":
        if len(args) < 2:
            print("Usage : python test_live.py video <fichier.mp4>")
            sys.exit(1)
        run_live(args[1], spoof,
                 f"SmartCampus IA — {os.path.basename(args[1])} (q=quitter)")

    elif mode == "image":
        if len(args) < 2:
            print("Usage : python test_live.py image <photo.jpg>")
            sys.exit(1)
        run_image(args[1], spoof)

    else:
        print(f"Mode inconnu : '{mode}'. Utiliser : webcam | video | image")
        sys.exit(1)


if __name__ == "__main__":
    main()
