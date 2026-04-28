'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const JOURS = ['Lun','Mar','Mer','Jeu','Ven']
const MOIS = ['jan','fév','mar','avr','mai','jun','jul','aoû','sep','oct','nov','déc']
const HOURS = Array.from({length:11}, (_,i) => i + 8)

const navItems = [
  { href:'/dashboard', label:'Minuterie du jour', icon:<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="13" r="8" stroke="currentColor" strokeWidth="1.5"/><path d="M12 9v4l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
  { href:'/calendrier', label:'Mon calendrier', active:true, icon:<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M3 9h18M9 3v6M15 3v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
  { href:'/taches', label:'Mes tâches', icon:<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M8 9h8M8 13h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
  { href:'/gmail', label:'Mes messages', icon:<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M20 4H4C2.9 4 2 4.9 2 6v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2z" stroke="currentColor" strokeWidth="1.5"/><path d="M2 6l10 7 10-7" stroke="currentColor" strokeWidth="1.5"/></svg> },
  { href:'/rapport', label:'Rapport équipe', adminOnly:true, icon:<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M4 20V8l8-5 8 5v12H4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M9 20v-6h6v6" stroke="currentColor" strokeWidth="1.5"/></svg> },
  { href:'/employes', label:'Employés', adminOnly:true, icon:<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="9" cy="7" r="3" stroke="currentColor" strokeWidth="1.5"/><path d="M3 17c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
]

export default function CalendrierPage() {
  const [user, setUser] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [weekOffset, setWeekOffset] = useState(0)
  const [selectedDay, setSelectedDay] = useState(new Date().getDay() === 0 ? 0 : new Date().getDay() - 1)
  const [tasks, setTasks] = useState<any[]>([])
  const [showModal, setShowModal] = useState(false)
  const [modalHour, setModalHour] = useState('09:00')
  const [modalDesc, setModalDesc] = useState('')
  const [modalDur, setModalDur] = useState('60')
  const [categories, setCategories] = useState<any[]>([])
  const [modalCat, setModalCat] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { window.location.href = '/login'; return }
      setUser(data.user)
      setIsAdmin(data.user.email === 'eric@grenier.qc.ca')
      loadCategories(data.user.id)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (user) loadTasks()
  }, [user, weekOffset, selectedDay])

  async function loadCategories(uid: string) {
    const { data } = await supabase.from('categories').select('*').or(`user_id.eq.${uid},is_global.eq.true`).order('name')
    setCategories(data || [])
  }

  function getMonday() {
    const now = new Date()
    const day = now.getDay()
    const diff = now.getDate() - day + (day === 0 ? -6 : 1) + weekOffset * 7
    const m = new Date(now)
    m.setDate(diff)
    m.setHours(0,0,0,0)
    return m
  }

  function getDateForDay(i: number) {
    const m = getMonday()
    const d = new Date(m)
    d.setDate(m.getDate() + i)
    return d
  }

  function dateStr(d: Date) {
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0')
  }

  async function loadTasks() {
    if (!user) return
    const d = getDateForDay(selectedDay)
    const start = new Date(d); start.setHours(0,0,0,0)
    const end = new Date(d); end.setHours(23,59,59,999)
    const { data } = await supabase.from('tasks')
      .select('*, category:categories(name,color)')
      .eq('user_id', user.id)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .order('created_at')
    setTasks(data || [])
  }

  async function saveTask() {
    if (!modalDesc.trim() || !user) return
    const d = getDateForDay(selectedDay)
    const [h, m] = modalHour.split(':').map(Number)
    const scheduledAt = new Date(d)
    scheduledAt.setHours(h, m, 0, 0)
    await supabase.from('tasks').insert({
      user_id: user.id,
      description: modalDesc,
      category_id: modalCat || null,
      estimated_duration: modalDur + ' min',
      source: 'manual',
      scheduled_at: scheduledAt.toISOString(),
    })
    setShowModal(false); setModalDesc(''); setModalHour('09:00'); setModalDur('60')
    loadTasks()
  }

  function timeToMin(t: string) {
    const [h,m] = t.split(':').map(Number)
    return h*60+m
  }

  function fmtEnd(time: string, dur: string) {
    const mins = timeToMin(time) + parseInt(dur || '60')
    return Math.floor(mins/60)+':'+String(mins%60).padStart(2,'0')
  }

  const monday = getMonday()
  const friday = new Date(monday); friday.setDate(monday.getDate()+4)
  const todayStr = dateStr(new Date())
  const initials = user?.email?.split('@')[0].slice(0,2).toUpperCase() || 'ÉG'

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f5f4f0' }}>
      <div style={{ fontSize:'13px', color:'#aaa' }}>Chargement...</div>
    </div>
  )

  return (
    <div style={{ display:'flex', minHeight:'100vh' }}>
      {/* Sidebar */}
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

      {/* Main */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', minHeight:'100vh', minWidth:0 }}>
        {/* Topbar */}
        <div style={{ background:'#111', padding:'10px 1rem', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <h1 style={{ fontSize:'15px', fontWeight:'500', color:'#F2E000' }}>Mon calendrier</h1>
          <button onClick={() => setShowModal(true)}
            style={{ background:'#F2E000', border:'none', borderRadius:'8px', padding:'7px 12px', fontSize:'13px', fontWeight:'500', cursor:'pointer', color:'#111' }}>
            + Nouvelle tâche
          </button>
        </div>

        {/* Day tabs bar */}
        <div style={{ background:'#1a1a1a', borderBottom:'0.5px solid rgba(255,255,255,0.08)', display:'flex', alignItems:'center', padding:'0 8px', gap:'8px', flexShrink:0 }}>
          <button onClick={() => setWeekOffset(w => w-1)}
            style={{ background:'#F2E000', border:'none', borderRadius:'6px', width:'28px', height:'28px', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="#111" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>

          <div style={{ display:'flex', flex:1 }}>
            {JOURS.map((j, i) => {
              const d = getDateForDay(i)
              const ds = dateStr(d)
              const isToday = ds === todayStr
              const isActive = i === selectedDay
              return (
                <div key={i} onClick={() => setSelectedDay(i)}
                  style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', padding:'8px 4px', borderRadius:'8px', cursor:'pointer', background: isActive ? 'rgba(242,224,0,0.1)' : 'transparent' }}>
                  <span style={{ fontSize:'10px', color: isActive ? '#F2E000' : 'rgba(255,255,255,0.45)', textTransform:'uppercase', letterSpacing:'0.5px' }}>{j}</span>
                  <span style={{ fontSize:'16px', fontWeight:'500', color: isActive ? '#F2E000' : 'rgba(255,255,255,0.8)', marginTop:'2px',
                    ...(isToday ? { background:'#F2E000', color:'#111', width:'28px', height:'28px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'13px' } : {}) }}>
                    {d.getDate()}
                  </span>
                </div>
              )
            })}
          </div>

          <span style={{ fontSize:'11px', color:'rgba(255,255,255,0.5)', whiteSpace:'nowrap' }}>
            {monday.getDate()} – {friday.getDate()} {MOIS[friday.getMonth()]}
          </span>

          <button onClick={() => setWeekOffset(w => w+1)}
            style={{ background:'#F2E000', border:'none', borderRadius:'6px', width:'28px', height:'28px', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="#111" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>

        {/* Légende */}
        <div style={{ display:'flex', gap:'12px', padding:'7px 1rem', background:'white', borderBottom:'0.5px solid rgba(0,0,0,0.08)', flexShrink:0 }}>
          {[{color:'#3B6D11',label:'Tâche'},{color:'#A32D2D',label:'Gmail'},{color:'#185FA5',label:'Google Agenda'}].map(l => (
            <div key={l.label} style={{ display:'flex', alignItems:'center', gap:'5px', fontSize:'11px', color:'#777' }}>
              <div style={{ width:'8px', height:'8px', borderRadius:'2px', background:l.color }} />
              {l.label}
            </div>
          ))}
        </div>

        {/* Calendrier horaire */}
        <div style={{ flex:1, background:'#f5f4f0', overflowY:'auto' }}>
          <div style={{ display:'flex', background:'white', minHeight:'540px' }}>
            {/* Colonne heures */}
            <div style={{ width:'48px', flexShrink:0, borderRight:'0.5px solid rgba(0,0,0,0.08)' }}>
              <div style={{ height:'8px' }} />
              {HOURS.map(h => (
                <div key={h} style={{ height:'60px', borderBottom:'0.5px solid rgba(0,0,0,0.06)', display:'flex', alignItems:'flex-start', justifyContent:'flex-end', padding:'4px 6px 0 0', fontSize:'11px', color:'#bbb' }}>
                  {h}:00
                </div>
              ))}
            </div>

            {/* Colonne tâches */}
            <div style={{ flex:1, position:'relative' }}>
              {HOURS.map(h => (
                <div key={h} onClick={() => { setModalHour(String(h).padStart(2,'0')+':00'); setShowModal(true) }}
                  style={{ height:'60px', borderBottom:'0.5px solid rgba(0,0,0,0.05)', cursor:'pointer' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background='#fafaf8'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background='transparent'} />
              ))}
              {tasks.filter(t => t.scheduled_at).map(t => {
                const d = new Date(t.scheduled_at)
                const mins = d.getHours()*60 + d.getMinutes()
                const top = (mins - 8*60)
                const dur = parseInt(t.estimated_duration || '60')
                const height = Math.max(dur, 30)
                const endMin = mins + dur
                const endStr = Math.floor(endMin/60)+':'+String(endMin%60).padStart(2,'0')
                const timeStr = String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')
                const color = t.source === 'gmail' ? { bg:'#FCEBEB', text:'#791F1F', border:'#A32D2D' }
                  : t.source === 'calendar' ? { bg:'#E6F1FB', text:'#0C447C', border:'#185FA5' }
                  : { bg:'#EAF3DE', text:'#27500A', border:'#3B6D11' }
                return (
                  <div key={t.id} style={{ position:'absolute', left:'6px', right:'6px', top:`${top}px`, height:`${height}px`, borderRadius:'6px', padding:'4px 7px', overflow:'hidden', cursor:'pointer', background:color.bg, color:color.text, borderLeft:`3px solid ${color.border}`, zIndex:1 }}>
                    <div style={{ fontSize:'12px', fontWeight:'500', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{t.description}</div>
                    <div style={{ fontSize:'10px', opacity:0.75, marginTop:'1px' }}>{timeStr} – {endStr}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Modal nouvelle tâche */}
      {showModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.35)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50 }}>
          <div style={{ background:'white', borderRadius:'16px', padding:'1.5rem', width:'320px' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize:'14px', fontWeight:'500', marginBottom:'1rem' }}>Nouvelle tâche planifiée</div>
            <div style={{ marginBottom:'10px' }}>
              <label style={{ fontSize:'11px', color:'#777', display:'block', marginBottom:'4px' }}>Description</label>
              <input value={modalDesc} onChange={e => setModalDesc(e.target.value)} placeholder="Ex: Préparer la réunion"
                style={{ width:'100%', padding:'8px 10px', fontSize:'13px', border:'0.5px solid rgba(0,0,0,0.15)', borderRadius:'8px', outline:'none' }} />
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'10px' }}>
              <div>
                <label style={{ fontSize:'11px', color:'#777', display:'block', marginBottom:'4px' }}>Heure</label>
                <input type="time" value={modalHour} onChange={e => setModalHour(e.target.value)}
                  style={{ width:'100%', padding:'8px 10px', fontSize:'13px', border:'0.5px solid rgba(0,0,0,0.15)', borderRadius:'8px', outline:'none' }} />
              </div>
              <div>
                <label style={{ fontSize:'11px', color:'#777', display:'block', marginBottom:'4px' }}>Durée (min)</label>
                <input type="number" value={modalDur} onChange={e => setModalDur(e.target.value)} placeholder="60"
                  style={{ width:'100%', padding:'8px 10px', fontSize:'13px', border:'0.5px solid rgba(0,0,0,0.15)', borderRadius:'8px', outline:'none' }} />
              </div>
            </div>
            <div style={{ marginBottom:'12px' }}>
              <label style={{ fontSize:'11px', color:'#777', display:'block', marginBottom:'4px' }}>Catégorie</label>
              <select value={modalCat} onChange={e => setModalCat(e.target.value)}
                style={{ width:'100%', padding:'8px 10px', fontSize:'13px', border:'0.5px solid rgba(0,0,0,0.15)', borderRadius:'8px', outline:'none' }}>
                <option value="">–</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end' }}>
              <button onClick={() => setShowModal(false)} style={{ padding:'7px 14px', fontSize:'13px', border:'0.5px solid rgba(0,0,0,0.15)', borderRadius:'8px', background:'none', cursor:'pointer' }}>Annuler</button>
              <button onClick={saveTask} style={{ padding:'7px 16px', fontSize:'13px', background:'#F2E000', border:'none', borderRadius:'8px', fontWeight:'500', cursor:'pointer' }}>Ajouter</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
