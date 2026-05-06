import { useState, useRef } from "react";
import axios from "axios";

const API_URL = "";

function getToken() {
  return localStorage.getItem("token");
}

export default function VoiceAssistant({ onClose }) {
  const [status,     setStatus]     = useState("idle");
  const [messages,   setMessages]   = useState([
    { role: "assistant", text: "Bonjour ! Je suis votre assistant SmartCampus. Appuyez sur le micro et posez votre question, ou tapez-la directement." }
  ]);
  const [inputText,  setInputText]  = useState("");
  const [error,      setError]      = useState("");

  const recognition    = useRef(null);
  const mediaRecorder  = useRef(null);
  const audioChunks    = useRef([]);
  const messagesEnd    = useRef(null);
  const usingFallback  = useRef(false);

  const scrollToBottom = () => {
    setTimeout(() => messagesEnd.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  // ── Fallback AssemblyAI ──────────────────────────────────────────────────
  const startAssemblyAI = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/ogg;codecs=opus";
      mediaRecorder.current = new MediaRecorder(stream, { mimeType });
      audioChunks.current   = [];

      mediaRecorder.current.ondataavailable = e => { if (e.data.size > 0) audioChunks.current.push(e.data); };
      mediaRecorder.current.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunks.current, { type: mimeType });
        await transcribeWithAssemblyAI(blob);
      };

      mediaRecorder.current.start(100);
      setStatus("recording");
    } catch {
      setError("Microphone inaccessible — vérifiez les permissions du navigateur");
    }
  };

  const stopAssemblyAI = () => {
    if (mediaRecorder.current && mediaRecorder.current.state === "recording") {
      mediaRecorder.current.stop();
      setStatus("processing");
    }
  };

  const transcribeWithAssemblyAI = async (blob) => {
    try {
      const form = new FormData();
      form.append("audio", blob, blob.type.includes("ogg") ? "voice.ogg" : "voice.webm");
      const res  = await axios.post(`${API_URL}/api/voice/transcribe`, form, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      const { text, error: apiError } = res.data || {};
      if (apiError) { setError("Erreur transcription : " + apiError); setStatus("idle"); return; }
      if (!text)    { setError("Aucune voix détectée — parlez plus fort"); setStatus("idle"); return; }
      addMessage("user", text);
      await sendToChat(text);
    } catch (err) {
      setError("Erreur — " + (err.response?.data?.error || err.message));
      setStatus("idle");
    }
  };

  // ── SpeechRecognition (primaire) ─────────────────────────────────────────
  const startRecording = () => {
    setError("");
    usingFallback.current = false;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { usingFallback.current = true; startAssemblyAI(); return; }

    const rec = new SR();
    rec.lang            = "fr-FR";
    rec.interimResults  = false;
    rec.maxAlternatives = 1;
    recognition.current = rec;

    rec.onstart = () => setStatus("recording");

    rec.onresult = async (event) => {
      const text = event.results[0][0].transcript.trim();
      if (!text) { setError("Aucune parole détectée — réessayez"); setStatus("idle"); return; }
      setStatus("processing");
      addMessage("user", text);
      await sendToChat(text);
    };

    rec.onerror = (event) => {
      if (event.error === "network") {
        // Google bloqué → bascule sur AssemblyAI
        usingFallback.current = true;
        startAssemblyAI();
        return;
      }
      if (event.error === "no-speech") setError("Aucune voix détectée — parlez plus fort");
      else if (event.error === "not-allowed") setError("Microphone refusé — autorisez l'accès dans les paramètres");
      else setError("Erreur micro : " + event.error);
      setStatus("idle");
    };

    rec.onend = () => { if (!usingFallback.current && status === "recording") setStatus("idle"); };

    rec.start();
  };

  const stopRecording = () => {
    if (usingFallback.current) { stopAssemblyAI(); return; }
    if (recognition.current)   recognition.current.stop();
  };

  const sendToChat = async (text) => {
    try {
      const res = await axios.post(
        `${API_URL}/api/voice/chat`,
        { message: text },
        {
          headers: {
            Authorization: `Bearer ${getToken()}`,
            "Content-Type": "application/json",
          }
        }
      );
      const reply = res.data?.reply;
      if (reply) {
        addMessage("assistant", reply);
        speakText(reply);
      }
    } catch (err) {
      setError("Erreur réseau");
    } finally {
      setStatus("idle");
      scrollToBottom();
    }
  };

  const addMessage = (role, text) => {
    setMessages(prev => [...prev, { role, text }]);
    scrollToBottom();
  };

  const speakText = (text) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang  = "fr-FR";
    utter.rate  = 0.95;
    window.speechSynthesis.speak(utter);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || status === "processing") return;
    const txt = inputText.trim();
    setInputText("");
    addMessage("user", txt);
    setStatus("processing");
    await sendToChat(txt);
  };

  const isRecording  = status === "recording";
  const isProcessing = status === "processing";

  const SUGGESTIONS = [
    "Taux de présence global ?",
    "Étudiants à risque ?",
    "Combien d'alertes ?",
    "Résumé de la plateforme",
    "Combien d'étudiants ?",
    "Moyenne générale ?",
  ];

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
          {messages.map((msg, i) => (
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
          ))}

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
                  : "linear-gradient(135deg,#6366f1,#a855f7)",
                cursor: isProcessing ? "not-allowed" : "pointer",
                fontSize: 24,
                boxShadow: isRecording
                  ? "0 0 0 8px rgba(239,68,68,0.2), 0 4px 20px rgba(239,68,68,0.4)"
                  : "0 4px 20px rgba(99,102,241,0.4)",
                transition: "all 0.2s",
                opacity: isProcessing ? 0.5 : 1,
              }}>
              {isProcessing ? "⏳" : isRecording ? "⏹" : "🎤"}
            </button>
          </div>

          <p style={{ textAlign: "center", fontSize: 11,
            color: "rgba(255,255,255,0.3)", margin: 0 }}>
            {isRecording   ? "🔴 Parlez maintenant... cliquez pour arrêter"
            : isProcessing ? "⏳ Traitement..."
            : "Cliquez sur le micro et parlez"}
          </p>

          {/* Suggestions */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
            {SUGGESTIONS.map((q, i) => (
              <button key={i} onClick={() => {
                setInputText(q);
                addMessage("user", q);
                setStatus("processing");
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

          {/* Input texte */}
          <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8 }}>
            <input
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder="Ou tapez votre question..."
              disabled={isRecording || isProcessing}
              style={{
                flex: 1, padding: "10px 14px",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
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
      `}</style>
    </div>
  );
}