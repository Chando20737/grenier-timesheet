'use client'
import { useState, useEffect } from 'react'

export default function DashboardPage() {
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setLoaded(true)
  }, [])

  if (!loaded) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f5f4f0' }}>
      <div style={{ fontSize:'13px', color:'#aaa' }}>Chargement...</div>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'#f5f4f0', padding:'2rem' }}>
      <div style={{ maxWidth:'800px', margin:'0 auto' }}>
        <div style={{ fontSize:'22px', fontWeight:'500', marginBottom:'2rem' }}>Grenier — Feuilles de temps</div>
        <div style={{ background:'white', borderRadius:'16px', padding:'2rem', border:'0.5px solid rgba(0,0,0,0.1)' }}>
          <p style={{ fontSize:'14px', color:'#555' }}>Bienvenue ! Vous êtes connecté avec succès.</p>
          <p style={{ fontSize:'13px', color:'#aaa', marginTop:'8px' }}>Le dashboard complet sera disponible prochainement.</p>
        </div>
      </div>
    </div>
  )
}
