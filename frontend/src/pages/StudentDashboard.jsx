import { useState, useEffect } from "react";
import axios from "axios";

const API_URL = "";

function authHeaders() {
  return { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } };
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

function EmptyState({ message }) {
  return (
    <div style={{ textAlign: "center", padding: "32px 20px",
      color: "rgba(255,255,255,0.25)", fontSize: 13 }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
      {message}
    </div>
  );
}

export default function StudentDashboard({ user, onLogout }) {
  const [profile,  setProfile]  = useState(null);
  const [absences, setAbsences] = useState([]);
  const [notes,    setNotes]    = useState(null);
  const [alertes,  setAlertes]  = useState([]);
  const [activeTab,setActiveTab]= useState("profile");
  const [loading,  setLoading]  = useState(true);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [pr, ab, nt, al] = await Promise.all([
        axios.get(`${API_URL}/api/student/profile`,  authHeaders()),
        axios.get(`${API_URL}/api/student/absences`, authHeaders()),
        axios.get(`${API_URL}/api/student/notes`,    authHeaders()),
        axios.get(`${API_URL}/api/student/alertes`,  authHeaders()),
      ]);
      setProfile(pr.data);
      setAbsences(ab.data);
      setNotes(nt.data);
      setAlertes(al.data);
    } catch (err) {
      console.error("Erreur chargement étudiant:", err);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: "profile",  label: "Mon profil", icon: "👤" },
    { id: "absences", label: "Absences",   icon: "📅" },
    { id: "notes",    label: "Notes",      icon: "📝" },
    { id: "alertes",  label: "Alertes",    icon: "🔔" },
  ];

  const statusColor = s =>
    s === "present" ? "#22c55e" : s === "absent" ? "#ef4444" : "#f59e0b";
  const statusLabel = s =>
    s === "present" ? "Présent" : s === "absent" ? "Absent" : "Retard";
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
            background: "linear-gradient(135deg,#6366f1,#a855f7)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
          }}>🎓</div>
          <span style={{ fontWeight: 700, fontSize: 15 }}>SmartCampus IA</span>
          <span style={{
            background: "rgba(99,102,241,0.15)", color: "#6366f1",
            fontSize: 11, padding: "2px 8px", borderRadius: 20, fontWeight: 600,
          }}>Étudiant</span>
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
            background: activeTab === tab.id ? "rgba(99,102,241,0.15)" : "transparent",
            border: "none",
            borderBottom: activeTab === tab.id ? "2px solid #6366f1" : "2px solid transparent",
            color: activeTab === tab.id ? "#6366f1" : "rgba(255,255,255,0.4)",
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
      <div style={{ padding: 24, maxWidth: 800, margin: "0 auto" }}>
        {loading && (
          <div style={{ textAlign: "center", padding: 60,
            color: "rgba(255,255,255,0.3)" }}>Chargement...</div>
        )}

        {/* Profil */}
        {!loading && activeTab === "profile" && profile && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Carte profil */}
            <Card style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <div style={{
                width: 80, height: 80, borderRadius: "50%",
                background: "linear-gradient(135deg,#6366f1,#a855f7)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 32, flexShrink: 0, overflow: "hidden",
              }}>
                {profile.photo_url
                  ? <img src={profile.photo_url} alt="photo"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : "🎓"
                }
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
                  {profile.prenom} {profile.nom}
                </h2>
                <p style={{ color: "rgba(255,255,255,0.4)", margin: "4px 0 0", fontSize: 13 }}>
                  {profile.email}
                </p>
              </div>
            </Card>

            {/* Stats */}
            <div style={{ display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
              {[
                { label: "Absences",      value: profile.stats.absences,      color: "#ef4444", icon: "❌" },
                { label: "Taux présence", value: `${profile.stats.taux_presence}%`, color: "#22c55e", icon: "✅" },
                { label: "Moyenne",       value: `${profile.stats.moyenne}/20`, color: "#6366f1", icon: "📝" },
              ].map((s, i) => (
                <Card key={i} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 24, marginBottom: 6 }}>{s.icon}</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
                  <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 4 }}>{s.label}</div>
                </Card>
              ))}
            </div>

            {/* Jauge présence */}
            <Card>
              <div style={{ display: "flex", justifyContent: "space-between",
                marginBottom: 10, fontSize: 13 }}>
                <span style={{ color: "rgba(255,255,255,0.5)" }}>Taux de présence</span>
                <span style={{ color: profile.stats.taux_presence >= 75 ? "#22c55e" : "#ef4444",
                  fontWeight: 600 }}>{profile.stats.taux_presence}%</span>
              </div>
              <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 6, height: 8 }}>
                <div style={{
                  width: `${profile.stats.taux_presence}%`, height: "100%",
                  background: profile.stats.taux_presence >= 75 ? "#22c55e" : "#ef4444",
                  borderRadius: 6, transition: "width 0.8s ease",
                }} />
              </div>
              {profile.stats.taux_presence < 75 && (
                <p style={{ color: "#ef4444", fontSize: 12, marginTop: 10 }}>
                  ⚠️ Attention — votre taux de présence est insuffisant (minimum requis : 75%)
                </p>
              )}
            </Card>
          </div>
        )}

        {/* Absences */}
        {!loading && activeTab === "absences" && (
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between",
              alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>📅 Historique des présences</h2>
              <span style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444",
                padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                {absences.filter(a => a.status === "absent").length} absences
              </span>
            </div>
            {absences.length === 0
              ? <EmptyState message="Aucun historique de présence" />
              : absences.map((a, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "12px 0",
                  borderBottom: i < absences.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                }}>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 14 }}>{a.matiere}</div>
                    <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, marginTop: 2 }}>
                      {a.date} {a.heure ? `· ${a.heure}` : ""}
                    </div>
                  </div>
                  <span style={{
                    background: `${statusColor(a.status)}20`,
                    color: statusColor(a.status),
                    padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                  }}>{statusLabel(a.status)}</span>
                </div>
              ))
            }
          </Card>
        )}

        {/* Notes */}
        {!loading && activeTab === "notes" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Moyenne générale */}
            <Card style={{ textAlign: "center" }}>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>
                Moyenne générale
              </div>
              <div style={{
                fontSize: 48, fontWeight: 700,
                color: (notes?.moyenne || 0) >= 10 ? "#22c55e" : "#ef4444",
              }}>
                {notes?.moyenne || 0}
                <span style={{ fontSize: 20, color: "rgba(255,255,255,0.3)" }}>/20</span>
              </div>
            </Card>

            {/* Notes par matière */}
            <Card>
              <h2 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 600 }}>📝 Notes par matière</h2>
              {!notes?.notes?.length
                ? <EmptyState message="Aucune note enregistrée" />
                : notes.notes.map((n, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "12px 0",
                    borderBottom: i < notes.notes.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                  }}>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 14 }}>{n.matiere}</div>
                      <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, marginTop: 2 }}>
                        {n.type} · Coef {n.coefficient} · {n.date}
                      </div>
                    </div>
                    <div style={{
                      fontSize: 20, fontWeight: 700,
                      color: n.note >= 10 ? "#22c55e" : "#ef4444",
                    }}>
                      {n.note}<span style={{ fontSize: 12,
                        color: "rgba(255,255,255,0.3)" }}>/20</span>
                    </div>
                  </div>
                ))
              }
            </Card>
          </div>
        )}

        {/* Alertes */}
        {!loading && activeTab === "alertes" && (
          <Card>
            <h2 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 600 }}>🔔 Mes alertes</h2>
            {alertes.length === 0
              ? <EmptyState message="Aucune alerte — continuez comme ça ! ✅" />
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