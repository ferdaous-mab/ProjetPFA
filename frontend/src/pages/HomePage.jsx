export default function HomePage({ onGoToLogin, onGoToEnroll }) {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#05050f",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Sora', sans-serif",
      padding: "24px",
      position: "relative",
      overflow: "hidden",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&display=swap');

        @keyframes floatUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes glowPulse {
          0%,100% { opacity: 0.5; }
          50%      { opacity: 0.8; }
        }
        .home-btn-primary {
          width: 100%; padding: 15px;
          border: none; border-radius: 14px;
          background: linear-gradient(135deg, #6366f1, #a855f7);
          color: #fff; font-size: 15px; font-weight: 600;
          font-family: 'Sora', sans-serif;
          cursor: pointer; letter-spacing: -0.2px;
          transition: opacity 0.2s, transform 0.2s;
        }
        .home-btn-primary:hover { opacity: 0.88; transform: translateY(-2px); }

        .home-btn-ghost {
          width: 100%; padding: 14px;
          border: 1px solid rgba(255,255,255,0.13);
          border-radius: 14px;
          background: rgba(255,255,255,0.04);
          color: rgba(255,255,255,0.7); font-size: 15px; font-weight: 500;
          font-family: 'Sora', sans-serif;
          cursor: pointer; letter-spacing: -0.2px;
          transition: border-color 0.2s, color 0.2s, transform 0.2s;
        }
        .home-btn-ghost:hover {
          border-color: rgba(255,255,255,0.28);
          color: #fff; transform: translateY(-2px);
        }
      `}</style>

      {/* Halo de fond */}
      <div style={{
        position: "absolute", top: "30%", left: "50%",
        transform: "translate(-50%, -50%)",
        width: 700, height: 700,
        background: "radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 65%)",
        pointerEvents: "none",
        animation: "glowPulse 4s ease-in-out infinite",
      }} />

      {/* Carte centrale */}
      <div style={{
        width: "100%", maxWidth: 420,
        position: "relative", zIndex: 1,
        animation: "floatUp 0.5s ease both",
        textAlign: "center",
      }}>

        {/* Logo */}
        <div style={{
          width: 72, height: 72, borderRadius: 20,
          background: "linear-gradient(135deg, #6366f1, #a855f7)",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 24px",
          fontSize: 22, fontWeight: 800, color: "#fff", letterSpacing: "-1px",
          boxShadow: "0 8px 32px rgba(99,102,241,0.35)",
        }}>SC</div>

        {/* Titre */}
        <h1 style={{
          fontSize: 30, fontWeight: 800, color: "#fff",
          margin: "0 0 8px", letterSpacing: "-0.8px", lineHeight: 1.15,
        }}>
          SmartCampus IA
        </h1>
        <p style={{
          color: "rgba(255,255,255,0.38)", fontSize: 14,
          margin: "0 0 40px", lineHeight: 1.6,
        }}>
          Plateforme intelligente de gestion académique
        </p>

        {/* Boutons */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button className="home-btn-primary" onClick={onGoToLogin}>
            Se connecter →
          </button>

          {/* Séparateur */}
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            margin: "4px 0",
          }}>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", whiteSpace: "nowrap" }}>
              Pas encore de compte ?
            </span>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
          </div>

          <div>
            <button className="home-btn-ghost" onClick={onGoToEnroll}>
              S'inscrire — Enrôlement facial
            </button>
            <p style={{
              fontSize: 11, color: "rgba(255,255,255,0.22)",
              margin: "7px 0 0", lineHeight: 1.5,
            }}>
              Réservé aux étudiants sans compte — un enrôlement facial est requis
            </p>
          </div>
        </div>

        {/* Footer */}
        <p style={{
          fontSize: 11, color: "rgba(255,255,255,0.15)",
          marginTop: 40,
        }}>
          SmartCampus IA — ESISA Fès — PFA 2024-2025
        </p>
      </div>
    </div>
  );
}
