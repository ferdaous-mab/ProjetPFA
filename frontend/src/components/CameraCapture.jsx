import { useRef, useEffect, useState, useCallback } from "react";
import axios from "axios";

const API_URL        = "";
const TARGET_FRAMES  = 5;
const CAPTURE_INTERVAL = 1000; // 1s — fluide

export default function CameraCapture({ studentId, onComplete }) {
  const videoRef    = useRef(null);
  const canvasRef   = useRef(null);
  const intervalRef = useRef(null);
  const streamRef   = useRef(null);
  const finalizing  = useRef(false);
  const capturing   = useRef(false); // évite les appels simultanés

  const [framesOk,   setFramesOk]   = useState(0);
  const [status,     setStatus]     = useState("init");
  const [message,    setMessage]    = useState("Positionnez votre visage");
  const [hint,       setHint]       = useState("");
  const [errorMsg,   setErrorMsg]   = useState("");
  const [ringColor,  setRingColor]  = useState("#94a3b8");

  useEffect(() => { startCamera(); return () => stopAll(); }, []);

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
      setMessage("Regardez droit devant");
    } catch (err) {
      setStatus("error");
      setErrorMsg("Caméra inaccessible : " + err.message);
    }
  };

  const stopAll = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
  };

  useEffect(() => {
    if (status !== "capturing") return;
    intervalRef.current = setInterval(captureFrame, CAPTURE_INTERVAL);
    return () => clearInterval(intervalRef.current);
  }, [status, framesOk]);

  const captureFrame = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;
    if (finalizing.current || capturing.current) return;
    if (framesOk >= TARGET_FRAMES) return;

    capturing.current = true;

    const canvas = canvasRef.current;
    canvas.width = 320; canvas.height = 240;
    canvas.getContext("2d").drawImage(videoRef.current, 0, 0, 320, 240);

    canvas.toBlob(async (blob) => {
      if (!blob) { capturing.current = false; return; }
      const form = new FormData();
      form.append("student_id", studentId);
      form.append("image", blob, "frame.jpg");

      try {
        const { data } = await axios.post(`${API_URL}/api/enroll/capture`, form);

        if (data.accepted) {
          const n = data.frames_captured;
          setFramesOk(n);
          setRingColor("#6366f1");
          setMessage(data.next_instruction || "Continuez");
          setHint("");

          if (n >= TARGET_FRAMES && !finalizing.current) {
            finalizing.current = true;
            clearInterval(intervalRef.current);
            setStatus("finalizing");
            setMessage("Traitement...");
            await finalize();
          }
        } else {
          setRingColor("#f59e0b");
          setHint(data.reason || "Bougez la tête");
          setTimeout(() => setRingColor("#6366f1"), 600);
        }
      } catch {
        setRingColor("#ef4444");
        setTimeout(() => setRingColor("#94a3b8"), 600);
      } finally {
        capturing.current = false;
      }
    }, "image/jpeg", 0.85);
  }, [framesOk, studentId]);

  const finalize = async () => {
    stopAll();
    try {
      const form = new FormData();
      form.append("student_id", studentId);
      await axios.post(`${API_URL}/api/enroll/finalize`, form);
      setStatus("done");
      setMessage("Enrôlement réussi !");
      setRingColor("#22c55e");
      setTimeout(() => onComplete?.(), 1800);
    } catch (err) {
      setStatus("error");
      setErrorMsg(err.response?.data?.detail || "Erreur finalisation");
      finalizing.current = false;
    }
  };

  // ── Dessin ────────────────────────────────────────────────────────────────
  const R  = 130;
  const C  = 2 * Math.PI * R;
  const offset = C * (1 - framesOk / TARGET_FRAMES);

  return (
    <div style={{
      minHeight: "100vh", background: "#f8f7ff",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      padding: "24px", gap: "24px",
    }}>

      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: "21px", fontWeight: 700, color: "#1e1b4b", margin: 0 }}>
          Enrôlement facial
        </h1>
        <p style={{ color: "#94a3b8", fontSize: "13px", margin: "4px 0 0" }}>SmartCampus IA</p>
      </div>

      {/* Cercle + vidéo */}
      <div style={{ position: "relative", width: 300, height: 300 }}>
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%,-50%)",
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
              background: "rgba(34,197,94,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 70,
            }}>✓</div>
          )}
        </div>

        <svg width={300} height={300} style={{ position: "absolute", top: 0, left: 0, zIndex: 2 }}>
          <circle cx={150} cy={150} r={R} fill="none" stroke="#e2e8f0" strokeWidth={5} />
          <circle
            cx={150} cy={150} r={R} fill="none"
            stroke={ringColor} strokeWidth={6} strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={offset}
            transform="rotate(-90 150 150)"
            style={{ transition: "stroke-dashoffset 0.5s ease, stroke 0.3s ease" }}
          />
          {Array.from({ length: TARGET_FRAMES }).map((_, i) => {
            const a = (i / TARGET_FRAMES) * 2 * Math.PI - Math.PI / 2;
            return (
              <circle key={i}
                cx={150 + R * Math.cos(a)} cy={150 + R * Math.sin(a)}
                r={i < framesOk ? 8 : 4}
                fill={i < framesOk ? ringColor : "#e2e8f0"}
                stroke="#f8f7ff" strokeWidth={2}
                style={{ transition: "all 0.4s ease" }}
              />
            );
          })}
        </svg>

        <canvas ref={canvasRef} style={{ display: "none" }} />
      </div>

      {/* Messages */}
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: "17px", fontWeight: 700, color: "#1e1b4b", margin: 0 }}>
          {message}
        </p>
        {hint && (
          <p style={{ fontSize: "13px", color: "#f59e0b", fontWeight: 600, margin: "6px 0 0" }}>
            ↩ {hint}
          </p>
        )}
        {status === "capturing" && (
          <p style={{ color: "#94a3b8", fontSize: "12px", margin: "8px 0 0" }}>
            {framesOk}/{TARGET_FRAMES} angles capturés
          </p>
        )}
        {status === "finalizing" && (
          <div style={{
            width: 26, height: 26, borderRadius: "50%",
            border: "3px solid #e2e8f0", borderTop: `3px solid ${ringColor}`,
            animation: "spin 0.7s linear infinite",
            margin: "12px auto 0",
          }} />
        )}
        {status === "error" && (
          <p style={{ color: "#ef4444", fontSize: "13px", marginTop: 8 }}>{errorMsg}</p>
        )}
      </div>

      {status === "capturing" && (
        <div style={{
          background: "white", borderRadius: 14, padding: "12px 18px",
          boxShadow: "0 4px 20px rgba(99,102,241,0.08)",
          maxWidth: 280, textAlign: "center",
        }}>
          <p style={{ color: "#64748b", fontSize: "13px", margin: 0, lineHeight: 1.6 }}>
            🔄 Tournez lentement la tête <strong>gauche → droite</strong>
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