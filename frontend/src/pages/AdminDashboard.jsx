import { useState, useEffect } from "react";
import axios from "axios";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell,
} from "recharts";
import VoiceAssistant from "../components/VoiceAssistant";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const COLORS  = ["#6366f1", "#ef4444", "#f59e0b", "#22c55e"];
const JOURS   = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const CLASSES = ["A", "B", "C"];

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
    <div style={{ textAlign: "center", padding: "40px 20px",
      color: "rgba(255,255,255,0.25)", fontSize: 14 }}>
      <div style={{ fontSize: 36, marginBottom: 8 }}>📊</div>
      {message}
    </div>
  );
}

function StatCard({ icon, label, value, sub, color }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 16, padding: "20px 22px",
      display: "flex", alignItems: "center", gap: 16,
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 12,
        background: `${color}22`, display: "flex",
        alignItems: "center", justifyContent: "center",
        fontSize: 22, flexShrink: 0,
      }}>{icon}</div>
      <div>
        <div style={{ fontSize: 26, fontWeight: 700, color: "#fff" }}>{value}</div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color, marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

function Input({ placeholder, value, onChange, type = "text", style = {} }) {
  return (
    <input type={type} placeholder={placeholder} value={value} onChange={onChange}
      style={{
        width: "100%", padding: "10px 14px",
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 10, color: "#fff", fontSize: 13,
        fontFamily: "Sora, sans-serif", outline: "none",
        boxSizing: "border-box", ...style,
      }} />
  );
}

function Select({ value, onChange, children, style = {} }) {
  return (
    <select value={value} onChange={onChange} style={{
      width: "100%", padding: "10px 14px",
      background: "#111", border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 10, color: "#fff", fontSize: 13,
      fontFamily: "Sora, sans-serif", outline: "none",
      boxSizing: "border-box", ...style,
    }}>{children}</select>
  );
}

function Btn({ onClick, children, color = "#6366f1", style = {} }) {
  return (
    <button onClick={onClick} style={{
      padding: "9px 18px", border: "none", borderRadius: 9,
      background: color, color: "#fff", cursor: "pointer",
      fontFamily: "Sora, sans-serif", fontSize: 13, fontWeight: 600, ...style,
    }}>{children}</button>
  );
}

export default function AdminDashboard({ user, onLogout }) {
  const [overview,    setOverview]    = useState(null);
  const [presClasse,  setPresClasse]  = useState([]);
  const [presMat,     setPresMat]     = useState([]);
  const [evolution,   setEvolution]   = useState([]);
  const [repartition, setRepartition] = useState(null);
  const [risque,      setRisque]      = useState([]);
  const [topAbsences, setTopAbsences] = useState([]);
  const [notesMat,    setNotesMat]    = useState([]);
  const [alertes,     setAlertes]     = useState([]);
  const [activeTab,   setActiveTab]   = useState("overview");
  const [loading,     setLoading]     = useState(true);
  const [showVoice,   setShowVoice]   = useState(false);

  // Gestion state
  const [profs,     setProfs]     = useState([]);
  const [matieres,  setMatieres]  = useState([]);
  const [emplois,   setEmplois]   = useState({});
  const [etudiants, setEtudiants] = useState([]);
  const [gTab,      setGTab]      = useState("profs");
  const [formProf,  setFormProf]  = useState({ nom:"", prenom:"", email:"", password:"" });
  const [formMat,   setFormMat]   = useState({ nom:"", code:"", coefficient:"1", classe:"A", professeur_id:"" });
  const [formEmploi,setFormEmploi]= useState({ matiere_id:"", classe:"A", jour:"Lundi", heure_debut:"08:30", heure_fin:"10:30", salle:"" });
  const [msg,       setMsg]       = useState("");

  useEffect(() => { loadBI(); }, []);
  useEffect(() => { if (activeTab === "gestion") loadGestion(); }, [activeTab]);

  const loadBI = async () => {
    setLoading(true);
    try {
      const [ov, pc, pm, ev, rp, rq, ta, nm, al] = await Promise.all([
        axios.get(`${API_URL}/api/bi/overview`,             authHeaders()),
        axios.get(`${API_URL}/api/bi/presence-par-classe`,  authHeaders()),
        axios.get(`${API_URL}/api/bi/presence-par-matiere`, authHeaders()),
        axios.get(`${API_URL}/api/bi/evolution-presences`,  authHeaders()),
        axios.get(`${API_URL}/api/bi/repartition-statuts`,  authHeaders()),
        axios.get(`${API_URL}/api/bi/etudiants-a-risque`,   authHeaders()),
        axios.get(`${API_URL}/api/bi/top-absences`,         authHeaders()),
        axios.get(`${API_URL}/api/bi/notes-par-matiere`,    authHeaders()),
        axios.get(`${API_URL}/api/bi/alertes-recentes`,     authHeaders()),
      ]);
      setOverview(ov.data);
      setPresClasse(pc.data);
      setPresMat(pm.data);
      setEvolution(ev.data.filter(d => d.taux_presence !== null));
      setRepartition(rp.data);
      setRisque(rq.data);
      setTopAbsences(ta.data);
      setNotesMat(nm.data);
      setAlertes(al.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const loadGestion = async () => {
    try {
      const [pr, mt, em, et] = await Promise.all([
        axios.get(`${API_URL}/api/gestion/professeurs`, authHeaders()),
        axios.get(`${API_URL}/api/gestion/matieres`,    authHeaders()),
        axios.get(`${API_URL}/api/gestion/emplois`,     authHeaders()),
        axios.get(`${API_URL}/api/gestion/etudiants`,   authHeaders()),
      ]);
      setProfs(pr.data);
      setMatieres(mt.data);
      setEmplois(em.data);
      setEtudiants(et.data);
    } catch (err) { console.error(err); }
  };

  const showMsg = (m) => { setMsg(m); setTimeout(() => setMsg(""), 3000); };

  const addProf = async () => {
    try {
      await axios.post(`${API_URL}/api/gestion/professeurs`, formProf, authHeaders());
      showMsg("✅ Professeur créé !");
      setFormProf({ nom:"", prenom:"", email:"", password:"" });
      loadGestion();
    } catch (e) { showMsg("❌ " + (e.response?.data?.detail || "Erreur")); }
  };

  const deactivateProf = async (id) => {
    if (!confirm("Désactiver ce professeur ?")) return;
    await axios.delete(`${API_URL}/api/gestion/professeurs/${id}`, authHeaders());
    showMsg("✅ Professeur désactivé");
    loadGestion();
  };

  const reactivateProf = async (id) => {
    await axios.put(`${API_URL}/api/gestion/professeurs/${id}/reactivate`, {}, authHeaders());
    showMsg("✅ Professeur réactivé");
    loadGestion();
  };

  const permanentDeleteProf = async (id) => {
    if (!confirm("Supprimer définitivement ce professeur ? Cette action est irréversible.")) return;
    await axios.delete(`${API_URL}/api/gestion/professeurs/${id}/permanent`, authHeaders());
    showMsg("✅ Professeur supprimé définitivement");
    loadGestion();
  };

  const deactivateEtudiant = async (id) => {
    if (!confirm("Désactiver le compte de cet étudiant ?")) return;
    await axios.put(`${API_URL}/api/gestion/etudiants/${id}/deactivate`, {}, authHeaders());
    showMsg("✅ Compte étudiant désactivé");
    loadGestion();
  };

  const reactivateEtudiant = async (id) => {
    await axios.put(`${API_URL}/api/gestion/etudiants/${id}/reactivate`, {}, authHeaders());
    showMsg("✅ Compte étudiant réactivé");
    loadGestion();
  };

  const addMat = async () => {
    try {
      const payload = { ...formMat, coefficient: parseFloat(formMat.coefficient) };
      await axios.post(`${API_URL}/api/gestion/matieres`, payload, authHeaders());
      showMsg("✅ Matière créée !");
      setFormMat({ nom:"", code:"", coefficient:"1", classe:"A", professeur_id:"" });
      loadGestion();
    } catch (e) { showMsg("❌ " + (e.response?.data?.detail || "Erreur")); }
  };

  const deleteMat = async (id) => {
    if (!confirm("Supprimer cette matière ?")) return;
    await axios.delete(`${API_URL}/api/gestion/matieres/${id}`, authHeaders());
    showMsg("✅ Matière supprimée");
    loadGestion();
  };

  const addEmploi = async () => {
    try {
      await axios.post(`${API_URL}/api/gestion/emplois`, formEmploi, authHeaders());
      showMsg("✅ Créneau ajouté !");
      loadGestion();
    } catch (e) { showMsg("❌ " + (e.response?.data?.detail || "Erreur")); }
  };

  const deleteEmploi = async (id) => {
    await axios.delete(`${API_URL}/api/gestion/emplois/${id}`, authHeaders());
    showMsg("✅ Créneau supprimé");
    loadGestion();
  };

  const deleteEtudiant = async (id) => {
    if (!confirm("Supprimer cet étudiant ?")) return;
    await axios.delete(`${API_URL}/api/gestion/etudiants/${id}`, authHeaders());
    showMsg("✅ Étudiant supprimé");
    loadGestion();
  };

  const tabs = [
    { id: "overview",  label: "Vue d'ensemble", icon: "📊" },
    { id: "presences", label: "Présences",       icon: "✅" },
    { id: "risques",   label: "Risques",         icon: "⚠️" },
    { id: "notes",     label: "Notes",           icon: "📝" },
    { id: "alertes",   label: "Alertes",         icon: "🔔" },
    { id: "gestion",   label: "Gestion",         icon: "⚙️" },
  ];

  const gTabs = [
    { id: "profs",     label: "Professeurs",     icon: "👨‍🏫" },
    { id: "matieres",  label: "Matières",        icon: "📚" },
    { id: "emplois",   label: "Emploi du temps", icon: "📅" },
    { id: "etudiants", label: "Étudiants",       icon: "🎓" },
  ];

  const severityColor = s =>
    s === "high" ? "#ef4444" : s === "medium" ? "#f59e0b" : "#6366f1";

  return (
    <div style={{ minHeight: "100vh", background: "#05050f",
      fontFamily: "'Sora', sans-serif", color: "#fff" }}>
      <style>{"@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&display=swap')"}</style>

      {/* Voice Assistant Modal */}
      {showVoice && <VoiceAssistant onClose={() => setShowVoice(false)} />}

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
            background: "linear-gradient(135deg,#f59e0b,#ef4444)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
          }}>⚙️</div>
          <span style={{ fontWeight: 700, fontSize: 15 }}>SmartCampus IA</span>
          <span style={{
            background: "rgba(245,158,11,0.15)", color: "#f59e0b",
            fontSize: 11, padding: "2px 8px", borderRadius: 20, fontWeight: 600,
          }}>Admin</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {overview?.alertes_non_lues > 0 && (
            <div style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444",
              fontSize: 12, padding: "4px 10px", borderRadius: 20, fontWeight: 600 }}>
              🔔 {overview.alertes_non_lues}
            </div>
          )}
          {/* Bouton Assistant IA */}
          <button onClick={() => setShowVoice(true)} style={{
            background: "rgba(99,102,241,0.15)",
            border: "1px solid rgba(99,102,241,0.3)",
            borderRadius: 8, color: "#6366f1",
            cursor: "pointer", padding: "6px 14px",
            fontFamily: "Sora, sans-serif", fontSize: 12, fontWeight: 600,
          }}>🎤 Assistant IA</button>
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
      <div style={{ display: "flex", gap: 4, padding: "16px 24px 0",
        borderBottom: "1px solid rgba(255,255,255,0.07)", overflowX: "auto" }}>
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
            display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
          }}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
        {loading && activeTab !== "gestion" && (
          <div style={{ textAlign: "center", padding: 60,
            color: "rgba(255,255,255,0.3)" }}>Chargement...</div>
        )}

        {/* Vue d'ensemble */}
        {!loading && activeTab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
              <StatCard icon="🎓" label="Étudiants" color="#6366f1"
                value={overview?.total_etudiants || 0}
                sub={`${overview?.enrolles || 0} enrôlés`} />
              <StatCard icon="✅" label="Taux présence" color="#22c55e"
                value={`${overview?.taux_presence_global || 0}%`} />
              <StatCard icon="📚" label="Matières" color="#0ea5e9"
                value={overview?.total_matieres || 0}
                sub={`${overview?.total_sessions || 0} séances`} />
              <StatCard icon="👨‍🏫" label="Professeurs" color="#f59e0b"
                value={overview?.total_profs || 0} />
              <StatCard icon="⚠️" label="Alertes" color="#ef4444"
                value={overview?.alertes_non_lues || 0} sub="non lues" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <Card>
                <SectionTitle title="Présence par classe" icon="📊" />
                {presClasse.length === 0 ? <EmptyState message="Aucune donnée" /> :
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={presClasse}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="classe" stroke="rgba(255,255,255,0.3)" fontSize={12} />
                      <YAxis stroke="rgba(255,255,255,0.3)" fontSize={12} unit="%" />
                      <Tooltip contentStyle={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
                        formatter={v => [`${v}%`, "Taux"]} />
                      <Bar dataKey="taux_presence" fill="#6366f1" radius={[6,6,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                }
              </Card>
              <Card>
                <SectionTitle title="Répartition présences" icon="🥧" />
                {!repartition || repartition.total === 0 ? <EmptyState message="Aucune donnée" /> :
                  <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                    <PieChart width={180} height={180}>
                      <Pie data={[
                        { name: "Présent", value: repartition.present },
                        { name: "Absent",  value: repartition.absent  },
                        { name: "Retard",  value: repartition.retard  },
                      ]} cx={85} cy={85} innerRadius={50} outerRadius={80} dataKey="value">
                        {COLORS.map((c, i) => <Cell key={i} fill={COLORS[i]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} />
                    </PieChart>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {[
                        { label: "Présents", pct: repartition.pct_present, color: "#6366f1" },
                        { label: "Absents",  pct: repartition.pct_absent,  color: "#ef4444" },
                        { label: "Retards",  pct: repartition.pct_retard,  color: "#f59e0b" },
                      ].map(item => (
                        <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 10, height: 10, borderRadius: 2, background: item.color }} />
                          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>{item.label}</span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: item.color, marginLeft: "auto" }}>
                            {item.pct}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                }
              </Card>
            </div>
            <Card>
              <SectionTitle title="Évolution des présences (30 jours)" icon="📈" />
              {evolution.length === 0 ? <EmptyState message="Aucune session" /> :
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={evolution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="date" stroke="rgba(255,255,255,0.3)" fontSize={10} tickFormatter={d => d.slice(5)} />
                    <YAxis stroke="rgba(255,255,255,0.3)" fontSize={12} unit="%" domain={[0,100]} />
                    <Tooltip contentStyle={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
                      formatter={v => [`${v}%`, "Taux"]} />
                    <Line type="monotone" dataKey="taux_presence" stroke="#6366f1" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              }
            </Card>
          </div>
        )}

        {/* Présences */}
        {!loading && activeTab === "presences" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <Card>
              <SectionTitle title="Taux par matière" icon="📚" />
              {presMat.length === 0 ? <EmptyState message="Aucune matière" /> :
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={presMat} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis type="number" stroke="rgba(255,255,255,0.3)" fontSize={12} unit="%" domain={[0,100]} />
                    <YAxis type="category" dataKey="matiere" stroke="rgba(255,255,255,0.3)" fontSize={11} width={140} />
                    <Tooltip contentStyle={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
                      formatter={v => [`${v}%`, "Taux"]} />
                    <Bar dataKey="taux_presence" fill="#0ea5e9" radius={[0,6,6,0]} />
                  </BarChart>
                </ResponsiveContainer>
              }
            </Card>
            <Card>
              <SectionTitle title="Top 10 absences" icon="🔴" />
              {topAbsences.length === 0 ? <EmptyState message="Aucune absence" /> :
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                      {["Étudiant","Classe","Absences","Taux"].map(h => (
                        <th key={h} style={{ padding: "10px 12px", textAlign: "left",
                          color: "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: 500 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {topAbsences.map((s, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <td style={{ padding: "10px 12px", fontSize: 14 }}>{s.prenom} {s.nom}</td>
                        <td style={{ padding: "10px 12px" }}>
                          <span style={{ background: "rgba(99,102,241,0.15)", color: "#6366f1",
                            padding: "2px 8px", borderRadius: 6, fontSize: 12 }}>Classe {s.classe}</span>
                        </td>
                        <td style={{ padding: "10px 12px", color: "#ef4444", fontWeight: 600 }}>{s.absences}</td>
                        <td style={{ padding: "10px 12px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 3 }}>
                              <div style={{ width: `${s.taux_absence}%`, height: "100%",
                                background: "#ef4444", borderRadius: 3 }} />
                            </div>
                            <span style={{ fontSize: 12, color: "#ef4444" }}>{s.taux_absence}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              }
            </Card>
          </div>
        )}

        {/* Risques */}
        {!loading && activeTab === "risques" && (
          <Card>
            <SectionTitle title="Étudiants à risque" icon="⚠️" />
            {risque.length === 0 ? <EmptyState message="Aucun étudiant à risque 🎉" /> :
              risque.map((s, i) => (
                <div key={i} style={{
                  background: "rgba(239,68,68,0.06)",
                  border: "1px solid rgba(239,68,68,0.15)",
                  borderRadius: 12, padding: "14px 16px",
                  display: "flex", alignItems: "center", gap: 14, marginBottom: 10,
                }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10,
                    background: "rgba(239,68,68,0.15)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 18, flexShrink: 0 }}>⚠️</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>
                      {s.prenom} {s.nom}
                      <span style={{ marginLeft: 8, background: "rgba(99,102,241,0.15)",
                        color: "#6366f1", fontSize: 11, padding: "2px 8px", borderRadius: 6 }}>
                        Classe {s.classe}
                      </span>
                    </div>
                    <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 4 }}>
                      {s.raisons.join(" · ")}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ color: "#ef4444", fontWeight: 700, fontSize: 18 }}>{s.absences}</div>
                    <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>absences</div>
                  </div>
                </div>
              ))
            }
          </Card>
        )}

        {/* Notes */}
        {!loading && activeTab === "notes" && (
          <Card>
            <SectionTitle title="Moyenne par matière" icon="📝" />
            {notesMat.length === 0 ? <EmptyState message="Aucune note" /> :
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={notesMat}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="matiere" stroke="rgba(255,255,255,0.3)" fontSize={11} />
                  <YAxis stroke="rgba(255,255,255,0.3)" fontSize={12} domain={[0,20]} />
                  <Tooltip contentStyle={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
                    formatter={v => [`${v}/20`, "Moyenne"]} />
                  <Bar dataKey="moyenne" radius={[6,6,0,0]}>
                    {notesMat.map((n, i) => (
                      <Cell key={i} fill={n.moyenne >= 10 ? "#22c55e" : "#ef4444"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            }
          </Card>
        )}

        {/* Alertes */}
        {!loading && activeTab === "alertes" && (
          <Card>
            <SectionTitle title="Alertes récentes" icon="🔔" />
            {alertes.length === 0 ? <EmptyState message="Aucune alerte ✅" /> :
              alertes.map((a, i) => (
                <div key={i} style={{
                  background: `${severityColor(a.severity)}10`,
                  border: `1px solid ${severityColor(a.severity)}30`,
                  borderRadius: 12, padding: "12px 16px",
                  display: "flex", alignItems: "center", gap: 12, marginBottom: 8,
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%",
                    background: severityColor(a.severity), flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13 }}>{a.message}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 3 }}>
                      {new Date(a.created_at).toLocaleDateString("fr-FR")}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6,
                    background: `${severityColor(a.severity)}20`,
                    color: severityColor(a.severity), fontWeight: 600 }}>{a.severity}</span>
                </div>
              ))
            }
          </Card>
        )}

        {/* Gestion */}
        {activeTab === "gestion" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {msg && (
              <div style={{
                background: msg.startsWith("✅") ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                border: `1px solid ${msg.startsWith("✅") ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
                borderRadius: 10, padding: "10px 16px", fontSize: 13,
                color: msg.startsWith("✅") ? "#22c55e" : "#ef4444",
              }}>{msg}</div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              {gTabs.map(t => (
                <button key={t.id} onClick={() => setGTab(t.id)} style={{
                  padding: "8px 16px", borderRadius: 10, border: "none", cursor: "pointer",
                  background: gTab === t.id ? "#6366f1" : "rgba(255,255,255,0.05)",
                  color: gTab === t.id ? "#fff" : "rgba(255,255,255,0.5)",
                  fontFamily: "Sora, sans-serif", fontSize: 13, fontWeight: gTab === t.id ? 600 : 400,
                }}>{t.icon} {t.label}</button>
              ))}
            </div>

            {/* Professeurs */}
            {gTab === "profs" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                <Card>
                  <SectionTitle title="Ajouter un professeur" icon="➕" />
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <Input placeholder="Nom" value={formProf.nom}
                        onChange={e => setFormProf({...formProf, nom: e.target.value})} />
                      <Input placeholder="Prénom" value={formProf.prenom}
                        onChange={e => setFormProf({...formProf, prenom: e.target.value})} />
                    </div>
                    <Input placeholder="Email" type="email" value={formProf.email}
                      onChange={e => setFormProf({...formProf, email: e.target.value})} />
                    <Input placeholder="Mot de passe" type="password" value={formProf.password}
                      onChange={e => setFormProf({...formProf, password: e.target.value})} />
                    <Btn onClick={addProf}>Créer le compte</Btn>
                  </div>
                </Card>
                <Card>
                  <SectionTitle title={`Professeurs (${profs.filter(p => p.is_active).length} actifs${profs.some(p => !p.is_active) ? ` · ${profs.filter(p => !p.is_active).length} désactivés` : ""})`} icon="👨‍🏫" />
                  {profs.length === 0 ? <EmptyState message="Aucun professeur" /> :
                    profs.map((p, i) => (
                      <div key={i} style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "12px 0", borderBottom: i < profs.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                      }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontWeight: 500, fontSize: 14 }}>{p.prenom} {p.nom}</span>
                            <span style={{
                              fontSize: 10, padding: "2px 7px", borderRadius: 20, fontWeight: 600,
                              background: p.is_active ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
                              color: p.is_active ? "#22c55e" : "#ef4444",
                            }}>{p.is_active ? "Actif" : "Désactivé"}</span>
                          </div>
                          <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, marginTop: 2 }}>
                            {p.email} · {p.nb_matieres} matières
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          {p.is_active ? (
                            <Btn onClick={() => deactivateProf(p.id)} color="#ef4444"
                              style={{ padding: "6px 12px", fontSize: 12 }}>Désactiver</Btn>
                          ) : (
                            <>
                              <Btn onClick={() => reactivateProf(p.id)} color="#22c55e"
                                style={{ padding: "6px 12px", fontSize: 12 }}>Réactiver</Btn>
                              <Btn onClick={() => permanentDeleteProf(p.id)} color="#7f1d1d"
                                style={{ padding: "6px 12px", fontSize: 12 }}>Supprimer</Btn>
                            </>
                          )}
                        </div>
                      </div>
                    ))
                  }
                </Card>
              </div>
            )}

            {/* Matières */}
            {gTab === "matieres" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                <Card>
                  <SectionTitle title="Ajouter une matière" icon="➕" />
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <Input placeholder="Nom de la matière" value={formMat.nom}
                      onChange={e => setFormMat({...formMat, nom: e.target.value})} />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <Input placeholder="Code (ex: BI)" value={formMat.code}
                        onChange={e => setFormMat({...formMat, code: e.target.value})} />
                      <Input placeholder="Coefficient" type="number" value={formMat.coefficient}
                        onChange={e => setFormMat({...formMat, coefficient: e.target.value})} />
                    </div>
                    <Select value={formMat.classe}
                      onChange={e => setFormMat({...formMat, classe: e.target.value})}>
                      {CLASSES.map(c => <option key={c} value={c}>Classe {c}</option>)}
                    </Select>
                    <Select value={formMat.professeur_id}
                      onChange={e => setFormMat({...formMat, professeur_id: e.target.value})}>
                      <option value="">-- Assigner un professeur --</option>
                      {profs.map(p => (
                        <option key={p.id} value={p.id}>{p.prenom} {p.nom}</option>
                      ))}
                    </Select>
                    <Btn onClick={addMat}>Créer la matière</Btn>
                  </div>
                </Card>
                <Card>
                  <SectionTitle title={`Matières (${matieres.length})`} icon="📚" />
                  {matieres.length === 0 ? <EmptyState message="Aucune matière" /> :
                    matieres.map((m, i) => (
                      <div key={i} style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "10px 0", borderBottom: i < matieres.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                      }}>
                        <div>
                          <div style={{ fontWeight: 500, fontSize: 14 }}>
                            {m.nom}
                            <span style={{ marginLeft: 8, color: "#6366f1", fontSize: 11 }}>Coef {m.coefficient}</span>
                          </div>
                          <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>
                            Classe {m.classe} · {m.professeur || "Aucun prof"}
                          </div>
                        </div>
                        <Btn onClick={() => deleteMat(m.id)} color="#ef4444"
                          style={{ padding: "6px 12px", fontSize: 12 }}>Supprimer</Btn>
                      </div>
                    ))
                  }
                </Card>
              </div>
            )}

            {/* Emploi du temps */}
            {gTab === "emplois" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <Card>
                  <SectionTitle title="Ajouter un créneau" icon="➕" />
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                    <Select value={formEmploi.classe}
                      onChange={e => setFormEmploi({...formEmploi, classe: e.target.value})}>
                      {CLASSES.map(c => <option key={c} value={c}>Classe {c}</option>)}
                    </Select>
                    <Select value={formEmploi.jour}
                      onChange={e => setFormEmploi({...formEmploi, jour: e.target.value})}>
                      {JOURS.map(j => <option key={j} value={j}>{j}</option>)}
                    </Select>
                    <Select value={formEmploi.matiere_id}
                      onChange={e => setFormEmploi({...formEmploi, matiere_id: e.target.value})}>
                      <option value="">-- Matière --</option>
                      {matieres.filter(m => m.classe === formEmploi.classe).map(m => (
                        <option key={m.id} value={m.id}>{m.nom}</option>
                      ))}
                    </Select>
                    <Input placeholder="Heure début (08:30)" value={formEmploi.heure_debut}
                      onChange={e => setFormEmploi({...formEmploi, heure_debut: e.target.value})} />
                    <Input placeholder="Heure fin (10:30)" value={formEmploi.heure_fin}
                      onChange={e => setFormEmploi({...formEmploi, heure_fin: e.target.value})} />
                    <Input placeholder="Salle (ex: Salle 15)" value={formEmploi.salle}
                      onChange={e => setFormEmploi({...formEmploi, salle: e.target.value})} />
                  </div>
                  <Btn onClick={addEmploi} style={{ marginTop: 12 }}>Ajouter le créneau</Btn>
                </Card>
                {CLASSES.map(classe => (
                  <Card key={classe}>
                    <SectionTitle title={`Classe ${classe}`} icon="📅" />
                    {!emplois[classe] || emplois[classe].length === 0
                      ? <EmptyState message={`Aucun créneau pour la classe ${classe}`} />
                      : <table style={{ width: "100%", borderCollapse: "collapse" }}>
                          <thead>
                            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                              {["Jour","Matière","Horaire","Salle","Action"].map(h => (
                                <th key={h} style={{ padding: "8px 12px", textAlign: "left",
                                  color: "rgba(255,255,255,0.4)", fontSize: 12 }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {emplois[classe].map((e, i) => (
                              <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                                <td style={{ padding: "8px 12px", fontSize: 13 }}>{e.jour}</td>
                                <td style={{ padding: "8px 12px", fontSize: 13, fontWeight: 500 }}>{e.matiere}</td>
                                <td style={{ padding: "8px 12px", fontSize: 12,
                                  color: "rgba(255,255,255,0.5)" }}>{e.heure_debut} → {e.heure_fin}</td>
                                <td style={{ padding: "8px 12px", fontSize: 12,
                                  color: "rgba(255,255,255,0.5)" }}>{e.salle || "-"}</td>
                                <td style={{ padding: "8px 12px" }}>
                                  <Btn onClick={() => deleteEmploi(e.id)} color="#ef4444"
                                    style={{ padding: "4px 10px", fontSize: 11 }}>Supprimer</Btn>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                    }
                  </Card>
                ))}
              </div>
            )}

            {/* Étudiants */}
            {gTab === "etudiants" && (
              <Card>
                <SectionTitle title={`Étudiants (${etudiants.length})`} icon="🎓" />
                {etudiants.length === 0 ? <EmptyState message="Aucun étudiant" /> :
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                        {["Photo","Étudiant","Classe","Email","Enrôlement","Compte","Actions"].map(h => (
                          <th key={h} style={{ padding: "10px 12px", textAlign: "left",
                            color: "rgba(255,255,255,0.4)", fontSize: 12 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {etudiants.map((s, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                          <td style={{ padding: "10px 12px" }}>
                            <div style={{ width: 36, height: 36, borderRadius: "50%",
                              background: "linear-gradient(135deg,#6366f1,#a855f7)",
                              overflow: "hidden", display: "flex", alignItems: "center",
                              justifyContent: "center", fontSize: 16 }}>
                              {s.photo_url
                                ? <img src={s.photo_url} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                                : "🎓"}
                            </div>
                          </td>
                          <td style={{ padding: "10px 12px", fontSize: 14 }}>{s.prenom} {s.nom}</td>
                          <td style={{ padding: "10px 12px" }}>
                            <span style={{ background: "rgba(99,102,241,0.15)", color: "#6366f1",
                              padding: "2px 8px", borderRadius: 6, fontSize: 12 }}>Classe {s.classe}</span>
                          </td>
                          <td style={{ padding: "10px 12px", fontSize: 12,
                            color: "rgba(255,255,255,0.4)" }}>{s.email}</td>
                          <td style={{ padding: "10px 12px" }}>
                            <span style={{
                              background: s.is_enrolled ? "rgba(34,197,94,0.15)" : "rgba(245,158,11,0.15)",
                              color: s.is_enrolled ? "#22c55e" : "#f59e0b",
                              padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                            }}>{s.is_enrolled ? "Enrôlé" : "Non enrôlé"}</span>
                          </td>
                          <td style={{ padding: "10px 12px" }}>
                            {s.has_account ? (
                              <span style={{
                                fontSize: 11, padding: "2px 8px", borderRadius: 6, fontWeight: 600,
                                background: s.account_active ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
                                color: s.account_active ? "#22c55e" : "#ef4444",
                              }}>{s.account_active ? "Actif" : "Désactivé"}</span>
                            ) : (
                              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>Aucun compte</span>
                            )}
                          </td>
                          <td style={{ padding: "10px 12px" }}>
                            <div style={{ display: "flex", gap: 6 }}>
                              {s.has_account && s.account_active && (
                                <Btn onClick={() => deactivateEtudiant(s.id)} color="#ef4444"
                                  style={{ padding: "5px 10px", fontSize: 11 }}>Désactiver</Btn>
                              )}
                              {s.has_account && !s.account_active && (
                                <Btn onClick={() => reactivateEtudiant(s.id)} color="#22c55e"
                                  style={{ padding: "5px 10px", fontSize: 11 }}>Réactiver</Btn>
                              )}
                              <Btn onClick={() => deleteEtudiant(s.id)} color="#7f1d1d"
                                style={{ padding: "5px 10px", fontSize: 11 }}>Supprimer</Btn>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                }
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}