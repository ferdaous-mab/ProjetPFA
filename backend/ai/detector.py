from insightface.app import FaceAnalysis
import numpy as np

# ── InsightFace buffalo_l ─────────────────────────────────────────────────────
face_app = FaceAnalysis(
    name            = "buffalo_l",
    allowed_modules = ["detection", "recognition", "landmark_2d_106"]
)
face_app.prepare(ctx_id=0, det_size=(640, 640))

print("[InsightFace] buffalo_l chargé ✅")