import { useRef, useEffect, useState, useCallback } from "react";
import axios from "axios";

const API_URL        = "";
const CAPTURES_PER_ANGLE = 5;
const TOTAL_ANGLES   = 7;
const TOTAL_CAPTURES = TOTAL_ANGLES * CAPTURES_PER_ANGLE; // 35
const CAPTURE_INTERVAL = 800; // 0.8s — fluide

const ANGLE_ICONS = {
  face:            "⬤",
  droite:          "→",
  gauche:          "←",
  haut:            "↑",
  bas:             "↓",
  diagonal_droite: "↗",
  diagonal_gauche: "↖",
};

const ANGLE_LABELS = {
  face:            "Face",
  droite:          "Droite",
  gauche:          "Gauche",
  haut:            "Haut",
  bas:             "Bas",
  diagonal_droite: "Diag →",
  diagonal_gauche: "Diag ←",
};

const ANGLES_ORDER = ["face","droite","gauche","haut","bas","diagonal_droite","diagonal_gauche"];

export default function CameraCapture({ studentId, onComplete }) {
  const videoRef    = useRef(null);
  const canvasRef   = useRef(null);
  const intervalRef = useRef(null);
  const streamRef   = useRef(null);
  const finalizing  = useRef(false);
  const capturing   = useRef(false);

  const [totalCaptured,   setTotalCaptured]   = useState(0);
  const [angleCounts,     setAngleCounts]     = useState({});
  const [currentAngle,    setCurrentAngle]    = useState(null);
  const [currentCaptures, setCurrentCaptures] = useState(0);
  const [status,          setStatus]          = useState("init");
  const [message,         setMessage]         = useState("Positionnez votre visage");
  const [hint,            setHint]            = useState("");
  const [hintType,        setHintType]        = useState("warn");
  const [ringColor,       setRingColor]       = useState("#94a3b8");

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
      setCurrentAngle("face");
      setMessage("Regardez droit devant");
    } catch (err) {
      setStatus("error");
      setHint("Camera inaccessible : " + err.message);
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
  }, [status, totalCaptured, currentAngle]);

  const captureFrame = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;
    if (finalizing.current || capturing.current) return;
    if (totalCaptured >= TOTAL_CAPTURES) return;

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
          const n = data.total_captured;
          setTotalCaptured(n);
          setRingColor("#6366f1");

          // Mettre à jour les compteurs par angle
          if (data.current_angle) {
            setAngleCounts(prev => ({
              ...prev,
              [data.current_angle.label.split("_")[0] === "diagonal"
                ? data.current_angle.label
                : data.current_angle.label]: data.current_angle.captures
            }));
            setCurrentCaptures(data.current_angle.captures);

            // Angle complété → passer au suivant
            if (data.current_angle.done && data.next_angle?.label) {
              setCurrentAngle(data.next_angle.label);
              setMessage(data.next_angle.instruction);
              setHint(`✓ ${ANGLE_LABELS[data.current_angle.label] || data.current_angle.label} complete !`);
              setHintType("ok");
              setCurrentCaptures(0);
              setTimeout(() => setHint(""), 1500);
            } else {
              setHint(`✓ Capture ${data.current_angle.captures}/${CAPTURES_PER_ANGLE}`);
              setHintType("ok");
              setTimeout(() => setHint(""), 600);
            }
          }

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
          setTimeout(() => setRingColor("#6366f1"), 600);
        }
      } catch {
        setHint("Erreur reseau...");
        setHintType("warn");
      } finally {
        capturing.current = false;
      }
    }, "image/jpeg", 1.0);
  }, [totalCaptured, studentId, currentAngle]);

  const finalize = async () => {
    stopAll();
    try {
      const form = new FormData();
      form.append("student_id", studentId);
      await axios.post(`${API_URL}/api/enroll/finalize`, form);
      setStatus("done");
      setMessage("Enrolement reussi !");
      setRingColor("#22c55e");
      setTimeout(() => onComplete?.(), 2000);
    } catch (err) {
      setStatus("error");
      setHint(err.response?.data?.detail || "Erreur finalisation");
      finalizing.current = false;
    }
  };

  // ── Design ────────────────────────────────────────────────────────────────
  const R      = 120;
  const C      = 2 * Math.PI * R;
  const offset = C * (1 - totalCaptured / TOTAL_CAPTURES);

  return (
    <div style={{
      minHeight: "100vh", background: "#f8f7ff",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      padding: "16px", gap: "16px",
    }}>

      {/* Titre */}
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: "20px", fontWeight: 700, color: "#1e1b4b", margin: 0 }}>
          Enrolement facial
        </h1>
        <p style={{ color: "#94a3b8", fontSize: "12px", margin: "4px 0 0" }}>
          SmartCampus IA — {totalCaptured}/{TOTAL_CAPTURES} captures
        </p>
      </div>

      {/* Grille des 7 angles */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center", maxWidth: 340 }}>
        {ANGLES_ORDER.map((label) => {
          const count   = angleCounts[label] || 0;
          const done    = count >= CAPTURES_PER_ANGLE;
          const current = currentAngle === label && status === "capturing";
          return (
            <div key={label} style={{
              width: 44, height: 52,
              borderRadius: 10,
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              background: done ? "#6366f1" : current ? "#e0e7ff" : "#f1f5f9",
              border: current ? "2px solid #6366f1" : "2px solid transparent",
              transition: "all 0.3s",
            }}>
              <span style={{ fontSize: 16, color: done ? "white" : current ? "#6366f1" : "#94a3b8" }}>
                {done ? "✓" : ANGLE_ICONS[label]}
              </span>
              <span style={{ fontSize: 8, color: done ? "white" : "#94a3b8", marginTop: 2 }}>
                {ANGLE_LABELS[label]}
              </span>
              {!done && (
                <span style={{ fontSize: 8, color: current ? "#6366f1" : "#94a3b8" }}>
                  {count}/{CAPTURES_PER_ANGLE}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Cercle + vidéo */}
      <div style={{ position: "relative", width: 280, height: 280 }}>
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%,-50%)",
          width: 220, height: 220, borderRadius: "50%",
          overflow: "hidden", background: "#0f0f1a", zIndex: 1,
        }}>
          <video ref={videoRef} autoPlay playsInline muted style={{
            width: "100%", height: "100%", objectFit: "cover",
            transform: "scaleX(-1)",
            display: status === "error" ? "none" : "block",
          }} />

          {/* Flèche guidage sur vidéo */}
          {status === "capturing" && currentAngle && (
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              pointerEvents: "none",
            }}>
              <span style={{ fontSize: 52, opacity: 0.35, color: "white" }}>
                {ANGLE_ICONS[currentAngle]}
              </span>
            </div>
          )}

          {status === "done" && (
            <div style={{
              position: "absolute", inset: 0,
              background: "rgba(34,197,94,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 64,
            }}>✓</div>
          )}
        </div>

        {/* SVG progression */}
        <svg width={280} height={280} style={{ position: "absolute", top: 0, left: 0, zIndex: 2 }}>
          <circle cx={140} cy={140} r={R} fill="none" stroke="#e2e8f0" strokeWidth={5} />
          <circle
            cx={140} cy={140} r={R} fill="none"
            stroke={ringColor} strokeWidth={6} strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={offset}
            transform="rotate(-90 140 140)"
            style={{ transition: "stroke-dashoffset 0.4s ease, stroke 0.3s ease" }}
          />

          {/* Mini barres de progression par angle autour du cercle */}
          {ANGLES_ORDER.map((label, i) => {
            const a       = (i / TOTAL_ANGLES) * 2 * Math.PI - Math.PI / 2;
            const count   = angleCounts[label] || 0;
            const done    = count >= CAPTURES_PER_ANGLE;
            const current = currentAngle === label;
            const x = 140 + R * Math.cos(a);
            const y = 140 + R * Math.sin(a);
            return (
              <circle key={label}
                cx={x} cy={y}
                r={done ? 9 : current ? 7 : 5}
                fill={done ? "#6366f1" : current ? "#a5b4fc" : "#e2e8f0"}
                stroke="#f8f7ff" strokeWidth={2}
                style={{ transition: "all 0.4s ease" }}
              />
            );
          })}
        </svg>

        <canvas ref={canvasRef} style={{ display: "none" }} />
      </div>

      {/* Barre progression angle actuel */}
      {status === "capturing" && currentAngle && (
        <div style={{ width: 280 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#1e1b4b" }}>
              {ANGLE_ICONS[currentAngle]} {ANGLE_LABELS[currentAngle]}
            </span>
            <span style={{ fontSize: 12, color: "#94a3b8" }}>
              {currentCaptures}/{CAPTURES_PER_ANGLE}
            </span>
          </div>
          <div style={{ background: "#e2e8f0", borderRadius: 99, height: 6 }}>
            <div style={{
              width: `${(currentCaptures / CAPTURES_PER_ANGLE) * 100}%`,
              background: "#6366f1", height: 6, borderRadius: 99,
              transition: "width 0.4s ease"
            }} />
          </div>
        </div>
      )}

      {/* Messages */}
      <div style={{ textAlign: "center", minHeight: 50 }}>
        <p style={{ fontSize: "16px", fontWeight: 700, color: "#1e1b4b", margin: 0 }}>
          {message}
        </p>
        {hint && (
          <p style={{
            fontSize: "13px", fontWeight: 600, margin: "4px 0 0",
            color: hintType === "ok" ? "#22c55e" : "#f59e0b",
          }}>
            {hint}
          </p>
        )}
        {status === "finalizing" && (
          <div style={{
            width: 24, height: 24, borderRadius: "50%",
            border: "3px solid #e2e8f0", borderTop: `3px solid ${ringColor}`,
            animation: "spin 0.7s linear infinite",
            margin: "10px auto 0",
          }} />
        )}
        {status === "error" && (
          <p style={{ color: "#ef4444", fontSize: "13px", marginTop: 6 }}>{hint}</p>
        )}
      </div>

      {/* Instruction */}
      {status === "capturing" && (
        <div style={{
          background: "white", borderRadius: 12, padding: "10px 16px",
          boxShadow: "0 4px 16px rgba(99,102,241,0.08)",
          maxWidth: 280, textAlign: "center",
        }}>
          <p style={{ color: "#64748b", fontSize: "12px", margin: 0, lineHeight: 1.6 }}>
            📸 Restez immobile lors de chaque capture<br/>
            🔄 7 angles × 5 captures = 35 photos au total
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