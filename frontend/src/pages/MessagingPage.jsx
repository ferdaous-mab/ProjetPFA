import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";

const MY_ID = () => {
  try {
    const u = JSON.parse(localStorage.getItem("user") || "{}");
    return u.user_id ?? u.id ?? "";
  } catch { return ""; }
};

function authHeaders() {
  return { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } };
}

const ROLE_COLOR  = r => r === "professeur" ? "#0ea5e9" : r === "admin" ? "#f59e0b" : "#a78bfa";
const ROLE_LABEL  = r => r === "professeur" ? "Professeur" : r === "admin" ? "Administrateur" : "Étudiant";

function Avatar({ nom, prenom, role, size = 36 }) {
  const i = `${(prenom || "?")[0]}${(nom || "?")[0]}`.toUpperCase();
  const c = ROLE_COLOR(role);
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: `${c}22`, border: `1.5px solid ${c}50`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.36, fontWeight: 700, color: c,
    }}>{i}</div>
  );
}

function fmtTime(iso) {
  if (!iso) return "";
  const d = new Date(iso), now = new Date();
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Hier";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

function fmtDateLabel(iso) {
  const d = new Date(iso), now = new Date();
  if (d.toDateString() === now.toDateString()) return "Aujourd'hui";
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return "Hier";
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

// ── Notification navigateur ───────────────────────────────────────────────────
function notifyBrowser(title, body) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  if (!document.hidden && document.hasFocus()) return;
  try { new Notification(title, { body, tag: title }); } catch {}
}

// ── Context Menu ──────────────────────────────────────────────────────────────
function CtxMenu({ ctx, myId, onReply, onDelete, onCopy, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const close = e => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    setTimeout(() => document.addEventListener("mousedown", close), 0);
    return () => document.removeEventListener("mousedown", close);
  }, [onClose]);

  const item = (icon, label, action, danger) => (
    <button onClick={() => { action(); onClose(); }} style={{
      display: "flex", alignItems: "center", gap: 9,
      width: "100%", padding: "9px 14px", background: "none",
      border: "none", color: danger ? "#f87171" : "rgba(255,255,255,0.82)",
      fontSize: 13, fontFamily: "Sora,sans-serif", cursor: "pointer",
      textAlign: "left",
    }}
      onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}
      onMouseLeave={e => e.currentTarget.style.background = "none"}
    >
      <span style={{ fontSize: 14 }}>{icon}</span> {label}
    </button>
  );

  // Fit inside viewport
  const style = {
    position: "fixed", zIndex: 2000,
    top: Math.min(ctx.y, window.innerHeight - 170),
    left: Math.min(ctx.x, window.innerWidth - 185),
    background: "#16162a",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 12, overflow: "hidden",
    boxShadow: "0 12px 40px rgba(0,0,0,0.55)", minWidth: 175,
  };

  return (
    <div ref={ref} style={style}>
      {item("↩", "Répondre", onReply)}
      {item("📋", "Copier", onCopy)}
      {ctx.msg.sender_id === myId && !ctx.msg.is_deleted &&
        item("🗑", "Supprimer", onDelete, true)}
    </div>
  );
}

// ── Typing dots ───────────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center", padding: "2px 0" }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 7, height: 7, borderRadius: "50%",
          background: "rgba(255,255,255,0.4)",
          animation: `typing 1.2s infinite ${i * 0.2}s`,
        }} />
      ))}
    </div>
  );
}

// ── Reply bar (above input) ───────────────────────────────────────────────────
function ReplyBar({ replyTo, myId, contact, onClose }) {
  const isMe = replyTo.sender_id === myId;
  const name = isMe ? "Vous" : `${contact?.prenom || ""}`;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "8px 14px",
      background: "rgba(99,102,241,0.1)",
      borderTop: "1px solid rgba(99,102,241,0.2)",
      borderLeft: "3px solid #6366f1",
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, color: "#a5b4fc", fontWeight: 700, marginBottom: 2 }}>
          ↩ Répondre à {name}
        </div>
        <div style={{
          fontSize: 12, color: "rgba(255,255,255,0.45)",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {replyTo.content}
        </div>
      </div>
      <button onClick={onClose} style={{
        background: "none", border: "none", color: "rgba(255,255,255,0.4)",
        cursor: "pointer", fontSize: 18, padding: "0 4px", flexShrink: 0,
        lineHeight: 1,
      }}>×</button>
    </div>
  );
}

// ── Quoted message (inside bubble) ───────────────────────────────────────────
function QuotedMsg({ rt, myId }) {
  const isMe = rt.sender_id === myId;
  return (
    <div style={{
      padding: "5px 9px", marginBottom: 6,
      background: "rgba(0,0,0,0.25)",
      borderLeft: `3px solid ${isMe ? "#6366f1" : "rgba(255,255,255,0.35)"}`,
      borderRadius: "0 6px 6px 0",
      fontSize: 11.5, color: "rgba(255,255,255,0.5)",
      maxWidth: "100%",
    }}>
      <div style={{ fontWeight: 700, color: isMe ? "#a5b4fc" : "rgba(255,255,255,0.6)", marginBottom: 2 }}>
        {isMe ? "Vous" : ""}
      </div>
      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {rt.content}
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
export default function MessagingPage({ user, onBack }) {
  const myId = user?.user_id ?? user?.id ?? "";

  const [contacts,     setContacts]     = useState([]);
  const [selContact,   setSelContact]   = useState(null);
  const [messages,     setMessages]     = useState([]);
  const [input,        setInput]        = useState("");
  const [search,       setSearch]       = useState("");
  const [sending,      setSending]      = useState(false);
  const [loadingMsgs,  setLoadingMsgs]  = useState(false);
  const [showList,     setShowList]     = useState(true);
  const [unreadAtOpen, setUnreadAtOpen] = useState(0);
  const [peerTyping,   setPeerTyping]   = useState(false);
  const [replyTo,      setReplyTo]      = useState(null);
  const [ctxMenu,      setCtxMenu]      = useState(null);

  const wsRef         = useRef(null);
  const bottomRef     = useRef(null);
  const firstUnreadRef= useRef(null);
  const inputRef      = useRef(null);
  const pingRef       = useRef(null);
  const selContactRef = useRef(null);
  const myTypingRef   = useRef(null);
  const peerTypingRef = useRef(null);

  useEffect(() => { selContactRef.current = selContact; }, [selContact]);

  // ── Notification permission ──────────────────────────────────────────────
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default")
      Notification.requestPermission();
  }, []);

  // ── WebSocket ────────────────────────────────────────────────────────────
  const connectWS = useCallback(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${proto}//${window.location.host}/api/messaging/ws?token=${token}`);

    ws.onopen = () => {
      pingRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN)
          ws.send(JSON.stringify({ type: "ping" }));
      }, 25000);
    };

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        const cur  = selContactRef.current;

        if (data.type === "new_message") {
          const msg = data.message;
          if (cur && (msg.sender_id === cur.id || msg.receiver_id === cur.id)) {
            setMessages(ms => [...ms, msg]);
            setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 60);
          }
          // Update contact last_message + unread badge
          setContacts(cs => {
            const updated = cs.map(c => {
              if (c.id !== msg.sender_id) return c;
              const preview = msg.content.substring(0, 60) + (msg.content.length > 60 ? "…" : "");
              return {
                ...c,
                unread:       cur?.id === c.id ? 0 : (c.unread || 0) + 1,
                last_message: { content: preview, created_at: msg.created_at, is_mine: false },
              };
            });
            return [...updated].sort((a, b) => {
              const ta = a.last_message?.created_at ?? "";
              const tb = b.last_message?.created_at ?? "";
              return tb.localeCompare(ta);
            });
          });
          // Browser notification
          if (data.sender && (!cur || cur.id !== data.sender.id)) {
            notifyBrowser(
              `${data.sender.prenom} ${data.sender.nom}`,
              msg.content.substring(0, 80)
            );
          }
        }

        if (data.type === "typing" && cur && data.from === cur.id) {
          setPeerTyping(true);
          clearTimeout(peerTypingRef.current);
          peerTypingRef.current = setTimeout(() => setPeerTyping(false), 3000);
        }

        if (data.type === "stop_typing" && cur && data.from === cur.id) {
          setPeerTyping(false);
          clearTimeout(peerTypingRef.current);
        }

        if (data.type === "read_receipt" && data.from === cur?.id) {
          setMessages(ms => ms.map(m =>
            m.sender_id === myId ? { ...m, is_read: true } : m
          ));
        }

        if (data.type === "message_deleted") {
          setMessages(ms => ms.map(m =>
            m.id === data.message_id
              ? { ...m, content: "Message supprimé", is_deleted: true }
              : m
          ));
        }
      } catch {}
    };

    ws.onclose = () => {
      clearInterval(pingRef.current);
      setTimeout(connectWS, 3000);
    };

    wsRef.current = ws;
  }, [myId]);

  useEffect(() => {
    loadContacts();
    connectWS();
    return () => { wsRef.current?.close(); clearInterval(pingRef.current); };
  }, [connectWS]);

  // ── Load contacts ────────────────────────────────────────────────────────
  const loadContacts = async () => {
    try {
      const { data } = await axios.get("/api/messaging/contacts", authHeaders());
      setContacts(data);
    } catch {}
  };

  // ── Open conversation ────────────────────────────────────────────────────
  const openConv = async (contact) => {
    const saved = contact.unread || 0;
    setUnreadAtOpen(saved);
    setSelContact(contact);
    setShowList(false);
    setLoadingMsgs(true);
    setMessages([]);
    setReplyTo(null);
    setPeerTyping(false);
    try {
      const { data } = await axios.get(`/api/messaging/conversations/${contact.id}`, authHeaders());
      setMessages(data);
      setContacts(cs => cs.map(c => c.id === contact.id ? { ...c, unread: 0 } : c));
      setTimeout(() => {
        if (saved > 0 && firstUnreadRef.current)
          firstUnreadRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
        else
          bottomRef.current?.scrollIntoView({ behavior: "auto" });
        inputRef.current?.focus();
      }, 80);
    } catch { setMessages([]); }
    finally { setLoadingMsgs(false); }
  };

  // ── Send ─────────────────────────────────────────────────────────────────
  const sendMsg = async () => {
    const content = input.trim();
    if (!content || !selContact || sending) return;
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    clearTimeout(myTypingRef.current);
    wsRef.current?.send(JSON.stringify({ type: "stop_typing", to: selContact.id }));
    setSending(true);
    try {
      const { data } = await axios.post("/api/messaging/send", {
        receiver_id: selContact.id,
        content,
        reply_to_id: replyTo?.id ?? null,
      }, authHeaders());
      setMessages(ms => [...ms, data]);
      setReplyTo(null);
      // Update contact last_message
      setContacts(cs => {
        const updated = cs.map(c =>
          c.id !== selContact.id ? c : {
            ...c,
            last_message: { content: content.substring(0, 60), created_at: data.created_at, is_mine: true },
          }
        );
        return [...updated].sort((a, b) => {
          const ta = a.last_message?.created_at ?? "";
          const tb = b.last_message?.created_at ?? "";
          return tb.localeCompare(ta);
        });
      });
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 60);
    } catch (err) { setInput(content); }
    finally { setSending(false); inputRef.current?.focus(); }
  };

  // ── Delete ───────────────────────────────────────────────────────────────
  const deleteMsg = async (msgId) => {
    try {
      await axios.delete(`/api/messaging/messages/${msgId}`, authHeaders());
      setMessages(ms => ms.map(m =>
        m.id === msgId ? { ...m, content: "Message supprimé", is_deleted: true } : m
      ));
    } catch {}
  };

  // ── Typing indicator ──────────────────────────────────────────────────────
  const handleInputChange = (e) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 130) + "px";
    if (selContact && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "typing", to: selContact.id }));
      clearTimeout(myTypingRef.current);
      myTypingRef.current = setTimeout(() => {
        wsRef.current?.send(JSON.stringify({ type: "stop_typing", to: selContact.id }));
      }, 2000);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMsg(); }
    if (e.key === "Escape") setReplyTo(null);
  };

  // ── Context menu ──────────────────────────────────────────────────────────
  const handleCtxMenu = (e, msg) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, msg });
  };

  // ── Compute first unread index ────────────────────────────────────────────
  let firstUnreadIdx = -1;
  if (unreadAtOpen > 0 && selContact && messages.length > 0) {
    const recv = messages.map((m, i) => m.sender_id === selContact.id ? i : -1).filter(i => i !== -1);
    if (recv.length > 0) firstUnreadIdx = recv[Math.max(0, recv.length - unreadAtOpen)];
  }

  const filtered = contacts.filter(c => {
    const q = search.toLowerCase();
    return (c.nom || "").toLowerCase().includes(q) ||
           (c.prenom || "").toLowerCase().includes(q) ||
           ROLE_LABEL(c.role).toLowerCase().includes(q);
  });

  const totalUnread = contacts.reduce((s, c) => s + (c.unread || 0), 0);
  const isMobile    = window.innerWidth < 700;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{
      height: "100vh", overflow: "hidden",
      background: "radial-gradient(ellipse at 20% 40%, #1a1040 0%, #0a0a1a 60%, #000 100%)",
      fontFamily: "Sora, sans-serif", display: "flex", flexDirection: "column",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
        .c-row:hover { background: rgba(255,255,255,0.05) !important; }
        .c-row.sel { background: rgba(99,102,241,0.14) !important; border-left-color: #6366f1 !important; }
        .msg-input:focus { border-color: rgba(99,102,241,0.5) !important; outline: none; }
        .icon-btn:hover { background: rgba(255,255,255,0.09) !important; }
        @keyframes typing {
          0%,80%,100% { opacity:.3; transform:scale(.7); }
          40%          { opacity:1; transform:scale(1);   }
        }
        @keyframes fadeSlide {
          from { opacity:0; transform:translateY(6px); }
          to   { opacity:1; transform:translateY(0);   }
        }
      `}</style>

      {/* Context menu */}
      {ctxMenu && (
        <CtxMenu
          ctx={ctxMenu} myId={myId}
          onReply={() => {
            setReplyTo({ id: ctxMenu.msg.id, content: ctxMenu.msg.content, sender_id: ctxMenu.msg.sender_id });
            setTimeout(() => inputRef.current?.focus(), 50);
          }}
          onCopy={() => navigator.clipboard?.writeText(ctxMenu.msg.content)}
          onDelete={() => deleteMsg(ctxMenu.msg.id)}
          onClose={() => setCtxMenu(null)}
        />
      )}

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div style={{
        padding: "11px 18px", flexShrink: 0,
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(255,255,255,0.02)",
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <button onClick={onBack} className="icon-btn" style={{
          background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 8, color: "rgba(255,255,255,0.65)", cursor: "pointer",
          padding: "5px 12px", fontFamily: "Sora,sans-serif", fontSize: 13,
        }}>← Retour</button>

        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: "rgba(99,102,241,0.18)", border: "1px solid rgba(99,102,241,0.28)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
          }}>💬</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>Messagerie</div>
            <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.35)" }}>Conversations privées</div>
          </div>
        </div>

        {totalUnread > 0 && (
          <div style={{
            marginLeft: "auto",
            background: "rgba(239,68,68,0.14)", color: "#f87171",
            fontSize: 11.5, padding: "3px 10px", borderRadius: 20, fontWeight: 700,
            border: "1px solid rgba(239,68,68,0.25)",
          }}>{totalUnread} non lu{totalUnread > 1 ? "s" : ""}</div>
        )}
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* ── Sidebar contacts ───────────────────────────────────────────── */}
        <div style={{
          width:    isMobile ? (showList ? "100%" : 0) : 300,
          minWidth: isMobile ? (showList ? "100%" : 0) : 300,
          borderRight: "1px solid rgba(255,255,255,0.06)",
          display: "flex", flexDirection: "column", overflow: "hidden", flexShrink: 0,
        }}>
          {/* Search */}
          <div style={{ padding: "12px 12px 8px", flexShrink: 0 }}>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="🔍  Rechercher…"
              style={{
                width: "100%", padding: "9px 14px",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.09)",
                borderRadius: 22, color: "#fff", fontSize: 12.5,
                fontFamily: "Sora,sans-serif", outline: "none",
                transition: "border-color .15s",
              }}
            />
          </div>

          {/* List */}
          <div style={{ flex: 1, overflowY: "auto", padding: "0 8px 8px" }}>
            {filtered.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 16px",
                color: "rgba(255,255,255,0.2)", fontSize: 12.5 }}>
                {search ? "Aucun résultat" : "Aucun contact"}
              </div>
            ) : filtered.map(c => (
              <div key={c.id}
                className={`c-row${selContact?.id === c.id ? " sel" : ""}`}
                onClick={() => openConv(c)}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 10px", borderRadius: 11, cursor: "pointer",
                  borderLeft: "2px solid transparent",
                  marginBottom: 2, transition: "background .12s",
                }}
              >
                {/* Avatar + online dot */}
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <Avatar nom={c.nom} prenom={c.prenom} role={c.role} />
                  {c.online && (
                    <div style={{
                      position: "absolute", bottom: 0, right: 0,
                      width: 10, height: 10, borderRadius: "50%",
                      background: "#22c55e", border: "2px solid #0a0a1a",
                    }} />
                  )}
                </div>

                {/* Name + last message */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.prenom} {c.nom}
                    </span>
                    {c.last_message && (
                      <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.3)", flexShrink: 0 }}>
                        {fmtTime(c.last_message.created_at)}
                      </span>
                    )}
                  </div>
                  {c.last_message ? (
                    <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.38)", marginTop: 2,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.last_message.is_mine && <span style={{ color: "rgba(255,255,255,0.25)" }}>Vous : </span>}
                      {c.last_message.content}
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: ROLE_COLOR(c.role), fontWeight: 500, marginTop: 2 }}>
                      {ROLE_LABEL(c.role)}
                    </div>
                  )}
                </div>

                {/* Unread badge */}
                {c.unread > 0 && (
                  <div style={{
                    background: "#6366f1", color: "#fff", fontSize: 11, fontWeight: 700,
                    minWidth: 20, height: 20, borderRadius: 10, flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px",
                  }}>{c.unread}</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Chat panel ─────────────────────────────────────────────────── */}
        {(!isMobile || !showList) && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>

            {!selContact ? (
              <div style={{ flex: 1, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                color: "rgba(255,255,255,0.15)", gap: 14 }}>
                <div style={{ fontSize: 60, filter: "opacity(0.2)" }}>💬</div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>Sélectionnez un contact</div>
              </div>
            ) : (
              <>
                {/* Chat header */}
                <div style={{
                  padding: "10px 16px", flexShrink: 0,
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                  display: "flex", alignItems: "center", gap: 11,
                  background: "rgba(255,255,255,0.015)",
                }}>
                  {isMobile && (
                    <button className="icon-btn" onClick={() => setShowList(true)} style={{
                      background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 8, color: "#fff", cursor: "pointer",
                      padding: "5px 10px", fontFamily: "Sora,sans-serif", fontSize: 12,
                    }}>←</button>
                  )}
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <Avatar nom={selContact.nom} prenom={selContact.prenom} role={selContact.role} size={38} />
                    {selContact.online && (
                      <div style={{
                        position: "absolute", bottom: 0, right: 0,
                        width: 10, height: 10, borderRadius: "50%",
                        background: "#22c55e", border: "2px solid #0a0a1a",
                      }} />
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>
                      {selContact.prenom} {selContact.nom}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 500, marginTop: 1,
                      color: selContact.online ? "#4ade80" : "rgba(255,255,255,0.3)" }}>
                      {peerTyping ? (
                        <span style={{ color: "#a5b4fc", display: "flex", alignItems: "center", gap: 5 }}>
                          <TypingDots /> en train d'écrire…
                        </span>
                      ) : (
                        selContact.online ? "En ligne" : ROLE_LABEL(selContact.role)
                      )}
                    </div>
                  </div>
                </div>

                {/* Messages */}
                <div style={{
                  flex: 1, overflowY: "auto",
                  padding: "14px 14px 6px",
                  display: "flex", flexDirection: "column",
                  background: "rgba(0,0,0,0.18)",
                }}>
                  {loadingMsgs ? (
                    <div style={{ textAlign: "center", paddingTop: 50,
                      color: "rgba(255,255,255,0.25)", fontSize: 13 }}>Chargement…</div>
                  ) : messages.length === 0 ? (
                    <div style={{ flex: 1, display: "flex", flexDirection: "column",
                      alignItems: "center", justifyContent: "center",
                      color: "rgba(255,255,255,0.18)", gap: 10 }}>
                      <div style={{ fontSize: 42, filter: "opacity(0.25)" }}>💬</div>
                      <div style={{ fontSize: 13 }}>Commencez la conversation !</div>
                    </div>
                  ) : (
                    messages.map((m, i) => {
                      const isMine = m.sender_id === myId;
                      const showDate = i === 0 ||
                        new Date(m.created_at).toDateString() !==
                        new Date(messages[i - 1].created_at).toDateString();
                      const isFirstUnread = i === firstUnreadIdx;
                      const prev = messages[i - 1];
                      const grouped = !showDate && !isFirstUnread &&
                        prev?.sender_id === m.sender_id &&
                        (new Date(m.created_at) - new Date(prev.created_at)) < 3 * 60 * 1000;

                      return (
                        <div key={m.id} style={{ animation: "fadeSlide .2s ease" }}>

                          {/* Date separator */}
                          {showDate && (
                            <div style={{ textAlign: "center", margin: "12px 0 8px" }}>
                              <span style={{
                                fontSize: 11, color: "rgba(255,255,255,0.32)",
                                background: "rgba(255,255,255,0.05)",
                                padding: "3px 14px", borderRadius: 14,
                              }}>{fmtDateLabel(m.created_at)}</span>
                            </div>
                          )}

                          {/* Unread separator */}
                          {isFirstUnread && (
                            <div ref={firstUnreadRef} style={{
                              display: "flex", alignItems: "center", gap: 10,
                              margin: "10px 0 8px",
                            }}>
                              <div style={{ flex: 1, height: 1, background: "linear-gradient(to right,transparent,rgba(99,102,241,.5))" }} />
                              <span style={{
                                fontSize: 11, color: "#a5b4fc", fontWeight: 600,
                                background: "rgba(99,102,241,0.13)",
                                padding: "3px 12px", borderRadius: 14, whiteSpace: "nowrap",
                                border: "1px solid rgba(99,102,241,0.28)",
                              }}>
                                {unreadAtOpen} nouveau{unreadAtOpen > 1 ? "x" : ""} message{unreadAtOpen > 1 ? "s" : ""}
                              </span>
                              <div style={{ flex: 1, height: 1, background: "linear-gradient(to left,transparent,rgba(99,102,241,.5))" }} />
                            </div>
                          )}

                          {/* Bubble row */}
                          <div
                            onContextMenu={e => !m.is_deleted && handleCtxMenu(e, m)}
                            style={{
                              display: "flex",
                              flexDirection: isMine ? "row-reverse" : "row",
                              alignItems: "flex-end", gap: 7,
                              marginTop: grouped ? 2 : 10,
                              paddingLeft:  isMine ? "16%" : 0,
                              paddingRight: isMine ? 0 : "16%",
                            }}
                          >
                            {!isMine && (
                              grouped
                                ? <div style={{ width: 28, flexShrink: 0 }} />
                                : <Avatar nom={selContact.nom} prenom={selContact.prenom} role={selContact.role} size={28} />
                            )}

                            <div style={{ display: "flex", flexDirection: "column",
                              alignItems: isMine ? "flex-end" : "flex-start", maxWidth: "100%" }}>

                              {!isMine && !grouped && (
                                <div style={{ fontSize: 10.5, color: ROLE_COLOR(selContact.role),
                                  fontWeight: 600, marginBottom: 3, paddingLeft: 3 }}>
                                  {selContact.prenom}
                                </div>
                              )}

                              <div style={{
                                padding: m.is_deleted ? "8px 12px" : "9px 13px",
                                borderRadius: isMine
                                  ? (grouped ? "16px 4px 4px 16px" : "18px 18px 4px 18px")
                                  : (grouped ? "4px 16px 16px 4px" : "18px 18px 18px 4px"),
                                background: m.is_deleted
                                  ? "rgba(255,255,255,0.04)"
                                  : isMine
                                    ? "linear-gradient(135deg,#6366f1,#8b5cf6)"
                                    : "rgba(255,255,255,0.09)",
                                border: (m.is_deleted || !isMine) ? "1px solid rgba(255,255,255,0.09)" : "none",
                                fontSize: m.is_deleted ? 12 : 13.5,
                                color: m.is_deleted ? "rgba(255,255,255,0.35)" : "#fff",
                                fontStyle: m.is_deleted ? "italic" : "normal",
                                lineHeight: 1.55, wordBreak: "break-word",
                                boxShadow: (!m.is_deleted && isMine) ? "0 2px 10px rgba(99,102,241,.35)" : "none",
                                cursor: m.is_deleted ? "default" : "context-menu",
                                maxWidth: "100%",
                              }}>
                                {/* Quoted message */}
                                {m.reply_to && !m.is_deleted && (
                                  <QuotedMsg rt={m.reply_to} myId={myId} />
                                )}
                                {m.content}
                              </div>

                              {/* Time + read receipt */}
                              <div style={{
                                display: "flex", alignItems: "center", gap: 4,
                                marginTop: 3, fontSize: 10.5, color: "rgba(255,255,255,0.28)",
                                paddingLeft: isMine ? 0 : 3, paddingRight: isMine ? 3 : 0,
                              }}>
                                {fmtTime(m.created_at)}
                                {isMine && !m.is_deleted && (
                                  <span style={{ fontWeight: 700,
                                    color: m.is_read ? "#818cf8" : "rgba(255,255,255,0.3)" }}>
                                    {m.is_read ? "✓✓" : "✓"}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}

                  {/* Typing indicator inside chat */}
                  {peerTyping && !loadingMsgs && (
                    <div style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "8px 0 4px 36px",
                      animation: "fadeSlide .2s ease",
                    }}>
                      <div style={{
                        background: "rgba(255,255,255,0.09)",
                        border: "1px solid rgba(255,255,255,0.09)",
                        borderRadius: "18px 18px 18px 4px",
                        padding: "10px 14px",
                        display: "flex", alignItems: "center", gap: 5,
                      }}>
                        <TypingDots />
                      </div>
                    </div>
                  )}

                  <div ref={bottomRef} style={{ height: 6 }} />
                </div>

                {/* Reply bar */}
                {replyTo && (
                  <ReplyBar
                    replyTo={replyTo} myId={myId} contact={selContact}
                    onClose={() => setReplyTo(null)}
                  />
                )}

                {/* Input bar */}
                <div style={{
                  padding: "10px 12px", flexShrink: 0,
                  borderTop: "1px solid rgba(255,255,255,0.06)",
                  background: "rgba(255,255,255,0.02)",
                  display: "flex", alignItems: "flex-end", gap: 9,
                }}>
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Écrire un message…"
                    rows={1}
                    className="msg-input"
                    style={{
                      flex: 1, padding: "10px 16px", resize: "none",
                      background: "rgba(255,255,255,0.07)",
                      border: "1px solid rgba(255,255,255,0.11)",
                      borderRadius: 24, color: "#fff", fontSize: 13.5,
                      fontFamily: "Sora,sans-serif", lineHeight: 1.5,
                      overflowY: "hidden", minHeight: 42, maxHeight: 130,
                      transition: "border-color .15s",
                    }}
                  />
                  <button
                    onClick={sendMsg}
                    disabled={!input.trim() || sending}
                    style={{
                      width: 42, height: 42, flexShrink: 0, borderRadius: "50%",
                      background: input.trim()
                        ? "linear-gradient(135deg,#6366f1,#8b5cf6)"
                        : "rgba(255,255,255,0.07)",
                      border: "none", cursor: input.trim() ? "pointer" : "not-allowed",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 17, color: "#fff",
                      transition: "background .15s, transform .1s",
                      boxShadow: input.trim() ? "0 2px 10px rgba(99,102,241,.4)" : "none",
                      opacity: sending ? 0.5 : 1,
                    }}
                    onMouseEnter={e => input.trim() && (e.currentTarget.style.transform = "scale(1.08)")}
                    onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
                  >
                    {sending ? "·" : "➤"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
