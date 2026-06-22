import { useState, useEffect } from "react";
import HomePage         from "./pages/HomePage";
import LoginPage        from "./pages/LoginPage";
import EnrollPage       from "./pages/EnrollPage";
import AdminDashboard   from "./pages/AdminDashboard";
import ProfDashboard    from "./pages/ProfDashboard";
import StudentDashboard from "./pages/StudentDashboard";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import MessagingPage    from "./pages/MessagingPage";

const ROLE_LABEL = r =>
  r === "admin" ? "Administrateur" : r === "professeur" ? "Professeur" : "Étudiant";

const ROLE_COLOR = r =>
  r === "admin" ? "#a855f7" : r === "professeur" ? "#0ea5e9" : "#6366f1";

const ROLE_MSG = r =>
  r === "admin"
    ? "Gérez votre campus en toute simplicité. Toutes vos données, analyses et alertes sont prêtes pour vous."
    : r === "professeur"
    ? "Vos cours, présences et étudiants vous attendent. Bonne séance !"
    : "Consultez vos cours, notes et emploi du temps. Bonne journée d'études !";

function WelcomeModal({ user, onClose }) {
  const role  = (user?.role || "").toLowerCase();
  const color = ROLE_COLOR(role);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 2000,
      background: "rgba(0,0,0,0.75)",
      backdropFilter: "blur(8px)",
      WebkitBackdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Sora', sans-serif",
      padding: 24,
    }}>
      <style>{`
        @keyframes welcomeIn {
          from { opacity:0; transform:scale(0.88) translateY(20px); }
          to   { opacity:1; transform:scale(1)    translateY(0); }
        }
        @keyframes starFloat {
          0%,100% { opacity:.3; transform:translateY(0); }
          50%      { opacity:.7; transform:translateY(-6px); }
        }
      `}</style>

      <div style={{
        width: "100%", maxWidth: 420,
        background: "rgba(10,10,26,0.96)",
        border: `1px solid ${color}30`,
        borderRadius: 24,
        padding: "44px 36px 36px",
        position: "relative", overflow: "hidden",
        animation: "welcomeIn 0.45s cubic-bezier(0.34,1.56,0.64,1) both",
        boxShadow: `0 32px 100px rgba(0,0,0,0.85), 0 0 0 1px ${color}15 inset`,
        textAlign: "center",
      }}>

        {/* Orbes déco */}
        <div style={{
          position: "absolute", top: -40, left: -40,
          width: 160, height: 160, borderRadius: "50%",
          background: `radial-gradient(circle, ${color}25 0%, transparent 70%)`,
          pointerEvents: "none",
        }}/>
        <div style={{
          position: "absolute", bottom: -30, right: -30,
          width: 130, height: 130, borderRadius: "50%",
          background: `radial-gradient(circle, ${color}18 0%, transparent 70%)`,
          pointerEvents: "none",
        }}/>

        {/* Étoiles flottantes */}
        {[[12,15],[88,20],[6,70],[92,65],[50,8]].map(([x,y],i) => (
          <div key={i} style={{
            position: "absolute", left:`${x}%`, top:`${y}%`,
            width: 3, height: 3, borderRadius: "50%",
            background: color, opacity: 0.4,
            animation: `starFloat ${2+i*0.4}s ease-in-out infinite ${i*0.3}s`,
            pointerEvents: "none",
          }}/>
        ))}

        {/* Logo hexagone */}
        <div style={{ filter:`drop-shadow(0 6px 18px ${color}60)`, position:"relative", width:72, height:72, margin:"0 auto 22px" }}>
          <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
            <defs>
              <linearGradient id="hexWelcome" x1="0" y1="0" x2="72" y2="72" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#1e1b4b"/>
                <stop offset="100%" stopColor="#3730a3"/>
              </linearGradient>
            </defs>
            <polygon points="36,3 66,19.5 66,52.5 36,69 6,52.5 6,19.5" fill="url(#hexWelcome)"/>
            <polygon points="36,9 60,24 60,48 36,63 12,48 12,24" fill="none" stroke={`${color}45`} strokeWidth="1.5"/>
          </svg>
          <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <span style={{ fontSize:19, fontWeight:900, color:"#fff", letterSpacing:"-0.5px", fontFamily:"sans-serif" }}>SC</span>
          </div>
        </div>

        {/* Badge rôle */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: `${color}18`, border: `1px solid ${color}35`,
          borderRadius: 20, padding: "4px 14px", marginBottom: 18,
        }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: color, boxShadow: `0 0 6px ${color}` }}/>
          <span style={{ fontSize: 11, fontWeight: 700, color, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            {ROLE_LABEL(role)}
          </span>
        </div>

        {/* Titre */}
        <h2 style={{ fontSize: 24, fontWeight: 800, color: "#fff", margin: "0 0 10px", letterSpacing: "-0.4px", lineHeight: 1.2 }}>
          Bonjour, {user?.prenom} ! 👋
        </h2>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", lineHeight: 1.7, margin: "0 0 28px" }}>
          {ROLE_MSG(role)}
        </p>

        {/* Séparateur déco */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
          <div style={{ flex: 1, height: 1, background: `linear-gradient(to right, transparent, ${color}40)` }}/>
          <span style={{ fontSize: 12, color: `${color}80`, fontWeight: 600 }}>SmartCampus IA</span>
          <div style={{ flex: 1, height: 1, background: `linear-gradient(to left, transparent, ${color}40)` }}/>
        </div>

        {/* Bouton */}
        <button
          onClick={onClose}
          style={{
            width: "100%", padding: "14px",
            border: "none", borderRadius: 14,
            background: `linear-gradient(135deg, ${color}, ${color}cc)`,
            color: "#fff", fontSize: 15, fontWeight: 700,
            fontFamily: "'Sora', sans-serif", cursor: "pointer",
            boxShadow: `0 6px 24px ${color}50`,
            transition: "opacity .2s, transform .15s",
            letterSpacing: "0.2px",
          }}
          onMouseEnter={e => { e.currentTarget.style.opacity=".88"; e.currentTarget.style.transform="translateY(-2px)"; }}
          onMouseLeave={e => { e.currentTarget.style.opacity="1";   e.currentTarget.style.transform="translateY(0)"; }}
        >
          Découvrir SmartCampus IA →
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [user,          setUser]          = useState(null);
  const [page,          setPage]          = useState("loading");
  const [resetToken,    setResetToken]    = useState(null);
  const [messagingOpen, setMessagingOpen] = useState(false);
  const [showWelcome,   setShowWelcome]   = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token  = params.get("token");
    if (token) {
      setResetToken(token);
      setPage("reset-password");
      return;
    }
    try {
      const authToken = localStorage.getItem("token");
      const saved     = localStorage.getItem("user");
      if (authToken && saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.role) {
          setUser(parsed);
          setPage("dashboard");
          return;
        }
      }
    } catch {
      localStorage.clear();
    }
    setPage("home");
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    setPage("dashboard");
    setShowWelcome(true);
  };

  const handleLogout = () => {
    localStorage.clear();
    setUser(null);
    setPage("home");
    setMessagingOpen(false);
    setShowWelcome(false);
  };

  if (page === "loading") return null;

  if (page === "reset-password") {
    return (
      <ResetPasswordPage
        token={resetToken}
        onDone={() => {
          window.history.replaceState({}, "", window.location.pathname);
          setResetToken(null);
          setPage("login");
        }}
      />
    );
  }

  if (page === "home") {
    return (
      <HomePage
        onGoToLogin={() => setPage("login")}
        onGoToEnroll={() => setPage("enroll")}
      />
    );
  }

  if (page === "login") {
    return (
      <LoginPage
        onLogin={handleLogin}
        onGoToEnroll={() => setPage("enroll")}
        onGoHome={() => setPage("home")}
      />
    );
  }

  if (page === "enroll") {
    return (
      <EnrollPage
        onGoToLogin={() => setPage("login")}
        onGoHome={() => setPage("home")}
      />
    );
  }

  if (page === "dashboard" && user !== null) {
    const dashboardProps = {
      user,
      onLogout: handleLogout,
      onOpenMessages: () => setMessagingOpen(true),
    };

    const role = (user.role || "").toLowerCase().trim();
    let Dashboard = null;
    if (role === "admin")       Dashboard = <AdminDashboard   {...dashboardProps} />;
    if (role === "professeur")  Dashboard = <ProfDashboard    {...dashboardProps} />;
    if (role === "etudiant")    Dashboard = <StudentDashboard {...dashboardProps} />;

    if (!Dashboard) {
      handleLogout();
      return null;
    }

    return (
      <>
        {Dashboard}

        {/* ── Modal de bienvenue ── */}
        {showWelcome && (
          <WelcomeModal user={user} onClose={() => setShowWelcome(false)} />
        )}

        {/* ── Fenêtre messagerie flottante ── */}
        {messagingOpen && (
          <div
            onClick={e => { if (e.target === e.currentTarget) setMessagingOpen(false); }}
            style={{
              position: "fixed", inset: 0, zIndex: 1000,
              background: "rgba(0,0,0,0.72)",
              backdropFilter: "blur(6px)",
              WebkitBackdropFilter: "blur(6px)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "'Sora', sans-serif",
            }}
          >
            <div style={{
              width:  "clamp(560px, 68vw, 860px)",
              height: "clamp(420px, 72vh, 640px)",
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.1)",
              boxShadow: "0 28px 90px rgba(0,0,0,0.9), 0 0 0 1px rgba(99,102,241,0.1) inset",
              position: "relative",
              overflow: "hidden",
            }}>
              <div style={{
                position: "absolute", top: 0, left: 0, right: 0,
                height: 40, zIndex: 5,
                background: "rgba(8,8,24,0.98)",
                borderBottom: "1px solid rgba(255,255,255,0.07)",
                display: "flex", alignItems: "center", padding: "0 14px", gap: 10,
              }}>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button
                    onClick={() => setMessagingOpen(false)}
                    title="Fermer"
                    style={{
                      width: 12, height: 12, borderRadius: "50%",
                      background: "#ef4444", border: "none",
                      cursor: "pointer", padding: 0, flexShrink: 0,
                    }}
                    onMouseEnter={e => e.currentTarget.style.opacity = "0.7"}
                    onMouseLeave={e => e.currentTarget.style.opacity = "1"}
                  />
                  <div style={{ width: 12, height: 12, borderRadius: "50%", background: "rgba(255,255,255,0.12)", flexShrink: 0 }} />
                  <div style={{ width: 12, height: 12, borderRadius: "50%", background: "rgba(255,255,255,0.12)", flexShrink: 0 }} />
                </div>
                <div style={{
                  flex: 1, display: "flex", alignItems: "center",
                  justifyContent: "center", gap: 7,
                  fontSize: 12, fontWeight: 600,
                  color: "rgba(255,255,255,0.4)",
                }}>
                  <span style={{ fontSize: 13 }}>💬</span> Messagerie
                  <span style={{
                    background: "rgba(99,102,241,0.2)",
                    border: "1px solid rgba(99,102,241,0.3)",
                    color: "#a5b4fc", fontSize: 10, fontWeight: 700,
                    padding: "1px 7px", borderRadius: 10,
                  }}>Conversations privées</span>
                </div>
                <div style={{ width: 46, flexShrink: 0 }} />
              </div>

              <div style={{
                position: "absolute",
                top: 40, left: 0, right: 0, bottom: 0,
                overflow: "hidden",
              }}>
                <MessagingPage
                  user={user}
                  onBack={() => setMessagingOpen(false)}
                />
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <HomePage
      onGoToLogin={() => setPage("login")}
      onGoToEnroll={() => setPage("enroll")}
    />
  );
}
