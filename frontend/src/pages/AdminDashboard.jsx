import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useBreakpoint } from "../utils/useBreakpoint";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell,
} from "recharts";
import VoiceAssistant from "../components/VoiceAssistant";

const API_URL = "";
const COLORS  = ["#6366f1", "#ef4444", "#f59e0b", "#22c55e"];
const JOURS   = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const NIVEAUX = ["1ère année", "2ème année", "3ème année", "4ème année", "5ème année"];
const GROUPES = ["A", "B", "C", "D"];

const F = "'Inter', -apple-system, sans-serif";

function authHeaders() {
  const token = localStorage.getItem("token");
  return { headers: { Authorization: `Bearer ${token}` } };
}

function Card({ children, style = {} }) {
  return (
    <div className="sc-card" style={{
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 12, padding: "20px 24px", ...style,
    }}>{children}</div>
  );
}

function SectionTitle({ title, icon }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
      <div style={{ width: 3, height: 18, borderRadius: 2, background: "#6366f1", flexShrink: 0 }} />
      <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.85)", letterSpacing: "0.01em" }}>{title}</span>
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div style={{ textAlign: "center", padding: "40px 20px", color: "rgba(255,255,255,0.2)" }}>
      <div style={{ width: 36, height: 36, borderRadius: "50%",
        background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
        margin: "0 auto 12px", display: "flex", alignItems: "center",
        justifyContent: "center", fontSize: 16, color: "rgba(255,255,255,0.15)" }}>—</div>
      <div style={{ fontSize: 13, fontWeight: 500 }}>{message}</div>
    </div>
  );
}

function StatCard({ icon, label, value, sub, color, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 14, padding: "18px 18px 16px",
        position: "relative", overflow: "hidden",
        cursor: onClick ? "pointer" : "default",
        transition: "border-color .2s, transform .18s, box-shadow .2s",
      }}
      onMouseEnter={e => {
        if (!onClick) return;
        e.currentTarget.style.borderColor = `${color}55`;
        e.currentTarget.style.transform = "translateY(-3px)";
        e.currentTarget.style.boxShadow = `0 10px 32px ${color}22`;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      {/* Glow de fond */}
      <div style={{ position: "absolute", top: -12, right: -12, width: 72, height: 72, borderRadius: "50%", background: `${color}20`, filter: "blur(18px)", pointerEvents: "none" }} />

      {/* Ligne haute : icône + valeur */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{
          width: 42, height: 42, borderRadius: 12, flexShrink: 0,
          background: `${color}18`, border: `1px solid ${color}35`,
          display: "flex", alignItems: "center", justifyContent: "center",
          color, boxShadow: `0 0 0 4px ${color}0a`,
        }}>{icon}</div>
        <div style={{ fontSize: 30, fontWeight: 800, color: "#f1f5f9", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{value}</div>
      </div>

      <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.38)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
      {sub && <div style={{ fontSize: 11.5, color, marginTop: 5, fontWeight: 700 }}>{sub}</div>}

      {/* Flèche indicateur si cliquable */}
      {onClick && (
        <div style={{ position: "absolute", bottom: 10, right: 12, fontSize: 10, color: `${color}80`, fontWeight: 700 }}>→</div>
      )}
    </div>
  );
}

function Input({ placeholder, value, onChange, type = "text", style = {} }) {
  return (
    <input type={type} placeholder={placeholder} value={value} onChange={onChange}
      className="sc-input"
      style={{
        width: "100%", padding: "9px 13px",
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.09)",
        borderRadius: 8, color: "#f1f5f9", fontSize: 13,
        fontFamily: F, outline: "none",
        boxSizing: "border-box", ...style,
      }} />
  );
}

function Select({ value, onChange, children, style = {} }) {
  return (
    <select value={value} onChange={onChange} className="sc-select" style={{
      width: "100%", padding: "9px 13px",
      background: "#0a0a16", border: "1px solid rgba(255,255,255,0.09)",
      borderRadius: 8, color: "#f1f5f9", fontSize: 13,
      fontFamily: F, outline: "none",
      boxSizing: "border-box", ...style,
    }}>{children}</select>
  );
}

function Btn({ onClick, children, color = "#6366f1", style = {}, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} className="sc-btn" style={{
      padding: "8px 16px", border: "none", borderRadius: 7,
      background: color, color: "#fff", cursor: disabled ? "not-allowed" : "pointer",
      fontFamily: F, fontSize: 12, fontWeight: 600,
      opacity: disabled ? 0.5 : 1, ...style,
    }}>{children}</button>
  );
}

export default function AdminDashboard({ user, onLogout, onOpenMessages }) {
  const bp = useBreakpoint();
  const [overview,    setOverview]    = useState(null);
  const [presClasse,  setPresClasse]  = useState([]);
  const [presMat,     setPresMat]     = useState([]);
  const [evolution,   setEvolution]   = useState([]);
  const [repartition, setRepartition] = useState(null);
  const [risque,      setRisque]      = useState([]);
  const [risqueAll,   setRisqueAll]   = useState([]);
  const [alertesAll,  setAlertesAll]  = useState([]);
  const [topAbsences, setTopAbsences] = useState([]);
  const [notesMat,    setNotesMat]    = useState([]);
  const [alertes,     setAlertes]     = useState([]);
  const [prediction,  setPrediction]  = useState(null);
  const [predLoading, setPredLoading] = useState(false);
  const [biLoading,   setBiLoading]   = useState(false);
  const [activeTab,   setActiveTab]   = useState("overview");
  const [showVoice,   setShowVoice]   = useState(false);

  // Gestion state
  const [profs,     setProfs]     = useState([]);
  const [matieres,  setMatieres]  = useState([]);
  const [emplois,   setEmplois]   = useState([]);
  const [etudiants, setEtudiants] = useState([]);
  const [gTab,      setGTab]      = useState("profs");
  const [formProf,  setFormProf]  = useState({ nom:"", prenom:"", email:"" });
  const [createdPassword, setCreatedPassword] = useState("");
  const [resetPasswords, setResetPasswords] = useState({});  // { prof_id: "generated_password" }
  const [formMat,   setFormMat]   = useState({ nom:"", code:"", coefficient:"1", annee_scolaire:"1ère année", professeur_id:"" });
  const [formEmploi,setFormEmploi]= useState({ matiere_id:"", annee_scolaire:"1ère année", classe:"A", jour:"Lundi", heure_debut:"08:30", heure_fin:"10:30", salle:"" });
  const [msg,       setMsg]       = useState("");
  const [unreadMsg, setUnreadMsg] = useState(0);

  // Modal étudiant
  const [selectedEtudiant, setSelectedEtudiant] = useState(null);
  const [editForm,          setEditForm]          = useState({});
  const [editLoading,       setEditLoading]       = useState(false);

  // Modal professeur
  const [selectedProf,   setSelectedProf]   = useState(null);
  const [editProfForm,   setEditProfForm]   = useState({});
  const [editProfLoading,setEditProfLoading]= useState(false);

  // Comptes orphelins
  const [orphelins,     setOrphelins]     = useState([]);
  const [linkTarget,    setLinkTarget]    = useState(null);
  const [linkStudentId, setLinkStudentId] = useState("");
  const [profilTarget,  setProfilTarget]  = useState(null);
  const [profilForm,    setProfilForm]    = useState({ annee_scolaire: "1ère année", classe: "A" });

  // Filtre global (toujours visible)
  const [gf, setGf] = useState({ annee: "", niveau: "", classe: "" });
  const [filterOptions, setFilterOptions] = useState({ groupes: [], classes: [], classe_groupes: {} });

  // Recherche / filtres étudiants (section gestion)
  const [searchEtudiant, setSearchEtudiant] = useState("");
  const [filterClasse,   setFilterClasse]   = useState("");
  const [filterStatut,   setFilterStatut]   = useState("");
  const [gEstNiveau,     setGEstNiveau]     = useState("");
  const [gEstClasse,     setGEstClasse]     = useState("");
  const [gMatNiveau,     setGMatNiveau]     = useState("");
  const [gMatGroupe,     setGMatGroupe]     = useState("");
  const [showAddProf,    setShowAddProf]    = useState(false);
  const [showAddMat,     setShowAddMat]     = useState(false);
  const [gEmploiNiveau,  setGEmploiNiveau]  = useState("");
  const [gEmploiGroupe,  setGEmploiGroupe]  = useState("");

  // Notes
  const [notes,    setNotes]    = useState([]);
  const [formNote, setFormNote] = useState({ student_id:"", matiere_id:"", note:"", type:"controle", commentaire:"", date:"" });
  const [editNote, setEditNote] = useState(null);
  const [noteMsg,  setNoteMsg]  = useState("");

  // Sessions
  const [sessions,       setSessions]       = useState([]);
  const [filterSNiveau,  setFilterSNiveau]  = useState("");
  const [filterSClasse,  setFilterSClasse]  = useState("");
  const [filterSMatiere, setFilterSMatiere] = useState("");
  const [sessionOffset,  setSessionOffset]  = useState(0);
  const SESSION_LIMIT = 60;

  // Salles
  const [salles,     setSalles]     = useState([]);
  const [formSalle,  setFormSalle]  = useState({ nom: "", numero: "", batiment: "", capacite: "", camera_url: "" });
  const [editSalle,  setEditSalle]  = useState(null);
  const [salleMsg,   setSalleMsg]   = useState("");

  // Notes module (vue par classe)
  const [notesPageFiltre,  setNotesPageFiltre]  = useState({ niveau: "", classe: "" });
  const [notesPageStudent, setNotesPageStudent] = useState(null);

  // Surveillance
  const [survSessions,       setSurvSessions]       = useState([]);
  const [survLoading,        setSurvLoading]        = useState(false);
  const [survSelected,       setSurvSelected]       = useState(null);
  const [survAnalyzeMode,    setSurvAnalyzeMode]    = useState("file");
  const [survAnalyzeFile,    setSurvAnalyzeFile]    = useState([]);
  const [survDiag,           setSurvDiag]           = useState(null);
  const [survDiagLoading,    setSurvDiagLoading]    = useState(false);
  const [survAnalyzeUrl,     setSurvAnalyzeUrl]     = useState("");
  const [survAnalyzeLoading, setSurvAnalyzeLoading] = useState(false);
  const [survResults,        setSurvResults]        = useState({});
  const [survFormNiveau,     setSurvFormNiveau]     = useState("");
  const [survFormClasse,     setSurvFormClasse]     = useState("");
  const [survFormSessionId,  setSurvFormSessionId]  = useState("");
  const [survCreateForm,     setSurvCreateForm]     = useState({ matiere_id:"", date:"", heure_debut:"08:00", heure_fin:"10:00", salle:"" });
  const [survCreateOpen,     setSurvCreateOpen]     = useState(false);
  const [survCreateLoading,  setSurvCreateLoading]  = useState(false);
  const [survCreateMsg,      setSurvCreateMsg]      = useState("");

  // ── Présences page ──────────────────────────────────────────────────────
  const [presFilter,         setPresFilter]         = useState({ niveau: "", classe: "" });
  const [presJour,           setPresJour]           = useState("");
  const [presPageSessions,   setPresPageSessions]   = useState([]);
  const [presSession,        setPresSession]        = useState(null);
  const [presDetail,         setPresDetail]         = useState(null);
  const [presDetailLoading,  setPresDetailLoading]  = useState(false);

  // ── Risques page ────────────────────────────────────────────────────────
  const [risquesFilter,    setRisquesFilter]    = useState({ niveau: "", classe: "" });
  const [risquesAlertSent, setRisquesAlertSent] = useState({});

  // Alertes manuelles
  const [formAlerte, setFormAlerte] = useState({ message:"", type:"information", severity:"medium", cible:"etudiant", student_id:"", annee_scolaire:"", classe:"" });
  const [alerteMsg,  setAlerteMsg]  = useState("");

  // Import CSV
  const [csvFile,    setCsvFile]    = useState(null);
  const [csvPreview, setCsvPreview] = useState([]);
  const [csvLoading, setCsvLoading] = useState(false);
  const [csvMsg,     setCsvMsg]     = useState("");

  // Classes & Niveaux dynamiques
  const [dynGroupes, setDynGroupes] = useState(() => {
    try { return JSON.parse(localStorage.getItem("sc_groupes")) || GROUPES; } catch { return GROUPES; }
  });
  const [dynNiveaux, setDynNiveaux] = useState(() => {
    try { return JSON.parse(localStorage.getItem("sc_niveaux")) || NIVEAUX; } catch { return NIVEAUX; }
  });
  const [newGroupe,  setNewGroupe]  = useState("");
  const [newNiveau,  setNewNiveau]  = useState("");

  // Modale alerte depuis Prédiction IA
  const [alertPredModal,    setAlertPredModal]    = useState(null);
  const [alertPredForm,     setAlertPredForm]     = useState({ message: "", severity: "medium", type: "avertissement", target_role: "etudiant" });
  const [alertPredSending,  setAlertPredSending]  = useState(false);
  const [alertPredFeedback, setAlertPredFeedback] = useState("");

  useEffect(() => {
    const h = authHeaders();
    axios.get(`${API_URL}/api/bi/filtres`, h).then(r => setFilterOptions(r.data)).catch(() => {});
    axios.get(`${API_URL}/api/messaging/unread-count`, h).then(r => setUnreadMsg(r.data.count)).catch(() => {});
    // Charger risque et alertes globaux une fois sans filtre pour affichage instantané
    axios.get(`${API_URL}/api/bi/etudiants-a-risque`, h).then(r => setRisqueAll(r.data)).catch(() => {});
    axios.get(`${API_URL}/api/bi/alertes-recentes`, h).then(r => setAlertesAll(r.data)).catch(() => {});
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => loadBI(), 300);
    return () => clearTimeout(timer);
  }, [gf]);
  useEffect(() => { if (activeTab === "gestion") loadGestion(); }, [activeTab]);
  useEffect(() => { if (activeTab === "prediction") loadPrediction(); }, [activeTab, gf]);
  useEffect(() => { if (activeTab === "gestion" && gTab === "notes")    loadNotes();    }, [gTab]);
  useEffect(() => { if (activeTab === "gestion" && gTab === "sessions") loadSessions(); }, [gTab]);
  useEffect(() => { if (activeTab === "gestion" && gTab === "salles")   loadSalles();   }, [gTab]);
  useEffect(() => {
    if (activeTab === "notes") {
      loadGestion();
      loadNotes();
    }
    if (activeTab === "alertes") {
      if (etudiants.length === 0) loadGestion();
      if (matieres.length === 0) loadGestion();
    }
    if (activeTab === "presences") {
      if (emplois.length === 0) loadGestion();
    }
    if (activeTab === "risques") {
      if (etudiants.length === 0) loadGestion();
      if (notes.length === 0) loadNotes();
    }
    if (activeTab === "surveillance") { loadSurvSessions(); loadSalles(); }
  }, [activeTab]);

  // Recharge les sessions quand la classe sélectionnée change dans l'onglet Présences
  useEffect(() => {
    if (activeTab === "presences" && presFilter.classe) {
      setPresJour("");
      setPresSession(null);
      setPresDetail(null);
      loadPresPageSessions(presFilter.classe);
    }
  }, [presFilter.classe]);

  const loadBI = () => {
    const p = [];
    if (gf.classe)  p.push(`classe=${encodeURIComponent(gf.classe)}`);
    if (gf.niveau)  p.push(`annee_scolaire=${encodeURIComponent(gf.niveau)}`);
    const qs = p.length ? `?${p.join("&")}` : "";
    const h  = authHeaders();
    setBiLoading(true);
    Promise.allSettled([
      axios.get(`${API_URL}/api/bi/overview${qs}`, h).then(r => setOverview(r.data)),
      axios.get(`${API_URL}/api/bi/presence-par-classe${qs}`, h).then(r => setPresClasse(r.data)),
      axios.get(`${API_URL}/api/bi/presence-par-matiere${qs}`, h).then(r => setPresMat(r.data)),
      axios.get(`${API_URL}/api/bi/evolution-presences${qs}`, h).then(r => setEvolution(r.data.filter(d => d.taux_presence !== null))),
      axios.get(`${API_URL}/api/bi/repartition-statuts${qs}`, h).then(r => setRepartition(r.data)),
      axios.get(`${API_URL}/api/bi/etudiants-a-risque${qs}`, h).then(r => setRisque(r.data)),
      axios.get(`${API_URL}/api/bi/notes-par-matiere${qs}`, h).then(r => setNotesMat(r.data)),
      axios.get(`${API_URL}/api/bi/alertes-recentes${qs}`, h).then(r => setAlertes(r.data)),
    ]).finally(() => setBiLoading(false));
  };

  const loadPrediction = async () => {
    setPredLoading(true);
    const p = [];
    if (gf.classe) p.push(`classe=${encodeURIComponent(gf.classe)}`);
    if (gf.niveau) p.push(`annee_scolaire=${encodeURIComponent(gf.niveau)}`);
    const qs = p.length ? `?${p.join("&")}` : "";
    try {
      const res = await axios.get(`${API_URL}/api/bi/prediction-risque${qs}`, authHeaders());
      setPrediction(res.data);
    } catch (err) { console.error(err); }
    finally { setPredLoading(false); }
  };

  const openAlertPred = (s) => {
    const sevMap  = { critique: "high", "élevé": "medium", "modéré": "low", faible: "low" };
    const typeMap = { critique: "convocation", "élevé": "avertissement", "modéré": "information", faible: "information" };
    const defaultMsg = s.analyse_ia
      ? s.analyse_ia
      : `L'étudiant(e) ${s.prenom} ${s.nom} présente un risque ${s.niveau_risque} (score ${s.score_risque}/100) : ${s.nb_absences} absence(s)${s.moyenne > 0 ? `, moyenne ${s.moyenne}/20` : ""}.`;
    setAlertPredModal(s);
    setAlertPredForm({
      message:     defaultMsg,
      severity:    sevMap[s.niveau_risque]  || "medium",
      type:        typeMap[s.niveau_risque] || "avertissement",
      target_role: "etudiant",
    });
    setAlertPredFeedback("");
  };

  const sendAlertPred = async () => {
    if (!alertPredModal || !alertPredForm.message.trim()) return;
    setAlertPredSending(true);
    try {
      await axios.post(`${API_URL}/api/gestion/alertes`, {
        student_id:  alertPredModal.student_id,
        message:     alertPredForm.message,
        severity:    alertPredForm.severity,
        type:        alertPredForm.type,
        target_role: alertPredForm.target_role,
      }, authHeaders());
      setAlertPredFeedback("ok");
      setTimeout(() => setAlertPredModal(null), 1500);
    } catch {
      setAlertPredFeedback("err");
    } finally {
      setAlertPredSending(false);
    }
  };

  const loadGestion = async () => {
    const [pr, mt, em, et, or_] = await Promise.allSettled([
      axios.get(`${API_URL}/api/gestion/professeurs`,       authHeaders()),
      axios.get(`${API_URL}/api/gestion/matieres`,          authHeaders()),
      axios.get(`${API_URL}/api/gestion/emplois`,           authHeaders()),
      axios.get(`${API_URL}/api/gestion/etudiants`,         authHeaders()),
      axios.get(`${API_URL}/api/gestion/comptes-orphelins`, authHeaders()),
    ]);
    if (pr.status === "fulfilled") setProfs(pr.value.data);
    if (mt.status === "fulfilled") setMatieres(mt.value.data);
    if (em.status === "fulfilled") setEmplois(em.value.data);
    if (et.status === "fulfilled") setEtudiants(et.value.data);
    if (or_.status === "fulfilled") setOrphelins(or_.value.data);
  };

  const lierCompteEtudiant = async () => {
    if (!linkTarget || !linkStudentId) return;
    try {
      await axios.post(`${API_URL}/api/gestion/lier-compte-etudiant`,
        { user_id: linkTarget.user_id, student_id: linkStudentId }, authHeaders());
      showMsg("✅ Compte lié avec succès !");
      setLinkTarget(null);
      setLinkStudentId("");
      loadGestion();
    } catch (e) { showMsg("❌ " + (e.response?.data?.detail || "Erreur")); }
  };

  const creerProfilOrphelin = async () => {
    if (!profilTarget) return;
    try {
      await axios.post(
        `${API_URL}/api/gestion/comptes-orphelins/${profilTarget.user_id}/creer-profil`,
        profilForm, authHeaders()
      );
      showMsg("✅ Profil créé et compte activé !");
      setProfilTarget(null);
      setProfilForm({ classe: "1A", annee_scolaire: "2025-2026" });
      loadGestion();
    } catch (e) { showMsg("❌ " + (e.response?.data?.detail || "Erreur")); }
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

  const openProf = (p) => {
    setSelectedProf(p);
    setEditProfForm({ nom: p.nom, prenom: p.prenom, email: p.email });
  };

  const saveProf = async () => {
    setEditProfLoading(true);
    try {
      await axios.put(`${API_URL}/api/gestion/professeurs/${selectedProf.id}`, editProfForm, authHeaders());
      showMsg("✅ Professeur mis à jour !");
      await loadGestion();
      setSelectedProf(prev => ({ ...prev, ...editProfForm }));
    } catch (e) { showMsg("❌ " + (e.response?.data?.detail || "Erreur")); }
    finally { setEditProfLoading(false); }
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

  const creerCompteEtudiant = async (s) => {
    try {
      const res = await axios.post(`${API_URL}/api/gestion/etudiants/${s.id}/creer-compte`, {}, authHeaders());
      if (res.data.already_active) {
        showMsg("ℹ️ Ce compte est déjà actif");
      } else if (res.data.reactivated) {
        showMsg("✅ Compte réactivé !");
      } else {
        showMsg(`✅ Compte créé — mot de passe provisoire : ${res.data.password}`);
      }
    } catch (e) {
      showMsg("❌ " + (e.response?.data?.detail || "Erreur"));
    } finally {
      loadGestion();
    }
  };

  const deleteOrphelin = async (userId) => {
    if (!confirm("Supprimer définitivement ce compte ?")) return;
    try {
      await axios.delete(`${API_URL}/api/gestion/comptes-orphelins/${userId}`, authHeaders());
      showMsg("✅ Compte supprimé");
      loadGestion();
    } catch (e) { showMsg("❌ " + (e.response?.data?.detail || "Erreur")); }
  };

  const addMat = async () => {
    try {
      const payload = { ...formMat, coefficient: parseFloat(formMat.coefficient) };
      await axios.post(`${API_URL}/api/gestion/matieres`, payload, authHeaders());
      showMsg("✅ Matière créée !");
      setFormMat({ nom:"", code:"", coefficient:"1", annee_scolaire:"1ère année", professeur_id:"" });
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
      // annee_scolaire est uniquement pour le filtre UI, pas envoyé au backend
      const { annee_scolaire: _nv, ...payload } = formEmploi;
      await axios.post(`${API_URL}/api/gestion/emplois`, payload, authHeaders());
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

  // ── Notes ──
  const loadNotes = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/gestion/notes`, authHeaders());
      setNotes(res.data);
    } catch {}
  };

  const addNote = async () => {
    if (!formNote.student_id || !formNote.matiere_id || formNote.note === "") return;
    try {
      await axios.post(`${API_URL}/api/gestion/notes`, {
        ...formNote, note: parseFloat(formNote.note),
      }, authHeaders());
      setNoteMsg("ok");
      setFormNote({ student_id:"", matiere_id:"", note:"", type:"controle", commentaire:"", date:"" });
      loadNotes();
    } catch (e) { setNoteMsg("err:" + (e.response?.data?.detail || "Erreur")); }
    finally { setTimeout(() => setNoteMsg(""), 3000); }
  };

  const saveEditNote = async () => {
    if (!editNote) return;
    try {
      await axios.put(`${API_URL}/api/gestion/notes/${editNote.id}`,
        { note: parseFloat(editNote.note), type: editNote.type, commentaire: editNote.commentaire },
        authHeaders()
      );
      setNoteMsg("ok");
      setEditNote(null);
      loadNotes();
    } catch (e) { setNoteMsg("err:" + (e.response?.data?.detail || "Erreur")); }
    finally { setTimeout(() => setNoteMsg(""), 3000); }
  };

  const deleteNote = async (id) => {
    if (!confirm("Supprimer cette note ?")) return;
    await axios.delete(`${API_URL}/api/gestion/notes/${id}`, authHeaders());
    loadNotes();
  };

  // ── Sessions ──
  const [sessionModal,    setSessionModal]    = useState(null);  // { session, stats, etudiants }
  const [sessionModalLoading, setSessionModalLoading] = useState(false);

  const openSessionModal = async (sessionId) => {
    setSessionModalLoading(true);
    setSessionModal({ loading: true });
    try {
      const res = await axios.get(`${API_URL}/api/gestion/sessions/${sessionId}/presences`, authHeaders());
      setSessionModal(res.data);
    } catch { setSessionModal(null); }
    finally { setSessionModalLoading(false); }
  };

  const loadSalles = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/gestion/salles`, authHeaders());
      setSalles(res.data);
    } catch {}
  };

  const saveSalle = async () => {
    try {
      const payload = { ...formSalle, capacite: formSalle.capacite ? parseInt(formSalle.capacite) : null };
      await axios.post(`${API_URL}/api/gestion/salles`, payload, authHeaders());
      setSalleMsg("ok");
      setFormSalle({ nom: "", numero: "", batiment: "", capacite: "", camera_url: "" });
      loadSalles();
    } catch (e) { setSalleMsg("err:" + (e.response?.data?.detail || "Erreur")); }
    finally { setTimeout(() => setSalleMsg(""), 3000); }
  };

  const updateSalle = async () => {
    if (!editSalle) return;
    try {
      await axios.put(`${API_URL}/api/gestion/salles/${editSalle.id}`,
        { ...editSalle, capacite: editSalle.capacite ? parseInt(editSalle.capacite) : null },
        authHeaders()
      );
      setSalleMsg("ok");
      setEditSalle(null);
      loadSalles();
    } catch (e) { setSalleMsg("err:" + (e.response?.data?.detail || "Erreur")); }
    finally { setTimeout(() => setSalleMsg(""), 3000); }
  };

  const deleteSalle = async (id) => {
    if (!confirm("Supprimer cette salle ?")) return;
    await axios.delete(`${API_URL}/api/gestion/salles/${id}`, authHeaders());
    loadSalles();
  };

  // ── Présences ────────────────────────────────────────────────────────────
  const loadPresPageSessions = async (classe) => {
    if (!classe) return;
    try {
      const res = await axios.get(
        `${API_URL}/api/gestion/sessions?classe=${encodeURIComponent(classe)}&limit=200`,
        authHeaders()
      );
      setPresPageSessions(res.data);
    } catch { setPresPageSessions([]); }
  };

  const loadPresDetail = async (session) => {
    setPresSession(session);
    setPresDetail(null);
    setPresDetailLoading(true);
    try {
      const res = await axios.get(
        `${API_URL}/api/gestion/sessions/${session.id}/presences`,
        authHeaders()
      );
      setPresDetail(res.data);
    } catch { setPresDetail({ error: "Impossible de charger les présences" }); }
    finally { setPresDetailLoading(false); }
  };

  // ── Risques alertes rapides ──────────────────────────────────────────────
  const sendRisqueAlerte = async (student, raison) => {
    try {
      await axios.post(`${API_URL}/api/gestion/alertes`, {
        student_id: student.id,
        type: raison === "absences" ? "absences_excessives" : "notes_faibles",
        message: raison === "absences"
          ? `${student.prenom} ${student.nom} a ${student.absences} absences (seuil +3/semaine dépassé). Intervention recommandée.`
          : `${student.prenom} ${student.nom} a une moyenne inférieure à 10. Risque d'échec détecté.`,
        severity: "high",
        target_role: "admin",
      }, authHeaders());
      setRisquesAlertSent(prev => ({ ...prev, [student.id + raison]: true }));
    } catch {}
  };

  const loadSurvSessions = async (classe = "", niveau = "") => {
    setSurvLoading(true);
    try {
      let url = `${API_URL}/api/gestion/sessions?limit=200`;
      if (classe) url += `&classe=${encodeURIComponent(classe)}`;
      if (niveau) url += `&niveau=${encodeURIComponent(niveau)}`;
      const res = await axios.get(url, authHeaders());
      setSurvSessions(res.data);
    } catch {} finally { setSurvLoading(false); }
  };

  const analyzeInSurveillance = async (sessionId) => {
    setSurvAnalyzeLoading(true);
    try {
      let res;
      if (survAnalyzeMode === "file" && survAnalyzeFile.length > 0) {
        const fd = new FormData();
        fd.append("session_id", sessionId);
        survAnalyzeFile.forEach(f => fd.append("videos", f));
        res = await axios.post(`${API_URL}/api/attendance/analyze-video`, fd, authHeaders());
      } else if (survAnalyzeMode === "url" && survAnalyzeUrl) {
        const fd = new FormData();
        fd.append("session_id", sessionId);
        fd.append("stream_url", survAnalyzeUrl);
        res = await axios.post(`${API_URL}/api/attendance/analyze-stream`, fd, authHeaders());
      }
      if (res) setSurvResults(prev => ({ ...prev, [sessionId]: res.data }));
    } catch (e) {
      setSurvResults(prev => ({ ...prev, [sessionId]: { error: e.response?.data?.detail || "Erreur" } }));
    } finally { setSurvAnalyzeLoading(false); }
  };

  const loadSessions = async (off = 0) => {
    try {
      let url = `${API_URL}/api/gestion/sessions?limit=${SESSION_LIMIT}&offset=${off}`;
      if (filterSNiveau)  url += `&niveau=${encodeURIComponent(filterSNiveau)}`;
      if (filterSClasse)  url += `&classe=${filterSClasse}`;
      if (filterSMatiere) url += `&matiere_id=${filterSMatiere}`;
      const res = await axios.get(url, authHeaders());
      if (off === 0) setSessions(res.data);
      else           setSessions(prev => [...prev, ...res.data]);
      setSessionOffset(off);
    } catch {}
  };

  const deleteSession = async (id) => {
    if (!confirm("Supprimer cette séance et toutes ses présences ?")) return;
    await axios.delete(`${API_URL}/api/gestion/sessions/${id}`, authHeaders());
    showMsg("✅ Séance supprimée");
    loadSessions();
  };

  // ── Alertes manuelles ──
  const sendAlerte = async () => {
    if (!formAlerte.message.trim()) return;
    if (formAlerte.cible === "etudiant" && !formAlerte.student_id) return;
    if (formAlerte.cible === "classe" && (!formAlerte.annee_scolaire || !formAlerte.classe)) return;
    try {
      const payload = {
        message:  formAlerte.message,
        type:     formAlerte.type,
        severity: formAlerte.severity,
        ...(formAlerte.cible === "etudiant"
          ? { student_id: formAlerte.student_id }
          : { classe: formAlerte.classe, annee_scolaire: formAlerte.annee_scolaire }),
      };
      const res = await axios.post(`${API_URL}/api/gestion/alertes`, payload, authHeaders());
      setAlerteMsg(`ok:${res.data.nb_alertes}`);
      setFormAlerte({ message:"", type:"information", severity:"medium", cible:"etudiant", student_id:"", annee_scolaire:"", classe:"" });
    } catch (e) { setAlerteMsg("err:" + (e.response?.data?.detail || "Erreur")); }
    finally { setTimeout(() => setAlerteMsg(""), 4000); }
  };

  // ── Export CSV ──
  const exportCSV = (rows, cols, filename) => {
    const header = cols.map(c => c.label).join(";");
    const body   = rows.map(r => cols.map(c => `"${(r[c.key] ?? "").toString().replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob   = new Blob(["﻿" + header + "\n" + body], { type: "text/csv;charset=utf-8;" });
    const url    = URL.createObjectURL(blob);
    const a      = document.createElement("a"); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const exportEtudiants = () => exportCSV(etudiants, [
    { label: "Nom",           key: "nom" },
    { label: "Prénom",        key: "prenom" },
    { label: "Email",         key: "email" },
    { label: "Classe",        key: "classe" },
    { label: "Année scolaire",key: "annee_scolaire" },
    { label: "Tél.",          key: "telephone" },
    { label: "CIN",           key: "cin" },
    { label: "Présence %",    key: "taux_presence" },
    { label: "Absences",      key: "absences" },
    { label: "Moyenne",       key: "moyenne" },
    { label: "Enrôlé",        key: "is_enrolled" },
  ], "etudiants.csv");

  const exportNotes = () => exportCSV(notes, [
    { label: "Étudiant",   key: "etudiant" },
    { label: "Classe",     key: "classe" },
    { label: "Matière",    key: "matiere" },
    { label: "Note",       key: "note" },
    { label: "Type",       key: "type" },
    { label: "Date",       key: "date" },
    { label: "Commentaire",key: "commentaire" },
  ], "notes.csv");

  const tabs = [
    { id: "overview",     label: "Accueil"           },
    { id: "gestion",      label: "Gestion"           },
    { id: "presences",    label: "Présences"         },
    { id: "alertes",      label: "Alertes"           },
    { id: "risques",      label: "Étudiants à risque"},
    { id: "notes",        label: "Notes"             },
    { id: "surveillance", label: "Surveillance"      },
    { id: "prediction",   label: "Prédiction IA"     },
  ];

  const gTabs = [
    { id: "etudiants",  label: "Étudiants"        },
    { id: "profs",      label: "Professeurs"      },
    { id: "matieres",   label: "Matières"         },
    { id: "emplois",    label: "Emplois du temps" },
    { id: "sessions",   label: "Sessions"         },
  ];

  // Options dynamiques depuis le backend (disponibles sur tous les onglets)
  const uniqueGroupes = filterOptions.groupes;
  const uniqueClasses = gf.niveau
    ? filterOptions.classes.filter(cl =>
        (filterOptions.classe_groupes[cl] || []).includes(gf.niveau)
      )
    : filterOptions.classes;

  // presClasse est déjà filtré côté backend, pas besoin de filtre client supplémentaire
  const presClasseFiltree = presClasse;

  const etudiantsFiltres = etudiants.filter(e => {
    const matchNiveau  = !gEstNiveau || e.annee_scolaire === gEstNiveau;
    const matchGClasse = !gEstClasse || e.classe === gEstClasse;
    const q = searchEtudiant.toLowerCase();
    const matchSearch = !q || `${e.prenom} ${e.nom} ${e.email}`.toLowerCase().includes(q);
    const matchStatut = !filterStatut
      || (filterStatut === "actif"       && e.has_account  && e.account_active)
      || (filterStatut === "inactif"     && e.has_account  && !e.account_active)
      || (filterStatut === "sans_compte" && !e.has_account);
    return matchNiveau && matchGClasse && matchSearch && matchStatut;
  });

  const severityColor = s =>
    s === "high" ? "#ef4444" : s === "medium" ? "#f59e0b" : "#6366f1";

  // ── Icônes SVG pour la sidebar ─────────────────────────────────
  const ICON = ({ d, d2, circle, rect, poly, size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {d  && <path d={d} />}
      {d2 && <path d={d2} />}
      {circle && <circle cx={circle[0]} cy={circle[1]} r={circle[2]} />}
      {rect && <rect x={rect[0]} y={rect[1]} width={rect[2]} height={rect[3]} rx={rect[4]||0} />}
      {poly && <polyline points={poly} />}
    </svg>
  );

  const TAB_CONFIG = {
    overview:     { color: "#3b82f6", icon: <ICON d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" d2="M9 22V12h6v10" /> },
    surveillance: { color: "#a855f7", icon: <ICON d="M23 7l-7 5 7 5V7z" rect={[1,5,15,14,2]} /> },
    presences:    { color: "#10b981", icon: <ICON d="M22 11.08V12a10 10 0 1 1-5.93-9.14" poly="22 4 12 14.01 9 11.01" /> },
    risques:      { color: "#ef4444", icon: <ICON d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" d2="M12 9v4M12 17h.01" /> },
    prediction:   { color: "#f59e0b", icon: <ICON d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3M6.343 6.343l-.707-.707M6.343 17.657l-.707.707M15.657 6.343l.707-.707m0 11.314l.707.707" circle={[12,12,4]} /> },
    notes:        { color: "#6366f1", icon: <ICON d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" d2="M14 2v6h6M16 13H8M16 17H8M10 9H8" /> },
    alertes:      { color: "#f97316", icon: <ICON d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" /> },
    gestion:      { color: "#6b7280", icon: <ICON d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" d2="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /> },
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      background: "#0d0d1f",
      fontFamily: F, color: "#f1f5f9",
    }}>

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

                {/* ─── Infos étudiant (éditables par l'admin) ─── */}
                <div style={{ marginTop: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12,
                    paddingBottom: 8, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <span style={{ fontSize: 14 }}>👤</span>
                    <span style={{ fontWeight: 600, fontSize: 13, color: "rgba(255,255,255,0.5)" }}>Informations étudiant</span>
                    <span style={{ marginLeft: "auto", fontSize: 10, color: "#6366f1",
                      background: "rgba(99,102,241,0.12)", padding: "2px 8px",
                      borderRadius: 20, fontWeight: 600, letterSpacing: "0.06em" }}>MODIFIABLES</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                    {[
                      ["Nom",               "nom"],
                      ["Prénom",            "prenom"],
                      ["Email",             "email"],
                      ["Téléphone",         "telephone"],
                      ["Adresse",           "adresse"],
                      ["Ville",             "ville"],
                      ["Date naissance",    "date_naissance"],
                      ["Lieu naissance",    "lieu_naissance"],
                      ["CIN",               "cin"],
                      ["Classe",            "classe"],
                      ["Année scolaire",    "annee_scolaire"],
                      ["N° Carte étudiant", "numero_carte"],
                    ].map(([label, key]) => (
                      <div key={key}>
                        <LBL>{label}</LBL>
                        <Input value={ef[key] || ""} placeholder={label}
                          type={key === "date_naissance" ? "date" : key === "email" ? "email" : "text"}
                          onChange={e => set(key, e.target.value)} />
                      </div>
                    ))}
                    <div>
                      <LBL>Sexe</LBL>
                      <select value={ef.sexe || ""} onChange={e => set("sexe", e.target.value)}
                        style={{ width: "100%", padding: "10px 14px", background: "#0d0d1a",
                          border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10,
                          color: "#fff", fontSize: 13, fontFamily: "Sora, sans-serif", outline: "none", boxSizing: "border-box" }}>
                        <option value="">—</option>
                        <option value="M">Masculin</option>
                        <option value="F">Féminin</option>
                      </select>
                    </div>
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

      {/* Modal Professeur */}
      {selectedProf && (
        <div onClick={() => setSelectedProf(null)} style={{
          position: "fixed", inset: 0, zIndex: 200,
          background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: "#0b0b18", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 20, width: "100%", maxWidth: 480,
            boxShadow: "0 32px 100px rgba(0,0,0,0.7)",
          }}>
            <div style={{
              padding: "22px 28px 18px", borderBottom: "1px solid rgba(255,255,255,0.07)",
              display: "flex", alignItems: "center", gap: 16,
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{selectedProf.prenom} {selectedProf.nom}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 4 }}>
                  Modifier les informations du professeur
                </div>
              </div>
              <button onClick={() => setSelectedProf(null)} style={{
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8, color: "rgba(255,255,255,0.5)", cursor: "pointer",
                width: 32, height: 32, fontSize: 16,
              }}>✕</button>
            </div>
            <div style={{ padding: "24px 28px 28px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.3)",
                  letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>NOM</div>
                <Input value={editProfForm.nom || ""} placeholder="Nom"
                  onChange={e => setEditProfForm(f => ({ ...f, nom: e.target.value }))} />
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.3)",
                  letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>PRÉNOM</div>
                <Input value={editProfForm.prenom || ""} placeholder="Prénom"
                  onChange={e => setEditProfForm(f => ({ ...f, prenom: e.target.value }))} />
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.3)",
                  letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>EMAIL</div>
                <Input value={editProfForm.email || ""} placeholder="Email" type="email"
                  onChange={e => setEditProfForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <Btn onClick={saveProf} style={{ flex: 1, padding: "11px", opacity: editProfLoading ? 0.6 : 1 }}>
                  {editProfLoading ? "Enregistrement..." : "💾 Enregistrer"}
                </Btn>
                <Btn onClick={() => setSelectedProf(null)} color="rgba(255,255,255,0.06)"
                  style={{ padding: "11px 22px", color: "rgba(255,255,255,0.5)" }}>
                  Annuler
                </Btn>
              </div>
            </div>
          </div>
        </div>
      )}

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

      {/* Bouton flottant Assistant IA — centré en bas */}
      <div style={{
        position: "fixed",
        bottom: 32,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 150,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
      }}>
        <button
          onClick={() => setShowVoice(true)}
          style={{
            width: 56, height: 56,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #6366f1, #a855f7)",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
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
        <div style={{
          fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.4)",
          letterSpacing: "0.06em", textTransform: "uppercase",
          background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
          padding: "3px 10px", borderRadius: 20,
          border: "1px solid rgba(255,255,255,0.06)",
        }}>
          Assistant IA
        </div>
      </div>

      {/* ═══ SIDEBAR GAUCHE ═══════════════════════════════════════ */}
      <div style={{
        width: 248, minWidth: 248, height: "100vh",
        position: "sticky", top: 0,
        background: "#111127",
        borderRight: "1px solid rgba(255,255,255,0.07)",
        display: "flex", flexDirection: "column",
        overflowY: "auto", overflowX: "hidden",
        zIndex: 100, scrollbarWidth: "none",
      }}>
        {/* ── Logo ── */}
        <div style={{ padding: "22px 20px 16px", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flexShrink: 0, filter: "drop-shadow(0 4px 12px rgba(99,102,241,0.5))", position: "relative", width: 46, height: 46 }}>
            <svg width="46" height="46" viewBox="0 0 46 46" fill="none">
              <defs>
                <linearGradient id="hexGradAdmin" x1="0" y1="0" x2="46" y2="46" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#1e1b4b"/>
                  <stop offset="100%" stopColor="#3730a3"/>
                </linearGradient>
              </defs>
              <polygon points="23,2 42,12.5 42,33.5 23,44 4,33.5 4,12.5" fill="url(#hexGradAdmin)"/>
              <polygon points="23,6 38,14.8 38,31.2 23,40 8,31.2 8,14.8" fill="none" stroke="rgba(167,139,250,0.35)" strokeWidth="1.2"/>
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 900, color: "#fff", letterSpacing: "-0.5px", fontFamily: "sans-serif" }}>SC</span>
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#f1f5f9", lineHeight: 1 }}>SmartCampus</div>
            <div style={{ fontSize: 10, color: "#a855f7", marginTop: 3, fontWeight: 600,
              letterSpacing: "0.06em", textTransform: "uppercase" }}>Administration</div>
          </div>
        </div>

        {/* ── Séparateur ── */}
        <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "0 16px 8px" }} />

        {/* ── Séparateur ── */}
        <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "8px 16px 12px" }} />

        {/* Badge alertes */}
        {overview?.alertes_non_lues > 0 && (
          <div onClick={() => setActiveTab("alertes")}
            style={{ margin: "0 12px 10px", padding: "8px 12px", borderRadius: 8,
              background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
              cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444", flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: "#f87171", fontWeight: 600 }}>
              {overview.alertes_non_lues} alerte{overview.alertes_non_lues > 1 ? "s" : ""} non lue{overview.alertes_non_lues > 1 ? "s" : ""}
            </span>
          </div>
        )}

        {/* ── Navigation ── */}
        <nav style={{ flex: 1, padding: "0 10px", overflowY: "auto", scrollbarWidth: "none" }}>
          {tabs.map(tab => {
            const cfg = TAB_CONFIG[tab.id] || { color: "#6b7280", icon: null };
            const active = activeTab === tab.id;
            return (
              <button key={tab.id} className="tab-btn" onClick={() => setActiveTab(tab.id)} style={{
                width: "100%", display: "flex", alignItems: "center", gap: 12,
                padding: "10px 12px", borderRadius: 10, border: "none",
                background: active ? `${cfg.color}18` : "transparent",
                outline: active ? `1px solid ${cfg.color}35` : "none",
                color: active ? "#fff" : "rgba(255,255,255,0.48)",
                cursor: "pointer", fontFamily: F, fontSize: 13,
                fontWeight: active ? 600 : 400,
                marginBottom: 3, textAlign: "left",
                transition: "all 0.14s",
              }}
                onMouseEnter={e => { if (!active) { e.currentTarget.style.background = `${cfg.color}10`; e.currentTarget.style.color = "#fff"; }}}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.48)"; }}}
              >
                {/* Icône colorée */}
                <div style={{
                  width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                  background: active ? `${cfg.color}28` : `${cfg.color}12`,
                  border: active ? `1px solid ${cfg.color}40` : `1px solid ${cfg.color}20`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: active ? cfg.color : `${cfg.color}bb`,
                  transition: "all 0.14s",
                }}>
                  {cfg.icon}
                </div>
                {tab.label}
                {active && (
                  <div style={{ marginLeft: "auto", width: 6, height: 6,
                    borderRadius: "50%", background: cfg.color, flexShrink: 0,
                    boxShadow: `0 0 6px ${cfg.color}` }} />
                )}
              </button>
            );
          })}
        </nav>

        {/* ── Messages + Déconnexion ── */}
        <div style={{ padding: "10px 10px 20px" }}>
          {/* Messages */}
          <button onClick={onOpenMessages} className="tab-btn" style={{
            width: "100%", display: "flex", alignItems: "center", gap: 12,
            padding: "11px 12px", borderRadius: 10, border: "none",
            background: "transparent", color: "rgba(255,255,255,0.4)",
            cursor: "pointer", fontFamily: F, fontSize: 13, marginBottom: 6,
          }}>
            <div style={{ width: 34, height: 34, borderRadius: 9,
              background: "rgba(14,165,233,0.1)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#0ea5e9", position: "relative", flexShrink: 0 }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
              {unreadMsg > 0 && (
                <span style={{ position: "absolute", top: -4, right: -4,
                  background: "#ef4444", color: "#fff", fontSize: 8, fontWeight: 700,
                  minWidth: 14, height: 14, borderRadius: 7,
                  display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {unreadMsg}
                </span>
              )}
            </div>
            Messages
          </button>

          {/* Déconnexion */}
          <button onClick={onLogout} className="sc-btn" style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "12px", borderRadius: 10, border: "1px solid rgba(239,68,68,0.25)",
            background: "rgba(239,68,68,0.1)", color: "#f87171",
            cursor: "pointer", fontFamily: F, fontSize: 13, fontWeight: 600,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
            </svg>
            Déconnexion
          </button>
        </div>
      </div>

      {/* ═══ CONTENU PRINCIPAL ══════════════════════════════════════ */}
      <div style={{ flex: 1, minHeight: "100vh", overflowY: "auto", overflowX: "hidden" }}>
      <div className="page-body">
        {/* Tableau de bord */}
        {activeTab === "overview" && (
          <div className="sc-fade" style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Bandeau de bienvenue */}
            <div style={{
              background: "linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(168,85,247,0.08) 100%)",
              border: "1px solid rgba(99,102,241,0.2)",
              borderRadius: 16, padding: "20px 24px",
              display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12,
            }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#fff" }}>
                  Bonjour, {user?.prenom} {user?.nom}
                </div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginTop: 4 }}>
                  {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                  {" · "}Tableau de bord Administration
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                {risqueAll.length > 0 && (
                  <div style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)",
                    borderRadius: 10, padding: "8px 14px", fontSize: 13, color: "#f87171", fontWeight: 600 }}>
                    ⚠️ {risqueAll.length} étudiant{risqueAll.length > 1 ? "s" : ""} à risque
                  </div>
                )}
                {(overview?.alertes_non_lues || 0) > 0 && (
                  <div style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)",
                    borderRadius: 10, padding: "8px 14px", fontSize: 13, color: "#f87171", fontWeight: 600 }}>
                    🔔 {overview.alertes_non_lues} alerte{overview.alertes_non_lues > 1 ? "s" : ""} non lue{overview.alertes_non_lues > 1 ? "s" : ""}
                  </div>
                )}
              </div>
            </div>

            {/* KPIs toujours visibles */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: bp.gap2 }}>
              <StatCard color="#6366f1" label="Étudiants"
                value={overview?.total_etudiants || 0}
                sub={`${overview?.enrolles || 0} enrôlés`}
                onClick={() => { setActiveTab("gestion"); setGTab("etudiants"); }}
                icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>} />
              <StatCard color="#a855f7" label="Professeurs"
                value={overview?.total_profs || 0}
                onClick={() => { setActiveTab("gestion"); setGTab("profs"); }}
                icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>} />
              <StatCard color="#22c55e" label="Taux présence"
                value={`${overview?.taux_presence_global || 0}%`}
                onClick={() => setActiveTab("presences")}
                icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>} />
              <StatCard color="#0ea5e9" label="Matières"
                value={overview?.total_matieres || 0}
                sub={`${overview?.total_sessions || 0} séances`}
                onClick={() => { setActiveTab("gestion"); setGTab("matieres"); }}
                icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>} />
              <StatCard color="#ef4444" label="Alertes"
                value={overview?.alertes_non_lues || 0} sub="non lues"
                onClick={() => setActiveTab("alertes")}
                icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>} />
            </div>

            {/* Filtre */}
            <div style={{
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 12, padding: "12px 18px",
              display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
            }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.4)", flexShrink: 0 }}>
                Filtrer les graphiques :
              </span>
              <select value={gf.niveau}
                onChange={e => setGf(f => ({...f, niveau: e.target.value, classe: ""}))}
                style={{
                  padding: "7px 12px", fontSize: 12, borderRadius: 8, outline: "none", cursor: "pointer",
                  background: gf.niveau ? "rgba(99,102,241,0.18)" : "rgba(255,255,255,0.05)",
                  border: gf.niveau ? "1px solid rgba(99,102,241,0.4)" : "1px solid rgba(255,255,255,0.1)",
                  color: gf.niveau ? "#a5b4fc" : "rgba(255,255,255,0.4)",
                  fontFamily: "Sora, sans-serif", minWidth: 140,
                }}>
                <option value="" style={{ background: "#0d0d1a" }}>-- Tous niveaux --</option>
                {dynNiveaux.map(n => <option key={n} value={n} style={{ background: "#0d0d1a" }}>{n}</option>)}
              </select>
              <select value={gf.classe}
                onChange={e => setGf(f => ({...f, classe: e.target.value}))}
                style={{
                  padding: "7px 12px", fontSize: 12, borderRadius: 8, outline: "none", cursor: "pointer",
                  background: gf.classe ? "rgba(99,102,241,0.18)" : "rgba(255,255,255,0.05)",
                  border: gf.classe ? "1px solid rgba(99,102,241,0.4)" : "1px solid rgba(255,255,255,0.1)",
                  color: gf.classe ? "#a5b4fc" : "rgba(255,255,255,0.4)",
                  fontFamily: "Sora, sans-serif", minWidth: 120,
                }}>
                <option value="" style={{ background: "#0d0d1a" }}>-- Tous groupes --</option>
                {dynGroupes.map(g => <option key={g} value={g} style={{ background: "#0d0d1a" }}>Groupe {g}</option>)}
              </select>
              {(gf.niveau || gf.classe) && (
                <button onClick={() => setGf({ annee: "", niveau: "", classe: "" })} style={{
                  padding: "7px 12px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)",
                  borderRadius: 8, color: "#f87171", cursor: "pointer", fontSize: 12,
                  fontFamily: "Sora, sans-serif",
                }}>✕ Effacer</button>
              )}
              {(gf.niveau || gf.classe) && (
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8,
                  background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.2)",
                  borderRadius: 8, padding: "5px 12px",
                }}>
                  <span style={{ fontSize: 12, color: "#a5b4fc", fontWeight: 600 }}>
                    {gf.niveau || "Tous niveaux"}{gf.classe ? ` · Groupe ${gf.classe}` : ""}
                  </span>
                </div>
              )}
            </div>

            {/* Étudiants à risque + Alertes récentes */}
            {(() => {
              const risqueUI = (gf.niveau || gf.classe)
                ? risqueAll.filter(s =>
                    (!gf.niveau || s.annee_scolaire === gf.niveau) &&
                    (!gf.classe  || s.classe === gf.classe)
                  )
                : null;

              // Grouper par classe
              const parClasse = risqueUI
                ? risqueUI.reduce((acc, s) => {
                    const k = s.classe || "—";
                    if (!acc[k]) acc[k] = [];
                    acc[k].push(s);
                    return acc;
                  }, {})
                : {};

              return (
            <div style={{ display: "grid", gridTemplateColumns: bp.cols2, gap: bp.gap }}>

              {/* Étudiants à risque */}
              <Card>
                <SectionTitle title="Étudiants à risque" icon="⚠️" />
                {risqueUI === null ? (
                  <div style={{ textAlign: "center", padding: "32px 16px",
                    color: "rgba(255,255,255,0.25)", fontSize: 13 }}>
                    <div style={{ fontSize: 30, marginBottom: 10 }}>🎯</div>
                    Sélectionnez un niveau ou un groupe pour voir les étudiants à risque
                  </div>
                ) : risqueUI.length === 0 ? (
                  <EmptyState message="Aucun étudiant à risque dans ce groupe" />
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {Object.entries(parClasse).map(([classe, etudiants]) => (
                      <div key={classe}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#6366f1",
                          letterSpacing: "0.07em", textTransform: "uppercase",
                          marginBottom: 6, paddingBottom: 4,
                          borderBottom: "1px solid rgba(99,102,241,0.15)" }}>
                          Groupe {classe} — {etudiants.length} étudiant{etudiants.length > 1 ? "s" : ""}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {etudiants.map((s, i) => (
                            <div key={i} style={{
                              display: "flex", alignItems: "center", gap: 12,
                              padding: "10px 12px", borderRadius: 10,
                              background: "rgba(239,68,68,0.05)",
                              border: "1px solid rgba(239,68,68,0.12)",
                            }}>
                              <div style={{ width: 32, height: 32, borderRadius: 8,
                                background: "rgba(239,68,68,0.13)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 14, flexShrink: 0 }}>🔴</div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: "nowrap",
                                  overflow: "hidden", textOverflow: "ellipsis" }}>
                                  {s.prenom} {s.nom}
                                </div>
                                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 1 }}>
                                  {s.raisons?.join(", ") || "Absences excessives"}
                                </div>
                              </div>
                              <div style={{ textAlign: "right", flexShrink: 0 }}>
                                <div style={{ color: "#ef4444", fontWeight: 700, fontSize: 17 }}>{s.absences}</div>
                                <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 10 }}>absences</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <button onClick={() => setActiveTab("risques")} style={{
                  marginTop: 12, width: "100%", padding: "8px", borderRadius: 8,
                  background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)",
                  color: "#f87171", cursor: "pointer", fontSize: 12,
                  fontFamily: "Sora, sans-serif", fontWeight: 600,
                }}>Voir tous les étudiants à risque →</button>
              </Card>

              {/* Alertes récentes */}
              <Card>
                <SectionTitle title="Alertes récentes" icon="🔔" />
                {alertesAll.length === 0 ? (
                  <EmptyState message="Aucune alerte récente" />
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {alertesAll.slice(0, 4).map((a, i) => (
                      <div key={i} style={{
                        display: "flex", alignItems: "flex-start", gap: 12,
                        padding: "12px 14px", borderRadius: 10,
                        background: a.severity === "high"
                          ? "rgba(239,68,68,0.05)"
                          : a.severity === "medium"
                          ? "rgba(245,158,11,0.05)"
                          : "rgba(99,102,241,0.05)",
                        border: `1px solid ${a.severity === "high"
                          ? "rgba(239,68,68,0.15)"
                          : a.severity === "medium"
                          ? "rgba(245,158,11,0.15)"
                          : "rgba(99,102,241,0.15)"}`,
                      }}>
                        <div style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>
                          {a.severity === "high" ? "🔴" : a.severity === "medium" ? "🟠" : "🔵"}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)",
                            overflow: "hidden", textOverflow: "ellipsis",
                            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                            {a.message}
                          </div>
                          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 3 }}>
                            {a.type} · {a.created_at ? new Date(a.created_at).toLocaleDateString("fr-FR") : ""}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <button onClick={() => setActiveTab("alertes")} style={{
                  marginTop: 12, width: "100%", padding: "8px", borderRadius: 8,
                  background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.15)",
                  color: "#a5b4fc", cursor: "pointer", fontSize: 12,
                  fontFamily: "Sora, sans-serif", fontWeight: 600,
                }}>Gérer les alertes →</button>
              </Card>
            </div>
              );
            })()}

            {/* Graphiques */}
            {biLoading && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px",
                background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.15)",
                borderRadius: 10, fontSize: 13, color: "#a5b4fc" }}>
                <div className="sc-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                Mise à jour des graphiques...
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: bp.cols2, gap: bp.gap }}>
              <Card>
                <SectionTitle title="Présence par classe" icon="📊" />
                {presClasseFiltree.length === 0 ? <EmptyState message="Aucune donnée" /> :
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={presClasseFiltree}>
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
              {evolution.length === 0 ? <EmptyState message="Aucune session enregistrée" /> :
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
        {activeTab === "presences" && (() => {
          const JOURS_ORDER = ["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"];
          const DAY_IDX = { Dimanche:0, Lundi:1, Mardi:2, Mercredi:3, Jeudi:4, Vendredi:5, Samedi:6 };
          // Jours disponibles pour la classe sélectionnée (depuis emploi du temps)
          const emploisPourClasse = emplois.filter(e =>
            e.groupe === presFilter.classe &&
            (!presFilter.niveau || e.niveau === presFilter.niveau)
          );
          const joursDispos = JOURS_ORDER.filter(j => emploisPourClasse.some(e => e.jour === j));
          // Séances du jour choisi
          const seancesDuJour = presPageSessions.filter(s => {
            if (!presJour) return false;
            const d = new Date(s.date + "T12:00:00");
            return ["Dimanche","Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"][d.getDay()] === presJour;
          }).sort((a, b) => (a.heure_debut || "").localeCompare(b.heure_debut || ""));

          return (
            <div className="sc-fade" style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* ÉTAPE 1 — Sélection niveau + classe */}
              <Card>
                <SectionTitle title="Consulter les présences" icon="✅" />
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                  <select value={presFilter.niveau}
                    onChange={e => setPresFilter(f => ({ ...f, niveau: e.target.value, classe: "" }))}
                    className="sc-select"
                    style={{ padding: "8px 14px", fontSize: 13, borderRadius: 8, outline: "none", cursor: "pointer",
                      background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                      color: presFilter.niveau ? "#a5b4fc" : "rgba(255,255,255,0.4)",
                      fontFamily: "Sora, sans-serif", minWidth: 160 }}>
                    <option value="" style={{ background: "#0d0d1a" }}>-- Niveau --</option>
                    {dynNiveaux.map(n => <option key={n} value={n} style={{ background: "#0d0d1a" }}>{n}</option>)}
                  </select>
                  <select value={presFilter.classe}
                    onChange={e => setPresFilter(f => ({ ...f, classe: e.target.value }))}
                    className="sc-select"
                    style={{ padding: "8px 14px", fontSize: 13, borderRadius: 8, outline: "none", cursor: "pointer",
                      background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                      color: presFilter.classe ? "#a5b4fc" : "rgba(255,255,255,0.4)",
                      fontFamily: "Sora, sans-serif", minWidth: 160 }}>
                    <option value="" style={{ background: "#0d0d1a" }}>-- Groupe --</option>
                    {GROUPES.map(c => <option key={c} value={c} style={{ background: "#0d0d1a" }}>Groupe {c}</option>)}
                  </select>
                  {presFilter.classe && (
                    <button onClick={() => { setPresFilter({ niveau: "", classe: "" }); setPresJour(""); setPresSession(null); setPresDetail(null); }}
                      style={{ padding: "8px 14px", borderRadius: 8, background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.45)",
                        cursor: "pointer", fontSize: 12, fontFamily: "Sora, sans-serif" }}>
                      ✕ Effacer
                    </button>
                  )}
                </div>
              </Card>

              {/* ÉTAPE 2 — Sélection du jour (depuis emploi du temps) */}
              {presFilter.classe && (
                <Card>
                  <SectionTitle title="Choisir un jour" icon="📅" />
                  {joursDispos.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "28px 16px" }}>
                      <div style={{ fontSize: 28, marginBottom: 10 }}>📅</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.45)", marginBottom: 6 }}>
                        Aucun emploi du temps pour {presFilter.niveau ? `${presFilter.niveau} — Groupe ${presFilter.classe}` : `Groupe ${presFilter.classe}`}
                      </div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.25)" }}>
                        L'emploi du temps de ce niveau n'a pas encore été configuré dans Gestion → Emplois du temps
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {joursDispos.map(jour => (
                        <button key={jour} onClick={() => { setPresJour(jour); setPresSession(null); setPresDetail(null); }}
                          className="sc-btn"
                          style={{ padding: "10px 20px", borderRadius: 10,
                            background: presJour === jour ? "rgba(99,102,241,0.25)" : "rgba(255,255,255,0.04)",
                            border: presJour === jour ? "1px solid rgba(99,102,241,0.5)" : "1px solid rgba(255,255,255,0.08)",
                            color: presJour === jour ? "#a5b4fc" : "rgba(255,255,255,0.55)",
                            cursor: "pointer", fontSize: 13, fontWeight: presJour === jour ? 600 : 400,
                            fontFamily: "Sora, sans-serif" }}>
                          {jour}
                          <span style={{ marginLeft: 6, fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
                            ({emploisPourClasse.filter(e => e.jour === jour).length} cours)
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </Card>
              )}

              {/* ÉTAPE 3 — Liste des séances du jour */}
              {presJour && (
                <Card>
                  <SectionTitle title={`Séances du ${presJour} — ${presFilter.classe}`} icon="🎬" />
                  {seancesDuJour.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "28px 16px" }}>
                      <div style={{ fontSize: 28, marginBottom: 10 }}>📋</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.45)", marginBottom: 6 }}>
                        Aucune séance enregistrée le {presJour}
                      </div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", lineHeight: 1.6 }}>
                        Les séances apparaissent ici après que le professeur a pris les présences.<br />
                        Vous pouvez aussi en créer via la Surveillance (analyse vidéo).
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {seancesDuJour.map(s => (
                        <div key={s.id}
                          onClick={() => loadPresDetail(s)}
                          className="sc-tr"
                          style={{ padding: "14px 16px", borderRadius: 10,
                            background: presSession?.id === s.id ? "rgba(99,102,241,0.12)" : "rgba(255,255,255,0.02)",
                            border: presSession?.id === s.id ? "1px solid rgba(99,102,241,0.4)" : "1px solid rgba(255,255,255,0.06)",
                            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between",
                            flexWrap: "wrap", gap: 10 }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 14 }}>
                              {s.matiere || "Matière"} — {new Date(s.date + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                            </div>
                            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 3 }}>
                              {s.heure_debut}–{s.heure_fin} {s.salle ? `• Salle ${s.salle}` : ""}
                            </div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            {s.total_att > 0 && (
                              <div style={{ display: "flex", gap: 6 }}>
                                <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6,
                                  background: "rgba(34,197,94,0.1)", color: "#22c55e" }}>
                                  ✓ {s.present} présents
                                </span>
                                <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6,
                                  background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
                                  ✗ {s.total_att - s.present} absents
                                </span>
                              </div>
                            )}
                            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>Voir ›</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              )}

              {/* ÉTAPE 4 — Détail présences / absences */}
              {presSession && (
                <Card>
                  {presDetailLoading ? (
                    <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
                      <div className="sc-spinner" />
                    </div>
                  ) : presDetail?.error ? (
                    <div style={{ color: "#ef4444", fontSize: 13 }}>{presDetail.error}</div>
                  ) : presDetail ? (
                    <>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                        marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
                        <SectionTitle title={`${presDetail.session.matiere} — ${presDetail.session.date}`} icon="📋" />
                        <div style={{ display: "flex", gap: 8 }}>
                          <span style={{ padding: "4px 12px", borderRadius: 8, fontSize: 12,
                            background: "rgba(34,197,94,0.1)", color: "#22c55e", fontWeight: 600 }}>
                            ✓ {presDetail.stats.presents} présents
                          </span>
                          <span style={{ padding: "4px 12px", borderRadius: 8, fontSize: 12,
                            background: "rgba(250,204,21,0.1)", color: "#fbbf24", fontWeight: 600 }}>
                            ⏱ {presDetail.stats.retards} retards
                          </span>
                          <span style={{ padding: "4px 12px", borderRadius: 8, fontSize: 12,
                            background: "rgba(239,68,68,0.1)", color: "#ef4444", fontWeight: 600 }}>
                            ✗ {presDetail.stats.absents} absents
                          </span>
                          <span style={{ padding: "4px 12px", borderRadius: 8, fontSize: 12,
                            background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)" }}>
                            Total : {presDetail.stats.total}
                          </span>
                        </div>
                      </div>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                            {["Étudiant","Statut","Heure","Confiance"].map(h => (
                              <th key={h} style={{ padding: "10px 12px", textAlign: "left",
                                color: "rgba(255,255,255,0.4)", fontSize: 12 }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {presDetail.etudiants.map(e => (
                            <tr key={e.student_id} className="sc-tr"
                              style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                              <td style={{ padding: "11px 12px", fontWeight: 500 }}>
                                {e.prenom} {e.nom}
                              </td>
                              <td style={{ padding: "11px 12px" }}>
                                {e.status === "present" ? (
                                  <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                                    background: "rgba(34,197,94,0.12)", color: "#22c55e" }}>Présent</span>
                                ) : e.status === "retard" ? (
                                  <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                                    background: "rgba(250,204,21,0.12)", color: "#fbbf24" }}>Retard</span>
                                ) : (
                                  <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                                    background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>Absent</span>
                                )}
                              </td>
                              <td style={{ padding: "11px 12px", color: "rgba(255,255,255,0.45)", fontSize: 13 }}>
                                {e.detected_at || "—"}
                              </td>
                              <td style={{ padding: "11px 12px", color: "rgba(255,255,255,0.45)", fontSize: 13 }}>
                                {e.confidence ? `${e.confidence}%` : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  ) : null}
                </Card>
              )}
            </div>
          );
        })()}

        {/* Risques */}
        {activeTab === "risques" && (() => {
          // Filtre appliqué sur les données existantes
          const rfNiveau = risquesFilter.niveau;
          const rfClasse = risquesFilter.classe;

          // Risque absences : depuis l'API BI (déjà dans `risque`)
          const risqueAbsences = risque.filter(s =>
            (!rfNiveau || s.annee_scolaire === rfNiveau) &&
            (!rfClasse  || s.classe === rfClasse)
          );

          // Risque notes : étudiants avec moyenne < 10
          const moyennesEtudiant = {};
          notes.forEach(n => {
            if (!moyennesEtudiant[n.student_id])
              moyennesEtudiant[n.student_id] = { sum: 0, count: 0 };
            moyennesEtudiant[n.student_id].sum   += n.note;
            moyennesEtudiant[n.student_id].count += 1;
          });
          const risqueNotes = etudiants.filter(e => {
            if (rfNiveau && e.annee_scolaire !== rfNiveau) return false;
            if (rfClasse  && e.classe !== rfClasse) return false;
            const m = moyennesEtudiant[e.id];
            if (!m || m.count === 0) return false;
            return (m.sum / m.count) < 10;
          }).map(e => ({
            ...e,
            moyenne: +(moyennesEtudiant[e.id].sum / moyennesEtudiant[e.id].count).toFixed(2)
          }));

          return (
            <div className="sc-fade" style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Filtre */}
              <Card>
                <SectionTitle title="Étudiants à risque" icon="⚠️" />
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                  <select value={risquesFilter.niveau}
                    onChange={e => setRisquesFilter(f => ({ ...f, niveau: e.target.value, classe: "" }))}
                    className="sc-select"
                    style={{ padding: "8px 14px", fontSize: 13, borderRadius: 8, outline: "none", cursor: "pointer",
                      background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                      color: risquesFilter.niveau ? "#a5b4fc" : "rgba(255,255,255,0.4)",
                      fontFamily: "Sora, sans-serif", minWidth: 160 }}>
                    <option value="" style={{ background: "#0d0d1a" }}>-- Tous les niveaux --</option>
                    {dynNiveaux.map(n => <option key={n} value={n} style={{ background: "#0d0d1a" }}>{n}</option>)}
                  </select>
                  <select value={risquesFilter.classe}
                    onChange={e => setRisquesFilter(f => ({ ...f, classe: e.target.value }))}
                    className="sc-select"
                    style={{ padding: "8px 14px", fontSize: 13, borderRadius: 8, outline: "none", cursor: "pointer",
                      background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                      color: risquesFilter.classe ? "#a5b4fc" : "rgba(255,255,255,0.4)",
                      fontFamily: "Sora, sans-serif", minWidth: 160 }}>
                    <option value="" style={{ background: "#0d0d1a" }}>-- Tous les groupes --</option>
                    {GROUPES.map(c => <option key={c} value={c} style={{ background: "#0d0d1a" }}>Groupe {c}</option>)}
                  </select>
                  {(risquesFilter.niveau || risquesFilter.classe) && (
                    <button onClick={() => setRisquesFilter({ niveau: "", classe: "" })}
                      style={{ padding: "8px 14px", borderRadius: 8, background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.45)",
                        cursor: "pointer", fontSize: 12, fontFamily: "Sora, sans-serif" }}>
                      ✕ Effacer
                    </button>
                  )}
                </div>
              </Card>

              {/* Section 1 : Risque Absences */}
              <Card>
                <SectionTitle title={`Risque — Absences excessives (${risqueAbsences.length})`} icon="🔴" />
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 12 }}>
                  Étudiants dépassant le seuil de 3 absences par semaine
                </div>
                {risqueAbsences.length === 0 ? (
                  <EmptyState message="Aucun étudiant à risque d'absences dans ce groupe 🎉" />
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {risqueAbsences.map((s, i) => (
                      <div key={i} style={{ background: "rgba(239,68,68,0.05)",
                        border: "1px solid rgba(239,68,68,0.13)",
                        borderRadius: 10, padding: "14px 16px",
                        display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                        <div style={{ width: 38, height: 38, borderRadius: 9,
                          background: "rgba(239,68,68,0.14)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 17, flexShrink: 0 }}>🔴</div>
                        <div style={{ flex: 1, minWidth: 120 }}>
                          <div style={{ fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                            {s.prenom} {s.nom}
                            <span style={{ background: "rgba(99,102,241,0.15)", color: "#6366f1",
                              fontSize: 11, padding: "2px 8px", borderRadius: 6 }}>Classe {s.classe}</span>
                          </div>
                          <div style={{ color: "rgba(255,255,255,0.38)", fontSize: 12, marginTop: 3 }}>
                            {s.raisons?.join(" · ") || "Absences excessives"}
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ color: "#ef4444", fontWeight: 700, fontSize: 20 }}>{s.absences}</div>
                            <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>absences</div>
                          </div>
                          <button
                            disabled={risquesAlertSent[s.id + "absences"]}
                            onClick={() => sendRisqueAlerte(s, "absences")}
                            className="sc-btn"
                            style={{ padding: "8px 14px", borderRadius: 8,
                              background: risquesAlertSent[s.id + "absences"] ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.15)",
                              border: risquesAlertSent[s.id + "absences"] ? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(239,68,68,0.3)",
                              color: risquesAlertSent[s.id + "absences"] ? "#22c55e" : "#f87171",
                              cursor: risquesAlertSent[s.id + "absences"] ? "default" : "pointer",
                              fontSize: 12, fontFamily: "Sora, sans-serif", whiteSpace: "nowrap" }}>
                            {risquesAlertSent[s.id + "absences"] ? "✓ Alerte envoyée" : "🔔 Envoyer alerte"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Section 2 : Risque Notes */}
              <Card>
                <SectionTitle title={`Risque — Notes insuffisantes (${risqueNotes.length})`} icon="📉" />
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 12 }}>
                  Étudiants avec une moyenne générale inférieure à 10/20
                </div>
                {risqueNotes.length === 0 ? (
                  <EmptyState message="Aucun étudiant en difficulté scolaire dans ce groupe 🎉" />
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {risqueNotes.map((s, i) => (
                      <div key={i} style={{ background: "rgba(245,158,11,0.05)",
                        border: "1px solid rgba(245,158,11,0.13)",
                        borderRadius: 10, padding: "14px 16px",
                        display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                        <div style={{ width: 38, height: 38, borderRadius: 9,
                          background: "rgba(245,158,11,0.14)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 17, flexShrink: 0 }}>📉</div>
                        <div style={{ flex: 1, minWidth: 120 }}>
                          <div style={{ fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                            {s.prenom} {s.nom}
                            <span style={{ background: "rgba(99,102,241,0.15)", color: "#6366f1",
                              fontSize: 11, padding: "2px 8px", borderRadius: 6 }}>Classe {s.classe}</span>
                          </div>
                          <div style={{ color: "rgba(255,255,255,0.38)", fontSize: 12, marginTop: 3 }}>
                            {s.annee_scolaire || ""}
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ color: "#f59e0b", fontWeight: 700, fontSize: 20 }}>{s.moyenne}/20</div>
                            <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>moyenne</div>
                          </div>
                          <button
                            disabled={risquesAlertSent[s.id + "notes"]}
                            onClick={() => sendRisqueAlerte(s, "notes")}
                            className="sc-btn"
                            style={{ padding: "8px 14px", borderRadius: 8,
                              background: risquesAlertSent[s.id + "notes"] ? "rgba(34,197,94,0.1)" : "rgba(245,158,11,0.12)",
                              border: risquesAlertSent[s.id + "notes"] ? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(245,158,11,0.25)",
                              color: risquesAlertSent[s.id + "notes"] ? "#22c55e" : "#fbbf24",
                              cursor: risquesAlertSent[s.id + "notes"] ? "default" : "pointer",
                              fontSize: 12, fontFamily: "Sora, sans-serif", whiteSpace: "nowrap" }}>
                            {risquesAlertSent[s.id + "notes"] ? "✓ Alerte envoyée" : "🔔 Envoyer alerte"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          );
        })()}

        {/* Notes */}
        {activeTab === "notes" && (() => {
          // Niveaux et groupes dérivés des étudiants réels en base
          // Toujours afficher les 5 niveaux dans le dropdown
          const notesNiveaux = dynNiveaux;
          // Groupes filtrés par niveau sélectionné
          const notesGroupes = notesPageFiltre.niveau
            ? [...new Set(
                etudiants
                  .filter(e => e.annee_scolaire === notesPageFiltre.niveau)
                  .map(e => e.classe).filter(Boolean)
              )].sort()
            : [...new Set(etudiants.map(e => e.classe).filter(Boolean))].sort();
          // Étudiants de la classe sélectionnée
          const notesEtudiants = etudiants.filter(e =>
            (!notesPageFiltre.niveau || e.annee_scolaire === notesPageFiltre.niveau) &&
            (!notesPageFiltre.classe  || e.classe === notesPageFiltre.classe)
          );
          // Moyennes par étudiant
          const avgMap = {};
          notes.forEach(n => {
            if (!avgMap[n.student_id]) avgMap[n.student_id] = { sum: 0, cnt: 0 };
            avgMap[n.student_id].sum += n.note;
            avgMap[n.student_id].cnt += 1;
          });
          const avgOf = id => {
            const m = avgMap[String(id)];
            return m && m.cnt > 0 ? (m.sum / m.cnt).toFixed(1) : null;
          };
          // Notes de l'étudiant sélectionné, groupées par matière
          const studentNotes = notesPageStudent
            ? notes.filter(n => String(n.student_id) === String(notesPageStudent.id))
            : [];
          const notesByMat = {};
          studentNotes.forEach(n => {
            if (!notesByMat[n.matiere]) notesByMat[n.matiere] = [];
            notesByMat[n.matiere].push(n);
          });
          // Matières disponibles pour la classe sélectionnée
          const matieresPourClasse = matieres.filter(m =>
            !notesPageFiltre.niveau || m.annee_scolaire === notesPageFiltre.niveau
          );
          return (
          <div className="sc-fade" style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* ── Filtre niveau + groupe ── */}
            <Card>
              <SectionTitle title="Notes par classe" icon="📝" />
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <select value={notesPageFiltre.niveau}
                  onChange={e => { setNotesPageFiltre({ niveau: e.target.value, classe: "" }); setNotesPageStudent(null); }}
                  style={{ padding: "9px 14px", background: notesPageFiltre.niveau ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.05)",
                    border: notesPageFiltre.niveau ? "1px solid rgba(99,102,241,0.4)" : "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 9, color: notesPageFiltre.niveau ? "#a5b4fc" : "rgba(255,255,255,0.4)",
                    fontFamily: "Sora, sans-serif", fontSize: 13, outline: "none", minWidth: 160 }}>
                  <option value="" style={{ background: "#0d0d1a" }}>-- Niveau --</option>
                  {notesNiveaux.map(n => <option key={n} value={n} style={{ background: "#0d0d1a" }}>{n}</option>)}
                </select>
                <select value={notesPageFiltre.classe}
                  onChange={e => { setNotesPageFiltre(f => ({ ...f, classe: e.target.value })); setNotesPageStudent(null); }}
                  disabled={!notesPageFiltre.niveau || notesGroupes.length === 0}
                  style={{ padding: "9px 14px", background: notesPageFiltre.classe ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.05)",
                    border: notesPageFiltre.classe ? "1px solid rgba(99,102,241,0.4)" : "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 9, color: notesPageFiltre.classe ? "#a5b4fc" : "rgba(255,255,255,0.4)",
                    fontFamily: "Sora, sans-serif", fontSize: 13, outline: "none", minWidth: 130,
                    opacity: (notesPageFiltre.niveau && notesGroupes.length > 0) ? 1 : 0.5 }}>
                  <option value="" style={{ background: "#0d0d1a" }}>
                    {notesPageFiltre.niveau && notesGroupes.length === 0 ? "Chargement..." : "-- Groupe --"}
                  </option>
                  {notesGroupes.map(g => <option key={g} value={g} style={{ background: "#0d0d1a" }}>Groupe {g}</option>)}
                </select>
                {(notesPageFiltre.niveau || notesPageFiltre.classe) && (
                  <button onClick={() => { setNotesPageFiltre({ niveau: "", classe: "" }); setNotesPageStudent(null); }}
                    style={{ padding: "8px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)",
                      borderRadius: 9, color: "#f87171", cursor: "pointer", fontSize: 12, fontFamily: "Sora, sans-serif" }}>
                    ✕ Effacer
                  </button>
                )}
              </div>
            </Card>

            {/* ── Modal notes étudiant ── */}
            {notesPageStudent && (
              <div onClick={() => { setNotesPageStudent(null); setEditNote(null); setNoteMsg(""); }}
                style={{ position: "fixed", inset: 0, zIndex: 300,
                  background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)",
                  display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
                <div onClick={e => e.stopPropagation()}
                  style={{ background: "#0d0d1a", border: "1px solid rgba(255,255,255,0.09)",
                    borderRadius: 16, width: "100%", maxWidth: 680,
                    maxHeight: "90vh", display: "flex", flexDirection: "column",
                    boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }}>

                  {/* En-tête modal */}
                  <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)",
                    display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
                    <div style={{ width: 42, height: 42, borderRadius: "50%", flexShrink: 0,
                      background: "#6366f1", display: "flex", alignItems: "center",
                      justifyContent: "center", fontWeight: 700, fontSize: 16, color: "#fff" }}>
                      {notesPageStudent.prenom[0]}{notesPageStudent.nom[0]}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 16, color: "#f1f5f9" }}>
                        {notesPageStudent.prenom} {notesPageStudent.nom}
                      </div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>
                        {notesPageFiltre.niveau} — Groupe {notesPageFiltre.classe}
                      </div>
                    </div>
                    {avgOf(notesPageStudent.id) && (
                      <div style={{ textAlign: "center", padding: "8px 16px",
                        background: parseFloat(avgOf(notesPageStudent.id)) >= 10 ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
                        border: `1px solid ${parseFloat(avgOf(notesPageStudent.id)) >= 10 ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.25)"}`,
                        borderRadius: 10 }}>
                        <div style={{ fontSize: 22, fontWeight: 700,
                          color: parseFloat(avgOf(notesPageStudent.id)) >= 10 ? "#10b981" : "#ef4444" }}>
                          {avgOf(notesPageStudent.id)}/20
                        </div>
                        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 2,
                          textTransform: "uppercase", letterSpacing: "0.05em" }}>Moyenne</div>
                      </div>
                    )}
                    <button onClick={() => { setNotesPageStudent(null); setEditNote(null); setNoteMsg(""); }}
                      style={{ width: 30, height: 30, borderRadius: 7, border: "1px solid rgba(255,255,255,0.08)",
                        background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)",
                        cursor: "pointer", fontSize: 14, flexShrink: 0, display: "flex",
                        alignItems: "center", justifyContent: "center" }}>✕</button>
                  </div>

                  {/* Corps scrollable */}
                  <div style={{ overflowY: "auto", padding: "16px 24px", flex: 1 }}>

                    {/* Tableau des matières */}
                    {matieresPourClasse.length === 0 ? (
                      <EmptyState message="Aucune matière configurée pour ce niveau" />
                    ) : (
                      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 20 }}>
                        <thead>
                          <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                            {["Matière","Notes","Moyenne"].map(h => (
                              <th key={h} style={{ padding: "9px 14px", textAlign: "left",
                                fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.35)",
                                textTransform: "uppercase", letterSpacing: "0.05em",
                                borderBottom: "1px solid rgba(255,255,255,0.06)" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {matieresPourClasse.map((mat, idx) => {
                            const matNotes = notesByMat[mat.nom] || [];
                            const matAvg = matNotes.length > 0
                              ? (matNotes.reduce((s, n) => s + n.note, 0) / matNotes.length).toFixed(1)
                              : null;
                            const avgColor = !matAvg ? "rgba(255,255,255,0.2)"
                              : parseFloat(matAvg) >= 14 ? "#10b981"
                              : parseFloat(matAvg) >= 10 ? "#f59e0b" : "#ef4444";
                            return (
                              <tr key={mat.id} style={{
                                borderBottom: idx < matieresPourClasse.length - 1
                                  ? "1px solid rgba(255,255,255,0.04)" : "none",
                              }}>
                                {/* Matière */}
                                <td style={{ padding: "12px 14px", fontWeight: 500, fontSize: 13, color: "#e2e8f0" }}>
                                  {mat.nom}
                                </td>

                                {/* Notes */}
                                <td style={{ padding: "12px 14px" }}>
                                  {matNotes.length === 0 ? (
                                    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.18)", fontStyle: "italic" }}>
                                      Aucune note
                                    </span>
                                  ) : (
                                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                                      {matNotes.map((n, i) => (
                                        <div key={i} style={{ display: "inline-flex", alignItems: "center", gap: 5,
                                          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
                                          borderRadius: 6, padding: "3px 9px", fontSize: 12 }}>
                                          <span style={{ fontWeight: 700,
                                            color: n.note >= 10 ? "#10b981" : "#ef4444" }}>{n.note}</span>
                                          <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 10 }}>/{20}</span>
                                          <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 10,
                                            background: "rgba(255,255,255,0.04)", borderRadius: 4,
                                            padding: "1px 5px" }}>{n.type}</span>
                                          {n.date && (
                                            <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 10 }}>
                                              {n.date}
                                            </span>
                                          )}
                                          <button onClick={() => setEditNote(n)}
                                            style={{ background: "none", border: "none", color: "#6366f1",
                                              cursor: "pointer", fontSize: 10, padding: "0 2px",
                                              lineHeight: 1 }}>✎</button>
                                          <button onClick={() => deleteNote(n.id)}
                                            style={{ background: "none", border: "none", color: "rgba(239,68,68,0.6)",
                                              cursor: "pointer", fontSize: 10, padding: "0 2px",
                                              lineHeight: 1 }}>✕</button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </td>

                                {/* Moyenne matière */}
                                <td style={{ padding: "12px 14px", textAlign: "right" }}>
                                  <span style={{ fontWeight: 700, fontSize: 15, color: avgColor }}>
                                    {matAvg ? `${matAvg}/20` : "—"}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}

                    {/* Séparateur */}
                    <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "4px 0 16px" }} />

                    {/* Formulaire ajout / modification note */}
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.5)",
                        textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>
                        {editNote ? "Modifier la note" : "Ajouter une note"}
                      </div>
                      {noteMsg && (
                        <div style={{ marginBottom: 12, padding: "8px 12px", borderRadius: 7, fontSize: 12,
                          background: noteMsg === "ok" ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
                          border: `1px solid ${noteMsg === "ok" ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}`,
                          color: noteMsg === "ok" ? "#10b981" : "#ef4444" }}>
                          {noteMsg === "ok" ? "Note enregistrée avec succès" : noteMsg.replace("err:", "")}
                        </div>
                      )}
                      {editNote ? (
                        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                          <div style={{ flex: 1, padding: "8px 12px", background: "rgba(99,102,241,0.07)",
                            border: "1px solid rgba(99,102,241,0.15)", borderRadius: 7,
                            fontSize: 12, color: "rgba(255,255,255,0.6)" }}>{editNote.matiere}</div>
                          <Input placeholder="Note /20" type="number" value={editNote.note}
                            onChange={e => setEditNote(n => ({...n, note: e.target.value}))}
                            style={{ width: 100 }} />
                          <Select value={editNote.type} onChange={e => setEditNote(n => ({...n, type: e.target.value}))}
                            style={{ width: 120 }}>
                            <option value="controle">Contrôle</option>
                            <option value="examen">Examen</option>
                            <option value="tp">TP</option>
                          </Select>
                          <Btn onClick={saveEditNote}>Enregistrer</Btn>
                          <Btn onClick={() => setEditNote(null)} color="rgba(255,255,255,0.06)"
                            style={{ color: "rgba(255,255,255,0.4)" }}>Annuler</Btn>
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
                          <Select value={formNote.matiere_id}
                            onChange={e => setFormNote(f => ({...f, matiere_id: e.target.value}))}
                            style={{ flex: 2, minWidth: 160 }}>
                            <option value="">-- Matière --</option>
                            {matieresPourClasse.map(m => (
                              <option key={m.id} value={m.id}>{m.nom}</option>
                            ))}
                          </Select>
                          <Input placeholder="Note /20" type="number" min="0" max="20" step="0.25"
                            value={formNote.note}
                            onChange={e => setFormNote(f => ({...f, note: e.target.value}))}
                            style={{ width: 100 }} />
                          <Select value={formNote.type}
                            onChange={e => setFormNote(f => ({...f, type: e.target.value}))}
                            style={{ width: 110 }}>
                            <option value="controle">Contrôle</option>
                            <option value="examen">Examen</option>
                            <option value="tp">TP</option>
                          </Select>
                          <Input placeholder="Date" type="date" value={formNote.date}
                            onChange={e => setFormNote(f => ({...f, date: e.target.value}))}
                            style={{ width: 130 }} />
                          <Btn disabled={!formNote.matiere_id || formNote.note === ""}
                            onClick={async () => {
                              if (!formNote.matiere_id || formNote.note === "") return;
                              const payload = { ...formNote, student_id: String(notesPageStudent.id), note: parseFloat(formNote.note) };
                              try {
                                await axios.post(`${API_URL}/api/gestion/notes`, payload, authHeaders());
                                setNoteMsg("ok");
                                setFormNote({ student_id:"", matiere_id:"", note:"", type:"controle", commentaire:"", date:"" });
                                loadNotes();
                              } catch (e) { setNoteMsg("err:" + (e.response?.data?.detail || "Erreur")); }
                              finally { setTimeout(() => setNoteMsg(""), 3000); }
                            }}>Ajouter</Btn>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Pas de filtre ── */}
            {!notesPageFiltre.classe ? (
              <div style={{ textAlign: "center", padding: "60px 20px", color: "rgba(255,255,255,0.2)" }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.35)", marginBottom: 6 }}>
                  Sélectionnez un niveau et un groupe
                </div>
                <div style={{ fontSize: 12 }}>pour afficher la liste des étudiants</div>
              </div>
            ) : (
              <Card>
                <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
                  <SectionTitle title={`${notesPageFiltre.niveau} — Groupe ${notesPageFiltre.classe} (${notesEtudiants.length})`} />
                  <Btn onClick={exportNotes} color="rgba(16,185,129,0.15)"
                    style={{ marginLeft: "auto", border: "1px solid rgba(16,185,129,0.25)", color: "#10b981",
                      padding: "5px 12px", fontSize: 11 }}>
                    Export CSV
                  </Btn>
                </div>
                {notesEtudiants.length === 0 ? (
                  <EmptyState message="Aucun étudiant dans ce groupe" />
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                        {["Étudiant","Notes saisies","Moyenne",""].map((h, i) => (
                          <th key={i} style={{ padding: "9px 14px", textAlign: i === 3 ? "right" : "left",
                            fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.35)",
                            textTransform: "uppercase", letterSpacing: "0.05em",
                            borderBottom: "1px solid rgba(255,255,255,0.06)" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {notesEtudiants.map((s, idx) => {
                        const avg = avgOf(s.id);
                        const cnt = avgMap[String(s.id)]?.cnt || 0;
                        const avgColor = avg === null ? "rgba(255,255,255,0.2)"
                          : parseFloat(avg) >= 14 ? "#10b981"
                          : parseFloat(avg) >= 10 ? "#f59e0b" : "#ef4444";
                        return (
                          <tr key={s.id} className="sc-tr" style={{
                            borderBottom: idx < notesEtudiants.length - 1
                              ? "1px solid rgba(255,255,255,0.04)" : "none",
                          }}>
                            <td style={{ padding: "12px 14px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <div style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                                  background: "rgba(99,102,241,0.15)",
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  fontWeight: 600, fontSize: 12, color: "#a5b4fc" }}>
                                  {s.prenom[0]}{s.nom[0]}
                                </div>
                                <div>
                                  <div style={{ fontWeight: 500, fontSize: 13, color: "#e2e8f0" }}>{s.prenom} {s.nom}</div>
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: "12px 14px", fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
                              {cnt > 0 ? `${cnt} note${cnt > 1 ? "s" : ""}` : <span style={{ color: "rgba(255,255,255,0.18)", fontStyle: "italic" }}>Aucune</span>}
                            </td>
                            <td style={{ padding: "12px 14px" }}>
                              <span style={{ fontWeight: 700, fontSize: 15, color: avgColor }}>
                                {avg ? `${avg}/20` : "—"}
                              </span>
                            </td>
                            <td style={{ padding: "12px 14px", textAlign: "right" }}>
                              <button onClick={() => setNotesPageStudent(s)}
                                style={{ padding: "5px 14px", borderRadius: 6, border: "1px solid rgba(99,102,241,0.25)",
                                  background: "rgba(99,102,241,0.08)", color: "#a5b4fc",
                                  cursor: "pointer", fontSize: 12, fontFamily: F, fontWeight: 500 }}>
                                Voir les notes
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </Card>
            )}
          </div>
          );
        })()}

        {false && (() => {
          const notesEtudiants = etudiants.filter(e =>
            (!notesPageFiltre.niveau || e.annee_scolaire === notesPageFiltre.niveau) &&
            (!notesPageFiltre.classe  || e.classe === notesPageFiltre.classe)
          );
          const etudiantNotes = notesPageStudent
            ? notes.filter(n => n.student_id === notesPageStudent.id)
            : [];
          return (
            <div className="sc-fade" style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Étape 1 : Sélection niveau + classe */}
              <Card>
                <SectionTitle title="Notes par classe" icon="📝" />
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                  <select value={notesPageFiltre.niveau}
                    onChange={e => setNotesPageFiltre(f => ({...f, niveau: e.target.value, classe: ""}))}
                    style={{
                      padding: "8px 14px", fontSize: 13, borderRadius: 8, outline: "none", cursor: "pointer",
                      background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                      color: notesPageFiltre.niveau ? "#a5b4fc" : "rgba(255,255,255,0.4)",
                      fontFamily: "Sora, sans-serif", minWidth: 160,
                    }}>
                    <option value="" style={{ background: "#0d0d1a" }}>-- Sélectionner le niveau --</option>
                    {dynNiveaux.map(n => <option key={n} value={n} style={{ background: "#0d0d1a" }}>{n}</option>)}
                  </select>
                  <select value={notesPageFiltre.classe}
                    onChange={e => { setNotesPageFiltre(f => ({...f, classe: e.target.value})); setNotesPageStudent(null); }}
                    style={{
                      padding: "8px 14px", fontSize: 13, borderRadius: 8, outline: "none", cursor: "pointer",
                      background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                      color: notesPageFiltre.classe ? "#a5b4fc" : "rgba(255,255,255,0.4)",
                      fontFamily: "Sora, sans-serif", minWidth: 130,
                    }}>
                    <option value="" style={{ background: "#0d0d1a" }}>-- Groupe --</option>
                    {dynGroupes.map(g => <option key={g} value={g} style={{ background: "#0d0d1a" }}>Groupe {g}</option>)}
                  </select>
                  {notesPageStudent && (
                    <button onClick={() => setNotesPageStudent(null)} style={{
                      padding: "7px 14px", background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8,
                      color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: 12,
                      fontFamily: "Sora, sans-serif",
                    }}>← Retour liste</button>
                  )}
                </div>
              </Card>

              {/* Étape 2 : Liste des étudiants */}
              {notesPageFiltre.classe && !notesPageStudent && (
                <Card>
                  <SectionTitle title={`Étudiants — Groupe ${notesPageFiltre.classe}`} icon="🎓" />
                  {notesEtudiants.length === 0 ? (
                    <EmptyState message="Aucun étudiant dans ce groupe" />
                  ) : (
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                          {["Étudiant","Classe","Niveau","Notes"].map(h => (
                            <th key={h} style={{ padding: "10px 12px", textAlign: "left",
                              color: "rgba(255,255,255,0.4)", fontSize: 12 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {notesEtudiants.map(e => {
                          const nbNotes = notes.filter(n => n.student_id === e.id).length;
                          return (
                            <tr key={e.id} className="sc-tr"
                              onClick={() => { loadNotes(); setNotesPageStudent(e); }}
                              style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", cursor: "pointer" }}>
                              <td style={{ padding: "11px 12px", fontWeight: 500 }}>{e.prenom} {e.nom}</td>
                              <td style={{ padding: "11px 12px" }}>
                                <span style={{ background: "rgba(99,102,241,0.15)", color: "#a5b4fc",
                                  padding: "2px 8px", borderRadius: 6, fontSize: 12 }}>{e.classe}</span>
                              </td>
                              <td style={{ padding: "11px 12px", fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                                {e.annee_scolaire || "—"}
                              </td>
                              <td style={{ padding: "11px 12px" }}>
                                <span style={{ fontSize: 12, color: nbNotes > 0 ? "#22c55e" : "rgba(255,255,255,0.3)" }}>
                                  {nbNotes} note{nbNotes !== 1 ? "s" : ""}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </Card>
              )}

              {/* Étape 3 : Notes d'un étudiant */}
              {notesPageStudent && (
                <Card>
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>
                      {notesPageStudent.prenom} {notesPageStudent.nom}
                    </div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                      {notesPageStudent.classe} • {notesPageStudent.annee_scolaire}
                    </div>
                  </div>
                  {etudiantNotes.length === 0 ? (
                    <EmptyState message="Aucune note enregistrée pour cet étudiant" />
                  ) : (
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                          {["Matière","Note","Type","Date","Commentaire"].map(h => (
                            <th key={h} style={{ padding: "10px 12px", textAlign: "left",
                              color: "rgba(255,255,255,0.4)", fontSize: 12 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {etudiantNotes.map(n => (
                          <tr key={n.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                            <td style={{ padding: "11px 12px", fontWeight: 500 }}>
                              {matieres.find(m => m.id === n.matiere_id)?.nom || `Matière ${n.matiere_id}`}
                            </td>
                            <td style={{ padding: "11px 12px" }}>
                              <span style={{
                                fontWeight: 700, fontSize: 15,
                                color: n.note >= 10 ? "#22c55e" : "#ef4444",
                              }}>{n.note}/20</span>
                            </td>
                            <td style={{ padding: "11px 12px" }}>
                              <span style={{ background: "rgba(14,165,233,0.12)", color: "#7dd3fc",
                                padding: "2px 8px", borderRadius: 6, fontSize: 11 }}>{n.type}</span>
                            </td>
                            <td style={{ padding: "11px 12px", fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                              {n.date ? new Date(n.date).toLocaleDateString("fr-FR") : "—"}
                            </td>
                            <td style={{ padding: "11px 12px", fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                              {n.commentaire || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </Card>
              )}

              {!notesPageFiltre.classe && (
                <div style={{ textAlign: "center", padding: "48px 20px", color: "rgba(255,255,255,0.25)" }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>📝</div>
                  <div>Sélectionnez un niveau et un groupe pour afficher les notes</div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Alertes */}
        {activeTab === "alertes" && (
          <div className="sc-fade" style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Formulaire création alerte */}
            <Card>
              <SectionTitle title="Envoyer une alerte" icon="🔔" />
              {alerteMsg && (
                <div style={{
                  padding: "10px 14px", borderRadius: 8, marginBottom: 12, fontSize: 13,
                  background: alerteMsg.startsWith("ok") ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                  border: `1px solid ${alerteMsg.startsWith("ok") ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
                  color: alerteMsg.startsWith("ok") ? "#22c55e" : "#ef4444",
                }}>
                  {alerteMsg.startsWith("ok") ? `✅ Alerte envoyée (${alerteMsg.split(":")[1]} destinataires)` : `❌ ${alerteMsg.replace("err:", "")}`}
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", gap: 10 }}>
                  <select value={formAlerte.cible}
                    onChange={e => setFormAlerte(f => ({...f, cible: e.target.value, student_id: "", annee_scolaire: "", classe: ""}))}
                    style={{ flex: 1, padding: "8px 12px", background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8,
                      color: "rgba(255,255,255,0.7)", fontFamily: "Sora, sans-serif", fontSize: 13, outline: "none" }}>
                    <option value="etudiant" style={{ background: "#0d0d1a" }}>Un étudiant</option>
                    <option value="classe" style={{ background: "#0d0d1a" }}>Une classe entière</option>
                  </select>
                  <select value={formAlerte.severity}
                    onChange={e => setFormAlerte(f => ({...f, severity: e.target.value}))}
                    style={{ flex: 1, padding: "8px 12px", background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8,
                      color: "rgba(255,255,255,0.7)", fontFamily: "Sora, sans-serif", fontSize: 13, outline: "none" }}>
                    <option value="low"    style={{ background: "#0d0d1a" }}>🟢 Faible</option>
                    <option value="medium" style={{ background: "#0d0d1a" }}>🟡 Moyen</option>
                    <option value="high"   style={{ background: "#0d0d1a" }}>🔴 Urgent</option>
                  </select>
                  <select value={formAlerte.type}
                    onChange={e => setFormAlerte(f => ({...f, type: e.target.value}))}
                    style={{ flex: 1, padding: "8px 12px", background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8,
                      color: "rgba(255,255,255,0.7)", fontFamily: "Sora, sans-serif", fontSize: 13, outline: "none" }}>
                    <option value="information"        style={{ background: "#0d0d1a" }}>Information</option>
                    <option value="avertissement"      style={{ background: "#0d0d1a" }}>Avertissement</option>
                    <option value="convocation"        style={{ background: "#0d0d1a" }}>Convocation</option>
                    <option value="absences_excessives" style={{ background: "#0d0d1a" }}>Absences excessives</option>
                  </select>
                </div>

                {formAlerte.cible === "etudiant" ? (
                  <select value={formAlerte.student_id}
                    onChange={e => setFormAlerte(f => ({...f, student_id: e.target.value}))}
                    style={{ padding: "8px 12px", background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8,
                      color: "rgba(255,255,255,0.7)", fontFamily: "Sora, sans-serif", fontSize: 13, outline: "none" }}>
                    <option value="" style={{ background: "#0d0d1a" }}>-- Sélectionner un étudiant --</option>
                    {etudiants.map(e => (
                      <option key={e.id} value={e.id} style={{ background: "#0d0d1a" }}>
                        {e.prenom} {e.nom} ({e.classe})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div style={{ display: "flex", gap: 10 }}>
                    <select value={formAlerte.annee_scolaire}
                      onChange={e => setFormAlerte(f => ({...f, annee_scolaire: e.target.value, classe: ""}))}
                      style={{ flex: 1, padding: "8px 12px", background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8,
                        color: "rgba(255,255,255,0.7)", fontFamily: "Sora, sans-serif", fontSize: 13, outline: "none" }}>
                      <option value="" style={{ background: "#0d0d1a" }}>-- Niveau --</option>
                      {dynNiveaux.map(n => <option key={n} value={n} style={{ background: "#0d0d1a" }}>{n}</option>)}
                    </select>
                    <select value={formAlerte.classe}
                      onChange={e => setFormAlerte(f => ({...f, classe: e.target.value}))}
                      style={{ flex: 1, padding: "8px 12px", background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8,
                        color: "rgba(255,255,255,0.7)", fontFamily: "Sora, sans-serif", fontSize: 13, outline: "none" }}>
                      <option value="" style={{ background: "#0d0d1a" }}>-- Groupe --</option>
                      {dynGroupes.map(g => <option key={g} value={g} style={{ background: "#0d0d1a" }}>Groupe {g}</option>)}
                    </select>
                  </div>
                )}

                <textarea value={formAlerte.message}
                  onChange={e => setFormAlerte(f => ({...f, message: e.target.value}))}
                  placeholder="Message de l'alerte..."
                  rows={3}
                  style={{ padding: "10px 14px", background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8,
                    color: "#fff", fontFamily: "Sora, sans-serif", fontSize: 13,
                    outline: "none", resize: "vertical" }} />

                <button onClick={sendAlerte} className="sc-btn" style={{
                  padding: "10px 20px", background: "#6366f1", border: "none",
                  borderRadius: 9, color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600,
                  fontFamily: "Sora, sans-serif", alignSelf: "flex-start",
                  opacity: !formAlerte.message.trim() ? 0.5 : 1,
                }}>Envoyer l'alerte</button>
              </div>
            </Card>

            {/* Liste des alertes récentes */}
            <Card>
              <SectionTitle title="Alertes récentes" icon="📋" />
              {alertes.length === 0 ? <EmptyState message="Aucune alerte" /> :
                alertes.map((a, i) => (
                  <div key={i} style={{
                    background: `${severityColor(a.severity)}0d`,
                    border: `1px solid ${severityColor(a.severity)}25`,
                    borderLeft: `3px solid ${severityColor(a.severity)}`,
                    borderRadius: 10, padding: "12px 16px",
                    display: "flex", alignItems: "center", gap: 12, marginBottom: 8,
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{a.message}</div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 4 }}>
                        {new Date(a.created_at).toLocaleDateString("fr-FR")} • {a.type}
                      </div>
                    </div>
                    <span style={{
                      fontSize: 10, padding: "3px 10px", borderRadius: 100,
                      background: `${severityColor(a.severity)}20`,
                      color: severityColor(a.severity), fontWeight: 700,
                      textTransform: "uppercase",
                    }}>{a.severity}</span>
                  </div>
                ))
              }
            </Card>
          </div>
        )}

        {/* Prédiction IA */}
        {activeTab === "prediction" && (
          <div className="sc-fade" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {predLoading ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", gap: 16, padding: "80px 20px" }}>
                <div className="sc-spinner" />
                <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, fontWeight: 500 }}>
                  Analyse en cours avec Claude AI...
                </span>
              </div>
            ) : !prediction ? (
              <EmptyState message="Aucune donnée disponible" />
            ) : (
              <>
                {/* Stat cards */}
                <div style={{ display: "grid", gridTemplateColumns: bp.colsAuto, gap: bp.gap2 }}>
                  {[
                    { label: "Critique",  key: "critique", color: "#ef4444", sub: "score ≥ 70", icon: "🔴" },
                    { label: "Élevé",     key: "eleve",    color: "#f97316", sub: "score ≥ 45", icon: "🟠" },
                    { label: "Modéré",    key: "modere",   color: "#f59e0b", sub: "score ≥ 20", icon: "🟡" },
                    { label: "Faible",    key: "faible",   color: "#22c55e", sub: "score < 20", icon: "🟢" },
                  ].map(({ label, key, color, sub, icon }) => (
                    <StatCard key={key} icon={icon} label={label} color={color}
                      value={prediction.stats[key]} sub={sub} />
                  ))}
                </div>

                {/* Barre de distribution */}
                {prediction.stats.total > 0 && (
                  <Card>
                    <SectionTitle title="Distribution des risques" icon="📊" />
                    <div style={{ display: "flex", height: 10, borderRadius: 6, overflow: "hidden", gap: 2 }}>
                      {[
                        { key: "critique", color: "#ef4444" },
                        { key: "eleve",    color: "#f97316" },
                        { key: "modere",   color: "#f59e0b" },
                        { key: "faible",   color: "#22c55e" },
                      ].map(({ key, color }) =>
                        prediction.stats[key] > 0 ? (
                          <div key={key} style={{ flex: prediction.stats[key], background: color, borderRadius: 4 }} />
                        ) : null
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 20, marginTop: 12, flexWrap: "wrap" }}>
                      {[
                        { label: "Critique", key: "critique", color: "#ef4444" },
                        { label: "Élevé",    key: "eleve",    color: "#f97316" },
                        { label: "Modéré",   key: "modere",   color: "#f59e0b" },
                        { label: "Faible",   key: "faible",   color: "#22c55e" },
                      ].map(({ label, key, color }) => (
                        <div key={key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
                          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>
                            {label}:{" "}
                            <span style={{ color, fontWeight: 700 }}>{prediction.stats[key]}</span>
                            <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 11 }}>
                              {" "}({Math.round(prediction.stats[key] / prediction.stats.total * 100)}%)
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {/* Cartes étudiants */}
                <Card>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                    <SectionTitle title="Analyse individuelle par IA" icon="🤖" />
                    <Btn onClick={loadPrediction} color="#6366f1" style={{ fontSize: 11, padding: "6px 14px" }}>
                      🔄 Rafraîchir
                    </Btn>
                  </div>
                  {prediction.etudiants.length === 0 ? (
                    <EmptyState message="Aucun étudiant à analyser" />
                  ) : (
                    prediction.etudiants.map((s, i) => {
                      const riskColor =
                        s.niveau_risque === "critique" ? "#ef4444"
                        : s.niveau_risque === "élevé"   ? "#f97316"
                        : s.niveau_risque === "modéré"  ? "#f59e0b"
                        : "#22c55e";
                      return (
                        <div key={i} style={{
                          background: `${riskColor}08`,
                          border: `1px solid ${riskColor}22`,
                          borderLeft: `3px solid ${riskColor}`,
                          borderRadius: 12, padding: "16px 18px", marginBottom: 10,
                        }}>
                          <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                            {/* Score circulaire */}
                            <div style={{
                              width: 56, height: 56, borderRadius: "50%",
                              background: `${riskColor}18`,
                              border: `2px solid ${riskColor}40`,
                              display: "flex", flexDirection: "column",
                              alignItems: "center", justifyContent: "center", flexShrink: 0,
                            }}>
                              <span style={{ fontSize: 15, fontWeight: 700, color: riskColor, lineHeight: 1 }}>
                                {s.score_risque}
                              </span>
                              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", marginTop: 1 }}>/100</span>
                            </div>

                            <div style={{ flex: 1 }}>
                              {/* En-tête */}
                              <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                                <span style={{ fontWeight: 700, fontSize: 14 }}>{s.prenom} {s.nom}</span>
                                <span style={{ background: "rgba(99,102,241,0.15)", color: "#a5b4fc",
                                  fontSize: 11, padding: "2px 8px", borderRadius: 6 }}>
                                  Classe {s.classe}
                                </span>
                                {s.annee_scolaire && (
                                  <span style={{ background: "rgba(14,165,233,0.12)", color: "#38bdf8",
                                    fontSize: 11, padding: "2px 8px", borderRadius: 6 }}>
                                    {s.annee_scolaire}
                                  </span>
                                )}
                                <span style={{ background: `${riskColor}20`, color: riskColor,
                                  fontSize: 11, padding: "2px 8px", borderRadius: 6, fontWeight: 600,
                                  textTransform: "capitalize" }}>
                                  {s.niveau_risque}
                                </span>
                              </div>

                              {/* Métriques */}
                              <div style={{ display: "flex", gap: 16, flexWrap: "wrap",
                                marginBottom: s.analyse_ia ? 12 : 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>Absences :</span>
                                  <span style={{ fontSize: 13, fontWeight: 600,
                                    color: s.nb_absences > 5 ? "#ef4444" : s.nb_absences > 2 ? "#f59e0b" : "#22c55e" }}>
                                    {s.nb_absences} ({s.taux_absence}%)
                                  </span>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>Moyenne :</span>
                                  <span style={{ fontSize: 13, fontWeight: 600,
                                    color: s.moyenne === 0 ? "rgba(255,255,255,0.3)" : s.moyenne < 10 ? "#ef4444" : "#22c55e" }}>
                                    {s.moyenne === 0 ? "—" : `${s.moyenne}/20`}
                                  </span>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>Tendance :</span>
                                  <span style={{ fontSize: 13, fontWeight: 600,
                                    color: s.tendance === "en hausse" ? "#ef4444"
                                      : s.tendance === "en amélioration" ? "#22c55e" : "#f59e0b" }}>
                                    {s.tendance === "en hausse" ? "↑ En hausse"
                                      : s.tendance === "en amélioration" ? "↓ En baisse" : "→ Stable"}
                                  </span>
                                </div>
                              </div>

                              {/* Analyse IA */}
                              {s.analyse_ia && (
                                <div>
                                  <div style={{
                                    fontSize: 12, color: "rgba(255,255,255,0.65)", lineHeight: 1.6,
                                    background: "rgba(99,102,241,0.08)", borderRadius: 8,
                                    padding: "10px 12px", marginBottom: 10,
                                    borderLeft: "2px solid rgba(99,102,241,0.4)",
                                  }}>
                                    <span style={{ fontSize: 10, color: "#a5b4fc", fontWeight: 700,
                                      display: "block", marginBottom: 4, letterSpacing: "0.06em" }}>
                                      ANALYSE IA
                                    </span>
                                    {s.analyse_ia}
                                  </div>
                                  {s.recommandations_ia.length > 0 && (
                                    <div>
                                      <div style={{ fontSize: 10, color: "#a5b4fc", fontWeight: 700,
                                        marginBottom: 6, letterSpacing: "0.06em" }}>
                                        RECOMMANDATIONS
                                      </div>
                                      {s.recommandations_ia.map((rec, j) => (
                                        <div key={j} style={{ display: "flex", alignItems: "flex-start",
                                          gap: 8, fontSize: 12, color: "rgba(255,255,255,0.6)",
                                          marginBottom: 5, lineHeight: 1.5 }}>
                                          <span style={{ color: "#6366f1", fontWeight: 700, flexShrink: 0 }}>→</span>
                                          {rec}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Bouton alerte */}
                              <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
                                <button onClick={() => openAlertPred(s)} style={{
                                  padding: "7px 14px", borderRadius: 8, border: "none", cursor: "pointer",
                                  background: `${riskColor}22`, color: riskColor,
                                  fontSize: 12, fontWeight: 600, fontFamily: "Sora, sans-serif",
                                  display: "flex", alignItems: "center", gap: 6,
                                  transition: "background 0.15s",
                                }}>
                                  🔔 Envoyer une alerte
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </Card>
              </>
            )}
          </div>
        )}

        {/* Modale — Envoyer alerte depuis Prédiction IA */}
        {alertPredModal && (
          <div onClick={() => setAlertPredModal(null)} style={{
            position: "fixed", inset: 0, zIndex: 300,
            background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
          }}>
            <div onClick={e => e.stopPropagation()} style={{
              background: "#0b0b18", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 20, width: "100%", maxWidth: 500,
              boxShadow: "0 32px 100px rgba(0,0,0,0.7)", padding: "28px 28px 24px",
            }}>
              {/* En-tête */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>🔔 Envoyer une alerte</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 3 }}>
                    {alertPredModal.prenom} {alertPredModal.nom} · Classe {alertPredModal.classe}
                  </div>
                </div>
                <button onClick={() => setAlertPredModal(null)} style={{
                  background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 8,
                  color: "rgba(255,255,255,0.5)", cursor: "pointer", width: 30, height: 30,
                  fontSize: 14, fontFamily: "Sora, sans-serif",
                }}>✕</button>
              </div>

              {/* Message */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontWeight: 600,
                  letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>MESSAGE</label>
                <textarea
                  value={alertPredForm.message}
                  onChange={e => setAlertPredForm(f => ({ ...f, message: e.target.value }))}
                  rows={4}
                  style={{
                    width: "100%", padding: "10px 14px", boxSizing: "border-box",
                    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 10, color: "#fff", fontSize: 12, fontFamily: "Sora, sans-serif",
                    resize: "vertical", outline: "none", lineHeight: 1.6,
                  }}
                />
              </div>

              {/* Ligne options */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
                {/* Type */}
                <div>
                  <label style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontWeight: 600,
                    letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>TYPE</label>
                  <select value={alertPredForm.type}
                    onChange={e => setAlertPredForm(f => ({ ...f, type: e.target.value }))}
                    style={{ width: "100%", padding: "8px 10px", background: "#0d0d1a",
                      border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8,
                      color: "#fff", fontSize: 12, fontFamily: "Sora, sans-serif", outline: "none" }}>
                    <option value="information">Information</option>
                    <option value="avertissement">Avertissement</option>
                    <option value="convocation">Convocation</option>
                  </select>
                </div>
                {/* Sévérité */}
                <div>
                  <label style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontWeight: 600,
                    letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>SÉVÉRITÉ</label>
                  <select value={alertPredForm.severity}
                    onChange={e => setAlertPredForm(f => ({ ...f, severity: e.target.value }))}
                    style={{ width: "100%", padding: "8px 10px", background: "#0d0d1a",
                      border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8,
                      color: "#fff", fontSize: 12, fontFamily: "Sora, sans-serif", outline: "none" }}>
                    <option value="low">Faible</option>
                    <option value="medium">Moyen</option>
                    <option value="high">Élevé</option>
                  </select>
                </div>
              </div>

              {/* Feedback */}
              {alertPredFeedback === "ok" && (
                <div style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)",
                  borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#22c55e",
                  marginBottom: 14, fontWeight: 500 }}>
                  ✅ Alerte envoyée avec succès !
                </div>
              )}
              {alertPredFeedback === "err" && (
                <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
                  borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#ef4444",
                  marginBottom: 14, fontWeight: 500 }}>
                  ❌ Erreur lors de l'envoi. Réessayez.
                </div>
              )}

              {/* Actions */}
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button onClick={() => setAlertPredModal(null)} style={{
                  padding: "9px 18px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.1)",
                  background: "transparent", color: "rgba(255,255,255,0.5)",
                  cursor: "pointer", fontFamily: "Sora, sans-serif", fontSize: 13,
                }}>Annuler</button>
                <button onClick={sendAlertPred} disabled={alertPredSending} style={{
                  padding: "9px 22px", borderRadius: 9, border: "none",
                  background: alertPredSending ? "rgba(99,102,241,0.4)" : "#6366f1",
                  color: "#fff", cursor: alertPredSending ? "not-allowed" : "pointer",
                  fontFamily: "Sora, sans-serif", fontSize: 13, fontWeight: 600,
                }}>
                  {alertPredSending ? "Envoi..." : "🔔 Envoyer"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Surveillance ── */}
        {activeTab === "surveillance" && (() => {
          const sessionsFiltrees = survSessions.filter(s =>
            (!survFormNiveau || s.niveau === survFormNiveau) &&
            (!survFormClasse  || s.classe === survFormClasse)
          );
          const sessionSelectionnee = survSessions.find(s => String(s.id) === String(survFormSessionId));
          const resVideo = survResults["video_form"];
          const canAnalyze = survAnalyzeFile.length > 0 && survFormSessionId;

          return (
          <div className="sc-fade" style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* En-tête */}
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#fff" }}>Surveillance des salles</h2>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginTop: 4 }}>
                Analysez les présences par reconnaissance faciale via vidéo ou caméra
              </div>
            </div>


            {/* ── Boutons toggle ── */}
            <div style={{ display: "flex", gap: 10 }}>
              {[
                { key: "file", label: "Vidéo enregistrée", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg> },
                { key: "url",  label: "URL Caméra",        icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> },
              ].map(btn => {
                const active = survAnalyzeMode === btn.key;
                return (
                  <button key={btn.key} onClick={() => setSurvAnalyzeMode(btn.key)} style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "10px 20px", borderRadius: 10, cursor: "pointer",
                    border: active ? "1px solid rgba(99,102,241,0.5)" : "1px solid rgba(255,255,255,0.1)",
                    background: active ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.03)",
                    color: active ? "#a5b4fc" : "rgba(255,255,255,0.45)",
                    fontFamily: F, fontSize: 13, fontWeight: active ? 700 : 500,
                    transition: "all .15s",
                  }}>
                    {btn.icon} {btn.label}
                    {active && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#6366f1", marginLeft: 4 }}/>}
                  </button>
                );
              })}
            </div>

            {/* ── Contenu selon le mode sélectionné ── */}
            <div style={{ display: "grid", gridTemplateColumns: resVideo && survAnalyzeMode === "file" ? "1fr 1fr" : "1fr", gap: bp.gap }}>

              {/* ── VIDÉO ── */}
              {survAnalyzeMode === "file" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

                {/* Étape 1 : Upload vidéo */}
                <Card>
                  <SectionTitle title="Étape 1 — Importer la/les vidéo(s)" icon="🎬" />
                  <label style={{
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    gap: 10, padding: "28px 16px", borderRadius: 10,
                    border: survAnalyzeFile.length > 0 ? "2px solid rgba(99,102,241,0.5)" : "2px dashed rgba(255,255,255,0.12)",
                    background: survAnalyzeFile.length > 0 ? "rgba(99,102,241,0.07)" : "rgba(255,255,255,0.02)",
                    cursor: "pointer", transition: "all 0.2s",
                  }}>
                    <div style={{ fontSize: 32 }}>{survAnalyzeFile.length > 0 ? "✅" : "📹"}</div>
                    {survAnalyzeFile.length > 0 ? (
                      <>
                        {survAnalyzeFile.map((f, i) => (
                          <div key={i} style={{ fontWeight: 600, fontSize: 13, color: "#a5b4fc" }}>
                            {f.name} <span style={{ fontWeight: 400, color: "rgba(255,255,255,0.35)" }}>({(f.size / 1024 / 1024).toFixed(1)} Mo)</span>
                          </div>
                        ))}
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>
                          {survAnalyzeFile.length} vidéo(s) · Cliquer pour changer
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontWeight: 600, fontSize: 13, color: "rgba(255,255,255,0.5)" }}>
                          Cliquer pour importer 1 ou plusieurs vidéos
                        </div>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.28)" }}>MP4, AVI, MOV — sélection multiple possible</div>
                      </>
                    )}
                    <input type="file" accept="video/*" multiple style={{ display: "none" }}
                      onChange={e => { setSurvAnalyzeFile(Array.from(e.target.files)); setSurvFormSessionId(""); setSurvResults({}); }} />
                  </label>
                </Card>

                {/* Étape 2 : Identifier la séance */}
                <Card style={{ opacity: survAnalyzeFile ? 1 : 0.45 }}>
                  <SectionTitle title="Étape 2 — Identifier la séance" icon="📋" />
                  {!survAnalyzeFile && (
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginBottom: 10 }}>
                      Importez d'abord une vidéo
                    </div>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.35)",
                        letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 6 }}>Niveau</div>
                      <select value={survFormNiveau}
                        onChange={e => { const n = e.target.value; setSurvFormNiveau(n); setSurvFormClasse(""); setSurvFormSessionId(""); if (n) loadSurvSessions("", n); }}
                        disabled={!survAnalyzeFile}
                        style={{ width: "100%", padding: "9px 12px", background: "#0d0d1a",
                          border: "1px solid rgba(255,255,255,0.1)", borderRadius: 9,
                          color: survFormNiveau ? "#fff" : "rgba(255,255,255,0.35)",
                          fontFamily: "Sora, sans-serif", fontSize: 13, outline: "none", boxSizing: "border-box" }}>
                        <option value="" style={{ background: "#0d0d1a" }}>-- Sélectionner le niveau --</option>
                        {dynNiveaux.map(n => <option key={n} value={n} style={{ background: "#0d0d1a" }}>{n}</option>)}
                      </select>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.35)",
                        letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 6 }}>Groupe / Classe</div>
                      <select value={survFormClasse}
                        onChange={e => { const c = e.target.value; setSurvFormClasse(c); setSurvFormSessionId(""); if (c) loadSurvSessions(c, survFormNiveau); }}
                        disabled={!survFormNiveau}
                        style={{ width: "100%", padding: "9px 12px", background: "#0d0d1a",
                          border: "1px solid rgba(255,255,255,0.1)", borderRadius: 9,
                          color: survFormClasse ? "#fff" : "rgba(255,255,255,0.35)",
                          fontFamily: "Sora, sans-serif", fontSize: 13, outline: "none", boxSizing: "border-box" }}>
                        <option value="" style={{ background: "#0d0d1a" }}>-- Sélectionner le groupe --</option>
                        {dynGroupes.map(g => <option key={g} value={g} style={{ background: "#0d0d1a" }}>Groupe {g}</option>)}
                      </select>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.35)",
                        letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 6 }}>Séance</div>
                      {survLoading ? (
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", padding: "8px 0" }}>Chargement...</div>
                      ) : (
                        <select value={survFormSessionId}
                          onChange={e => setSurvFormSessionId(e.target.value)}
                          disabled={!survFormClasse}
                          style={{ width: "100%", padding: "9px 12px", background: "#0d0d1a",
                            border: "1px solid rgba(255,255,255,0.1)", borderRadius: 9,
                            color: survFormSessionId ? "#fff" : "rgba(255,255,255,0.35)",
                            fontFamily: "Sora, sans-serif", fontSize: 13, outline: "none", boxSizing: "border-box" }}>
                          <option value="" style={{ background: "#0d0d1a" }}>-- Sélectionner la séance --</option>
                          {sessionsFiltrees.map(s => (
                            <option key={s.id} value={s.id} style={{ background: "#0d0d1a" }}>
                              {s.date} · {s.matiere_nom || s.matiere || "Matière"} · {s.heure_debut}–{s.heure_fin}
                            </option>
                          ))}
                          {survFormClasse && sessionsFiltrees.length === 0 && (
                            <option disabled style={{ background: "#0d0d1a" }}>Aucune séance trouvée</option>
                          )}
                        </select>
                      )}

                      {/* Bouton créer une séance si aucune trouvée */}
                      {survFormClasse && !survLoading && sessionsFiltrees.length === 0 && (
                        <div style={{ marginTop: 10 }}>
                          <button
                            onClick={() => { setSurvCreateOpen(o => !o); setSurvCreateMsg(""); }}
                            style={{
                              width: "100%", padding: "9px 14px",
                              background: "rgba(99,102,241,0.12)",
                              border: "1px solid rgba(99,102,241,0.35)",
                              borderRadius: 9, color: "#a5b4fc",
                              fontSize: 12, fontWeight: 600,
                              fontFamily: F, cursor: "pointer",
                              display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                            }}
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            Créer une séance pour cette vidéo
                          </button>

                          {survCreateOpen && (() => {
                            const matsFiltrees = matieres.filter(m =>
                              (!survFormNiveau || m.annee_scolaire?.includes(survFormNiveau?.replace(/[^0-9]/g,""))) &&
                              (!survFormClasse  || m.classe === survFormClasse)
                            );
                            return (
                              <div style={{
                                marginTop: 10, padding: "14px 14px",
                                background: "rgba(99,102,241,0.07)",
                                border: "1px solid rgba(99,102,241,0.2)",
                                borderRadius: 10,
                                display: "flex", flexDirection: "column", gap: 10,
                              }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: "#a5b4fc", marginBottom: 2 }}>
                                  Nouvelle séance — Classe {survFormClasse}
                                </div>

                                {/* Matière */}
                                <div>
                                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>Matière</div>
                                  <select value={survCreateForm.matiere_id}
                                    onChange={e => setSurvCreateForm(f => ({ ...f, matiere_id: e.target.value }))}
                                    style={{ width: "100%", padding: "8px 10px", background: "#0d0d1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: survCreateForm.matiere_id ? "#fff" : "rgba(255,255,255,0.35)", fontFamily: F, fontSize: 12, outline: "none", boxSizing: "border-box" }}>
                                    <option value="">-- Choisir la matière --</option>
                                    {(matsFiltrees.length > 0 ? matsFiltrees : matieres).map(m => (
                                      <option key={m.id} value={m.id} style={{ background: "#0d0d1a" }}>{m.nom}</option>
                                    ))}
                                  </select>
                                </div>

                                {/* Date */}
                                <div>
                                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>Date de la séance</div>
                                  <input type="date" value={survCreateForm.date}
                                    onChange={e => setSurvCreateForm(f => ({ ...f, date: e.target.value }))}
                                    style={{ width: "100%", padding: "8px 10px", background: "#0d0d1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontFamily: F, fontSize: 12, outline: "none", boxSizing: "border-box", colorScheme: "dark" }} />
                                </div>

                                {/* Heures */}
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                  <div>
                                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>Heure début</div>
                                    <input type="time" value={survCreateForm.heure_debut}
                                      onChange={e => setSurvCreateForm(f => ({ ...f, heure_debut: e.target.value }))}
                                      style={{ width: "100%", padding: "8px 10px", background: "#0d0d1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontFamily: F, fontSize: 12, outline: "none", boxSizing: "border-box", colorScheme: "dark" }} />
                                  </div>
                                  <div>
                                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>Heure fin</div>
                                    <input type="time" value={survCreateForm.heure_fin}
                                      onChange={e => setSurvCreateForm(f => ({ ...f, heure_fin: e.target.value }))}
                                      style={{ width: "100%", padding: "8px 10px", background: "#0d0d1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontFamily: F, fontSize: 12, outline: "none", boxSizing: "border-box", colorScheme: "dark" }} />
                                  </div>
                                </div>

                                {survCreateMsg && (
                                  <div style={{ fontSize: 12, color: survCreateMsg.startsWith("✅") ? "#86efac" : "#fca5a5", fontWeight: 600 }}>
                                    {survCreateMsg}
                                  </div>
                                )}

                                <button
                                  disabled={!survCreateForm.matiere_id || !survCreateForm.date || survCreateLoading}
                                  onClick={async () => {
                                    setSurvCreateLoading(true);
                                    setSurvCreateMsg("");
                                    try {
                                      const { data } = await axios.post(`${API_URL}/api/gestion/sessions`, {
                                        matiere_id:  survCreateForm.matiere_id,
                                        classe:      survFormClasse,
                                        date:        survCreateForm.date,
                                        heure_debut: survCreateForm.heure_debut,
                                        heure_fin:   survCreateForm.heure_fin,
                                        salle:       survCreateForm.salle,
                                      }, authHeaders());
                                      setSurvCreateMsg(`✅ Séance créée : ${data.matiere} · ${data.date}`);
                                      setSurvCreateOpen(false);
                                      await loadSurvSessions(survFormClasse, survFormNiveau);
                                      setSurvFormSessionId(data.id);
                                    } catch (err) {
                                      setSurvCreateMsg("❌ " + (err.response?.data?.detail || "Erreur"));
                                    } finally {
                                      setSurvCreateLoading(false);
                                    }
                                  }}
                                  style={{
                                    padding: "9px 14px", border: "none", borderRadius: 8,
                                    background: survCreateForm.matiere_id && survCreateForm.date ? "linear-gradient(135deg,#6366f1,#4f46e5)" : "rgba(255,255,255,0.06)",
                                    color: "#fff", fontSize: 12, fontWeight: 700,
                                    fontFamily: F, cursor: "pointer",
                                    opacity: survCreateLoading ? 0.6 : 1,
                                  }}
                                >
                                  {survCreateLoading ? "Création..." : "✓ Créer la séance"}
                                </button>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Récap séance sélectionnée */}
                  {sessionSelectionnee && (
                    <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 9,
                      background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)" }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#a5b4fc", marginBottom: 4 }}>Séance sélectionnée</div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                        {sessionSelectionnee.matiere_nom || sessionSelectionnee.matiere} · Groupe {sessionSelectionnee.classe}
                      </div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>
                        {sessionSelectionnee.date} · {sessionSelectionnee.heure_debut}–{sessionSelectionnee.heure_fin}
                        {sessionSelectionnee.salle ? ` · Salle ${sessionSelectionnee.salle}` : ""}
                      </div>
                    </div>
                  )}
                </Card>

                {/* Bouton Diagnostic enrôlement */}
                {survFormSessionId && (
                  <button
                    onClick={async () => {
                      setSurvDiagLoading(true);
                      setSurvDiag(null);
                      try {
                        const res = await axios.get(`${API_URL}/api/attendance/diagnostic/${survFormSessionId}`, authHeaders());
                        setSurvDiag(res.data);
                      } catch (e) {
                        setSurvDiag({ error: e.response?.data?.detail || "Erreur" });
                      } finally {
                        setSurvDiagLoading(false);
                      }
                    }}
                    disabled={survDiagLoading}
                    style={{
                      width: "100%", padding: "10px", borderRadius: 10, border: "1px solid rgba(251,191,36,0.3)",
                      background: "rgba(251,191,36,0.07)", color: "#fbbf24",
                      fontFamily: "Sora, sans-serif", fontSize: 13, fontWeight: 600,
                      cursor: "pointer",
                    }}>
                    {survDiagLoading ? "Vérification..." : "🔍 Vérifier l'enrôlement de la classe"}
                  </button>
                )}

                {/* Résultat diagnostic */}
                {survDiag && !survDiag.error && (
                  <Card style={{ borderColor: "rgba(251,191,36,0.2)", padding: "14px 16px" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#fbbf24", marginBottom: 10 }}>
                      Diagnostic — {survDiag.classe} ({survDiag.total_roster} étudiants)
                    </div>
                    <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
                      {[
                        { label: "Non enrôlés", val: survDiag.non_enrolles, color: "#ef4444" },
                        { label: "1 seul angle", val: survDiag.peu_dangles, color: "#f97316" },
                        { label: "Qualité faible", val: survDiag.qualite_faible, color: "#eab308" },
                      ].map(({ label, val, color }) => val > 0 && (
                        <div key={label} style={{ padding: "4px 10px", borderRadius: 6, background: `${color}18`, border: `1px solid ${color}40`, fontSize: 12, color }}>
                          {val} {label}
                        </div>
                      ))}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 280, overflowY: "auto" }}>
                      {survDiag.etudiants.filter(e => e.probleme !== "OK").map((e, i) => (
                        <div key={i} style={{
                          display: "flex", justifyContent: "space-between", alignItems: "center",
                          padding: "6px 10px", borderRadius: 7,
                          background: e.probleme === "NON ENRÔLÉ" ? "rgba(239,68,68,0.08)" : "rgba(251,191,36,0.06)",
                          border: `1px solid ${e.probleme === "NON ENRÔLÉ" ? "rgba(239,68,68,0.2)" : "rgba(251,191,36,0.15)"}`,
                        }}>
                          <div>
                            <span style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{e.prenom} {e.nom}</span>
                            {e.nb_embeddings > 0 && (
                              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginLeft: 8 }}>
                                {e.nb_embeddings} angle(s) · qualité {e.qualite_moy}
                              </span>
                            )}
                          </div>
                          <span style={{
                            fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 5,
                            background: e.probleme === "NON ENRÔLÉ" ? "rgba(239,68,68,0.2)" : "rgba(251,191,36,0.15)",
                            color: e.probleme === "NON ENRÔLÉ" ? "#fca5a5" : "#fde68a",
                          }}>{e.probleme}</span>
                        </div>
                      ))}
                      {survDiag.etudiants.filter(e => e.probleme !== "OK").length === 0 && (
                        <div style={{ fontSize: 12, color: "#86efac", textAlign: "center", padding: 8 }}>
                          ✅ Tous les étudiants sont bien enrôlés
                        </div>
                      )}
                    </div>
                  </Card>
                )}
                {survDiag?.error && (
                  <div style={{ fontSize: 12, color: "#ef4444" }}>❌ {survDiag.error}</div>
                )}

                {/* Bouton Analyser */}
                <button
                  onClick={async () => {
                    if (!canAnalyze) return;
                    setSurvAnalyzeLoading(true);
                    try {
                      const fd = new FormData();
                      fd.append("session_id", survFormSessionId);
                      survAnalyzeFile.forEach(f => fd.append("videos", f));
                      const res = await axios.post(`${API_URL}/api/attendance/analyze-video`, fd, authHeaders());
                      setSurvResults({ video_form: res.data });
                    } catch (e) {
                      setSurvResults({ video_form: { error: e.response?.data?.detail || "Erreur lors de l'analyse" } });
                    } finally {
                      setSurvAnalyzeLoading(false);
                    }
                  }}
                  disabled={!canAnalyze || survAnalyzeLoading}
                  style={{
                    width: "100%", padding: "13px", borderRadius: 10, border: "none",
                    background: canAnalyze ? "linear-gradient(135deg,#6366f1,#a855f7)" : "rgba(255,255,255,0.06)",
                    color: canAnalyze ? "#fff" : "rgba(255,255,255,0.25)",
                    fontFamily: "Sora, sans-serif", fontSize: 14, fontWeight: 700,
                    cursor: canAnalyze ? "pointer" : "not-allowed",
                    transition: "all 0.2s",
                    boxShadow: canAnalyze ? "0 4px 20px rgba(99,102,241,0.3)" : "none",
                  }}>
                  {survAnalyzeLoading ? "Analyse en cours..." : "Lancer l'analyse des présences"}
                </button>

                {/* Erreur analyse */}
                {resVideo?.error && (
                  <Card style={{ borderColor: "rgba(239,68,68,0.3)" }}>
                    <div style={{ color: "#ef4444", fontSize: 13, display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 18 }}>❌</span> {resVideo.error}
                    </div>
                  </Card>
                )}
              </div>
              )}

              {/* ── Résultats (colonne droite quand vidéo analysée) ── */}
              {survAnalyzeMode === "file" && resVideo && !resVideo.error && (
                <Card style={{ borderColor: "rgba(34,197,94,0.25)" }}>
                  <SectionTitle title="Résultat de l'analyse" icon="📊" />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
                    <div style={{ textAlign: "center", padding: "12px 8px", borderRadius: 10, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
                      <div style={{ fontSize: 24, fontWeight: 700, color: "#22c55e" }}>{resVideo.students_present}</div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>Présents</div>
                    </div>
                    <div style={{ textAlign: "center", padding: "12px 8px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                      <div style={{ fontSize: 24, fontWeight: 700, color: "#ef4444" }}>{resVideo.students_absent}</div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>Absents</div>
                    </div>
                    <div style={{ textAlign: "center", padding: "12px 8px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <div style={{ fontSize: 24, fontWeight: 700, color: "rgba(255,255,255,0.5)" }}>{resVideo.sampled_frames}</div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>Frames</div>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {/* Présents */}
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#22c55e", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 7, display: "flex", alignItems: "center", gap: 5 }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                        Présents ({resVideo.presences?.length || 0})
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {(resVideo.presences || []).length === 0
                          ? <div style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", fontStyle: "italic" }}>Aucun</div>
                          : (resVideo.presences || []).map((p, i) => (
                            <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 9px", borderRadius: 7, background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.16)" }}>
                              <div style={{ width: 25, height: 25, borderRadius: "50%", flexShrink: 0, background: "rgba(34,197,94,0.18)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#22c55e" }}>{(p.prenom||"?")[0]}{(p.nom||"?")[0]}</div>
                              <div style={{ flex: 1, fontSize: 11.5, fontWeight: 600, color: "#fff" }}>{p.prenom} {p.nom}</div>
                            </div>
                          ))}
                      </div>
                    </div>
                    {/* Absents */}
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#ef4444", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 7, display: "flex", alignItems: "center", gap: 5 }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                        Absents ({resVideo.absences?.length || 0})
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {(resVideo.absences || []).length === 0
                          ? <div style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", fontStyle: "italic" }}>Aucun</div>
                          : (resVideo.absences || []).map((a, i) => (
                            <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 9px", borderRadius: 7, background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.14)" }}>
                              <div style={{ width: 25, height: 25, borderRadius: "50%", flexShrink: 0, background: "rgba(239,68,68,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#ef4444" }}>{(a.prenom||"?")[0]}{(a.nom||"?")[0]}</div>
                              <div style={{ fontSize: 11.5, fontWeight: 500, color: "rgba(255,255,255,0.6)" }}>{a.prenom} {a.nom}</div>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                </Card>
              )}

              {/* ── URL CAMÉRA ── */}
              {survAnalyzeMode === "url" && (
                <Card>
                  <SectionTitle title="Flux caméra en temps réel" icon="📡" />
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 14, lineHeight: 1.6 }}>
                    Entrez l'URL RTSP de la caméra. La séance sera détectée automatiquement d'après l'emploi du temps.
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.35)", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 6 }}>URL caméra</div>
                    <input value={survAnalyzeUrl} onChange={e => setSurvAnalyzeUrl(e.target.value)}
                      placeholder="rtsp://192.168.1.100:554/stream"
                      style={{ width: "100%", padding: "10px 13px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 9, color: "#fff", fontFamily: F, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                  </div>
                  <div style={{ padding: "12px 14px", borderRadius: 9, background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)", marginBottom: 14 }}>
                    <div style={{ fontSize: 12, color: "#f59e0b", fontWeight: 600, marginBottom: 4 }}>Fonctionnement en production</div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", lineHeight: 1.6 }}>
                      L'URL RTSP identifie la salle → séance en cours → étudiants attendus. Analyse en temps réel sans saisie manuelle.
                    </div>
                  </div>
                  <div style={{ padding: "10px 14px", borderRadius: 9, background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)", fontSize: 12, color: "#f87171", fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    Fonctionnalité non disponible à ce stade — nécessite une caméra réseau
                  </div>
                </Card>
              )}

            </div>
          </div>
          );
        })()}

        {/* Gestion */}
        {activeTab === "gestion" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {msg && (
              <div style={{
                background: msg.startsWith("✅") ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                border: `1px solid ${msg.startsWith("✅") ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
                borderLeft: `3px solid ${msg.startsWith("✅") ? "#22c55e" : "#ef4444"}`,
                borderRadius: 10, padding: "11px 16px", fontSize: 13, fontWeight: 500,
                color: msg.startsWith("✅") ? "#22c55e" : "#ef4444",
              }}>{msg}</div>
            )}
            {/* Sous-navigation Gestion */}
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {gTabs.map(t => (
                <button key={t.id} onClick={() => setGTab(t.id)} style={{
                  padding: "8px 16px", borderRadius: 8, cursor: "pointer",
                  background: gTab === t.id ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.03)",
                  border: gTab === t.id ? "1px solid rgba(99,102,241,0.3)" : "1px solid rgba(255,255,255,0.07)",
                  color: gTab === t.id ? "#c7d2fe" : "rgba(255,255,255,0.4)",
                  fontFamily: F, fontSize: 12, fontWeight: gTab === t.id ? 600 : 400,
                  transition: "all 0.15s", position: "relative",
                }}>
                  {gTab === t.id && (
                    <div style={{ position: "absolute", left: 0, top: "20%", bottom: "20%",
                      width: 2, borderRadius: 2, background: "#6366f1" }} />
                  )}
                  {t.label}
                </button>
              ))}
            </div>

            {/* Professeurs */}
            {gTab === "profs" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                {/* Modal Ajouter Professeur */}
                {showAddProf && (
                  <div onClick={() => { setShowAddProf(false); setCreatedPassword(""); }}
                    style={{ position: "fixed", inset: 0, zIndex: 300,
                      background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)",
                      display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
                    <div onClick={e => e.stopPropagation()}
                      style={{ background: "#0d0d1a", border: "1px solid rgba(255,255,255,0.09)",
                        borderRadius: 14, width: "100%", maxWidth: 480,
                        boxShadow: "0 24px 60px rgba(0,0,0,0.6)" }}>
                      {/* Header modal */}
                      <div style={{ padding: "18px 22px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)",
                        display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ fontWeight: 700, fontSize: 15, color: "#f1f5f9" }}>Ajouter un professeur</div>
                        <button onClick={() => { setShowAddProf(false); setCreatedPassword(""); }}
                          style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)",
                            cursor: "pointer", fontSize: 18, lineHeight: 1 }}>✕</button>
                      </div>
                      {/* Corps modal */}
                      <div style={{ padding: "20px 22px 22px", display: "flex", flexDirection: "column", gap: 12 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                          <div>
                            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontWeight: 600,
                              textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Nom</div>
                            <Input placeholder="Benali" value={formProf.nom}
                              onChange={e => setFormProf({...formProf, nom: e.target.value})} />
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontWeight: 600,
                              textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Prénom</div>
                            <Input placeholder="Ahmed" value={formProf.prenom}
                              onChange={e => setFormProf({...formProf, prenom: e.target.value})} />
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontWeight: 600,
                            textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Email</div>
                          <Input placeholder="prof@esisa.ma" type="email" value={formProf.email}
                            onChange={e => setFormProf({...formProf, email: e.target.value})} />
                        </div>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", padding: "2px 0" }}>
                          Un mot de passe temporaire sera généré automatiquement.
                        </div>
                        {createdPassword && (
                          <div style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)",
                            borderRadius: 10, padding: "12px 14px" }}>
                            <div style={{ fontSize: 11, color: "#10b981", fontWeight: 600, marginBottom: 8 }}>
                              Compte créé — mot de passe temporaire
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <code style={{ fontSize: 16, fontWeight: 700, color: "#f1f5f9",
                                background: "rgba(255,255,255,0.06)", padding: "6px 12px",
                                borderRadius: 7, letterSpacing: 2, flex: 1 }}>{createdPassword}</code>
                              <button onClick={() => navigator.clipboard.writeText(createdPassword)}
                                style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)",
                                  borderRadius: 7, color: "#a5b4fc", cursor: "pointer",
                                  padding: "6px 12px", fontSize: 11, fontFamily: F }}>Copier</button>
                            </div>
                            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 8 }}>
                              Transmettez ce mot de passe au professeur.
                            </div>
                          </div>
                        )}
                        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                          <Btn onClick={async () => { await addProf(); }}
                            style={{ flex: 1, padding: "10px" }}
                            disabled={!formProf.nom || !formProf.prenom || !formProf.email}>
                            Créer le compte
                          </Btn>
                          <Btn onClick={() => { setShowAddProf(false); setCreatedPassword(""); }}
                            color="rgba(255,255,255,0.05)"
                            style={{ padding: "10px 16px", color: "rgba(255,255,255,0.4)",
                              border: "1px solid rgba(255,255,255,0.08)" }}>
                            Annuler
                          </Btn>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <Card>
                  <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
                    <SectionTitle title={`Professeurs (${profs.filter(p => p.is_active).length} actifs${profs.some(p => !p.is_active) ? ` · ${profs.filter(p => !p.is_active).length} désactivés` : ""})`} />
                    <button onClick={() => { setFormProf({ nom:"", prenom:"", email:"" }); setCreatedPassword(""); setShowAddProf(true); }}
                      style={{ marginLeft: "auto", padding: "7px 16px", borderRadius: 7,
                        background: "#6366f1", border: "none", color: "#fff",
                        fontFamily: F, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                      + Ajouter un professeur
                    </button>
                  </div>
                  {profs.length === 0 ? <EmptyState message="Aucun professeur" /> :
                    profs.map((p, i) => (
                      <div key={i} style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "12px 0", borderBottom: i < profs.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                      }}>
                        <div style={{ flex: 1, cursor: "pointer" }} onClick={() => openProf(p)}>
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
                          <Btn onClick={() => openProf(p)} color="rgba(99,102,241,0.2)"
                            style={{ padding: "6px 12px", fontSize: 12, border: "1px solid rgba(99,102,241,0.4)", color: "#a5b4fc" }}>
                            ✏️ Modifier
                          </Btn>
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
            {gTab === "matieres" && (() => {
              // Matières filtrées par niveau + groupe (via emplois du temps)
              const matIdsInGroupe = gMatNiveau && gMatGroupe
                ? new Set(emplois.filter(e => e.niveau === gMatNiveau && e.groupe === gMatGroupe).map(e => e.matiere_id))
                : null;
              const matieresFiltrees = matieres.filter(m => {
                if (gMatNiveau && m.annee_scolaire !== gMatNiveau) return false;
                if (matIdsInGroupe) return matIdsInGroupe.has(m.id);
                return true;
              });
              return (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                {/* Filtre niveau + groupe */}
                <Card>
                  <SectionTitle title="Filtrer les matières" icon="🔍" />
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <select value={gMatNiveau}
                      onChange={e => { setGMatNiveau(e.target.value); setGMatGroupe(""); }}
                      style={{ padding: "9px 14px", background: gMatNiveau ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.05)",
                        border: gMatNiveau ? "1px solid rgba(99,102,241,0.4)" : "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 9, color: gMatNiveau ? "#a5b4fc" : "rgba(255,255,255,0.4)",
                        fontFamily: "Sora, sans-serif", fontSize: 13, outline: "none", minWidth: 160 }}>
                      <option value="" style={{ background: "#0d0d1a" }}>-- Tous les niveaux --</option>
                      {dynNiveaux.map(n => <option key={n} value={n} style={{ background: "#0d0d1a" }}>{n}</option>)}
                    </select>
                    <select value={gMatGroupe}
                      onChange={e => setGMatGroupe(e.target.value)}
                      disabled={!gMatNiveau}
                      style={{ padding: "9px 14px", background: gMatGroupe ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.05)",
                        border: gMatGroupe ? "1px solid rgba(99,102,241,0.4)" : "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 9, color: gMatGroupe ? "#a5b4fc" : "rgba(255,255,255,0.4)",
                        fontFamily: "Sora, sans-serif", fontSize: 13, outline: "none", minWidth: 130,
                        opacity: gMatNiveau ? 1 : 0.5 }}>
                      <option value="" style={{ background: "#0d0d1a" }}>-- Tous groupes --</option>
                      {dynGroupes.map(g => <option key={g} value={g} style={{ background: "#0d0d1a" }}>Groupe {g}</option>)}
                    </select>
                    {(gMatNiveau || gMatGroupe) && (
                      <button onClick={() => { setGMatNiveau(""); setGMatGroupe(""); }}
                        style={{ padding: "8px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)",
                          borderRadius: 9, color: "#f87171", cursor: "pointer", fontSize: 12, fontFamily: "Sora, sans-serif" }}>
                        ✕ Effacer
                      </button>
                    )}
                    <span style={{ marginLeft: "auto", fontSize: 12, color: "rgba(255,255,255,0.35)" }}>
                      {matieresFiltrees.length} matière{matieresFiltrees.length > 1 ? "s" : ""}
                    </span>
                  </div>
                </Card>

                {/* Modal Ajouter Matière */}
                {showAddMat && (
                  <div onClick={() => setShowAddMat(false)}
                    style={{ position: "fixed", inset: 0, zIndex: 300,
                      background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)",
                      display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
                    <div onClick={e => e.stopPropagation()}
                      style={{ background: "#0d0d1a", border: "1px solid rgba(255,255,255,0.09)",
                        borderRadius: 14, width: "100%", maxWidth: 500,
                        boxShadow: "0 24px 60px rgba(0,0,0,0.6)" }}>
                      <div style={{ padding: "18px 22px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)",
                        display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ fontWeight: 700, fontSize: 15, color: "#f1f5f9" }}>Ajouter une matière</div>
                        <button onClick={() => setShowAddMat(false)}
                          style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)",
                            cursor: "pointer", fontSize: 18, lineHeight: 1 }}>✕</button>
                      </div>
                      <div style={{ padding: "20px 22px 22px", display: "flex", flexDirection: "column", gap: 12 }}>
                        <div>
                          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontWeight: 600,
                            textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Nom de la matière</div>
                          <Input placeholder="Ex: Analyse Numérique II" value={formMat.nom}
                            onChange={e => setFormMat({...formMat, nom: e.target.value})} />
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                          <div>
                            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontWeight: 600,
                              textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Code</div>
                            <Input placeholder="Ex: AN2" value={formMat.code}
                              onChange={e => setFormMat({...formMat, code: e.target.value})} />
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontWeight: 600,
                              textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Coefficient</div>
                            <Input placeholder="1" type="number" value={formMat.coefficient}
                              onChange={e => setFormMat({...formMat, coefficient: e.target.value})} />
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontWeight: 600,
                            textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Niveau</div>
                          <Select value={formMat.annee_scolaire}
                            onChange={e => setFormMat({...formMat, annee_scolaire: e.target.value})}>
                            {dynNiveaux.map(n => <option key={n} value={n}>{n}</option>)}
                          </Select>
                        </div>
                        <div>
                          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontWeight: 600,
                            textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Professeur (optionnel)</div>
                          <Select value={formMat.professeur_id}
                            onChange={e => setFormMat({...formMat, professeur_id: e.target.value})}>
                            <option value="">— Aucun —</option>
                            {profs.filter(p => p.is_active).map(p => (
                              <option key={p.id} value={p.id}>{p.prenom} {p.nom}</option>
                            ))}
                          </Select>
                        </div>
                        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                          <Btn onClick={async () => { await addMat(); setShowAddMat(false); }}
                            style={{ flex: 1, padding: "10px" }}
                            disabled={!formMat.nom}>
                            Créer la matière
                          </Btn>
                          <Btn onClick={() => setShowAddMat(false)}
                            color="rgba(255,255,255,0.05)"
                            style={{ padding: "10px 16px", color: "rgba(255,255,255,0.4)",
                              border: "1px solid rgba(255,255,255,0.08)" }}>
                            Annuler
                          </Btn>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Liste matières */}
                <Card>
                  <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
                    <SectionTitle title={`Matières${gMatNiveau ? ` — ${gMatNiveau}` : ""}${gMatGroupe ? ` · Groupe ${gMatGroupe}` : ""} (${matieresFiltrees.length})`} />
                    <button onClick={() => { setFormMat({ nom:"", code:"", coefficient:"1", annee_scolaire: gMatNiveau || dynNiveaux[0] || "", professeur_id:"" }); setShowAddMat(true); }}
                      style={{ marginLeft: "auto", padding: "7px 16px", borderRadius: 7,
                        background: "#6366f1", border: "none", color: "#fff",
                        fontFamily: F, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                      + Ajouter une matière
                    </button>
                  </div>
                  {matieresFiltrees.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "32px 16px", color: "rgba(255,255,255,0.25)" }}>
                      <div style={{ fontSize: 30, marginBottom: 8 }}>📚</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.4)" }}>
                        {gMatNiveau ? `Aucune matière pour ${gMatNiveau}${gMatGroupe ? ` — Groupe ${gMatGroupe}` : ""}` : "Aucune matière"}
                      </div>
                    </div>
                  ) : (
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                          {["Matière","Coefficient","Professeur","Action"].map(h => (
                            <th key={h} style={{ padding: "9px 14px", textAlign: "left",
                              color: "rgba(255,255,255,0.35)", fontSize: 11, fontWeight: 600 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {matieresFiltrees.map((m, i) => (
                          <tr key={i} style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                            <td style={{ padding: "11px 14px", fontWeight: 600, fontSize: 14 }}>
                              {m.nom}
                              {m.code && <span style={{ marginLeft: 8, fontSize: 10, color: "#6366f1",
                                background: "rgba(99,102,241,0.12)", padding: "2px 7px", borderRadius: 4 }}>{m.code}</span>}
                            </td>
                            <td style={{ padding: "11px 14px", fontSize: 13, color: "#a5b4fc", fontWeight: 600 }}>
                              {m.coefficient}
                            </td>
                            <td style={{ padding: "11px 14px", fontSize: 13, color: "rgba(255,255,255,0.45)" }}>
                              {m.professeur || <span style={{ color: "rgba(255,255,255,0.2)", fontStyle: "italic" }}>Non assigné</span>}
                            </td>
                            <td style={{ padding: "11px 14px" }}>
                              <Btn onClick={() => deleteMat(m.id)} color="#ef4444"
                                style={{ padding: "5px 12px", fontSize: 11 }}>Supprimer</Btn>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </Card>

              </div>
              );
            })()}

            {/* Emploi du temps */}
            {gTab === "emplois" && (() => {
              const matieresFiltrees = matieres.filter(m => m.annee_scolaire === formEmploi.annee_scolaire);
              const emploisFiltres = emplois.filter(e =>
                (!gEmploiNiveau || e.niveau === gEmploiNiveau) &&
                (!gEmploiGroupe  || e.groupe === gEmploiGroupe)
              );
              const JOURS_ORDER = ["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"];
              const emploisTries = [...emploisFiltres].sort((a, b) =>  // keep for compat

                JOURS_ORDER.indexOf(a.jour) - JOURS_ORDER.indexOf(b.jour) ||
                (a.heure_debut || "").localeCompare(b.heure_debut || "")
              );
              return (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

                {/* ── Filtre affichage ── */}
                <Card>
                  <SectionTitle title="Consulter l'emploi du temps" icon="🔍" />
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <select value={gEmploiNiveau}
                      onChange={e => { setGEmploiNiveau(e.target.value); setGEmploiGroupe(""); }}
                      style={{ padding: "9px 14px", background: gEmploiNiveau ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.05)",
                        border: gEmploiNiveau ? "1px solid rgba(99,102,241,0.4)" : "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 9, color: gEmploiNiveau ? "#a5b4fc" : "rgba(255,255,255,0.4)",
                        fontFamily: "Sora, sans-serif", fontSize: 13, outline: "none", minWidth: 160 }}>
                      <option value="" style={{ background: "#0d0d1a" }}>-- Tous les niveaux --</option>
                      {dynNiveaux.map(n => <option key={n} value={n} style={{ background: "#0d0d1a" }}>{n}</option>)}
                    </select>
                    <select value={gEmploiGroupe}
                      onChange={e => setGEmploiGroupe(e.target.value)}
                      style={{ padding: "9px 14px", background: gEmploiGroupe ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.05)",
                        border: gEmploiGroupe ? "1px solid rgba(99,102,241,0.4)" : "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 9, color: gEmploiGroupe ? "#a5b4fc" : "rgba(255,255,255,0.4)",
                        fontFamily: "Sora, sans-serif", fontSize: 13, outline: "none", minWidth: 130 }}>
                      <option value="" style={{ background: "#0d0d1a" }}>-- Tous les groupes --</option>
                      {dynGroupes.map(g => <option key={g} value={g} style={{ background: "#0d0d1a" }}>Groupe {g}</option>)}
                    </select>
                    {(gEmploiNiveau || gEmploiGroupe) && (
                      <button onClick={() => { setGEmploiNiveau(""); setGEmploiGroupe(""); }}
                        style={{ padding: "8px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)",
                          borderRadius: 9, color: "#f87171", cursor: "pointer", fontSize: 12, fontFamily: "Sora, sans-serif" }}>
                        ✕ Effacer
                      </button>
                    )}
                    <span style={{ marginLeft: "auto", fontSize: 12, color: "rgba(255,255,255,0.35)" }}>
                      {emploisFiltres.length} créneau{emploisFiltres.length > 1 ? "x" : ""}
                    </span>
                  </div>
                </Card>

                {/* ── Tableau visuel par groupe ── */}
                {emploisFiltres.length === 0 ? (
                  <Card>
                    <div style={{ textAlign: "center", padding: "40px 20px" }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.35)" }}>
                        {gEmploiNiveau
                          ? `Aucun emploi du temps pour ${gEmploiNiveau}${gEmploiGroupe ? ` — Groupe ${gEmploiGroupe}` : ""}`
                          : "Sélectionnez un niveau pour afficher l'emploi du temps"}
                      </div>
                    </div>
                  </Card>
                ) : (() => {
                  // ─── Constantes grille ───────────────────────────────────
                  const JOURS_VIS = ["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"];
                  // 22 slots de 30min : 08h30 → 19h30
                  const TIME_SLOTS = Array.from({length: 22}, (_, i) => {
                    const min = 510 + i * 30;
                    const h = Math.floor(min / 60), m = min % 60;
                    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
                  });
                  const timeToCol = t => {
                    if (!t) return -1;
                    const [h, m] = t.slice(0,5).split(':').map(Number);
                    return Math.round((h * 60 + m - 510) / 30);
                  };
                  const courseStyle = nom => {
                    if (!nom) return { bg:"rgba(22,163,74,0.18)", border:"rgba(22,163,74,0.35)", text:"#4ade80" };
                    const n = nom.toLowerCase();
                    if (n.includes("business") || n.includes("tec/") || n.includes("droit") || n.includes("citoyenn")) {
                      return { bg:"rgba(217,119,6,0.2)", border:"rgba(217,119,6,0.4)", text:"#fbbf24" };
                    }
                    return { bg:"rgba(22,163,74,0.18)", border:"rgba(22,163,74,0.35)", text:"#4ade80" };
                  };

                  const groupes = [...new Set(emploisFiltres.map(e => e.groupe))].sort();
                  return groupes.map(gr => {
                    const creneaux = emploisFiltres.filter(e => e.groupe === gr);
                    const joursPresents = JOURS_VIS.filter(j => creneaux.some(e => e.jour === j));
                    // Unused vars kept for linter
                    const slots = []; const joursPresents2 = joursPresents;
                    return (
                      <Card key={gr} style={{ padding: "16px 12px" }}>
                        {/* Titre groupe */}
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0" }}>Groupe {gr}</span>
                          {gEmploiNiveau && (
                            <span style={{ fontSize: 11, color: "#7dd3fc",
                              background: "rgba(14,165,233,0.08)", border: "1px solid rgba(14,165,233,0.2)",
                              padding: "2px 10px", borderRadius: 20 }}>{gEmploiNiveau}</span>
                          )}
                          <span style={{ marginLeft: "auto", fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
                            {creneaux.length} créneau{creneaux.length > 1 ? "x" : ""}
                          </span>
                        </div>

                        {/* Grille horizontale */}
                        <div style={{ overflowX: "auto" }}>
                          <table style={{
                            borderCollapse: "collapse",
                            tableLayout: "fixed",
                            width: "100%",
                            minWidth: 900,
                          }}>
                            {/* ── En-tête horaires ── */}
                            <thead>
                              <tr>
                                <th style={{ width: "7%", minWidth: 72,
                                  background: "rgba(255,255,255,0.03)",
                                  border: "1px solid rgba(255,255,255,0.07)", padding: 0 }} />
                                {TIME_SLOTS.map((t, i) => {
                                  const nextMin = 510 + (i + 1) * 30;
                                  const nh = Math.floor(nextMin/60), nm = nextMin%60;
                                  const endT = `${String(nh).padStart(2,'0')}h${String(nm).padStart(2,'0')}`;
                                  const startT = t.replace(':', 'h');
                                  return (
                                    <th key={t} style={{
                                      padding: "4px 1px", textAlign: "center",
                                      background: "rgba(255,255,255,0.03)",
                                      border: "1px solid rgba(255,255,255,0.07)",
                                      verticalAlign: "middle" }}>
                                      <div style={{ fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,0.5)",
                                        lineHeight: 1.2 }}>{startT}</div>
                                      <div style={{ fontSize: 8, color: "rgba(255,255,255,0.25)",
                                        lineHeight: 1.2 }}>{endT}</div>
                                    </th>
                                  );
                                })}
                              </tr>
                            </thead>

                            {/* ── Lignes jours ── */}
                            <tbody>
                              {JOURS_VIS.map(jour => {
                                const dayCours = creneaux.filter(c => c.jour === jour);
                                // slotMap[i] = cours ou null
                                const slotMap = new Array(22).fill(null);
                                dayCours.forEach(c => {
                                  const start = timeToCol(c.heure_debut);
                                  const end   = timeToCol(c.heure_fin);
                                  if (start >= 0 && start < 22 && end > start) {
                                    slotMap[start] = { ...c, span: Math.min(end - start, 22 - start) };
                                  }
                                });
                                // Construire les cellules
                                const cells = [];
                                let i = 0;
                                while (i < 22) {
                                  const cours = slotMap[i];
                                  if (cours) {
                                    const cs = courseStyle(cours.matiere);
                                    cells.push(
                                      <td key={i} colSpan={cours.span} style={{
                                        background: cs.bg,
                                        border: `1px solid ${cs.border}`,
                                        padding: "8px 6px",
                                        verticalAlign: "middle",
                                        textAlign: "center",
                                        position: "relative",
                                        height: 64,
                                      }}>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: cs.text,
                                          lineHeight: 1.4, wordBreak: "break-word" }}>
                                          {cours.matiere}
                                        </div>
                                        {cours.salle && (
                                          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginTop: 4,
                                            fontWeight: 500 }}>
                                            {cours.salle}
                                          </div>
                                        )}
                                        <button onClick={() => deleteEmploi(cours.id)}
                                          title="Supprimer"
                                          style={{ position: "absolute", top: 3, right: 3,
                                            background: "rgba(0,0,0,0.2)", border: "none",
                                            borderRadius: 3, color: "rgba(255,255,255,0.4)",
                                            cursor: "pointer", fontSize: 9, padding: "1px 3px",
                                            lineHeight: 1 }}>✕</button>
                                      </td>
                                    );
                                    i += cours.span;
                                  } else {
                                    cells.push(
                                      <td key={i} style={{ border: "1px solid rgba(255,255,255,0.04)",
                                        background: "transparent" }} />
                                    );
                                    i++;
                                  }
                                }
                                return (
                                  <tr key={jour}>
                                    <td style={{ padding: "10px 6px", fontWeight: 700, fontSize: 12,
                                      color: "#a5b4fc", whiteSpace: "nowrap",
                                      background: "rgba(99,102,241,0.07)",
                                      border: "1px solid rgba(255,255,255,0.07)",
                                      textAlign: "center", verticalAlign: "middle",
                                      width: "7%", minWidth: 72 }}>
                                      {jour}
                                    </td>
                                    {cells}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </Card>
                    );
                  });
                })()}

                {/* ── Formulaire ajout créneau ── */}
                <Card>
                  <SectionTitle title="Ajouter un créneau" icon="➕" />
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                    <Select value={formEmploi.annee_scolaire}
                      onChange={e => setFormEmploi({...formEmploi, annee_scolaire: e.target.value, matiere_id: ""})}>
                      {dynNiveaux.map(n => <option key={n} value={n}>{n}</option>)}
                    </Select>
                    <Select value={formEmploi.classe}
                      onChange={e => setFormEmploi({...formEmploi, classe: e.target.value, matiere_id: ""})}>
                      {dynGroupes.map(g => <option key={g} value={g}>Groupe {g}</option>)}
                    </Select>
                    <Select value={formEmploi.jour}
                      onChange={e => setFormEmploi({...formEmploi, jour: e.target.value})}>
                      {JOURS.map(j => <option key={j} value={j}>{j}</option>)}
                    </Select>
                    <Select value={formEmploi.matiere_id}
                      onChange={e => setFormEmploi({...formEmploi, matiere_id: e.target.value})}>
                      <option value="">-- Matière ({matieresFiltrees.length} disponibles) --</option>
                      {matieresFiltrees.map(m => (
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
              </div>
            );})()}

            {/* Étudiants */}
            {gTab === "etudiants" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                {/* ── Sélecteur niveau + classe ── */}
                <Card>
                  <SectionTitle title="Filtrer les étudiants" icon="🎯" />
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <select value={gEstNiveau}
                      onChange={e => { setGEstNiveau(e.target.value); setGEstClasse(""); setSearchEtudiant(""); }}
                      style={{ padding: "9px 14px", background: gEstNiveau ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.05)",
                        border: gEstNiveau ? "1px solid rgba(99,102,241,0.4)" : "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 9, color: gEstNiveau ? "#a5b4fc" : "rgba(255,255,255,0.4)",
                        fontFamily: "Sora, sans-serif", fontSize: 13, outline: "none", minWidth: 160 }}>
                      <option value="" style={{ background: "#0d0d1a" }}>-- Niveau --</option>
                      {dynNiveaux.map(n => <option key={n} value={n} style={{ background: "#0d0d1a" }}>{n}</option>)}
                    </select>
                    <select value={gEstClasse}
                      onChange={e => { setGEstClasse(e.target.value); setSearchEtudiant(""); }}
                      disabled={!gEstNiveau}
                      style={{ padding: "9px 14px", background: gEstClasse ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.05)",
                        border: gEstClasse ? "1px solid rgba(99,102,241,0.4)" : "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 9, color: gEstClasse ? "#a5b4fc" : "rgba(255,255,255,0.4)",
                        fontFamily: "Sora, sans-serif", fontSize: 13, outline: "none", minWidth: 140,
                        opacity: gEstNiveau ? 1 : 0.5 }}>
                      <option value="" style={{ background: "#0d0d1a" }}>-- Groupe --</option>
                      {dynGroupes.map(g => <option key={g} value={g} style={{ background: "#0d0d1a" }}>Groupe {g}</option>)}
                    </select>
                    {(gEstNiveau || gEstClasse) && (
                      <button onClick={() => { setGEstNiveau(""); setGEstClasse(""); setSearchEtudiant(""); }}
                        style={{ padding: "8px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)",
                          borderRadius: 9, color: "#f87171", cursor: "pointer", fontSize: 12, fontFamily: "Sora, sans-serif" }}>
                        ✕ Effacer
                      </button>
                    )}
                    {gEstClasse && (
                      <div style={{ marginLeft: "auto", fontSize: 12, color: "#a5b4fc", fontWeight: 600,
                        background: "rgba(99,102,241,0.1)", padding: "6px 14px", borderRadius: 9,
                        border: "1px solid rgba(99,102,241,0.2)" }}>
                        {gEstNiveau} — Groupe {gEstClasse} · {etudiantsFiltres.length} étudiant{etudiantsFiltres.length > 1 ? "s" : ""}
                      </div>
                    )}
                  </div>
                </Card>

                {/* ── Message si pas de filtre ── */}
                {!gEstClasse ? (
                  <div style={{ textAlign: "center", padding: "48px 20px",
                    color: "rgba(255,255,255,0.25)" }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>🎓</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>
                      Sélectionnez un niveau et un groupe
                    </div>
                    <div style={{ fontSize: 13 }}>pour afficher la liste des étudiants</div>
                  </div>
                ) : (
                  <>
                <Card>
                  {/* Barre de recherche compacte */}
                  <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center" }}>
                    <Input placeholder="Rechercher nom, prénom, email…" value={searchEtudiant}
                      onChange={e => setSearchEtudiant(e.target.value)}
                      style={{ flex: 1, maxWidth: 340, padding: "7px 12px", fontSize: 12 }} />
                    <Select value={filterStatut} onChange={e => setFilterStatut(e.target.value)}
                      style={{ width: 130, padding: "7px 10px", fontSize: 12 }}>
                      <option value="">Tous statuts</option>
                      <option value="actif">Compte actif</option>
                      <option value="inactif">Compte inactif</option>
                      <option value="sans_compte">Sans compte</option>
                    </Select>
                    <Btn onClick={exportEtudiants} color="rgba(34,197,94,0.2)"
                      style={{ border: "1px solid rgba(34,197,94,0.4)", color: "#22c55e",
                        padding: "7px 14px", fontSize: 12, flexShrink: 0 }}>
                      ⬇ CSV
                    </Btn>
                  </div>
                  <SectionTitle title={`Étudiants (${etudiantsFiltres.length}${etudiantsFiltres.length !== etudiants.length ? ` / ${etudiants.length}` : ""})`} icon="🎓" />
                  {etudiantsFiltres.length === 0 ? <EmptyState message="Aucun étudiant trouvé" /> :
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
                        <thead>
                          <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                            {["Étudiant","Classe / Année","Contact","Enrôlement","Présence","Absences","Moyenne","Compte","Actions"].map(h => (
                              <th key={h} style={{ padding: "10px 10px", textAlign: "left",
                                color: "rgba(255,255,255,0.4)", fontSize: 11, whiteSpace: "nowrap" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {etudiantsFiltres.map((s, i) => (
                            <tr key={i} onClick={() => openEtudiant(s)} style={{
                              borderBottom: "1px solid rgba(255,255,255,0.04)",
                              cursor: "pointer", transition: "background 0.15s",
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = "rgba(99,102,241,0.06)"}
                            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
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
                                  <div style={{ width: 52, height: 6, background: "rgba(255,255,255,0.07)", borderRadius: 100, overflow: "hidden" }}>
                                    <div style={{
                                      width: `${s.taux_presence || 0}%`, height: "100%", borderRadius: 100,
                                      background: (s.taux_presence || 0) >= 75 ? "linear-gradient(90deg,#16a34a,#22c55e)"
                                        : (s.taux_presence || 0) >= 50 ? "linear-gradient(90deg,#d97706,#f59e0b)" : "linear-gradient(90deg,#dc2626,#ef4444)",
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
                                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                                  {/* Pas de compte : proposer création */}
                                  {!s.has_account && s.is_enrolled && (
                                    <Btn onClick={() => creerCompteEtudiant(s)} color="#0ea5e9"
                                      style={{ padding: "4px 9px", fontSize: 11 }}>+ Compte</Btn>
                                  )}
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

                {/* Comptes orphelins */}
                {orphelins.length > 0 && (
                  <Card style={{ borderTop: "2px solid #f59e0b" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(245,158,11,0.15)",
                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>⚠️</div>
                      <div>
                        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Comptes sans profil</h2>
                        <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
                          Ces comptes ne sont liés à aucun profil étudiant. Supprimez-les ou liez-les manuellement.
                        </p>
                      </div>
                    </div>
                    {orphelins.map(o => (
                      <div key={o.user_id} style={{
                        padding: "12px 14px", marginBottom: 8,
                        background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.2)",
                        borderRadius: 10,
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                          <div style={{ flex: 1, minWidth: 160 }}>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{o.prenom} {o.nom}</div>
                            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{o.email}</div>
                            <span style={{
                              fontSize: 10, padding: "1px 7px", borderRadius: 100, fontWeight: 600,
                              background: o.is_active ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
                              color: o.is_active ? "#22c55e" : "#ef4444", marginTop: 4, display: "inline-block",
                            }}>{o.is_active ? "Actif" : "Inactif"}</span>
                          </div>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <Btn onClick={() => { setProfilTarget(o); setLinkTarget(null); }}
                              color="#22c55e" style={{ padding: "5px 10px", fontSize: 11 }}>
                              ✚ Créer profil
                            </Btn>
                            <Btn onClick={() => { setLinkTarget(o); setProfilTarget(null); setLinkStudentId(""); }}
                              color="#f59e0b" style={{ padding: "5px 10px", fontSize: 11 }}>
                              🔗 Lier
                            </Btn>
                            <Btn onClick={() => deleteOrphelin(o.user_id)} color="#7f1d1d"
                              style={{ padding: "5px 10px", fontSize: 11 }}>Supprimer</Btn>
                          </div>
                        </div>

                        {/* Formulaire Créer profil */}
                        {profilTarget?.user_id === o.user_id && (
                          <div style={{
                            marginTop: 10, paddingTop: 10,
                            borderTop: "1px solid rgba(34,197,94,0.2)",
                            display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap",
                          }}>
                            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", whiteSpace: "nowrap" }}>Niveau :</span>
                            <Select value={profilForm.annee_scolaire}
                              onChange={e => setProfilForm(f => ({ ...f, annee_scolaire: e.target.value }))}
                              style={{ width: 140, fontSize: 12, padding: "6px 8px" }}>
                              {NIVEAUX.map(n => <option key={n} value={n}>{n}</option>)}
                            </Select>
                            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", whiteSpace: "nowrap" }}>Groupe :</span>
                            <Select value={profilForm.classe}
                              onChange={e => setProfilForm(f => ({ ...f, classe: e.target.value }))}
                              style={{ width: 80, fontSize: 12, padding: "6px 8px" }}>
                              {GROUPES.map(g => <option key={g} value={g}>Gr. {g}</option>)}
                            </Select>
                            <Btn onClick={creerProfilOrphelin} color="#22c55e"
                              style={{ padding: "6px 12px", fontSize: 12 }}>Confirmer</Btn>
                            <Btn onClick={() => setProfilTarget(null)}
                              color="rgba(255,255,255,0.08)"
                              style={{ padding: "6px 12px", fontSize: 12, border: "1px solid rgba(255,255,255,0.1)" }}>
                              Annuler
                            </Btn>
                          </div>
                        )}

                        {/* Formulaire de liaison inline */}
                        {linkTarget?.user_id === o.user_id && (
                          <div style={{
                            marginTop: 10, paddingTop: 10,
                            borderTop: "1px solid rgba(245,158,11,0.2)",
                            display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap",
                          }}>
                            <Select value={linkStudentId} onChange={e => setLinkStudentId(e.target.value)}
                              style={{ flex: 1, minWidth: 200, fontSize: 12, padding: "6px 10px" }}>
                              <option value="">-- Choisir le profil étudiant --</option>
                              {etudiants.map(s => (
                                <option key={s.id} value={s.id}>
                                  {s.prenom} {s.nom} — {s.classe} {s.has_account ? "(a déjà un compte)" : ""}
                                </option>
                              ))}
                            </Select>
                            <Btn onClick={lierCompteEtudiant} color="#22c55e"
                              style={{ padding: "6px 12px", fontSize: 12 }}>Confirmer</Btn>
                            <Btn onClick={() => { setLinkTarget(null); setLinkStudentId(""); }}
                              color="rgba(255,255,255,0.08)"
                              style={{ padding: "6px 12px", fontSize: 12, border: "1px solid rgba(255,255,255,0.1)" }}>
                              Annuler
                            </Btn>
                          </div>
                        )}
                      </div>
                    ))}
                  </Card>
                )}
                  </>
                )}
              </div>
            )}

            {/* ── Notes ── */}
            {gTab === "notes_disabled" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

                {/* Formulaire ajout / édition */}
                <Card>
                  <SectionTitle title={editNote ? "Modifier la note" : "Saisir une note"} icon={editNote ? "✏️" : "➕"} />
                  {noteMsg && (
                    <div style={{
                      marginBottom: 12, padding: "10px 14px", borderRadius: 9, fontSize: 13, fontWeight: 500,
                      background: noteMsg === "ok" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                      border: `1px solid ${noteMsg === "ok" ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
                      color: noteMsg === "ok" ? "#22c55e" : "#ef4444",
                    }}>
                      {noteMsg === "ok" ? "✅ Note enregistrée !" : noteMsg.replace("err:", "")}
                    </div>
                  )}
                  {editNote ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={{ padding: "10px 14px", background: "rgba(99,102,241,0.08)",
                        borderRadius: 10, fontSize: 13, color: "rgba(255,255,255,0.6)" }}>
                        {editNote.etudiant} — {editNote.matiere} ({editNote.classe})
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                        <Input placeholder="Note /20" type="number" value={editNote.note}
                          onChange={e => setEditNote(n => ({...n, note: e.target.value}))} />
                        <Select value={editNote.type} onChange={e => setEditNote(n => ({...n, type: e.target.value}))}>
                          <option value="controle">Contrôle</option>
                          <option value="examen">Examen</option>
                          <option value="tp">TP</option>
                        </Select>
                        <Input placeholder="Commentaire (optionnel)" value={editNote.commentaire || ""}
                          onChange={e => setEditNote(n => ({...n, commentaire: e.target.value}))} />
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <Btn onClick={saveEditNote} style={{ flex: 1 }}>💾 Enregistrer</Btn>
                        <Btn onClick={() => setEditNote(null)} color="rgba(255,255,255,0.06)"
                          style={{ padding: "9px 18px", color: "rgba(255,255,255,0.5)" }}>Annuler</Btn>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <Select value={formNote.student_id}
                          onChange={e => setFormNote(f => ({...f, student_id: e.target.value}))}>
                          <option value="">-- Étudiant --</option>
                          {etudiants.map(s => (
                            <option key={s.id} value={s.id}>{s.prenom} {s.nom} ({s.classe})</option>
                          ))}
                        </Select>
                        <Select value={formNote.matiere_id}
                          onChange={e => setFormNote(f => ({...f, matiere_id: e.target.value}))}>
                          <option value="">-- Matière --</option>
                          {matieres.map(m => (
                            <option key={m.id} value={m.id}>{m.nom} ({m.classe})</option>
                          ))}
                        </Select>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
                        <Input placeholder="Note /20" type="number" min="0" max="20" step="0.25"
                          value={formNote.note}
                          onChange={e => setFormNote(f => ({...f, note: e.target.value}))} />
                        <Select value={formNote.type}
                          onChange={e => setFormNote(f => ({...f, type: e.target.value}))}>
                          <option value="controle">Contrôle</option>
                          <option value="examen">Examen</option>
                          <option value="tp">TP</option>
                        </Select>
                        <Input placeholder="Date (YYYY-MM-DD)" value={formNote.date}
                          onChange={e => setFormNote(f => ({...f, date: e.target.value}))} />
                        <Input placeholder="Commentaire" value={formNote.commentaire}
                          onChange={e => setFormNote(f => ({...f, commentaire: e.target.value}))} />
                      </div>
                      <Btn onClick={addNote}
                        style={{ opacity: (!formNote.student_id || !formNote.matiere_id || formNote.note === "") ? 0.5 : 1 }}>
                        ➕ Ajouter la note
                      </Btn>
                    </div>
                  )}
                </Card>

                {/* Liste des notes */}
                <Card>
                  <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
                    <SectionTitle title={`Notes saisies (${notes.length})`} icon="📋" />
                    <Btn onClick={exportNotes} color="rgba(34,197,94,0.2)"
                      style={{ marginLeft: "auto", border: "1px solid rgba(34,197,94,0.4)", color: "#22c55e", padding: "6px 12px", fontSize: 11 }}>
                      ⬇ CSV
                    </Btn>
                  </div>
                  {notes.length === 0 ? <EmptyState message="Aucune note saisie" /> : (
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
                        <thead>
                          <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                            {["Étudiant","Classe","Matière","Note","Type","Date","Commentaire","Actions"].map(h => (
                              <th key={h} style={{ padding: "8px 10px", textAlign: "left",
                                color: "rgba(255,255,255,0.4)", fontSize: 11 }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {notes.map((n, i) => (
                            <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                              <td style={{ padding: "9px 10px", fontSize: 13, fontWeight: 500 }}>{n.etudiant}</td>
                              <td style={{ padding: "9px 10px" }}>
                                <span style={{ background: "rgba(99,102,241,0.15)", color: "#6366f1",
                                  padding: "2px 7px", borderRadius: 5, fontSize: 11 }}>{n.classe}</span>
                              </td>
                              <td style={{ padding: "9px 10px", fontSize: 13 }}>{n.matiere}</td>
                              <td style={{ padding: "9px 10px", fontWeight: 700, fontSize: 15,
                                color: n.note >= 10 ? "#22c55e" : "#ef4444" }}>{n.note}/20</td>
                              <td style={{ padding: "9px 10px", fontSize: 12,
                                color: "rgba(255,255,255,0.5)" }}>{n.type}</td>
                              <td style={{ padding: "9px 10px", fontSize: 12,
                                color: "rgba(255,255,255,0.4)" }}>{n.date}</td>
                              <td style={{ padding: "9px 10px", fontSize: 12,
                                color: "rgba(255,255,255,0.4)", maxWidth: 160,
                                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {n.commentaire || "—"}
                              </td>
                              <td style={{ padding: "9px 10px" }}>
                                <div style={{ display: "flex", gap: 5 }}>
                                  <Btn onClick={() => setEditNote(n)} color="rgba(99,102,241,0.2)"
                                    style={{ padding: "4px 9px", fontSize: 11, border: "1px solid rgba(99,102,241,0.4)", color: "#a5b4fc" }}>
                                    Modifier
                                  </Btn>
                                  <Btn onClick={() => deleteNote(n.id)} color="#ef4444"
                                    style={{ padding: "4px 9px", fontSize: 11 }}>Supprimer</Btn>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              </div>
            )}

            {/* ── Alertes manuelles ── */}
            {gTab === "alertes_disabled" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <Card>
                  <SectionTitle title="Envoyer une alerte" icon="📣" />
                  {alerteMsg && (
                    <div style={{
                      marginBottom: 14, padding: "11px 16px", borderRadius: 9, fontSize: 13, fontWeight: 500,
                      background: alerteMsg.startsWith("ok") ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                      border: `1px solid ${alerteMsg.startsWith("ok") ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
                      color: alerteMsg.startsWith("ok") ? "#22c55e" : "#ef4444",
                    }}>
                      {alerteMsg.startsWith("ok")
                        ? `✅ Alerte envoyée à ${alerteMsg.split(":")[1]} étudiant(s) !`
                        : alerteMsg.replace("err:", "")}
                    </div>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {/* Cible */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <Select value={formAlerte.cible}
                        onChange={e => setFormAlerte(f => ({...f, cible: e.target.value, student_id: "", annee_scolaire: "", classe: ""}))}>
                        <option value="etudiant">Étudiant précis</option>
                        <option value="classe">Toute une classe</option>
                      </Select>
                      {formAlerte.cible === "etudiant" ? (
                        <Select value={formAlerte.student_id}
                          onChange={e => setFormAlerte(f => ({...f, student_id: e.target.value}))}>
                          <option value="">-- Choisir un étudiant --</option>
                          {etudiants.map(s => (
                            <option key={s.id} value={s.id}>{s.prenom} {s.nom} ({s.annee_scolaire} - Grp {s.classe})</option>
                          ))}
                        </Select>
                      ) : (
                        <>
                          <Select value={formAlerte.annee_scolaire}
                            onChange={e => setFormAlerte(f => ({...f, annee_scolaire: e.target.value, classe: ""}))}>
                            <option value="">-- Niveau scolaire --</option>
                            {dynNiveaux.map(nv => (
                              <option key={nv} value={nv}>{nv}</option>
                            ))}
                          </Select>
                          <Select value={formAlerte.classe}
                            onChange={e => setFormAlerte(f => ({...f, classe: e.target.value}))}
                            disabled={!formAlerte.annee_scolaire}>
                            <option value="">-- Groupe --</option>
                            {dynGroupes.map(g => (
                              <option key={g} value={g}>Groupe {g}</option>
                            ))}
                          </Select>
                        </>
                      )}
                    </div>
                    {/* Type + Sévérité */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <Select value={formAlerte.type}
                        onChange={e => setFormAlerte(f => ({...f, type: e.target.value}))}>
                        <option value="information">Information</option>
                        <option value="avertissement">Avertissement</option>
                        <option value="convocation">Convocation</option>
                        <option value="absences_excessives">Absences excessives</option>
                        <option value="notes_faibles">Notes faibles</option>
                      </Select>
                      <Select value={formAlerte.severity}
                        onChange={e => setFormAlerte(f => ({...f, severity: e.target.value}))}>
                        <option value="low">🟢 Faible</option>
                        <option value="medium">🟡 Moyen</option>
                        <option value="high">🔴 Urgent</option>
                      </Select>
                    </div>
                    {/* Message */}
                    <textarea value={formAlerte.message}
                      onChange={e => setFormAlerte(f => ({...f, message: e.target.value}))}
                      placeholder="Message de l'alerte..."
                      rows={4}
                      style={{
                        width: "100%", padding: "10px 14px", boxSizing: "border-box",
                        background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 10, color: "#fff", fontSize: 13,
                        fontFamily: "Sora, sans-serif", outline: "none", resize: "vertical",
                      }} />
                    <Btn onClick={sendAlerte}
                      style={{
                        opacity: (!formAlerte.message.trim() ||
                          (formAlerte.cible === "etudiant" && !formAlerte.student_id) ||
                          (formAlerte.cible === "classe" && (!formAlerte.annee_scolaire || !formAlerte.classe))) ? 0.5 : 1,
                      }}>
                      📣 Envoyer l'alerte
                    </Btn>
                  </div>
                </Card>

                {/* Info */}
                <div style={{ padding: "12px 16px", background: "rgba(99,102,241,0.06)",
                  border: "1px solid rgba(99,102,241,0.2)", borderRadius: 12,
                  fontSize: 12, color: "rgba(255,255,255,0.4)", lineHeight: 1.7 }}>
                  ℹ️ Les alertes envoyées apparaissent dans l'onglet <strong style={{ color: "#a5b4fc" }}>Alertes</strong> du dashboard étudiant.
                  L'étudiant peut les marquer comme lues.
                </div>
              </div>
            )}

            {/* ── Salles ── */}
            {gTab === "salles_disabled" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {salleMsg && (
                  <div style={{
                    padding: "10px 14px", borderRadius: 8, fontSize: 13,
                    background: salleMsg === "ok" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                    border: `1px solid ${salleMsg === "ok" ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
                    color: salleMsg === "ok" ? "#22c55e" : "#ef4444",
                  }}>
                    {salleMsg === "ok" ? "✅ Salle enregistrée" : `❌ ${salleMsg.replace("err:", "")}`}
                  </div>
                )}

                {/* Formulaire ajout / édition */}
                <Card>
                  <SectionTitle title={editSalle ? "Modifier la salle" : "Ajouter une salle"} icon="🏫" />
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <Input
                        placeholder="Nom de la salle (ex: Salle 101)"
                        value={editSalle ? editSalle.nom : formSalle.nom}
                        onChange={e => editSalle
                          ? setEditSalle(s => ({...s, nom: e.target.value}))
                          : setFormSalle(s => ({...s, nom: e.target.value}))} />
                      <Input
                        placeholder="Numéro (ex: 101)"
                        value={editSalle ? editSalle.numero ?? "" : formSalle.numero}
                        onChange={e => editSalle
                          ? setEditSalle(s => ({...s, numero: e.target.value}))
                          : setFormSalle(s => ({...s, numero: e.target.value}))} />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <Input
                        placeholder="Bâtiment (ex: Bloc A)"
                        value={editSalle ? editSalle.batiment ?? "" : formSalle.batiment}
                        onChange={e => editSalle
                          ? setEditSalle(s => ({...s, batiment: e.target.value}))
                          : setFormSalle(s => ({...s, batiment: e.target.value}))} />
                      <Input
                        placeholder="Capacité (places)"
                        type="number"
                        value={editSalle ? editSalle.capacite ?? "" : formSalle.capacite}
                        onChange={e => editSalle
                          ? setEditSalle(s => ({...s, capacite: e.target.value}))
                          : setFormSalle(s => ({...s, capacite: e.target.value}))} />
                    </div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <Input
                        placeholder="URL caméra (rtsp://... ou http://...)"
                        value={editSalle ? editSalle.camera_url ?? "" : formSalle.camera_url}
                        onChange={e => editSalle
                          ? setEditSalle(s => ({...s, camera_url: e.target.value}))
                          : setFormSalle(s => ({...s, camera_url: e.target.value}))}
                        style={{ flex: 1 }} />
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", flexShrink: 0 }}>
                        📡 Optionnel
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <Btn
                        onClick={editSalle ? updateSalle : saveSalle}
                        disabled={!(editSalle ? editSalle.nom : formSalle.nom)}>
                        {editSalle ? "💾 Enregistrer" : "➕ Ajouter la salle"}
                      </Btn>
                      {editSalle && (
                        <Btn onClick={() => setEditSalle(null)}
                          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)" }}>
                          Annuler
                        </Btn>
                      )}
                    </div>
                  </div>
                </Card>

                {/* Liste des salles */}
                <Card>
                  <SectionTitle title={`Salles (${salles.length})`} icon="📋" />
                  {salles.length === 0 ? <EmptyState message="Aucune salle enregistrée" /> : (
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                          {["Salle","Numéro","Bâtiment","Capacité","URL Caméra","Actions"].map(h => (
                            <th key={h} style={{ padding: "10px 12px", textAlign: "left",
                              color: "rgba(255,255,255,0.4)", fontSize: 12 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {salles.map(s => (
                          <tr key={s.id} className="sc-tr"
                            style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                            <td style={{ padding: "11px 12px", fontWeight: 600 }}>{s.nom}</td>
                            <td style={{ padding: "11px 12px", color: "rgba(255,255,255,0.6)" }}>
                              {s.numero || "—"}
                            </td>
                            <td style={{ padding: "11px 12px", color: "rgba(255,255,255,0.6)" }}>
                              {s.batiment || "—"}
                            </td>
                            <td style={{ padding: "11px 12px", color: "rgba(255,255,255,0.6)" }}>
                              {s.capacite ? `${s.capacite} pl.` : "—"}
                            </td>
                            <td style={{ padding: "11px 12px", maxWidth: 220 }}>
                              {s.camera_url ? (
                                <span style={{ fontSize: 11, color: "#22c55e",
                                  background: "rgba(34,197,94,0.1)", padding: "2px 8px",
                                  borderRadius: 6, fontFamily: "monospace",
                                  display: "inline-block", maxWidth: 200,
                                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  📡 {s.camera_url}
                                </span>
                              ) : (
                                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>
                                  Pas de caméra
                                </span>
                              )}
                            </td>
                            <td style={{ padding: "11px 12px" }}>
                              <div style={{ display: "flex", gap: 6 }}>
                                <button onClick={() => setEditSalle({...s})}
                                  style={{ padding: "5px 10px", background: "rgba(99,102,241,0.15)",
                                    border: "1px solid rgba(99,102,241,0.3)", borderRadius: 6,
                                    color: "#a5b4fc", cursor: "pointer", fontSize: 11,
                                    fontFamily: "Sora, sans-serif" }}>Modifier</button>
                                <button onClick={() => deleteSalle(s.id)}
                                  style={{ padding: "5px 10px", background: "rgba(239,68,68,0.1)",
                                    border: "1px solid rgba(239,68,68,0.25)", borderRadius: 6,
                                    color: "#f87171", cursor: "pointer", fontSize: 11,
                                    fontFamily: "Sora, sans-serif" }}>Supprimer</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </Card>
              </div>
            )}

            {/* ── Sessions ── */}
            {gTab === "sessions" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {/* Filtres */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Select value={filterSNiveau} onChange={e => { setFilterSNiveau(e.target.value); setFilterSClasse(""); }}
                    style={{ flex: 1, minWidth: 160 }}>
                    <option value="">Tous niveaux</option>
                    {dynNiveaux.map(n => <option key={n} value={n}>{n}</option>)}
                  </Select>
                  <Select value={filterSClasse} onChange={e => setFilterSClasse(e.target.value)} style={{ width: 120 }}>
                    <option value="">Tous groupes</option>
                    {dynGroupes.map(g => <option key={g} value={g}>Groupe {g}</option>)}
                  </Select>
                  <Select value={filterSMatiere} onChange={e => setFilterSMatiere(e.target.value)} style={{ flex: 1, minWidth: 160 }}>
                    <option value="">Toutes matières</option>
                    {matieres.map(m => <option key={m.id} value={m.id}>{m.nom} ({m.annee_scolaire} {m.classe})</option>)}
                  </Select>
                  <Btn onClick={() => loadSessions(0)} color="rgba(99,102,241,0.2)"
                    style={{ border: "1px solid rgba(99,102,241,0.4)", color: "#a5b4fc", padding: "9px 16px", fontSize: 13 }}>
                    Filtrer
                  </Btn>
                  <Btn onClick={() => { setFilterSNiveau(""); setFilterSClasse(""); setFilterSMatiere(""); loadSessions(0); }}
                    color="rgba(255,255,255,0.06)"
                    style={{ border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)", padding: "9px 14px", fontSize: 13 }}>
                    Réinitialiser
                  </Btn>
                </div>

                {/* ── Modal détail session ── */}
                {sessionModal && (
                  <div onClick={() => setSessionModal(null)} style={{
                    position: "fixed", inset: 0, zIndex: 1000,
                    background: "rgba(0,0,0,0.7)", display: "flex",
                    alignItems: "center", justifyContent: "center", padding: 20,
                  }}>
                    <div onClick={e => e.stopPropagation()} style={{
                      background: "#1e1e2e", borderRadius: 16, width: "100%", maxWidth: 560,
                      maxHeight: "85vh", display: "flex", flexDirection: "column",
                      border: "1px solid rgba(255,255,255,0.08)",
                      boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
                    }}>
                      {/* Header */}
                      {sessionModal.loading ? (
                        <div style={{ padding: 40, textAlign: "center", color: "rgba(255,255,255,0.4)" }}>
                          Chargement…
                        </div>
                      ) : (
                        <>
                          <div style={{ padding: "18px 22px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                              <div>
                                <div style={{ fontWeight: 700, fontSize: 16 }}>
                                  {sessionModal.session?.matiere}
                                </div>
                                <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 3 }}>
                                  {sessionModal.session?.niveau} · Groupe {sessionModal.session?.classe} ·{" "}
                                  {sessionModal.session?.date} · {sessionModal.session?.heure_debut} → {sessionModal.session?.heure_fin}
                                  {sessionModal.session?.salle ? ` · ${sessionModal.session.salle}` : ""}
                                </div>
                              </div>
                              <button onClick={() => setSessionModal(null)} style={{
                                background: "none", border: "none", color: "rgba(255,255,255,0.4)",
                                fontSize: 20, cursor: "pointer", lineHeight: 1,
                              }}>✕</button>
                            </div>
                            {/* Stats résumé */}
                            {sessionModal.stats && (
                              <div style={{ display: "flex", gap: 12, marginTop: 14 }}>
                                {[
                                  { label: "Présents", val: sessionModal.stats.presents, color: "#22c55e" },
                                  { label: "Retards",  val: sessionModal.stats.retards,  color: "#f59e0b" },
                                  { label: "Absents",  val: sessionModal.stats.absents,  color: "#ef4444" },
                                  { label: "Total",    val: sessionModal.stats.total,     color: "#6366f1" },
                                ].map(({ label, val, color }) => (
                                  <div key={label} style={{
                                    flex: 1, background: `${color}18`, borderRadius: 10,
                                    padding: "10px 0", textAlign: "center",
                                    border: `1px solid ${color}30`,
                                  }}>
                                    <div style={{ fontSize: 22, fontWeight: 700, color }}>{val}</div>
                                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>{label}</div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Liste étudiants */}
                          <div style={{ overflowY: "auto", flex: 1, padding: "6px 0" }}>
                            {(sessionModal.etudiants || []).map((etu, i) => {
                              const statusColors = {
                                present: { bg: "#22c55e20", text: "#22c55e", label: "Présent" },
                                retard:  { bg: "#f59e0b20", text: "#f59e0b", label: "Retard"  },
                                absent:  { bg: "#ef444420", text: "#ef4444", label: "Absent"  },
                              };
                              const sc = statusColors[etu.status] || statusColors.absent;
                              return (
                                <div key={i} style={{
                                  display: "flex", alignItems: "center", justifyContent: "space-between",
                                  padding: "10px 22px",
                                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                                }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <div style={{
                                      width: 34, height: 34, borderRadius: "50%",
                                      background: `${sc.text}20`, display: "flex",
                                      alignItems: "center", justifyContent: "center",
                                      fontSize: 13, fontWeight: 700, color: sc.text,
                                    }}>
                                      {etu.prenom[0]}{etu.nom[0]}
                                    </div>
                                    <div>
                                      <div style={{ fontSize: 13, fontWeight: 500 }}>
                                        {etu.prenom} {etu.nom}
                                      </div>
                                      {etu.detected_at && (
                                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
                                          Détecté à {etu.detected_at}
                                          {etu.confidence ? ` · ${etu.confidence}%` : ""}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{
                                      background: sc.bg, color: sc.text,
                                      padding: "3px 10px", borderRadius: 20,
                                      fontSize: 11, fontWeight: 600,
                                    }}>{sc.label}</span>
                                    {etu.status === "absent" && (
                                      <button
                                        onClick={async () => {
                                          try {
                                            await axios.put(
                                              `${API_URL}/api/attendance/session/${sessionModal.session.id}/student/${etu.student_id}`,
                                              { status: "present" },
                                              authHeaders()
                                            );
                                            setSessionModal(prev => ({
                                              ...prev,
                                              etudiants: prev.etudiants.map(e =>
                                                e.student_id === etu.student_id ? { ...e, status: "present" } : e
                                              ),
                                              stats: {
                                                ...prev.stats,
                                                presents: prev.stats.presents + 1,
                                                absents:  prev.stats.absents  - 1,
                                              }
                                            }));
                                          } catch {}
                                        }}
                                        style={{
                                          padding: "3px 9px", borderRadius: 6, border: "1px solid rgba(34,197,94,0.4)",
                                          background: "rgba(34,197,94,0.08)", color: "#86efac",
                                          fontSize: 11, fontWeight: 600, cursor: "pointer",
                                          whiteSpace: "nowrap",
                                        }}>
                                        ✓ Présent
                                      </button>
                                    )}
                                    {etu.status === "present" && (
                                      <button
                                        onClick={async () => {
                                          try {
                                            await axios.put(
                                              `${API_URL}/api/attendance/session/${sessionModal.session.id}/student/${etu.student_id}`,
                                              { status: "absent" },
                                              authHeaders()
                                            );
                                            setSessionModal(prev => ({
                                              ...prev,
                                              etudiants: prev.etudiants.map(e =>
                                                e.student_id === etu.student_id ? { ...e, status: "absent" } : e
                                              ),
                                              stats: {
                                                ...prev.stats,
                                                presents: prev.stats.presents - 1,
                                                absents:  prev.stats.absents  + 1,
                                              }
                                            }));
                                          } catch {}
                                        }}
                                        style={{
                                          padding: "3px 9px", borderRadius: 6, border: "1px solid rgba(239,68,68,0.3)",
                                          background: "rgba(239,68,68,0.06)", color: "#fca5a5",
                                          fontSize: 11, fontWeight: 600, cursor: "pointer",
                                          whiteSpace: "nowrap",
                                        }}>
                                        ✕ Absent
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}

                <Card>
                  <SectionTitle title={`Séances (${sessions.length})`} icon="🎬" />
                  {sessions.length === 0 ? <EmptyState message="Aucune séance" /> : (
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
                        <thead>
                          <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                            {["Date","Matière","Classe","Horaire","Salle","Statut","Présence","Actions"].map(h => (
                              <th key={h} style={{ padding: "8px 10px", textAlign: "left",
                                color: "rgba(255,255,255,0.4)", fontSize: 11 }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {sessions.map((s, i) => {
                            const statColor = s.status === "terminee" ? "#22c55e" : s.status === "en_cours" ? "#f59e0b" : "#6366f1";
                            return (
                              <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                                <td style={{ padding: "9px 10px", fontSize: 13, fontWeight: 500 }}>{s.date}</td>
                                <td style={{ padding: "9px 10px", fontSize: 13 }}>{s.matiere}</td>
                                <td style={{ padding: "9px 10px" }}>
                                  <span style={{ background: "rgba(99,102,241,0.15)", color: "#6366f1",
                                    padding: "2px 7px", borderRadius: 5, fontSize: 11 }}>{s.classe}</span>
                                </td>
                                <td style={{ padding: "9px 10px", fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                                  {s.heure_debut ? `${s.heure_debut.slice(0,5)} → ${(s.heure_fin||"").slice(0,5)}` : "—"}
                                </td>
                                <td style={{ padding: "9px 10px", fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
                                  {s.salle || "—"}
                                </td>
                                <td style={{ padding: "9px 10px" }}>
                                  <span style={{ background: `${statColor}20`, color: statColor,
                                    padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                                    {s.status}
                                  </span>
                                </td>
                                <td style={{ padding: "9px 10px" }}>
                                  {s.total_att > 0 ? (
                                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                      <div style={{ width: 44, height: 5, background: "rgba(255,255,255,0.08)", borderRadius: 3 }}>
                                        <div style={{ width: `${s.taux}%`, height: "100%",
                                          background: s.taux >= 75 ? "#22c55e" : "#ef4444", borderRadius: 3 }} />
                                      </div>
                                      <span style={{ fontSize: 12, color: s.taux >= 75 ? "#22c55e" : "#ef4444", fontWeight: 600 }}>
                                        {s.taux}%
                                      </span>
                                    </div>
                                  ) : <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)" }}>—</span>}
                                </td>
                                <td style={{ padding: "9px 10px", display: "flex", gap: 6 }}>
                                  <Btn onClick={() => openSessionModal(s.id)}
                                    style={{ padding: "4px 9px", fontSize: 11 }}>Détail</Btn>
                                  <Btn onClick={() => deleteSession(s.id)} color="#ef4444"
                                    style={{ padding: "4px 9px", fontSize: 11 }}>Supprimer</Btn>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {sessions.length > 0 && sessions.length % SESSION_LIMIT === 0 && (
                    <div style={{ textAlign: "center", padding: "12px 0 4px" }}>
                      <Btn onClick={() => loadSessions(sessionOffset + SESSION_LIMIT)}
                        color="rgba(99,102,241,0.15)"
                        style={{ border: "1px solid rgba(99,102,241,0.3)", color: "#a5b4fc", fontSize: 13, padding: "8px 24px" }}>
                        Charger plus ({sessions.length} affichées)
                      </Btn>
                    </div>
                  )}
                </Card>
              </div>
            )}

            {gTab === "import-csv_disabled" && (() => {
              const parseCSV = (text) => {
                const lines = text.trim().split("\n");
                if (lines.length < 2) return [];
                const headers = lines[0].split(";").map(h => h.trim().replace(/^"|"$/g, "").toLowerCase());
                return lines.slice(1).map(line => {
                  const vals = line.split(";").map(v => v.trim().replace(/^"|"$/g, ""));
                  const row = {};
                  headers.forEach((h, i) => { row[h] = vals[i] || ""; });
                  return row;
                }).filter(r => r.nom || r.prenom);
              };

              const handleCSVFile = (file) => {
                setCsvFile(file);
                setCsvMsg("");
                const reader = new FileReader();
                reader.onload = (e) => {
                  const text = e.target.result;
                  const rows = parseCSV(text);
                  setCsvPreview(rows);
                };
                reader.readAsText(file, "UTF-8");
              };

              const importCSV = async () => {
                if (!csvPreview.length) return;
                setCsvLoading(true);
                setCsvMsg("");
                let ok = 0, err = 0;
                for (const row of csvPreview) {
                  try {
                    await axios.post(`${API_URL}/api/gestion/etudiants`, {
                      nom:            row.nom || "",
                      prenom:         row.prenom || "",
                      email:          row.email || "",
                      telephone:      row.telephone || row.tel || "",
                      classe:         row.classe || row.groupe || "",
                      annee_scolaire: row.annee_scolaire || row.niveau || "",
                      date_naissance: row.date_naissance || "",
                      cin:            row.cin || "",
                    }, authHeaders());
                    ok++;
                  } catch { err++; }
                }
                setCsvLoading(false);
                setCsvMsg(`ok:${ok}:${err}`);
                if (ok > 0) loadGestion();
              };

              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <Card>
                    <SectionTitle title="Import CSV — Étudiants" icon="📤" />
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 14, lineHeight: 1.7 }}>
                      Importez une liste d'étudiants depuis un fichier CSV. Colonnes attendues (séparateur <strong style={{ color: "#a5b4fc" }}>;</strong>) :<br />
                      <code style={{ color: "#a5b4fc", fontSize: 11 }}>nom ; prenom ; email ; telephone ; classe ; annee_scolaire ; date_naissance ; cin</code>
                    </div>

                    <label style={{
                      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                      gap: 10, padding: "28px 16px", borderRadius: 10,
                      border: csvFile ? "2px solid rgba(99,102,241,0.5)" : "2px dashed rgba(255,255,255,0.12)",
                      background: csvFile ? "rgba(99,102,241,0.07)" : "rgba(255,255,255,0.02)",
                      cursor: "pointer",
                    }}>
                      <div style={{ fontSize: 30 }}>{csvFile ? "✅" : "📄"}</div>
                      {csvFile ? (
                        <div style={{ fontWeight: 600, fontSize: 13, color: "#a5b4fc" }}>{csvFile.name} — {csvPreview.length} lignes détectées</div>
                      ) : (
                        <div style={{ fontWeight: 600, fontSize: 13, color: "rgba(255,255,255,0.4)" }}>Cliquer pour importer un fichier CSV</div>
                      )}
                      <input type="file" accept=".csv,text/csv" style={{ display: "none" }}
                        onChange={e => e.target.files[0] && handleCSVFile(e.target.files[0])} />
                    </label>

                    {csvPreview.length > 0 && (
                      <div style={{ marginTop: 16 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.5)", marginBottom: 8 }}>
                          Aperçu — {csvPreview.length} étudiant{csvPreview.length > 1 ? "s" : ""} à importer
                        </div>
                        <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid rgba(255,255,255,0.07)" }}>
                          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
                            <thead>
                              <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                                {["Nom","Prénom","Email","Classe","Niveau","CIN"].map(h => (
                                  <th key={h} style={{ padding: "9px 12px", textAlign: "left",
                                    color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: 600 }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {csvPreview.slice(0, 10).map((r, i) => (
                                <tr key={i} style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                                  <td style={{ padding: "9px 12px", fontSize: 13, fontWeight: 500 }}>{r.nom}</td>
                                  <td style={{ padding: "9px 12px", fontSize: 13 }}>{r.prenom}</td>
                                  <td style={{ padding: "9px 12px", fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{r.email}</td>
                                  <td style={{ padding: "9px 12px" }}>
                                    <span style={{ background: "rgba(99,102,241,0.15)", color: "#a5b4fc",
                                      padding: "2px 8px", borderRadius: 6, fontSize: 11 }}>
                                      {r.classe || r.groupe || "—"}
                                    </span>
                                  </td>
                                  <td style={{ padding: "9px 12px", fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                                    {r.annee_scolaire || r.niveau || "—"}
                                  </td>
                                  <td style={{ padding: "9px 12px", fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{r.cin || "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {csvPreview.length > 10 && (
                            <div style={{ padding: "8px 12px", fontSize: 11, color: "rgba(255,255,255,0.3)",
                              borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                              + {csvPreview.length - 10} autres lignes non affichées
                            </div>
                          )}
                        </div>

                        <div style={{ display: "flex", gap: 10, marginTop: 14, alignItems: "center" }}>
                          <button onClick={importCSV} disabled={csvLoading}
                            style={{
                              padding: "11px 24px", borderRadius: 9, border: "none",
                              background: "linear-gradient(135deg,#6366f1,#a855f7)",
                              color: "#fff", fontFamily: "Sora, sans-serif", fontSize: 13,
                              fontWeight: 700, cursor: csvLoading ? "not-allowed" : "pointer",
                              opacity: csvLoading ? 0.7 : 1,
                            }}>
                            {csvLoading ? "Importation en cours..." : `Importer ${csvPreview.length} étudiants`}
                          </button>
                          <button onClick={() => { setCsvFile(null); setCsvPreview([]); setCsvMsg(""); }}
                            style={{ padding: "11px 18px", borderRadius: 9,
                              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                              color: "rgba(255,255,255,0.5)", fontFamily: "Sora, sans-serif",
                              fontSize: 13, cursor: "pointer" }}>
                            Annuler
                          </button>
                        </div>
                      </div>
                    )}

                    {csvMsg && (
                      <div style={{ marginTop: 14, padding: "12px 16px", borderRadius: 9,
                        background: csvMsg.startsWith("ok") ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
                        border: `1px solid ${csvMsg.startsWith("ok") ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`,
                        color: csvMsg.startsWith("ok") ? "#22c55e" : "#ef4444", fontSize: 13, fontWeight: 600,
                      }}>
                        {csvMsg.startsWith("ok") ? (() => {
                          const [, ok, err] = csvMsg.split(":");
                          return `✅ ${ok} étudiant${ok > 1 ? "s" : ""} importé${ok > 1 ? "s" : ""}${err > 0 ? ` · ❌ ${err} erreur${err > 1 ? "s" : ""}` : ""}`;
                        })() : `❌ Erreur lors de l'import`}
                      </div>
                    )}
                  </Card>

                  <Card>
                    <SectionTitle title="Format du fichier CSV" icon="📋" />
                    <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: 8, padding: "14px 16px",
                      fontFamily: "monospace", fontSize: 12, color: "#a5b4fc", lineHeight: 1.8 }}>
                      nom;prenom;email;telephone;classe;annee_scolaire;date_naissance;cin<br />
                      Benali;Ahmed;ahmed@esisa.ma;0612345678;A;1ère année;2003-05-12;AB123456<br />
                      Hajji;Sara;sara@esisa.ma;0698765432;B;2ème année;2002-11-30;CD789012
                    </div>
                    <div style={{ marginTop: 10, fontSize: 11, color: "rgba(255,255,255,0.3)", lineHeight: 1.6 }}>
                      • Séparateur : point-virgule ( ; )<br />
                      • Encodage : UTF-8<br />
                      • La première ligne doit contenir les en-têtes<br />
                      • Les colonnes <strong style={{ color: "rgba(255,255,255,0.5)" }}>nom</strong> et <strong style={{ color: "rgba(255,255,255,0.5)" }}>prenom</strong> sont obligatoires
                    </div>
                  </Card>
                </div>
              );
            })()}

            {gTab === "classes_disabled" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                {/* Groupes / Classes */}
                <Card>
                  <SectionTitle title="Groupes (classes)" icon="🎓" />
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 14 }}>
                    Ces groupes sont utilisés dans tous les filtres et formulaires de la plateforme.
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                    {dynGroupes.map(g => (
                      <div key={g} style={{ display: "flex", alignItems: "center", gap: 6,
                        background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.25)",
                        borderRadius: 8, padding: "6px 12px" }}>
                        <span style={{ fontWeight: 600, fontSize: 14, color: "#a5b4fc" }}>Groupe {g}</span>
                        {dynGroupes.length > 1 && (
                          <button onClick={() => {
                            const next = dynGroupes.filter(x => x !== g);
                            setDynGroupes(next);
                            localStorage.setItem("sc_groupes", JSON.stringify(next));
                          }} style={{ background: "none", border: "none", color: "#f87171",
                            cursor: "pointer", fontSize: 14, padding: 0, lineHeight: 1 }}>✕</button>
                        )}
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input value={newGroupe} onChange={e => setNewGroupe(e.target.value.toUpperCase().slice(0, 2))}
                      placeholder="Ex : E"
                      style={{ width: 80, padding: "9px 12px", background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.1)", borderRadius: 9,
                        color: "#fff", fontFamily: "Sora, sans-serif", fontSize: 13, outline: "none",
                        textTransform: "uppercase" }} />
                    <button onClick={() => {
                      if (!newGroupe || dynGroupes.includes(newGroupe)) return;
                      const next = [...dynGroupes, newGroupe];
                      setDynGroupes(next);
                      localStorage.setItem("sc_groupes", JSON.stringify(next));
                      setNewGroupe("");
                    }} style={{ padding: "9px 18px", borderRadius: 9, border: "none",
                      background: "#6366f1", color: "#fff", fontFamily: "Sora, sans-serif",
                      fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                      + Ajouter
                    </button>
                  </div>
                </Card>

                {/* Niveaux / Années scolaires */}
                <Card>
                  <SectionTitle title="Niveaux (années scolaires)" icon="📚" />
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 14 }}>
                    Ces niveaux sont utilisés dans tous les filtres, matières et emplois du temps.
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                    {dynNiveaux.map(n => (
                      <div key={n} style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "10px 14px", borderRadius: 9,
                        background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.8)" }}>{n}</span>
                        {dynNiveaux.length > 1 && (
                          <button onClick={() => {
                            const next = dynNiveaux.filter(x => x !== n);
                            setDynNiveaux(next);
                            localStorage.setItem("sc_niveaux", JSON.stringify(next));
                          }} style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
                            borderRadius: 6, color: "#f87171", cursor: "pointer",
                            fontSize: 11, padding: "3px 10px", fontFamily: "Sora, sans-serif" }}>
                            Supprimer
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input value={newNiveau} onChange={e => setNewNiveau(e.target.value)}
                      placeholder="Ex : 6ème année"
                      style={{ flex: 1, padding: "9px 12px", background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.1)", borderRadius: 9,
                        color: "#fff", fontFamily: "Sora, sans-serif", fontSize: 13, outline: "none" }} />
                    <button onClick={() => {
                      if (!newNiveau.trim() || dynNiveaux.includes(newNiveau.trim())) return;
                      const next = [...dynNiveaux, newNiveau.trim()];
                      setDynNiveaux(next);
                      localStorage.setItem("sc_niveaux", JSON.stringify(next));
                      setNewNiveau("");
                    }} style={{ padding: "9px 18px", borderRadius: 9, border: "none",
                      background: "#6366f1", color: "#fff", fontFamily: "Sora, sans-serif",
                      fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                      + Ajouter
                    </button>
                  </div>
                </Card>

                <div style={{ padding: "12px 16px", background: "rgba(245,158,11,0.06)",
                  border: "1px solid rgba(245,158,11,0.2)", borderRadius: 12,
                  fontSize: 12, color: "rgba(255,255,255,0.4)", lineHeight: 1.7 }}>
                  ⚠️ Les modifications sont sauvegardées localement dans le navigateur.
                  Pour une gestion depuis la base de données, une API dédiée est nécessaire.
                </div>
              </div>
            )}

          </div>
        )}
      </div>
      </div> {/* fin contenu principal */}
    </div>
  );
}