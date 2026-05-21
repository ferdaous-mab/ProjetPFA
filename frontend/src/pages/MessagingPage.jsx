import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";

function authHeaders() {
  const token = localStorage.getItem("token");
  return { headers: { Authorization: `Bearer ${token}` } };
}

function roleLabel(role) {
  if (role === "professeur") return "Professeur";
  if (role === "admin")      return "Administrateur";
  return "Étudiant";
}

function roleColor(role) {
  if (role === "professeur") return "#0ea5e9";
  if (role === "admin")      return "#f59e0b";
  return "#a78bfa";
}

function Avatar({ nom, prenom, role, size = 36 }) {
  const initials = `${(prenom || "?")[0]}${(nom || "?")[0]}`.toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: `${roleColor(role)}25`,
      border: `1.5px solid ${roleColor(role)}50`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.36, fontWeight: 700, color: roleColor(role),
    }}>{initials}</div>
  );
}

function formatTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

function formatDateLabel(iso) {
  const d = new Date(iso);
  const now = new Date();
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString())       return "Aujourd'hui";
  if (d.toDateString() === yesterday.toDateString()) return "Hier";
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

export default function MessagingPage({ user, onBack }) {
  const [contacts,        setContacts]        = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [messages,        setMessages]        = useState([]);
  const [input,           setInput]           = useState("");
  const [search,          setSearch]          = useState("");
  const [sending,         setSending]         = useState(false);
  const [loadingMsgs,     setLoadingMsgs]     = useState(false);
  const [showContacts,    setShowContacts]    = useState(true);
  const [unreadAtOpen,    setUnreadAtOpen]    = useState(0);

  const wsRef              = useRef(null);
  const bottomRef          = useRef(null);
  const firstUnreadRef     = useRef(null);
  const inputRef           = useRef(null);
  const pingRef            = useRef(null);
  const selectedContactRef = useRef(null);
  const textareaRef        = useRef(null);

  useEffect(() => { selectedContactRef.current = selectedContact; }, [selectedContact]);

  // ── WebSocket ───────────────────────────────────────────────────────────────
  const connectWS = useCallback(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${proto}//${window.location.host}/api/messaging/ws?token=${token}`);

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === "new_message") {
          const msg = data.message;
          const cur = selectedContactRef.current;
          if (cur && (msg.sender_id === cur.id || msg.receiver_id === cur.id)) {
            setMessages(ms => [...ms, msg]);
            // Scroll to bottom on new incoming message
            setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 60);
          }
          setContacts(cs => cs.map(c =>
            c.id === msg.sender_id ? { ...c, unread: (c.unread || 0) + 1 } : c
          ));
        }
      } catch {}
    };

    ws.onclose = () => { clearInterval(pingRef.current); setTimeout(connectWS, 3000); };
    ws.onopen  = () => {
      pingRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "ping" }));
      }, 25000);
    };
    wsRef.current = ws;
  }, []);

  useEffect(() => {
    loadContacts();
    connectWS();
    return () => { wsRef.current?.close(); clearInterval(pingRef.current); };
  }, [connectWS]);

  // ── Contacts ────────────────────────────────────────────────────────────────
  const loadContacts = async () => {
    try {
      const { data } = await axios.get("/api/messaging/contacts", authHeaders());
      setContacts(data);
    } catch {}
  };

  // ── Open conversation ───────────────────────────────────────────────────────
  const openConversation = async (contact) => {
    const savedUnread = contact.unread || 0;
    setUnreadAtOpen(savedUnread);
    setSelectedContact(contact);
    setShowContacts(false);
    setLoadingMsgs(true);
    setMessages([]);
    try {
      const { data } = await axios.get(`/api/messaging/conversations/${contact.id}`, authHeaders());
      setMessages(data);
      setContacts(cs => cs.map(c => c.id === contact.id ? { ...c, unread: 0 } : c));

      // Scroll to first unread or bottom after render
      setTimeout(() => {
        if (savedUnread > 0 && firstUnreadRef.current) {
          firstUnreadRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
        } else {
          bottomRef.current?.scrollIntoView({ behavior: "auto" });
        }
        inputRef.current?.focus();
      }, 80);
    } catch {
      setMessages([]);
    } finally {
      setLoadingMsgs(false);
    }
  };

  // ── Send ────────────────────────────────────────────────────────────────────
  const sendMessage = async () => {
    const content = input.trim();
    if (!content || !selectedContact || sending) return;
    setInput("");
    if (textareaRef.current) { textareaRef.current.style.height = "auto"; }
    setSending(true);
    try {
      const { data } = await axios.post("/api/messaging/send",
        { receiver_id: selectedContact.id, content }, authHeaders()
      );
      setMessages(ms => [...ms, data]);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 60);
    } catch { setInput(content); }
    finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 130) + "px";
  };

  // ── Compute first unread index ──────────────────────────────────────────────
  let firstUnreadIdx = -1;
  if (unreadAtOpen > 0 && selectedContact && messages.length > 0) {
    const received = messages
      .map((m, i) => (m.sender_id === selectedContact.id ? i : -1))
      .filter(i => i !== -1);
    if (received.length > 0) {
      const startIdx = Math.max(0, received.length - unreadAtOpen);
      firstUnreadIdx = received[startIdx];
    }
  }

  // ── Filter ──────────────────────────────────────────────────────────────────
  const filteredContacts = contacts.filter(c => {
    const q = search.toLowerCase();
    return (
      (c.nom    || "").toLowerCase().includes(q) ||
      (c.prenom || "").toLowerCase().includes(q) ||
      roleLabel(c.role).toLowerCase().includes(q)
    );
  });

  const totalUnread = contacts.reduce((s, c) => s + (c.unread || 0), 0);
  const isMobile    = window.innerWidth < 700;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{
      height: "100vh", overflow: "hidden",
      background: "radial-gradient(ellipse at 20% 40%, #1e1b4b 0%, #0f0f1e 60%, #000 100%)",
      fontFamily: "Sora, sans-serif", display: "flex", flexDirection: "column",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 5px; }
        .contact-row { transition: background 0.12s; }
        .contact-row:hover { background: rgba(255,255,255,0.055) !important; }
        .contact-row.active { background: rgba(99,102,241,0.14) !important; border-left-color: #6366f1 !important; }
        .msg-input { transition: border-color 0.15s; }
        .msg-input:focus { border-color: rgba(99,102,241,0.55) !important; outline: none; }
        .send-btn:hover:not(:disabled) { transform: scale(1.06); }
        .send-btn { transition: transform 0.12s, opacity 0.12s; }
        .send-btn:disabled { opacity: 0.35; cursor: not-allowed; }
        .back-btn:hover { background: rgba(255,255,255,0.08) !important; }
        .search-input:focus { border-color: rgba(99,102,241,0.4) !important; outline: none; }
      `}</style>

      {/* ── Global header ──────────────────────────────────────────────────────── */}
      <div style={{
        padding: "11px 18px", flexShrink: 0,
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(255,255,255,0.02)", backdropFilter: "blur(14px)",
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <button className="back-btn" onClick={onBack} style={{
          background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 8, color: "rgba(255,255,255,0.65)", cursor: "pointer",
          padding: "5px 12px", fontFamily: "Sora, sans-serif", fontSize: 13,
        }}>← Retour</button>

        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{
            width: 31, height: 31, borderRadius: 8,
            background: "rgba(99,102,241,0.18)", border: "1px solid rgba(99,102,241,0.28)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15,
          }}>💬</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>Messagerie</div>
            <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.38)" }}>Conversations privées</div>
          </div>
        </div>

        {totalUnread > 0 && (
          <div style={{
            marginLeft: "auto", background: "rgba(239,68,68,0.14)", color: "#f87171",
            fontSize: 11.5, padding: "3px 10px", borderRadius: 20, fontWeight: 700,
            border: "1px solid rgba(239,68,68,0.25)",
          }}>
            {totalUnread} non lu{totalUnread > 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* ── Contact sidebar ──────────────────────────────────────────────────── */}
        <div style={{
          width:    isMobile ? (showContacts ? "100%" : 0) : 285,
          minWidth: isMobile ? (showContacts ? "100%" : 0) : 285,
          borderRight: "1px solid rgba(255,255,255,0.06)",
          display: "flex", flexDirection: "column", overflow: "hidden", flexShrink: 0,
        }}>
          {/* Search */}
          <div style={{ padding: "12px 12px 8px", flexShrink: 0 }}>
            <input
              className="search-input"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="🔍  Rechercher un contact..."
              style={{
                width: "100%", padding: "9px 13px",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.09)",
                borderRadius: 22, color: "#fff", fontSize: 12.5,
                fontFamily: "Sora, sans-serif",
              }}
            />
          </div>

          {/* List */}
          <div style={{ flex: 1, overflowY: "auto", padding: "0 8px 8px" }}>
            {filteredContacts.length === 0 ? (
              <div style={{ textAlign: "center", padding: "44px 16px",
                color: "rgba(255,255,255,0.22)", fontSize: 12.5 }}>
                {search ? "Aucun résultat" : "Aucun contact disponible"}
              </div>
            ) : (
              filteredContacts.map(c => (
                <div
                  key={c.id}
                  className={`contact-row${selectedContact?.id === c.id ? " active" : ""}`}
                  onClick={() => openConversation(c)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "9px 10px", borderRadius: 11, cursor: "pointer",
                    borderLeft: "2px solid transparent", marginBottom: 2,
                  }}
                >
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <Avatar nom={c.nom} prenom={c.prenom} role={c.role} />
                    {c.online && (
                      <div style={{
                        position: "absolute", bottom: 0, right: 0,
                        width: 10, height: 10, borderRadius: "50%",
                        background: "#22c55e", border: "2px solid #0c0c1e",
                      }} />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0",
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {c.prenom} {c.nom}
                    </div>
                    <div style={{ fontSize: 11, color: roleColor(c.role), fontWeight: 500, marginTop: 1 }}>
                      {roleLabel(c.role)}
                    </div>
                  </div>
                  {c.unread > 0 && (
                    <div style={{
                      background: "#6366f1", color: "#fff", fontSize: 11, fontWeight: 700,
                      minWidth: 20, height: 20, borderRadius: 10, flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px",
                    }}>{c.unread}</div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Chat panel ───────────────────────────────────────────────────────── */}
        {(!isMobile || !showContacts) && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>

            {!selectedContact ? (
              /* Placeholder when no conversation selected */
              <div style={{
                flex: 1, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                color: "rgba(255,255,255,0.18)", gap: 14, userSelect: "none",
              }}>
                <div style={{ fontSize: 56, filter: "opacity(0.25)" }}>💬</div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>Sélectionnez un contact pour commencer</div>
              </div>

            ) : (
              <>
                {/* Chat header */}
                <div style={{
                  padding: "10px 16px", flexShrink: 0,
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                  display: "flex", alignItems: "center", gap: 11,
                  background: "rgba(255,255,255,0.02)",
                }}>
                  {isMobile && (
                    <button className="back-btn" onClick={() => setShowContacts(true)} style={{
                      background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 8, color: "rgba(255,255,255,0.65)", cursor: "pointer",
                      padding: "5px 10px", fontFamily: "Sora, sans-serif", fontSize: 12,
                    }}>←</button>
                  )}
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <Avatar nom={selectedContact.nom} prenom={selectedContact.prenom} role={selectedContact.role} size={38} />
                    {selectedContact.online && (
                      <div style={{
                        position: "absolute", bottom: 0, right: 0,
                        width: 10, height: 10, borderRadius: "50%",
                        background: "#22c55e", border: "2px solid #0c0c1e",
                      }} />
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>
                      {selectedContact.prenom} {selectedContact.nom}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 500, marginTop: 1,
                      color: selectedContact.online ? "#4ade80" : "rgba(255,255,255,0.32)" }}>
                      {selectedContact.online ? "En ligne" : roleLabel(selectedContact.role)}
                    </div>
                  </div>
                </div>

                {/* Messages area */}
                <div style={{
                  flex: 1, overflowY: "auto", padding: "14px 14px 6px",
                  display: "flex", flexDirection: "column",
                  background: "rgba(0,0,0,0.12)",
                }}>
                  {loadingMsgs ? (
                    <div style={{ textAlign: "center", paddingTop: 44,
                      color: "rgba(255,255,255,0.28)", fontSize: 13 }}>Chargement…</div>
                  ) : messages.length === 0 ? (
                    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                      flexDirection: "column", gap: 10, color: "rgba(255,255,255,0.2)", paddingBottom: 40 }}>
                      <div style={{ fontSize: 36, filter: "opacity(0.3)" }}>💬</div>
                      <div style={{ fontSize: 13 }}>Aucun message — commencez la conversation !</div>
                    </div>
                  ) : (
                    messages.map((m, i) => {
                      const isMine = m.sender_id === (user?.user_id ?? user?.id);

                      // Date separator
                      const showDate = i === 0 ||
                        new Date(m.created_at).toDateString() !==
                        new Date(messages[i - 1].created_at).toDateString();

                      // Group consecutive messages from same sender (< 3 min apart, no date break)
                      const prev = messages[i - 1];
                      const isGrouped = !showDate &&
                        prev?.sender_id === m.sender_id && i !== firstUnreadIdx &&
                        (new Date(m.created_at) - new Date(prev.created_at)) < 3 * 60 * 1000;

                      // Is this the first unread message?
                      const isFirstUnread = i === firstUnreadIdx;

                      return (
                        <div key={m.id} style={{ display: "flex", flexDirection: "column" }}>

                          {/* Date separator */}
                          {showDate && (
                            <div style={{ textAlign: "center", margin: "14px 0 10px" }}>
                              <span style={{
                                fontSize: 11, color: "rgba(255,255,255,0.35)",
                                background: "rgba(255,255,255,0.06)",
                                padding: "3px 14px", borderRadius: 14,
                                border: "1px solid rgba(255,255,255,0.07)",
                              }}>
                                {formatDateLabel(m.created_at)}
                              </span>
                            </div>
                          )}

                          {/* Unread separator */}
                          {isFirstUnread && (
                            <div ref={firstUnreadRef} style={{
                              display: "flex", alignItems: "center", gap: 10,
                              margin: "10px 0 8px",
                            }}>
                              <div style={{ flex: 1, height: 1, background: "linear-gradient(to right, transparent, rgba(99,102,241,0.5))" }} />
                              <span style={{
                                fontSize: 11, fontWeight: 600, color: "#a5b4fc",
                                background: "rgba(99,102,241,0.13)",
                                padding: "3px 12px", borderRadius: 14, whiteSpace: "nowrap",
                                border: "1px solid rgba(99,102,241,0.28)",
                              }}>
                                {unreadAtOpen} nouveau{unreadAtOpen > 1 ? "x" : ""} message{unreadAtOpen > 1 ? "s" : ""}
                              </span>
                              <div style={{ flex: 1, height: 1, background: "linear-gradient(to left, transparent, rgba(99,102,241,0.5))" }} />
                            </div>
                          )}

                          {/* Bubble row */}
                          <div style={{
                            display: "flex",
                            flexDirection: isMine ? "row-reverse" : "row",
                            alignItems: "flex-end",
                            gap: 7,
                            marginTop: isGrouped ? 2 : (showDate || isFirstUnread ? 0 : 10),
                            paddingLeft: isMine ? "18%" : 0,
                            paddingRight: isMine ? 0 : "18%",
                          }}>
                            {/* Avatar (receiver only, first in group) */}
                            {!isMine && (
                              isGrouped
                                ? <div style={{ width: 28, flexShrink: 0 }} />
                                : <div style={{ flexShrink: 0 }}>
                                    <Avatar nom={selectedContact.nom} prenom={selectedContact.prenom} role={selectedContact.role} size={28} />
                                  </div>
                            )}

                            {/* Bubble + meta */}
                            <div style={{
                              display: "flex", flexDirection: "column",
                              alignItems: isMine ? "flex-end" : "flex-start",
                              maxWidth: "100%",
                            }}>
                              {/* Sender name for received, first of group */}
                              {!isMine && !isGrouped && (
                                <div style={{
                                  fontSize: 10.5, color: roleColor(selectedContact.role),
                                  fontWeight: 600, marginBottom: 3, paddingLeft: 3,
                                }}>
                                  {selectedContact.prenom} {selectedContact.nom}
                                </div>
                              )}

                              {/* Text bubble */}
                              <div style={{
                                padding: "9px 13px",
                                borderRadius: isMine
                                  ? (isGrouped ? "16px 4px 4px 16px" : "18px 18px 4px 18px")
                                  : (isGrouped ? "4px 16px 16px 4px" : "18px 18px 18px 4px"),
                                background: isMine
                                  ? "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)"
                                  : "rgba(255,255,255,0.09)",
                                border: isMine
                                  ? "none"
                                  : "1px solid rgba(255,255,255,0.11)",
                                fontSize: 13.5, color: "#fff",
                                lineHeight: 1.55, wordBreak: "break-word",
                                boxShadow: isMine
                                  ? "0 2px 10px rgba(99,102,241,0.35)"
                                  : "0 1px 4px rgba(0,0,0,0.25)",
                              }}>
                                {m.content}
                              </div>

                              {/* Timestamp + read receipt */}
                              <div style={{
                                display: "flex", alignItems: "center", gap: 4,
                                marginTop: 3, fontSize: 10.5,
                                color: "rgba(255,255,255,0.32)",
                                paddingLeft: isMine ? 0 : 3,
                                paddingRight: isMine ? 3 : 0,
                              }}>
                                <span>{formatTime(m.created_at)}</span>
                                {isMine && (
                                  <span style={{
                                    fontWeight: 700,
                                    color: m.is_read ? "#818cf8" : "rgba(255,255,255,0.32)",
                                  }}>
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

                  {/* Scroll anchors */}
                  <div ref={bottomRef} style={{ height: 8 }} />
                </div>

                {/* ── Input bar ──────────────────────────────────────────────── */}
                <div style={{
                  padding: "10px 12px", flexShrink: 0,
                  borderTop: "1px solid rgba(255,255,255,0.06)",
                  background: "rgba(255,255,255,0.025)",
                  display: "flex", alignItems: "flex-end", gap: 9,
                }}>
                  <textarea
                    ref={el => { inputRef.current = el; textareaRef.current = el; }}
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
                      fontFamily: "Sora, sans-serif", lineHeight: 1.5,
                      overflowY: "hidden", minHeight: 42, maxHeight: 130,
                    }}
                  />
                  <button
                    className="send-btn"
                    onClick={sendMessage}
                    disabled={!input.trim() || sending}
                    style={{
                      width: 42, height: 42, flexShrink: 0, borderRadius: "50%",
                      background: input.trim()
                        ? "linear-gradient(135deg, #6366f1, #8b5cf6)"
                        : "rgba(255,255,255,0.08)",
                      border: "none", cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 17, color: "#fff",
                      boxShadow: input.trim() ? "0 2px 10px rgba(99,102,241,0.4)" : "none",
                    }}
                  >
                    {sending ? "•" : "➤"}
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
