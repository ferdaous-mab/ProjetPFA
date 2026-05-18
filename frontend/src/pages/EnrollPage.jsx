import { useState } from 'react'
import axios from 'axios'
import StudentForm from '../components/StudentForm'
import CameraCapture from '../components/CameraCapture'

const API_URL = ""

export default function EnrollPage({ onGoToLogin }) {
  const [studentId,    setStudentId]    = useState(null)
  const [credentials,  setCredentials]  = useState(null)
  const [done,         setDone]         = useState(false)
  const [studentCode,  setStudentCode]  = useState('')
  const [error,        setError]        = useState('')

  // Appele apres la creation de l'etudiant dans StudentForm
  const handleFormSuccess = (id, email, password, nom, prenom) => {
    setStudentId(id)
    setCredentials({ email, password, nom, prenom })
  }

  // Appele apres la finalisation de l'enrolement dans CameraCapture
  const handleCaptureComplete = async (code) => {
    try {
      // Cree le compte utilisateur apres l'enrolement facial reussi
      await axios.post(`${API_URL}/api/auth/register`, {
        email:    credentials.email,
        password: credentials.password,
        nom:      credentials.nom,
        prenom:   credentials.prenom,
        role:     'etudiant',
      })
      setStudentCode(code || '')
      setDone(true)
    } catch (err) {
      setError(err.response?.data?.detail || "Erreur lors de la creation du compte")
    }
  }

  if (done) {
    return (
      <div style={{
        minHeight:'100vh', background:'#05050a',
        display:'flex', alignItems:'center', justifyContent:'center',
        fontFamily:'"Sora",sans-serif', padding:24,
      }}>
        <div style={{
          width:'100%', maxWidth:420, textAlign:'center',
          background:'rgba(255,255,255,0.03)',
          border:'1px solid rgba(255,255,255,0.07)',
          borderRadius:24, padding:'48px 40px',
        }}>
          <div style={{ fontSize:56, marginBottom:20 }}>✅</div>
          <h2 style={{ color:'#fff', fontWeight:700, fontSize:22, margin:'0 0 10px' }}>
            Inscription réussie !
          </h2>
          <p style={{ color:'rgba(255,255,255,0.4)', fontSize:14, margin:'0 0 20px', lineHeight:1.6 }}>
            Votre compte a été créé et votre visage enregistré.
          </p>
          {studentCode && (
            <div style={{
              background:'rgba(124,58,237,0.1)',
              border:'1px solid rgba(124,58,237,0.3)',
              borderRadius:14, padding:'16px 20px', marginBottom:24,
            }}>
              <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)', marginBottom:8,
                fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase' }}>
                Votre code étudiant
              </div>
              <div style={{
                fontSize:26, fontWeight:700, letterSpacing:'0.18em',
                color:'#a78bfa', fontFamily:'monospace',
              }}>
                {studentCode}
              </div>
              <div style={{ fontSize:11, color:'rgba(255,255,255,0.3)', marginTop:8 }}>
                Conservez ce code — il vous identifie dans le système
              </div>
            </div>
          )}
          <button onClick={onGoToLogin} style={{
            width:'100%', padding:14, border:'none', borderRadius:12,
            background:'linear-gradient(135deg,#7c3aed,#4f46e5)',
            color:'#fff', fontSize:15, fontWeight:600,
            fontFamily:'"Sora",sans-serif', cursor:'pointer',
          }}>
            Se connecter →
          </button>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{
        minHeight:'100vh', background:'#05050a',
        display:'flex', alignItems:'center', justifyContent:'center',
        fontFamily:'"Sora",sans-serif', padding:24,
      }}>
        <div style={{
          width:'100%', maxWidth:420, textAlign:'center',
          background:'rgba(255,255,255,0.03)',
          border:'1px solid rgba(239,68,68,0.2)',
          borderRadius:24, padding:'48px 40px',
        }}>
          <div style={{ fontSize:56, marginBottom:20 }}>⚠️</div>
          <h2 style={{ color:'#fff', fontWeight:700, fontSize:20, margin:'0 0 10px' }}>
            Erreur de création du compte
          </h2>
          <p style={{ color:'#fca5a5', fontSize:13, margin:'0 0 32px' }}>{error}</p>
          <button onClick={onGoToLogin} style={{
            width:'100%', padding:14, border:'none', borderRadius:12,
            background:'linear-gradient(135deg,#7c3aed,#4f46e5)',
            color:'#fff', fontSize:15, fontWeight:600,
            fontFamily:'"Sora",sans-serif', cursor:'pointer',
          }}>
            Retour à la connexion
          </button>
        </div>
      </div>
    )
  }

  return studentId
    ? <CameraCapture studentId={studentId} onComplete={(code) => handleCaptureComplete(code)} />
    : <StudentForm onSuccess={handleFormSuccess} />
}