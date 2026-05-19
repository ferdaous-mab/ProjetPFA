import { useRef, useEffect, useState } from "react"
import axios from "axios"

const API_URL            = ""
const CAPTURES_PER_ANGLE  = 5
const CAPTURE_DELAY_MS    = 80
const ANGLE_TIMEOUT_MS    = 15000
const MIN_TO_SKIP         = 1

const ANGLES = [
  { id: "face",   label: "Face",   arrow: null, instruction: "Regardez droit devant",       color: "#6366f1" },
  { id: "gauche", label: "Gauche", arrow: "←",  instruction: "Tournez la tête à gauche",    color: "#8b5cf6" },
  { id: "droite", label: "Droite", arrow: "→",  instruction: "Tournez la tête à droite",    color: "#a78bfa" },
  { id: "haut",   label: "Haut",   arrow: "↑",  instruction: "Levez légèrement la tête",    color: "#818cf8" },
  { id: "bas",    label: "Bas",    arrow: "↓",  instruction: "Baissez légèrement la tête",  color: "#c4b5fd" },
]

const TOTAL_CAPTURES = CAPTURES_PER_ANGLE * ANGLES.length  // 25

// Progress ring geometry
const RING_SIZE = 290
const STROKE    = 6
const RADIUS    = (RING_SIZE / 2) - STROKE
const CIRC      = 2 * Math.PI * RADIUS

// Status ring colors (quality details stay hidden from user)
const ST = {
  INIT:     { ring: "rgba(255,255,255,0.08)", glow: "transparent"    },
  WAIT:     { ring: "#6366f1",                glow: "#6366f130"       },
  GOOD:     { ring: "#10b981",                glow: "#10b98135"       },
  BAD_POSE: { ring: "#6366f1",                glow: "#6366f130"       },
  NO_FACE:  { ring: "#ef4444",                glow: "#ef444430"       },
  UNSTABLE: { ring: "#f97316",                glow: "#f9731630"       },
  LOW_QUAL: { ring: "#f97316",                glow: "#f9731630"       },
  DONE:     { ring: "#10b981",                glow: "#10b98140"       },
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

export default function CameraCapture({ studentId, onComplete }) {
  const videoRef       = useRef(null)
  const canvasRef      = useRef(null)
  const sessionRef     = useRef(null)
  const runningRef     = useRef(false)
  const angleIdxRef    = useRef(0)
  const countsRef      = useRef({})
  const angleStartRef  = useRef(Date.now())

  const [phase,        setPhase]      = useState("INIT")
  const [countdown,    setCountdown]  = useState(3)
  const [angleIdx,     setAngleIdx]   = useState(0)
  const [captures,     setCaptures]   = useState({})
  const [statusKey,    setStatusKey]  = useState("INIT")
  const [statusMsg,    setStatusMsg]  = useState("")
  const [quality,      setQuality]    = useState({ sharpness: 0, brightness: 0, stability: 100 })
  const [error,        setError]      = useState("")
  const [flashAngle,   setFlashAngle] = useState(false)
  const [timeoutReady, setTimeoutReady] = useState(false)

  const angle     = ANGLES[angleIdx]
  const totalDone = Object.values(captures).reduce((a, b) => a + b, 0)
  const progress  = Math.round(totalDone / TOTAL_CAPTURES * 100)
  const angleDone = captures[angle?.id] || 0
  const st        = ST[statusKey] || ST.WAIT

  // Ring offset: 0% → full gap, 100% → no gap
  const ringOffset = CIRC - (progress / 100) * CIRC

  // ── 1. Init caméra + session puis countdown ───────────────────────────────
  useEffect(() => {
    let active = true

    const init = async () => {
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

  // ── 2. Boucle de capture ──────────────────────────────────────────────────
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

  // ── Flash + reset timer sur changement d'angle ────────────────────────────
  useEffect(() => {
    angleStartRef.current = Date.now()
    setTimeoutReady(false)
    setFlashAngle(true)
    const t = setTimeout(() => setFlashAngle(false), 800)
    return () => clearTimeout(t)
  }, [angleIdx])

  // ── Timer "Passer" ────────────────────────────────────────────────────────
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

      // Qualité trackée silencieusement (non affichée)
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
        const isVertical = curAng.id === "haut" || curAng.id === "bas"
        let msg = reason || curAng.instruction
        if (isVertical && (reason.includes("Levez") || reason.includes("Baissez") || reason.includes("tête"))) {
          msg = curAng.id === "haut"
            ? "Levez le menton vers le haut — attendez la validation ✓"
            : "Baissez le menton vers le bas — attendez la validation ✓"
        } else if (isVertical && reason.includes("détecté")) {
          msg = "Restez dans l'ovale et inclinez doucement"
        }
        setStatusMsg(msg)
        return
      }

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
      minHeight: "100vh", background: "#000",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: '"-apple-system","SF Pro Display","Inter",system-ui,sans-serif',
      padding: 24,
    }}>
      <div style={{
        maxWidth: 340, width: "100%", textAlign: "center",
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(239,68,68,0.3)",
        borderRadius: 24, padding: "40px 28px",
        backdropFilter: "blur(20px)",
      }}>
        <div style={{ fontSize: 44, marginBottom: 16 }}>⚠️</div>
        <h3 style={{ color: "#fff", margin: "0 0 10px", fontSize: 18, fontWeight: 600 }}>Erreur</h3>
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, lineHeight: 1.6, margin: 0 }}>{error}</p>
      </div>
    </div>
  )

  // Arrow directional animation selector
  const arrowAnim = {
    "←": "arrowLeft 1.2s ease-in-out infinite",
    "→": "arrowRight 1.2s ease-in-out infinite",
    "↑": "arrowUp 1.2s ease-in-out infinite",
    "↓": "arrowDown 1.2s ease-in-out infinite",
  }

  // ── Rendu principal ───────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: "100vh",
      background: "#000",
      fontFamily: '"-apple-system","SF Pro Display","Inter",system-ui,sans-serif',
      color: "#fff",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "52px 28px 44px",
      maxWidth: 480,
      margin: "0 auto",
      boxSizing: "border-box",
    }}>
      <style>{`
        @keyframes arrowLeft  { 0%,100%{transform:translateX(0)}  50%{transform:translateX(-12px)} }
        @keyframes arrowRight { 0%,100%{transform:translateX(0)}  50%{transform:translateX(12px)}  }
        @keyframes arrowUp    { 0%,100%{transform:translateY(0)}  50%{transform:translateY(-12px)} }
        @keyframes arrowDown  { 0%,100%{transform:translateY(0)}  50%{transform:translateY(12px)}  }
        @keyframes countPop   { 0%{transform:scale(0.7);opacity:0} 60%{transform:scale(1.1)} 100%{transform:scale(1);opacity:1} }
        @keyframes checkPop   { 0%{transform:scale(0.4);opacity:0} 60%{transform:scale(1.25);opacity:1} 100%{transform:scale(1)} }
        @keyframes scanPulse  { 0%,100%{opacity:0.7} 50%{opacity:1} }
        @keyframes fadeIn     { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes dotPulse   { 0%,100%{transform:scale(1)} 50%{transform:scale(1.15)} }
      `}</style>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: -0.8, color: "#fff" }}>
          Face ID
        </div>
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", marginTop: 4, fontWeight: 400 }}>
          {phase === "FINALIZING"
            ? "Finalisation…"
            : phase === "COUNTDOWN"
            ? "Positionnez votre visage"
            : phase === "RUNNING"
            ? `Étape ${Math.min(angleIdx + 1, ANGLES.length)} / ${ANGLES.length}`
            : "Initialisation…"
          }
        </div>
      </div>

      {/* ── Cercle principal ────────────────────────────────────────────────── */}
      <div style={{ position: "relative", width: RING_SIZE, height: RING_SIZE, flexShrink: 0 }}>

        {/* SVG progress ring */}
        <svg
          width={RING_SIZE}
          height={RING_SIZE}
          style={{
            position: "absolute", inset: 0, zIndex: 2,
            transform: "rotate(-90deg)",
            filter: progress > 0 ? `drop-shadow(0 0 8px ${st.ring})` : "none",
            transition: "filter 0.4s ease",
          }}
        >
          {/* Track (fond de l'anneau) */}
          <circle
            cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RADIUS}
            fill="none"
            stroke="rgba(255,255,255,0.07)"
            strokeWidth={STROKE}
          />
          {/* Arc de progression */}
          <circle
            cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RADIUS}
            fill="none"
            stroke={st.ring}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={ringOffset}
            style={{ transition: "stroke-dashoffset 0.45s cubic-bezier(.4,0,.2,1), stroke 0.4s ease" }}
          />
        </svg>

        {/* Vidéo circulaire */}
        <div style={{
          position: "absolute",
          top: STROKE + 6, left: STROKE + 6,
          right: STROKE + 6, bottom: STROKE + 6,
          borderRadius: "50%",
          overflow: "hidden",
          background: "#111",
          zIndex: 1,
        }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: "100%", height: "100%",
              objectFit: "cover",
              transform: "scaleX(-1)",
              display: "block",
            }}
          />
          <canvas ref={canvasRef} style={{ display: "none" }} />
        </div>

        {/* ── Flèche de direction (uniquement le symbole, pas de texte) ─── */}
        {phase === "RUNNING" && angle?.arrow && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 3,
            display: "flex", alignItems: "center", justifyContent: "center",
            pointerEvents: "none",
          }}>
            <div style={{
              fontSize: 86,
              lineHeight: 1,
              color: "rgba(255,255,255,0.92)",
              textShadow: `0 0 28px ${st.ring}, 0 0 60px ${st.ring}80`,
              animation: arrowAnim[angle.arrow] || "none",
              opacity: statusKey === "GOOD" ? 0.15 : 0.9,
              transition: "opacity 0.35s ease",
              userSelect: "none",
            }}>
              {angle.arrow}
            </div>
          </div>
        )}

        {/* ── Overlay countdown ────────────────────────────────────────────── */}
        {phase === "COUNTDOWN" && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 4,
            borderRadius: "50%",
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{
              fontSize: 100, fontWeight: 800, color: "#fff",
              lineHeight: 1,
              animation: "countPop 0.35s cubic-bezier(.4,0,.2,1)",
            }}>
              {countdown}
            </div>
          </div>
        )}

        {/* ── Overlay finalisation ─────────────────────────────────────────── */}
        {phase === "FINALIZING" && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 4,
            borderRadius: "50%",
            background: "rgba(0,0,0,0.7)",
            backdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{
              fontSize: 80, color: "#10b981",
              animation: "checkPop 0.5s cubic-bezier(.4,0,.2,1)",
            }}>
              ✓
            </div>
          </div>
        )}

        {/* ── Badge pourcentage ────────────────────────────────────────────── */}
        {(phase === "RUNNING" || phase === "FINALIZING") && (
          <div style={{
            position: "absolute",
            bottom: -22,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 5,
            background: "rgba(255,255,255,0.07)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 24,
            padding: "5px 18px",
            fontSize: 14,
            fontWeight: 700,
            color: progress === 100 ? "#10b981" : "#fff",
            whiteSpace: "nowrap",
            transition: "color 0.4s ease",
            letterSpacing: -0.3,
          }}>
            {progress}%
          </div>
        )}
      </div>

      {/* ── Section basse ───────────────────────────────────────────────────── */}
      <div style={{
        width: "100%",
        display: "flex", flexDirection: "column",
        alignItems: "center", gap: 22,
      }}>

        {/* Indicateurs d'angles (traits) */}
        {phase === "RUNNING" && (
          <div style={{
            display: "flex", gap: 8, alignItems: "center",
            animation: "fadeIn 0.3s ease",
          }}>
            {ANGLES.map((a, i) => {
              const done   = (captures[a.id] || 0) >= CAPTURES_PER_ANGLE
              const active = i === angleIdx
              return (
                <div key={a.id} style={{
                  height: 5,
                  width: done ? 32 : active ? 32 : 22,
                  borderRadius: 3,
                  background: done
                    ? "#10b981"
                    : active
                    ? st.ring
                    : "rgba(255,255,255,0.12)",
                  transition: "all 0.35s cubic-bezier(.4,0,.2,1)",
                  animation: active ? "dotPulse 1.5s ease-in-out infinite" : "none",
                  boxShadow: active ? `0 0 8px ${st.ring}` : done ? "0 0 6px #10b98160" : "none",
                }} />
              )
            })}
          </div>
        )}

        {/* Bouton "Passer" si bloqué */}
        {timeoutReady && phase === "RUNNING" && (
          <button
            onClick={skipAngle}
            style={{
              padding: "14px 40px",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 50,
              background: "rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.85)",
              fontSize: 16,
              fontWeight: 600,
              cursor: "pointer",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              letterSpacing: -0.2,
              animation: "fadeIn 0.3s ease",
              transition: "background 0.2s",
            }}
            onMouseEnter={e => e.target.style.background = "rgba(255,255,255,0.14)"}
            onMouseLeave={e => e.target.style.background = "rgba(255,255,255,0.08)"}
          >
            Passer  →
          </button>
        )}

        {/* Texte bas de page */}
        <div style={{
          fontSize: 13,
          color: "rgba(255,255,255,0.3)",
          textAlign: "center",
          lineHeight: 1.5,
          letterSpacing: -0.1,
        }}>
          {phase === "INIT"       && "Initialisation de la caméra…"}
          {phase === "COUNTDOWN"  && "Centrez votre visage dans le cercle"}
          {phase === "RUNNING"    && "Bougez lentement dans la direction indiquée"}
          {phase === "FINALIZING" && "Enregistrement en cours…"}
        </div>
      </div>
    </div>
  )
}
