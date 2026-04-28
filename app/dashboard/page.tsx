'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

const navItems = [
  { href:'/dashboard', label:'Minuterie du jour', active:true, icon:<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="13" r="8" stroke="currentColor" strokeWidth="1.5"/><path d="M12 9v4l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M9 2h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
  { href:'/calendrier', label:'Mon calendrier', icon:<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M3 9h18M9 3v6M15 3v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
  { href:'/taches', label:'Mes tâches', icon:<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M8 9h8M8 13h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
  { href:'/gmail', label:'Mes messages', icon:<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M20 4H4C2.9 4 2 4.9 2 6v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2z" stroke="currentColor" strokeWidth="1.5"/><path d="M2 6l10 7 10-7" stroke="currentColor" strokeWidth="1.5"/></svg> },
  { href:'/rapport', label:'Rapport équipe', adminOnly:true, icon:<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M4 20V8l8-5 8 5v12H4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M9 20v-6h6v6" stroke="currentColor" strokeWidth="1.5"/></svg> },
  { href:'/employes', label:'Employés', adminOnly:true, icon:<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="9" cy="7" r="3" stroke="currentColor" strokeWidth="1.5"/><path d="M3 17c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M16 11a4 4 0 0 1 0 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
]

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [entries, setEntries] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [description, setDescription] = useState('')
  const [catId, setCatId] = useState('')
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [startTime, setStartTime] = useState<string | null>(null)
  const [date, setDate] = useState(new Date())
  const [showManual, setShowManual] = useState(false)
  const [manualDesc, setManualDesc] = useState('')
  const [manualStart, setManualStart] = useState('')
  const [manualEnd, setManualEnd] = useState('')
  const [manualCat, setManualCat] = useState('')
  const [loading, setLoading] = useState(true)
  const interval = useRef<any>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { window.location.href = '/login'; return }
      setUser(data.user)
      setIsAdmin(data.user.email === 'eric@grenier.qc.ca')
      loadCategories(data.user.id)
      loadEntries(data.user.id, new Date())
      setLoading(false)
    })
  }, [])

  async function loadCategories(uid: string) {
    const { data } = await supabase.from('categories').select('*').or(`user_id.eq.${uid},is_global.eq.true`).order('name')
    setCategories(data || [])
    if (data?.length) setCatId(data[0].id)
  }

  async function loadEntries(uid: string, d: Date) {
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString()
    const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59).toISOString()
    const { data } = await supabase.from('time_entries').select('*, category:categories(name,color)').eq('user_id', uid).gte('started_at', start).lte('started_at', end).order('started_at', { ascending: false })
    setEntries(data || [])
  }

  function toggleTimer() {
    if (!running) {
      setStartTime(new Date().toISOString())
      setRunning(true)
      interval.current = setInterval(() => setElapsed(e => e + 1), 1000)
    } else {
      clearInterval(interval.current)
      setRunning(false)
      saveEntry()
    }
  }

  async function saveEntry() {
    if (!user || elapsed < 5) return
    const endTime = new Date().toISOString()
    await supabase.from('time_entries').insert({
      user_id: user.id,
      description: description || 'Tâche sans titre',
      category_id: catId || null,
      started_at: startTime,
      ended_at: endTime,
      duration: elapsed,
      source: 'timer'
    })
    setElapsed(0); setDescription(''); setStartTime(null)
    loadEntries(user.id, date)
  }

  async function saveManual() {
    if (!user || !manualDesc || !manualStart || !manualEnd) return
    const s = new Date(`${date.toISOString().split('T')[0]}T${manualStart}`)
    const e = new Date(`${date.toISOString().split('T')[0]}T${manualEnd}`)
    await supabase.from('time_entries').insert({
      user_id: user.id, description: manualDesc,
      category_id: manualCat || null,
      started_at: s.toISOString(), ended_at: e.toISOString(),
      duration: Math.floor((e.getTime() - s.getTime()) / 1000), source: 'manual'
    })
    setShowManual(false); setManualDesc(''); setManualStart(''); setManualEnd('')
    loadEntries(user.id, date)
  }

  function shiftDay(d: number) {
    const nd = new Date(date); nd.setDate(date.getDate() + d)
    setDate(nd)
    if (user) loadEntries(user.id, nd)
  }

  const fmt = (s: number) => `${Math.floor(s/3600)}:${String(Math.floor((s%3600)/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`
  const fmtH = (s: number) => `${Math.floor(s/3600)}h ${String(Math.floor((s%3600)/60)).padStart(2,'0')}`
  const fmtTime = (iso: string) => iso ? new Date(iso).toLocaleTimeString('fr-CA', { hour:'2-digit', minute:'2-digit' }) : '–'
  const totalSec = entries.reduce((sum, e) => sum + (e.duration || 0), 0)
  const initials = user?.email?.split('@')[0].slice(0,2).toUpperCase() || 'ÉG'
  const isToday = date.toDateString() === new Date().toDateString()
  const dayLabel = isToday ? "Aujourd'hui" : date.getDate() + ' ' + date.toLocaleString('fr-CA', { month: 'short' })

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f5f4f0' }}>
      <div style={{ fontSize:'13px', color:'#aaa' }}>Chargement...</div>
    </div>
  )

  return (
    <div style={{ display:'flex', minHeight:'100vh' }}>
      <div style={{ width:'200px', background:'#111', display:'flex', flexDirection:'column', padding:'16px 0', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px', padding:'0 16px', marginBottom:'24px', cursor:'pointer' }} onClick={() => window.location.href='/dashboard'}>
          <img src="/Grenier_Symbole_RGB.png" alt="Grenier" style={{ width:'32px', height:'32px', objectFit:'contain' }} />
          <span style={{ color:'#F2E000', fontSize:'16px', fontWeight:'500' }}>Grenier</span>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:'2px', padding:'0 8px' }}>
          {navItems.filter(item => !item.adminOnly || isAdmin).map(item => (
            <div key={item.href} onClick={() => window.location.href=item.href}
              style={{ display:'flex', alignItems:'center', gap:'10px', padding:'9px 10px', borderRadius:'8px', cursor:'pointer', background: item.active ? '#F2E000' : 'transparent', color: item.active ? '#111' : 'rgba(255,255,255,0.6)' }}
              onMouseEnter={e => { if (!item.active) (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.08)' }}
              onMouseLeave={e => { if (!item.active) (e.currentTarget as HTMLElement).style.background='transparent' }}>
              {item.icon}
              <span style={{ fontSize:'13px', fontWeight: item.active ? '500' : '400' }}>{item.label}</span>
            </div>
          ))}
        </div>
        <div style={{ flex:1 }} />
        <div style={{ padding:'0 8px' }}>
          <div onClick={() => supabase.auth.signOut().then(() => window.location.href='/login')}
            style={{ display:'flex', alignItems:'center', gap:'10px', padding:'9px 10px', borderRadius:'8px', cursor:'pointer', color:'rgba(255,255,255,0.5)' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.08)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background='transparent'}>
            <div style={{ width:'26px', height:'26px', borderRadius:'50%', background:'#F2E000', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'10px', fontWeight:'500', color:'#111' }}>{initials}</div>
            <span style={{ fontSize:'12px' }}>Déconnexion</span>
          </div>
        </div>
      </div>

      <div style={{ flex:1, display:'flex', flexDirection:'column', minHeight:'100vh' }}>
        <div style={{ background:'#111', padding:'14px 1.25rem', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <h1 style={{ fontSize:'15px', fontWeight:'500', color:'#F2E000' }}>Minuterie du jour</h1>
          <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
            <button onClick={() => shiftDay(-1)} style={{ background:'rgba(255,255,255,0.1)', border:'none', borderRadius:'6px', padding:'4px 9px', fontSize:'12px', color:'white', cursor:'pointer' }}>←</button>
            <span style={{ fontSize:'13px', color:'rgba(255,255,255,0.7)', minWidth:'90px', textAlign:'center' }}>{dayLabel}</span>
            <button onClick={() => shiftDay(1)} style={{ background:'rgba(255,255,255,0.1)', border:'none', borderRadius:'6px', padding:'4px 9px', fontSize:'12px', color:'white', cursor:'pointer' }}>→</button>
          </div>
        </div>

        <div style={{ flex:1, background:'#f5f4f0', padding:'1.25rem', display:'flex', flexDirection:'column', gap:'12px' }}>
          <div style={{ background:'white', border:'0.5px solid rgba(0,0,0,0.1)', borderRadius:'12px', padding:'12px 14px', display:'flex', alignItems:'center', gap:'10px' }}>
            <input style={{ flex:1, border:'none', background:'transparent', fontSize:'14px', outline:'none' }}
              placeholder="Sur quoi travaillez-vous ?" value={description} onChange={e => setDescription(e.target.value)} />
            <select style={{ fontSize:'12px', border:'0.5px solid rgba(0,0,0,0.1)', borderRadius:'20px', padding:'4px 10px', background:'#f9f9f7', color:'#555', outline:'none' }}
              value={catId} onChange={e => setCatId(e.target.value)}>
              <option value="">Catégorie</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <span style={{ fontSize:'18px', fontWeight:'500', minWidth:'74px', textAlign:'right', fontVariantNumeric:'tabular-nums' }}>{fmt(elapsed)}</span>
            <button onClick={toggleTimer} style={{ width:'34px', height:'34px', borderRadius:'50%', background: running ? '#E24B4A' : '#F2E000', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
              {running
                ? <svg width="12" height="12" viewBox="0 0 12 12"><rect x="0" y="0" width="4" height="12" fill="white"/><rect x="8" y="0" width="4" height="12" fill="white"/></svg>
                : <svg width="11" height="11" viewBox="0 0 10 12"><polygon points="0,0 10,6 0,12" fill="#111"/></svg>}
            </button>
          </div>

          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontSize:'11px', fontWeight:'500', color:'#aaa', textTransform:'uppercase', letterSpacing:'0.7px' }}>Entrées</span>
            <span style={{ fontSize:'12px', color:'#777' }}>Total : {fmtH(totalSec)}</span>
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
            {entries.length === 0 && <div style={{ textAlign:'center', fontSize:'13px', color:'#aaa', padding:'1.5rem 0' }}>Aucune entrée pour ce jour.</div>}
            {entries.map(e => (
              <div key={e.id} style={{ background:'white', border:'0.5px solid rgba(0,0,0,0.1)', borderRadius:'10px', padding:'9px 12px', display:'flex', alignItems:'center', gap:'10px' }}>
                <div style={{ width:'8px', height:'8px', borderRadius:'50%', background: e.category?.color || '#ccc', flexShrink:0 }} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:'13px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{e.description}</div>
                  <div style={{ fontSize:'11px', color:'#aaa', marginTop:'2px' }}>{e.category?.name || '–'}</div>
                </div>
                <span style={{ fontSize:'12px', color:'#aaa', whiteSpace:'nowrap' }}>{fmtTime(e.started_at)} → {fmtTime(e.ended_at)}</span>
                <span style={{ fontSize:'13px', fontWeight:'500', minWidth:'42px', textAlign:'right', fontVariantNumeric:'tabular-nums' }}>{fmtH(e.duration || 0)}</span>
              </div>
            ))}
          </div>

          <div>
            <button onClick={() => setShowManual(!showManual)} style={{ fontSize:'12px', color:'#aaa', border:'none', background:'none', cursor:'pointer', padding:0 }}>
              + Ajouter une entrée manuellement
            </button>
            {showManual && (
              <div style={{ background:'white', border:'0.5px solid rgba(0,0,0,0.1)', borderRadius:'12px', padding:'1rem', marginTop:'8px' }}>
                <div style={{ marginBottom:'10px' }}>
                  <label style={{ display:'block', fontSize:'11px', color:'#777', marginBottom:'5px' }}>Description</label>
                  <input style={{ width:'100%', padding:'8px 10px', fontSize:'13px', border:'0.5px solid rgba(0,0,0,0.15)', borderRadius:'8px', outline:'none' }}
                    value={manualDesc} onChange={e => setManualDesc(e.target.value)} placeholder="Description de la tâche" />
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'8px', marginBottom:'10px' }}>
                  <div>
                    <label style={{ display:'block', fontSize:'11px', color:'#777', marginBottom:'5px' }}>Début</label>
                    <input type="time" style={{ width:'100%', padding:'8px 10px', fontSize:'13px', border:'0.5px solid rgba(0,0,0,0.15)', borderRadius:'8px', outline:'none' }}
                      value={manualStart} onChange={e => setManualStart(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ display:'block', fontSize:'11px', color:'#777', marginBottom:'5px' }}>Fin</label>
                    <input type="time" style={{ width:'100%', padding:'8px 10px', fontSize:'13px', border:'0.5px solid rgba(0,0,0,0.15)', borderRadius:'8px', outline:'none' }}
                      value={manualEnd} onChange={e => setManualEnd(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ display:'block', fontSize:'11px', color:'#777', marginBottom:'5px' }}>Catégorie</label>
                    <select style={{ width:'100%', padding:'8px 10px', fontSize:'13px', border:'0.5px solid rgba(0,0,0,0.15)', borderRadius:'8px', outline:'none' }}
                      value={manualCat} onChange={e => setManualCat(e.target.value)}>
                      <option value="">–</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end' }}>
                  <button onClick={() => setShowManual(false)} style={{ padding:'7px 14px', fontSize:'13px', border:'0.5px solid rgba(0,0,0,0.15)', borderRadius:'8px', background:'none', cursor:'pointer' }}>Annuler</button>
                  <button onClick={saveManual} style={{ padding:'7px 16px', fontSize:'13px', background:'#F2E000', border:'none', borderRadius:'8px', fontWeight:'500', cursor:'pointer' }}>Ajouter</button>
                </div>
              </div>
            )}
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'8px' }}>
            {[
              { label:"Aujourd'hui", val: fmtH(totalSec), sub:'sur 8h objectif' },
              { label:'Cette semaine', val:'–', sub:'lun – ven' },
              { label:'Ce mois', val:'–', sub: new Date().toLocaleString('fr-CA',{month:'long',year:'numeric'}) },
            ].map(s => (
              <div key={s.label} style={{ background:'white', border:'0.5px solid rgba(0,0,0,0.1)', borderRadius:'10px', padding:'10px 12px' }}>
                <div style={{ fontSize:'11px', color:'#aaa', marginBottom:'3px' }}>{s.label}</div>
                <div style={{ fontSize:'18px', fontWeight:'500' }}>{s.val}</div>
                <div style={{ fontSize:'11px', color:'#aaa', marginTop:'2px' }}>{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
