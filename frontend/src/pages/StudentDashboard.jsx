import { useState, useEffect } from "react";
import axios from "axios";
import { useBreakpoint } from "../utils/useBreakpoint";

const API_URL = "";

function authHeaders() {
  const token = localStorage.getItem("token");
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

function SectionTitle({ children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
      <div style={{ width: 3, height: 18, borderRadius: 2, background: "#6366f1", flexShrink: 0 }} />
      <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.85)", letterSpacing: "0.01em" }}>{children}</span>
    </div>
  );
}

function GrayField({ label, value }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.22)",
        letterSpacing: "0.08em", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 4 }}>
        {label} <span style={{ fontSize: 9 }}>🔒</span>
      </div>
      <div style={{
        padding: "10px 14px", background: "rgba(255,255,255,0.015)",
        border: "1px solid rgba(255,255,255,0.04)", borderRadius: 10,
        fontSize: 13, color: value ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.09)",
        minHeight: 40, display: "flex", alignItems: "center",
        cursor: "not-allowed", userSelect: "none",
      }}>{value || "—"}</div>
    </div>
  );
}

function EditField({ label, value, onChange, type = "text", placeholder = "" }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: "#a5b4fc",
        letterSpacing: "0.08em", textTransform: "uppercase" }}>{label}</div>
      <input type={type} value={value} onChange={onChange} placeholder={placeholder}
        style={{
          width: "100%", padding: "10px 14px", boxSizing: "border-box",
          background: "rgba(99,102,241,0.07)",
          border: "1px solid rgba(99,102,241,0.3)",
          borderRadius: 10, color: "#fff", fontSize: 13,
          fontFamily: "'Inter', -apple-system, sans-serif", outline: "none",
          colorScheme: "dark",
        }} />
    </div>
  );
}

function EditSelect({ label, value, onChange, options }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: "#a5b4fc",
        letterSpacing: "0.08em", textTransform: "uppercase" }}>{label}</div>
      <select value={value} onChange={onChange}
        style={{
          width: "100%", padding: "10px 14px", boxSizing: "border-box",
          background: "rgba(99,102,241,0.07)",
          border: "1px solid rgba(99,102,241,0.3)",
          borderRadius: 10, color: value ? "#fff" : "rgba(255,255,255,0.35)",
          fontSize: 13, fontFamily: "'Inter', -apple-system, sans-serif", outline: "none", cursor: "pointer",
        }}>
        <option value="" style={{ background: "#12122a" }}>— Sélectionner —</option>
        {options.map(o => (
          <option key={o.value} value={o.value} style={{ background: "#12122a" }}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const SLOT_COLORS = [
  "rgba(99,102,241,0.18)", "rgba(168,85,247,0.18)", "rgba(14,165,233,0.18)",
  "rgba(34,197,94,0.15)",  "rgba(245,158,11,0.15)", "rgba(239,68,68,0.15)",
  "rgba(236,72,153,0.15)", "rgba(20,184,166,0.15)",
];

// Icônes SVG pour la sidebar
function IconPerson() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  );
}

function IconEdit() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  );
}

function IconAlert() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  );
}

function IconDoc() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  );
}

function IconBell() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  );
}

function IconMail() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
      <polyline points="22,6 12,13 2,6"/>
    </svg>
  );
}

function IconLogout() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  );
}

export default function StudentDashboard({ user, onLogout, onOpenMessages }) {
  const bp = useBreakpoint();

  const [profile,   setProfile]   = useState(null);
  const [absences,  setAbsences]  = useState([]);
  const [notes,     setNotes]     = useState(null);
  const [alertes,   setAlertes]   = useState([]);
  const [emploi,    setEmploi]    = useState([]);
  const [activeTab, setActiveTab] = useState("profile");
  const [loading,   setLoading]   = useState(true);
  const [unreadMsg, setUnreadMsg] = useState(0);

  const [editForm, setEditForm] = useState({
    email:"", telephone:"", adresse:"", ville:"",
    date_naissance:"", lieu_naissance:"", sexe:"", cin:"",
  });
  const [saving,   setSaving]   = useState(false);
  const [saveMsg,  setSaveMsg]  = useState("");

  const [pwForm,   setPwForm]   = useState({ current:"", nouveau:"", confirm:"" });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg,    setPwMsg]    = useState("");

  useEffect(() => {
    loadAll();
    axios.get("/api/messaging/unread-count", authHeaders())
      .then(r => setUnreadMsg(r.data.count)).catch(() => {});
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [pr, ab, nt, al, em] = await Promise.all([
        axios.get(`${API_URL}/api/student/profile`,          authHeaders()),
        axios.get(`${API_URL}/api/student/absences`,         authHeaders()),
        axios.get(`${API_URL}/api/student/notes`,            authHeaders()),
        axios.get(`${API_URL}/api/student/alertes`,          authHeaders()),
        axios.get(`${API_URL}/api/student/emploi-du-temps`,  authHeaders()),
      ]);
      setProfile(pr.data);
      setAbsences(ab.data);
      setNotes(nt.data);
      setAlertes(al.data);
      setEmploi(em.data);
      setEditForm({
        email:          pr.data.email          || "",
        telephone:      pr.data.telephone      || "",
        adresse:        pr.data.adresse        || "",
        ville:          pr.data.ville          || "",
        date_naissance: pr.data.date_naissance || "",
        lieu_naissance: pr.data.lieu_naissance || "",
        sexe:           pr.data.sexe           || "",
        cin:            pr.data.cin            || "",
      });
    } catch (err) {
      console.error("Erreur chargement étudiant:", err);
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      await axios.put(`${API_URL}/api/student/profile`, editForm, authHeaders());
      setSaveMsg("ok");
      loadAll();
    } catch (e) {
      setSaveMsg("err:" + (e.response?.data?.detail || "Erreur"));
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(""), 3500);
    }
  };

  const changePassword = async () => {
    if (pwForm.nouveau !== pwForm.confirm) {
      setPwMsg("err:Les mots de passe ne correspondent pas");
      setTimeout(() => setPwMsg(""), 3500);
      return;
    }
    if (pwForm.nouveau.length < 6) {
      setPwMsg("err:Le mot de passe doit contenir au moins 6 caractères");
      setTimeout(() => setPwMsg(""), 3500);
      return;
    }
    setPwSaving(true);
    try {
      await axios.put(`${API_URL}/api/auth/change-password`,
        { current_password: pwForm.current, new_password: pwForm.nouveau },
        authHeaders()
      );
      setPwMsg("ok");
      setPwForm({ current:"", nouveau:"", confirm:"" });
    } catch (e) {
      setPwMsg("err:" + (e.response?.data?.detail || "Erreur"));
    } finally {
      setPwSaving(false);
      setTimeout(() => setPwMsg(""), 3500);
    }
  };

  const marquerLue = async (alertId) => {
    try {
      await axios.put(`${API_URL}/api/student/alertes/${alertId}/lue`, {}, authHeaders());
      setAlertes(prev => prev.filter(a => a.id !== alertId));
    } catch {}
  };

  const navTabs = [
    { id: "profile",  label: "Mon profil",      color: "#3b82f6", Icon: IconPerson },
    { id: "edit",     label: "Mes infos",        color: "#a855f7", Icon: IconEdit },
    { id: "emploi",   label: "Emploi du temps",  color: "#10b981", Icon: IconCalendar },
    { id: "absences", label: "Absences",          color: "#f97316", Icon: IconAlert },
    { id: "notes",    label: "Notes",             color: "#6366f1", Icon: IconDoc },
    { id: "alertes",  label: "Alertes",           color: "#ef4444", Icon: IconBell },
  ];

  const statusColor = s => s === "present" ? "#22c55e" : s === "absent" ? "#ef4444" : "#f59e0b";
  const statusLabel = s => s === "present" ? "Présent" : s === "absent" ? "Absent" : "Retard";
  const severityColor = s => s === "high" ? "#ef4444" : s === "medium" ? "#f59e0b" : "#6366f1";
  const mentionColor = m => m === "Bien" || m === "Assez bien" ? "#22c55e" : m === "Passable" ? "#f59e0b" : "#ef4444";

  // Construire la grille emploi du temps
  const matiereColorMap = {};
  let colorIdx = 0;
  emploi.forEach(s => {
    if (!matiereColorMap[s.matiere]) {
      matiereColorMap[s.matiere] = SLOT_COLORS[colorIdx % SLOT_COLORS.length];
      colorIdx++;
    }
  });

  const SaveAlert = ({ msg }) => msg ? (
    <div style={{
      marginBottom: 16, padding: "11px 16px", borderRadius: 9, fontSize: 13, fontWeight: 500,
      background: msg === "ok" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
      border: `1px solid ${msg === "ok" ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`,
      borderLeft: `3px solid ${msg === "ok" ? "#22c55e" : "#ef4444"}`,
      color: msg === "ok" ? "#22c55e" : "#ef4444",
    }}>
      {msg === "ok" ? "✅ Enregistré avec succès !" : msg.replace("err:", "")}
    </div>
  ) : null;

  return (
    <div style={{
      display: "flex",
      minHeight: "100vh",
      background: "#0d0d1f",
      fontFamily: "'Inter', -apple-system, sans-serif",
      color: "#fff",
    }}>

      {/* ── Sidebar ── */}
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
          <div style={{ flexShrink: 0, filter: "drop-shadow(0 4px 12px rgba(168,85,247,0.5))", position: "relative", width: 46, height: 46 }}>
            <svg width="46" height="46" viewBox="0 0 46 46" fill="none">
              <defs>
                <linearGradient id="hexGradStudent" x1="0" y1="0" x2="46" y2="46" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#1e1040"/>
                  <stop offset="100%" stopColor="#4c1d95"/>
                </linearGradient>
              </defs>
              <polygon points="23,2 42,12.5 42,33.5 23,44 4,33.5 4,12.5" fill="url(#hexGradStudent)"/>
              <polygon points="23,6 38,14.8 38,31.2 23,40 8,31.2 8,14.8" fill="none" stroke="rgba(216,180,254,0.35)" strokeWidth="1.2"/>
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 900, color: "#fff", letterSpacing: "-0.5px", fontFamily: "sans-serif" }}>SC</span>
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#f1f5f9", lineHeight: 1 }}>SmartCampus</div>
            <div style={{ fontSize: 10, color: "#a855f7", marginTop: 3, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>Étudiant</div>
          </div>
        </div>

        {/* Séparateur */}
        <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "0 16px 8px" }} />

        {/* Navigation */}
        <nav style={{ flex: 1, padding: "4px 10px" }}>
          {navTabs.map(({ id, label, color, Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 12px", borderRadius: 10, marginBottom: 2,
                  background: active ? `${color}18` : "transparent",
                  border: active ? `1px solid ${color}35` : "1px solid transparent",
                  color: active ? "#fff" : "rgba(255,255,255,0.48)",
                  cursor: "pointer", textAlign: "left",
                  fontFamily: "'Inter', -apple-system, sans-serif",
                  fontSize: 13, fontWeight: active ? 600 : 400,
                  transition: "all 0.15s ease",
                  position: "relative",
                }}
                onMouseEnter={e => { if (!active) { e.currentTarget.style.background = `${color}10`; e.currentTarget.style.color = "#fff"; }}}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.48)"; }}}
              >
                <div style={{
                  width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                  background: active ? `${color}28` : `${color}12`,
                  border: active ? `1px solid ${color}40` : `1px solid ${color}20`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: active ? color : `${color}bb`,
                  transition: "all 0.15s ease",
                }}>
                  <Icon />
                </div>
                <span style={{ flex: 1 }}>{label}</span>
                {id === "alertes" && alertes.length > 0 && (
                  <span style={{
                    background: "#ef4444", color: "#fff", fontSize: 9, fontWeight: 700,
                    minWidth: 16, height: 16, borderRadius: 8,
                    display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px",
                  }}>{alertes.length}</span>
                )}
                {active && (
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0, boxShadow: `0 0 6px ${color}` }} />
                )}
              </button>
            );
          })}
        </nav>

        {/* Séparateur bas */}
        <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "0 16px 4px" }} />

        {/* Boutons bas */}
        <div style={{ padding: "10px 10px 20px", display: "flex", flexDirection: "column", gap: 4 }}>
          <button
            onClick={onOpenMessages}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: 12,
              padding: "11px 12px", borderRadius: 10,
              background: "transparent", border: "none",
              color: "rgba(255,255,255,0.5)", cursor: "pointer",
              fontFamily: "'Inter', -apple-system, sans-serif",
              fontSize: 13, fontWeight: 400, textAlign: "left",
              position: "relative",
            }}
          >
            <div style={{
              width: 34, height: 34, borderRadius: 9, flexShrink: 0,
              background: "rgba(255,255,255,0.04)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#0ea5e9",
            }}>
              <IconMail />
            </div>
            <span style={{ flex: 1 }}>Messages</span>
            {unreadMsg > 0 && (
              <span style={{
                background: "#ef4444", color: "#fff", fontSize: 9, fontWeight: 700,
                minWidth: 16, height: 16, borderRadius: 8,
                display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px",
              }}>{unreadMsg}</span>
            )}
          </button>

          <button
            onClick={onLogout}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: 12,
              padding: "11px 12px", borderRadius: 10,
              background: "transparent", border: "none",
              color: "rgba(255,255,255,0.5)", cursor: "pointer",
              fontFamily: "'Inter', -apple-system, sans-serif",
              fontSize: 13, fontWeight: 400, textAlign: "left",
            }}
          >
            <div style={{
              width: 34, height: 34, borderRadius: 9, flexShrink: 0,
              background: "rgba(239,68,68,0.08)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#ef4444",
            }}>
              <IconLogout />
            </div>
            <span style={{ color: "#ef4444" }}>Déconnexion</span>
          </button>
        </div>
      </div>

      {/* ── Contenu principal ── */}
      <div style={{ flex: 1, minHeight: "100vh", overflowY: "auto", overflowX: "hidden" }}>
        <div className="page-body">
          {loading && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", gap: 16, padding: "80px 20px" }}>
              <div className="sc-spinner sc-spinner-purple" />
              <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, fontWeight: 500 }}>Chargement...</span>
            </div>
          )}

          {/* ── Profil ── */}
          {!loading && activeTab === "profile" && profile && (
            <div className="sc-fade" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Card style={{
                display: "flex", alignItems: "center", gap: 20,
                background: "linear-gradient(135deg, rgba(99,102,241,0.1) 0%, rgba(168,85,247,0.07) 100%)",
                borderColor: "rgba(99,102,241,0.2)",
              }}>
                <div style={{
                  width: 84, height: 84, borderRadius: "50%",
                  background: "linear-gradient(135deg,#6366f1,#a855f7)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 34, flexShrink: 0, overflow: "hidden",
                  boxShadow: "0 0 0 3px rgba(99,102,241,0.3), 0 8px 24px rgba(99,102,241,0.2)",
                }}>
                  🎓
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
                    {profile.prenom} {profile.nom}
                  </h2>
                  <p style={{ color: "rgba(255,255,255,0.4)", margin: "4px 0 0", fontSize: 13 }}>
                    {profile.email}
                  </p>
                  <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {profile.classe && (
                      <span style={{ background: "rgba(99,102,241,0.15)", color: "#a5b4fc",
                        fontSize: 11, padding: "2px 10px", borderRadius: 100, fontWeight: 600 }}>
                        Classe {profile.classe}
                      </span>
                    )}
                    {profile.annee_scolaire && (
                      <span style={{ background: "rgba(14,165,233,0.12)", color: "#38bdf8",
                        fontSize: 11, padding: "2px 10px", borderRadius: 100, fontWeight: 600 }}>
                        {profile.annee_scolaire}
                      </span>
                    )}
                  </div>
                </div>
              </Card>

              <div style={{ display: "grid", gridTemplateColumns: bp.cols3, gap: bp.gap2 }}>
                {[
                  {
                    label: "Absences", value: profile?.stats?.absences ?? 0, color: "#ef4444",
                    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>,
                  },
                  {
                    label: "Taux présence", value: `${profile?.stats?.taux_presence ?? 0}%`, color: "#22c55e",
                    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
                  },
                  {
                    label: "Moyenne", value: `${profile?.stats?.moyenne ?? 0}/20`, color: "#6366f1",
                    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
                  },
                ].map((s, i) => (
                  <div key={i} style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 14, padding: "18px 18px 16px",
                    position: "relative", overflow: "hidden",
                    transition: "border-color .2s, transform .18s",
                  }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = `${s.color}50`; e.currentTarget.style.transform = "translateY(-2px)"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.transform = "translateY(0)"; }}
                  >
                    <div style={{ position: "absolute", top: -10, right: -10, width: 60, height: 60, borderRadius: "50%", background: `${s.color}18`, filter: "blur(14px)", pointerEvents: "none" }} />
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 11, background: `${s.color}18`, border: `1px solid ${s.color}35`, display: "flex", alignItems: "center", justifyContent: "center", color: s.color }}>
                        {s.icon}
                      </div>
                      <div style={{ fontSize: 28, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
                    </div>
                    <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.38)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>{s.label}</div>
                  </div>
                ))}
              </div>

              <Card>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, fontSize: 13 }}>
                  <span style={{ color: "rgba(255,255,255,0.5)", fontWeight: 500 }}>Taux de présence</span>
                  <span style={{ color: profile?.stats?.taux_presence ?? 0 >= 75 ? "#22c55e" : "#ef4444",
                    fontWeight: 700 }}>{profile?.stats?.taux_presence ?? 0}%</span>
                </div>
                <div style={{ background: "rgba(255,255,255,0.07)", borderRadius: 100, height: 10 }}>
                  <div style={{
                    width: `${profile?.stats?.taux_presence ?? 0}%`, height: "100%",
                    background: profile?.stats?.taux_presence ?? 0 >= 75
                      ? "linear-gradient(90deg,#16a34a,#22c55e)"
                      : "linear-gradient(90deg,#dc2626,#ef4444)",
                    borderRadius: 100, transition: "width 0.9s cubic-bezier(0.4,0,0.2,1)",
                  }} />
                </div>
                {(profile?.stats?.taux_presence ?? 0) < 75 && (
                  <p style={{ color: "#ef4444", fontSize: 12, marginTop: 12,
                    background: "rgba(239,68,68,0.08)", padding: "8px 12px",
                    borderRadius: 8, borderLeft: "3px solid #ef4444" }}>
                    ⚠️ Attention — votre taux de présence est insuffisant (minimum requis : 75%)
                  </p>
                )}
              </Card>
            </div>
          )}

          {/* ── Mes infos ── */}
          {!loading && activeTab === "edit" && profile && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Bloc profil */}
              <Card>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 600, fontSize: 14, color: "#fff" }}>👤 Mon profil complet</span>
                  <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                    <span style={{ fontSize: 10, color: "#a5b4fc", background: "rgba(99,102,241,0.15)",
                      padding: "2px 9px", borderRadius: 20, fontWeight: 600, letterSpacing: "0.06em" }}>✏️ Modifiable</span>
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", background: "rgba(255,255,255,0.05)",
                      padding: "2px 9px", borderRadius: 20, fontWeight: 600, letterSpacing: "0.06em" }}>🔒 Lecture seule</span>
                  </div>
                </div>

                <SaveAlert msg={saveMsg} />

                <SectionTitle>Identité</SectionTitle>
                <div style={{ display: "grid", gridTemplateColumns: bp.cols2, gap: 12, marginBottom: 18 }}>
                  <GrayField label="Nom"               value={profile.nom} />
                  <GrayField label="Prénom"            value={profile.prenom} />
                  <EditField label="Date de naissance" type="date" value={editForm.date_naissance}
                    onChange={e => setEditForm(f => ({...f, date_naissance: e.target.value}))} />
                  <EditField label="Lieu de naissance" value={editForm.lieu_naissance}
                    onChange={e => setEditForm(f => ({...f, lieu_naissance: e.target.value}))} />
                  <EditSelect label="Sexe" value={editForm.sexe}
                    onChange={e => setEditForm(f => ({...f, sexe: e.target.value}))}
                    options={[{ value: "M", label: "Masculin" }, { value: "F", label: "Féminin" }]} />
                  <EditField label="CIN" value={editForm.cin}
                    onChange={e => setEditForm(f => ({...f, cin: e.target.value}))} />
                </div>

                <SectionTitle>Coordonnées</SectionTitle>
                <div style={{ display: "grid", gridTemplateColumns: bp.cols2, gap: 12, marginBottom: 18 }}>
                  <EditField label="Email" type="email" value={editForm.email}
                    onChange={e => setEditForm(f => ({...f, email: e.target.value}))} />
                  <EditField label="Téléphone" value={editForm.telephone}
                    onChange={e => setEditForm(f => ({...f, telephone: e.target.value}))} />
                  <EditField label="Ville" value={editForm.ville}
                    onChange={e => setEditForm(f => ({...f, ville: e.target.value}))} />
                  <EditField label="Adresse" value={editForm.adresse}
                    onChange={e => setEditForm(f => ({...f, adresse: e.target.value}))} />
                </div>

                <SectionTitle>Scolarité</SectionTitle>
                <div style={{ display: "grid", gridTemplateColumns: bp.cols2, gap: 12, marginBottom: 18 }}>
                  <GrayField label="Classe"            value={profile.classe} />
                  <GrayField label="Année scolaire"    value={profile.annee_scolaire} />
                  <GrayField label="N° Carte étudiant" value={profile.numero_carte} />
                </div>

                <SectionTitle>Contacts parentaux</SectionTitle>
                <div style={{ display: "grid", gridTemplateColumns: bp.cols2, gap: 12, marginBottom: 18 }}>
                  <GrayField label="Nom du père"    value={profile.nom_pere} />
                  <GrayField label="Tél. père"      value={profile.tel_pere} />
                  <GrayField label="Nom de la mère" value={profile.nom_mere} />
                  <GrayField label="Tél. mère"      value={profile.tel_mere} />
                  <GrayField label="Email parent"   value={profile.email_parent} />
                </div>

                <button onClick={saveProfile} disabled={saving} className="sc-btn" style={{
                  width: "100%", padding: "12px", border: "none", borderRadius: 10,
                  background: "linear-gradient(135deg,#6366f1,#a855f7)",
                  color: "#fff", fontFamily: "'Inter', -apple-system, sans-serif",
                  fontSize: 13, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer",
                  opacity: saving ? 0.6 : 1,
                }}>
                  {saving ? "Enregistrement..." : "💾 Enregistrer mon profil"}
                </button>
              </Card>

              {/* Changement de mot de passe */}
              <Card>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16 }}>🔑 Changer mon mot de passe</div>

                <SaveAlert msg={pwMsg} />

                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 14 }}>
                  <EditField label="Mot de passe actuel" type="password" value={pwForm.current}
                    onChange={e => setPwForm(f => ({...f, current: e.target.value}))} />
                  <div style={{ display: "grid", gridTemplateColumns: bp.cols2, gap: 12 }}>
                    <EditField label="Nouveau mot de passe" type="password" value={pwForm.nouveau}
                      onChange={e => setPwForm(f => ({...f, nouveau: e.target.value}))} />
                    <EditField label="Confirmer" type="password" value={pwForm.confirm}
                      onChange={e => setPwForm(f => ({...f, confirm: e.target.value}))} />
                  </div>
                </div>

                <button onClick={changePassword} disabled={pwSaving || !pwForm.current || !pwForm.nouveau} className="sc-btn"
                  style={{
                    width: "100%", padding: "11px", border: "none", borderRadius: 10,
                    background: "rgba(99,102,241,0.2)", borderTop: "1px solid rgba(99,102,241,0.35)",
                    color: "#a5b4fc", fontFamily: "'Inter', -apple-system, sans-serif",
                    fontSize: 13, fontWeight: 600,
                    cursor: pwSaving || !pwForm.current || !pwForm.nouveau ? "not-allowed" : "pointer",
                    opacity: pwSaving || !pwForm.current || !pwForm.nouveau ? 0.5 : 1,
                  }}>
                  {pwSaving ? "Modification..." : "🔑 Modifier le mot de passe"}
                </button>
              </Card>

              <div style={{ padding: "10px 14px", background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10,
                fontSize: 11, color: "rgba(255,255,255,0.25)", lineHeight: 1.7 }}>
                Les champs 🔒 sont gérés par l'administration. Pour toute correction, contactez un administrateur.
              </div>
            </div>
          )}

          {/* ── Emploi du temps ── */}
          {!loading && activeTab === "emploi" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Card style={{ padding: "16px 18px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(99,102,241,0.15)",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🗓️</div>
                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Emploi du temps</h2>
                  {profile?.classe && (
                    <span style={{ marginLeft: "auto", background: "rgba(99,102,241,0.15)", color: "#a5b4fc",
                      fontSize: 11, padding: "2px 10px", borderRadius: 100, fontWeight: 600 }}>
                      Classe {profile.classe}
                    </span>
                  )}
                </div>

                {emploi.length === 0 ? (
                  <EmptyState message="Aucun emploi du temps disponible pour l'instant" />
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {JOURS.filter(j => emploi.some(s => s.jour === j)).map(jour => (
                      <div key={jour}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#a5b4fc",
                          letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
                          {jour}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {emploi.filter(s => s.jour === jour).map((s, i) => (
                            <div key={i} style={{
                              display: "flex", alignItems: "center", gap: 14,
                              padding: "11px 14px", borderRadius: 12,
                              background: matiereColorMap[s.matiere] || "rgba(99,102,241,0.12)",
                              border: "1px solid rgba(255,255,255,0.06)",
                            }}>
                              <div style={{ minWidth: 80, textAlign: "center" }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>
                                  {s.heure_debut?.slice(0,5)}
                                </div>
                                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>
                                  {s.heure_fin?.slice(0,5)}
                                </div>
                              </div>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 13, fontWeight: 600 }}>{s.matiere}</div>
                                {s.professeur && (
                                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                                    {s.professeur}
                                  </div>
                                )}
                              </div>
                              {s.salle && (
                                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)",
                                  background: "rgba(255,255,255,0.06)", padding: "3px 9px",
                                  borderRadius: 8, flexShrink: 0 }}>
                                  Salle {s.salle}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* ── Absences ── */}
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
                        {a.date} {a.heure ? `· ${a.heure.slice(0,5)}` : ""}
                      </div>
                    </div>
                    <span style={{
                      background: `${statusColor(a.status)}20`, color: statusColor(a.status),
                      padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                    }}>{statusLabel(a.status)}</span>
                  </div>
                ))
              }
            </Card>
          )}

          {/* ── Notes ── */}
          {!loading && activeTab === "notes" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Moyenne générale */}
              <Card style={{ textAlign: "center" }}>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>Moyenne générale</div>
                <div style={{ fontSize: 48, fontWeight: 700,
                  color: (notes?.moyenne || 0) >= 10 ? "#22c55e" : "#ef4444" }}>
                  {notes?.moyenne || 0}
                  <span style={{ fontSize: 20, color: "rgba(255,255,255,0.3)" }}>/20</span>
                </div>
              </Card>

              {/* Stats par matière */}
              {notes?.stats_par_matiere?.length > 0 && (
                <Card>
                  <h2 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 600 }}>📊 Moyennes par matière</h2>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {notes.stats_par_matiere.map((s, i) => (
                      <div key={i}>
                        <div style={{ display: "flex", justifyContent: "space-between",
                          alignItems: "center", marginBottom: 5 }}>
                          <div>
                            <span style={{ fontSize: 13, fontWeight: 500 }}>{s.matiere}</span>
                            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)",
                              marginLeft: 8 }}>Coef {s.coefficient} · {s.nb_notes} note{s.nb_notes > 1 ? "s" : ""}</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 11, color: mentionColor(s.mention),
                              background: `${mentionColor(s.mention)}18`,
                              padding: "2px 8px", borderRadius: 20, fontWeight: 600 }}>
                              {s.mention}
                            </span>
                            <span style={{ fontSize: 15, fontWeight: 700, color: s.moyenne >= 10 ? "#22c55e" : "#ef4444" }}>
                              {s.moyenne}/20
                            </span>
                          </div>
                        </div>
                        <div style={{ background: "rgba(255,255,255,0.07)", borderRadius: 100, height: 5 }}>
                          <div style={{
                            width: `${(s.moyenne / 20) * 100}%`, height: "100%",
                            background: s.moyenne >= 10 ? "linear-gradient(90deg,#16a34a,#22c55e)" : "linear-gradient(90deg,#dc2626,#ef4444)",
                            borderRadius: 100, transition: "width 0.7s ease",
                          }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Détail des notes */}
              <Card>
                <h2 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 600 }}>📝 Détail des notes</h2>
                {!notes?.notes?.length
                  ? <EmptyState message="Aucune note enregistrée" />
                  : notes.notes.map((n, i) => (
                    <div key={i} style={{
                      padding: "12px 0",
                      borderBottom: i < notes.notes.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div>
                          <div style={{ fontWeight: 500, fontSize: 14 }}>{n.matiere}</div>
                          <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, marginTop: 2 }}>
                            {n.type} · Coef {n.coefficient} · {n.date}
                          </div>
                        </div>
                        <div style={{ fontSize: 20, fontWeight: 700,
                          color: n.note >= 10 ? "#22c55e" : "#ef4444" }}>
                          {n.note}<span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>/20</span>
                        </div>
                      </div>
                      {n.commentaire && (
                        <div style={{ marginTop: 6, fontSize: 12, color: "rgba(255,255,255,0.45)",
                          background: "rgba(255,255,255,0.03)", padding: "6px 10px",
                          borderRadius: 7, borderLeft: "2px solid rgba(99,102,241,0.4)" }}>
                          💬 {n.commentaire}
                        </div>
                      )}
                    </div>
                  ))
                }
              </Card>
            </div>
          )}

          {/* ── Alertes ── */}
          {!loading && activeTab === "alertes" && (
            <Card>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(168,85,247,0.15)",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🔔</div>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Mes alertes</h2>
                {alertes.length > 0 && (
                  <span style={{ marginLeft: "auto", background: "rgba(239,68,68,0.15)", color: "#ef4444",
                    fontSize: 11, padding: "2px 10px", borderRadius: 100, fontWeight: 600 }}>
                    {alertes.length} non lue{alertes.length > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              {alertes.length === 0
                ? <EmptyState message="Aucune alerte — continuez comme ça ! ✅" />
                : alertes.map((a, i) => (
                  <div key={i} style={{
                    padding: "13px 16px", marginBottom: 8,
                    background: `${severityColor(a.severity)}0d`,
                    border: `1px solid ${severityColor(a.severity)}25`,
                    borderLeft: `3px solid ${severityColor(a.severity)}`,
                    borderRadius: 10, display: "flex", alignItems: "flex-start", gap: 12,
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{a.message}</div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 5 }}>
                        {new Date(a.date).toLocaleDateString("fr-FR")}
                      </div>
                    </div>
                    <button onClick={() => marquerLue(a.id)} style={{
                      background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 7, color: "rgba(255,255,255,0.45)", cursor: "pointer",
                      fontSize: 11, padding: "4px 10px", fontFamily: "'Inter', -apple-system, sans-serif",
                      flexShrink: 0, whiteSpace: "nowrap",
                    }}>
                      ✓ Lu
                    </button>
                  </div>
                ))
              }
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
