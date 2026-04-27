'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null)
  const [entries, setEntries] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [description, setDescription] = useState('')
  const [catId, setCatId] = useState('')
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [startTime, setStartTime] = useState<Date | null>(null)
  const [date, setDate] = useState(new Date())
  const [showManual, setShowManual] = useState(false)
  const [manualDesc, setManualDesc] = useState('')
  const [manualStart, setManualStart] = useState('')
  const [manualEnd, setManualEnd] = useState('')
  const [manualCat, setManualCat] = useState('')
  const interval = useRef<any>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      if (data.user) { loadCategories(data.user.id); loadEntries(data.user.id, new Date()) }
    })
  }, [])

  async function loadCategories(userId: string) {
    const { data } = await supabase.from('categories').select('*').or(`user_id.eq.${userId},is_global.eq.true`).order('name')
    setCategories(data || [])
    if (data?.length) setCatId(data[0].id)
  }

  async function loadEntries(userId: string, d: Date) {
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString()
    const end   = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59).toISOString()
    const { data } = await supabase.from('time_entries').select('*, category:categories(name,color)').eq('user_id', userId).gte('started_at', start).lte('started_at', end).order('started_at', { ascending: false })
    setEntries(data || [])
  }

  function toggleTimer() {
    if (!running) {
      setStartTime(new Date())
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
    const endTime = new Date()
    await supabase.from('time_entries').insert({
      user_id: user.id,
      description: description || 'Tâche sans titre',
      category_id: catId || null,
      started_at: startTime?.toISOString(),
      ended_at: endTime.toISOString(),
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
  const initials = user?.user_metadata?.full_name?.split(' ').map((w:string)=>w[0]).join('').slice(0,2).toUpperCase() || 'ÉG'
  const isToday = date.toDateString() === new Date().toDateString()
  const dayLabel = isToday ? "Aujourd'hui" : date.getDate() + ' ' + date.toLocaleString('fr-CA', { month: 'short' })

  return (
    <div style={{ display:'flex', minHeight:'100vh' }}>
      <Sidebar userInitials={initials} />
      <div className="main-content" style={{ flex:1 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1.25rem' }}>
          <h1 style={{ fontSize:'15px', fontWeight:'500' }}>Minuterie du jour</h1>
          <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
            <button className="btn-ghost" style={{ padding:'4px 9px', fontSize:'12px' }} onClick={() => shiftDay(-1)}>←</button>
            <span style={{ fontSize:'13px', color:'#555', minWidth:'90px', textAlign:'center' }}>{dayLabel}</span>
            <button className="btn-ghost" style={{ padding:'4px 9px', fontSize:'12px' }} onClick={() => shiftDay(1)}>→</button>
          </div>
        </div>

        {/* Timer bar */}
        <div className="card" style={{ padding:'12px 14px', display:'flex', alignItems:'center', gap:'10px', marginBottom:'1rem' }}>
          <input style={{ flex:1, border:'none', background:'transparent', fontSize:'14px', outline:'none' }} placeholder="Sur quoi travaillez-vous ?" value={description} onChange={e => setDescription(e.target.value)} />
          <select style={{ fontSize:'12px', border:'0.5px solid rgba(0,0,0,0.1)', borderRadius:'20px', padding:'4px 10px', background:'#f9f9f7', color:'#555', outline:'none' }} value={catId} onChange={e => setCatId(e.target.value)}>
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

        {/* Section label */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' }}>
          <span style={{ fontSize:'11px', fontWeight:'500', color:'#aaa', textTransform:'uppercase', letterSpacing:'0.7px' }}>Entrées</span>
          <span style={{ fontSize:'12px', color:'#777' }}>Total : {fmtH(totalSec)}</span>
        </div>

        {/* Entries */}
        <div style={{ display:'flex', flexDirection:'column', gap:'6px', marginBottom:'1rem' }}>
          {entries.length === 0 && <div style={{ textAlign:'center', fontSize:'13px', color:'#aaa', padding:'1.5rem 0' }}>Aucune entrée pour ce jour.</div>}
          {entries.map(e => (
            <div key={e.id} className="card" style={{ padding:'9px 12px', display:'flex', alignItems:'center', gap:'10px' }}>
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

        {/* Add manual */}
        <div style={{ marginBottom:'1rem' }}>
          <button className="btn-ghost" style={{ fontSize:'12px', color:'#aaa', border:'none', padding:'0' }} onClick={() => setShowManual(!showManual)}>
            + Ajouter une entrée manuellement
          </button>
          {showManual && (
            <div className="card" style={{ padding:'1rem', marginTop:'8px' }}>
              <div style={{ marginBottom:'10px' }}>
                <label className="label">Description</label>
                <input className="form-input" value={manualDesc} onChange={e => setManualDesc(e.target.value)} placeholder="Description de la tâche" />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'8px', marginBottom:'10px' }}>
                <div><label className="label">Début</label><input className="form-input" type="time" value={manualStart} onChange={e => setManualStart(e.target.value)} /></div>
                <div><label className="label">Fin</label><input className="form-input" type="time" value={manualEnd} onChange={e => setManualEnd(e.target.value)} /></div>
                <div><label className="label">Catégorie</label>
                  <select className="form-input" value={manualCat} onChange={e => setManualCat(e.target.value)}>
                    <option value="">–</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end' }}>
                <button className="btn-ghost" onClick={() => setShowManual(false)}>Annuler</button>
                <button className="btn-primary" onClick={saveManual}>Ajouter</button>
              </div>
            </div>
          )}
        </div>

        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'8px' }}>
          {[
            { label:"Aujourd'hui", val: fmtH(totalSec), sub:'sur 8h objectif' },
            { label:'Cette semaine', val:'–', sub:'lun – ven' },
            { label:'Ce mois', val:'–', sub: new Date().toLocaleString('fr-CA',{month:'long',year:'numeric'}) },
          ].map(s => (
            <div key={s.label} className="card" style={{ padding:'10px 12px' }}>
              <div style={{ fontSize:'11px', color:'#aaa', marginBottom:'3px' }}>{s.label}</div>
              <div style={{ fontSize:'18px', fontWeight:'500' }}>{s.val}</div>
              <div style={{ fontSize:'11px', color:'#aaa', marginTop:'2px' }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
