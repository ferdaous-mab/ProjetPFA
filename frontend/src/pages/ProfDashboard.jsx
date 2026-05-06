import { useState, useEffect } from "react";
import axios from "axios";

const API_URL = "";

function authHeaders() {
  const token = localStorage.getItem("token");
  console.log("Token:", token ? "OK" : "MANQUANT");
  return { headers: { Authorization: `Bearer ${token}` } };
}

function Card({ children, style = {} }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 16, padding: 20, ...style
    }}>{children}</div>
  );
}

function SectionTitle({ title, icon }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#fff" }}>{title}</h2>
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div style={{ textAlign: "center", padding: "32px 20px",
      color: "rgba(255,255,255,0.25)", fontSize: 13 }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
      {message}
    </div>
  );
}

export default function ProfDashboard({ user, onLogout }) {
  const [overview,  setOverview]  = useState(null);
  const [today,     setToday]     = useState([]);
  const [absents,   setAbsents]   = useState([]);
  const [alertes,   setAlertes]   = useState([]);
  const [activeTab, setActiveTab] = useState("overview");
  const [loading,   setLoading]   = useState(true);

  useEffect(() => { loadAll(); }, []);

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

  const tabs = [
    { id: "overview",  label: "Mes matières",      icon: "📚" },
    { id: "today",     label: "Aujourd'hui",        icon: "📅" },
    { id: "absents",   label: "Absences",           icon: "🔴" },
    { id: "alertes",   label: "Alertes",            icon: "🔔" },
  ];

  const severityColor = s =>
    s === "high" ? "#ef4444" : s === "medium" ? "#f59e0b" : "#6366f1";

  return (
    <div style={{ minHeight: "100vh", background: "#05050f",
      fontFamily: "'Sora', sans-serif", color: "#fff" }}>
      <style>{"@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&display=swap')"}</style>

      {/* Header */}
      <div style={{
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        padding: "0 24px", display: "flex", alignItems: "center",
        justifyContent: "space-between", height: 60,
        position: "sticky", top: 0,
        background: "rgba(5,5,15,0.95)", backdropFilter: "blur(10px)", zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: "linear-gradient(135deg,#0ea5e9,#6366f1)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
          }}>📚</div>
          <span style={{ fontWeight: 700, fontSize: 15 }}>SmartCampus IA</span>
          <span style={{
            background: "rgba(14,165,233,0.15)", color: "#0ea5e9",
            fontSize: 11, padding: "2px 8px", borderRadius: 20, fontWeight: 600,
          }}>Professeur</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>
            {user?.prenom} {user?.nom}
          </span>
          <button onClick={onLogout} style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8, color: "rgba(255,255,255,0.6)",
            cursor: "pointer", padding: "6px 14px",
            fontFamily: "Sora, sans-serif", fontSize: 12,
          }}>Déconnexion</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: "flex", gap: 4, padding: "16px 24px 0",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
      }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            background: activeTab === tab.id ? "rgba(14,165,233,0.15)" : "transparent",
            border: "none",
            borderBottom: activeTab === tab.id ? "2px solid #0ea5e9" : "2px solid transparent",
            color: activeTab === tab.id ? "#0ea5e9" : "rgba(255,255,255,0.4)",
            cursor: "pointer", padding: "10px 16px",
            fontFamily: "Sora, sans-serif", fontSize: 13,
            fontWeight: activeTab === tab.id ? 600 : 400,
            borderRadius: "8px 8px 0 0",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Contenu */}
      <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
        {loading && (
          <div style={{ textAlign: "center", padding: 60,
            color: "rgba(255,255,255,0.3)" }}>Chargement...</div>
        )}

        {/* Mes matières */}
        {!loading && activeTab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14 }}>
              <Card>
                <div style={{ fontSize: 28, fontWeight: 700 }}>{overview?.nb_matieres || 0}</div>
                <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginTop: 4 }}>Matières</div>
              </Card>
              <Card>
                <div style={{ fontSize: 28, fontWeight: 700 }}>
                  {overview?.matieres?.reduce((s, m) => s + m.nb_sessions, 0) || 0}
                </div>
                <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginTop: 4 }}>Séances</div>
              </Card>
              <Card>
                <div style={{ fontSize: 28, fontWeight: 700, color: "#22c55e" }}>
                  {overview?.matieres?.length > 0
                    ? Math.round(overview.matieres.reduce((s, m) => s + m.taux_presence, 0) / overview.matieres.length)
                    : 0}%
                </div>
                <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginTop: 4 }}>Taux présence moyen</div>
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
                      <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginTop: 4 }}>
                        Classe {m.classe} · {m.nb_sessions} séances · Coef {m.coefficient}
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
                      <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 3 }}>
                        Classe {s.classe} {s.heure_debut ? `· ${s.heure_debut}` : ""}
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
                    <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, marginTop: 2 }}>
                      Classe {s.classe}
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
                  padding: "12px 14px", marginBottom: 8,
                  background: `${severityColor(a.severity)}10`,
                  border: `1px solid ${severityColor(a.severity)}30`,
                  borderRadius: 10,
                }}>
                  <div style={{ fontSize: 13 }}>{a.message}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 4 }}>
                    {new Date(a.date).toLocaleDateString("fr-FR")}
                  </div>
                </div>
              ))
            }
          </Card>
        )}
      </div>
    </div>
  );
}