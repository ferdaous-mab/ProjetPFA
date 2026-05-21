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
      background: "rgba(255,255,255,0.045)",
      border: "1px solid rgba(255,255,255,0.09)",
      borderRadius: 18, padding: "20px 22px", ...style
    }}>{children}</div>
  );
}

function SectionTitle({ title, icon }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
      <div style={{
        width: 32, height: 32, borderRadius: 9,
        background: "rgba(14,165,233,0.15)",
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0,
      }}>{icon}</div>
      <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#fff" }}>{title}</h2>
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div style={{ textAlign: "center", padding: "48px 20px",
      color: "rgba(255,255,255,0.22)", fontSize: 13 }}>
      <div style={{ fontSize: 36, marginBottom: 12, filter: "grayscale(30%) opacity(0.6)" }}>📋</div>
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
  const [activeTab,  setActiveTab] = useState("overview");
  const [loading,    setLoading]   = useState(true);
  const [showVoice,  setShowVoice] = useState(false);
  const [unreadMsg,  setUnreadMsg] = useState(0);

  const [pwForm,    setPwForm]    = useState({ current_password: "", new_password: "", confirm: "" });
  const [pwMsg,     setPwMsg]     = useState("");
  const [pwLoading, setPwLoading] = useState(false);

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

  const tabs = [
    { id: "overview",  label: "Mes matières",      icon: "📚" },
    { id: "today",     label: "Aujourd'hui",        icon: "📅" },
    { id: "absents",   label: "Absences",           icon: "🔴" },
    { id: "alertes",   label: "Alertes",            icon: "🔔" },
    { id: "profil",    label: "Mon profil",         icon: "👤" },
  ];

  const severityColor = s =>
    s === "high" ? "#ef4444" : s === "medium" ? "#f59e0b" : "#6366f1";

  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(ellipse 90% 55% at 50% -5%, rgba(14,165,233,0.09) 0%, transparent 65%), #05050f",
      fontFamily: "'Sora', sans-serif", color: "#fff",
    }}>
      <style>{"@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&display=swap')"}</style>

      {showVoice && (
        <VoiceAssistant
          onClose={() => setShowVoice(false)}
          chatEndpoint="/api/voice/chat-prof"
          suggestions={PROF_SUGGESTIONS}
        />
      )}

      {/* Header */}
      <div className="app-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          {/* Logo */}
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: "linear-gradient(135deg,#0ea5e9,#6366f1)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 800, color: "#fff", letterSpacing: "-0.5px",
            fontFamily: "'Sora', sans-serif",
          }}>SC</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <span style={{ fontWeight: 700, fontSize: 14, lineHeight: 1, color: "#fff" }}>SmartCampus IA</span>
            <span className="hide-mobile" style={{
              fontSize: 10, color: "#0ea5e9", fontWeight: 600,
              letterSpacing: "0.06em", textTransform: "uppercase",
            }}>Espace Professeur</span>
          </div>
        </div>
        <div className="header-actions">
          <span className="header-username" style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>
            {user?.prenom} {user?.nom}
          </span>
          <button onClick={() => setShowVoice(true)} className="sc-btn" style={{
            background: "linear-gradient(135deg,#6366f1,#a855f7)",
            border: "none", borderRadius: 8, color: "#fff", cursor: "pointer",
            padding: bp.isMobile ? "6px 10px" : "6px 14px",
            fontFamily: "Sora, sans-serif", fontSize: 12, fontWeight: 600,
          }}>{bp.isMobile ? "🎤" : "🎤 Assistant IA"}</button>
          <button onClick={onOpenMessages} className="sc-btn" style={{
            position: "relative",
            background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.3)",
            borderRadius: 8, color: "#a5b4fc", cursor: "pointer",
            padding: bp.isMobile ? "6px 10px" : "6px 14px",
            fontFamily: "Sora, sans-serif", fontSize: 12, fontWeight: 600,
          }}>
            {bp.isMobile ? "💬" : "💬 Messages"}
            {unreadMsg > 0 && (
              <span style={{
                position: "absolute", top: -6, right: -6,
                background: "#ef4444", color: "#fff", fontSize: 10, fontWeight: 700,
                minWidth: 18, height: 18, borderRadius: 9,
                display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px",
              }}>{unreadMsg}</span>
            )}
          </button>
          <button onClick={onLogout} className="sc-btn" style={{
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8, color: "rgba(255,255,255,0.6)", cursor: "pointer",
            padding: bp.isMobile ? "6px 10px" : "6px 14px",
            fontFamily: "Sora, sans-serif", fontSize: 12,
          }}>{bp.isMobile ? "↪" : "Déconnexion"}</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs-scroll" style={{
        padding: bp.isMobile ? "10px 12px 0" : "16px 24px 0",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
      }}>
        {tabs.map(tab => (
          <button key={tab.id} className="tab-btn" onClick={() => setActiveTab(tab.id)} style={{
            background: activeTab === tab.id ? "rgba(14,165,233,0.15)" : "transparent",
            border: "none",
            borderBottom: activeTab === tab.id ? "2px solid #0ea5e9" : "2px solid transparent",
            color: activeTab === tab.id ? "#0ea5e9" : "rgba(255,255,255,0.4)",
            cursor: "pointer", padding: bp.isMobile ? "8px 10px" : "10px 16px",
            fontFamily: "Sora, sans-serif", fontSize: bp.isMobile ? 12 : 13,
            fontWeight: activeTab === tab.id ? 600 : 400,
            borderRadius: "8px 8px 0 0",
            display: "flex", alignItems: "center", gap: 5,
          }}>
            {tab.icon} {!bp.isMobile && tab.label}
          </button>
        ))}
      </div>

      {/* Contenu */}
      <div className="page-body" style={{ maxWidth: 900 }}>
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
                      fontFamily: "Sora, sans-serif", outline: "none",
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
                    fontFamily: "Sora, sans-serif", fontSize: 13, fontWeight: 600,
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
  );
}