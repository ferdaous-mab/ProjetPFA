export default function HomePage({ onGoToLogin, onGoToEnroll }) {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#080818",
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
          from { opacity:0; transform:translateY(24px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes glowPulse {
          0%,100% { opacity:0.5; }
          50%      { opacity:0.85; }
        }

        .home-orb-blue {
          position:absolute; width:580px; height:580px; border-radius:50%;
          background:radial-gradient(circle,rgba(50,80,220,0.42) 0%,transparent 70%);
          top:-120px; left:-160px; pointer-events:none; filter:blur(10px);
        }
        .home-orb-red {
          position:absolute; width:500px; height:500px; border-radius:50%;
          background:radial-gradient(circle,rgba(200,40,100,0.32) 0%,transparent 70%);
          bottom:-120px; right:-130px; pointer-events:none; filter:blur(10px);
        }
        .home-star { position:absolute; border-radius:50%; background:rgba(255,255,255,0.6); pointer-events:none; }

        .home-btn-primary {
          width:100%; padding:15px; border:none; border-radius:14px;
          background:linear-gradient(135deg,#6c63ff 0%,#4f46e5 60%,#3730a3 100%);
          color:#fff; font-size:15px; font-weight:600;
          font-family:'Sora',sans-serif; cursor:pointer; letter-spacing:-0.2px;
          transition:opacity .2s, transform .2s, box-shadow .2s;
          box-shadow:0 4px 22px rgba(108,99,255,0.38);
        }
        .home-btn-primary:hover { opacity:.9; transform:translateY(-2px); box-shadow:0 6px 30px rgba(108,99,255,0.52); }

        .home-btn-ghost {
          width:100%; padding:14px;
          border:1px solid rgba(255,255,255,0.13); border-radius:14px;
          background:rgba(255,255,255,0.03);
          color:rgba(255,255,255,0.7); font-size:15px; font-weight:500;
          font-family:'Sora',sans-serif; cursor:pointer; letter-spacing:-0.2px;
          transition:border-color .2s, color .2s, transform .2s, background .2s;
        }
        .home-btn-ghost:hover {
          border-color:rgba(255,255,255,0.28); background:rgba(255,255,255,0.06);
          color:#fff; transform:translateY(-2px);
        }
      `}</style>

      {/* Orbes */}
      <div className="home-orb-blue" />
      <div className="home-orb-red"  />

      {/* Étoiles */}
      {[
        [8,10],[85,6],[52,18],[28,72],[76,58],[15,48],[92,80],[42,90],[68,32],[5,88],
        [96,28],[36,14],[80,94],[22,58],[62,4],[50,76],[88,44],[12,95],[74,16],[32,40],
        [58,62],[18,30],[94,55],[44,8],[70,84],
      ].map(([x,y],i) => (
        <div key={i} className="home-star" style={{
          width:i%4===0?2.5:i%3===0?2:1.5,
          height:i%4===0?2.5:i%3===0?2:1.5,
          left:`${x}%`, top:`${y}%`,
          opacity:0.25+(i%5)*0.1,
        }}/>
      ))}

      {/* Carte centrale */}
      <div style={{
        width:"100%", maxWidth:420,
        position:"relative", zIndex:1,
        animation:"floatUp 0.5s ease both",
        textAlign:"center",
        background:"rgba(14,14,35,0.7)",
        backdropFilter:"blur(24px)", WebkitBackdropFilter:"blur(24px)",
        border:"1px solid rgba(255,255,255,0.08)",
        borderRadius:28, padding:"48px 40px",
        boxShadow:"0 24px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(108,99,255,0.05) inset",
      }}>

        {/* Logo */}
        <div style={{ filter:"drop-shadow(0 6px 20px rgba(108,99,255,0.55))", position:"relative", width:76, height:76, margin:"0 auto 24px" }}>
          <svg width="76" height="76" viewBox="0 0 76 76" fill="none">
            <defs>
              <linearGradient id="hexGradHome" x1="0" y1="0" x2="76" y2="76" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#1e1b4b"/>
                <stop offset="100%" stopColor="#3730a3"/>
              </linearGradient>
            </defs>
            <polygon points="38,3 70,21 70,55 38,73 6,55 6,21" fill="url(#hexGradHome)"/>
            <polygon points="38,9 64,25 64,51 38,67 12,51 12,25" fill="none" stroke="rgba(167,139,250,0.32)" strokeWidth="1.5"/>
          </svg>
          <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <span style={{ fontSize:20, fontWeight:900, color:"#fff", letterSpacing:"-0.5px", fontFamily:"sans-serif" }}>SC</span>
          </div>
        </div>

        {/* Titre */}
        <h1 style={{
          fontSize:30, fontWeight:800, color:"#fff",
          margin:"0 0 8px", letterSpacing:"-0.8px", lineHeight:1.15,
        }}>
          SmartCampus IA
        </h1>
        <p style={{
          color:"rgba(255,255,255,0.35)", fontSize:14,
          margin:"0 0 36px", lineHeight:1.6,
        }}>
          Bienvenue ! Votre campus, plus intelligent que jamais ✨
        </p>

        {/* Boutons */}
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          <button className="home-btn-primary" onClick={onGoToLogin}>
            Se connecter →
          </button>

          <div style={{ display:"flex", alignItems:"center", gap:10, margin:"4px 0" }}>
            <div style={{ flex:1, height:1, background:"rgba(255,255,255,0.07)" }} />
            <span style={{ fontSize:11, color:"rgba(255,255,255,0.2)", whiteSpace:"nowrap" }}>
              Pas encore de compte ?
            </span>
            <div style={{ flex:1, height:1, background:"rgba(255,255,255,0.07)" }} />
          </div>

          <div>
            <button className="home-btn-ghost" onClick={onGoToEnroll}>
              S'inscrire — Enrôlement facial
            </button>
            <p style={{
              fontSize:11, color:"rgba(255,255,255,0.22)",
              margin:"7px 0 0", lineHeight:1.5,
            }}>
              Réservé aux étudiants sans compte — un enrôlement facial est requis
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
