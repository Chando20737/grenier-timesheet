'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function login() {
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError('Courriel ou mot de passe incorrect.'); setLoading(false); return }
    window.location.href = '/dashboard'
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f5f4f0', padding:'2rem' }}>
      <div style={{ background:'white', borderRadius:'16px', border:'0.5px solid rgba(0,0,0,0.1)', padding:'2.5rem 2rem', width:'100%', maxWidth:'380px' }}>
        <div style={{ textAlign:'center', fontSize:'22px', fontWeight:'500', marginBottom:'1.5rem' }}>Grenier</div>
        <p style={{ fontSize:'13px', color:'#777', textAlign:'center', marginBottom:'1.5rem' }}>Connectez-vous pour accéder à vos feuilles de temps.</p>
        {error && <div style={{ background:'#FCEBEB', borderRadius:'8px', padding:'9px 12px', fontSize:'13px', color:'#791F1F', marginBottom:'12px' }}>{error}</div>}
        <div style={{ marginBottom:'12px' }}>
          <label style={{ display:'block', fontSize:'11px', color:'#777', marginBottom:'5px' }}>Adresse courriel</label>
          <input style={{ width:'100%', padding:'9px 11px', fontSize:'13px', border:'0.5px solid rgba(0,0,0,0.15)', borderRadius:'8px', background:'#f9f9f7', outline:'none', boxSizing:'border-box' }}
            type="email" placeholder="vous@grenier.qc.ca" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div style={{ marginBottom:'16px' }}>
          <label style={{ display:'block', fontSize:'11px', color:'#777', marginBottom:'5px' }}>Mot de passe</label>
          <input style={{ width:'100%', padding:'9px 11px', fontSize:'13px', border:'0.5px solid rgba(0,0,0,0.15)', borderRadius:'8px', background:'#f9f9f7', outline:'none', boxSizing:'border-box' }}
            type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && login()} />
        </div>
        <button onClick={login} disabled={loading}
          style={{ width:'100%', padding:'10px', background:'#F2E000', border:'none', borderRadius:'8px', fontSize:'13px', fontWeight:'500', cursor:'pointer' }}>
          {loading ? 'Connexion…' : 'Se connecter'}
        </button>
      </div>
    </div>
  )
}
