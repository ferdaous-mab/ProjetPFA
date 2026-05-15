import { useState, useEffect } from "react";
import axios from "axios";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell,
} from "recharts";
import VoiceAssistant from "../components/VoiceAssistant";

const API_URL = "";
const COLORS  = ["#6366f1", "#ef4444", "#f59e0b", "#22c55e"];
const JOURS   = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const NIVEAUX = [
  { label: "1ère Année",  classes: ["1A", "1B", "1C"] },
  { label: "2ème Année",  classes: ["2A", "2B", "2C"] },
  { label: "3ème Année",  classes: ["3A", "3B", "3C"] },
];
const CLASSES = NIVEAUX.flatMap(n => n.classes);
const getNiveau = (classe) => NIVEAUX.find(n => n.classes.includes(classe))?.label || "Autre";

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
  const [formProf,  setFormProf]  = useState({ nom:"", prenom:"", email:"" });
  const [createdPassword, setCreatedPassword] = useState("");
  const [resetPasswords, setResetPasswords] = useState({});  // { prof_id: "generated_password" }
  const [formMat,   setFormMat]   = useState({ nom:"", code:"", coefficient:"1", annee_scolaire:"2025-2026", niveau:"1ère Année", classe:"1A", professeur_id:"" });
  const [formEmploi,setFormEmploi]= useState({ matiere_id:"", niveau:"1ère Année", classe:"1A", jour:"Lundi", heure_debut:"08:30", heure_fin:"10:30", salle:"" });
  const [msg,       setMsg]       = useState("");

  // Modal étudiant
  const [selectedEtudiant, setSelectedEtudiant] = useState(null);
  const [editForm,          setEditForm]          = useState({});
  const [editLoading,       setEditLoading]       = useState(false);

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
    const [pr, mt, em, et] = await Promise.allSettled([
      axios.get(`${API_URL}/api/gestion/professeurs`, authHeaders()),
      axios.get(`${API_URL}/api/gestion/matieres`,    authHeaders()),
      axios.get(`${API_URL}/api/gestion/emplois`,     authHeaders()),
      axios.get(`${API_URL}/api/gestion/etudiants`,   authHeaders()),
    ]);
    if (pr.status === "fulfilled") setProfs(pr.value.data);
    else console.error("Profs:", pr.reason);
    if (mt.status === "fulfilled") setMatieres(mt.value.data);
    else console.error("Matieres:", mt.reason);
    if (em.status === "fulfilled") setEmplois(em.value.data);
    else console.error("Emplois:", em.reason);
    if (et.status === "fulfilled") setEtudiants(et.value.data);
    else console.error("Etudiants:", et.reason);
  };

  const showMsg = (m) => { setMsg(m); setTimeout(() => setMsg(""), 3000); };

  const openEtudiant = (s) => {
    setSelectedEtudiant(s);
    setEditForm({
      nom: s.nom, prenom: s.prenom, email: s.email,
      classe: s.classe, annee_scolaire: s.annee_scolaire || "",
      telephone: s.telephone || "", date_naissance: s.date_naissance || "",
      lieu_naissance: s.lieu_naissance || "", sexe: s.sexe || "",
      adresse: s.adresse || "", ville: s.ville || "",
      cin: s.cin || "", numero_carte: s.numero_carte || "",
      nom_pere: s.nom_pere || "", tel_pere: s.tel_pere || "",
      nom_mere: s.nom_mere || "", tel_mere: s.tel_mere || "",
      email_parent: s.email_parent || "",
    });
  };

  const saveEtudiant = async () => {
    setEditLoading(true);
    try {
      await axios.put(`${API_URL}/api/gestion/etudiants/${selectedEtudiant.id}`, editForm, authHeaders());
      showMsg("✅ Étudiant mis à jour !");
      await loadGestion();
      setSelectedEtudiant(prev => ({ ...prev, ...editForm }));
    } catch (e) { showMsg("❌ " + (e.response?.data?.detail || "Erreur")); }
    finally { setEditLoading(false); }
  };

  const addProf = async () => {
    try {
      const res = await axios.post(`${API_URL}/api/gestion/professeurs`, formProf, authHeaders());
      setCreatedPassword(res.data.temp_password || "");
      showMsg("✅ Professeur créé !");
      setFormProf({ nom:"", prenom:"", email:"" });
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

  const resetProfPassword = async (id, nom, prenom) => {
    if (!confirm(`Réinitialiser le mot de passe de ${prenom} ${nom} ? Le professeur devra utiliser le nouveau mot de passe.`)) return;
    try {
      const res = await axios.post(`${API_URL}/api/gestion/professeurs/${id}/reset-password`, {}, authHeaders());
      setResetPasswords(prev => ({ ...prev, [id]: res.data.password }));
    } catch { showMsg("❌ Erreur lors de la réinitialisation"); }
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
      setFormMat({ nom:"", code:"", coefficient:"1", annee_scolaire:"2025-2026", niveau:"1ère Année", classe:"1A", professeur_id:"" });
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

      {/* Modal Étudiant */}
      {selectedEtudiant && (() => {
        const s  = selectedEtudiant;
        const ef = editForm;
        const set = (k, v) => setEditForm(f => ({ ...f, [k]: v }));
        const LBL = ({ children }) => (
          <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.3)",
            letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 5 }}>{children}</div>
        );
        const SECTION = ({ title, icon }) => (
          <div style={{ display: "flex", alignItems: "center", gap: 8,
            margin: "22px 0 14px", paddingBottom: 8,
            borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            <span style={{ fontSize: 15 }}>{icon}</span>
            <span style={{ fontWeight: 600, fontSize: 13, color: "rgba(255,255,255,0.7)" }}>{title}</span>
          </div>
        );
        return (
          <div onClick={() => setSelectedEtudiant(null)} style={{
            position: "fixed", inset: 0, zIndex: 200,
            background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
          }}>
            <div onClick={e => e.stopPropagation()} style={{
              background: "#0b0b18", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 20, width: "100%", maxWidth: 700,
              maxHeight: "92vh", overflowY: "auto",
              boxShadow: "0 32px 100px rgba(0,0,0,0.7)",
            }}>

              {/* ── En-tête ── */}
              <div style={{
                padding: "22px 28px 18px", borderBottom: "1px solid rgba(255,255,255,0.07)",
                display: "flex", alignItems: "center", gap: 16, position: "sticky", top: 0,
                background: "#0b0b18", zIndex: 10,
              }}>
                <div style={{
                  width: 60, height: 60, borderRadius: 14, flexShrink: 0,
                  background: "linear-gradient(135deg,#6366f1,#a855f7)",
                  overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26,
                }}>
                  {s.photo_url
                    ? <img src={s.photo_url} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                    : "🎓"}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{s.prenom} {s.nom}</div>
                  <div style={{ display: "flex", gap: 7, marginTop: 6, flexWrap: "wrap" }}>
                    {[
                      { label: `Classe ${s.classe}`, color: "#6366f1" },
                      { label: s.annee_scolaire || "—", color: "#0ea5e9" },
                      { label: s.is_enrolled ? "✓ Enrôlé" : "Non enrôlé",
                        color: s.is_enrolled ? "#22c55e" : "#f59e0b" },
                      s.has_account && { label: s.account_active ? "Compte actif" : "Compte désactivé",
                        color: s.account_active ? "#22c55e" : "#ef4444" },
                    ].filter(Boolean).map((b, i) => (
                      <span key={i} style={{ background: `${b.color}20`, color: b.color,
                        fontSize: 11, padding: "2px 9px", borderRadius: 20, fontWeight: 600 }}>{b.label}</span>
                    ))}
                  </div>
                </div>
                <button onClick={() => setSelectedEtudiant(null)} style={{
                  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8, color: "rgba(255,255,255,0.5)", cursor: "pointer",
                  width: 32, height: 32, fontSize: 16, display: "flex",
                  alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>✕</button>
              </div>

              {/* ── Corps ── */}
              <div style={{ padding: "4px 28px 28px" }}>

                {/* Stats */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginTop: 20 }}>
                  {[
                    { label: "Taux présence", value: `${s.taux_presence || 0}%`,
                      color: (s.taux_presence||0) >= 75 ? "#22c55e" : (s.taux_presence||0) >= 50 ? "#f59e0b" : "#ef4444" },
                    { label: "Absences", value: s.absences || 0,
                      color: (s.absences||0) > 5 ? "#ef4444" : (s.absences||0) > 2 ? "#f59e0b" : "#22c55e" },
                    { label: "Moyenne générale", value: (s.moyenne||0) > 0 ? `${s.moyenne}/20` : "—",
                      color: (s.moyenne||0) >= 14 ? "#22c55e" : (s.moyenne||0) >= 10 ? "#f59e0b" : "#ef4444" },
                  ].map(st => (
                    <div key={st.label} style={{ background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12,
                      padding: "14px 12px", textAlign: "center" }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: st.color }}>{st.value}</div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 3 }}>{st.label}</div>
                    </div>
                  ))}
                </div>
                {s.date_inscription && (
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", marginTop: 10 }}>
                    Inscrit le {s.date_inscription} · N° carte : {s.numero_carte || "—"} · CIN : {s.cin || "—"}
                  </div>
                )}

                {/* ─── Infos étudiant (lecture seule pour l'admin) ─── */}
                <div style={{ marginTop: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12,
                    paddingBottom: 8, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <span style={{ fontSize: 14 }}>👤</span>
                    <span style={{ fontWeight: 600, fontSize: 13, color: "rgba(255,255,255,0.5)" }}>Informations étudiant</span>
                    <span style={{ marginLeft: "auto", fontSize: 10, color: "rgba(255,255,255,0.25)",
                      background: "rgba(255,255,255,0.05)", padding: "2px 8px",
                      borderRadius: 20, fontWeight: 600, letterSpacing: "0.06em" }}>MODIFIABLES PAR L'ÉTUDIANT</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                    {[
                      ["Nom",              s.nom],
                      ["Prénom",           s.prenom],
                      ["Email",            s.email],
                      ["Téléphone",        s.telephone],
                      ["Adresse",          s.adresse],
                      ["Ville",            s.ville],
                      ["Date naissance",   s.date_naissance],
                      ["Lieu naissance",   s.lieu_naissance],
                      ["Sexe",             s.sexe === "M" ? "Masculin" : s.sexe === "F" ? "Féminin" : null],
                      ["CIN",              s.cin],
                      ["Classe",           s.classe],
                      ["Année scolaire",   s.annee_scolaire],
                      ["N° Carte étudiant",s.numero_carte],
                    ].map(([label, val]) => (
                      <div key={label}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.25)",
                          letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
                        <div style={{ padding: "8px 12px", background: "rgba(255,255,255,0.02)",
                          border: "1px solid rgba(255,255,255,0.05)", borderRadius: 8,
                          fontSize: 12, color: val ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.18)",
                          minHeight: 34, display: "flex", alignItems: "center" }}>
                          {val || "—"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ─── Section parents : Admin uniquement ─── */}
                <div style={{
                  marginTop: 22, padding: "16px 18px",
                  background: "rgba(245,158,11,0.05)",
                  border: "1px solid rgba(245,158,11,0.2)",
                  borderRadius: 12,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                    <span style={{ fontSize: 15 }}>🔒</span>
                    <span style={{ fontWeight: 600, fontSize: 13, color: "#f59e0b" }}>
                      Informations des parents
                    </span>
                    <span style={{
                      marginLeft: "auto", fontSize: 10, fontWeight: 600,
                      background: "rgba(245,158,11,0.15)", color: "#f59e0b",
                      padding: "2px 8px", borderRadius: 20, letterSpacing: "0.06em",
                    }}>ADMIN UNIQUEMENT</span>
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginBottom: 6, fontWeight: 600 }}>
                      PÈRE — NOM & PRÉNOM
                    </div>
                    <Input value={ef.nom_pere || ""} placeholder="Mohamed Benali" onChange={e => set("nom_pere", e.target.value)} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginBottom: 6, fontWeight: 600 }}>PÈRE — TÉLÉPHONE</div>
                      <Input value={ef.tel_pere || ""} placeholder="06 XX XX XX XX" onChange={e => set("tel_pere", e.target.value)} />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginBottom: 6, fontWeight: 600 }}>MÈRE — TÉLÉPHONE</div>
                      <Input value={ef.tel_mere || ""} placeholder="06 XX XX XX XX" onChange={e => set("tel_mere", e.target.value)} />
                    </div>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginBottom: 6, fontWeight: 600 }}>MÈRE — NOM & PRÉNOM</div>
                    <Input value={ef.nom_mere || ""} placeholder="Fatima Benali" onChange={e => set("nom_mere", e.target.value)} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginBottom: 6, fontWeight: 600 }}>EMAIL PARENT</div>
                    <Input value={ef.email_parent || ""} placeholder="parent@gmail.com" type="email" onChange={e => set("email_parent", e.target.value)} />
                  </div>
                </div>

                {/* ─── Boutons ─── */}
                <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
                  <Btn onClick={saveEtudiant} style={{ flex: 1, padding: "11px", opacity: editLoading ? 0.6 : 1 }}>
                    {editLoading ? "Enregistrement..." : "💾 Enregistrer les modifications"}
                  </Btn>
                  <Btn onClick={() => setSelectedEtudiant(null)} color="rgba(255,255,255,0.06)"
                    style={{ padding: "11px 22px", color: "rgba(255,255,255,0.5)" }}>
                    Annuler
                  </Btn>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Voice Assistant Modal */}
      {showVoice && (
        <VoiceAssistant
          onClose={() => setShowVoice(false)}
          chatEndpoint="/api/voice/command"
          suggestions={[
            "Taux de présence global ?",
            "Ajoute prof Ahmed Benali, email a@esisa.ma, mdp Prof123",
            "Crée la matière Maths pour classe A",
            "Désactive le prof Benali",
            "Étudiants à risque ?",
            "Résumé de la plateforme",
          ]}
        />
      )}

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
                      {["Étudiant","Classe","Année scolaire","Absences","Taux"].map(h => (
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
                        <td style={{ padding: "10px 12px" }}>
                          <span style={{ background: "rgba(14,165,233,0.12)", color: "#0ea5e9",
                            padding: "2px 8px", borderRadius: 6, fontSize: 12 }}>
                            {s.annee_scolaire || "—"}
                          </span>
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
                    <div style={{ fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                      {s.prenom} {s.nom}
                      <span style={{ background: "rgba(99,102,241,0.15)",
                        color: "#6366f1", fontSize: 11, padding: "2px 8px", borderRadius: 6 }}>
                        Classe {s.classe}
                      </span>
                      {s.annee_scolaire && (
                        <span style={{ background: "rgba(14,165,233,0.12)",
                          color: "#0ea5e9", fontSize: 11, padding: "2px 8px", borderRadius: 6 }}>
                          {s.annee_scolaire}
                        </span>
                      )}
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
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", padding: "4px 0" }}>
                      Un mot de passe temporaire sera généré automatiquement
                    </div>
                    <Btn onClick={addProf}>Créer le compte</Btn>
                    {createdPassword && (
                      <div style={{
                        background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)",
                        borderRadius: 10, padding: "12px 14px",
                      }}>
                        <div style={{ fontSize: 12, color: "#22c55e", fontWeight: 600, marginBottom: 4 }}>
                          Mot de passe temporaire généré
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <code style={{
                            fontSize: 15, fontWeight: 700, color: "#fff",
                            background: "rgba(255,255,255,0.06)", padding: "4px 10px",
                            borderRadius: 6, letterSpacing: 1, flex: 1,
                          }}>{createdPassword}</code>
                          <button onClick={() => { navigator.clipboard.writeText(createdPassword); }} style={{
                            background: "rgba(99,102,241,0.2)", border: "1px solid rgba(99,102,241,0.4)",
                            borderRadius: 6, color: "#a5b4fc", cursor: "pointer",
                            padding: "4px 10px", fontSize: 11, fontFamily: "Sora, sans-serif",
                          }}>Copier</button>
                          <button onClick={() => setCreatedPassword("")} style={{
                            background: "transparent", border: "none",
                            color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: 16,
                          }}>✕</button>
                        </div>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 6 }}>
                          Transmettez ce mot de passe au professeur. Il pourra le modifier depuis son dashboard.
                        </div>
                      </div>
                    )}
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
                        <div style={{ flex: 1 }}>
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
                          {resetPasswords[p.id] && (
                            <div style={{
                              display: "inline-flex", alignItems: "center", gap: 8,
                              marginTop: 6, background: "rgba(245,158,11,0.1)",
                              border: "1px solid rgba(245,158,11,0.3)",
                              borderRadius: 8, padding: "6px 10px",
                            }}>
                              <span style={{ fontSize: 11, color: "#f59e0b", fontWeight: 600 }}>Nouveau mdp (affiché une seule fois) :</span>
                              <code style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: 1 }}>
                                {resetPasswords[p.id]}
                              </code>
                              <button onClick={() => navigator.clipboard.writeText(resetPasswords[p.id])}
                                style={{ background: "none", border: "none", cursor: "pointer", color: "#f59e0b", fontSize: 13 }}>📋</button>
                              <button onClick={() => setResetPasswords(prev => { const n = {...prev}; delete n[p.id]; return n; })}
                                style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", fontSize: 14 }}>✕</button>
                            </div>
                          )}
                        </div>
                        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                          <Btn onClick={() => resetProfPassword(p.id, p.nom, p.prenom)}
                            color="rgba(245,158,11,0.2)"
                            style={{ padding: "6px 12px", fontSize: 12, border: "1px solid rgba(245,158,11,0.4)", color: "#f59e0b" }}>
                            Réinitialiser mdp
                          </Btn>
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
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                      <Input placeholder="Code (ex: BI)" value={formMat.code}
                        onChange={e => setFormMat({...formMat, code: e.target.value})} />
                      <Input placeholder="Coefficient" type="number" value={formMat.coefficient}
                        onChange={e => setFormMat({...formMat, coefficient: e.target.value})} />
                      <Input placeholder="Année (ex: 2025-2026)" value={formMat.annee_scolaire}
                        onChange={e => setFormMat({...formMat, annee_scolaire: e.target.value})} />
                    </div>
                    <Select value={formMat.niveau}
                      onChange={e => {
                        const nv = NIVEAUX.find(n => n.label === e.target.value);
                        setFormMat({...formMat, niveau: e.target.value, classe: nv?.classes[0] || ""});
                      }}>
                      {NIVEAUX.map(n => <option key={n.label} value={n.label}>{n.label}</option>)}
                    </Select>
                    <Select value={formMat.classe}
                      onChange={e => setFormMat({...formMat, classe: e.target.value})}>
                      {(NIVEAUX.find(n => n.label === formMat.niveau)?.classes || []).map(c => (
                        <option key={c} value={c}>Classe {c}</option>
                      ))}
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
                    NIVEAUX.map(nv => {
                      const matieresDuNiveau = matieres.filter(m => nv.classes.includes(m.classe));
                      if (matieresDuNiveau.length === 0) return null;
                      return (
                        <div key={nv.label}>
                          <div style={{
                            fontSize: 11, fontWeight: 700, color: "#6366f1",
                            letterSpacing: "0.06em", textTransform: "uppercase",
                            margin: "14px 0 6px", padding: "4px 8px",
                            background: "rgba(99,102,241,0.08)", borderRadius: 6,
                            display: "inline-block",
                          }}>{nv.label}</div>
                          {matieresDuNiveau.map((m, i) => (
                            <div key={i} style={{
                              display: "flex", alignItems: "center", justifyContent: "space-between",
                              padding: "10px 0",
                              borderBottom: i < matieresDuNiveau.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                            }}>
                              <div>
                                <div style={{ fontWeight: 500, fontSize: 14 }}>
                                  {m.nom}
                                  <span style={{ marginLeft: 8, color: "#6366f1", fontSize: 11 }}>Coef {m.coefficient}</span>
                                </div>
                                <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>
                                  Classe {m.classe}
                                  {m.annee_scolaire && (
                                    <span style={{ marginLeft: 6, background: "rgba(14,165,233,0.15)",
                                      color: "#0ea5e9", padding: "1px 6px", borderRadius: 4, fontSize: 11 }}>
                                      {m.annee_scolaire}
                                    </span>
                                  )}
                                  {" · "}{m.professeur || "Aucun prof"}
                                </div>
                              </div>
                              <Btn onClick={() => deleteMat(m.id)} color="#ef4444"
                                style={{ padding: "6px 12px", fontSize: 12 }}>Supprimer</Btn>
                            </div>
                          ))}
                        </div>
                      );
                    })
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
                    <Select value={formEmploi.niveau}
                      onChange={e => {
                        const nv = NIVEAUX.find(n => n.label === e.target.value);
                        setFormEmploi({...formEmploi, niveau: e.target.value, classe: nv?.classes[0] || "", matiere_id: ""});
                      }}>
                      {NIVEAUX.map(n => <option key={n.label} value={n.label}>{n.label}</option>)}
                    </Select>
                    <Select value={formEmploi.classe}
                      onChange={e => setFormEmploi({...formEmploi, classe: e.target.value, matiere_id: ""})}>
                      {(NIVEAUX.find(n => n.label === formEmploi.niveau)?.classes || []).map(c => (
                        <option key={c} value={c}>Classe {c}</option>
                      ))}
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
                      onChange={e => setFormEmploi({...formEmploi, salle: e.target.value})} style={{ gridColumn: "1 / -1" }} />
                  </div>
                  <Btn onClick={addEmploi} style={{ marginTop: 12 }}>Ajouter le créneau</Btn>
                </Card>
                {NIVEAUX.map(nv => (
                  <div key={nv.label}>
                    <div style={{
                      fontSize: 13, fontWeight: 700, color: "#6366f1",
                      margin: "4px 0 12px", display: "flex", alignItems: "center", gap: 8,
                    }}>
                      <div style={{ flex: 1, height: 1, background: "rgba(99,102,241,0.2)" }} />
                      {nv.label}
                      <div style={{ flex: 1, height: 1, background: "rgba(99,102,241,0.2)" }} />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {nv.classes.map(classe => (
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
                  </div>
                ))}
              </div>
            )}

            {/* Étudiants */}
            {gTab === "etudiants" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Statistiques globales */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
                  <StatCard icon="🎓" label="Total étudiants" color="#6366f1"
                    value={etudiants.length} />
                  <StatCard icon="✅" label="Enrôlés" color="#22c55e"
                    value={etudiants.filter(e => e.is_enrolled).length} />
                  <StatCard icon="👤" label="Avec compte" color="#0ea5e9"
                    value={etudiants.filter(e => e.has_account).length} />
                  <StatCard icon="📊" label="Présence moy." color="#f59e0b"
                    value={etudiants.length
                      ? `${Math.round(etudiants.reduce((s, e) => s + (e.taux_presence || 0), 0) / etudiants.length)}%`
                      : "—"} />
                  <StatCard icon="📝" label="Moyenne gén." color="#a855f7"
                    value={etudiants.length
                      ? `${(etudiants.reduce((s, e) => s + (e.moyenne || 0), 0) / etudiants.length).toFixed(1)}/20`
                      : "—"} />
                </div>

                <Card>
                  <SectionTitle title={`Étudiants (${etudiants.length})`} icon="🎓" />
                  {etudiants.length === 0 ? <EmptyState message="Aucun étudiant" /> :
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
                        <thead>
                          <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                            {["Photo","Étudiant","Classe / Année","Contact","Enrôlement","Présence","Absences","Moyenne","Compte","Actions"].map(h => (
                              <th key={h} style={{ padding: "10px 10px", textAlign: "left",
                                color: "rgba(255,255,255,0.4)", fontSize: 11, whiteSpace: "nowrap" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {etudiants.map((s, i) => (
                            <tr key={i} onClick={() => openEtudiant(s)} style={{
                              borderBottom: "1px solid rgba(255,255,255,0.04)",
                              cursor: "pointer", transition: "background 0.15s",
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = "rgba(99,102,241,0.06)"}
                            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                              {/* Photo */}
                              <td style={{ padding: "10px 10px" }}>
                                <div style={{ width: 38, height: 38, borderRadius: "50%",
                                  background: "linear-gradient(135deg,#6366f1,#a855f7)",
                                  overflow: "hidden", display: "flex", alignItems: "center",
                                  justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
                                  {s.photo_url
                                    ? <img src={s.photo_url} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                                    : "🎓"}
                                </div>
                              </td>

                              {/* Nom + date inscription */}
                              <td style={{ padding: "10px 10px" }}>
                                <div style={{ fontWeight: 600, fontSize: 13 }}>{s.prenom} {s.nom}</div>
                                {s.date_inscription && (
                                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>
                                    Inscrit le {s.date_inscription}
                                  </div>
                                )}
                              </td>

                              {/* Classe + Année */}
                              <td style={{ padding: "10px 10px" }}>
                                <span style={{ background: "rgba(99,102,241,0.15)", color: "#6366f1",
                                  padding: "2px 8px", borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
                                  {s.classe}
                                </span>
                                {s.annee_scolaire && (
                                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 3 }}>
                                    {s.annee_scolaire}
                                  </div>
                                )}
                              </td>

                              {/* Email */}
                              <td style={{ padding: "10px 10px", fontSize: 12,
                                color: "rgba(255,255,255,0.5)", maxWidth: 180, overflow: "hidden",
                                textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {s.email}
                              </td>

                              {/* Enrôlement */}
                              <td style={{ padding: "10px 10px" }}>
                                <span style={{
                                  background: s.is_enrolled ? "rgba(34,197,94,0.15)" : "rgba(245,158,11,0.15)",
                                  color: s.is_enrolled ? "#22c55e" : "#f59e0b",
                                  padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                                }}>{s.is_enrolled ? "✓ Enrôlé" : "Non enrôlé"}</span>
                              </td>

                              {/* Taux présence */}
                              <td style={{ padding: "10px 10px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  <div style={{ width: 50, height: 5, background: "rgba(255,255,255,0.08)", borderRadius: 3 }}>
                                    <div style={{
                                      width: `${s.taux_presence || 0}%`, height: "100%", borderRadius: 3,
                                      background: (s.taux_presence || 0) >= 75 ? "#22c55e"
                                        : (s.taux_presence || 0) >= 50 ? "#f59e0b" : "#ef4444",
                                    }} />
                                  </div>
                                  <span style={{ fontSize: 12, fontWeight: 600,
                                    color: (s.taux_presence || 0) >= 75 ? "#22c55e"
                                      : (s.taux_presence || 0) >= 50 ? "#f59e0b" : "#ef4444" }}>
                                    {s.taux_presence || 0}%
                                  </span>
                                </div>
                              </td>

                              {/* Absences */}
                              <td style={{ padding: "10px 10px" }}>
                                <span style={{
                                  fontWeight: 700, fontSize: 14,
                                  color: (s.absences || 0) > 5 ? "#ef4444"
                                    : (s.absences || 0) > 2 ? "#f59e0b" : "rgba(255,255,255,0.6)",
                                }}>{s.absences || 0}</span>
                              </td>

                              {/* Moyenne */}
                              <td style={{ padding: "10px 10px" }}>
                                <span style={{
                                  fontWeight: 700, fontSize: 14,
                                  color: (s.moyenne || 0) >= 14 ? "#22c55e"
                                    : (s.moyenne || 0) >= 10 ? "#f59e0b" : "#ef4444",
                                }}>
                                  {s.moyenne > 0 ? `${s.moyenne}/20` : "—"}
                                </span>
                              </td>

                              {/* Compte */}
                              <td style={{ padding: "10px 10px" }}>
                                {s.has_account ? (
                                  <span style={{
                                    fontSize: 11, padding: "3px 8px", borderRadius: 6, fontWeight: 600,
                                    background: s.account_active ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
                                    color: s.account_active ? "#22c55e" : "#ef4444",
                                  }}>{s.account_active ? "Actif" : "Désactivé"}</span>
                                ) : (
                                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)" }}>—</span>
                                )}
                              </td>

                              {/* Actions */}
                              <td style={{ padding: "10px 10px" }} onClick={e => e.stopPropagation()}>
                                <div style={{ display: "flex", gap: 5 }}>
                                  {s.has_account && s.account_active && (
                                    <Btn onClick={() => deactivateEtudiant(s.id)} color="#ef4444"
                                      style={{ padding: "4px 9px", fontSize: 11 }}>Désactiver</Btn>
                                  )}
                                  {s.has_account && !s.account_active && (
                                    <Btn onClick={() => reactivateEtudiant(s.id)} color="#22c55e"
                                      style={{ padding: "4px 9px", fontSize: 11 }}>Réactiver</Btn>
                                  )}
                                  <Btn onClick={() => deleteEtudiant(s.id)} color="#7f1d1d"
                                    style={{ padding: "4px 9px", fontSize: 11 }}>Supprimer</Btn>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  }
                </Card>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}