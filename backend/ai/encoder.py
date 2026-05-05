import numpy as np
import cv2
import onnxruntime as ort
import os

_MODEL_PATH  = os.path.join(os.path.expanduser("~"),
               ".insightface", "models", "buffalo_l", "w600k_r50.onnx")
_session     = ort.InferenceSession(_MODEL_PATH, providers=["CPUExecutionProvider"])
_input_name  = _session.get_inputs()[0].name
_output_name = _session.get_outputs()[0].name

print(f"[ArcFace] ONNX chargé ✅")


def encode_face(img_bgr: np.ndarray) -> np.ndarray | None:
    """
    Calcule embedding ArcFace 512D.
    img_bgr : image BGR quelconque → redimensionnée en 112×112 automatiquement.
    """
    try:
        img = cv2.resize(img_bgr, (112, 112))
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB).astype(np.float32)
        img = (img - 127.5) / 127.5
        img = img.transpose(2, 0, 1)[np.newaxis, :]  # 1×3×112×112

        result    = _session.run([_output_name], {_input_name: img})
        embedding = result[0].flatten().astype(np.float32)

        norm = np.linalg.norm(embedding)
        if norm > 0:
            embedding /= norm
        return embedding
    except Exception as e:
        print(f"[ArcFace] Erreur: {e}")
        return None


def compute_similarity(e1: np.ndarray, e2: np.ndarray) -> float:
    return float(np.dot(e1, e2))