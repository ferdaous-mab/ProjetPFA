import { useState } from 'react'
import axios from 'axios'

const CLASSES = ['A', 'B', 'C', 'D']
const ANNEES  = ['1ère année', '2ème année', '3ème année', '4ème année', '5ème année']
const API_URL = ''

export default function StudentForm({ onSuccess }) {
  const [form,    setForm]    = useState({ nom:'', prenom:'', email:'', classe:'', annee_scolaire:'', password:'', confirmPassword:'' })
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

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
      const formData = new FormData()
      formData.append('nom', form.nom)
      formData.append('prenom', form.prenom)
      formData.append('email', form.email)
      formData.append('classe', form.classe)
      formData.append('annee_scolaire', form.annee_scolaire)

      const res = await axios.post(`${API_URL}/api/enroll`, formData)
      onSuccess(res.data.student_id, form.email, form.password, form.nom, form.prenom)
    } catch (err) {
      setError(err.response?.data?.detail || "Erreur lors de l'inscription")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight:'100vh', background:'#05050a',
      display:'flex', alignItems:'center', justifyContent:'center',
      fontFamily:'"Sora",sans-serif', padding:'24px',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&display=swap');
        .sf-input {
          width:100%; padding:14px 16px; background:rgba(255,255,255,0.04);
          border:1px solid rgba(255,255,255,0.08); border-radius:12px;
          color:#fff; font-size:14px; font-family:'Sora',sans-serif;
          outline:none; box-sizing:border-box; transition:border-color .2s;
        }
        .sf-input:focus { border-color:rgba(139,92,246,0.6); }
        .sf-input::placeholder { color:rgba(255,255,255,0.2); }
        .sf-input option { background:#1a1a2e; color:#fff; }
        .sf-label {
          display:block; font-size:11px; font-weight:600; letter-spacing:.1em;
          color:rgba(255,255,255,0.35); margin-bottom:8px; text-transform:uppercase;
        }
        .sf-btn {
          width:100%; padding:15px; border:none; border-radius:12px;
          font-size:15px; font-weight:600; font-family:'Sora',sans-serif;
          cursor:pointer; transition:transform .15s, opacity .15s;
          background:linear-gradient(135deg,#7c3aed,#4f46e5); color:#fff; margin-top:8px;
        }
        .sf-btn:hover:not(:disabled) { transform:translateY(-1px); opacity:.9; }
        .sf-btn:disabled { opacity:.5; cursor:not-allowed; }
      `}</style>

      <div style={{
        width:'100%', maxWidth:'460px',
        background:'rgba(255,255,255,0.03)',
        border:'1px solid rgba(255,255,255,0.07)',
        borderRadius:'24px', padding:'44px 40px',
      }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'10px', marginBottom:'32px' }}>
          <div style={{
            width:'40px', height:'40px', borderRadius:'10px',
            background:'linear-gradient(135deg,#7c3aed,#4f46e5)',
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:'18px',
          }}>🎓</div>
          <span style={{ fontSize:'15px', fontWeight:'600', color:'rgba(255,255,255,0.9)' }}>
            SmartCampus IA
          </span>
        </div>

        <h1 style={{
          fontSize:'24px', fontWeight:'700', color:'#fff',
          textAlign:'center', margin:'0 0 6px', letterSpacing:'-0.02em',
        }}>Inscription étudiant</h1>
        <p style={{
          fontSize:'13px', color:'rgba(255,255,255,0.35)',
          textAlign:'center', margin:'0 0 32px',
        }}>
          Remplissez vos informations pour accéder à la capture faciale
        </p>

        {error && (
          <div style={{
            background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)',
            borderRadius:'10px', padding:'12px 16px',
            color:'#fca5a5', fontSize:'13px', textAlign:'center', marginBottom:'20px',
          }}>{error}</div>
        )}

        <form onSubmit={handleSubmit}>
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

          <div style={{ marginBottom:'16px' }}>
            <label className="sf-label">Adresse email</label>
            <input className="sf-input" name="email" type="email" value={form.email}
              onChange={handleChange} required placeholder="youssef@esisa.ac.ma" />
          </div>

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

          <div style={{ marginBottom:'16px' }}>
            <label className="sf-label">Mot de passe</label>
            <input className="sf-input" name="password" type="password" value={form.password}
              onChange={handleChange} required placeholder="Minimum 6 caractères" />
          </div>

          <div style={{ marginBottom:'24px' }}>
            <label className="sf-label">Confirmer le mot de passe</label>
            <input className="sf-input" name="confirmPassword" type="password" value={form.confirmPassword}
              onChange={handleChange} required placeholder="Répétez le mot de passe" />
          </div>

          <button type="submit" className="sf-btn" disabled={loading}>
            {loading ? 'Enregistrement...' : 'Continuer vers la capture faciale →'}
          </button>
        </form>

        <p style={{
          fontSize:'11px', color:'rgba(255,255,255,0.2)',
          textAlign:'center', marginTop:'20px', lineHeight:'1.6',
        }}>
          Vos données sont sécurisées et utilisées uniquement pour l'identification académique
        </p>
      </div>
    </div>
  )
}
