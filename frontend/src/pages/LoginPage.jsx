import { useState } from "react";
import axios from "axios";
import { useBreakpoint } from "../utils/useBreakpoint";

const API_URL = "";
const ACCENT = "#6366f1";

export default function LoginPage({ onLogin, onGoToEnroll, onGoHome }) {
  const bp = useBreakpoint();
  const [form,    setForm]    = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const [showPassword, setShowPassword] = useState(false);

  const [showForgot,   setShowForgot]   = useState(false);
  const [forgotEmail,  setForgotEmail]  = useState("");
  const [forgotLoading,setForgotLoading]= useState(false);
  const [forgotMsg,    setForgotMsg]    = useState("");

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const handleForgot = async e => {
    e.preventDefault();
    setForgotLoading(true);
    setForgotMsg("");
    try {
      await axios.post(`${API_URL}/api/auth/forgot-password`, { email: forgotEmail });
      setForgotMsg("✅ Si cet email existe, un lien vous a été envoyé. Vérifiez votre boîte mail.");
      setForgotEmail("");
    } catch {
      setForgotMsg("❌ Une erreur est survenue. Réessayez.");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleLogin = async e => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { data } = await axios.post(`${API_URL}/api/auth/login`, {
        email: form.email, password: form.password,
      });
      localStorage.setItem("token", data.access_token);
      localStorage.setItem("role",  data.role);
      localStorage.setItem("user",  JSON.stringify(data));
      onLogin?.(data);
    } catch (err) {
      setError(err.response?.data?.detail || "Email ou mot de passe incorrect");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#05050f",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Sora', sans-serif",
      padding: 24,
      position: "relative",
      overflow: "hidden",
    }}>

      {/* Flèche retour page principale */}
      {onGoHome && (
        <button
          onClick={onGoHome}
          title="Retour à l'accueil"
          style={{
            position: "absolute", top: 20, left: 20,
            display: "flex", alignItems: "center", gap: 7,
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 10, padding: "8px 14px",
            color: "rgba(255,255,255,0.55)", fontSize: 13,
            fontFamily: "'Sora', sans-serif", fontWeight: 500,
            cursor: "pointer", zIndex: 10,
            transition: "background 0.2s, color 0.2s",
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = "rgba(255,255,255,0.1)";
            e.currentTarget.style.color = "#fff";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = "rgba(255,255,255,0.05)";
            e.currentTarget.style.color = "rgba(255,255,255,0.55)";
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.8"
              strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Accueil
        </button>
      )}

      {/* Background glow */}
      <div style={{
        position: "absolute", top: "20%", left: "50%",
        transform: "translateX(-50%)",
        width: 600, height: 600,
        background: `radial-gradient(circle, ${ACCENT}18 0%, transparent 70%)`,
        pointerEvents: "none",
      }} />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&display=swap');
        .sc-input {
          width: 100%; padding: 13px 16px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px; color: #fff;
          font-size: 14px; font-family: 'Sora', sans-serif;
          outline: none; box-sizing: border-box;
          transition: border-color 0.2s;
        }
        .sc-input:focus { border-color: ${ACCENT}; }
        .sc-input::placeholder { color: rgba(255,255,255,0.25); }
        .sc-btn {
          width: 100%; padding: 14px;
          border: none; border-radius: 12px;
          font-size: 15px; font-weight: 600;
          font-family: 'Sora', sans-serif;
          cursor: pointer; transition: all 0.2s;
          background: ${ACCENT}; color: white;
        }
        .sc-btn:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); }
        .sc-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .sc-btn-ghost {
          background: transparent;
          border: 1px solid rgba(255,255,255,0.15);
          color: rgba(255,255,255,0.6);
        }
        .sc-btn-ghost:hover:not(:disabled) {
          border-color: rgba(255,255,255,0.3); color: white;
          opacity: 1; transform: translateY(-1px);
        }
      `}</style>

      <div style={{
        width: "100%", maxWidth: 440,
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: bp.isMobile ? 20 : 24,
        padding: bp.isMobile ? "28px 20px" : "40px 36px",
        position: "relative", zIndex: 1,
        margin: bp.isMobile ? "0 12px" : "0",
      }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT}99)`,
            display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: 24,
            margin: "0 auto 14px",
          }}>🎓</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#fff", margin: 0 }}>
            SmartCampus IA
          </h1>
          <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 13, margin: "4px 0 0" }}>
            Plateforme intelligente de gestion académique
          </p>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ color: "#fff", fontWeight: 600, fontSize: 18, marginBottom: 4 }}>
            Connexion
          </div>
          <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 13 }}>
            Entrez vos identifiants — votre espace s'ouvrira automatiquement
          </div>
        </div>

        {error && (
          <div style={{
            background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: 10, padding: "10px 14px",
            color: "#fca5a5", fontSize: 13, marginBottom: 16,
          }}>{error}</div>
        )}

        {!showForgot ? (
          <>
            <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input className="sc-input" name="email" type="email"
                placeholder="Adresse email" value={form.email}
                onChange={handleChange} required />
              {/* Champ mot de passe avec œil */}
              <div style={{ position: "relative" }}>
                <input className="sc-input" name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Mot de passe" value={form.password}
                  onChange={handleChange} required
                  style={{ paddingRight: 46 }} />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  style={{
                    position: "absolute", right: 13, top: "50%",
                    transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer",
                    padding: 4, color: "rgba(255,255,255,0.35)",
                    display: "flex", alignItems: "center",
                    transition: "color 0.2s",
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = "rgba(255,255,255,0.75)"}
                  onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.35)"}
                  title={showPassword ? "Masquer" : "Afficher"}
                >
                  {showPassword ? (
                    /* Œil barré */
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    /* Œil ouvert */
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
              <button type="submit" className="sc-btn" disabled={loading} style={{ marginTop: 6 }}>
                {loading ? "Connexion en cours..." : "Se connecter →"}
              </button>
            </form>
            <div style={{ textAlign: "right", marginTop: 10 }}>
              <button onClick={() => { setShowForgot(true); setError(""); }}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: `${ACCENT}cc`, fontSize: 13, fontFamily: "'Sora', sans-serif",
                  textDecoration: "underline", padding: 0,
                }}>
                Mot de passe oublié ?
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ marginBottom: 16 }}>
              <div style={{ color: "#fff", fontWeight: 600, fontSize: 16, marginBottom: 4 }}>
                Réinitialiser le mot de passe
              </div>
              <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 13 }}>
                Entrez votre email — un lien valable 15 min vous sera envoyé.
              </div>
            </div>

            {forgotMsg && (
              <div style={{
                background: forgotMsg.startsWith("✅") ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                border: `1px solid ${forgotMsg.startsWith("✅") ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
                borderRadius: 10, padding: "10px 14px",
                color: forgotMsg.startsWith("✅") ? "#86efac" : "#fca5a5",
                fontSize: 13, marginBottom: 14,
              }}>{forgotMsg}</div>
            )}

            <form onSubmit={handleForgot} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input className="sc-input" type="email" placeholder="Votre adresse email"
                value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} required />
              <button type="submit" className="sc-btn" disabled={forgotLoading}>
                {forgotLoading ? "Envoi en cours..." : "Envoyer le lien →"}
              </button>
            </form>

            <div style={{ textAlign: "center", marginTop: 14 }}>
              <button onClick={() => { setShowForgot(false); setForgotMsg(""); }}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "rgba(255,255,255,0.4)", fontSize: 13,
                  fontFamily: "'Sora', sans-serif",
                }}>
                ← Retour à la connexion
              </button>
            </div>
          </>
        )}

        {/* Inscription étudiant */}
        <div style={{
          marginTop: 24, paddingTop: 20,
          borderTop: "1px solid rgba(255,255,255,0.07)",
        }}>
          <div style={{
            display: "flex", alignItems: "flex-start", gap: 10,
            background: "rgba(99,102,241,0.06)",
            border: "1px solid rgba(99,102,241,0.15)",
            borderRadius: 12, padding: "12px 14px",
            marginBottom: 12,
          }}>
            <span style={{ fontSize: 15, lineHeight: 1, marginTop: 1, flexShrink: 0 }}>ℹ️</span>
            <p style={{
              color: "rgba(255,255,255,0.45)", fontSize: 12,
              margin: 0, lineHeight: 1.55,
            }}>
              L'inscription est <strong style={{ color: "rgba(255,255,255,0.65)", fontWeight: 600 }}>
              réservée aux étudiants sans compte</strong>. Elle nécessite un enrôlement facial.
              Si vous avez déjà un compte, connectez-vous ci-dessus.
            </p>
          </div>
          <button className="sc-btn sc-btn-ghost" onClick={onGoToEnroll}
            style={{ padding: "11px", fontSize: 13, width: "100%" }}>
            S'inscrire — Enrôlement facial →
          </button>
        </div>

        <p style={{
          fontSize: 11, color: "rgba(255,255,255,0.15)",
          textAlign: "center", marginTop: 28, marginBottom: 0,
        }}>
          SmartCampus IA — ESISA Fès — PFA 2024-2025
        </p>
      </div>
    </div>
  );
}
