import cv2, sys, os
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

IMAGE = r"C:\Users\hp\Desktop\1.png"

from insightface.app import FaceAnalysis
app = FaceAnalysis(name="buffalo_l")
app.prepare(ctx_id=-1, det_size=(640, 640))

img = cv2.imread(IMAGE)
if img is None:
    print("Image introuvable")
    sys.exit(1)

if img.ndim == 3 and img.shape[2] == 4:
    img = cv2.cvtColor(img, cv2.COLOR_BGRA2BGR)

faces = app.get(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
if not faces:
    print("Aucun visage détecté")
    sys.exit(1)

emb = faces[0].normed_embedding.astype(np.float32)
print(f"Visage détecté (score={faces[0].det_score:.3f})\n")

from config import SessionLocal
from db.models import StudentFace, Student
db = SessionLocal()
rows = db.query(StudentFace, Student).join(Student).all()
db.close()

seen = {}
for sf, s in rows:
    ref = np.array(sf.embedding.tolist(), dtype=np.float32)
    ref /= (np.linalg.norm(ref) + 1e-9)
    sim = float(np.dot(emb, ref))
    sid = str(s.id)
    if sid not in seen or sim > seen[sid]["sim"]:
        seen[sid] = {"sim": sim, "nom": s.nom, "prenom": s.prenom}

ranked = sorted(seen.values(), key=lambda x: x["sim"], reverse=True)
print("Top 10 candidats :")
print(f"  {'Prénom':<15}  {'Nom':<22}  {'Sim':>5}  Statut")
print("  " + "-" * 55)
for r in ranked[:10]:
    flag = "RECONNU" if r["sim"] >= 0.35 else ("limite" if r["sim"] >= 0.25 else "inconnu")
    print(f"  {r['prenom']:<15}  {r['nom']:<22}  {r['sim']:.3f}  {flag}")
