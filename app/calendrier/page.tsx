'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

const JOURS = ['Lun','Mar','Mer','Jeu','Ven']
const MOIS = ['jan','fév','mar','avr','mai','jun','jul','aoû','sep','oct','nov','déc']
const HOURS = Array.from({length:11}, (_,i) => i+8)
const PPH = 60, PPM = PPH/60

const navItems = [
  { href:'/dashboard', label:'Minuterie du jour', icon:<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="13" r="8" stroke="currentColor" strokeWidth="1.5"/><path d="M12 9v4l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
  { href:'/calendrier', label:'Mon calendrier', active:true, icon:<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M3 9h18M9 3v6M15 3v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
  { href:'/taches', label:'Mes tâches', icon:<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M8 9h8M8 13h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
  { href:'/gmail', label:'Mes messages', icon:<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M20 4H4C2.9 4 2 4.9 2 6v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2z" stroke="currentColor" strokeWidth="1.5"/><path d="M2 6l10 7 10-7" stroke="currentColor" strokeWidth="1.5"/></svg> },
  { href:'/rapport', label:'Rapport équipe', adminOnly:true, icon:<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M4 20V8l8-5 8 5v12H4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M9 20v-6h6v6" stroke="currentColor" strokeWidth="1.5"/></svg> },
  { href:'/employes', label:'Employés', adminOnly:true, icon:<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="9" cy="7" r="3" stroke="currentColor" strokeWidth="1.5"/><path d="M3 17c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
]

function snap5(m: number) { return Math.round(m/5)*5 }
function minToStr(m: number) { return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0') }

export default function CalendrierPage() {
  const [user, setUser] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [weekOffset, setWeekOffset] = useState(0)
  const [selectedDay, setSelectedDay] = useState(() => {
    const d = new Date().getDay()
    return d === 0 ? 0 : d === 6 ? 4 : d - 1
  })
  const [unplanned, setUnplanned] = useState<any[]>([])
  const [placed, setPlaced] = useState<any[]>([])
  const [tooltip, setTooltip] = useState<{x:number,y:number,text:string}|null>(null)
  const areaRef = useRef<HTMLDivElement>(null)
  const dragTask = useRef<any>(null)
  const dragCalIdx = useRef<number|null>(null)
  const dragCalOffset = useRef(0)
  const resizing = useRef<{idx:number,startY:number,origDur:number}|null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { window.location.href='/login'; return }
      setUser(data.user)
      setIsAdmin(data.user.email === 'eric@grenier.qc.ca')
      setLoading(false)
      loadTasks(data.user.id)
    })
  }, [])

  useEffect(() => { if (user) loadTasks(user.id) }, [user, weekOffset, selectedDay])

  async function loadTasks(uid: string) {
    const { data } = await supabase.from('tasks')
      .select('*, category:categories(name,color)')
      .eq('user_id', uid)
      .eq('is_done', false)
      .order('created_at', { ascending: false })
    if (!data) return
    const monday = getMonday()
    const d = new Date(monday); d.setDate(monday.getDate() + selectedDay)
    const dateStr = d.toISOString().split('T')[0]
    const withSchedule = data.filter((t: any) => t.scheduled_at && t.scheduled_at.startsWith(dateStr))
    const withoutSchedule = data.filter((t: any) => !t.scheduled_at || !t.scheduled_at.startsWith(dateStr))
    setPlaced(withSchedule.map((t: any) => ({
      id: t.id,
      title: t.description,
      timeMin: new Date(t.scheduled_at).getHours()*60 + new Date(t.scheduled_at).getMinutes(),
      dur: parseInt(t.estimated_duration || '60'),
      color: t.category?.color || '#3B6D11',
      type: t.source === 'calendar' ? 'agenda' : 'manual',
      raw: t
    })))
    setUnplanned(withoutSchedule)
  }

  function getMonday() {
    const now = new Date()
    const day = now.getDay()
    const d = new Date(now)
    d.setDate(now.getDate() - day + (day===0?-6:1) + weekOffset*7)
    d.setHours(0,0,0,0)
    return d
  }

  function getDateForDay(i: number) {
    const m = getMonday(); const d = new Date(m)
    d.setDate(m.getDate()+i); return d
  }

  async function saveScheduled(taskId: string, timeMin: number, dur: number) {
    const d = getDateForDay(selectedDay)
    const h = Math.floor(timeMin/60), m = timeMin%60
    const scheduledAt = new Date(d)
    scheduledAt.setHours(h,m,0,0)
    await supabase.from('tasks').update({
      scheduled_at: scheduledAt.toISOString(),
      estimated_duration: dur+' min'
    }).eq('id', taskId)
  }

  async function removeFromCalendar(taskId: string) {
    await supabase.from('tasks').update({ scheduled_at: null }).eq('id', taskId)
    loadTasks(user.id)
  }

  function getMinFromY(y: number, offsetY = 0) {
    return Math.max(8*60, Math.min(17*60+55, snap5(8*60 + (y - offsetY) / PPM)))
  }

  function onTaskDragStart(e: React.DragEvent, task: any) {
    dragTask.current = task
    dragCalIdx.current = null
    e.dataTransfer.effectAllowed = 'move'
  }

  function onCalDragStart(e: React.DragEvent, idx: number) {
    dragCalIdx.current = idx
    dragCalOffset.current = e.nativeEvent.offsetY
    dragTask.current = null
    e.dataTransfer.effectAllowed = 'move'
  }

  function onAreaDragOver(e: React.DragEvent) {
    e.preventDefault()
    const rect = areaRef.current!.getBoundingClientRect()
    const y = e.clientY - rect.top
    const dur = dragTask.current?.dur || placed[dragCalIdx.current!]?.dur || 60
    const offsetY = dragCalIdx.current !== null ? dragCalOffset.current : 0
    const min = getMinFromY(y, offsetY)
    setTooltip({ x: e.clientX+12, y: e.clientY-10, text: minToStr(min)+' – '+minToStr(min+dur) })
    const ghost = document.getElementById('cal-ghost')
    if (ghost) { ghost.style.top=(min-8*60)*PPM+'px'; ghost.style.height=dur*PPM+'px'; ghost.style.display='block' }
  }

  function onAreaDragLeave(e: React.DragEvent) {
    if (!e.relatedTarget || !areaRef.current?.contains(e.relatedTarget as Node)) {
      setTooltip(null)
      const ghost = document.getElementById('cal-ghost')
      if (ghost) ghost.style.display='none'
    }
  }

  async function onAreaDrop(e: React.DragEvent) {
    e.preventDefault()
    setTooltip(null)
    const ghost = document.getElementById('cal-ghost')
    if (ghost) ghost.style.display='none'
    const rect = areaRef.current!.getBoundingClientRect()
    const y = e.clientY - rect.top
    const offsetY = dragCalIdx.current !== null ? dragCalOffset.current : 0
    const min = getMinFromY(y, offsetY)
    if (dragTask.current) {
      const task = dragTask.current
      const dur = parseInt(task.estimated_duration || '60')
      await saveScheduled(task.id, min, dur)
      dragTask.current = null
      loadTasks(user.id)
    } else if (dragCalIdx.current !== null) {
      const t = placed[dragCalIdx.current]
      if (t) { await saveScheduled(t.id, min, t.dur); dragCalIdx.current = null; loadTasks(user.id) }
    }
  }

  function startResize(e: React.MouseEvent, idx: number) {
    e.stopPropagation(); e.preventDefault()
    resizing.current = { idx, startY: e.clientY, origDur: placed[idx].dur }
    const onMove = (ev: MouseEvent) => {
      if (!resizing.current) return
      const dy = ev.clientY - resizing.current.startY
      const newDur = Math.max(15, snap5(resizing.current.origDur + dy/PPM))
      setPlaced(prev => prev.map((t,i) => i===resizing.current!.idx ? {...t, dur:newDur} : t))
      setTooltip({ x: ev.clientX+12, y: ev.clientY-10, text: 'Durée : '+newDur+' min' })
    }
    const onUp = async () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      setTooltip(null)
      if (resizing.current) {
        const t = placed[resizing.current.idx]
        if (t) await saveScheduled(t.id, t.timeMin, t.dur)
        resizing.current = null
        loadTasks(user.id)
      }
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const monday = getMonday()
  const friday = new Date(monday); friday.setDate(monday.getDate()+4)
  const todayStr = new Date().toISOString().split('T')[0]
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
        <div style={{ background:'#111', padding:'10px 1rem', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <h1 style={{ fontSize:'15px', fontWeight:'500', color:'#F2E000' }}>Mon calendrier</h1>
        </div>

        {/* Day tabs */}
        <div style={{ background:'#1a1a1a', borderBottom:'0.5px solid rgba(255,255,255,0.08)', display:'flex', alignItems:'center', padding:'0 8px', gap:'8px', flexShrink:0 }}>
          <button onClick={() => setWeekOffset(w => w-1)}
            style={{ background:'#F2E000', border:'none', borderRadius:'6px', width:'28px', height:'28px', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="#111" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <div style={{ display:'flex', flex:1 }}>
            {JOURS.map((j,i) => {
              const d = getDateForDay(i)
              const ds = d.toISOString().split('T')[0]
              const isToday = ds === todayStr
              const isActive = i === selectedDay
              return (
                <div key={i} onClick={() => setSelectedDay(i)}
                  style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', padding:'8px 4px', borderRadius:'8px', cursor:'pointer', background: isActive ? 'rgba(242,224,0,0.1)' : 'transparent' }}>
                  <span style={{ fontSize:'10px', color: isActive ? '#F2E000' : 'rgba(255,255,255,0.45)', textTransform:'uppercase', letterSpacing:'0.5px' }}>{j}</span>
                  <span style={{ fontSize:'16px', fontWeight:'500', marginTop:'2px', color: isActive ? '#F2E000' : 'rgba(255,255,255,0.8)',
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
          {[{color:'#3B6D11',label:'Tâche'},{color:'#185FA5',label:'Google Agenda'}].map(l => (
            <div key={l.label} style={{ display:'flex', alignItems:'center', gap:'5px', fontSize:'11px', color:'#777' }}>
              <div style={{ width:'8px', height:'8px', borderRadius:'2px', background:l.color }} />{l.label}
            </div>
          ))}
        </div>

        {/* Colonnes */}
        <div style={{ display:'flex', flex:1, overflow:'hidden' }}>
          {/* Calendrier */}
          <div style={{ flex:1, display:'flex', flexDirection:'column', borderRight:'0.5px solid rgba(0,0,0,0.1)', background:'white', overflowY:'auto' }}>
            <div style={{ display:'flex' }}>
              <div style={{ width:'48px', flexShrink:0, borderRight:'0.5px solid rgba(0,0,0,0.08)' }}>
                <div style={{ height:'8px' }} />
                {HOURS.map(h => (
                  <div key={h} style={{ height:'60px', borderBottom:'0.5px solid rgba(0,0,0,0.05)', display:'flex', alignItems:'flex-start', justifyContent:'flex-end', padding:'3px 6px 0 0', fontSize:'11px', color:'#bbb' }}>
                    {h}:00
                  </div>
                ))}
              </div>

              <div ref={areaRef}
                style={{ flex:1, position:'relative', height: HOURS.length*PPH+'px' }}
                onDragOver={onAreaDragOver}
                onDragLeave={onAreaDragLeave}
                onDrop={onAreaDrop}>
                {HOURS.map((h,i) => (
                  <div key={h}>
                    <div style={{ position:'absolute', left:0, right:0, top:i*PPH, borderBottom:'0.5px solid rgba(0,0,0,0.06)' }} />
                    <div style={{ position:'absolute', left:0, right:0, top:i*PPH+30, borderBottom:'0.5px dashed rgba(0,0,0,0.04)' }} />
                  </div>
                ))}
                <div id="cal-ghost" style={{ display:'none', position:'absolute', left:'4px', right:'4px', background:'rgba(242,224,0,0.25)', border:'1.5px dashed #D4B800', borderRadius:'5px', pointerEvents:'none', zIndex:3 }} />

                {placed.map((t, idx) => {
                  const top = (t.timeMin - 8*60) * PPM
                  const height = Math.max(t.dur * PPM, 36)
                  const colors = t.type === 'agenda'
                    ? { bg:'#E6F1FB', text:'#0C447C', border:'#185FA5' }
                    : { bg:'#EAF3DE', text:'#27500A', border: t.color || '#3B6D11' }
                  return (
                    <div key={t.id || idx} draggable
                      onDragStart={e => onCalDragStart(e, idx)}
                      style={{ position:'absolute', left:'4px', right:'4px', top:`${top}px`, height:`${height}px`, borderRadius:'5px', padding:'3px 24px 14px 6px', overflow:'hidden', zIndex:2, cursor:'grab', background:colors.bg, color:colors.text, borderLeft:`3px solid ${colors.border}` }}>
                      <div style={{ fontSize:'11px', fontWeight:'500', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{t.title}</div>
                      <div style={{ fontSize:'10px', opacity:0.7, marginTop:'1px' }}>{minToStr(t.timeMin)} – {minToStr(t.timeMin+t.dur)}</div>
                      {/* Bouton retirer */}
                      <div onClick={e => { e.stopPropagation(); removeFromCalendar(t.id) }}
                        style={{ position:'absolute', top:'3px', right:'4px', width:'16px', height:'16px', borderRadius:'50%', background:'rgba(0,0,0,0.12)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:'12px', lineHeight:1, color:colors.text, opacity:0.6 }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity='1'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity='0.6'}>
                        ×
                      </div>
                      {/* Resize handle */}
                      <div onMouseDown={e => startResize(e, idx)}
                        style={{ position:'absolute', bottom:0, left:0, right:0, height:'10px', cursor:'ns-resize', display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <div style={{ width:'24px', height:'3px', borderRadius:'2px', background:'currentColor', opacity:0.35 }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Tâches à planifier — colonne élargie */}
          <div style={{ width:'380px', flexShrink:0, background:'#f9f9f7', display:'flex', flexDirection:'column', overflowY:'auto' }}>
            <div style={{ padding:'10px 12px', borderBottom:'0.5px solid rgba(0,0,0,0.08)', fontSize:'10px', fontWeight:'500', color:'#777', textTransform:'uppercase', letterSpacing:'0.5px', background:'white' }}>
              Tâches à planifier
            </div>
            <div style={{ padding:'8px', display:'flex', flexDirection:'column', gap:'6px' }}>
              {unplanned.length === 0 && (
                <div style={{ textAlign:'center', fontSize:'11px', color:'#aaa', padding:'1.5rem' }}>Toutes les tâches sont planifiées !</div>
              )}
              {unplanned.map((t: any) => (
                <div key={t.id} draggable onDragStart={e => onTaskDragStart(e, t)}
                  style={{ background:'white', border:'0.5px solid rgba(0,0,0,0.1)', borderLeft:`3px solid ${t.category?.color || '#3B6D11'}`, borderRadius:'8px', padding:'9px 12px', cursor:'grab', userSelect:'none' }}>
                  <div style={{ fontSize:'12px', fontWeight:'500', color:'#111' }}>{t.description}</div>
                  <div style={{ fontSize:'11px', color:'#aaa', marginTop:'3px', display:'flex', gap:'8px' }}>
                    <span>{t.category?.name || '–'}</span>
                    {t.estimated_duration && <span>⏱ {t.estimated_duration}</span>}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ fontSize:'11px', color:'#ccc', textAlign:'center', padding:'8px' }}>← Glissez une tâche vers le calendrier</div>
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div style={{ position:'fixed', left:tooltip.x, top:tooltip.y, background:'#111', color:'#F2E000', fontSize:'11px', padding:'3px 7px', borderRadius:'4px', pointerEvents:'none', zIndex:100 }}>
          {tooltip.text}
        </div>
      )}
    </div>
  )
}
