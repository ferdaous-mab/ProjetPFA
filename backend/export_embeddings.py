"""
export_embeddings.py - Exporte les embeddings de la DB vers un fichier local
SmartCampus IA - ESISA Fes 2025

A executer UNE SEULE FOIS quand tu as internet, avant la demo en classe.
Cree un fichier embeddings_cache.json utilisable sans connexion DB.

Usage :
  python export_embeddings.py
"""

import sys, os, json
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from config import SessionLocal
from db import crud

OUTPUT = os.path.join(BACKEND_DIR, "embeddings_cache.json")

def main():
    print("[INFO] Connexion a la base de donnees...")
    db = SessionLocal()
    try:
        from db.models import StudentFace, Student
        rows = db.query(StudentFace, Student).join(
            Student, StudentFace.student_id == Student.id
        ).all()

        if not rows:
            print("[ERREUR] Aucun etudiant enrole dans la base.")
            return

        cache = []
        for sf, s in rows:
            emb = sf.embedding
            if hasattr(emb, "tolist"):
                emb = emb.tolist()
            cache.append({
                "student_id": str(s.id),
                "nom":        s.nom,
                "prenom":     s.prenom,
                "classe":     s.classe,
                "embedding":  emb,
                "det_score":  float(sf.det_score) if sf.det_score else 1.0,
            })

        with open(OUTPUT, "w", encoding="utf-8") as f:
            json.dump(cache, f, ensure_ascii=False, indent=2)

        print(f"[OK] {len(cache)} embeddings exportes → {OUTPUT}")
        noms = set(f"{r['prenom']} {r['nom']}" for r in cache)
        print(f"[OK] {len(noms)} etudiants : {', '.join(sorted(noms))}")

    finally:
        db.close()

if __name__ == "__main__":
    main()
