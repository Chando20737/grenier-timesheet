'use client'
import { useState } from 'react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function login() {
    setLoading(true); setError('')
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError('Courriel ou mot de passe incorrect.'); setLoading(false); return }
    window.location.href = '/dashboard'
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f5f4f0' }}>
      <div style={{ background:'white', borderRadius:'16px', padding:'2.5rem 2rem', width:'100%', maxWidth:'380px' }}>
        <div style={{ fontSize:'22px', fontWeight:'500', marginBottom:'1.5rem', textAlign:'center' }}>Grenier</div>
        {error && <div style={{ background:'#FCEBEB', borderRadius:'8px', padding:'9px 12px', fontSize:'13px', color:'#791F1F', margin
