# Script de présentation — Stack technique SmartCampus IA

> Durée indicative : ~2 min. Présenter colonne par colonne comme sur le visuel.

---

## Intro (5s)
"Notre projet repose sur 4 grandes familles de technologies : Frontend, Backend, IA/Modèles, et Cloud/Services. Chaque choix a été fait pour répondre à un besoin précis."

---

## 1. FRONTEND — l'interface utilisateur

- **React 19** : framework principal pour construire une interface réactive et modulaire (dashboards Prof/Étudiant en temps réel).
- **Material UI (MUI)** : bibliothèque de composants prêts à l'emploi, pour un design professionnel et cohérent sans tout coder à la main.
- **Vite** : outil de build rapide, démarrage instantané du serveur de dev et rechargement à chaud.
- **Axios** : pour communiquer avec notre API FastAPI (requêtes HTTP vers le backend).
- **WebSocket** : pour le temps réel — notifications instantanées, mises à jour live des présences sans recharger la page.

**Résumé :** une interface moderne, rapide à développer, et capable de réagir en direct aux événements du backend.

---

## 2. BACKEND — le cœur métier

- **FastAPI** : framework Python performant et asynchrone, choisi pour sa rapidité d'exécution et sa documentation API automatique (Swagger).
- **Python 3.11** : langage principal, indispensable car tout l'écosystème IA (InsightFace, OpenCV) est en Python.
- **SQLAlchemy** : ORM pour manipuler la base de données avec des objets Python plutôt que du SQL brut.
- **JWT Auth** : authentification sécurisée par token, pour gérer les rôles (étudiant/professeur/admin) sans session serveur.
- **Alembic** : gestion des migrations de base de données, pour faire évoluer le schéma sans perdre les données existantes.

**Résumé :** une API robuste, sécurisée et facilement maintenable, taillée pour l'intégration de modules IA.

---

## 3. IA / MODÈLES — l'intelligence du système

- **InsightFace** : librairie de reconnaissance faciale, utilisée pour détecter et identifier les visages des étudiants.
- **ArcFace 512D** : modèle d'embedding facial qui transforme chaque visage en vecteur de 512 dimensions, permettant une comparaison précise et anti-spoofing.
- **OpenCV** : traitement d'image bas niveau (capture vidéo, prétraitement des frames avant analyse faciale).
- **Claude API** : utilisé côté BI pour analyser les profils d'étudiants à risque et générer des recommandations pédagogiques intelligentes.
- **Groq LLM** : moteur principal de compréhension du langage naturel pour l'assistant vocal (rapide et peu coûteux).
- **Gemini API** : solution de secours (fallback) si Groq est indisponible, et aussi utilisé pour détecter l'intention des commandes vocales.

**Résumé :** une combinaison de vision par ordinateur (présence par reconnaissance faciale) et de LLMs (assistant vocal + analyse pédagogique intelligente).

---

## 4. CLOUD / SERVICES — l'infrastructure

- **Neon PostgreSQL** : base de données relationnelle hébergée dans le cloud, scalable et sans gestion de serveur.
- **pgvector** : extension PostgreSQL qui stocke et compare les vecteurs faciaux (embeddings) directement en base, pour une recherche de similarité ultra-rapide.
- **Cloudinary** : stockage cloud des photos de profil étudiant et des vidéos de séance, avec gestion automatique des uploads/suppressions.
- **AssemblyAI** : transcription audio vers texte, première étape de l'assistant vocal (l'utilisateur parle, AssemblyAI transcrit).
- **Gemini API** : (déjà cité) également utilisé ici comme service cloud d'IA générative.

**Résumé :** une infrastructure cloud qui sépare les responsabilités — données relationnelles, vecteurs IA, et médias — pour rester scalable sans gérer de serveurs physiques.

---

## Conclusion (10s)
"En résumé : React/MUI pour une UI moderne, FastAPI/PostgreSQL pour un backend solide, InsightFace/ArcFace pour la reconnaissance faciale, et Groq/Claude/Gemini/AssemblyAI pour rendre le système intelligent et conversationnel. Chaque brique a été choisie pour son rapport performance/simplicité d'intégration."
