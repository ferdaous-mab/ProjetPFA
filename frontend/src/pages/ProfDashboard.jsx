import { useState, useEffect } from "react";
import axios from "axios";
import VoiceAssistant from "../components/VoiceAssistant";
import { useBreakpoint } from "../utils/useBreakpoint";

const API_URL = "";

function authHeaders() {
  const token = localStorage.getItem("token");
  console.log("Token:", token ? "OK" : "MANQUANT");
  return { headers: { Authorization: `Bearer ${token}` } };
}

function Card({ children, style = {} }) {
  return (
    <div className="sc-card" style={{
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 12, padding: "20px 24px", ...style
    }}>{children}</div>
  );
}

function SectionTitle({ title, icon }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
      <div style={{
        width: 3, height: 16, borderRadius: 2,
        background: "#0ea5e9", flexShrink: 0,
      }} />
      <h2 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#fff", fontFamily: "'Inter', -apple-system, sans-serif" }}>{title}</h2>
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div style={{ textAlign: "center", padding: "48px 20px",
      color: "rgba(255,255,255,0.22)", fontSize: 13, fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", fontSize: 18, color: "rgba(255,255,255,0.2)" }}>—</div>
      <div style={{ fontWeight: 500 }}>{message}</div>
    </div>
  );
}

export default function ProfDashboard({ user, onLogout, onOpenMessages }) {
  const bp = useBreakpoint();
  const [overview,   setOverview]  = useState(null);
  const [today,      setToday]     = useState([]);
  const [absents,    setAbsents]   = useState([]);
  const [alertes,    setAlertes]   = useState([]);
  const [activeTab,  setActiveTab] = useState("profil");
  const [loading,    setLoading]   = useState(true);
  const [showVoice,  setShowVoice] = useState(false);
  const [unreadMsg,  setUnreadMsg] = useState(0);

  const [pwForm,    setPwForm]    = useState({ current_password: "", new_password: "", confirm: "" });
  const [pwMsg,     setPwMsg]     = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  // Onglet Présences
  const [sessions,         setSessions]         = useState([]);
  const [selectedSession,  setSelectedSession]  = useState(null);
  const [sessionDetail,    setSessionDetail]    = useState(null);
  const [presLoading,      setPresLoading]      = useState(false);
  const [toggleLoading,    setToggleLoading]    = useState({});


  const PROF_SUGGESTIONS = [
    "Taux de présence ?",
    "Mes matières ?",
    "Étudiants absents ?",
    "Sessions aujourd'hui ?",
    "Alertes ?",
    "Bilan de mes cours",
  ];

  useEffect(() => {
    loadAll();
    axios.get(`${API_URL}/api/messaging/unread-count`, authHeaders())
      .then(r => setUnreadMsg(r.data.count)).catch(() => {});
  }, []);

  useEffect(() => {
    if (activeTab === "presences") {
      loadSessions();
      setSelectedSession(null);
      setSessionDetail(null);
    }
  }, [activeTab]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [ov, td, ab, al] = await Promise.all([
        axios.get(`${API_URL}/api/prof/overview`,             authHeaders()),
        axios.get(`${API_URL}/api/prof/session-aujourd-hui`,  authHeaders()),
        axios.get(`${API_URL}/api/prof/etudiants-absents`,    authHeaders()),
        axios.get(`${API_URL}/api/prof/alertes`,              authHeaders()),
      ]);
      setOverview(ov.data);
      setToday(td.data);
      setAbsents(ab.data);
      setAlertes(al.data);
    } catch (err) {
      console.error("Erreur chargement prof:", err);
    } finally {
      setLoading(false);
    }
  };

  const changePassword = async () => {
    if (pwForm.new_password !== pwForm.confirm) {
      setPwMsg("❌ Les mots de passe ne correspondent pas");
      return;
    }
    if (pwForm.new_password.length < 6) {
      setPwMsg("❌ Le mot de passe doit contenir au moins 6 caractères");
      return;
    }
    setPwLoading(true);
    try {
      await axios.put(`${API_URL}/api/prof/change-password`, {
        current_password: pwForm.current_password,
        new_password:     pwForm.new_password,
      }, authHeaders());
      setPwMsg("✅ Mot de passe modifié avec succès");
      setPwForm({ current_password: "", new_password: "", confirm: "" });
    } catch (e) {
      setPwMsg("❌ " + (e.response?.data?.detail || "Erreur"));
    } finally {
      setPwLoading(false);
    }
  };

  const loadSessions = async () => {
    setPresLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/attendance/mes-sessions`, authHeaders());
      setSessions(res.data);
    } catch (e) {
      console.error("Erreur chargement séances:", e);
    } finally {
      setPresLoading(false);
    }
  };

  const loadSessionDetail = async (sessionId) => {
    setSessionDetail(null);
    try {
      const res = await axios.get(`${API_URL}/api/attendance/session/${sessionId}`, authHeaders());
      setSessionDetail(res.data);
    } catch (e) {
      console.error("Erreur chargement détail séance:", e);
    }
  };

  const toggleAttendance = async (sessionId, studentId, currentStatus) => {
    const newStatus = currentStatus === "present" ? "absent" : "present";
    const key = `${sessionId}_${studentId}`;
    setToggleLoading(prev => ({ ...prev, [key]: true }));
    try {
      await axios.put(
        `${API_URL}/api/attendance/session/${sessionId}/student/${studentId}`,
        { status: newStatus },
        authHeaders()
      );
      await loadSessionDetail(sessionId);
      // Rafraîchir aussi le compteur de la liste
      setSessions(prev => prev.map(s =>
        s.session_id === sessionId
          ? {
              ...s,
              presents: newStatus === "present" ? s.presents + 1 : s.presents - 1,
              absents:  newStatus === "absent"  ? s.absents  + 1 : s.absents  - 1,
            }
          : s
      ));
    } catch (e) {
      console.error("Erreur toggle présence:", e);
    } finally {
      setToggleLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  const severityColor = s =>
    s === "high" ? "#ef4444" : s === "medium" ? "#f59e0b" : "#6366f1";

  const navItems = [
    {
      id: "profil",
      label: "Mon profil",
      color: "#6366f1",
      icon: (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
      ),
    },
    {
      id: "overview",
      label: "Mes matières",
      color: "#0ea5e9",
      icon: (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
        </svg>
      ),
    },
    {
      id: "today",
      label: "Aujourd'hui",
      color: "#f59e0b",
      icon: (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5"/>
          <line x1="12" y1="1" x2="12" y2="3"/>
          <line x1="12" y1="21" x2="12" y2="23"/>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
          <line x1="1" y1="12" x2="3" y2="12"/>
          <line x1="21" y1="12" x2="23" y2="12"/>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
      ),
    },
    {
      id: "absents",
      label: "Absences",
      color: "#ef4444",
      icon: (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      ),
    },
    {
      id: "presences",
      label: "Présences",
      color: "#10b981",
      icon: (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
      ),
    },
    {
      id: "alertes",
      label: "Alertes",
      color: "#f97316",
      badge: alertes.length > 0 ? alertes.length : null,
      icon: (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
      ),
    },
  ];

  return (
    <div style={{
      display: "flex",
      minHeight: "100vh",
      background: "#0d0d1f",
      fontFamily: "'Inter', -apple-system, sans-serif",
      color: "#fff",
    }}>
      {showVoice && (
        <VoiceAssistant
          onClose={() => setShowVoice(false)}
          chatEndpoint="/api/voice/chat-prof"
          suggestions={PROF_SUGGESTIONS}
        />
      )}

      {/* Bouton flottant Assistant IA — centré en bas */}
      {!showVoice && (
        <div style={{
          position: "fixed", bottom: 32, left: "50%",
          transform: "translateX(-50%)", zIndex: 150,
          display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
        }}>
          <button
            onClick={() => setShowVoice(true)}
            style={{
              width: 56, height: 56, borderRadius: "50%",
              background: "linear-gradient(135deg, #6366f1, #a855f7)",
              border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 0 0 4px rgba(99,102,241,0.15), 0 8px 24px rgba(99,102,241,0.4)",
              transition: "transform 0.2s ease, box-shadow 0.2s ease",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = "scale(1.1)";
              e.currentTarget.style.boxShadow = "0 0 0 6px rgba(99,102,241,0.2), 0 12px 32px rgba(99,102,241,0.5)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.boxShadow = "0 0 0 4px rgba(99,102,241,0.15), 0 8px 24px rgba(99,102,241,0.4)";
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
          </button>
          <span style={{
            fontSize: 11, color: "rgba(255,255,255,0.45)", fontWeight: 600,
            background: "rgba(0,0,0,0.5)", padding: "3px 10px", borderRadius: 20,
            backdropFilter: "blur(6px)",
          }}>Assistant IA</span>
        </div>
      )}

      {/* Sidebar */}
      <div style={{
        width: 248, minWidth: 248, height: "100vh",
        position: "sticky", top: 0,
        background: "#111127",
        borderRight: "1px solid rgba(255,255,255,0.07)",
        display: "flex", flexDirection: "column",
        overflowY: "auto", scrollbarWidth: "none", zIndex: 100,
      }}>
        {/* Logo */}
        <div style={{ padding: "22px 20px 16px", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flexShrink: 0, filter: "drop-shadow(0 4px 12px rgba(14,165,233,0.5))", position: "relative", width: 46, height: 46 }}>
            <svg width="46" height="46" viewBox="0 0 46 46" fill="none">
              <defs>
                <linearGradient id="hexGradProf" x1="0" y1="0" x2="46" y2="46" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#0c2a4e"/>
                  <stop offset="100%" stopColor="#1e3a8a"/>
                </linearGradient>
              </defs>
              <polygon points="23,2 42,12.5 42,33.5 23,44 4,33.5 4,12.5" fill="url(#hexGradProf)"/>
              <polygon points="23,6 38,14.8 38,31.2 23,40 8,31.2 8,14.8" fill="none" stroke="rgba(56,189,248,0.35)" strokeWidth="1.2"/>
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 900, color: "#fff", letterSpacing: "-0.5px", fontFamily: "sans-serif" }}>SC</span>
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#f1f5f9", lineHeight: 1 }}>SmartCampus</div>
            <div style={{ fontSize: 10, color: "#0ea5e9", marginTop: 3, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>Professeur</div>
          </div>
        </div>

        {/* Séparateur */}
        <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "0 16px 10px" }} />

        {/* Navigation */}
        <nav style={{ flex: 1, padding: "4px 10px", display: "flex", flexDirection: "column", gap: 3 }}>
          {navItems.map(item => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 12px", borderRadius: 10,
                  border: active ? `1px solid ${item.color}35` : "1px solid transparent",
                  background: active ? `${item.color}18` : "transparent",
                  color: active ? "#fff" : "rgba(255,255,255,0.48)",
                  cursor: "pointer", width: "100%", textAlign: "left",
                  fontFamily: "'Inter', -apple-system, sans-serif",
                  fontSize: 13, fontWeight: active ? 600 : 400,
                  transition: "all 0.15s",
                }}
                onMouseEnter={e => { if (!active) { e.currentTarget.style.background = `${item.color}10`; e.currentTarget.style.color = "#fff"; }}}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.48)"; }}}
              >
                {/* Icône */}
                <div style={{
                  width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                  background: active ? `${item.color}28` : `${item.color}12`,
                  border: active ? `1px solid ${item.color}40` : `1px solid ${item.color}20`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: active ? item.color : `${item.color}bb`,
                  transition: "all 0.15s",
                }}>
                  {item.icon}
                </div>

                <span style={{ flex: 1 }}>{item.label}</span>

                {/* Badge alertes */}
                {item.badge && (
                  <span style={{
                    background: item.color, color: "#fff",
                    fontSize: 10, fontWeight: 700,
                    minWidth: 18, height: 18, borderRadius: 9,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    padding: "0 4px",
                  }}>{item.badge}</span>
                )}

                {/* Point actif */}
                {active && (
                  <div style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: item.color, flexShrink: 0,
                  }} />
                )}
              </button>
            );
          })}
        </nav>

        {/* Bas de la sidebar */}
        <div style={{ padding: "10px 10px 20px", display: "flex", flexDirection: "column", gap: 6 }}>
          {/* Bouton Messages */}
          <button
            onClick={onOpenMessages}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 12px", borderRadius: 10,
              border: "1px solid rgba(14,165,233,0.2)",
              background: "rgba(14,165,233,0.08)",
              color: "#0ea5e9", cursor: "pointer", width: "100%",
              fontFamily: "'Inter', -apple-system, sans-serif",
              fontSize: 12, fontWeight: 600, position: "relative",
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
            Messages
            {unreadMsg > 0 && (
              <span style={{
                marginLeft: "auto",
                background: "#ef4444", color: "#fff", fontSize: 10, fontWeight: 700,
                minWidth: 18, height: 18, borderRadius: 9,
                display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px",
              }}>{unreadMsg}</span>
            )}
          </button>

          {/* Bouton Déconnexion */}
          <button
            onClick={onLogout}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 12px", borderRadius: 10,
              border: "1px solid rgba(239,68,68,0.2)",
              background: "rgba(239,68,68,0.08)",
              color: "#f87171", cursor: "pointer", width: "100%",
              fontFamily: "'Inter', -apple-system, sans-serif",
              fontSize: 12, fontWeight: 600,
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Déconnexion
          </button>
        </div>
      </div>

      {/* Contenu principal */}
      <div style={{ flex: 1, minHeight: "100vh", overflowY: "auto", overflowX: "hidden" }}>
        <div className="page-body">
          {loading && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", gap: 16, padding: "80px 20px" }}>
              <div className="sc-spinner sc-spinner-cyan" />
              <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, fontWeight: 500 }}>Chargement...</span>
            </div>
          )}

          {/* Mes matières */}
          {!loading && activeTab === "overview" && (
            <div className="sc-fade" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: bp.colsAuto, gap: bp.gap2 }}>
                <Card style={{ borderTop: "2px solid #0ea5e9" }}>
                  <div style={{ fontSize: 30, fontWeight: 700, color: "#0ea5e9" }}>{overview?.nb_matieres || 0}</div>
                  <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 4, fontWeight: 500 }}>Matières</div>
                </Card>
                <Card style={{ borderTop: "2px solid #6366f1" }}>
                  <div style={{ fontSize: 30, fontWeight: 700, color: "#a5b4fc" }}>
                    {overview?.matieres?.reduce((s, m) => s + m.nb_sessions, 0) || 0}
                  </div>
                  <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 4, fontWeight: 500 }}>Séances</div>
                </Card>
                <Card style={{ borderTop: "2px solid #22c55e" }}>
                  <div style={{ fontSize: 30, fontWeight: 700, color: "#22c55e" }}>
                    {overview?.matieres?.length > 0
                      ? Math.round(overview.matieres.reduce((s, m) => s + m.taux_presence, 0) / overview.matieres.length)
                      : 0}%
                  </div>
                  <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 4, fontWeight: 500 }}>Taux présence moyen</div>
                </Card>
              </div>

              {overview?.matieres?.length === 0
                ? <Card><EmptyState message="Aucune matière assignée" /></Card>
                : overview?.matieres?.map((m, i) => (
                  <Card key={i}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 15 }}>{m.nom}
                          <span style={{ marginLeft: 8, color: "rgba(255,255,255,0.3)",
                            fontSize: 12 }}>{m.code}</span>
                        </div>
                        <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginTop: 4, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                          <span>Classe {m.classe}</span>
                          {m.annee_scolaire && (
                            <span style={{ background: "rgba(14,165,233,0.15)", color: "#0ea5e9",
                              fontSize: 11, padding: "1px 7px", borderRadius: 4 }}>
                              {m.annee_scolaire}
                            </span>
                          )}
                          <span>· {m.nb_sessions} séances · Coef {m.coefficient}</span>
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 22, fontWeight: 700,
                          color: m.taux_presence >= 75 ? "#22c55e" : "#ef4444" }}>
                          {m.taux_presence}%
                        </div>
                        <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>présence</div>
                      </div>
                    </div>
                    <div style={{ marginTop: 12, background: "rgba(255,255,255,0.06)",
                      borderRadius: 4, height: 4 }}>
                      <div style={{
                        width: `${m.taux_presence}%`, height: "100%",
                        background: m.taux_presence >= 75 ? "#22c55e" : "#ef4444",
                        borderRadius: 4, transition: "width 0.5s ease",
                      }} />
                    </div>
                  </Card>
                ))
              }
            </div>
          )}

          {/* Aujourd'hui */}
          {!loading && activeTab === "today" && (
            <Card>
              <SectionTitle title="Sessions d'aujourd'hui" icon="📅" />
              {today.length === 0
                ? <EmptyState message="Aucune session aujourd'hui" />
                : today.map((s, i) => (
                  <div key={i} style={{
                    padding: "14px 16px", marginBottom: 10,
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 12,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 15 }}>{s.matiere}</div>
                        <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 3, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <span>Classe {s.classe}</span>
                          {s.annee_scolaire && (
                            <span style={{ background: "rgba(14,165,233,0.15)", color: "#0ea5e9",
                              fontSize: 11, padding: "1px 7px", borderRadius: 4 }}>
                              {s.annee_scolaire}
                            </span>
                          )}
                          {s.heure_debut && <span>· {s.heure_debut}</span>}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 10 }}>
                        {[
                          { label: "Présents", v: s.presents, c: "#22c55e" },
                          { label: "Absents",  v: s.absents,  c: "#ef4444" },
                          { label: "Retards",  v: s.retards,  c: "#f59e0b" },
                        ].map(item => (
                          <div key={item.label} style={{ textAlign: "center" }}>
                            <div style={{ fontSize: 20, fontWeight: 700, color: item.c }}>{item.v}</div>
                            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{item.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))
              }
            </Card>
          )}

          {/* Absences */}
          {!loading && activeTab === "absents" && (
            <Card>
              <SectionTitle title="Étudiants absents" icon="🔴" />
              {absents.length === 0
                ? <EmptyState message="Aucun absent enregistré 🎉" />
                : absents.map((s, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "12px 0",
                    borderBottom: i < absents.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                  }}>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 14 }}>{s.prenom} {s.nom}</div>
                      <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
                        <span>Classe {s.classe}</span>
                        {s.annee_scolaire && (
                          <span style={{ background: "rgba(14,165,233,0.15)", color: "#0ea5e9",
                            fontSize: 11, padding: "1px 7px", borderRadius: 4 }}>
                            {s.annee_scolaire}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{
                      background: "rgba(239,68,68,0.15)", color: "#ef4444",
                      padding: "4px 12px", borderRadius: 20,
                      fontSize: 13, fontWeight: 600,
                    }}>
                      {s.absences} absences
                    </div>
                  </div>
                ))
              }
            </Card>
          )}

          {/* Présences */}
          {activeTab === "presences" && (
            <div className="sc-fade" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {presLoading && (
                <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
                  <div className="sc-spinner sc-spinner-cyan" />
                </div>
              )}

              {/* Liste des séances (panneau gauche) quand pas de séance sélectionnée */}
              {!presLoading && !selectedSession && (
                <Card>
                  <SectionTitle title="Séances — présences calculées par IA" icon="✅" />
                  {sessions.length === 0
                    ? <EmptyState message="Aucune séance enregistrée" />
                    : sessions.map((s, i) => (
                      <div
                        key={i}
                        onClick={() => { setSelectedSession(s); loadSessionDetail(s.session_id); }}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          padding: "13px 16px", marginBottom: 8, cursor: "pointer",
                          background: "rgba(14,165,233,0.05)",
                          border: "1px solid rgba(14,165,233,0.12)",
                          borderRadius: 12, transition: "background 0.15s",
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = "rgba(14,165,233,0.11)"}
                        onMouseLeave={e => e.currentTarget.style.background = "rgba(14,165,233,0.05)"}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{s.matiere_nom}</div>
                          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 3, display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <span>Classe {s.classe}</span>
                            <span>· {new Date(s.date).toLocaleDateString("fr-FR")}</span>
                            {s.heure_debut && <span>· {s.heure_debut.slice(0,5)}</span>}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                          {s.total > 0 ? (
                            <>
                              <span style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e", padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                                {s.presents} ✓
                              </span>
                              <span style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444", padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                                {s.absents} ✗
                              </span>
                            </>
                          ) : (
                            <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 12 }}>Non analysée</span>
                          )}
                          <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 16 }}>›</span>
                        </div>
                      </div>
                    ))
                  }
                </Card>
              )}

              {/* Détail d'une séance sélectionnée */}
              {!presLoading && selectedSession && (
                <Card>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
                    <button
                      onClick={() => { setSelectedSession(null); setSessionDetail(null); }}
                      style={{
                        background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 8, color: "rgba(255,255,255,0.6)", cursor: "pointer",
                        padding: "5px 12px", fontFamily: "'Inter', -apple-system, sans-serif", fontSize: 12,
                      }}>
                      ← Retour
                    </button>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15 }}>{selectedSession.matiere_nom}</div>
                      <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>
                        Classe {selectedSession.classe} · {new Date(selectedSession.date).toLocaleDateString("fr-FR")}
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 14, fontStyle: "italic" }}>
                    Cliquez sur le badge pour basculer présent ↔ absent (correction manuelle)
                  </div>

                  {!sessionDetail
                    ? <div style={{ display: "flex", justifyContent: "center", padding: 30 }}><div className="sc-spinner sc-spinner-cyan" /></div>
                    : sessionDetail.students.length === 0
                      ? <EmptyState message="Aucun étudiant dans ce groupe" />
                      : sessionDetail.students.map((stu, i) => {
                          const key = `${selectedSession.session_id}_${stu.student_id}`;
                          const busy = !!toggleLoading[key];
                          const isPresent = stu.status === "present";
                          return (
                            <div key={i} style={{
                              display: "flex", alignItems: "center", justifyContent: "space-between",
                              padding: "11px 0",
                              borderBottom: i < sessionDetail.students.length - 1
                                ? "1px solid rgba(255,255,255,0.05)" : "none",
                            }}>
                              <div>
                                <div style={{ fontWeight: 500, fontSize: 14 }}>{stu.prenom} {stu.nom}</div>
                                {stu.confidence != null && (
                                  <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, marginTop: 2 }}>
                                    confiance {Math.round(stu.confidence * 100)}%
                                  </div>
                                )}
                              </div>
                              <button
                                disabled={busy}
                                onClick={() => toggleAttendance(selectedSession.session_id, stu.student_id, stu.status)}
                                style={{
                                  background: isPresent ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
                                  color:      isPresent ? "#22c55e" : "#ef4444",
                                  border:    `1px solid ${isPresent ? "rgba(34,197,94,0.35)" : "rgba(239,68,68,0.35)"}`,
                                  borderRadius: 20, padding: "4px 14px",
                                  fontSize: 12, fontWeight: 700, cursor: busy ? "wait" : "pointer",
                                  fontFamily: "'Inter', -apple-system, sans-serif", opacity: busy ? 0.5 : 1,
                                  transition: "all 0.15s",
                                }}>
                                {busy ? "…" : isPresent ? "✓ Présent" : "✗ Absent"}
                              </button>
                            </div>
                          );
                        })
                  }
                </Card>
              )}
            </div>
          )}

          {/* Alertes */}
          {!loading && activeTab === "alertes" && (
            <Card>
              <SectionTitle title="Alertes" icon="🔔" />
              {alertes.length === 0
                ? <EmptyState message="Aucune alerte ✅" />
                : alertes.map((a, i) => (
                  <div key={i} style={{
                    padding: "13px 16px", marginBottom: 8,
                    background: `${severityColor(a.severity)}0d`,
                    border: `1px solid ${severityColor(a.severity)}25`,
                    borderLeft: `3px solid ${severityColor(a.severity)}`,
                    borderRadius: 10,
                    transition: "background 0.15s ease",
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{a.message}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 5 }}>
                      {new Date(a.date).toLocaleDateString("fr-FR")}
                    </div>
                  </div>
                ))
              }
            </Card>
          )}

          {/* Profil */}
          {activeTab === "profil" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Message de bienvenue */}
              <div style={{
                borderRadius: 16,
                padding: "24px 26px",
                background: "linear-gradient(135deg, rgba(14,165,233,0.1) 0%, rgba(99,102,241,0.08) 100%)",
                border: "1px solid rgba(14,165,233,0.2)",
                position: "relative", overflow: "hidden",
              }}>
                {/* Glow déco */}
                <div style={{
                  position: "absolute", top: -30, right: -30,
                  width: 120, height: 120, borderRadius: "50%",
                  background: "radial-gradient(circle, rgba(14,165,233,0.18) 0%, transparent 70%)",
                  pointerEvents: "none",
                }}/>
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}>
                  <div style={{
                    width: 46, height: 46, borderRadius: 13, flexShrink: 0,
                    background: "linear-gradient(135deg, #0ea5e9, #6366f1)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: "0 4px 14px rgba(14,165,233,0.4)",
                  }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: "#fff", marginBottom: 2 }}>
                      Bienvenue, {user?.prenom} !
                    </div>
                    <div style={{ fontSize: 11, color: "#38bdf8", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                      Professeur · SmartCampus IA
                    </div>
                  </div>
                </div>
                <p style={{
                  fontSize: 13.5, color: "rgba(255,255,255,0.55)",
                  lineHeight: 1.75, margin: 0,
                }}>
                  Votre espace est prêt. Gérez vos cours, suivez les présences de vos étudiants
                  et restez informé des alertes en temps réel. <br/>
                  <span style={{ color: "#38bdf8", fontWeight: 600 }}>Bonne séance ! ✨</span>
                </p>
              </div>

              <Card>
                <SectionTitle title="Informations du compte" icon="👤" />
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[
                    { label: "Nom",    value: user?.nom },
                    { label: "Prénom", value: user?.prenom },
                    { label: "Email",  value: user?.email },
                    { label: "Rôle",   value: "Professeur" },
                  ].map(({ label, value }) => (
                    <div key={label} style={{
                      display: "flex", justifyContent: "space-between",
                      padding: "10px 0",
                      borderBottom: "1px solid rgba(255,255,255,0.05)",
                    }}>
                      <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>{label}</span>
                      <span style={{ fontWeight: 500, fontSize: 13 }}>{value || "—"}</span>
                    </div>
                  ))}
                </div>
              </Card>

              <Card>
                <SectionTitle title="Changer le mot de passe" icon="🔒" />
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[
                    { placeholder: "Mot de passe actuel", key: "current_password", type: "password" },
                    { placeholder: "Nouveau mot de passe",  key: "new_password",     type: "password" },
                    { placeholder: "Confirmer le nouveau mot de passe", key: "confirm", type: "password" },
                  ].map(({ placeholder, key, type }) => (
                    <input
                      key={key}
                      type={type}
                      placeholder={placeholder}
                      value={pwForm[key]}
                      onChange={e => setPwForm({ ...pwForm, [key]: e.target.value })}
                      style={{
                        width: "100%", padding: "10px 14px",
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 10, color: "#fff", fontSize: 13,
                        fontFamily: "'Inter', -apple-system, sans-serif", outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                  ))}
                  <button
                    onClick={changePassword}
                    disabled={pwLoading}
                    className="sc-btn"
                    style={{
                      padding: "9px 18px", border: "none", borderRadius: 9,
                      background: "#0ea5e9", color: "#fff", cursor: "pointer",
                      fontFamily: "'Inter', -apple-system, sans-serif", fontSize: 13, fontWeight: 600,
                      opacity: pwLoading ? 0.6 : 1,
                    }}>
                    {pwLoading ? "Modification..." : "Modifier le mot de passe"}
                  </button>
                  {pwMsg && (
                    <div style={{
                      padding: "11px 16px", borderRadius: 8, fontSize: 13, fontWeight: 500,
                      background: pwMsg.startsWith("✅")
                        ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                      border: `1px solid ${pwMsg.startsWith("✅") ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
                      borderLeft: `3px solid ${pwMsg.startsWith("✅") ? "#22c55e" : "#ef4444"}`,
                      color: pwMsg.startsWith("✅") ? "#22c55e" : "#ef4444",
                    }}>
                      {pwMsg}
                    </div>
                  )}
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
