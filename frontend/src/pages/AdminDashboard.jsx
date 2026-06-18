import { useState, useEffect } from "react";
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
        background: "rgba(99,102,241,0.15)",
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0,
      }}>{icon}</div>
      <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#fff" }}>{title}</h2>
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div style={{ textAlign: "center", padding: "48px 20px",
      color: "rgba(255,255,255,0.22)", fontSize: 14 }}>
      <div style={{
        fontSize: 38, marginBottom: 12,
        filter: "grayscale(30%) opacity(0.6)",
      }}>📊</div>
      <div style={{ fontWeight: 500 }}>{message}</div>
    </div>
  );
}

function StatCard({ icon, label, value, sub, color }) {
  return (
    <div className="sc-card" style={{
      background: "rgba(255,255,255,0.045)",
      border: "1px solid rgba(255,255,255,0.09)",
      borderTop: `2px solid ${color}`,
      borderRadius: 18, padding: "20px 22px",
      display: "flex", alignItems: "center", gap: 16,
    }}>
      <div style={{
        width: 50, height: 50, borderRadius: 13,
        background: `${color}1a`, display: "flex",
        alignItems: "center", justifyContent: "center",
        fontSize: 24, flexShrink: 0,
        boxShadow: `0 0 0 1px ${color}30`,
      }}>{icon}</div>
      <div>
        <div style={{ fontSize: 28, fontWeight: 700, color: "#fff", lineHeight: 1.1 }}>{value}</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 3, fontWeight: 500 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color, marginTop: 3, fontWeight: 600 }}>{sub}</div>}
      </div>
    </div>
  );
}

function Input({ placeholder, value, onChange, type = "text", style = {} }) {
  return (
    <input type={type} placeholder={placeholder} value={value} onChange={onChange}
      className="sc-input"
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
    <select value={value} onChange={onChange} className="sc-select" style={{
      width: "100%", padding: "10px 14px",
      background: "#0d0d1a", border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 10, color: "#fff", fontSize: 13,
      fontFamily: "Sora, sans-serif", outline: "none",
      boxSizing: "border-box", ...style,
    }}>{children}</select>
  );
}

function Btn({ onClick, children, color = "#6366f1", style = {} }) {
  return (
    <button onClick={onClick} className="sc-btn" style={{
      padding: "9px 18px", border: "none", borderRadius: 9,
      background: color, color: "#fff", cursor: "pointer",
      fontFamily: "Sora, sans-serif", fontSize: 13, fontWeight: 600, ...style,
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
  const [topAbsences, setTopAbsences] = useState([]);
  const [notesMat,    setNotesMat]    = useState([]);
  const [alertes,     setAlertes]     = useState([]);
  const [prediction,  setPrediction]  = useState(null);
  const [predLoading, setPredLoading] = useState(false);
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

  // Alertes manuelles
  const [formAlerte, setFormAlerte] = useState({ message:"", type:"information", severity:"medium", cible:"etudiant", student_id:"", annee_scolaire:"", classe:"" });
  const [alerteMsg,  setAlerteMsg]  = useState("");

  // Modale alerte depuis Prédiction IA
  const [alertPredModal,    setAlertPredModal]    = useState(null);
  const [alertPredForm,     setAlertPredForm]     = useState({ message: "", severity: "medium", type: "avertissement", target_role: "etudiant" });
  const [alertPredSending,  setAlertPredSending]  = useState(false);
  const [alertPredFeedback, setAlertPredFeedback] = useState("");

  useEffect(() => {
    axios.get(`${API_URL}/api/bi/filtres`, authHeaders())
      .then(r => setFilterOptions(r.data))
      .catch(() => {});
    axios.get(`${API_URL}/api/messaging/unread-count`, authHeaders())
      .then(r => setUnreadMsg(r.data.count)).catch(() => {});
  }, []);
  useEffect(() => { loadBI(); }, [gf]);
  useEffect(() => { if (activeTab === "gestion") loadGestion(); }, [activeTab]);
  useEffect(() => { if (activeTab === "prediction") loadPrediction(); }, [activeTab, gf]);
  useEffect(() => { if (activeTab === "gestion" && gTab === "notes")    loadNotes();    }, [gTab]);
  useEffect(() => { if (activeTab === "gestion" && gTab === "sessions") loadSessions(); }, [gTab]);

  const loadBI = () => {
    const p = [];
    if (gf.classe)  p.push(`classe=${encodeURIComponent(gf.classe)}`);
    if (gf.niveau)  p.push(`annee_scolaire=${encodeURIComponent(gf.niveau)}`);
    const qs = p.length ? `?${p.join("&")}` : "";
    const h  = authHeaders();
    // Chaque requête indépendante — la page s'affiche immédiatement
    axios.get(`${API_URL}/api/bi/overview${qs}`, h).then(r => setOverview(r.data)).catch(() => {});
    axios.get(`${API_URL}/api/bi/presence-par-classe${qs}`, h).then(r => setPresClasse(r.data)).catch(() => {});
    axios.get(`${API_URL}/api/bi/presence-par-matiere${qs}`, h).then(r => setPresMat(r.data)).catch(() => {});
    axios.get(`${API_URL}/api/bi/evolution-presences${qs}`, h).then(r => setEvolution(r.data.filter(d => d.taux_presence !== null))).catch(() => {});
    axios.get(`${API_URL}/api/bi/repartition-statuts${qs}`, h).then(r => setRepartition(r.data)).catch(() => {});
    axios.get(`${API_URL}/api/bi/etudiants-a-risque${qs}`, h).then(r => setRisque(r.data)).catch(() => {});
    axios.get(`${API_URL}/api/bi/top-absences${qs}`, h).then(r => setTopAbsences(r.data)).catch(() => {});
    axios.get(`${API_URL}/api/bi/notes-par-matiere${qs}`, h).then(r => setNotesMat(r.data)).catch(() => {});
    axios.get(`${API_URL}/api/bi/alertes-recentes${qs}`, h).then(r => setAlertes(r.data)).catch(() => {});
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
    { id: "overview",    label: "Vue d'ensemble", icon: "📊" },
    { id: "presences",   label: "Présences",       icon: "✅" },
    { id: "risques",     label: "Risques",         icon: "⚠️" },
    { id: "notes",       label: "Notes",           icon: "📝" },
    { id: "alertes",     label: "Alertes",         icon: "🔔" },
    { id: "prediction",  label: "Prédiction IA",   icon: "🤖" },
    { id: "gestion",     label: "Gestion",         icon: "⚙️" },
  ];

  const gTabs = [
    { id: "profs",     label: "Professeurs",     icon: "👨‍🏫" },
    { id: "matieres",  label: "Matières",        icon: "📚" },
    { id: "emplois",   label: "Emploi du temps", icon: "📅" },
    { id: "etudiants", label: "Étudiants",       icon: "🎓" },
    { id: "notes",     label: "Notes",           icon: "📝" },
    { id: "alertes",   label: "Alertes",         icon: "🔔" },
    { id: "sessions",  label: "Sessions",        icon: "🎬" },
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
    const matchNiveau  = !gf.niveau || e.annee_scolaire === gf.niveau;
    const matchGClasse = !gf.classe || e.classe === gf.classe;
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

  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(ellipse 90% 55% at 50% -5%, rgba(99,102,241,0.09) 0%, transparent 65%), #05050f",
      fontFamily: "'Sora', sans-serif", color: "#fff",
    }}>
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

      {/* Header */}
      <div className="app-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          {/* Logo */}
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: "linear-gradient(135deg,#6366f1,#a855f7)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 800, color: "#fff", letterSpacing: "-0.5px",
            fontFamily: "'Sora', sans-serif",
            boxShadow: "0 0 0 1px rgba(99,102,241,0.4), 0 4px 12px rgba(99,102,241,0.2)",
          }}>SC</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <span style={{ fontWeight: 700, fontSize: 14, lineHeight: 1, color: "#fff" }}>SmartCampus IA</span>
            <span className="hide-mobile" style={{
              fontSize: 10, color: "#f59e0b", fontWeight: 600,
              letterSpacing: "0.06em", textTransform: "uppercase",
            }}>Administration</span>
          </div>
        </div>
        <div className="header-actions">
          {overview?.alertes_non_lues > 0 && (
            <div style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444",
              fontSize: 12, padding: "4px 10px", borderRadius: 20, fontWeight: 600 }}>
              🔔 {overview.alertes_non_lues}
            </div>
          )}
          <button onClick={() => setShowVoice(true)} className="sc-btn" style={{
            background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)",
            borderRadius: 8, color: "#a5b4fc", cursor: "pointer",
            padding: bp.isMobile ? "6px 10px" : "6px 14px",
            fontFamily: "Sora, sans-serif", fontSize: 12, fontWeight: 600,
          }}>{bp.isMobile ? "🎤" : "🎤 Assistant IA"}</button>
          <button onClick={onOpenMessages} className="sc-btn" style={{
            position: "relative",
            background: "rgba(14,165,233,0.12)", border: "1px solid rgba(14,165,233,0.3)",
            borderRadius: 8, color: "#7dd3fc", cursor: "pointer",
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
          <span className="header-username" style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>
            {user?.prenom} {user?.nom}
          </span>
          <button onClick={onLogout} className="sc-btn" style={{
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8, color: "rgba(255,255,255,0.6)", cursor: "pointer",
            padding: bp.isMobile ? "6px 10px" : "6px 14px",
            fontFamily: "Sora, sans-serif", fontSize: 12,
          }}>{bp.isMobile ? "↪" : "Déconnexion"}</button>
        </div>
      </div>

      {/* Tabs + Filtres intégrés */}
      <div style={{
        padding: bp.isMobile ? "10px 12px 0" : "0 24px 0",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        display: "flex", alignItems: "flex-end", gap: 0,
      }}>
        {/* Tabs (gauche, scrollable) */}
        <div style={{ display: "flex", overflowX: "auto", gap: 2, flex: 1, paddingTop: bp.isMobile ? 0 : 14 }}>
          {tabs.map(tab => (
            <button key={tab.id} className="tab-btn" onClick={() => setActiveTab(tab.id)} style={{
              background: activeTab === tab.id ? "rgba(99,102,241,0.15)" : "transparent",
              border: "none",
              borderBottom: activeTab === tab.id ? "2px solid #6366f1" : "2px solid transparent",
              color: activeTab === tab.id ? "#6366f1" : "rgba(255,255,255,0.4)",
              cursor: "pointer", padding: bp.isMobile ? "8px 10px" : "10px 16px",
              fontFamily: "Sora, sans-serif", fontSize: bp.isMobile ? 12 : 13,
              fontWeight: activeTab === tab.id ? 600 : 400,
              borderRadius: "8px 8px 0 0", whiteSpace: "nowrap",
              display: "flex", alignItems: "center", gap: 5,
            }}>
              {tab.icon}{!bp.isMobile && " "}{!bp.isMobile && tab.label}
              {bp.isMobile && <span style={{ fontSize: 10, marginLeft: 2 }}>{tab.label.split(" ")[0]}</span>}
            </button>
          ))}
        </div>

        {/* Filtres (droite, inline) — masqués sur mobile */}
        {!bp.isMobile && (
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            paddingBottom: 10, paddingLeft: 16, flexShrink: 0,
            borderLeft: "1px solid rgba(255,255,255,0.06)", marginLeft: 8,
          }}>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", fontWeight: 600,
              letterSpacing: "0.08em", textTransform: "uppercase", marginRight: 2 }}>
              Scope
            </span>

            {/* Dropdown niveau */}
            <select value={gf.niveau}
              onChange={e => setGf(f => ({...f, niveau: e.target.value, classe: ""}))}
              style={{
                height: 28, padding: "0 10px", fontSize: 11,
                background: gf.niveau ? "rgba(99,102,241,0.18)" : "rgba(255,255,255,0.04)",
                border: gf.niveau ? "1px solid rgba(99,102,241,0.4)" : "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8, outline: "none", cursor: "pointer",
                color: gf.niveau ? "#a5b4fc" : "rgba(255,255,255,0.35)",
                fontFamily: "Sora, sans-serif", fontWeight: gf.niveau ? 600 : 400,
                maxWidth: 140,
              }}>
              <option value="" style={{ background: "#0d0d1a" }}>Niveau</option>
              {NIVEAUX.map(n => (
                <option key={n} value={n} style={{ background: "#0d0d1a" }}>{n}</option>
              ))}
            </select>

            {/* Dropdown classe */}
            <select value={gf.classe}
              onChange={e => setGf(f => ({...f, classe: e.target.value}))}
              style={{
                height: 28, padding: "0 10px", fontSize: 11,
                background: gf.classe ? "rgba(99,102,241,0.18)" : "rgba(255,255,255,0.04)",
                border: gf.classe ? "1px solid rgba(99,102,241,0.4)" : "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8, outline: "none", cursor: "pointer",
                color: gf.classe ? "#a5b4fc" : "rgba(255,255,255,0.35)",
                fontFamily: "Sora, sans-serif", fontWeight: gf.classe ? 600 : 400,
                maxWidth: 90,
              }}>
              <option value="" style={{ background: "#0d0d1a" }}>Groupe</option>
              {GROUPES.map(g => <option key={g} value={g} style={{ background: "#0d0d1a" }}>Groupe {g}</option>)}
            </select>

            {/* Bouton reset — apparaît uniquement si un filtre est actif */}
            {(gf.niveau || gf.classe) && (
              <button onClick={() => setGf({ annee:"", niveau:"", classe:"" })} style={{
                width: 24, height: 24, border: "1px solid rgba(239,68,68,0.3)",
                borderRadius: 6, background: "rgba(239,68,68,0.1)",
                color: "#ef4444", cursor: "pointer", fontSize: 12,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "Sora, sans-serif", flexShrink: 0,
              }}>✕</button>
            )}
          </div>
        )}
      </div>

      <div className="page-body">
        {/* Vue d'ensemble */}
        {activeTab === "overview" && (
          <div className="sc-fade" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ display: "grid", gridTemplateColumns: bp.colsAuto, gap: bp.gap2 }}>
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
        {activeTab === "presences" && (
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
        {activeTab === "risques" && (
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
        {activeTab === "notes" && (
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
        {activeTab === "alertes" && (
          <Card>
            <SectionTitle title="Alertes récentes" icon="🔔" />
            {alertes.length === 0 ? <EmptyState message="Aucune alerte ✅" /> :
              alertes.map((a, i) => (
                <div key={i} style={{
                  background: `${severityColor(a.severity)}0d`,
                  border: `1px solid ${severityColor(a.severity)}25`,
                  borderLeft: `3px solid ${severityColor(a.severity)}`,
                  borderRadius: 12, padding: "13px 16px",
                  display: "flex", alignItems: "center", gap: 12, marginBottom: 8,
                  transition: "background 0.15s ease",
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{a.message}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 4 }}>
                      {new Date(a.created_at).toLocaleDateString("fr-FR")}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 10, padding: "3px 10px", borderRadius: 100,
                    background: `${severityColor(a.severity)}20`,
                    color: severityColor(a.severity), fontWeight: 700,
                    letterSpacing: "0.04em", textTransform: "uppercase",
                  }}>{a.severity}</span>
                </div>
              ))
            }
          </Card>
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
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
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
            {gTab === "matieres" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
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
                    <Select value={formMat.annee_scolaire}
                      onChange={e => setFormMat({...formMat, annee_scolaire: e.target.value})}>
                      {NIVEAUX.map(n => <option key={n} value={n}>{n}</option>)}
                    </Select>
                    <Select value={formMat.professeur_id}
                      onChange={e => setFormMat({...formMat, professeur_id: e.target.value})}>
                      <option value="">-- Assigner un professeur --</option>
                      {profs.filter(p => p.is_active).map(p => (
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
                      const ms = matieres.filter(m => m.annee_scolaire === nv);
                      if (ms.length === 0) return null;
                      return (
                        <div key={nv}>
                          <div style={{
                            fontSize: 11, fontWeight: 700, color: "#6366f1",
                            letterSpacing: "0.06em", textTransform: "uppercase",
                            margin: "14px 0 6px", padding: "4px 10px",
                            background: "rgba(99,102,241,0.08)", borderRadius: 6,
                            display: "inline-block",
                          }}>{nv}</div>
                          {ms.map((m, i) => (
                            <div key={i} style={{
                              display: "flex", alignItems: "center", justifyContent: "space-between",
                              padding: "10px 0",
                              borderBottom: i < ms.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                            }}>
                              <div>
                                <div style={{ fontWeight: 500, fontSize: 14 }}>
                                  {m.nom}
                                  <span style={{ marginLeft: 8, color: "#6366f1", fontSize: 11 }}>Coef {m.coefficient}</span>
                                </div>
                                <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>
                                  {m.professeur || "Aucun prof"}
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
            {gTab === "emplois" && (() => {
              // Grouper les créneaux par niveau puis par groupe
              const emploisGrouped = {};
              emplois.forEach(e => {
                const nv = e.niveau || "Autre";
                if (!emploisGrouped[nv]) emploisGrouped[nv] = {};
                if (!emploisGrouped[nv][e.groupe]) emploisGrouped[nv][e.groupe] = [];
                emploisGrouped[nv][e.groupe].push(e);
              });
              // Matieres filtrées par niveau + groupe sélectionnés dans le formulaire
              const matieresFiltrees = matieres.filter(m =>
                m.annee_scolaire === formEmploi.annee_scolaire
              );
              return (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <Card>
                  <SectionTitle title="Ajouter un créneau" icon="➕" />
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                    <Select value={formEmploi.annee_scolaire}
                      onChange={e => setFormEmploi({...formEmploi, annee_scolaire: e.target.value, matiere_id: ""})}>
                      {NIVEAUX.map(n => <option key={n} value={n}>{n}</option>)}
                    </Select>
                    <Select value={formEmploi.classe}
                      onChange={e => setFormEmploi({...formEmploi, classe: e.target.value, matiere_id: ""})}>
                      {GROUPES.map(g => <option key={g} value={g}>Groupe {g}</option>)}
                    </Select>
                    <Select value={formEmploi.jour}
                      onChange={e => setFormEmploi({...formEmploi, jour: e.target.value})}>
                      {JOURS.map(j => <option key={j} value={j}>{j}</option>)}
                    </Select>
                    <Select value={formEmploi.matiere_id}
                      onChange={e => setFormEmploi({...formEmploi, matiere_id: e.target.value})}>
                      <option value="">-- Matière --</option>
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

                {/* Affichage groupé par niveau puis par groupe */}
                {NIVEAUX.map(nv => {
                  const groupesNv = emploisGrouped[nv];
                  if (!groupesNv) return null;
                  return (
                    <div key={nv}>
                      <div style={{
                        fontSize: 13, fontWeight: 700, color: "#6366f1",
                        margin: "4px 0 12px", display: "flex", alignItems: "center", gap: 8,
                      }}>
                        <div style={{ flex: 1, height: 1, background: "rgba(99,102,241,0.2)" }} />
                        {nv}
                        <div style={{ flex: 1, height: 1, background: "rgba(99,102,241,0.2)" }} />
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {GROUPES.filter(g => groupesNv[g]?.length > 0).map(gr => (
                          <Card key={gr}>
                            <SectionTitle title={`Groupe ${gr}`} icon="📅" />
                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                              <thead>
                                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                                  {["Jour","Matière","Horaire","Salle","Action"].map(h => (
                                    <th key={h} style={{ padding: "8px 12px", textAlign: "left",
                                      color: "rgba(255,255,255,0.4)", fontSize: 12 }}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {groupesNv[gr].map((e, i) => (
                                  <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                                    <td style={{ padding: "8px 12px", fontSize: 13 }}>{e.jour}</td>
                                    <td style={{ padding: "8px 12px", fontSize: 13, fontWeight: 500 }}>{e.matiere}</td>
                                    <td style={{ padding: "8px 12px", fontSize: 12,
                                      color: "rgba(255,255,255,0.5)" }}>{e.heure_debut?.slice(0,5)} → {e.heure_fin?.slice(0,5)}</td>
                                    <td style={{ padding: "8px 12px", fontSize: 12,
                                      color: "rgba(255,255,255,0.5)" }}>{e.salle || "—"}</td>
                                    <td style={{ padding: "8px 12px" }}>
                                      <Btn onClick={() => deleteEmploi(e.id)} color="#ef4444"
                                        style={{ padding: "4px 10px", fontSize: 11 }}>Supprimer</Btn>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </Card>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            );})()}

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
              </div>
            )}

            {/* ── Notes ── */}
            {gTab === "notes" && (
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
            {gTab === "alertes" && (
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
                            {NIVEAUX.map(nv => (
                              <option key={nv} value={nv}>{nv}</option>
                            ))}
                          </Select>
                          <Select value={formAlerte.classe}
                            onChange={e => setFormAlerte(f => ({...f, classe: e.target.value}))}
                            disabled={!formAlerte.annee_scolaire}>
                            <option value="">-- Groupe --</option>
                            {GROUPES.map(g => (
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

            {/* ── Sessions ── */}
            {gTab === "sessions" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {/* Filtres */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Select value={filterSNiveau} onChange={e => { setFilterSNiveau(e.target.value); setFilterSClasse(""); }}
                    style={{ flex: 1, minWidth: 160 }}>
                    <option value="">Tous niveaux</option>
                    {NIVEAUX.map(n => <option key={n} value={n}>{n}</option>)}
                  </Select>
                  <Select value={filterSClasse} onChange={e => setFilterSClasse(e.target.value)} style={{ width: 120 }}>
                    <option value="">Tous groupes</option>
                    {GROUPES.map(g => <option key={g} value={g}>Groupe {g}</option>)}
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
                                  <span style={{
                                    background: sc.bg, color: sc.text,
                                    padding: "3px 10px", borderRadius: 20,
                                    fontSize: 11, fontWeight: 600,
                                  }}>{sc.label}</span>
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

          </div>
        )}
      </div>
    </div>
  );
}