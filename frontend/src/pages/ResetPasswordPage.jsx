import { useState } from "react";
import axios from "axios";

const API_URL = "";
const ACCENT  = "#6366f1";

export default function ResetPasswordPage({ token, onDone }) {
  const [form,    setForm]    = useState({ new_password: "", confirm: "" });
  const [loading, setLoading] = useState(false);
  const [msg,     setMsg]     = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async e => {
    e.preventDefault();
    if (form.new_password !== form.confirm) {
      setMsg("❌ Les mots de passe ne correspondent pas");
      return;
    }
    if (form.new_password.length < 6) {
      setMsg("❌ Le mot de passe doit contenir au moins 6 caractères");
      return;
    }
    setLoading(true);
    setMsg("");
    try {
      await axios.post(`${API_URL}/api/auth/reset-password`, {
        token:        token,
        new_password: form.new_password,
      });
      setSuccess(true);
      setMsg("✅ Mot de passe modifié avec succès !");
    } catch (err) {
      setMsg("❌ " + (err.response?.data?.detail || "Lien invalide ou expiré"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#05050f",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Sora', sans-serif", padding: 24, position: "relative", overflow: "hidden",
    }}>
      <style>{"@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&display=swap')"}</style>

      <div style={{
        position: "absolute", top: "20%", left: "50%", transform: "translateX(-50%)",
        width: 600, height: 600,
        background: `radial-gradient(circle, ${ACCENT}18 0%, transparent 70%)`,
        pointerEvents: "none",
      }} />

      <div style={{
        width: "100%", maxWidth: 440,
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 24, padding: "40px 36px",
        position: "relative", zIndex: 1,
      }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT}99)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 24, margin: "0 auto 14px",
          }}>🔒</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#fff", margin: 0 }}>
            SmartCampus IA
          </h1>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ color: "#fff", fontWeight: 600, fontSize: 18, marginBottom: 4 }}>
            Nouveau mot de passe
          </div>
          <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 13 }}>
            Choisissez un nouveau mot de passe sécurisé.
          </div>
        </div>

        {msg && (
          <div style={{
            background: msg.startsWith("✅") ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
            border: `1px solid ${msg.startsWith("✅") ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
            borderRadius: 10, padding: "10px 14px",
            color: msg.startsWith("✅") ? "#86efac" : "#fca5a5",
            fontSize: 13, marginBottom: 16,
          }}>{msg}</div>
        )}

        {!success ? (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input
              type="password" placeholder="Nouveau mot de passe" value={form.new_password}
              onChange={e => setForm({ ...form, new_password: e.target.value })} required
              style={{
                width: "100%", padding: "13px 16px",
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 12, color: "#fff", fontSize: 14,
                fontFamily: "'Sora', sans-serif", outline: "none", boxSizing: "border-box",
              }}
            />
            <input
              type="password" placeholder="Confirmer le mot de passe" value={form.confirm}
              onChange={e => setForm({ ...form, confirm: e.target.value })} required
              style={{
                width: "100%", padding: "13px 16px",
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 12, color: "#fff", fontSize: 14,
                fontFamily: "'Sora', sans-serif", outline: "none", boxSizing: "border-box",
              }}
            />
            <button type="submit" disabled={loading} style={{
              width: "100%", padding: 14, border: "none", borderRadius: 12,
              fontSize: 15, fontWeight: 600, fontFamily: "'Sora', sans-serif",
              cursor: loading ? "not-allowed" : "pointer", marginTop: 6,
              background: ACCENT, color: "#fff", opacity: loading ? 0.5 : 1,
            }}>
              {loading ? "Modification en cours..." : "Enregistrer le mot de passe →"}
            </button>
          </form>
        ) : (
          <button onClick={onDone} style={{
            width: "100%", padding: 14, border: "none", borderRadius: 12,
            fontSize: 15, fontWeight: 600, fontFamily: "'Sora', sans-serif",
            cursor: "pointer", background: "#22c55e", color: "#fff",
          }}>
            Se connecter →
          </button>
        )}
      </div>
    </div>
  );
}
