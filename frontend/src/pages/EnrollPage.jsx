import { useState } from 'react'
import axios from 'axios'
import StudentForm from '../components/StudentForm'
import CameraCapture from '../components/CameraCapture'

const API_URL = ""

const BG_STYLE = {
  minHeight:'100vh', background:'#080818',
  display:'flex', alignItems:'center', justifyContent:'center',
  fontFamily:'"Sora",sans-serif', padding:24,
  position:'relative', overflow:'hidden',
}

function OrbsAndStars() {
  return (
    <>
      <div style={{
        position:'absolute', width:520, height:520, borderRadius:'50%',
        background:'radial-gradient(circle,rgba(50,80,220,0.42) 0%,transparent 70%)',
        top:-100, left:-150, pointerEvents:'none', filter:'blur(9px)',
      }}/>
      <div style={{
        position:'absolute', width:460, height:460, borderRadius:'50%',
        background:'radial-gradient(circle,rgba(200,40,100,0.32) 0%,transparent 70%)',
        bottom:-100, right:-120, pointerEvents:'none', filter:'blur(9px)',
      }}/>
      {[
        [8,10],[85,6],[52,18],[28,72],[76,58],[15,48],[92,80],[42,90],[68,32],[5,88],
        [96,28],[36,14],[80,94],[22,58],[62,4],[50,76],[88,44],[12,95],[74,16],[32,40],
      ].map(([x,y],i) => (
        <div key={i} style={{
          position:'absolute', borderRadius:'50%', background:'rgba(255,255,255,0.6)',
          pointerEvents:'none',
          width:i%3===0?2:1.5, height:i%3===0?2:1.5,
          left:`${x}%`, top:`${y}%`, opacity:0.25+(i%4)*0.1,
        }}/>
      ))}
    </>
  )
}

export default function EnrollPage({ onGoToLogin, onGoHome }) {
  const [studentId,    setStudentId]    = useState(null)
  const [credentials,  setCredentials]  = useState(null)
  const [done,         setDone]         = useState(false)
  const [studentCode,  setStudentCode]  = useState('')
  const [error,        setError]        = useState('')

  const handleFormSuccess = (id, email, password, nom, prenom) => {
    setStudentId(id)
    setCredentials({ email, password, nom, prenom })
  }

  const handleCaptureComplete = async (code) => {
    try {
      await axios.post(`${API_URL}/api/auth/register`, {
        email:    credentials.email,
        password: credentials.password,
        nom:      credentials.nom,
        prenom:   credentials.prenom,
        role:     'etudiant',
      })
    } catch (err) {
      const detail = err.response?.data?.detail || ""
      if (!detail.toLowerCase().includes("email") && !detail.toLowerCase().includes("utilisé")) {
        setError(detail || "Erreur lors de la creation du compte")
        return
      }
    }
    setStudentCode(code || '')
    setDone(true)
  }

  /* ── Succès ── */
  if (done) {
    return (
      <div style={BG_STYLE}>
        <OrbsAndStars />
        <div style={{
          width:'100%', maxWidth:440, textAlign:'center', position:'relative', zIndex:1,
          background:'rgba(14,14,35,0.75)',
          backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)',
          border:'1px solid rgba(255,255,255,0.08)',
          borderRadius:28, padding:'52px 40px',
          boxShadow:'0 24px 80px rgba(0,0,0,0.55)',
        }}>
          <div style={{ fontSize:56, marginBottom:20 }}>✅</div>
          <h2 style={{ color:'#fff', fontWeight:700, fontSize:22, margin:'0 0 10px' }}>
            Inscription réussie !
          </h2>
          <p style={{ color:'rgba(255,255,255,0.38)', fontSize:14, margin:'0 0 24px', lineHeight:1.6 }}>
            Votre compte a été créé et votre visage enregistré.
          </p>

          {studentCode && (
            <div style={{
              background:'rgba(108,99,255,0.08)',
              border:'1px solid rgba(108,99,255,0.22)',
              borderRadius:16, padding:'18px 22px', marginBottom:28,
            }}>
              <div style={{
                fontSize:11, color:'rgba(255,255,255,0.38)', marginBottom:10,
                fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase',
              }}>
                Votre code étudiant
              </div>
              <div style={{
                fontSize:28, fontWeight:700, letterSpacing:'0.2em',
                color:'#a78bfa', fontFamily:'monospace',
              }}>
                {studentCode}
              </div>
              <div style={{ fontSize:11, color:'rgba(255,255,255,0.28)', marginTop:10 }}>
                Conservez ce code — il vous identifie dans le système
              </div>
            </div>
          )}

          <button onClick={onGoToLogin} style={{
            width:'100%', padding:14, border:'none', borderRadius:14,
            background:'linear-gradient(135deg,#6c63ff 0%,#4f46e5 60%,#3730a3 100%)',
            color:'#fff', fontSize:15, fontWeight:600,
            fontFamily:'"Sora",sans-serif', cursor:'pointer',
            boxShadow:'0 4px 20px rgba(108,99,255,0.38)',
            transition:'opacity .2s, transform .15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.opacity='.9'; e.currentTarget.style.transform='translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.opacity='1';  e.currentTarget.style.transform='translateY(0)'; }}
          >
            Se connecter →
          </button>
        </div>
      </div>
    )
  }

  /* ── Erreur ── */
  if (error) {
    return (
      <div style={BG_STYLE}>
        <OrbsAndStars />
        <div style={{
          width:'100%', maxWidth:440, textAlign:'center', position:'relative', zIndex:1,
          background:'rgba(14,14,35,0.75)',
          backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)',
          border:'1px solid rgba(239,68,68,0.18)',
          borderRadius:28, padding:'52px 40px',
          boxShadow:'0 24px 80px rgba(0,0,0,0.55)',
        }}>
          <div style={{ fontSize:56, marginBottom:20 }}>⚠️</div>
          <h2 style={{ color:'#fff', fontWeight:700, fontSize:20, margin:'0 0 10px' }}>
            Erreur de création du compte
          </h2>
          <p style={{ color:'#fca5a5', fontSize:13, margin:'0 0 32px' }}>{error}</p>
          <button onClick={onGoToLogin} style={{
            width:'100%', padding:14, border:'none', borderRadius:14,
            background:'linear-gradient(135deg,#6c63ff 0%,#4f46e5 60%,#3730a3 100%)',
            color:'#fff', fontSize:15, fontWeight:600,
            fontFamily:'"Sora",sans-serif', cursor:'pointer',
            boxShadow:'0 4px 20px rgba(108,99,255,0.35)',
          }}>
            Retour à la connexion
          </button>
        </div>
      </div>
    )
  }

  /* ── Capture faciale ── */
  if (studentId) {
    return <CameraCapture studentId={studentId} onComplete={(code) => handleCaptureComplete(code)} />
  }

  /* ── Formulaire ── */
  return (
    <div style={{ position:"relative", minHeight:"100vh" }}>
      {onGoHome && (
        <button
          onClick={onGoHome}
          style={{
            position:"fixed", top:18, left:18, zIndex:50,
            display:"flex", alignItems:"center", gap:7,
            background:"rgba(255,255,255,0.04)",
            border:"1px solid rgba(255,255,255,0.09)",
            borderRadius:10, padding:"7px 13px",
            color:"rgba(255,255,255,0.45)", fontSize:13,
            fontFamily:"'Sora',sans-serif", fontWeight:500,
            cursor:"pointer", transition:"background .2s, color .2s",
          }}
          onMouseEnter={e => { e.currentTarget.style.background="rgba(255,255,255,0.08)"; e.currentTarget.style.color="#fff"; }}
          onMouseLeave={e => { e.currentTarget.style.background="rgba(255,255,255,0.04)"; e.currentTarget.style.color="rgba(255,255,255,0.45)"; }}
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
            <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.8"
              strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Accueil
        </button>
      )}
      <StudentForm onSuccess={handleFormSuccess} />
    </div>
  )
}
