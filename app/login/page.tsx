'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  function switchMode(newMode: 'login' | 'signup') {
    setMode(newMode)
    setError('')
    setSuccess('')
    setPassword('')
    setConfirmPassword('')
  }

  async function login() {
    setLoading(true)
    setError('')
    setSuccess('')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Courriel ou mot de passe incorrect.')
      setLoading(false)
      return
    }
    window.location.replace('/dashboard')
  }

  async function signup() {
    setLoading(true)
    setError('')
    setSuccess('')

    // Validation email @grenier.qc.ca
    const cleanEmail = email.trim().toLowerCase()
    if (!cleanEmail.endsWith('@grenier.qc.ca')) {
      setError('Seules les adresses @grenier.qc.ca peuvent créer un compte.')
      setLoading(false)
      return
    }

    // Validation longueur mot de passe
    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.')
      setLoading(false)
      return
    }

    // Validation correspondance des mots de passe
    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.')
      setLoading(false)
      return
    }

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    })

    if (error) {
      if (error.message.includes('already registered') || error.message.includes('already been registered')) {
        setError('Un compte existe déjà avec ce courriel. Connectez-vous plutôt.')
      } else {
        setError(`Erreur : ${error.message}`)
      }
      setLoading(false)
      return
    }

    if (data.user && !data.session) {
      // Confirmation par courriel requise
      setSuccess('Compte créé ! Vérifiez votre courriel pour confirmer votre inscription, puis revenez vous connecter.')
      setLoading(false)
      return
    }

    if (data.session) {
      // Connexion automatique
      window.location.replace('/dashboard')
      return
    }

    setLoading(false)
  }

  function submit() {
    if (mode === 'login') login()
    else signup()
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f5f4f0', padding:'2rem' }}>
      <div style={{ background:'white', borderRadius:'16px', border:'0.5px solid rgba(0,0,0,0.1)', padding:'2.5rem 2rem', width:'100%', maxWidth:'380px' }}>
        <div style={{ textAlign:'center', fontSize:'22px', fontWeight:'500', marginBottom:'1.5rem' }}>Grenier</div>

        {/* Toggle Connexion / Inscription */}
        <div style={{ display:'flex', background:'#f5f4f0', borderRadius:'10px', padding:'3px', marginBottom:'1.25rem' }}>
          <button
            onClick={() => switchMode('login')}
            style={{
              flex:1, padding:'8px', fontSize:'12px', fontWeight:'500',
              border:'none', borderRadius:'8px', cursor:'pointer',
              background: mode === 'login' ? 'white' : 'transparent',
              color: mode === 'login' ? '#111' : '#777',
              boxShadow: mode === 'login' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
              transition:'all 0.15s',
            }}>
            Connexion
          </button>
          <button
            onClick={() => switchMode('signup')}
            style={{
              flex:1, padding:'8px', fontSize:'12px', fontWeight:'500',
              border:'none', borderRadius:'8px', cursor:'pointer',
              background: mode === 'signup' ? 'white' : 'transparent',
              color: mode === 'signup' ? '#111' : '#777',
              boxShadow: mode === 'signup' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
              transition:'all 0.15s',
            }}>
            S'inscrire
          </button>
        </div>

        <p style={{ fontSize:'13px', color:'#777', textAlign:'center', marginBottom:'1.25rem' }}>
          {mode === 'login'
            ? 'Connectez-vous pour accéder à vos feuilles de temps.'
            : 'Créez votre compte avec votre adresse @grenier.qc.ca.'}
        </p>

        {error && (
          <div style={{ background:'#FCEBEB', borderRadius:'8px', padding:'9px 12px', fontSize:'13px', color:'#791F1F', marginBottom:'12px' }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{ background:'#EAF3DE', borderRadius:'8px', padding:'9px 12px', fontSize:'13px', color:'#27500A', marginBottom:'12px' }}>
            {success}
          </div>
        )}

        <div style={{ marginBottom:'12px' }}>
          <label style={{ display:'block', fontSize:'11px', color:'#777', marginBottom:'5px' }}>Courriel</label>
          <input type="email" placeholder="vous@grenier.qc.ca" value={email}
            onChange={e => setEmail(e.target.value)}
            style={{ width:'100%', padding:'9px 11px', fontSize:'13px', border:'0.5px solid rgba(0,0,0,0.15)', borderRadius:'8px', outline:'none' }} />
        </div>

        <div style={{ marginBottom: mode === 'signup' ? '12px' : '16px' }}>
          <label style={{ display:'block', fontSize:'11px', color:'#777', marginBottom:'5px' }}>
            Mot de passe {mode === 'signup' && <span style={{ color:'#aaa' }}>(min. 8 caractères)</span>}
          </label>
          <div style={{ position:'relative' }}>
            <input
              type={showPw ? 'text' : 'password'}
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && mode === 'login' && submit()}
              style={{ width:'100%', padding:'9px 38px 9px 11px', fontSize:'13px', border:'0.5px solid rgba(0,0,0,0.15)', borderRadius:'8px', outline:'none' }} />
            <div onClick={() => setShowPw(!showPw)}
              style={{ position:'absolute', right:'10px', top:'50%', transform:'translateY(-50%)', cursor:'pointer', color:'#aaa', fontSize:'16px', userSelect:'none' }}>
              {showPw ? '🙈' : '👁'}
            </div>
          </div>
        </div>

        {mode === 'signup' && (
          <div style={{ marginBottom:'16px' }}>
            <label style={{ display:'block', fontSize:'11px', color:'#777', marginBottom:'5px' }}>Confirmer le mot de passe</label>
            <input
              type={showPw ? 'text' : 'password'}
              placeholder="••••••••"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submit()}
              style={{ width:'100%', padding:'9px 11px', fontSize:'13px', border:'0.5px solid rgba(0,0,0,0.15)', borderRadius:'8px', outline:'none' }} />
          </div>
        )}

        <button onClick={submit} disabled={loading}
          style={{ width:'100%', padding:'10px', background:'#F2E000', border:'none', borderRadius:'8px', fontSize:'13px', fontWeight:'500', cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.6 : 1 }}>
          {loading
            ? (mode === 'login' ? 'Connexion…' : 'Création du compte…')
            : (mode === 'login' ? 'Se connecter' : 'Créer mon compte')}
        </button>

        {mode === 'signup' && (
          <p style={{ fontSize:'10px', color:'#aaa', textAlign:'center', marginTop:'12px', lineHeight:'1.5' }}>
            En créant un compte, vous confirmez être employé chez Grenier et acceptez l'usage interne de l'application.
          </p>
        )}
      </div>
    </div>
  )
}
