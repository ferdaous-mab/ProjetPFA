import json, numpy as np
from collections import Counter

d = json.load(open('embeddings_cache.json'))

for e in d:
    v = np.array(e['embedding'], dtype=np.float32)
    e['_emb'] = v / (np.linalg.norm(v) + 1e-9)

print("=" * 60)
print("  Paires a risque de confusion (sim > 0.45)")
print("=" * 60)

risques = []
for i in range(len(d)):
    for j in range(i + 1, len(d)):
        if d[i]['student_id'] == d[j]['student_id']:
            continue
        sim = float(np.dot(d[i]['_emb'], d[j]['_emb']))
        if sim > 0.45:
            risques.append((sim, d[i], d[j]))

risques.sort(reverse=True)

if not risques:
    print("  Aucune paire a risque -- bonne separation !")
else:
    for sim, a, b in risques:
        niveau = "DANGER" if sim > 0.60 else ("Risque" if sim > 0.50 else "Limite")
        print(f"  [{niveau:6s}]  {a['prenom']:15s} {a['nom']:15s}  <-->  "
              f"{b['prenom']:15s} {b['nom']:15s}   sim={sim:.3f}")

print()
print("=" * 60)
print("  Nombre d'embeddings par etudiant")
print("=" * 60)

counts = Counter(e['student_id'] for e in d)
noms   = {e['student_id']: f"{e['prenom']} {e['nom']}" for e in d}

for sid, cnt in sorted(counts.items(), key=lambda x: x[1]):
    flag = "  !! enregistrer plus de photos" if cnt < 3 else "  OK"
    print(f"  {cnt} photo(s)   {noms[sid]:30s}{flag}")

print()
print(f"  Total : {len(set(counts.keys()))} etudiants, {len(d)} embeddings")
