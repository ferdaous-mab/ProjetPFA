import cv2
import numpy as np
import torch
from sixdrepnet import SixDRepNet

# ── 6DRepNet ──────────────────────────────────────────────────────────────────
_gpu_id = 0 if torch.cuda.is_available() else -1
_model  = SixDRepNet(gpu_id=_gpu_id, dict_path="")

print(f"[6DRepNet] Modèle chargé ✅ (gpu={'yes' if _gpu_id==0 else 'no'})")

# ── 7 Angles guidés ───────────────────────────────────────────────────────────
GUIDED_ANGLES = [
    {"id": 0, "label": "face",            "instruction": "Regardez droit devant",
     "yaw": (-20,  20), "pitch": (-15, 15)},
    {"id": 1, "label": "droite",          "instruction": "Tournez à droite",
     "yaw": ( 20,  60), "pitch": (-15, 15)},
    {"id": 2, "label": "gauche",          "instruction": "Tournez à gauche",
     "yaw": (-60, -20), "pitch": (-15, 15)},
    {"id": 3, "label": "haut",            "instruction": "Levez la tête",
     "yaw": (-20,  20), "pitch": ( 15, 45)},
    {"id": 4, "label": "bas",             "instruction": "Baissez la tête",
     "yaw": (-20,  20), "pitch": (-45,-15)},
    {"id": 5, "label": "diagonal_droite", "instruction": "Tournez légèrement à droite",
     "yaw": ( 10,  35), "pitch": (-15, 15)},
    {"id": 6, "label": "diagonal_gauche", "instruction": "Tournez légèrement à gauche",
     "yaw": (-35, -10), "pitch": (-15, 15)},
]


def _to_float(val) -> float:
    """Convertit tensor/array/scalar en float Python."""
    if isinstance(val, torch.Tensor):
        return float(val.detach().cpu().numpy().flatten()[0])
    elif isinstance(val, np.ndarray):
        return float(val.flatten()[0])
    elif hasattr(val, '__len__'):
        return float(val[0])
    else:
        return float(val)


def estimate_pose(face_crop: np.ndarray) -> tuple[float, float, float]:
    """
    Estime yaw, pitch, roll depuis crop visage.
    Retourne (yaw, pitch, roll) en degrés — toujours entre -90° et +90°.
    """
    try:
        img = cv2.resize(face_crop, (224, 224))
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

        result = _model.predict(img)

        # result peut être tuple ou liste de 3 valeurs
        if isinstance(result, (list, tuple)) and len(result) == 3:
            yaw, pitch, roll = result
        else:
            print(f"[6DRepNet] Format inattendu: {type(result)}")
            return 0.0, 0.0, 0.0

        yaw   = _to_float(yaw)
        pitch = _to_float(pitch)
        roll  = _to_float(roll)

        print(f"[6DRepNet] yaw={round(yaw,2)}° pitch={round(pitch,2)}° roll={round(roll,2)}°")
        return round(yaw, 2), round(pitch, 2), round(roll, 2)

    except Exception as e:
        print(f"[6DRepNet] Erreur: {e}")
        import traceback
        traceback.print_exc()
        return 0.0, 0.0, 0.0


def detect_angle_id(yaw: float, pitch: float) -> int | None:
    """Retourne l'id de l'angle correspondant à yaw/pitch."""
    for angle in GUIDED_ANGLES:
        if (angle["yaw"][0] <= yaw <= angle["yaw"][1] and
                angle["pitch"][0] <= pitch <= angle["pitch"][1]):
            return angle["id"]
    return None


def get_angle_by_id(angle_id: int) -> dict | None:
    """Retourne l'angle par son id."""
    for a in GUIDED_ANGLES:
        if a["id"] == angle_id:
            return a
    return None