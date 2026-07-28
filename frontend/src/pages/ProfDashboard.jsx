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

  // Onglet Étudiants
  const [etudiants,        setEtudiants]        = useState([]);
  const [etudiantsLoading, setEtudiantsLoading] = useState(false);
  const [selectedGroupe,   setSelectedGroupe]   = useState(null);

  // Onglet Notes
  const [notes,                setNotes]                = useState([]);
  const [notesLoading,         setNotesLoading]         = useState(false);
  const [selectedMatiereNotes, setSelectedMatiereNotes] = useState(null);
  const [selectedGroupeNotes,  setSelectedGroupeNotes]  = useState(null);
  const [noteForm,             setNoteForm]             = useState({ student_id: "", note: "", type: "controle" });
  const [noteSaving,           setNoteSaving]           = useState(false);
  const [noteMsg,              setNoteMsg]              = useState("");

  // Alertes absences par matière
  const [alertesAbsences, setAlertesAbsences] = useState([]);


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
    if (activeTab === "etudiants") loadEtudiants();
    if (activeTab === "notes") {
      if (etudiants.length === 0) loadEtudiants();
      loadNotes(selectedMatiereNotes);
    }
  }, [activeTab]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [ov, td, ab, al, alarb] = await Promise.all([
        axios.get(`${API_URL}/api/prof/overview`,             authHeaders()),
        axios.get(`${API_URL}/api/prof/session-aujourd-hui`,  authHeaders()),
        axios.get(`${API_URL}/api/prof/etudiants-absents`,    authHeaders()),
        axios.get(`${API_URL}/api/prof/alertes`,              authHeaders()),
        axios.get(`${API_URL}/api/prof/alertes-absences`,     authHeaders()),
      ]);
      setOverview(ov.data);
      setToday(td.data);
      setAbsents(ab.data);
      setAlertes(al.data);
      setAlertesAbsences(alarb.data);
    } catch (err) {
      console.error("Erreur chargement prof:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadEtudiants = async () => {
    setEtudiantsLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/prof/etudiants`, authHeaders());
      setEtudiants(res.data);
    } catch (e) {
      console.error("Erreur chargement étudiants:", e);
    } finally {
      setEtudiantsLoading(false);
    }
  };

  const loadNotes = async (matiereId) => {
    setNotesLoading(true);
    try {
      const url = matiereId
        ? `${API_URL}/api/prof/notes?matiere_id=${matiereId}`
        : `${API_URL}/api/prof/notes`;
      const res = await axios.get(url, authHeaders());
      setNotes(res.data);
    } catch (e) {
      console.error("Erreur chargement notes:", e);
    } finally {
      setNotesLoading(false);
    }
  };

  const addNote = async () => {
    if (!noteForm.student_id || !selectedMatiereNotes || noteForm.note === "") {
      setNoteMsg("Veuillez remplir tous les champs requis");
      return;
    }
    setNoteSaving(true);
    setNoteMsg("");
    try {
      await axios.post(`${API_URL}/api/prof/notes`, {
        student_id:  noteForm.student_id,
        matiere_id:  selectedMatiereNotes,
        note:        parseFloat(noteForm.note),
        type:        noteForm.type,
        commentaire: noteForm.commentaire || null,
      }, authHeaders());
      setNoteMsg("✅ Note ajoutée avec succès");
      setNoteForm({ student_id: "", note: "", type: "controle", commentaire: "" });
      loadNotes(selectedMatiereNotes);
    } catch (e) {
      setNoteMsg("❌ " + (e.response?.data?.detail || "Erreur"));
    } finally {
      setNoteSaving(false);
    }
  };

  const deleteNote = async (noteId) => {
    try {
      await axios.delete(`${API_URL}/api/prof/notes/${noteId}`, authHeaders());
      setNotes(prev => prev.filter(n => n.id !== noteId));
    } catch (e) {
      console.error("Erreur suppression note:", e);
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
      badge: (alertes.length + alertesAbsences.length) > 0 ? (alertes.length + alertesAbsences.length) : null,
      icon: (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
      ),
    },
    {
      id: "etudiants",
      label: "Mes étudiants",
      color: "#8b5cf6",
      icon: (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      ),
    },
    {
      id: "notes",
      label: "Notes",
      color: "#f59e0b",
      icon: (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
          <polyline points="10 9 9 9 8 9"/>
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

              {/* En-tête résumé */}
              <div style={{
                display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
                padding: "14px 18px",
                background: "rgba(14,165,233,0.06)",
                border: "1px solid rgba(14,165,233,0.15)",
                borderRadius: 12,
              }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ fontSize: 22, fontWeight: 700, color: "#0ea5e9" }}>{overview?.nb_matieres || 0}</span>
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>matières</span>
                </div>
                <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.1)" }} />
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ fontSize: 22, fontWeight: 700, color: "#a5b4fc" }}>
                    {overview?.matieres?.reduce((s, m) => s + m.nb_sessions, 0) || 0}
                  </span>
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>séances</span>
                </div>
                <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.1)" }} />
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ fontSize: 22, fontWeight: 700, color: "#22c55e" }}>
                    {overview?.matieres?.length > 0
                      ? Math.round(overview.matieres.reduce((s, m) => s + m.taux_presence, 0) / overview.matieres.length)
                      : 0}%
                  </span>
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>présence moy.</span>
                </div>
              </div>

              {/* Liste des matières */}
              {!overview?.matieres?.length
                ? <Card><EmptyState message="Aucune matière assignée" /></Card>
                : overview.matieres.map((m, i) => (
                  <Card key={i} style={{ borderLeft: "3px solid #0ea5e9" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        {/* Nom de la matière */}
                        <div style={{ fontWeight: 700, fontSize: 16, color: "#fff", marginBottom: 6 }}>
                          {m.nom}
                          {m.code && (
                            <span style={{
                              marginLeft: 10, fontSize: 11, fontWeight: 600,
                              background: "rgba(14,165,233,0.15)", color: "#38bdf8",
                              padding: "2px 8px", borderRadius: 4,
                            }}>{m.code}</span>
                          )}
                        </div>
                        {/* Infos */}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                          {m.classe ? (
                            <span style={{
                              background: "rgba(99,102,241,0.15)", color: "#a5b4fc",
                              fontSize: 11, padding: "2px 9px", borderRadius: 4, fontWeight: 600,
                            }}>Classe {m.classe}</span>
                          ) : m.annee_scolaire ? (
                            <span style={{
                              background: "rgba(99,102,241,0.15)", color: "#a5b4fc",
                              fontSize: 11, padding: "2px 9px", borderRadius: 4, fontWeight: 600,
                            }}>{m.annee_scolaire} — Tous groupes</span>
                          ) : null}
                          {m.classe && m.annee_scolaire && (
                            <span style={{
                              background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)",
                              fontSize: 11, padding: "2px 9px", borderRadius: 4,
                            }}>{m.annee_scolaire}</span>
                          )}
                          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>
                            {m.nb_sessions} séance{m.nb_sessions > 1 ? "s" : ""}
                          </span>
                          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>
                            Coef. {m.coefficient}
                          </span>
                        </div>
                      </div>
                      {/* Taux de présence */}
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{
                          fontSize: 24, fontWeight: 800,
                          color: m.taux_presence >= 75 ? "#22c55e" : "#ef4444",
                        }}>{m.taux_presence}%</div>
                        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 1 }}>présence</div>
                      </div>
                    </div>
                    {/* Barre de progression */}
                    <div style={{ marginTop: 14, background: "rgba(255,255,255,0.06)", borderRadius: 4, height: 4 }}>
                      <div style={{
                        width: `${m.taux_presence}%`, height: "100%",
                        background: m.taux_presence >= 75 ? "#22c55e" : "#ef4444",
                        borderRadius: 4, transition: "width 0.6s ease",
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
            <div className="sc-fade" style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Alertes absences > 3 par matière */}
              <Card>
                <SectionTitle title="Absences excessives par matière (> 3)" icon="⚠️" />
                {alertesAbsences.length === 0
                  ? <EmptyState message="Aucun étudiant n'a dépassé 3 absences dans vos matières ✅" />
                  : alertesAbsences.map((a, i) => (
                    <div key={i} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "12px 14px", marginBottom: 8,
                      background: a.severity === "high" ? "rgba(239,68,68,0.06)" : "rgba(245,158,11,0.06)",
                      border: `1px solid ${a.severity === "high" ? "rgba(239,68,68,0.2)" : "rgba(245,158,11,0.2)"}`,
                      borderLeft: `3px solid ${a.severity === "high" ? "#ef4444" : "#f59e0b"}`,
                      borderRadius: 10,
                    }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{a.prenom} {a.nom}</div>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                          {a.matiere} · Classe {a.classe}
                        </div>
                      </div>
                      <div style={{
                        background: a.severity === "high" ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.15)",
                        color: a.severity === "high" ? "#ef4444" : "#f59e0b",
                        padding: "4px 12px", borderRadius: 20, fontSize: 13, fontWeight: 700,
                      }}>
                        {a.absences} absences
                      </div>
                    </div>
                  ))
                }
              </Card>

              {/* Alertes système */}
              <Card>
                <SectionTitle title="Alertes système" icon="🔔" />
                {alertes.length === 0
                  ? <EmptyState message="Aucune alerte système" />
                  : alertes.map((a, i) => (
                    <div key={i} style={{
                      padding: "13px 16px", marginBottom: 8,
                      background: `${severityColor(a.severity)}0d`,
                      border: `1px solid ${severityColor(a.severity)}25`,
                      borderLeft: `3px solid ${severityColor(a.severity)}`,
                      borderRadius: 10,
                    }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{a.message}</div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 5 }}>
                        {new Date(a.date).toLocaleDateString("fr-FR")}
                      </div>
                    </div>
                  ))
                }
              </Card>
            </div>
          )}

          {/* Étudiants par matière → sélecteur de groupe → liste */}
          {activeTab === "etudiants" && (
            <div className="sc-fade" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {etudiantsLoading && (
                <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
                  <div className="sc-spinner sc-spinner-cyan" />
                </div>
              )}
              {!etudiantsLoading && etudiants.length === 0 && (
                <Card><EmptyState message="Aucune matière assignée" /></Card>
              )}

              {!etudiantsLoading && etudiants.map((mat, mi) => {
                // Groupes disponibles pour cette matière
                const groupesDispos = mat.groupes.map(g => g.classe);
                // Groupe actif pour cette matière (clé: matiere_id)
                const grpActif = selectedGroupe?.[mat.matiere_id] || null;
                const grpData  = grpActif ? mat.groupes.find(g => g.classe === grpActif) : null;

                return (
                  <Card key={mi}>
                    {/* En-tête matière */}
                    <div style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      marginBottom: 14,
                    }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: "#a78bfa" }}>
                          {mat.matiere_nom}
                          {mat.matiere_code && (
                            <span style={{ marginLeft: 8, fontSize: 11, color: "rgba(255,255,255,0.3)", fontWeight: 400 }}>
                              {mat.matiere_code}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>
                          {mat.classe ? `Classe ${mat.classe}` : mat.annee_scolaire}
                          {" · "}{mat.nb_etudiants} étudiant{mat.nb_etudiants > 1 ? "s" : ""}
                        </div>
                      </div>
                    </div>

                    {/* Sélecteur de groupe */}
                    <div style={{ marginBottom: 16 }}>
                      <div style={{
                        fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.3)",
                        textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8,
                      }}>Choisir un groupe</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {groupesDispos.map(cls => {
                          const isActive = grpActif === cls;
                          const cnt = mat.groupes.find(g => g.classe === cls)?.etudiants.length || 0;
                          return (
                            <button
                              key={cls}
                              onClick={() => setSelectedGroupe(prev => ({
                                ...prev,
                                [mat.matiere_id]: isActive ? null : cls,
                              }))}
                              style={{
                                display: "flex", alignItems: "center", gap: 7,
                                padding: "8px 16px", borderRadius: 10, cursor: "pointer",
                                border: isActive
                                  ? "1px solid rgba(139,92,246,0.6)"
                                  : "1px solid rgba(255,255,255,0.1)",
                                background: isActive
                                  ? "rgba(139,92,246,0.22)"
                                  : "rgba(255,255,255,0.04)",
                                color: isActive ? "#a78bfa" : "rgba(255,255,255,0.55)",
                                fontFamily: "'Inter', -apple-system, sans-serif",
                                fontSize: 13, fontWeight: isActive ? 700 : 400,
                                transition: "all 0.15s",
                              }}
                            >
                              <div style={{
                                width: 22, height: 22, borderRadius: 6,
                                background: isActive ? "rgba(139,92,246,0.4)" : "rgba(255,255,255,0.08)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 12, fontWeight: 800,
                                color: isActive ? "#c4b5fd" : "rgba(255,255,255,0.4)",
                              }}>{cls}</div>
                              Groupe {cls}
                              <span style={{
                                background: isActive ? "rgba(139,92,246,0.3)" : "rgba(255,255,255,0.06)",
                                color: isActive ? "#c4b5fd" : "rgba(255,255,255,0.3)",
                                fontSize: 10, padding: "1px 6px", borderRadius: 8, fontWeight: 600,
                              }}>{cnt}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Liste des étudiants du groupe sélectionné */}
                    {!grpActif ? (
                      <div style={{
                        textAlign: "center", padding: "24px 0",
                        color: "rgba(255,255,255,0.2)", fontSize: 13,
                      }}>
                        Sélectionnez un groupe pour afficher les étudiants
                      </div>
                    ) : !grpData || grpData.etudiants.length === 0 ? (
                      <EmptyState message={`Aucun étudiant dans le groupe ${grpActif}`} />
                    ) : (
                      <>
                        <div style={{ height: 1, background: "rgba(255,255,255,0.06)", marginBottom: 12 }} />
                        <div style={{
                          display: "grid",
                          gridTemplateColumns: "auto 80px",
                          gap: "0 8px",
                          fontSize: 10, fontWeight: 600,
                          color: "rgba(255,255,255,0.25)",
                          textTransform: "uppercase", letterSpacing: "0.06em",
                          padding: "0 0 8px",
                          borderBottom: "1px solid rgba(255,255,255,0.05)",
                        }}>
                          <span>Étudiant</span>
                          <span style={{ textAlign: "right" }}>Absences</span>
                        </div>
                        {grpData.etudiants.map((s, si) => (
                          <div key={si} style={{
                            display: "grid", gridTemplateColumns: "auto 80px",
                            gap: "0 8px", alignItems: "center",
                            padding: "10px 0",
                            borderBottom: si < grpData.etudiants.length - 1
                              ? "1px solid rgba(255,255,255,0.04)" : "none",
                          }}>
                            <div>
                              <div style={{ fontWeight: 500, fontSize: 13 }}>{s.prenom} {s.nom}</div>
                              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", marginTop: 1 }}>{s.email}</div>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              {s.absences > 0 ? (
                                <span style={{
                                  background: s.absences > 3 ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.12)",
                                  color: s.absences > 3 ? "#ef4444" : "#f59e0b",
                                  padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                                }}>{s.absences} abs.</span>
                              ) : (
                                <span style={{
                                  background: "rgba(34,197,94,0.08)", color: "#22c55e",
                                  padding: "2px 10px", borderRadius: 20, fontSize: 11,
                                }}>✓ 0</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </Card>
                );
              })}
            </div>
          )}

          {/* Notes */}
          {activeTab === "notes" && (
            <div className="sc-fade" style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* 1. Sélecteur de matière */}
              <Card>
                <SectionTitle title="Matière" icon="📚" />
                {!overview?.matieres?.length
                  ? <EmptyState message="Aucune matière assignée" />
                  : (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {overview.matieres.map((m, i) => {
                        const isSel = selectedMatiereNotes === m.matiere_id;
                        return (
                          <button key={i} onClick={() => {
                            setSelectedMatiereNotes(m.matiere_id);
                            setSelectedGroupeNotes(null);
                            setNoteForm({ student_id: "", note: "", type: "controle" });
                            setNoteMsg("");
                            if (etudiants.length === 0) loadEtudiants();
                            loadNotes(m.matiere_id);
                          }} style={{
                            padding: "8px 18px", borderRadius: 20, cursor: "pointer",
                            border: isSel ? "1px solid #f59e0b" : "1px solid rgba(255,255,255,0.1)",
                            background: isSel ? "rgba(245,158,11,0.18)" : "rgba(255,255,255,0.04)",
                            color: isSel ? "#f59e0b" : "rgba(255,255,255,0.55)",
                            fontSize: 13, fontWeight: isSel ? 700 : 400,
                            fontFamily: "'Inter', -apple-system, sans-serif", transition: "all 0.15s",
                          }}>
                            {m.nom}
                          </button>
                        );
                      })}
                    </div>
                  )
                }
              </Card>

              {selectedMatiereNotes && (() => {
                const matiereData = etudiants.find(e => e.matiere_id === selectedMatiereNotes);
                const groupes     = matiereData?.groupes || [];
                const grpData     = selectedGroupeNotes
                  ? groupes.find(g => g.classe === selectedGroupeNotes)
                  : null;

                // Pivot notes par étudiant
                const byStudent = {};
                notes.forEach(n => {
                  if (!byStudent[n.student_id]) byStudent[n.student_id] = { controle: [], tp: [] };
                  if (n.type === "controle") byStudent[n.student_id].controle.push(n);
                  else if (n.type === "tp")  byStudent[n.student_id].tp.push(n);
                });

                const NoteCell = ({ items }) => (
                  items.length === 0 ? (
                    <span style={{ color: "rgba(255,255,255,0.18)", fontSize: 12 }}>—</span>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      {items.map((n, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <span style={{
                            fontWeight: 700, fontSize: 13,
                            color: n.note >= 10 ? "#22c55e" : "#ef4444",
                          }}>{n.note}/20</span>
                          <button onClick={() => deleteNote(n.id)} title="Supprimer" style={{
                            background: "none", border: "none", cursor: "pointer",
                            color: "rgba(239,68,68,0.5)", fontSize: 13, padding: "0 2px",
                            lineHeight: 1,
                          }}>×</button>
                        </div>
                      ))}
                    </div>
                  )
                );

                return (
                  <>
                    {/* 2. Sélecteur de groupe */}
                    <Card>
                      <SectionTitle title="Groupe" icon="👥" />
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {groupes.map(g => {
                          const isAct = selectedGroupeNotes === g.classe;
                          return (
                            <button key={g.classe} onClick={() => {
                              setSelectedGroupeNotes(isAct ? null : g.classe);
                              setNoteForm({ student_id: "", note: "", type: "controle" });
                              setNoteMsg("");
                            }} style={{
                              display: "flex", alignItems: "center", gap: 7,
                              padding: "8px 16px", borderRadius: 10, cursor: "pointer",
                              border: isAct ? "1px solid rgba(245,158,11,0.5)" : "1px solid rgba(255,255,255,0.1)",
                              background: isAct ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.04)",
                              color: isAct ? "#f59e0b" : "rgba(255,255,255,0.5)",
                              fontFamily: "'Inter', -apple-system, sans-serif",
                              fontSize: 13, fontWeight: isAct ? 700 : 400, transition: "all 0.15s",
                            }}>
                              <div style={{
                                width: 22, height: 22, borderRadius: 6,
                                background: isAct ? "rgba(245,158,11,0.3)" : "rgba(255,255,255,0.08)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 12, fontWeight: 800,
                                color: isAct ? "#fbbf24" : "rgba(255,255,255,0.35)",
                              }}>{g.classe}</div>
                              Groupe {g.classe}
                              <span style={{
                                fontSize: 10, padding: "1px 6px", borderRadius: 8, fontWeight: 600,
                                background: isAct ? "rgba(245,158,11,0.25)" : "rgba(255,255,255,0.06)",
                                color: isAct ? "#fbbf24" : "rgba(255,255,255,0.3)",
                              }}>{g.etudiants.length}</span>
                            </button>
                          );
                        })}
                      </div>
                    </Card>

                    {/* 3. Tableau étudiants + notes + ajout en bas */}
                    {grpData && (
                      <Card>
                        {notesLoading ? (
                          <div style={{ display: "flex", justifyContent: "center", padding: 30 }}>
                            <div className="sc-spinner sc-spinner-cyan" />
                          </div>
                        ) : (
                          <div style={{ overflowX: "auto" }}>
                            {/* En-tête tableau */}
                            <div style={{
                              display: "grid",
                              gridTemplateColumns: "28px 1fr 140px 140px",
                              gap: 8, padding: "0 4px 10px",
                              borderBottom: "1px solid rgba(255,255,255,0.08)",
                              fontSize: 10, fontWeight: 700,
                              color: "rgba(255,255,255,0.3)",
                              textTransform: "uppercase", letterSpacing: "0.07em",
                            }}>
                              <span>#</span>
                              <span>Étudiant</span>
                              <span style={{ textAlign: "center" }}>Contrôle</span>
                              <span style={{ textAlign: "center" }}>TP</span>
                            </div>

                            {/* Lignes étudiants */}
                            {grpData.etudiants.map((s, si) => (
                              <div key={si} style={{
                                display: "grid",
                                gridTemplateColumns: "28px 1fr 140px 140px",
                                gap: 8, padding: "11px 4px", alignItems: "center",
                                borderBottom: "1px solid rgba(255,255,255,0.04)",
                                background: si % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)",
                              }}>
                                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", fontWeight: 600 }}>
                                  {si + 1}
                                </span>
                                <div>
                                  <div style={{ fontWeight: 500, fontSize: 13 }}>{s.prenom} {s.nom}</div>
                                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", marginTop: 1 }}>{s.email}</div>
                                </div>
                                <div style={{ textAlign: "center" }}>
                                  <NoteCell items={byStudent[s.id]?.controle || []} />
                                </div>
                                <div style={{ textAlign: "center" }}>
                                  <NoteCell items={byStudent[s.id]?.tp || []} />
                                </div>
                              </div>
                            ))}

                            {/* Ligne d'ajout de note */}
                            <div style={{
                              marginTop: 12,
                              padding: "14px 4px 4px",
                              borderTop: "2px dashed rgba(245,158,11,0.25)",
                            }}>
                              <div style={{
                                fontSize: 10, fontWeight: 700, color: "#f59e0b",
                                textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10,
                              }}>+ Ajouter une note</div>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end" }}>
                                {/* Étudiant */}
                                <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "2 1 180px" }}>
                                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Étudiant</div>
                                  <select
                                    value={noteForm.student_id}
                                    onChange={e => setNoteForm({ ...noteForm, student_id: e.target.value })}
                                    style={{
                                      padding: "8px 10px", background: "rgba(245,158,11,0.06)",
                                      border: "1px solid rgba(245,158,11,0.25)", borderRadius: 8,
                                      color: "#fff", fontSize: 13, outline: "none",
                                      fontFamily: "'Inter', -apple-system, sans-serif", colorScheme: "dark",
                                    }}>
                                    <option value="">— Choisir —</option>
                                    {grpData.etudiants.map(s => (
                                      <option key={s.id} value={s.id}>{s.prenom} {s.nom}</option>
                                    ))}
                                  </select>
                                </div>
                                {/* Note */}
                                <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 80px" }}>
                                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Note /20</div>
                                  <input
                                    type="number" min="0" max="20" step="0.25"
                                    placeholder="14.5"
                                    value={noteForm.note}
                                    onChange={e => setNoteForm({ ...noteForm, note: e.target.value })}
                                    style={{
                                      padding: "8px 10px", background: "rgba(245,158,11,0.06)",
                                      border: "1px solid rgba(245,158,11,0.25)", borderRadius: 8,
                                      color: "#fff", fontSize: 13, outline: "none",
                                      fontFamily: "'Inter', -apple-system, sans-serif", colorScheme: "dark",
                                    }}
                                  />
                                </div>
                                {/* Type Contrôle / TP */}
                                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Type</div>
                                  <div style={{ display: "flex", gap: 4 }}>
                                    {["controle", "tp"].map(t => (
                                      <button key={t} onClick={() => setNoteForm({ ...noteForm, type: t })} style={{
                                        padding: "8px 14px", borderRadius: 8, cursor: "pointer",
                                        border: noteForm.type === t ? "1px solid #f59e0b" : "1px solid rgba(255,255,255,0.1)",
                                        background: noteForm.type === t ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.04)",
                                        color: noteForm.type === t ? "#f59e0b" : "rgba(255,255,255,0.4)",
                                        fontFamily: "'Inter', -apple-system, sans-serif",
                                        fontSize: 12, fontWeight: noteForm.type === t ? 700 : 400,
                                        transition: "all 0.15s",
                                      }}>
                                        {t === "controle" ? "Contrôle" : "TP"}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                {/* Bouton Ajouter */}
                                <button
                                  onClick={addNote}
                                  disabled={noteSaving}
                                  style={{
                                    padding: "8px 20px", border: "none", borderRadius: 8,
                                    background: "#f59e0b", color: "#fff",
                                    cursor: noteSaving ? "wait" : "pointer",
                                    fontFamily: "'Inter', -apple-system, sans-serif",
                                    fontSize: 13, fontWeight: 700,
                                    opacity: noteSaving ? 0.6 : 1, flexShrink: 0,
                                    alignSelf: "flex-end",
                                  }}>
                                  {noteSaving ? "…" : "+ Ajouter"}
                                </button>
                              </div>
                              {/* Message feedback */}
                              {noteMsg && (
                                <div style={{
                                  marginTop: 8, padding: "8px 12px", borderRadius: 7, fontSize: 12, fontWeight: 500,
                                  background: noteMsg.startsWith("✅") ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                                  border: `1px solid ${noteMsg.startsWith("✅") ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
                                  color: noteMsg.startsWith("✅") ? "#22c55e" : "#ef4444",
                                }}>
                                  {noteMsg}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </Card>
                    )}

                    {!grpData && (
                      <div style={{
                        textAlign: "center", padding: "28px 0",
                        color: "rgba(255,255,255,0.2)", fontSize: 13,
                      }}>
                        Sélectionnez un groupe pour afficher les notes
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
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
