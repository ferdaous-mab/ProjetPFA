import { useRef, useEffect, useState, useCallback } from "react";
import axios from "axios";

const API_URL        = "";
const TARGET_FRAMES  = 5;
const CAPTURE_INTERVAL = 800;

// Instructions visuelles pour chaque angle
const ANGLE_ICONS = {
  0: "⬤",   // centre
  1: "→",   // droite
  2: "←",   // gauche
  3: "↑",   // haut
  4: "↓",   // bas
};

const ANGLE_LABELS = [
  "Centre",
  "Droite",
  "Gauche",
  "Haut",
  "Bas",
];

export default function CameraCapture({ studentId, onComplete }) {
  const videoRef    = useRef(null);
  const canvasRef   = useRef(null);
  const intervalRef = useRef(null);
  const streamRef   = useRef(null);
  const finalizing  = useRef(false);
  const capturing   = useRef(false);

  const [framesOk,    setFramesOk]    = useState(0);
  const [status,      setStatus]      = useState("init");
  const [message,     setMessage]     = useState("Positionnez votre visage");
  const [hint,        setHint]        = useState("");
  const [hintType,    setHintType]    = useState("warn");
  const [ringColor,   setRingColor]   = useState("#94a3b8");
  const [nextAngleId, setNextAngleId] = useState(0);
  const [captured,    setCaptured]    = useState([]); // angles capturés

  useEffect(() => { startCamera(); return () => stopAll(); }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStatus("capturing");
      setMessage("Regardez droit devant");
      setNextAngleId(0);
    } catch (err) {
      setStatus("error");
      setHint("Caméra inaccessible : " + err.message);
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
  }, [status, framesOk, nextAngleId]);

  const captureFrame = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;
    if (finalizing.current || capturing.current) return;
    if (framesOk >= TARGET_FRAMES) return;

    capturing.current = true;

    const video  = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);

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
          setCaptured(prev => [...prev, data.angle_captured]);
          setHint(`✓ ${data.angle_captured} capturé !`);
          setHintType("ok");
          setTimeout(() => {
            setHint("");
            setMessage(data.next_angle || "Continuez");
            setNextAngleId(data.next_angle_id ?? -1);
          }, 800);

          if (data.ready_to_finalize && !finalizing.current) {
            finalizing.current = true;
            clearInterval(intervalRef.current);
            setStatus("finalizing");
            setMessage("Traitement en cours...");
            setHint("");
            await finalize();
          }
        } else {
          setRingColor("#f59e0b");
          setHint(data.reason || "Ajustez votre position");
          setHintType("warn");
          setTimeout(() => setRingColor(framesOk > 0 ? "#6366f1" : "#94a3b8"), 600);
        }
      } catch {
        setHint("Erreur réseau...");
        setHintType("warn");
      } finally {
        capturing.current = false;
      }
    }, "image/jpeg", 1.0);
  }, [framesOk, studentId, nextAngleId]);

  const finalize = async () => {
    stopAll();
    try {
      const form = new FormData();
      form.append("student_id", studentId);
      await axios.post(`${API_URL}/api/enroll/finalize`, form);
      setStatus("done");
      setMessage("Enrôlement réussi !");
      setRingColor("#22c55e");
      setTimeout(() => onComplete?.(), 2000);
    } catch (err) {
      setStatus("error");
      setHint(err.response?.data?.detail || "Erreur finalisation");
      finalizing.current = false;
    }
  };

  const R      = 130;
  const C      = 2 * Math.PI * R;
  const offset = C * (1 - framesOk / TARGET_FRAMES);

  return (
    <div style={{
      minHeight: "100vh", background: "#f8f7ff",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      padding: "24px", gap: "20px",
    }}>

      {/* Titre */}
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: "21px", fontWeight: 700, color: "#1e1b4b", margin: 0 }}>
          Enrôlement facial
        </h1>
        <p style={{ color: "#94a3b8", fontSize: "13px", margin: "4px 0 0" }}>SmartCampus IA</p>
      </div>

      {/* Indicateurs d'angles */}
      <div style={{ display: "flex", gap: 8 }}>
        {ANGLE_LABELS.map((label, i) => {
          const done = captured.includes(label.toLowerCase()) ||
                       captured.includes(["centre","droite","gauche","haut","bas"][i]);
          const current = nextAngleId === i && status === "capturing";
          return (
            <div key={i} style={{
              width: 44, height: 44, borderRadius: "50%",
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              background: done ? "#6366f1" : current ? "#e0e7ff" : "#f1f5f9",
              border: current ? "2px solid #6366f1" : "2px solid transparent",
              transition: "all 0.3s",
            }}>
              <span style={{ fontSize: 16, color: done ? "white" : current ? "#6366f1" : "#94a3b8" }}>
                {done ? "✓" : ANGLE_ICONS[i]}
              </span>
              <span style={{ fontSize: 8, color: done ? "white" : "#94a3b8", marginTop: 1 }}>
                {label}
              </span>
            </div>
          );
        })}
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

          {/* Flèche de guidage sur la vidéo */}
          {status === "capturing" && nextAngleId >= 0 && (
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              pointerEvents: "none",
            }}>
              <span style={{
                fontSize: 48, opacity: 0.4, color: "white",
                textShadow: "0 0 10px rgba(99,102,241,0.8)",
              }}>
                {ANGLE_ICONS[nextAngleId]}
              </span>
            </div>
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
      <div style={{ textAlign: "center", minHeight: 60 }}>
        <p style={{ fontSize: "17px", fontWeight: 700, color: "#1e1b4b", margin: 0 }}>
          {message}
        </p>
        {hint && (
          <p style={{
            fontSize: "13px", fontWeight: 600, margin: "6px 0 0",
            color: hintType === "ok" ? "#22c55e" : "#f59e0b",
          }}>
            {hint}
          </p>
        )}
        {status === "capturing" && (
          <p style={{ color: "#94a3b8", fontSize: "12px", margin: "6px 0 0" }}>
            {framesOk}/{TARGET_FRAMES} angles capturés
          </p>
        )}
        {status === "finalizing" && (
          <div style={{
            width: 26, height: 26, borderRadius: "50%",
            border: "3px solid #e2e8f0", borderTop: `3px solid ${ringColor}`,
            animation: "spin 0.7s linear infinite",
            margin: "10px auto 0",
          }} />
        )}
        {status === "error" && (
          <p style={{ color: "#ef4444", fontSize: "13px", marginTop: 8 }}>{hint}</p>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}