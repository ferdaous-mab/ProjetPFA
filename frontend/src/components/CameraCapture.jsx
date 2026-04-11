import { useRef, useEffect, useState, useCallback } from "react";
import axios from "axios";

const API_URL = "";
const TARGET_FRAMES = 7;
const CAPTURE_INTERVAL = 1500;

const MESSAGES = [
  "Regardez droit devant",
  "Tournez légèrement à droite",
  "Tournez légèrement à gauche",
  "Inclinez la tête vers le haut",
  "Inclinez la tête vers le bas",
  "Revenez au centre",
  "Encore un instant...",
];

export default function CameraCapture({ studentId, onComplete }) {
  const videoRef    = useRef(null);
  const canvasRef   = useRef(null);
  const intervalRef = useRef(null);
  const streamRef   = useRef(null);
  const finalizing  = useRef(false); // ← garde contre double appel

  const [framesOk, setFramesOk] = useState(0);
  const [status,   setStatus]   = useState("init");
  const [message,  setMessage]  = useState("Positionnez votre visage dans le cercle");
  const [errorMsg, setErrorMsg] = useState("");
  const [faceDetected, setFaceDetected] = useState(false);
  const [pulse,    setPulse]    = useState(false);

  // ── Caméra ────────────────────────────────────────────────────────────────
  useEffect(() => {
    startCamera();
    return () => stopAll();
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStatus("capturing");
    } catch (err) {
      setStatus("error");
      setErrorMsg("Impossible d'accéder à la caméra : " + err.message);
    }
  };

  const stopAll = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
  };

  // ── Boucle de capture ─────────────────────────────────────────────────────
  useEffect(() => {
    if (status !== "capturing") return;
    intervalRef.current = setInterval(captureFrame, CAPTURE_INTERVAL);
    return () => clearInterval(intervalRef.current);
  }, [status, framesOk]);

  const captureFrame = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;
    if (framesOk >= TARGET_FRAMES) return;
    if (finalizing.current) return; // déjà en cours

    const canvas = canvasRef.current;
    canvas.width  = 320;
    canvas.height = 240;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(videoRef.current, 0, 0, 320, 240);

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const form = new FormData();
      form.append("student_id", studentId);
      form.append("image", blob, "frame.jpg");

      try {
        const { data } = await axios.post(`${API_URL}/api/enroll/capture`, form);

        if (data.accepted) {
          const newCount = data.frames_captured;
          setFramesOk(newCount);
          setFaceDetected(true);
          setPulse(true);
          setTimeout(() => setPulse(false), 400);
          setMessage(MESSAGES[Math.min(newCount - 1, MESSAGES.length - 1)]);

          if (newCount >= TARGET_FRAMES && !finalizing.current) {
            finalizing.current = true;
            clearInterval(intervalRef.current);
            setStatus("finalizing");
            await finalize();
          }
        } else {
          setFaceDetected(false);
          setMessage(data.reason || "Ajustez votre position");
        }
      } catch {
        setFaceDetected(false);
      }
    }, "image/jpeg", 0.85);
  }, [framesOk, studentId]);

  // ── Finalisation ──────────────────────────────────────────────────────────
  const finalize = async () => {
    setMessage("Traitement en cours...");
    stopAll();
    try {
      const form = new FormData();
      form.append("student_id", studentId);
      await axios.post(`${API_URL}/api/enroll/finalize`, form);
      setStatus("done");
      setMessage("Enrôlement réussi !");
      setTimeout(() => onComplete?.(), 1800);
    } catch (err) {
      setStatus("error");
      setErrorMsg(err.response?.data?.detail || "Erreur lors de la finalisation");
      finalizing.current = false;
    }
  };

  // ── SVG cercle ────────────────────────────────────────────────────────────
  const RADIUS       = 130;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
  const progress     = framesOk / TARGET_FRAMES;
  const dashOffset   = CIRCUMFERENCE * (1 - progress);

  const accentColor =
    status === "done"  ? "#22c55e" :
    status === "error" ? "#ef4444" :
    faceDetected       ? "#6366f1" : "#94a3b8";

  const bgColor   = "#f8f7ff";
  const darkColor = "#1e1b4b";

  return (
    <div style={{
      minHeight: "100vh", background: bgColor,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      padding: "24px", gap: "32px",
    }}>
      {/* Titre */}
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: "22px", fontWeight: 700, color: darkColor, margin: 0, letterSpacing: "-0.5px" }}>
          Enrôlement facial
        </h1>
        <p style={{ color: "#64748b", fontSize: "14px", margin: "6px 0 0" }}>SmartCampus IA</p>
      </div>

      {/* Cercle + caméra */}
      <div style={{ position: "relative", width: 300, height: 300 }}>

        {/* Vidéo en cercle */}
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          width: 240, height: 240, borderRadius: "50%",
          overflow: "hidden", background: "#0f0f1a", zIndex: 1,
        }}>
          <video ref={videoRef} autoPlay playsInline muted style={{
            width: "100%", height: "100%", objectFit: "cover",
            transform: "scaleX(-1)",
            display: status === "error" ? "none" : "block",
          }} />
          {status === "done" && (
            <div style={{
              position: "absolute", inset: 0,
              background: "rgba(34,197,94,0.25)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ fontSize: 56 }}>✓</span>
            </div>
          )}
        </div>

        {/* SVG progression */}
        <svg width={300} height={300} style={{ position: "absolute", top: 0, left: 0, zIndex: 2 }}>
          <circle cx={150} cy={150} r={RADIUS} fill="none" stroke="#e2e8f0" strokeWidth={6} />
          <circle
            cx={150} cy={150} r={RADIUS} fill="none"
            stroke={accentColor} strokeWidth={6} strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE} strokeDashoffset={dashOffset}
            transform="rotate(-90 150 150)"
            style={{ transition: "stroke-dashoffset 0.5s ease, stroke 0.4s ease" }}
          />
          {Array.from({ length: TARGET_FRAMES }).map((_, i) => {
            const angle = (i / TARGET_FRAMES) * 2 * Math.PI - Math.PI / 2;
            const x = 150 + RADIUS * Math.cos(angle);
            const y = 150 + RADIUS * Math.sin(angle);
            const captured = i < framesOk;
            return (
              <circle key={i} cx={x} cy={y} r={captured ? 6 : 4}
                fill={captured ? accentColor : "#e2e8f0"}
                stroke={bgColor} strokeWidth={2}
                style={{ transition: "all 0.3s ease" }}
              />
            );
          })}
        </svg>

        <canvas ref={canvasRef} style={{ display: "none" }} />
      </div>

      {/* Message */}
      <div style={{ textAlign: "center", minHeight: 56 }}>
        <p style={{ fontSize: "16px", fontWeight: 600, color: darkColor, margin: 0 }}>
          {message}
        </p>

        {status === "capturing" && (
          <div style={{ marginTop: 12, display: "flex", gap: 6, justifyContent: "center" }}>
            {Array.from({ length: TARGET_FRAMES }).map((_, i) => (
              <div key={i} style={{
                width: 8, height: 8, borderRadius: "50%",
                background: i < framesOk ? accentColor : "#e2e8f0",
                transition: "background 0.3s ease",
              }} />
            ))}
          </div>
        )}

        {status === "capturing" && (
          <p style={{ color: "#94a3b8", fontSize: "13px", marginTop: 8 }}>
            {framesOk}/{TARGET_FRAMES} captures
          </p>
        )}

        {status === "finalizing" && (
          <div style={{
            marginTop: 12, width: 24, height: 24,
            border: "3px solid #e2e8f0", borderTop: `3px solid ${accentColor}`,
            borderRadius: "50%", animation: "spin 0.8s linear infinite",
            margin: "12px auto 0",
          }} />
        )}

        {status === "error" && (
          <p style={{ color: "#ef4444", fontSize: "14px", marginTop: 8 }}>{errorMsg}</p>
        )}
      </div>

      {status === "capturing" && (
        <div style={{
          background: "white", borderRadius: 16, padding: "14px 20px",
          boxShadow: "0 2px 16px rgba(99,102,241,0.08)", maxWidth: 280, textAlign: "center",
        }}>
          <p style={{ color: "#64748b", fontSize: "13px", margin: 0, lineHeight: 1.6 }}>
            👁️ Regardez la caméra et tournez lentement la tête de gauche à droite
          </p>
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}