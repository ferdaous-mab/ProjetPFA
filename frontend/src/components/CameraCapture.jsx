import { useState, useRef, useEffect, useCallback } from 'react'
import axios from 'axios'

const INSTRUCTIONS = [
  { angle:'front_1',    text:'Regardez droit devant',       emoji:'●' },
  { angle:'front_2',    text:'Expression neutre',            emoji:'●' },
  { angle:'left_1',     text:'Légèrement à gauche',         emoji:'◀' },
  { angle:'left_2',     text:'Plus à gauche',               emoji:'◀◀' },
  { angle:'right_1',   text:'Légèrement à droite',          emoji:'▶' },
  { angle:'right_2',   text:'Plus à droite',                emoji:'▶▶' },
  { angle:'up_1',      text:'Regardez vers le haut',        emoji:'▲' },
  { angle:'up_2',      text:'Encore plus haut',             emoji:'▲▲' },
  { angle:'down_1',    text:'Regardez vers le bas',         emoji:'▼' },
  { angle:'down_2',    text:'Encore plus bas',              emoji:'▼▼' },
  { angle:'left_far',  text:'Bien à gauche',                emoji:'◀◀◀' },
  { angle:'right_far', text:'Bien à droite',                emoji:'▶▶▶' },
  { angle:'smile_1',   text:'Souriez naturellement',        emoji:'◉' },
  { angle:'smile_2',   text:'Grand sourire',                emoji:'◉◉' },
  { angle:'neutral_1', text:'Expression neutre',            emoji:'●' },
  { angle:'neutral_2', text:'Regardez la caméra',           emoji:'●' },
  { angle:'tilt_l',    text:'Inclinez à gauche',            emoji:'↙' },
  { angle:'tilt_r',    text:'Inclinez à droite',            emoji:'↘' },
  { angle:'close_1',   text:'Rapprochez-vous',              emoji:'⊕' },
  { angle:'far_1',     text:'Éloignez-vous',                emoji:'⊖' },
]
const TOTAL = INSTRUCTIONS.length
const INTERVAL_MS = 2500

export default function CameraCapture({ studentId, onComplete }) {
  const videoRef    = useRef(null)
  const canvasRef   = useRef(null)
  const streamRef   = useRef(null)
  const intervalRef = useRef(null)
  const busy        = useRef(false)

  const [captured,  setCaptured]  = useState(0)
  const [instrIdx,  setInstrIdx]  = useState(0)
  const [status,    setStatus]    = useState('Positionnez votre visage dans le cadre ovale')
  const [flash,     setFlash]     = useState(false)
  const [done,      setDone]      = useState(false)
  const [camReady,  setCamReady]  = useState(false)

  useEffect(() => {
    startCam()
    return () => { stopCam(); clearInterval(intervalRef.current) }
  }, [])

  const startCam = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video:{ width:640, height:480, facingMode:'user' } })
      streamRef.current = s
      if (videoRef.current) {
        videoRef.current.srcObject = s
        videoRef.current.onloadedmetadata = () => {
          setCamReady(true)
          setStatus('Visage détecté — capture automatique lancée')
          intervalRef.current = setInterval(captureFrame, INTERVAL_MS)
        }
      }
    } catch { setStatus("Impossible d'accéder à la caméra") }
  }

  const stopCam = () => { streamRef.current?.getTracks().forEach(t => t.stop()) }

  const captureFrame = useCallback(async () => {
    if (busy.current || !canvasRef.current || !videoRef.current) return
    busy.current = true

    const c = canvasRef.current
    const ctx = c.getContext('2d')
    c.width  = videoRef.current.videoWidth
    c.height = videoRef.current.videoHeight
    ctx.drawImage(videoRef.current, 0, 0)

    c.toBlob(async blob => {
      try {
        setInstrIdx(prev => {
          const idx = prev
          const form = new FormData()
          form.append('student_id', studentId)
          form.append('angle', INSTRUCTIONS[idx].angle)
          form.append('image', blob, 'face.jpg')

          axios.post('http://localhost:8000/api/enroll/image', form)
            .then(res => {
              if (res.data.ok) {
                setFlash(true)
                setTimeout(() => setFlash(false), 250)
                setCaptured(c => {
                  const next = c + 1
                  if (next >= TOTAL) {
                    clearInterval(intervalRef.current)
                    stopCam()
                    setDone(true)
                    setTimeout(() => onComplete(), 2000)
                  }
                  return next
                })
                setInstrIdx(i => Math.min(i + 1, TOTAL - 1))
                setStatus('Image capturée')
              } else {
                setStatus(res.data.reason || 'Ajustez votre position...')
              }
            })
            .catch(() => setStatus('Ajustez votre position...'))
            .finally(() => { busy.current = false })
          return idx
        })
      } catch { busy.current = false }
    }, 'image/jpeg', 0.92)
  }, [studentId, onComplete])

  const pct = Math.round((captured / TOTAL) * 100)

  if (done) return (
    <div style={{
      minHeight:'100vh', background:'#05050a', display:'flex',
      alignItems:'center', justifyContent:'center', fontFamily:'"Sora",sans-serif',
    }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&display=swap');`}</style>
      <div style={{
        textAlign:'center', padding:'60px 40px',
        background:'rgba(255,255,255,0.03)',
        border:'1px solid rgba(255,255,255,0.07)',
        borderRadius:'24px', maxWidth:'400px',
      }}>
        <div style={{
          width:'80px', height:'80px', borderRadius:'50%',
          background:'rgba(16,185,129,0.1)', border:'2px solid rgba(16,185,129,0.3)',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:'36px', margin:'0 auto 24px',
        }}>✓</div>
        <h2 style={{ color:'#fff', fontSize:'22px', fontWeight:'700', margin:'0 0 8px', letterSpacing:'-0.02em' }}>
          Enrôlement réussi !
        </h2>
        <p style={{ color:'rgba(255,255,255,0.4)', fontSize:'14px', margin:'0 0 24px' }}>
          {TOTAL} images capturées et enregistrées avec succès
        </p>
        <div style={{
          background:'rgba(16,185,129,0.08)', border:'1px solid rgba(16,185,129,0.2)',
          borderRadius:'10px', padding:'12px 16px',
          color:'rgba(16,185,129,0.8)', fontSize:'13px',
        }}>
          Vous pouvez maintenant être reconnu automatiquement
        </div>
      </div>
    </div>
  )

  return (
    <div style={{
      minHeight:'100vh', background:'#05050a',
      display:'flex', alignItems:'stretch',
      fontFamily:'"Sora",sans-serif',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&display=swap');
        @keyframes pulse-ring {
          0%  { box-shadow: 0 0 0 0 rgba(139,92,246,0.4); }
          70% { box-shadow: 0 0 0 12px rgba(139,92,246,0); }
          100%{ box-shadow: 0 0 0 0 rgba(139,92,246,0); }
        }
        @keyframes flash-anim { 0%{opacity:.5} 100%{opacity:0} }
        @keyframes slide-up { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {/* Panel gauche — caméra */}
      <div style={{
        flex:'1', display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'center',
        padding:'40px', position:'relative',
      }}>
        {/* Header */}
        <div style={{
          display:'flex', alignItems:'center', gap:'10px', marginBottom:'32px',
        }}>
          <div style={{
            width:'32px', height:'32px', borderRadius:'8px',
            background:'linear-gradient(135deg,#7c3aed,#4f46e5)',
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:'14px',
          }}>🎓</div>
          <span style={{ fontSize:'14px', fontWeight:'600', color:'rgba(255,255,255,0.7)' }}>
            SmartCampus IA
          </span>
        </div>

        {/* Caméra */}
        <div style={{
          position:'relative', borderRadius:'20px', overflow:'hidden',
          border:'1px solid rgba(255,255,255,0.08)',
          background:'#0d0d14', width:'100%', maxWidth:'480px',
        }}>
          <video ref={videoRef} autoPlay muted playsInline
            style={{ width:'100%', display:'block', transform:'scaleX(-1)' }} />

          {/* Flash */}
          {flash && (
            <div style={{
              position:'absolute', inset:0, background:'rgba(255,255,255,0.25)',
              animation:'flash-anim .25s ease-out forwards', pointerEvents:'none',
            }} />
          )}

          {/* Oval guide */}
          <div style={{
            position:'absolute', inset:0,
            display:'flex', alignItems:'center', justifyContent:'center',
            pointerEvents:'none',
          }}>
            <div style={{
              width:'200px', height:'260px', borderRadius:'50%',
              border:`2px solid ${camReady ? 'rgba(139,92,246,0.7)' : 'rgba(255,255,255,0.15)'}`,
              transition:'border-color .4s',
              animation: camReady ? 'pulse-ring 2s ease-out infinite' : 'none',
            }} />
          </div>

          {/* Status pill */}
          <div style={{
            position:'absolute', bottom:'16px', left:'50%', transform:'translateX(-50%)',
            background:'rgba(0,0,0,0.7)', backdropFilter:'blur(8px)',
            borderRadius:'20px', padding:'7px 16px',
            fontSize:'12px', color:'rgba(255,255,255,0.75)',
            whiteSpace:'nowrap', border:'1px solid rgba(255,255,255,0.08)',
          }}>
            {status}
          </div>

          {/* Compteur captures */}
          <div style={{
            position:'absolute', top:'14px', right:'14px',
            background:'rgba(139,92,246,0.2)', backdropFilter:'blur(8px)',
            border:'1px solid rgba(139,92,246,0.3)',
            borderRadius:'20px', padding:'5px 12px',
            fontSize:'12px', fontWeight:'600', color:'#c4b5fd',
          }}>
            {captured}/{TOTAL}
          </div>
        </div>

        <canvas ref={canvasRef} style={{ display:'none' }} />
      </div>

      {/* Panel droit — infos */}
      <div style={{
        width:'340px', flexShrink:0,
        borderLeft:'1px solid rgba(255,255,255,0.05)',
        padding:'40px 32px',
        display:'flex', flexDirection:'column',
        justifyContent:'center', gap:'32px',
      }}>
        {/* Titre */}
        <div>
          <h2 style={{ color:'#fff', fontSize:'20px', fontWeight:'700', margin:'0 0 6px', letterSpacing:'-0.02em' }}>
            Capture du visage
          </h2>
          <p style={{ color:'rgba(255,255,255,0.35)', fontSize:'13px', margin:0, lineHeight:'1.6' }}>
            Suivez les instructions — la caméra capture automatiquement
          </p>
        </div>

        {/* Instruction courante */}
        <div style={{
          background:'rgba(139,92,246,0.08)',
          border:'1px solid rgba(139,92,246,0.2)',
          borderRadius:'14px', padding:'20px',
          animation:'slide-up .3s ease-out',
        }}>
          <div style={{
            fontSize:'28px', fontWeight:'700', color:'#a78bfa',
            marginBottom:'8px', letterSpacing:'.05em',
          }}>
            {INSTRUCTIONS[Math.min(instrIdx, TOTAL-1)].emoji}
          </div>
          <div style={{ fontSize:'15px', fontWeight:'600', color:'#e9d5ff' }}>
            {INSTRUCTIONS[Math.min(instrIdx, TOTAL-1)].text}
          </div>
          <div style={{ fontSize:'12px', color:'rgba(167,139,250,0.5)', marginTop:'4px' }}>
            Étape {Math.min(instrIdx+1, TOTAL)} sur {TOTAL}
          </div>
        </div>

        {/* Barre de progression */}
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'10px' }}>
            <span style={{ fontSize:'12px', fontWeight:'600', color:'rgba(255,255,255,0.5)', textTransform:'uppercase', letterSpacing:'.08em' }}>
              Progression
            </span>
            <span style={{ fontSize:'13px', fontWeight:'700', color:'#a78bfa' }}>{pct}%</span>
          </div>
          <div style={{ height:'6px', background:'rgba(255,255,255,0.06)', borderRadius:'6px', overflow:'hidden' }}>
            <div style={{
              height:'100%', width:`${pct}%`,
              background:'linear-gradient(90deg,#7c3aed,#4f46e5)',
              borderRadius:'6px', transition:'width .5s ease',
            }} />
          </div>
          {/* Dots */}
          <div style={{ display:'flex', flexWrap:'wrap', gap:'5px', marginTop:'12px' }}>
            {INSTRUCTIONS.map((_, i) => (
              <div key={i} style={{
                width:'8px', height:'8px', borderRadius:'50%',
                background: i < captured ? '#7c3aed' : i === captured ? '#fff' : 'rgba(255,255,255,0.1)',
                transition:'all .3s ease',
                transform: i === captured ? 'scale(1.5)' : 'scale(1)',
              }} />
            ))}
          </div>
        </div>

        {/* Conseils */}
        <div style={{
          background:'rgba(255,255,255,0.02)',
          border:'1px solid rgba(255,255,255,0.05)',
          borderRadius:'12px', padding:'16px',
        }}>
          <div style={{ fontSize:'11px', fontWeight:'600', color:'rgba(255,255,255,0.3)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:'10px' }}>
            Conseils
          </div>
          {[
            'Assurez-vous d\'être dans un endroit bien éclairé',
            'Retirez vos lunettes si possible',
            'Regardez directement vers la caméra',
          ].map((tip, i) => (
            <div key={i} style={{ display:'flex', gap:'8px', marginBottom:'7px', alignItems:'flex-start' }}>
              <div style={{ width:'4px', height:'4px', borderRadius:'50%', background:'rgba(139,92,246,0.5)', marginTop:'6px', flexShrink:0 }} />
              <span style={{ fontSize:'12px', color:'rgba(255,255,255,0.3)', lineHeight:'1.5' }}>{tip}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}