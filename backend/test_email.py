"""
Script de test email — lance avec : python test_email.py
"""
import os
import smtplib
from dotenv import load_dotenv
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

load_dotenv()

gmail_user     = os.getenv("GMAIL_USER", "")
gmail_password = os.getenv("GMAIL_APP_PASSWORD", "").replace(" ", "")
frontend_url   = os.getenv("FRONTEND_URL", "http://localhost:5173")

print("=" * 50)
print("DIAGNOSTIC EMAIL")
print("=" * 50)
print(f"GMAIL_USER        : {gmail_user or '❌ MANQUANT'}")
print(f"GMAIL_APP_PASSWORD: {'*' * len(gmail_password) if gmail_password else '❌ MANQUANT'} ({len(gmail_password)} caractères)")
print(f"FRONTEND_URL      : {frontend_url}")
print("=" * 50)

if not gmail_user or not gmail_password:
    print("\n❌ Variables manquantes dans .env — ajoute :")
    print("   GMAIL_USER=ton.adresse@gmail.com")
    print("   GMAIL_APP_PASSWORD=abcd efgh ijkl mnop")
    exit(1)

# Demande l'adresse de destination
dest = input(f"\nEnvoyer le test à (appuie Entrée pour {gmail_user}) : ").strip()
if not dest:
    dest = gmail_user

print(f"\n📧 Connexion à Gmail SMTP...")

try:
    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as smtp:
        print("   ✅ Connexion SSL établie")
        smtp.login(gmail_user, gmail_password)
        print("   ✅ Authentification réussie")

        msg = MIMEMultipart("alternative")
        msg["Subject"] = "Test SmartCampus IA — email fonctionnel ✅"
        msg["From"]    = f"SmartCampus IA <{gmail_user}>"
        msg["To"]      = dest
        msg.attach(MIMEText(
            "<h2>Test réussi !</h2><p>L'envoi d'email fonctionne correctement.</p>",
            "html"
        ))

        smtp.sendmail(gmail_user, dest, msg.as_string())
        print(f"\n✅ Email de test envoyé à {dest}")
        print("   Vérifie ta boîte mail (et les spams)")

except smtplib.SMTPAuthenticationError as e:
    print(f"\n❌ Authentification échouée : {e}")
    print("\nSolutions :")
    print("  1. Vérifie que la validation en 2 étapes est activée sur Gmail")
    print("  2. Va sur myaccount.google.com → Sécurité → Mots de passe des applications")
    print("  3. Génère un nouveau mot de passe d'application")
    print("  4. Copie les 16 caractères dans GMAIL_APP_PASSWORD (sans espaces)")

except smtplib.SMTPConnectError as e:
    print(f"\n❌ Connexion impossible : {e}")
    print("   Vérifie ta connexion internet ou ton pare-feu")

except Exception as e:
    print(f"\n❌ Erreur inattendue : {type(e).__name__}: {e}")
