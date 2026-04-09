import { useState, useRef, useEffect, useCallback } from 'react'
import axios from 'axios'

const API_URL          = 'http://10.10.0.53:8000'
const TARGET_VALID     = 15
const CAPTURE_INTERVAL = 1500

const fonts     = `@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&display=swap');`
const keyframes = `
  @keyframes pulse { 0%{box-shadow:0 0 0 0 rgba(139,92,246,.5)} 70%{box-shadow:0 0 0 16px rgba(139,92,246,0)} 100%{box-shadow:0 0 0 0 rgba(139,92,246,0)} }
  @keyframes flash-anim { 0%{opacity:.4} 100%{opacity:0} }
  @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
`

export default function CameraCapture({ studentId, onComplete }) {
  const videoRef    = useRef(null)
  const canvasRef   = useRef(null)
  const streamRef   = useRef(null)
  const intervalRef = useRef(null)
  const busy        = useRef(false)
  const validCount  = useRef(0)

  const [phase,    setPhase]    = useState('init')
  const [countdown,setCountdown]= useState(3)
  const [valid,    setValid]    = useState(0)
  const [status,   setStatus]   = useState('Positionnez votre visage dans le cadre')
  const [flash,    setFlash]    = useState(false)
  const [errMsg,   setErrMsg]   = useState('')

  useEffect(() => {
    startCam()
    return () => cleanup()
  }, [])

  const cleanup = () => {
    clearInterval(intervalRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
  }

  const startCam = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { width:{ideal:1280}, height:{ideal:720}, facingMode:'user' }
      })
      streamRef.current = s
      if (videoRef.current) {
        videoRef.current.srcObject = s
        videoRef.current.onloadedmetadata = () => startCountdown()
      }
    } catch {
      setPhase('error')
      setErrMsg("Impossible d'accéder à la caméra")
    }
  }

  const startCountdown = () => {
    setPhase('countdown')
    let count = 3
    setCountdown(count)
    const cd = setInterval(() => {
      count -= 1
      setCountdown(count)
      if (count === 0) { clearInterval(cd); startCapturing() }
    }, 1000)
  }

  const startCapturing = () => {
    validCount.current = 0
    setValid(0)
    setPhase('capturing')
    setStatus('Tournez lentement la tête — gauche, droite, haut, bas')
    intervalRef.current = setInterval(() => captureFrame(), CAPTURE_INTERVAL)
  }

  const captureFrame = useCallback(async () => {
    if (busy.current || !canvasRef.current || !videoRef.current) return
    busy.current = true

    const c   = canvasRef.current
    const ctx = c.getContext('2d')
    c.width   = 320
    c.height  = 240
    ctx.drawImage(videoRef.current, 0, 0, 320, 240)

    c.toBlob(async blob => {
      try {
        const form = new FormData()
        form.append('student_id', studentId)
        form.append('image', blob, 'frame.jpg')

        const res = await axios.post(`${API_URL}/api/enroll/capture`, form)

        if (res.data.ok) {
          validCount.current += 1
          setValid(validCount.current)
          setFlash(true)
          setTimeout(() => setFlash(false), 200)
          setStatus(`Bonne capture — ${validCount.current}/${TARGET_VALID} frames valides`)

          if (validCount.current >= TARGET_VALID) {
            clearInterval(intervalRef.current)
            setPhase('finalizing')
            setStatus('Calcul du modèle facial en cours...')
            finalizeEnrollment()
          }
        } else {
          setStatus(res.data.reason || 'Ajustez votre position...')
        }
      } catch {
        setStatus('Ajustez votre position...')
      } finally {
        busy.current = false
      }
    }, 'image/jpeg', 0.80)
  }, [studentId])

  const finalizeEnrollment = async () => {
    try {
      const form = new FormData()
      form.append('student_id', studentId)
      const res = await axios.post(`${API_URL}/api/enroll/finalize`, form)
      if (res.data.ok) {
        streamRef.current?.getTracks().forEach(t => t.stop())
        setPhase('done')
      } else if (res.data.retry) {
        setErrMsg(res.data.detail)
        setPhase('retry')
      } else {
        setErrMsg(res.data.detail || 'Erreur lors de la finalisation')
        setPhase('error')
      }
    } catch (err) {
      setErrMsg(err.response?.data?.detail || 'Erreur — réessayez')
      setPhase('error')
    }
  }

  const retry = () => {
    validCount.current = 0
    setValid(0)
    setErrMsg('')
    startCountdown()
  }

  const progressPct = Math.round((valid / TARGET_VALID) * 100)

  if (phase === 'done') return (
    <div style={S.page}>
      <style>{fonts}</style>
      <div style={S.doneCard}>
        <div style={S.iconWrap('#10b981','rgba(16,185,129,0.1)','rgba(16,185,129,0.25)')}>✓</div>
        <h2 style={{ ...S.doneTitle, color:'#fff' }}>Enrôlement réussi !</h2>
        <p style={S.doneSub}>Votre modèle facial a été enregistré avec succès</p>
        <div style={S.statsRow}>
          <div style={S.statItem}><span style={S.statNum}>{valid}</span><span style={S.statLbl}>Frames valides</span></div>
          <div style={S.statDiv} />
          <div style={S.statItem}><span style={S.statNum}>15</span><span style={S.statLbl}>Meilleurs utilisés</span></div>
          <div style={S.statDiv} />
          <div style={S.statItem}><span style={S.statNum}>1</span><span style={S.statLbl}>Modèle final</span></div>
        </div>
        <div style={S.infoBox('rgba(16,185,129,0.05)','rgba(16,185,129,0.15)','rgba(16,185,129,0.8)')}>
          Vous pouvez maintenant être reconnu automatiquement
        </div>
        <button style={S.btn('#7c3aed','#4f46e5')} onClick={() => onComplete()}>Terminer</button>
      </div>
    </div>
  )

  if (phase === 'retry' || phase === 'error') return (
    <div style={S.page}>
      <style>{fonts}</style>
      <div style={S.doneCard}>
        <div style={S.iconWrap('#ef4444','rgba(239,68,68,0.1)','rgba(239,68,68,0.25)')}>⚠</div>
        <h2 style={{ ...S.doneTitle, color:'#fca5a5' }}>
          {phase === 'retry' ? 'Capture insuffisante' : 'Erreur'}
        </h2>
        <p style={S.doneSub}>{errMsg}</p>
        <div style={{ ...S.infoBox('rgba(239,68,68,0.05)','rgba(239,68,68,0.15)','rgba(239,68,68,0.7)'), marginBottom:'24px' }}>
          Assurez-vous d'être bien éclairé et de tourner lentement la tête
        </div>
        <button style={S.btn('#dc2626','#b91c1c')} onClick={retry}>Réessayer la capture</button>
      </div>
    </div>
  )

  return (
    <div style={S.page}>
      <style>{fonts + keyframes}</style>
      <div style={S.layout}>

        <div style={S.camPanel}>
          <div style={S.camWrap}>
            <video ref={videoRef} autoPlay muted playsInline style={S.video} />
            {flash && <div style={S.flash} />}

            <div style={S.ovalWrap}>
              <div style={{
                ...S.oval,
                borderColor: phase==='capturing' ? 'rgba(139,92,246,0.8)' : 'rgba(255,255,255,0.2)',
                animation: phase==='capturing' ? 'pulse 2s ease-out infinite' : 'none',
              }} />
            </div>

            {phase === 'countdown' && (
              <div style={S.overlay}>
                <div style={S.cdNum}>{countdown}</div>
                <div style={S.cdTxt}>Préparez-vous</div>
              </div>
            )}

            {phase === 'finalizing' && (
              <div style={S.overlay}>
                <div style={{ fontSize:'48px', marginBottom:'16px' }}>⚙</div>
                <div style={S.cdTxt}>Calcul du modèle facial...</div>
              </div>
            )}

            {phase === 'capturing' && (
              <div style={S.validBadge}>✓ {valid}/{TARGET_VALID}</div>
            )}

            <div style={S.statusBar}>{status}</div>
          </div>
          <canvas ref={canvasRef} style={{ display:'none' }} />
        </div>

        <div style={S.infoPanel}>
          <div style={S.logo}>
            <div style={S.logoIcon}>🎓</div>
            <span style={S.logoTxt}>SmartCampus IA</span>
          </div>

          <div>
            <h2 style={S.title}>Capture faciale</h2>
            <p style={S.subtitle}>
              Tournez lentement la tête dans toutes les directions.<br/>
              La capture s'arrête automatiquement quand {TARGET_VALID} frames valides sont enregistrées.
            </p>
          </div>

          {phase === 'capturing' && (
            <div style={S.progressBox}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'10px' }}>
                <span style={S.progressLbl}>Frames valides</span>
                <span style={{ fontSize:'13px', fontWeight:'700', color:'#a78bfa' }}>
                  {valid} / {TARGET_VALID}
                </span>
              </div>
              <div style={S.progressTrack}>
                <div style={{ ...S.progressFill, width:`${progressPct}%` }} />
              </div>
              <div style={{ fontSize:'12px', color:'rgba(255,255,255,0.3)', marginTop:'8px' }}>
                {TARGET_VALID - valid} frames restantes
              </div>
            </div>
          )}

          <div style={S.instrBox}>
            <div style={S.sectionTitle}>Comment faire</div>
            {[
              { icon:'●',  txt:'Regardez droit devant la caméra' },
              { icon:'◀▶', txt:'Tournez lentement gauche puis droite' },
              { icon:'▲▼', txt:'Inclinez la tête haut puis bas' },
              { icon:'◉',  txt:'Souriez naturellement' },
            ].map((item, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'10px' }}>
                <div style={{ width:'28px', height:'28px', borderRadius:'6px', background:'rgba(139,92,246,0.1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'11px', color:'#a78bfa', flexShrink:0 }}>
                  {item.icon}
                </div>
                <span style={{ fontSize:'12px', color:'rgba(255,255,255,0.5)', lineHeight:'1.4' }}>{item.txt}</span>
              </div>
            ))}
          </div>

          <div style={{ borderTop:'1px solid rgba(255,255,255,0.04)', paddingTop:'20px' }}>
            <div style={S.sectionTitle}>Conseils</div>
            {['Bonne luminosité recommandée', 'Restez dans le cadre ovale', 'Mouvement lent et régulier'].map((tip, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'7px' }}>
                <div style={{ width:'4px', height:'4px', borderRadius:'50%', background:'rgba(139,92,246,0.4)', flexShrink:0 }} />
                <span style={{ fontSize:'12px', color:'rgba(255,255,255,0.25)' }}>{tip}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

const S = {
  page:        { minHeight:'100vh', background:'#05050a', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'"Sora",sans-serif', padding:'20px' },
  layout:      { display:'flex', width:'100%', maxWidth:'960px', gap:'24px', alignItems:'stretch' },
  camPanel:    { flex:'1', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' },
  camWrap:     { position:'relative', borderRadius:'20px', overflow:'hidden', background:'#0d0d14', width:'100%', border:'1px solid rgba(255,255,255,0.06)' },
  video:       { width:'100%', display:'block', transform:'scaleX(-1)', borderRadius:'20px', minHeight:'360px', objectFit:'cover' },
  flash:       { position:'absolute', inset:0, background:'rgba(255,255,255,0.3)', animation:'flash-anim .2s ease-out forwards', pointerEvents:'none', borderRadius:'20px' },
  ovalWrap:    { position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none' },
  oval:        { width:'200px', height:'270px', borderRadius:'50%', border:'2px solid', transition:'border-color .4s' },
  overlay:     { position:'absolute', inset:0, background:'rgba(5,5,10,0.75)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', borderRadius:'20px' },
  cdNum:       { fontSize:'80px', fontWeight:'700', color:'#fff', lineHeight:1, marginBottom:'12px', letterSpacing:'-0.04em' },
  cdTxt:       { fontSize:'16px', color:'rgba(255,255,255,0.6)', fontWeight:'500' },
  validBadge:  { position:'absolute', top:'14px', right:'14px', background:'rgba(16,185,129,0.15)', border:'1px solid rgba(16,185,129,0.25)', borderRadius:'20px', padding:'6px 14px', fontSize:'13px', fontWeight:'600', color:'rgba(16,185,129,0.9)' },
  statusBar:   { position:'absolute', bottom:'14px', left:'50%', transform:'translateX(-50%)', background:'rgba(0,0,0,0.7)', backdropFilter:'blur(8px)', borderRadius:'20px', padding:'7px 18px', fontSize:'12px', color:'rgba(255,255,255,0.7)', whiteSpace:'nowrap', border:'1px solid rgba(255,255,255,0.06)' },
  infoPanel:   { width:'300px', flexShrink:0, background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.05)', borderRadius:'20px', padding:'28px 24px', display:'flex', flexDirection:'column', gap:'24px' },
  logo:        { display:'flex', alignItems:'center', gap:'10px' },
  logoIcon:    { width:'34px', height:'34px', borderRadius:'8px', background:'linear-gradient(135deg,#7c3aed,#4f46e5)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'16px' },
  logoTxt:     { fontSize:'14px', fontWeight:'600', color:'rgba(255,255,255,0.8)' },
  title:       { fontSize:'20px', fontWeight:'700', color:'#fff', margin:'0 0 6px', letterSpacing:'-0.02em' },
  subtitle:    { fontSize:'13px', color:'rgba(255,255,255,0.35)', margin:0, lineHeight:'1.7' },
  progressBox: { background:'rgba(139,92,246,0.06)', border:'1px solid rgba(139,92,246,0.15)', borderRadius:'12px', padding:'16px' },
  progressLbl: { fontSize:'11px', fontWeight:'600', color:'rgba(255,255,255,0.4)', textTransform:'uppercase', letterSpacing:'.08em' },
  progressTrack:{ height:'6px', background:'rgba(255,255,255,0.06)', borderRadius:'6px', overflow:'hidden' },
  progressFill: { height:'100%', background:'linear-gradient(90deg,#7c3aed,#4f46e5)', borderRadius:'6px', transition:'width .4s ease' },
  instrBox:    { background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.05)', borderRadius:'12px', padding:'16px' },
  sectionTitle:{ fontSize:'11px', fontWeight:'600', color:'rgba(255,255,255,0.3)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:'12px' },
  doneCard:    { textAlign:'center', padding:'60px 48px', background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'24px', maxWidth:'440px', width:'100%', animation:'fadeIn .4s ease-out' },
  iconWrap:    (color, bg, border) => ({ width:'72px', height:'72px', borderRadius:'50%', background:bg, border:`2px solid ${border}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'32px', color, margin:'0 auto 24px' }),
  doneTitle:   { fontSize:'24px', fontWeight:'700', margin:'0 0 8px', letterSpacing:'-0.02em' },
  doneSub:     { fontSize:'14px', color:'rgba(255,255,255,0.4)', margin:'0 0 28px', lineHeight:'1.6' },
  statsRow:    { display:'flex', justifyContent:'center', alignItems:'center', gap:'24px', marginBottom:'24px', background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.05)', borderRadius:'14px', padding:'20px' },
  statItem:    { display:'flex', flexDirection:'column', alignItems:'center', gap:'4px' },
  statNum:     { fontSize:'24px', fontWeight:'700', color:'#a78bfa' },
  statLbl:     { fontSize:'11px', color:'rgba(255,255,255,0.3)', textTransform:'uppercase', letterSpacing:'.06em' },
  statDiv:     { width:'1px', height:'40px', background:'rgba(255,255,255,0.06)' },
  infoBox:     (bg, border, color) => ({ fontSize:'13px', lineHeight:'1.6', padding:'12px 16px', borderRadius:'10px', background:bg, border:`1px solid ${border}`, color, marginBottom:'28px' }),
  btn:         (c1, c2) => ({ padding:'14px 48px', border:'none', borderRadius:'12px', background:`linear-gradient(135deg,${c1},${c2})`, color:'#fff', fontSize:'15px', fontWeight:'600', cursor:'pointer', fontFamily:'"Sora",sans-serif', letterSpacing:'0.02em' }),
}