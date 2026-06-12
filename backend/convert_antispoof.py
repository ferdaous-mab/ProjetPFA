"""
convert_antispoof.py — Télécharge et vérifie le modèle MiniFASNetV2
SmartCampus IA - ESISA Fes 2025

Lance : python convert_antispoof.py
Pas besoin d'onnxscript — le modèle est utilisé directement via torch.
"""
import os, sys, urllib.request

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

OUT_DIR  = os.path.join(BACKEND_DIR, "ai", "models", "anti_spoof")
PTH_PATH = os.path.join(OUT_DIR, "2.7_80x80_MiniFASNetV2.pth")

os.makedirs(OUT_DIR, exist_ok=True)

# ── Téléchargement ────────────────────────────────────────────────────────────
PTH_URL = (
    "https://github.com/minivision-ai/Silent-Face-Anti-Spoofing"
    "/raw/master/resources/anti_spoof_models/2.7_80x80_MiniFASNetV2.pth"
)

if os.path.exists(PTH_PATH):
    print(f"[OK] Déjà présent : {PTH_PATH}")
else:
    print(f"Téléchargement depuis GitHub…")
    try:
        urllib.request.urlretrieve(PTH_URL, PTH_PATH)
        print(f"[OK] Téléchargé : {PTH_PATH}")
    except Exception as e:
        print(f"[ERREUR] Téléchargement échoué : {e}")
        print(f"Télécharge manuellement le .pth et place-le dans : {OUT_DIR}")
        sys.exit(1)

# ── Vérification du chargement via spoofing.py ────────────────────────────────
print("\nChargement du modèle via ai/spoofing.py…")
from ai.spoofing import get_anti_spoofing
import numpy as np

spoof = get_anti_spoofing()

if not spoof._available:
    print("[ERREUR] Modèle non chargé. Vérifie les logs ci-dessus.")
    sys.exit(1)

print(f"[OK] Modèle chargé — disponible : {spoof._available}")

# ── Test sur une image noire (dummy) ─────────────────────────────────────────
dummy = np.zeros((80, 80, 3), dtype=np.uint8)
is_real, conf = spoof.is_real(dummy)
print(f"[TEST dummy] is_real={is_real}  confiance={conf:.4f}")

# ── Test webcam (optionnel) ───────────────────────────────────────────────────
if "--webcam" in sys.argv:
    import cv2
    cap = cv2.VideoCapture(0)
    if cap.isOpened():
        ret, frame = cap.read()
        cap.release()
        if ret:
            h, w = frame.shape[:2]
            crop = frame[h // 4: 3 * h // 4, w // 4: 3 * w // 4]
            is_real, conf = spoof.is_real(crop)
            print(f"[TEST webcam] is_real={is_real}  confiance={conf:.4f}")
    else:
        print("[INFO] Webcam non disponible, test ignoré.")

print("\n✅ Anti-spoofing prêt. Relance le serveur pour l'activer.")
