import { useState } from 'react'
import axios from 'axios'

const CLASSES = ['A', 'B', 'C', 'D']
const ANNEES  = ['1ère année', '2ème année', '3ème année', '4ème année', '5ème année']
const API_URL = ''
const ACCENT  = '#6c63ff'

export default function StudentForm({ onSuccess }) {
  const [form,    setForm]    = useState({
    nom:'', prenom:'', email:'', classe:'', annee_scolaire:'', password:'', confirmPassword:''
  })
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm,  setShowConfirm]  = useState(false)

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value })

  const handleSubmit = async e => {
    e.preventDefault()
    if (form.password !== form.confirmPassword) {
      setError("Les mots de passe ne correspondent pas")
      return
    }
    if (form.password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères")
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await axios.post(`${API_URL}/api/enrollment/students`, {
        nom:            form.nom,
        prenom:         form.prenom,
        email:          form.email,
        classe:         form.classe,
        annee_scolaire: form.annee_scolaire,
      })
      const studentId = res.data.id || res.data.student_id
      onSuccess(studentId, form.email, form.password, form.nom, form.prenom)
    } catch (err) {
      const detail = err.response?.data?.detail
      if (Array.isArray(detail)) {
        setError(detail.map(e => e.msg).join(', '))
      } else {
        setError(typeof detail === 'string' ? detail : "Erreur lors de l'inscription")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight:'100vh', background:'#080818',
      display:'flex', alignItems:'center', justifyContent:'center',
      fontFamily:'"Sora",sans-serif', padding:'24px',
      position:'relative', overflow:'hidden',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&display=swap');

        .sf-orb-blue {
          position:absolute; width:520px; height:520px; border-radius:50%;
          background:radial-gradient(circle,rgba(50,80,220,0.42) 0%,transparent 70%);
          top:-100px; left:-150px; pointer-events:none; filter:blur(9px);
        }
        .sf-orb-red {
          position:absolute; width:460px; height:460px; border-radius:50%;
          background:radial-gradient(circle,rgba(200,40,100,0.32) 0%,transparent 70%);
          bottom:-100px; right:-120px; pointer-events:none; filter:blur(9px);
        }
        .sf-star { position:absolute; border-radius:50%; background:rgba(255,255,255,0.6); pointer-events:none; }

        .sf-input {
          width:100%; padding:13px 16px; background:#f5f0e8;
          border:2px solid transparent; border-radius:14px;
          color:#1a1a2e; font-size:14px; font-family:'Sora',sans-serif;
          font-weight:500; outline:none; box-sizing:border-box;
          transition:border-color .2s, box-shadow .2s;
        }
        .sf-input:focus { border-color:${ACCENT}88; box-shadow:0 0 0 3px ${ACCENT}22; }
        .sf-input::placeholder { color:rgba(26,26,46,0.35); }
        .sf-input option { background:#1a1a2e; color:#fff; }

        .sf-label {
          display:flex; align-items:center; gap:6px;
          font-size:11px; font-weight:600; letter-spacing:1.1px;
          color:rgba(255,255,255,0.5); margin-bottom:7px; text-transform:uppercase;
        }

        .sf-eye {
          position:absolute; right:10px; top:50%; transform:translateY(-50%);
          background:rgba(26,26,46,0.12); border:none; border-radius:10px;
          width:34px; height:34px; display:flex; align-items:center; justify-content:center;
          cursor:pointer; color:rgba(26,26,46,0.4); transition:background .2s, color .2s;
        }
        .sf-eye:hover { background:rgba(26,26,46,0.22); color:rgba(26,26,46,0.75); }

        .sf-btn {
          width:100%; padding:15px; border:none; border-radius:14px;
          font-size:15px; font-weight:600; font-family:'Sora',sans-serif;
          cursor:pointer; transition:transform .15s, opacity .15s, box-shadow .2s;
          background:linear-gradient(135deg,#6c63ff 0%,#4f46e5 60%,#3730a3 100%);
          color:#fff; margin-top:8px;
          box-shadow:0 4px 20px rgba(108,99,255,0.35);
        }
        .sf-btn:hover:not(:disabled) { transform:translateY(-1px); opacity:.9; box-shadow:0 6px 28px rgba(108,99,255,0.5); }
        .sf-btn:disabled { opacity:.5; cursor:not-allowed; }
      `}</style>

      <div className="sf-orb-blue" />
      <div className="sf-orb-red"  />

      {[
        [8,10],[85,6],[52,18],[28,72],[76,58],[15,48],[92,80],[42,90],[68,32],[5,88],
        [96,28],[36,14],[80,94],[22,58],[62,4],[50,76],[88,44],[12,95],[74,16],[32,40],
      ].map(([x,y],i) => (
        <div key={i} className="sf-star" style={{
          width:i%3===0?2:1.5, height:i%3===0?2:1.5,
          left:`${x}%`, top:`${y}%`, opacity:0.25+(i%4)*0.1,
        }}/>
      ))}

      <div style={{
        width:'100%', maxWidth:'480px', position:'relative', zIndex:1,
        background:'rgba(14,14,35,0.75)',
        backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)',
        border:'1px solid rgba(255,255,255,0.08)',
        borderRadius:'28px', padding:'44px 40px',
        boxShadow:'0 24px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(108,99,255,0.06) inset',
      }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'10px', marginBottom:'28px' }}>
          <div style={{ filter:"drop-shadow(0 4px 12px rgba(108,99,255,0.5))", position:"relative", width:48, height:48 }}>
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <defs>
                <linearGradient id="hexGradForm" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#1e1b4b"/>
                  <stop offset="100%" stopColor="#3730a3"/>
                </linearGradient>
              </defs>
              <polygon points="24,2 44,13 44,35 24,46 4,35 4,13" fill="url(#hexGradForm)"/>
              <polygon points="24,6 40,16 40,32 24,42 8,32 8,16" fill="none" stroke="rgba(167,139,250,0.32)" strokeWidth="1.2"/>
            </svg>
            <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <span style={{ fontSize:13, fontWeight:900, color:"#fff", letterSpacing:"-0.5px", fontFamily:"sans-serif" }}>SC</span>
            </div>
          </div>
          <span style={{ fontSize:'15px', fontWeight:'600', color:'rgba(255,255,255,0.9)' }}>
            SmartCampus IA
          </span>
        </div>

        <h1 style={{
          fontSize:'22px', fontWeight:'700', color:'#fff',
          textAlign:'center', margin:'0 0 6px', letterSpacing:'-0.02em',
        }}>Inscription étudiant</h1>
        <p style={{
          fontSize:'13px', color:'rgba(255,255,255,0.32)',
          textAlign:'center', margin:'0 0 28px',
        }}>
          Remplissez vos informations pour accéder à la capture faciale
        </p>

        {error && (
          <div style={{
            background:'rgba(239,68,68,0.09)', border:'1px solid rgba(239,68,68,0.22)',
            borderRadius:'11px', padding:'12px 16px',
            color:'#fca5a5', fontSize:'13px', textAlign:'center', marginBottom:'20px',
          }}>{error}</div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Nom / Prénom */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'16px' }}>
            <div>
              <label className="sf-label">Nom</label>
              <input className="sf-input" name="nom" value={form.nom}
                onChange={handleChange} required placeholder="Bennani" />
            </div>
            <div>
              <label className="sf-label">Prénom</label>
              <input className="sf-input" name="prenom" value={form.prenom}
                onChange={handleChange} required placeholder="Youssef" />
            </div>
          </div>

          {/* Email */}
          <div style={{ marginBottom:'16px' }}>
            <label className="sf-label">
              <svg width="11" height="11" viewBox="0 0 24 24" fill={ACCENT}>
                <path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
              </svg>
              Adresse email
            </label>
            <input className="sf-input" name="email" type="email" value={form.email}
              onChange={handleChange} required placeholder="youssef@esisa.ac.ma" />
          </div>

          {/* Année / Classe */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'16px' }}>
            <div>
              <label className="sf-label">Année scolaire</label>
              <select className="sf-input" name="annee_scolaire" value={form.annee_scolaire}
                onChange={handleChange} required>
                <option value="">Sélectionnez</option>
                {ANNEES.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="sf-label">Classe</label>
              <select className="sf-input" name="classe" value={form.classe}
                onChange={handleChange} required>
                <option value="">Sélectionnez</option>
                {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Mot de passe */}
          <div style={{ marginBottom:'16px' }}>
            <label className="sf-label">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="#f59e0b">
                <path d="M18 8h-1V6A5 5 0 0 0 7 6v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2zm-6 9a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm3.1-9H8.9V6a3.1 3.1 0 0 1 6.2 0v2z"/>
              </svg>
              Mot de passe
            </label>
            <div style={{ position:'relative' }}>
              <input className="sf-input" name="password"
                type={showPassword ? 'text' : 'password'} value={form.password}
                onChange={handleChange} required placeholder="Minimum 6 caractères"
                style={{ paddingRight:52 }} />
              <button type="button" className="sf-eye"
                onClick={() => setShowPassword(v => !v)}>
                {showPassword ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Confirmer */}
          <div style={{ marginBottom:'24px' }}>
            <label className="sf-label">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="#f59e0b">
                <path d="M18 8h-1V6A5 5 0 0 0 7 6v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2zm-6 9a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm3.1-9H8.9V6a3.1 3.1 0 0 1 6.2 0v2z"/>
              </svg>
              Confirmer le mot de passe
            </label>
            <div style={{ position:'relative' }}>
              <input className="sf-input" name="confirmPassword"
                type={showConfirm ? 'text' : 'password'} value={form.confirmPassword}
                onChange={handleChange} required placeholder="Répétez le mot de passe"
                style={{ paddingRight:52 }} />
              <button type="button" className="sf-eye"
                onClick={() => setShowConfirm(v => !v)}>
                {showConfirm ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button type="submit" className="sf-btn" disabled={loading}>
            {loading ? 'Enregistrement...' : 'Continuer vers la capture faciale →'}
          </button>
        </form>

        <p style={{
          fontSize:'11px', color:'rgba(255,255,255,0.15)',
          textAlign:'center', marginTop:'20px', lineHeight:'1.6',
        }}>
          Vos données sont sécurisées et utilisées uniquement pour l'identification académique
        </p>
      </div>
    </div>
  )
}
