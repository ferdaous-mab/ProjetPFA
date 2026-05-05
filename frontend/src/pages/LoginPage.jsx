import { useState } from "react";
import axios from "axios";

const API_URL = "";
const ACCENT = "#6366f1";

export default function LoginPage({ onLogin, onGoToEnroll }) {
  const [view,    setView]    = useState("login"); // login | register
  const [form,    setForm]    = useState({ email: "", password: "", nom: "", prenom: "" });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

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

  const handleRegister = async e => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { data } = await axios.post(`${API_URL}/api/auth/register`, {
        email: form.email, password: form.password,
        nom: form.nom, prenom: form.prenom, role: "etudiant",
      });
      localStorage.setItem("token", data.access_token);
      localStorage.setItem("role",  data.role);
      localStorage.setItem("user",  JSON.stringify(data));
      onLogin?.(data);
    } catch (err) {
      setError(err.response?.data?.detail || "Erreur lors de l'inscription");
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
        .sc-link {
          background: none; border: none; padding: 0;
          color: ${ACCENT}; font-size: 13px;
          font-family: 'Sora', sans-serif;
          cursor: pointer; text-decoration: underline;
        }
        .sc-link:hover { opacity: 0.8; }
      `}</style>

      <div style={{
        width: "100%", maxWidth: 440,
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 24, padding: "40px 36px",
        position: "relative", zIndex: 1,
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

        {/* ── Connexion ── */}
        {view === "login" && (
          <>
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

            <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input className="sc-input" name="email" type="email"
                placeholder="Adresse email" value={form.email}
                onChange={handleChange} required />
              <input className="sc-input" name="password" type="password"
                placeholder="Mot de passe" value={form.password}
                onChange={handleChange} required />

              <button type="submit" className="sc-btn" disabled={loading} style={{ marginTop: 6 }}>
                {loading ? "Connexion en cours..." : "Se connecter →"}
              </button>
            </form>

            {/* Options étudiants */}
            <div style={{
              marginTop: 24,
              paddingTop: 20,
              borderTop: "1px solid rgba(255,255,255,0.07)",
            }}>
              <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 12,
                          textAlign: "center", marginBottom: 12 }}>
                Étudiant sans compte ?
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="sc-btn sc-btn-ghost"
                  onClick={() => { setView("register"); setError(""); setForm({ email: "", password: "", nom: "", prenom: "" }); }}
                  style={{ flex: 1, padding: "11px", fontSize: 13 }}>
                  Créer un compte
                </button>
                <button className="sc-btn sc-btn-ghost"
                  onClick={onGoToEnroll}
                  style={{ flex: 1, padding: "11px", fontSize: 13 }}>
                  Enrôlement facial
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── Inscription étudiant ── */}
        {view === "register" && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
              <button onClick={() => { setView("login"); setError(""); }}
                style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)",
                         cursor: "pointer", fontSize: 18, padding: 0 }}>←</button>
              <div>
                <div style={{ color: "#fff", fontWeight: 600, fontSize: 16 }}>
                  Créer un compte étudiant
                </div>
                <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>
                  Vous devez être enrôlé au préalable
                </div>
              </div>
            </div>

            {error && (
              <div style={{
                background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
                borderRadius: 10, padding: "10px 14px",
                color: "#fca5a5", fontSize: 13, marginBottom: 16,
              }}>{error}</div>
            )}

            <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <input className="sc-input" name="nom" placeholder="Nom"
                  value={form.nom} onChange={handleChange} required />
                <input className="sc-input" name="prenom" placeholder="Prénom"
                  value={form.prenom} onChange={handleChange} required />
              </div>
              <input className="sc-input" name="email" type="email"
                placeholder="Email (utilisé lors de l'enrôlement)"
                value={form.email} onChange={handleChange} required />
              <input className="sc-input" name="password" type="password"
                placeholder="Choisir un mot de passe"
                value={form.password} onChange={handleChange} required />

              <button type="submit" className="sc-btn" disabled={loading} style={{ marginTop: 4 }}>
                {loading ? "Création..." : "Créer mon compte →"}
              </button>
            </form>

            <p style={{ textAlign: "center", marginTop: 16, marginBottom: 0 }}>
              <button className="sc-link" onClick={onGoToEnroll}>
                Pas encore enrôlé ? Faire l'enrôlement facial →
              </button>
            </p>
          </>
        )}

        {/* Footer */}
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
