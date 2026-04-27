'use client'
import { useState } from 'react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function login() {
    setLoading(true)
    setError('')
    const { createClient } = await import('@supabase/supabase-js')
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      { auth: { persistSession: true, storageKey: 'sb-grenier-auth-token' } }
    )
    const { data, error } = await sb.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Courriel ou mot de passe incorrect.')
      setLoading(false)
      return
    }
    // Sauvegarder la session dans localStorage avant de rediriger
    if (data.session) {
      localStorage.setItem('sb-grenier-auth-token', JSON.stringify({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at
      }))
    }
    window.location.href = '/dashboard'
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f5f4f0', padding:'2rem' }}>
      <div style={{ background:'white', borderRadius:'16px', border:'0.5px solid rgba(0,0,0,0.1)', padding:'2.5rem 2rem', width:'100%', maxWidth:'380px' }}>
        <div style={{ textAlign:'center', fontSize:'22px', fontWeight:'500', marginBottom:'1.5rem' }}>Grenier</div>
        <p style={{ fontSize:'13px', color:'#777', textAlign:'center', marginBottom:'1.5rem' }}>Connectez-vous pour accéder à vos feuilles de temps.</p>
        {error && (
          <div style={{ background:'#FCEBEB', borderRadius:'8px', padding:'9px 12px', fontSize:'13px', color:'#791F1F', marginBottom:'12px' }}>
            {error}
          </div>
        )}
        <div style={{ marginBottom:'12px' }}>
          <label style={{ display:'block', fontSize:'11px', color:'#777', marginBottom:'5px' }}>Courriel</label>
          <input type="email" placeholder="vous@grenier.qc.ca" value={email}
            onChange={e => setEmail(e.target.value)}
            style={{ width:'100%', padding:'9px 11px', fontSize:'13px', border:'0.5px solid rgba(0,0,0,0.15)', borderRadius:'8px', outline:'none' }} />
        </div>
        <div style={{ marginBottom:'16px' }}>
          <label style={{ display:'block', fontSize:'11px', color:'#777', marginBottom:'5px' }}>Mot de passe</label>
          <input type="password" placeholder="••••••••" value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && login()}
            style={{ width:'100%', padding:'9px 11px', fontSize:'13px', border:'0.5px solid rgba(0,0,0,0.15)', borderRadius:'8px', outline:'none' }} />
        </div>
        <button onClick={login} disabled={loading}
          style={{ width:'100%', padding:'10px', background:'#F2E000', border:'none', borderRadius:'8px', fontSize:'13px', fontWeight:'500', cursor:'pointer' }}>
          {loading ? 'Connexion…' : 'Se connecter'}
        </button>
      </div>
    </div>
  )
}
