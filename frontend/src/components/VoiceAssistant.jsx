import { useState, useRef } from "react";
import axios from "axios";

const API_URL = "";

function getToken() {
  return localStorage.getItem("token");
}

const DEFAULT_SUGGESTIONS = [
  "Taux de présence global ?",
  "Étudiants à risque ?",
  "Combien d'alertes ?",
  "Résumé de la plateforme",
  "Combien d'étudiants ?",
  "Moyenne générale ?",
];

const ACTION_LABELS = {
  create_professor:    { title: "Création de compte professeur", icon: "👨‍🏫", warning: false },
  create_matiere:      { title: "Création d'une matière",         icon: "📚",  warning: false },
  deactivate_professor:{ title: "Désactivation d'un compte",      icon: "🔒",  warning: true  },
};

const ACTION_REQUIRED = {
  create_professor: ["prenom", "nom", "email"],
  create_matiere:   ["nom", "classe", "coefficient"],
};

const PARAM_LABELS = {
  nom: "Nom", prenom: "Prénom", email: "Email",
  classe: "Classe", coefficient: "Coefficient",
};

const INCOMPLETE_HINTS = {
  create_professor:    "Création de compte professeur en cours...",
  create_matiere:      "Création de matière en cours...",
  deactivate_professor:"Désactivation en cours...",
};


export default function VoiceAssistant({
  onClose,
  chatEndpoint = "/api/voice/chat",
  suggestions  = DEFAULT_SUGGESTIONS,
}) {
  const [status,            setStatus]            = useState("idle");
  const [messages,          setMessages]          = useState([{
    role: "assistant",
    text: "Bonjour ! Je suis votre assistant SmartCampus. Posez-moi une question ou donnez-moi un ordre — je peux aussi exécuter des actions pour vous !"
  }]);
  const [inputText,         setInputText]         = useState("");
  const [error,             setError]             = useState("");
  const [pendingIncomplete, setPendingIncomplete] = useState(null);
  const [liveTranscript,    setLiveTranscript]    = useState("");
  const [isSpeaking,        setIsSpeaking]        = useState(false);

  const recognition     = useRef(null);
  const mediaRecorder   = useRef(null);
  const audioChunks     = useRef([]);
  const messagesEnd     = useRef(null);
  const usingFallback   = useRef(false);
  const accumulatedText = useRef("");
  const userStopped     = useRef(false);
  const statusRef       = useRef("idle");

  // Met à jour le state React ET la ref synchrone en une seule fois
  const setS = (s) => { statusRef.current = s; setStatus(s); };

  const scrollToBottom = () => {
    setTimeout(() => messagesEnd.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const addMessage = (role, text) => {
    setMessages(prev => [...prev, { role, text }]);
    scrollToBottom();
  };

  // ── TTS ──────────────────────────────────────────────────────────────────────
  const stopSpeaking = () => {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  const speakText = (text) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(true);

    const doSpeak = () => {
      const utter   = new SpeechSynthesisUtterance(text);
      utter.lang    = "fr-FR";
      utter.rate    = 0.9;
      utter.pitch   = 1.0;
      utter.volume  = 1.0;
      utter.onend   = () => setIsSpeaking(false);
      utter.onerror = () => setIsSpeaking(false);

      const voices = window.speechSynthesis.getVoices();
      const PREFERRED = ["thomas", "amélie", "amelie", "marie", "nicolas", "julie"];
      const best =
        voices.find(v => v.lang === "fr-FR" && v.localService && PREFERRED.some(n => v.name.toLowerCase().includes(n))) ||
        voices.find(v => v.lang === "fr-FR" && v.localService) ||
        voices.find(v => v.lang === "fr-FR") ||
        voices.find(v => v.lang === "fr-CA") ||
        voices.find(v => v.lang.startsWith("fr"));
      if (best) utter.voice = best;
      window.speechSynthesis.speak(utter);
    };

    if (window.speechSynthesis.getVoices().length > 0) doSpeak();
    else window.speechSynthesis.onvoiceschanged = doSpeak;
  };

  // ── AssemblyAI fallback ──────────────────────────────────────────────────────
  const startAssemblyAI = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl:  true,  // le navigateur calibre le gain automatiquement
        }
      });

      const mimeType =
        MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" :
        MediaRecorder.isTypeSupported("audio/webm")             ? "audio/webm" :
        MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")  ? "audio/ogg;codecs=opus" :
                                                                   "audio/ogg";

      audioChunks.current   = [];
      mediaRecorder.current = new MediaRecorder(stream, { mimeType });

      mediaRecorder.current.ondataavailable = e => {
        if (e.data.size > 0) audioChunks.current.push(e.data);
      };
      mediaRecorder.current.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        if (audioChunks.current.length === 0) {
          setError("Aucun audio capturé — réessayez");
          setS("idle");
          return;
        }
        const realMime = mediaRecorder.current.mimeType || mimeType;
        const blob = new Blob(audioChunks.current, { type: realMime });
        if (blob.size < 2000) {
          setError("Enregistrement trop court — attendez le micro 🔴 avant de parler");
          setS("idle");
          return;
        }
        await transcribeWithAssemblyAI(blob);
      };

      mediaRecorder.current.start(100);
      setLiveTranscript(""); // micro prêt
    } catch (e) {
      setError("Microphone inaccessible — " + (e.message || "vérifiez les permissions"));
      setS("idle");
    }
  };

  const stopAssemblyAI = () => {
    if (mediaRecorder.current && mediaRecorder.current.state === "recording") {
      mediaRecorder.current.stop();
      setS("processing");
    }
  };

  const transcribeWithAssemblyAI = async (blob) => {
    try {
      const form = new FormData();
      form.append("audio", blob, blob.type.includes("ogg") ? "voice.ogg" : "voice.webm");
      const res = await axios.post(`${API_URL}/api/voice/transcribe`, form, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      const { text, error: apiError } = res.data || {};
      if (apiError) { setError("Erreur transcription : " + apiError); setS("idle"); return; }
      if (!text)    { setError("Aucune voix détectée — parlez plus fort"); setS("idle"); return; }
      addMessage("user", text);
      await sendToChat(text);
    } catch (err) {
      setError("Erreur — " + (err.response?.data?.error || err.message));
      setS("idle");
    }
  };

  // ── SpeechRecognition (continuous) ──────────────────────────────────────────
  const startRecording = () => {
    if (statusRef.current === "recording" || statusRef.current === "processing") return;
    stopSpeaking();
    setError("");
    setLiveTranscript("");
    accumulatedText.current = "";
    usingFallback.current   = false;
    userStopped.current     = false;

    // Status immédiat pour que le bouton ⏹ soit cliquable de suite
    setS("recording");

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { usingFallback.current = true; startAssemblyAI(); return; }

    const rec = new SR();
    rec.lang            = "fr-FR";
    rec.continuous      = true;
    rec.interimResults  = true;
    rec.maxAlternatives = 1;
    recognition.current = rec;

    rec.onresult = (event) => {
      let interim = "";
      for (const result of event.results) {
        if (result.isFinal) accumulatedText.current += result[0].transcript + " ";
        else interim += result[0].transcript;
      }
      setLiveTranscript((accumulatedText.current + interim).trim());
    };

    rec.onerror = (event) => {
      if (event.error === "network") {
        usingFallback.current = true;
        setLiveTranscript("⏳ Connexion micro directe...");
        // Petit délai pour laisser SR se fermer proprement avant d'ouvrir le micro
        setTimeout(() => startAssemblyAI(), 500);
        return;
      }
      if (event.error === "no-speech" || event.error === "aborted") return;
      if (event.error === "not-allowed") {
        setError("Microphone refusé — autorisez l'accès dans les paramètres du navigateur");
      } else {
        setError("Erreur micro : " + event.error);
      }
      setLiveTranscript("");
      setS("idle");
    };

    rec.onend = async () => {
      if (usingFallback.current) return; // AssemblyAI prend le relais
      const text = accumulatedText.current.trim();
      accumulatedText.current = "";
      setLiveTranscript("");
      if (!text) { setS("idle"); return; }
      setS("processing");
      addMessage("user", text);
      await sendToChat(text);
    };

    try {
      rec.start();
    } catch (e) {
      setError("Impossible de démarrer le micro : " + e.message);
      setS("idle");
    }
  };

  const stopRecording = () => {
    userStopped.current = true;
    if (usingFallback.current) { stopAssemblyAI(); return; }
    if (recognition.current) {
      try { recognition.current.stop(); } catch {
        setS("idle");
      }
    }
  };

  // ── Envoi au chat / command ──────────────────────────────────────────────────
  const sendToChat = async (text) => {
    try {
      const body = { message: text };
      if (pendingIncomplete) body.pending_action = pendingIncomplete;

      const res = await axios.post(
        `${API_URL}${chatEndpoint}`,
        body,
        { headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" } }
      );
      const data = res.data;

      if (data.type === "action") {
        setPendingIncomplete(null);
        addMessage("assistant", data.reply);
        speakText(data.reply);
        setMessages(prev => [...prev, {
          role: "action_card", action: data.action,
          params: data.params, id: Date.now(), status: "pending",
        }]);
        scrollToBottom();
      } else if (data.type === "incomplete") {
        setPendingIncomplete({ action: data.action, params: data.params, field: data.field });
        addMessage("assistant", data.reply);
        speakText(data.reply);
      } else if (data.type === "cancelled") {
        setPendingIncomplete(null);
        addMessage("assistant", data.reply);
        speakText(data.reply);
      } else {
        setPendingIncomplete(null);
        const reply = data.reply;
        if (reply) { addMessage("assistant", reply); speakText(reply); }
      }
    } catch {
      setError("Erreur réseau");
    } finally {
      setS("idle");
      scrollToBottom();
    }
  };

  // ── Exécution de l'action confirmée ─────────────────────────────────────────
  const executeAction = async (actionId, action, params) => {
    setMessages(prev => prev.map(m => m.id === actionId ? { ...m, status: "processing" } : m));
    try {
      let res;
      if (action === "create_professor") {
        res = await axios.post(`${API_URL}/api/gestion/professeurs`, params, {
          headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" }
        });
        const tempPwd = res?.data?.temp_password;
        const baseMsg = res?.data?.message || `Compte créé pour ${params.prenom} ${params.nom}`;
        const fullMsg = tempPwd
          ? `${baseMsg}. Mot de passe temporaire : ${tempPwd}`
          : baseMsg;
        setMessages(prev => prev.map(m => m.id === actionId ? { ...m, status: "confirmed", tempPassword: tempPwd } : m));
        addMessage("assistant", "✅ " + fullMsg);
        speakText(baseMsg + (tempPwd ? `. Le mot de passe temporaire est : ${tempPwd}` : ""));
        scrollToBottom();
        return;
      } else if (action === "create_matiere") {
        res = await axios.post(`${API_URL}/api/gestion/matieres`, params, {
          headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" }
        });
      } else if (action === "deactivate_professor") {
        res = await axios.delete(`${API_URL}/api/gestion/professeurs/${params.prof_id}`, {
          headers: { Authorization: `Bearer ${getToken()}` }
        });
      }
      const msg = res?.data?.message || "Action effectuée avec succès.";
      setMessages(prev => prev.map(m => m.id === actionId ? { ...m, status: "confirmed" } : m));
      addMessage("assistant", "✅ " + msg);
      speakText(msg);
    } catch (err) {
      const errMsg = err.response?.data?.detail || "Erreur lors de l'exécution.";
      setMessages(prev => prev.map(m =>
        m.id === actionId ? { ...m, status: "error", errorMsg: errMsg } : m
      ));
      addMessage("assistant", "❌ " + errMsg);
    }
    scrollToBottom();
  };

  const cancelAction = (actionId) => {
    setMessages(prev => prev.map(m => m.id === actionId ? { ...m, status: "cancelled" } : m));
    addMessage("assistant", "Action annulée.");
    scrollToBottom();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || status === "processing") return;
    const txt = inputText.trim();
    setInputText("");
    addMessage("user", txt);
    setS("processing");
    await sendToChat(txt);
  };

  const isRecording  = status === "recording";
  const isProcessing = status === "processing";

  // Calcul de progression pour le bandeau
  const progressInfo = pendingIncomplete ? (() => {
    const required  = ACTION_REQUIRED[pendingIncomplete.action] || [];
    const collected = required.filter(f => f in (pendingIncomplete.params || {})).length;
    return { collected, total: required.length };
  })() : null;

  // ── Rendu de la carte d'action ───────────────────────────────────────────────
  const renderActionCard = (msg) => {
    const label       = ACTION_LABELS[msg.action] || { title: msg.action, icon: "⚡", warning: false };
    const isPending   = msg.status === "pending";
    const isProc      = msg.status === "processing";
    const isConfirmed = msg.status === "confirmed";
    const isCancelled = msg.status === "cancelled";
    const isError     = msg.status === "error";

    return (
      <div style={{
        background: label.warning ? "rgba(239,68,68,0.08)" : "rgba(99,102,241,0.1)",
        border: `1px solid ${label.warning ? "rgba(239,68,68,0.3)" : "rgba(99,102,241,0.35)"}`,
        borderRadius: 14, padding: "14px 16px", fontSize: 13,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, fontWeight: 700 }}>
          <span>{label.icon}</span>
          <span style={{ color: label.warning ? "#fca5a5" : "#a5b4fc" }}>{label.title}</span>
          {isConfirmed && <span style={{ color: "#4ade80", marginLeft: "auto", fontSize: 12 }}>✅ Effectué</span>}
          {isCancelled && <span style={{ color: "rgba(255,255,255,0.3)", marginLeft: "auto", fontSize: 12 }}>Annulé</span>}
          {isError     && <span style={{ color: "#f87171", marginLeft: "auto", fontSize: 12 }}>❌ Erreur</span>}
          {isProc      && <span style={{ color: "#a5b4fc", marginLeft: "auto", fontSize: 12 }}>⏳ En cours...</span>}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {Object.entries(msg.params)
            .filter(([k]) => PARAM_LABELS[k])
            .map(([k, v]) => (
              <div key={k} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ color: "rgba(255,255,255,0.4)", minWidth: 100, fontSize: 11 }}>{PARAM_LABELS[k]}</span>
                <span style={{ color: "#fff", fontWeight: 500 }}>
                  {k === "password" ? "•".repeat(String(v).length) : String(v)}
                </span>
              </div>
            ))}
          {isConfirmed && msg.tempPassword && (
            <div style={{
              marginTop: 10, padding: "8px 12px",
              background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)",
              borderRadius: 8,
            }}>
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, marginBottom: 3 }}>
                MOT DE PASSE TEMPORAIRE
              </div>
              <div style={{ color: "#4ade80", fontWeight: 700, fontSize: 14, letterSpacing: 1 }}>
                {msg.tempPassword}
              </div>
              <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, marginTop: 3 }}>
                Communiquez-le au professeur
              </div>
            </div>
          )}
          {isError && msg.errorMsg && (
            <div style={{ color: "#f87171", fontSize: 12, marginTop: 4 }}>{msg.errorMsg}</div>
          )}
        </div>

        {isPending && (
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button onClick={() => executeAction(msg.id, msg.action, msg.params)} style={{
              flex: 1, padding: "9px", border: "none", borderRadius: 8,
              background: label.warning
                ? "linear-gradient(135deg,#ef4444,#dc2626)"
                : "linear-gradient(135deg,#6366f1,#a855f7)",
              color: "#fff", cursor: "pointer",
              fontFamily: "Sora, sans-serif", fontWeight: 600, fontSize: 12,
            }}>✓ Confirmer</button>
            <button onClick={() => cancelAction(msg.id)} style={{
              flex: 1, padding: "9px",
              border: `1px solid ${label.warning ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.15)"}`,
              borderRadius: 8, background: "transparent",
              color: "rgba(255,255,255,0.5)", cursor: "pointer",
              fontFamily: "Sora, sans-serif", fontSize: 12,
            }}>✕ Annuler</button>
          </div>
        )}
      </div>
    );
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Sora', sans-serif",
    }}>
      <style>{"@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&display=swap')"}</style>

      <div style={{
        width: "100%", maxWidth: 540,
        background: "#0a0a1a",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 24, overflow: "hidden",
        display: "flex", flexDirection: "column",
        maxHeight: "85vh",
      }}>

        {/* Header */}
        <div style={{
          padding: "16px 20px",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "rgba(99,102,241,0.08)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: "linear-gradient(135deg,#6366f1,#a855f7)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
            }}>🤖</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#fff" }}>Assistant IA</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>SmartCampus ESISA</div>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8, color: "rgba(255,255,255,0.5)",
            cursor: "pointer", padding: "6px 12px",
            fontFamily: "Sora, sans-serif", fontSize: 12,
          }}>✕</button>
        </div>

        {/* Messages */}
        <div style={{
          flex: 1, overflowY: "auto", padding: "16px 20px",
          display: "flex", flexDirection: "column", gap: 12,
        }}>
          {messages.map((msg, i) => {
            if (msg.role === "action_card") {
              return <div key={`action-${msg.id}`}>{renderActionCard(msg)}</div>;
            }
            return (
              <div key={i} style={{
                display: "flex",
                justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                alignItems: "flex-end", gap: 8,
              }}>
                {msg.role === "assistant" && (
                  <div style={{
                    width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                    background: "linear-gradient(135deg,#6366f1,#a855f7)",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
                  }}>🤖</div>
                )}
                <div style={{
                  maxWidth: "78%", padding: "10px 14px", borderRadius: 14,
                  fontSize: 13, lineHeight: 1.6, color: "#fff",
                  background: msg.role === "user"
                    ? "linear-gradient(135deg,#6366f1,#a855f7)"
                    : "rgba(255,255,255,0.06)",
                  borderBottomRightRadius: msg.role === "user" ? 4 : 14,
                  borderBottomLeftRadius:  msg.role === "assistant" ? 4 : 14,
                }}>
                  {msg.text}
                </div>
              </div>
            );
          })}

          {/* Transcript en temps réel */}
          {isRecording && liveTranscript && (
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <div style={{
                maxWidth: "78%", padding: "10px 14px", borderRadius: 14,
                borderBottomRightRadius: 4,
                fontSize: 13, lineHeight: 1.6,
                background: "rgba(99,102,241,0.3)",
                color: "rgba(255,255,255,0.7)",
                border: "1px dashed rgba(99,102,241,0.5)",
                fontStyle: "italic",
              }}>
                {liveTranscript}
              </div>
            </div>
          )}

          {isProcessing && (
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: "linear-gradient(135deg,#6366f1,#a855f7)",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
              }}>🤖</div>
              <div style={{
                padding: "12px 16px", borderRadius: 14,
                background: "rgba(255,255,255,0.06)", display: "flex", gap: 5,
              }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{
                    width: 7, height: 7, borderRadius: "50%", background: "#6366f1",
                    animation: `bounce 1.2s ${i * 0.2}s infinite`,
                  }} />
                ))}
              </div>
            </div>
          )}
          <div ref={messagesEnd} />
        </div>

        {/* Bandeau de progression */}
        {pendingIncomplete && (
          <div style={{
            margin: "0 20px 4px",
            background: "rgba(99,102,241,0.12)",
            border: "1px solid rgba(99,102,241,0.3)",
            borderRadius: 10, padding: "8px 14px",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
              <span style={{ fontSize: 14 }}>
                {ACTION_LABELS[pendingIncomplete.action]?.icon || "⚡"}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ color: "#a5b4fc", fontSize: 11, fontWeight: 600 }}>
                  {INCOMPLETE_HINTS[pendingIncomplete.action]}
                </div>
                {progressInfo && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                    <div style={{ flex: 1, height: 3, background: "rgba(255,255,255,0.1)", borderRadius: 2 }}>
                      <div style={{
                        width: `${(progressInfo.collected / progressInfo.total) * 100}%`,
                        height: "100%", background: "linear-gradient(90deg,#6366f1,#a855f7)",
                        borderRadius: 2, transition: "width 0.3s",
                      }} />
                    </div>
                    <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 10 }}>
                      {progressInfo.collected}/{progressInfo.total}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={() => {
                setPendingIncomplete(null);
                addMessage("assistant", "Action annulée.");
              }}
              style={{
                background: "none", border: "none",
                color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: 13, padding: "0 2px",
              }}>✕</button>
          </div>
        )}

        {/* Erreur */}
        {error && (
          <div style={{
            margin: "0 20px 8px",
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: 10, padding: "8px 14px",
            color: "#fca5a5", fontSize: 12,
          }}>{error}</div>
        )}

        {/* Zone basse */}
        <div style={{
          padding: "14px 20px",
          borderTop: "1px solid rgba(255,255,255,0.07)",
          display: "flex", flexDirection: "column", gap: 10,
        }}>
          {/* Bouton micro */}
          <div style={{ display: "flex", justifyContent: "center" }}>
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isProcessing}
              style={{
                width: 60, height: 60, borderRadius: "50%", border: "none",
                background: isRecording
                  ? "linear-gradient(135deg,#ef4444,#dc2626)"
                  : isSpeaking
                  ? "linear-gradient(135deg,#f59e0b,#d97706)"
                  : "linear-gradient(135deg,#6366f1,#a855f7)",
                cursor: isProcessing ? "not-allowed" : "pointer",
                fontSize: 24,
                boxShadow: isRecording
                  ? "0 0 0 8px rgba(239,68,68,0.2), 0 4px 20px rgba(239,68,68,0.4)"
                  : isSpeaking
                  ? "0 0 0 8px rgba(245,158,11,0.2), 0 4px 20px rgba(245,158,11,0.4)"
                  : "0 4px 20px rgba(99,102,241,0.4)",
                transition: "all 0.2s",
                opacity: isProcessing ? 0.5 : 1,
                animation: isSpeaking ? "pulse 1.5s infinite" : "none",
              }}>
              {isProcessing ? "⏳" : isRecording ? "⏹" : isSpeaking ? "🔊" : "🎤"}
            </button>
          </div>

          <p style={{ textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.3)", margin: 0 }}>
            {isRecording   ? "🔴 Parlez maintenant... cliquez pour arrêter"
            : isProcessing ? "⏳ Traitement en cours..."
            : isSpeaking   ? "🔊 Cliquez sur le micro pour répondre"
            : pendingIncomplete ? "🎤 Parlez ou tapez votre réponse"
            : "Cliquez sur le micro et parlez"}
          </p>

          {/* Suggestions (masquées pendant un dialogue en cours) */}
          {!pendingIncomplete && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
              {suggestions.map((q, i) => (
                <button key={i} onClick={() => {
                  addMessage("user", q);
                  setS("processing");
                  sendToChat(q);
                }} style={{
                  padding: "4px 10px",
                  border: "1px solid rgba(99,102,241,0.3)",
                  borderRadius: 20,
                  background: "rgba(99,102,241,0.08)",
                  color: "#a5b4fc", cursor: "pointer",
                  fontFamily: "Sora, sans-serif", fontSize: 11,
                }}>{q}</button>
              ))}
            </div>
          )}

          {/* Champ texte */}
          <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8 }}>
            <input
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder={
                pendingIncomplete
                  ? "Tapez votre réponse..."
                  : "Posez une question ou donnez un ordre..."
              }
              disabled={isRecording || isProcessing}
              style={{
                flex: 1, padding: "10px 14px",
                background: "rgba(255,255,255,0.05)",
                border: `1px solid ${pendingIncomplete ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.1)"}`,
                borderRadius: 10, color: "#fff", fontSize: 13,
                fontFamily: "Sora, sans-serif", outline: "none",
              }}
            />
            <button type="submit"
              disabled={!inputText.trim() || isProcessing}
              style={{
                padding: "10px 16px", border: "none", borderRadius: 10,
                background: "#6366f1", color: "#fff", cursor: "pointer",
                fontFamily: "Sora, sans-serif", fontSize: 14, fontWeight: 600,
                opacity: !inputText.trim() || isProcessing ? 0.4 : 1,
              }}>→</button>
          </form>
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
      `}</style>
    </div>
  );
}
