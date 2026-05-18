"""
test_pipeline.py - Test du pipeline IA complet
SmartCampus IA - ESISA Fes 2025

Lance depuis le dossier backend :
    python test_pipeline.py
"""

import sys, time
import numpy as np
import cv2
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

def sep(t): print(f"\n{'='*52}\n  {t}\n{'='*52}")
def ok(t):  print(f"  OK   {t}")
def warn(t):print(f"  ---  {t}")
def err(t): print(f"  ERR  {t}")


def test_detector():
    sep("1/5 - FaceDetector (InsightFace SCRFD)")
    try:
        from ai.detector import FaceDetector
        t0 = time.time()
        d  = FaceDetector(conf_threshold=0.45, min_face_size=30)
        ok(f"Chargement : {time.time()-t0:.1f}s")

        dummy = np.zeros((480, 640, 3), dtype=np.uint8)
        t1 = time.time()
        faces = d.detect(dummy)
        ok(f"Inference image vide : {(time.time()-t1)*1000:.0f}ms — {len(faces)} visage(s) (normal=0)")
        return True
    except Exception as e:
        err(f"{e}")
        return False


def test_encoder():
    sep("2/5 - FaceEncoder (ArcFace buffalo_l)")
    try:
        from ai.encoder import FaceEncoder
        t0  = time.time()
        enc = FaceEncoder()
        ok(f"Chargement ({enc.model_name}) : {time.time()-t0:.1f}s")

        # Test weighted_average (ne necessite pas de vrai visage)
        fake_embs = [np.random.randn(512).astype(np.float32) for _ in range(5)]
        fake_embs = [e / np.linalg.norm(e) for e in fake_embs]
        weights   = [0.9, 0.8, 0.7, 0.6, 0.5]
        avg = FaceEncoder.weighted_average(fake_embs, weights=weights)
        ok(f"weighted_average : shape={avg.shape} norme={np.linalg.norm(avg):.4f}")

        # Test cosine_similarity
        sim = FaceEncoder.cosine_similarity(fake_embs[0], fake_embs[0])
        ok(f"cosine_similarity meme emb : {sim:.4f} (attendu=1.0)")
        return True
    except Exception as e:
        err(f"{e}")
        import traceback; traceback.print_exc()
        return False


def test_quality():
    sep("3/5 - verify_quality")
    try:
        from ai.quality import verify_quality, top_k_frames

        # Image trop sombre
        dark = np.ones((200, 160, 3), dtype=np.uint8) * 15
        r1   = verify_quality(dark)
        ok(f"Image sombre  : ok={r1.ok} reason='{r1.reason[:40]}'")

        # Image nette et bien eclairee
        good = np.random.randint(100, 180, (200, 160, 3), dtype=np.uint8)
        r2   = verify_quality(good)
        ok(f"Image correcte: ok={r2.ok} score={r2.score:.3f} "
           f"sharp={r2.sharpness:.0f} bright={r2.brightness:.0f}")

        # test top_k_frames
        frames = [{"crop": good, "score": i/10} for i in range(20)]
        top    = top_k_frames(frames, k=5)
        ok(f"top_k_frames(20 frames, k=5) : {len(top)} retournes, meilleur score={top[0]['score']:.1f}")
        return True
    except Exception as e:
        err(f"{e}")
        return False


def test_pose():
    sep("4/5 - PoseEstimator (SixDRepNet / MediaPipe)")
    try:
        from ai.pose_estimator import PoseEstimator
        t0 = time.time()
        p  = PoseEstimator()
        ok(f"Chargement ({p.backend}) : {time.time()-t0:.1f}s")

        dummy = np.random.randint(60, 200, (224, 224, 3), dtype=np.uint8)
        t1    = time.time()
        pose  = p.estimate(dummy)
        ok(f"Inference : {(time.time()-t1)*1000:.0f}ms")
        ok(f"Pose : yaw={pose.yaw:.1f} pitch={pose.pitch:.1f} roll={pose.roll:.1f}")
        ok(f"Backend : {pose.backend} | valid={pose.valid}")
        return True
    except Exception as e:
        err(f"{e}")
        return False


def test_recognition():
    sep("5/5 - FaceRecognizer (pipeline classe)")
    try:
        from ai.recognition import FaceRecognizer

        t0  = time.time()
        rec = FaceRecognizer()
        ok(f"Chargement : {time.time()-t0:.1f}s")

        # Simule une base de 3 etudiants
        db = [
            {"student_id": 1, "name": "Ali Alami",    "embedding": np.random.randn(512).tolist()},
            {"student_id": 2, "name": "Sara Benali",  "embedding": np.random.randn(512).tolist()},
            {"student_id": 3, "name": "Omar Chraibi", "embedding": np.random.randn(512).tolist()},
        ]
        # Normalise les embeddings
        for e in db:
            arr = np.array(e["embedding"], dtype=np.float32)
            e["embedding"] = (arr / np.linalg.norm(arr)).tolist()

        # Image classe synthetique
        class_img = np.random.randint(40, 200, (720, 1280, 3), dtype=np.uint8)
        t1 = time.time()
        results = rec.recognize_class(class_img, db_embeddings=db, session_id="test")
        ok(f"Inference classe 1280x720 : {(time.time()-t1)*1000:.0f}ms")
        ok(f"Resultats : {len(results)} visage(s) traite(s)")
        warn("(Image aleatoire - pas de vrais visages, c'est normal)")
        return True
    except Exception as e:
        err(f"{e}")
        import traceback; traceback.print_exc()
        return False


if __name__ == "__main__":
    print(f"\n SmartCampus IA - Test Pipeline Complet")
    print(f"   Python {sys.version.split()[0]}")
    print(f"   numpy  {np.__version__}")
    print(f"   opencv {cv2.__version__}")

    r = {
        "FaceDetector":    test_detector(),
        "FaceEncoder":     test_encoder(),
        "verify_quality":  test_quality(),
        "PoseEstimator":   test_pose(),
        "FaceRecognizer":  test_recognition(),
    }

    sep("RESUME")
    all_ok = True
    for name, success in r.items():
        print(f"  {'OK ' if success else 'ERR'}  {name}")
        if not success:
            all_ok = False
    print()
    if all_ok:
        print("  Tout fonctionne ! Lance : uvicorn main:app --reload --host 0.0.0.0 --port 8000")
    else:
        print("  Verifiez les erreurs ci-dessus.")
    print()