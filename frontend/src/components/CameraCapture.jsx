import { useRef, useEffect, useState } from "react"
import axios from "axios"

const API_URL            = ""
const CAPTURES_PER_ANGLE  = 5
const CAPTURE_DELAY_MS    = 80    // délai entre captures (après réponse backend)
const ANGLE_TIMEOUT_MS    = 15000 // après 15s bloqué → bouton "Passer"
const MIN_TO_SKIP         = 1     // captures minimum pour skiper un angle

const ANGLES = [
  { id: "face",   label: "Face",   arrow: null, instruction: "Regardez droit devant",       color: "#6366f1" },
  { id: "gauche", label: "Gauche", arrow: "←",  instruction: "Tournez la tête à gauche",    color: "#8b5cf6" },
  { id: "droite", label: "Droite", arrow: "→",  instruction: "Tournez la tête à droite",    color: "#a78bfa" },
  { id: "haut",   label: "Haut",   arrow: "↑",  instruction: "Levez légèrement la tête",    color: "#818cf8" },
  { id: "bas",    label: "Bas",    arrow: "↓",  instruction: "Baissez légèrement la tête",  color: "#c4b5fd" },
]

const TOTAL_CAPTURES = CAPTURES_PER_ANGLE * ANGLES.length  // 25

// ── Couleurs selon le statut ───────────────────────────────────────────────────
const ST = {
  INIT:     { border: "#334155", text: "#94a3b8",  label: "Initialisation…" },
  WAIT:     { border: "#6366f1", text: "#a5b4fc",  label: "Prêt…" },
  GOOD:     { border: "#10b981", text: "#34d399",  label: "Bonne position ✓" },
  BAD_POSE: { border: "#f59e0b", text: "#fbbf24",  label: "Mauvais angle" },
  NO_FACE:  { border: "#ef4444", text: "#f87171",  label: "Visage non détecté" },
  UNSTABLE: { border: "#f97316", text: "#fb923c",  label: "Stabilisez la tête" },
  LOW_QUAL: { border: "#dc2626", text: "#fca5a5",  label: "Qualité insuffisante" },
  DONE:     { border: "#10b981", text: "#34d399",  label: "Enrôlement terminé !" },
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

export default function CameraCapture({ studentId, onComplete }) {
  const videoRef       = useRef(null)
  const canvasRef      = useRef(null)
  const sessionRef     = useRef(null)
  const runningRef     = useRef(false)
  const angleIdxRef    = useRef(0)
  const countsRef      = useRef({})
  const angleStartRef  = useRef(Date.now())  // timestamp début angle courant

  const [phase,        setPhase]      = useState("INIT")
  const [countdown,    setCountdown]  = useState(3)
  const [angleIdx,     setAngleIdx]   = useState(0)
  const [captures,     setCaptures]   = useState({})
  const [statusKey,    setStatusKey]  = useState("INIT")
  const [statusMsg,    setStatusMsg]  = useState("")
  const [quality,      setQuality]    = useState({ sharpness: 0, brightness: 0, stability: 100 })
  const [error,        setError]      = useState("")
  const [flashAngle,   setFlashAngle] = useState(false)
  const [timeoutReady, setTimeoutReady] = useState(false)  // bouton "Passer" visible

  const angle     = ANGLES[angleIdx]
  const totalDone = Object.values(captures).reduce((a, b) => a + b, 0)
  const progress  = Math.round(totalDone / TOTAL_CAPTURES * 100)
  const angleDone = captures[angle?.id] || 0
  const st        = ST[statusKey] || ST.WAIT

  // ── 1. Init caméra + session puis countdown ───────────────────────────────
  useEffect(() => {
    let active = true

    const init = async () => {
      // Caméra
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }
        })
        if (!active) { stream.getTracks().forEach(t => t.stop()); return }
        if (videoRef.current) videoRef.current.srcObject = stream
      } catch {
        if (active) setError("Accès caméra refusé — autorisez l'accès dans les paramètres.")
        return
      }

      // Session backend
      try {
        const res = await axios.post(`${API_URL}/api/enrollment/start`, { student_id: studentId })
        if (!active) {
          axios.delete(`${API_URL}/api/enrollment/cancel/${res.data.session_id}`).catch(() => {})
          return
        }
        sessionRef.current = res.data.session_id
      } catch (err) {
        const d = err.response?.data?.detail
        if (active) setError(typeof d === "string" ? d : "Erreur de démarrage de session")
        return
      }

      // Countdown 3…2…1
      setPhase("COUNTDOWN")
      for (let i = 3; i >= 1; i--) {
        if (!active) return
        setCountdown(i)
        await sleep(1000)
      }
      if (!active) return
      setPhase("RUNNING")
      setStatusKey("BAD_POSE")
      setStatusMsg(ANGLES[0].instruction)
    }

    init()
    return () => {
      active = false
      videoRef.current?.srcObject?.getTracks().forEach(t => t.stop())
      if (sessionRef.current) {
        axios.delete(`${API_URL}/api/enrollment/cancel/${sessionRef.current}`).catch(() => {})
        sessionRef.current = null
      }
    }
  }, [studentId])

  // ── 2. Boucle de capture (démarre quand phase = RUNNING) ─────────────────
  useEffect(() => {
    if (phase !== "RUNNING") return
    runningRef.current = true

    const loop = async () => {
      while (runningRef.current) {
        await captureOne()
        if (runningRef.current) await sleep(CAPTURE_DELAY_MS)
      }
    }
    loop()

    return () => { runningRef.current = false }
  }, [phase])

  // ── Reset timer + flash quand l'angle change ─────────────────────────────
  useEffect(() => {
    angleStartRef.current = Date.now()
    setTimeoutReady(false)
    setFlashAngle(true)
    const t = setTimeout(() => setFlashAngle(false), 800)
    return () => clearTimeout(t)
  }, [angleIdx])

  // ── Timer "Passer" : si bloqué > ANGLE_TIMEOUT_MS sans atteindre 5 captures ─
  useEffect(() => {
    if (phase !== "RUNNING") return
    const id = setInterval(() => {
      const elapsed  = Date.now() - angleStartRef.current
      const curCount = countsRef.current[ANGLES[angleIdxRef.current]?.id] || 0
      if (elapsed > ANGLE_TIMEOUT_MS && curCount < CAPTURES_PER_ANGLE) {
        setTimeoutReady(true)
      }
    }, 1000)
    return () => clearInterval(id)
  }, [phase])

  // ── Capture d'une frame ───────────────────────────────────────────────────
  const captureOne = async () => {
    if (!runningRef.current || !sessionRef.current) return
    if (!videoRef.current || !canvasRef.current) return

    const curIdx = angleIdxRef.current
    const curAng = ANGLES[curIdx]
    if (!curAng) return

    const video  = videoRef.current
    const canvas = canvasRef.current
    canvas.width  = video.videoWidth  || 640
    canvas.height = video.videoHeight || 480
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height)
    const b64 = canvas.toDataURL("image/jpeg", 0.88).split(",")[1]

    try {
      const { data } = await axios.post(`${API_URL}/api/enrollment/capture`, {
        session_id: sessionRef.current,
        image_b64:  b64,
        angle:      curAng.id,
      })

      // Barres de qualité
      if (data.sharpness_pct !== undefined) {
        setQuality({
          sharpness:  data.sharpness_pct  ?? 0,
          brightness: data.brightness_pct ?? 0,
          stability:  data.stability_pct  ?? 100,
        })
      }

      if (!data.ok) {
        const reason = data.reason || ""
        if      (reason.includes("Stabilisez"))                             setStatusKey("UNSTABLE")
        else if (reason.includes("floue") || reason.includes("éclairage")) setStatusKey("LOW_QUAL")
        else if (reason.includes("Visage") || reason.includes("détecté"))  setStatusKey("NO_FACE")
        else                                                                setStatusKey("BAD_POSE")
        // Pour haut/bas : si le visage n'est pas détecté, encourager à revenir plus près
        const isVertical = curAng.id === "haut" || curAng.id === "bas"
        const msg = isVertical && reason.includes("détecté")
          ? "Restez dans l'ovale et inclinez doucement"
          : reason || curAng.instruction
        setStatusMsg(msg)
        return
      }

      // ✓ capture acceptée
      setStatusKey("GOOD")
      setStatusMsg("✓")

      countsRef.current[curAng.id] = (countsRef.current[curAng.id] || 0) + 1
      const newCount = countsRef.current[curAng.id]
      setCaptures(prev => ({ ...prev, [curAng.id]: newCount }))

      if (newCount >= CAPTURES_PER_ANGLE) {
        const nextIdx = curIdx + 1
        if (nextIdx < ANGLES.length) {
          angleIdxRef.current = nextIdx
          setAngleIdx(nextIdx)
          setStatusKey("BAD_POSE")
          setStatusMsg(ANGLES[nextIdx].instruction)
        } else {
          // Tous les angles complétés → finalisation automatique
          runningRef.current = false
          await finalize()
        }
      }
    } catch (err) {
      if (err?.response?.status === 404) {
        runningRef.current = false
        setError("Session expirée — rechargez la page.")
      }
    }
  }

  // ── Passer un angle bloqué ────────────────────────────────────────────────
  const skipAngle = () => {
    const curIdx  = angleIdxRef.current
    const nextIdx = curIdx + 1
    setTimeoutReady(false)
    if (nextIdx < ANGLES.length) {
      angleIdxRef.current = nextIdx
      setAngleIdx(nextIdx)
      setStatusKey("BAD_POSE")
      setStatusMsg(ANGLES[nextIdx].instruction)
    } else {
      runningRef.current = false
      finalize()
    }
  }

  // ── Finalisation ──────────────────────────────────────────────────────────
  const finalize = async () => {
    setPhase("FINALIZING")
    setStatusKey("DONE")
    try {
      const res = await axios.post(`${API_URL}/api/enrollment/finalize`, {
        session_id: sessionRef.current,
      })
      sessionRef.current = null
      onComplete(res.data.student_code || "")
    } catch (err) {
      const d = err.response?.data?.detail
      setError(typeof d === "string" ? d : "Erreur lors de la finalisation")
    }
  }

  // ── Écran d'erreur ────────────────────────────────────────────────────────
  if (error) return (
    <div style={{
      minHeight: "100vh", background: "#020617",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: '"Inter",system-ui,sans-serif', padding: 24,
    }}>
      <div style={{
        maxWidth: 380, width: "100%", textAlign: "center",
        background: "#0f172a", border: "1px solid rgba(239,68,68,0.25)",
        borderRadius: 20, padding: "40px 32px",
      }}>
        <div style={{ fontSize: 44, marginBottom: 16 }}>⚠️</div>
        <h3 style={{ color: "#f1f5f9", margin: "0 0 12px", fontSize: 18, fontWeight: 600 }}>Erreur</h3>
        <p style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.6, margin: 0 }}>{error}</p>
      </div>
    </div>
  )

  // ── Rendu principal ───────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: "100vh", background: "#020617",
      fontFamily: '"Inter",system-ui,sans-serif', color: "#f1f5f9",
      display: "flex", flexDirection: "column",
      maxWidth: 480, margin: "0 auto",
    }}>
      <style>{`
        @keyframes pulseRing {
          0%,100% { transform:scale(1);    opacity:0.9 }
          50%      { transform:scale(1.03); opacity:1   }
        }
        @keyframes fadeSlide {
          from { opacity:0; transform:translateY(-8px) }
          to   { opacity:1; transform:translateY(0)    }
        }
        @keyframes blink {
          0%,100% { opacity:1 }
          50%     { opacity:0.25 }
        }
        @keyframes arrowPulse {
          0%,100% { transform:scale(1);    opacity:0.7 }
          50%      { transform:scale(1.15); opacity:1   }
        }
        @keyframes checkPop {
          0%   { transform:scale(0.5); opacity:0 }
          60%  { transform:scale(1.2); opacity:1 }
          100% { transform:scale(1);   opacity:1 }
        }
      `}</style>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{
        padding: "12px 18px", display: "flex", alignItems: "center",
        justifyContent: "space-between",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        background: "rgba(2,6,23,0.95)", backdropFilter: "blur(12px)",
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: `linear-gradient(135deg,${angle?.color || "#6366f1"},#818cf8)`,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
          }}>🎓</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>SmartCampus IA</div>
            <div style={{ fontSize: 10, color: "#475569" }}>Enrôlement facial</div>
          </div>
        </div>
        <div style={{
          background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)",
          borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: 600, color: "#a5b4fc",
        }}>
          {phase === "FINALIZING" ? "Finalisation…" : `Angle ${Math.min(angleIdx + 1, ANGLES.length)} / ${ANGLES.length}`}
        </div>
      </div>

      {/* ── Vue caméra ──────────────────────────────────────────────────────── */}
      <div style={{
        position: "relative", margin: "12px 12px 0",
        borderRadius: 18, overflow: "hidden",
        aspectRatio: "4/3", background: "#0f172a", flexShrink: 0,
        boxShadow: `0 0 0 2px ${st.border}60, 0 0 24px ${st.border}20`,
        transition: "box-shadow 0.35s ease",
      }}>
        <video ref={videoRef} autoPlay playsInline muted style={{
          width: "100%", height: "100%", objectFit: "cover",
          transform: "scaleX(-1)", display: "block",
        }} />
        <canvas ref={canvasRef} style={{ display: "none" }} />

        {/* Ovale guide + masque */}
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
             viewBox="0 0 100 75" preserveAspectRatio="none">
          <defs>
            <mask id="oval-mask">
              <rect width="100" height="75" fill="white" />
              <ellipse cx="50" cy="36" rx="25" ry="31" fill="black" />
            </mask>
          </defs>
          <rect width="100" height="75" fill="rgba(2,6,23,0.50)" mask="url(#oval-mask)" />
          <ellipse cx="50" cy="36" rx="25" ry="31"
            fill="none" stroke={st.border} strokeWidth="0.7"
            style={{
              transition: "stroke 0.35s",
              animation: statusKey === "GOOD" ? "pulseRing 0.9s ease-in-out infinite" : "none",
            }}
          />
        </svg>

        {/* ── Countdown overlay ────────────────────────────────────────── */}
        {phase === "COUNTDOWN" && (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            background: "rgba(2,6,23,0.7)", backdropFilter: "blur(4px)",
          }}>
            <div style={{
              fontSize: 72, fontWeight: 800, color: "#6366f1",
              animation: "blink 1s step-start infinite",
              lineHeight: 1,
            }}>{countdown}</div>
            <div style={{ fontSize: 14, color: "#94a3b8", marginTop: 12 }}>
              Positionnez votre visage dans l'ovale
            </div>
          </div>
        )}

        {/* ── Overlay finalisation ─────────────────────────────────────── */}
        {phase === "FINALIZING" && (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            background: "rgba(2,6,23,0.85)", backdropFilter: "blur(6px)",
          }}>
            <div style={{
              fontSize: 56, animation: "checkPop 0.5s ease",
              marginBottom: 12,
            }}>✅</div>
            <div style={{ fontSize: 15, color: "#34d399", fontWeight: 600 }}>
              Enregistrement en cours…
            </div>
          </div>
        )}

        {/* ── Grande flèche de direction ───────────────────────────────── */}
        {phase === "RUNNING" && angle?.arrow && (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            pointerEvents: "none",
            animation: flashAngle ? "arrowPulse 0.4s ease 2" : "arrowPulse 2s ease-in-out infinite",
          }}>
            <div style={{
              fontSize: 64, lineHeight: 1,
              color: st.border,
              textShadow: `0 0 20px ${st.border}`,
              opacity: statusKey === "GOOD" ? 0.3 : 0.85,
              transition: "opacity 0.3s",
            }}>{angle.arrow}</div>
          </div>
        )}

        {/* ── Statut (bas de la caméra) ────────────────────────────────── */}
        {phase === "RUNNING" && (
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0,
            padding: "8px 14px 10px",
            background: "linear-gradient(transparent, rgba(2,6,23,0.92))",
          }}>
            {/* Barres qualité */}
            <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
              <QualBar label="Netteté"   value={quality.sharpness}  color="#34d399" />
              <QualBar label="Lumière"   value={quality.brightness} color="#60a5fa" />
              <QualBar label="Stabilité" value={quality.stability}  color="#f59e0b" />
            </div>
            {/* Message statut */}
            <div style={{
              textAlign: "center", fontSize: 12, fontWeight: 600,
              color: st.text,
              animation: "fadeSlide 0.2s ease",
            }}>
              {statusMsg || st.label}
            </div>
          </div>
        )}
      </div>

      {/* ── Instruction angle actuel ─────────────────────────────────────────── */}
      {phase === "RUNNING" && angle && (
        <div style={{
          margin: "10px 12px 0",
          background: "rgba(15,23,42,0.8)", border: `1px solid ${angle.color}30`,
          borderLeft: `3px solid ${angle.color}`,
          borderRadius: 12, padding: "12px 16px",
          display: "flex", alignItems: "center", gap: 14,
          animation: flashAngle ? "fadeSlide 0.3s ease" : "none",
        }}>
          {/* Icône direction */}
          <div style={{
            width: 44, height: 44, borderRadius: 11,
            background: `${angle.color}20`, border: `1px solid ${angle.color}40`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: angle.arrow ? 26 : 18, flexShrink: 0,
            color: angle.color,
          }}>
            {angle.arrow || "●"}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0", marginBottom: 3 }}>
              {angle.instruction}
            </div>
            {/* Mini progress bar captures */}
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              {Array.from({ length: CAPTURES_PER_ANGLE }).map((_, i) => (
                <div key={i} style={{
                  height: 5, flex: 1, borderRadius: 3,
                  background: i < angleDone ? angle.color : "rgba(255,255,255,0.08)",
                  transition: "background 0.25s",
                }} />
              ))}
              <span style={{ fontSize: 10, color: "#64748b", marginLeft: 4, minWidth: 28 }}>
                {angleDone}/{CAPTURES_PER_ANGLE}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Bouton "Passer" si bloqué trop longtemps ────────────────────────── */}
      {timeoutReady && phase === "RUNNING" && (
        <div style={{
          margin: "8px 12px 0", padding: "10px 14px",
          background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)",
          borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "space-between",
          animation: "fadeSlide 0.3s ease",
        }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#fbbf24" }}>
              Difficile à détecter ?
            </div>
            <div style={{ fontSize: 10, color: "#78716c", marginTop: 2 }}>
              {angleDone > 0 ? `${angleDone} capture(s) enregistrée(s)` : "Angle optionnel"}
            </div>
          </div>
          <button onClick={skipAngle} style={{
            padding: "7px 14px", border: "1px solid rgba(245,158,11,0.4)",
            borderRadius: 8, background: "rgba(245,158,11,0.12)",
            color: "#fbbf24", fontSize: 12, fontWeight: 600, cursor: "pointer",
          }}>
            Passer →
          </button>
        </div>
      )}

      {/* ── Progression globale ──────────────────────────────────────────────── */}
      <div style={{
        margin: "10px 12px 0",
        background: "rgba(15,23,42,0.6)", borderRadius: 12, padding: "10px 14px",
      }}>
        <div style={{
          display: "flex", justifyContent: "space-between",
          fontSize: 11, color: "#475569", marginBottom: 7, fontWeight: 500,
        }}>
          <span>Progression globale</span>
          <span style={{ color: "#6366f1", fontWeight: 700 }}>{progress}%</span>
        </div>
        <div style={{ height: 4, background: "rgba(255,255,255,0.05)", borderRadius: 4 }}>
          <div style={{
            height: "100%", width: `${progress}%`,
            background: "linear-gradient(90deg,#4f46e5,#818cf8)",
            borderRadius: 4, transition: "width 0.4s ease",
          }} />
        </div>

        {/* Dots angles */}
        <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 12 }}>
          {ANGLES.map((a, i) => {
            const done   = (captures[a.id] || 0) >= CAPTURES_PER_ANGLE
            const active = i === angleIdx && phase === "RUNNING"
            return (
              <div key={a.id} title={a.label} style={{
                flex: 1, maxWidth: 52, height: 36, borderRadius: 8,
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: 1,
                fontSize: done ? 14 : 16,
                border: `1.5px solid ${done ? "#10b981" : active ? a.color : "rgba(255,255,255,0.06)"}`,
                background: done ? "rgba(16,185,129,0.08)" : active ? `${a.color}18` : "transparent",
                color: done ? "#10b981" : active ? a.color : "#334155",
                transition: "all 0.3s ease",
                transform: active ? "scale(1.08)" : "scale(1)",
              }}>
                <span>{done ? "✓" : (a.arrow || "●")}</span>
                <span style={{ fontSize: 8, opacity: 0.6 }}>{a.label}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Message bas de page ──────────────────────────────────────────────── */}
      <div style={{ padding: "12px 16px 24px", textAlign: "center" }}>
        {phase === "INIT" && (
          <p style={{ color: "#334155", fontSize: 12, margin: 0 }}>
            Initialisation de la caméra…
          </p>
        )}
        {phase === "COUNTDOWN" && (
          <p style={{ color: "#6366f1", fontSize: 13, fontWeight: 600, margin: 0 }}>
            Centrez votre visage dans l'ovale
          </p>
        )}
        {phase === "RUNNING" && (
          <p style={{ color: "#1e293b", fontSize: 11, margin: 0, lineHeight: 1.5 }}>
            L'enrôlement s'effectue automatiquement · Bougez lentement la tête
          </p>
        )}
        {phase === "FINALIZING" && (
          <p style={{ color: "#34d399", fontSize: 13, fontWeight: 600, margin: 0 }}>
            ⏳ Calcul des embeddings en cours…
          </p>
        )}
      </div>
    </div>
  )
}

function QualBar({ label, value, color }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{
        display: "flex", justifyContent: "space-between",
        fontSize: 9, color: "#475569", marginBottom: 3, fontWeight: 600,
      }}>
        <span>{label}</span>
        <span style={{ color }}>{Math.round(value)}%</span>
      </div>
      <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 3 }}>
        <div style={{
          height: "100%", width: `${Math.min(value, 100)}%`,
          background: color, borderRadius: 3, transition: "width 0.3s",
        }} />
      </div>
    </div>
  )
}
