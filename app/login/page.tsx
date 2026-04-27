'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [forgot, setForgot] = useState(false)
  const [msg, setMsg] = useState('')

  async function login() {
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError('Courriel ou mot de passe incorrect.'); setLoading(false); return }
    router.push('/dashboard')
  }

  async function loginGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard`, scopes: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar.readonly' }
    })
  }

  async function resetPassword() {
    if (!email) { setError('Entrez votre courriel d\'abord.'); return }
    await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset` })
    setMsg(`Un lien a été envoyé à ${email}.`)
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f5f4f0', padding:'2rem' }}>
      <div style={{ background:'white', borderRadius:'16px', border:'0.5px solid rgba(0,0,0,0.1)', padding:'2.5rem 2rem', width:'100%', maxWidth:'380px' }}>

        {/* Logo */}
        <div style={{ display:'flex', alignItems:'center', gap:'10px', justifyContent:'center', marginBottom:'2rem' }}>
          <div style={{ width:'42px', height:'42px', background:'#F2E000', borderRadius:'10px', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg viewBox="0 0 100 100" width="28" height="28">
              <rect width="100" height="100" rx="18" fill="#F2E000"/>
              <rect x="12" y="12" width="20" height="76" rx="10" fill="#111"/>
              <rect x="38" y="12" width="46" height="14" rx="6" fill="#111"/>
              <rect x="54" y="34" width="30" height="13" rx="4" fill="#111"/>
              <rect x="12" y="74" width="72" height="14" rx="6" fill="#111"/>
              <rect x="30" y="50" width="16" height="30" rx="6" fill="#111"/>
              <rect x="18" y="18" width="10" height="62" fill="#F2E000"/>
              <rect x="18" y="18" width="66" height="10" fill="#F2E000"/>
              <rect x="18" y="76" width="66" height="6" fill="#F2E000"/>
              <rect x="60" y="36" width="20" height="9" fill="#F2E000"/>
              <rect x="36" y="52" width="10" height="26" fill="#F2E000"/>
              <rect x="38" y="52" width="40" height="20" fill="#F2E000"/>
            </svg>
          </div>
          <span style={{ fontSize:'22px', fontWeight:'500', letterSpacing:'-0.5px' }}>Grenier</span>
        </div>

        <p style={{ fontSize:'13px', color:'#777', textAlign:'center', marginBottom:'1.5rem' }}>
          Bienvenue. Connectez-vous pour accéder à vos feuilles de temps.
        </p>

        {error && <div style={{ background:'#FCEBEB', border:'0.5px solid #F09595', borderRadius:'8px', padding:'9px 12px', fontSize:'13px', color:'#791F1F', marginBottom:'12px' }}>{error}</div>}
        {msg   && <div style={{ background:'#EAF3DE', border:'0.5px solid #97C459', borderRadius:'8px', padding:'9px 12px', fontSize:'13px', color:'#27500A', marginBottom:'12px' }}>{msg}</div>}

        <div style={{ marginBottom:'12px' }}>
          <label className="label">Adresse courriel</label>
          <input className="form-input" type="email" placeholder="vous@grenier.qc.ca" value={email} onChange={e => setEmail(e.target.value)} />
        </div>

        {!forgot && (
          <div style={{ marginBottom:'16px' }}>
            <label className="label">Mot de passe</label>
            <input className="form-input" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && login()} />
          </div>
        )}

        {!forgot
          ? <button className="btn-primary" style={{ width:'100%', justifyContent:'center' }} onClick={login} disabled={loading}>{loading ? 'Connexion…' : 'Se connecter'}</button>
          : <button className="btn-primary" style={{ width:'100%', justifyContent:'center' }} onClick={resetPassword}>Envoyer le lien</button>
        }

        <div style={{ display:'flex', alignItems:'center', gap:'10px', margin:'1.25rem 0' }}>
          <div style={{ flex:1, height:'0.5px', background:'rgba(0,0,0,0.1)' }}/>
          <span style={{ fontSize:'12px', color:'#aaa' }}>ou</span>
          <div style={{ flex:1, height:'0.5px', background:'rgba(0,0,0,0.1)' }}/>
        </div>

        <button onClick={loginGoogle} style={{ width:'100%', padding:'10px', background:'white', border:'0.5px solid rgba(0,0,0,0.15)', borderRadius:'8px', fontSize:'14px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'10px' }}>
          <svg width="17" height="17" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.35-8.16 2.35-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
          Continuer avec Google
        </button>

        <div style={{ textAlign:'center', marginTop:'1rem', fontSize:'12px', color:'#aaa' }}>
          <span style={{ cursor:'pointer', color:'#9a8600' }} onClick={() => { setForgot(!forgot); setError(''); setMsg('') }}>
            {forgot ? '← Retour à la connexion' : 'Mot de passe oublié ?'}
          </span>
        </div>
      </div>
    </div>
  )
}
