import { useState } from "react";
import axios from "axios";
import { useBreakpoint } from "../utils/useBreakpoint";

const API_URL = "";
const ACCENT  = "#6c63ff";

export default function LoginPage({ onLogin, onGoToEnroll, onGoHome }) {
  const bp = useBreakpoint();
  const [form,         setForm]         = useState({ email: "", password: "" });
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState("");
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
      background: "#080818",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Sora', sans-serif",
      padding: 24,
      position: "relative",
      overflow: "hidden",
    }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&display=swap');
        .orb-blue {
          position:absolute; width:520px; height:520px; border-radius:50%;
          background:radial-gradient(circle,rgba(50,80,220,0.45) 0%,transparent 70%);
          top:-80px; left:-140px; pointer-events:none; filter:blur(8px);
        }
        .orb-red {
          position:absolute; width:480px; height:480px; border-radius:50%;
          background:radial-gradient(circle,rgba(200,40,100,0.35) 0%,transparent 70%);
          bottom:-100px; right:-120px; pointer-events:none; filter:blur(8px);
        }
        .star { position:absolute; border-radius:50%; background:rgba(255,255,255,0.6); pointer-events:none; }
        .esisa-input {
          width:100%; padding:13px 16px; background:#f5f0e8;
          border:2px solid transparent; border-radius:14px;
          color:#1a1a2e; font-size:14px; font-family:'Sora',sans-serif;
          font-weight:500; outline:none; box-sizing:border-box;
          transition:border-color .2s, box-shadow .2s;
        }
        .esisa-input:focus { border-color:${ACCENT}88; box-shadow:0 0 0 3px ${ACCENT}22; }
        .esisa-input::placeholder { color:rgba(26,26,46,0.35); }
        .esisa-btn {
          width:100%; padding:14px; border:none; border-radius:14px;
          font-size:15px; font-weight:600; font-family:'Sora',sans-serif;
          cursor:pointer; letter-spacing:0.3px;
          background:linear-gradient(135deg,#6c63ff 0%,#4f46e5 60%,#3730a3 100%);
          color:#fff; transition:opacity .2s, transform .15s, box-shadow .2s;
          box-shadow:0 4px 20px rgba(108,99,255,0.35);
        }
        .esisa-btn:hover:not(:disabled) { opacity:.92; transform:translateY(-1px); box-shadow:0 6px 28px rgba(108,99,255,0.5); }
        .esisa-btn:disabled { opacity:.5; cursor:not-allowed; }
        .esisa-btn-ghost {
          background:transparent; border:1px solid rgba(255,255,255,0.14);
          color:rgba(255,255,255,0.55); box-shadow:none;
        }
        .esisa-btn-ghost:hover:not(:disabled) {
          border-color:rgba(255,255,255,0.3); color:#fff;
          opacity:1; transform:translateY(-1px); box-shadow:none;
        }
        .field-label {
          display:flex; align-items:center; gap:7px;
          color:rgba(255,255,255,0.55); font-size:11px; font-weight:600;
          letter-spacing:1.2px; text-transform:uppercase; margin-bottom:7px;
        }
        .eye-btn {
          position:absolute; right:10px; top:50%; transform:translateY(-50%);
          background:rgba(26,26,46,0.12); border:none; border-radius:10px;
          width:34px; height:34px; display:flex; align-items:center; justify-content:center;
          cursor:pointer; color:rgba(26,26,46,0.4); transition:background .2s, color .2s;
        }
        .eye-btn:hover { background:rgba(26,26,46,0.22); color:rgba(26,26,46,0.75); }
        .back-btn {
          position:absolute; top:18px; left:18px;
          display:flex; align-items:center; gap:6px;
          background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.09);
          border-radius:10px; padding:7px 13px;
          color:rgba(255,255,255,0.45); font-size:13px;
          font-family:'Sora',sans-serif; font-weight:500;
          cursor:pointer; z-index:10; transition:background .2s, color .2s;
        }
        .back-btn:hover { background:rgba(255,255,255,0.08); color:#fff; }
      `}</style>

      <div className="orb-blue" />
      <div className="orb-red"  />

      {[
        [12,15],[88,8],[55,20],[30,70],[72,60],[18,45],[90,78],[45,88],[65,35],[8,85],
        [93,30],[38,12],[78,92],[25,55],[60,5],[47,75],[82,48],[15,92],[70,18],[35,38],
      ].map(([x,y],i) => (
        <div key={i} className="star" style={{
          width:i%3===0?2:1.5, height:i%3===0?2:1.5,
          left:`${x}%`, top:`${y}%`, opacity:0.3+(i%4)*0.12,
        }}/>
      ))}

      {onGoHome && (
        <button className="back-btn" onClick={onGoHome} title="Retour à l'accueil">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
            <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.8"
              strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Accueil
        </button>
      )}

      <div style={{
        width:"100%", maxWidth:430,
        background:"rgba(14,14,35,0.75)",
        backdropFilter:"blur(24px)", WebkitBackdropFilter:"blur(24px)",
        border:"1px solid rgba(255,255,255,0.08)",
        borderRadius: bp.isMobile ? 22 : 28,
        padding: bp.isMobile ? "30px 22px" : "44px 38px",
        position:"relative", zIndex:1,
        boxShadow:"0 24px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(108,99,255,0.06) inset",
      }}>

        {/* Logo */}
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{ filter:"drop-shadow(0 5px 16px rgba(108,99,255,0.55))", position:"relative", width:64, height:64, margin:"0 auto 16px" }}>
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
              <defs>
                <linearGradient id="hexGradLogin" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#1e1b4b"/>
                  <stop offset="100%" stopColor="#3730a3"/>
                </linearGradient>
              </defs>
              <polygon points="32,3 59,18 59,46 32,61 5,46 5,18" fill="url(#hexGradLogin)"/>
              <polygon points="32,8 54,22 54,42 32,56 10,42 10,22" fill="none" stroke="rgba(167,139,250,0.32)" strokeWidth="1.4"/>
            </svg>
            <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <span style={{ fontSize:17, fontWeight:900, color:"#fff", letterSpacing:"-0.5px", fontFamily:"sans-serif" }}>SC</span>
            </div>
          </div>
          <h1 style={{ fontSize:22, fontWeight:700, color:"#fff", margin:0, letterSpacing:"-0.2px" }}>
            SmartCampus IA
          </h1>
          <p style={{ color:"rgba(255,255,255,0.32)", fontSize:13, margin:"5px 0 0" }}>
            Bienvenue ! Votre campus, plus intelligent que jamais ✨
          </p>
        </div>

        <div style={{ marginBottom:20 }}>
          <div style={{ color:"#fff", fontWeight:600, fontSize:18 }}>
            Connexion
          </div>
        </div>

        {error && (
          <div style={{
            background:"rgba(239,68,68,0.09)", border:"1px solid rgba(239,68,68,0.22)",
            borderRadius:11, padding:"10px 14px",
            color:"#fca5a5", fontSize:13, marginBottom:18,
          }}>{error}</div>
        )}

        {!showForgot ? (
          <>
            <form onSubmit={handleLogin} style={{ display:"flex", flexDirection:"column", gap:16 }}>
              <div>
                <div className="field-label">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill={ACCENT}>
                    <path d="M12 12c2.7 0 5-2.3 5-5S14.7 2 12 2 7 4.3 7 7s2.3 5 5 5zm0 2c-3.3 0-10 1.7-10 5v2h20v-2c0-3.3-6.7-5-10-5z"/>
                  </svg>
                  Identifiant
                </div>
                <input className="esisa-input" name="email" type="email"
                  placeholder="Adresse email" value={form.email}
                  onChange={handleChange} required />
              </div>

              <div>
                <div className="field-label">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="#f59e0b">
                    <path d="M18 8h-1V6A5 5 0 0 0 7 6v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2zm-6 9a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm3.1-9H8.9V6a3.1 3.1 0 0 1 6.2 0v2z"/>
                  </svg>
                  Mot de passe
                </div>
                <div style={{ position:"relative" }}>
                  <input className="esisa-input" name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••••••" value={form.password}
                    onChange={handleChange} required style={{ paddingRight:52 }} />
                  <button type="button" className="eye-btn"
                    onClick={() => setShowPassword(v => !v)}
                    title={showPassword ? "Masquer" : "Afficher"}>
                    {showPassword ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <button type="submit" className="esisa-btn" disabled={loading} style={{ marginTop:4 }}>
                {loading ? "Connexion en cours..." : "Se connecter →"}
              </button>
            </form>

            <div style={{ textAlign:"right", marginTop:10 }}>
              <button onClick={() => { setShowForgot(true); setError(""); }}
                style={{
                  background:"none", border:"none", cursor:"pointer",
                  color:"rgba(255,255,255,0.35)", fontSize:13,
                  fontFamily:"'Sora',sans-serif", padding:0, transition:"color .2s",
                }}
                onMouseEnter={e => e.currentTarget.style.color="rgba(255,255,255,0.7)"}
                onMouseLeave={e => e.currentTarget.style.color="rgba(255,255,255,0.35)"}>
                Mot de passe oublié ?
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ marginBottom:18 }}>
              <div style={{ color:"#fff", fontWeight:600, fontSize:16, marginBottom:4 }}>
                Réinitialiser le mot de passe
              </div>
              <div style={{ color:"rgba(255,255,255,0.32)", fontSize:13 }}>
                Entrez votre email — un lien valable 15 min vous sera envoyé.
              </div>
            </div>

            {forgotMsg && (
              <div style={{
                background: forgotMsg.startsWith("✅") ? "rgba(34,197,94,0.09)" : "rgba(239,68,68,0.09)",
                border:`1px solid ${forgotMsg.startsWith("✅") ? "rgba(34,197,94,0.22)" : "rgba(239,68,68,0.22)"}`,
                borderRadius:11, padding:"10px 14px",
                color: forgotMsg.startsWith("✅") ? "#86efac" : "#fca5a5",
                fontSize:13, marginBottom:16,
              }}>{forgotMsg}</div>
            )}

            <form onSubmit={handleForgot} style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div>
                <div className="field-label">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill={ACCENT}>
                    <path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                  </svg>
                  Adresse email
                </div>
                <input className="esisa-input" type="email" placeholder="Votre adresse email"
                  value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} required />
              </div>
              <button type="submit" className="esisa-btn" disabled={forgotLoading}>
                {forgotLoading ? "Envoi en cours..." : "Envoyer le lien →"}
              </button>
            </form>

            <div style={{ textAlign:"center", marginTop:16 }}>
              <button onClick={() => { setShowForgot(false); setForgotMsg(""); }}
                style={{
                  background:"none", border:"none", cursor:"pointer",
                  color:"rgba(255,255,255,0.35)", fontSize:13,
                  fontFamily:"'Sora',sans-serif", transition:"color .2s",
                }}
                onMouseEnter={e => e.currentTarget.style.color="rgba(255,255,255,0.7)"}
                onMouseLeave={e => e.currentTarget.style.color="rgba(255,255,255,0.35)"}>
                ← Retour à la connexion
              </button>
            </div>
          </>
        )}

        {/* Inscription */}
        <div style={{ marginTop:26, paddingTop:22, borderTop:"1px solid rgba(255,255,255,0.06)" }}>
<button className="esisa-btn esisa-btn-ghost" onClick={onGoToEnroll}
            style={{ padding:"11px", fontSize:13 }}>
            S'inscrire — Enrôlement facial →
          </button>
        </div>

      </div>
    </div>
  );
}
