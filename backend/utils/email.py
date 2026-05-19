import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText


def send_reset_email(to_email: str, prenom: str, token: str) -> bool:
    """Envoie l'email de réinitialisation via Gmail SMTP."""
    gmail_user     = os.getenv("GMAIL_USER", "")
    gmail_password = os.getenv("GMAIL_APP_PASSWORD", "").replace(" ", "")
    frontend_url   = os.getenv("FRONTEND_URL", "http://localhost:5173")
    reset_link     = f"{frontend_url}?token={token}"

    if not gmail_user or not gmail_password:
        print("⚠️  GMAIL_USER ou GMAIL_APP_PASSWORD manquant dans .env")
        print(f"🔗 Lien de test (dev) : {reset_link}")
        return False

    html = f"""
    <!DOCTYPE html>
    <html>
    <body style="margin:0;padding:0;background:#f4f6fb;font-family:'Segoe UI',sans-serif;">
      <div style="max-width:520px;margin:40px auto;background:#ffffff;
                  border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px;text-align:center;">
          <div style="font-size:36px;margin-bottom:8px;">🎓</div>
          <h1 style="color:#fff;font-size:20px;margin:0;font-weight:700;font-family:'Segoe UI',sans-serif;">
            SmartCampus IA
          </h1>
        </div>

        <div style="padding:36px 40px;">
          <h2 style="color:#1a1a2e;font-size:18px;margin:0 0 12px;font-family:'Segoe UI',sans-serif;">
            Bonjour {prenom},
          </h2>
          <p style="color:#555;font-size:14px;line-height:1.7;margin:0 0 28px;">
            Vous avez demandé la réinitialisation de votre mot de passe.<br>
            Cliquez sur le bouton ci-dessous pour en choisir un nouveau.<br><br>
            Ce lien est valable <strong style="color:#6366f1;">15 minutes</strong>
            et ne peut être utilisé qu'une seule fois.
          </p>

          <div style="text-align:center;margin-bottom:28px;">
            <a href="{reset_link}"
               style="display:inline-block;padding:14px 40px;
                      background:linear-gradient(135deg,#6366f1,#8b5cf6);
                      color:#fff;text-decoration:none;border-radius:10px;
                      font-weight:700;font-size:15px;font-family:'Segoe UI',sans-serif;">
              Réinitialiser mon mot de passe →
            </a>
          </div>

          <p style="color:#aaa;font-size:12px;border-top:1px solid #eee;
                    padding-top:20px;margin:0;line-height:1.6;">
            Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.<br>
            Votre mot de passe ne sera pas modifié.
          </p>
        </div>
      </div>
    </body>
    </html>
    """

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Réinitialisation de votre mot de passe — SmartCampus IA"
    msg["From"]    = f"SmartCampus IA <{gmail_user}>"
    msg["To"]      = to_email
    msg.attach(MIMEText(html, "html"))

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as smtp:
            smtp.login(gmail_user, gmail_password)
            smtp.sendmail(gmail_user, to_email, msg.as_string())
        print(f"✅ Email envoyé à {to_email}")
        return True
    except smtplib.SMTPAuthenticationError:
        print("❌ Authentification Gmail échouée — vérifie GMAIL_USER et GMAIL_APP_PASSWORD")
        print(f"🔗 Lien de test (dev) : {reset_link}")
        return False
    except Exception as e:
        print(f"❌ Erreur envoi email : {e}")
        print(f"🔗 Lien de test (dev) : {reset_link}")
        return False
