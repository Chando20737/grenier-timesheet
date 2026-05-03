'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

const navItems = [
  { href:'/dashboard', label:'Minuterie du jour', active:true, icon:<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="13" r="8" stroke="currentColor" strokeWidth="1.5"/><path d="M12 9v4l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
  { href:'/calendrier', label:'Mon calendrier', icon:<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M3 9h18M9 3v6M15 3v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
]

const MOIS_COURT = ['jan','fév','mar','avr','mai','jun','jul','aoû','sep','oct','nov','déc']

function formatTaskDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const today = new Date()
  today.setHours(0,0,0,0)
  const taskDay = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diffDays = Math.round((taskDay.getTime() - today.getTime()) / (1000*60*60*24))

  if (diffDays === 0) return "Aujourd'hui"
  if (diffDays === 1) return "Demain"
  if (diffDays === -1) return "Hier"
  if (diffDays < 0) return `Il y a ${Math.abs(diffDays)}j`
  if (diffDays < 7) return `Dans ${diffDays}j`
  return `${d.getDate()} ${MOIS_COURT[d.getMonth()]}`
}

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [entries, setEntries] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [tasks, setTasks] = useState<any[]>([])
  const [description, setDescription] = useState('')
  const [catId, setCatId] = useState('')
  const [showTaskList, setShowTaskList] = useState(false)
  const [running, setRunning] = useState(false)
  const [paused, setPaused] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [startTime, setStartTime] = useState<string | null>(null)
  const [date, setDate] = useState(new Date())
  const [showManual, setShowManual] = useState(false)
  const [manualDesc, setManualDesc] = useState('')
  const [manualStart, setManualStart] = useState('')
  const [manualEnd, setManualEnd] = useState('')
  const [manualCat, setManualCat] = useState('')
  const [loading, setLoading] = useState(true)
  const [weekTotal, setWeekTotal] = useState(0)
  const [monthTotal, setMonthTotal] = useState(0)
  const interval = useRef<any>(null)
  const taskWrapRef = useRef<HTMLDivElement>(null)

  // Modification d'une entrée existante
  const [editEntry, setEditEntry] = useState<any>(null)
  const [editDesc, setEditDesc] = useState('')
  const [editStart, setEditStart] = useState('')
  const [editEnd, setEditEnd] = useState('')
  const [editCat, setEditCat] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { window.location.href = '/login'; return }
      setUser(data.user)
      setIsAdmin(data.user.email === 'eric@grenier.qc.ca')
      loadCategories(data.user.id)
      loadEntries(data.user.id, new Date())
      loadTasks(data.user.id)
      loadTotals(data.user.id)
      setLoading(false)

      // Restaurer l'état du chrono depuis localStorage
      const saved = localStorage.getItem('grenier-timer')
      if (saved) {
        try {
          const s = JSON.parse(saved)
          if (s.userId === data.user.id) {
            setDescription(s.description || '')
            setCatId(s.catId || '')
            setStartTime(s.startTime || null)
            if (s.running && s.startTime) {
              const now = Date.now()
              const lastTick = s.lastTick || now
              const extra = Math.floor((now - lastTick) / 1000)
              const newElapsed = (s.elapsed || 0) + extra
              setElapsed(newElapsed)
              setRunning(true)
              setPaused(false)
              interval.current = setInterval(() => setElapsed(e => e + 1), 1000)
            } else if (s.paused) {
              setElapsed(s.elapsed || 0)
              setPaused(true)
              setRunning(false)
            }
          }
        } catch {}
      }
    })
  }, [])

  // Sauvegarde l'état du chrono en continu
  useEffect(() => {
    if (!user) return
    if (running || paused) {
      localStorage.setItem('grenier-timer', JSON.stringify({
        userId: user.id,
        description,
        catId,
        startTime,
        elapsed,
        running,
        paused,
        lastTick: Date.now(),
      }))
    } else {
      localStorage.removeItem('grenier-timer')
    }
  }, [user, description, catId, startTime, elapsed, running, paused])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (taskWrapRef.current && !taskWrapRef.current.contains(e.target as Node)) {
        setShowTaskList(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function loadCategories(uid: string) {
    const { data } = await supabase.from('categories').select('*').or(`user_id.eq.${uid},is_global.eq.true`).order('name')
    setCategories(data || [])
    if (data?.length) setCatId(data[0].id)
  }

  async function loadTasks(uid: string) {
    const { data: allTasks } = await supabase.from('tasks')
      .select('*, category:categories(id,name,color)')
      .eq('user_id', uid)
      .eq('is_done', false)
      .order('scheduled_at', { ascending: true, nullsFirst: false })

    if (!allTasks) { setTasks([]); return }

    // Charger les occurrences récurrentes faites aujourd'hui
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`
    const recurringIds = allTasks.filter(t => t.recurrence).map(t => t.id)

    let doneOccurrenceIds = new Set<string>()
    if (recurringIds.length > 0) {
      const { data: occurrences } = await supabase.from('task_occurrences')
        .select('task_id, is_done')
        .in('task_id', recurringIds)
        .eq('occurrence_date', todayStr)
        .eq('is_done', true)
      if (occurrences) {
        doneOccurrenceIds = new Set(occurrences.map((o: any) => o.task_id))
      }
    }

    // Filtrer : exclure les tâches récurrentes dont l'occurrence d'aujourd'hui est faite
    const filtered = allTasks.filter(t => !t.recurrence || !doneOccurrenceIds.has(t.id))
    setTasks(filtered)
  }

  async function loadEntries(uid: string, d: Date) {
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString()
    const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59).toISOString()
    const { data } = await supabase.from('time_entries').select('*, category:categories(name,color)').eq('user_id', uid).gte('started_at', start).lte('started_at', end).order('started_at', { ascending: false })
    setEntries(data || [])
  }

  async function loadTotals(uid: string) {
    const now = new Date()

    // Début de la semaine (lundi)
    const day = now.getDay()
    const diffToMonday = day === 0 ? -6 : 1 - day
    const monday = new Date(now)
    monday.setDate(now.getDate() + diffToMonday)
    monday.setHours(0,0,0,0)

    // Début et fin du mois courant
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth()+1, 1)

    // Total semaine
    const { data: weekData } = await supabase.from('time_entries')
      .select('duration')
      .eq('user_id', uid)
      .gte('started_at', monday.toISOString())
    const wTotal = (weekData || []).reduce((sum: number, e: any) => sum + (e.duration || 0), 0)
    setWeekTotal(wTotal)

    // Total mois
    const { data: monthData } = await supabase.from('time_entries')
      .select('duration')
      .eq('user_id', uid)
      .gte('started_at', monthStart.toISOString())
      .lt('started_at', monthEnd.toISOString())
    const mTotal = (monthData || []).reduce((sum: number, e: any) => sum + (e.duration || 0), 0)
    setMonthTotal(mTotal)
  }

  function selectTask(task: any) {
    setDescription(task.description)
    if (task.category?.id) setCatId(task.category.id)
    setShowTaskList(false)
  }

  function startTimer() {
    if (!startTime) setStartTime(new Date().toISOString())
    setRunning(true)
    setPaused(false)
    interval.current = setInterval(() => setElapsed(e => e + 1), 1000)
  }

  function pauseTimer() {
    clearInterval(interval.current)
    setRunning(false)
    setPaused(true)
  }

  async function stopTimer() {
    clearInterval(interval.current)
    setRunning(false)
    setPaused(false)
    await saveEntry()
  }

  async function saveEntry() {
    if (!user || elapsed < 5) {
      setElapsed(0); setStartTime(null); setDescription('')
      localStorage.removeItem('grenier-timer')
      return
    }
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
    localStorage.removeItem('grenier-timer')
    loadEntries(user.id, date)
    loadTotals(user.id)
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
    loadTotals(user.id)
  }

  function openEditEntry(entry: any) {
    setEditEntry(entry)
    setEditDesc(entry.description || '')
    setEditCat(entry.category_id || '')
    if (entry.started_at) {
      const d = new Date(entry.started_at)
      setEditStart(`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`)
    } else setEditStart('')
    if (entry.ended_at) {
      const d = new Date(entry.ended_at)
      setEditEnd(`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`)
    } else setEditEnd('')
  }

  async function saveEditedEntry() {
    if (!editEntry || !editDesc.trim()) return
    if (!editStart || !editEnd) {
      alert('L\'heure de début et de fin sont requises')
      return
    }
    const baseDate = new Date(editEntry.started_at)
    const dateStr = baseDate.toISOString().split('T')[0]
    const s = new Date(`${dateStr}T${editStart}`)
    const e = new Date(`${dateStr}T${editEnd}`)
    if (e.getTime() <= s.getTime()) {
      alert('L\'heure de fin doit être après l\'heure de début')
      return
    }
    await supabase.from('time_entries').update({
      description: editDesc.trim(),
      category_id: editCat || null,
      started_at: s.toISOString(),
      ended_at: e.toISOString(),
      duration: Math.floor((e.getTime() - s.getTime()) / 1000),
    }).eq('id', editEntry.id)
    setEditEntry(null)
    loadEntries(user.id, date)
    loadTotals(user.id)
  }

  async function deleteEntry(entryId: string) {
    if (!confirm('Supprimer cette entrée ?')) return
    await supabase.from('time_entries').delete().eq('id', entryId)
    loadEntries(user.id, date)
    loadTotals(user.id)
  }

  function shiftDay(d: number) {
    const nd = new Date(date); nd.setDate(date.getDate() + d)
    setDate(nd)
    if (user) loadEntries(user.id, nd)
  }

  const filteredTasks = description.trim()
    ? tasks.filter(t => t.description.toLowerCase().includes(description.toLowerCase()))
    : tasks

  const fmt = (s: number) => `${Math.floor(s/3600)}:${String(Math.floor((s%3600)/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`
  const fmtH = (s: number) => `${Math.floor(s/3600)}h ${String(Math.floor((s%3600)/60)).padStart(2,'0')}`
  const fmtTime = (iso: string) => iso ? new Date(iso).toLocaleTimeString('fr-CA', { hour:'2-digit', minute:'2-digit' }) : '–'
  const totalSec = entries.reduce((sum, e) => sum + (e.duration || 0), 0)
  const initials = user?.email?.split('@')[0].slice(0,2).toUpperCase() || 'ÉG'
  const isToday = date.toDateString() === new Date().toDateString()
  const dayLabel = isToday ? "Aujourd'hui" : date.getDate() + ' ' + date.toLocaleString('fr-CA', { month: 'short' })

  const timerState = running ? 'running' : (paused ? 'paused' : 'idle')

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
          {navItems.map(item => (
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
          <div style={{ background:'white', border:'0.5px solid rgba(0,0,0,0.1)', borderRadius:'12px', padding:'12px 14px', display:'flex', alignItems:'center', gap:'10px', position:'relative' }}>
            <div ref={taskWrapRef} style={{ flex:1, position:'relative' }}>
              <input style={{ width:'100%', border:'none', background:'transparent', fontSize:'14px', outline:'none' }}
                placeholder="Sur quoi travailles-tu ?"
                value={description}
                onChange={e => { setDescription(e.target.value); setShowTaskList(true) }}
                onFocus={() => setShowTaskList(true)} />

              {showTaskList && filteredTasks.length > 0 && (
                <div style={{ position:'absolute', top:'calc(100% + 8px)', left:0, right:0, background:'white', border:'0.5px solid rgba(0,0,0,0.15)', borderRadius:'10px', boxShadow:'0 4px 12px rgba(0,0,0,0.08)', maxHeight:'320px', overflowY:'auto', zIndex:10 }}>
                  <div style={{ fontSize:'10px', fontWeight:'500', color:'#aaa', textTransform:'uppercase', letterSpacing:'0.7px', padding:'8px 12px 4px' }}>Mes tâches à venir</div>
                  {filteredTasks.map(t => {
                    const dateLabel = formatTaskDate(t.scheduled_at)
                    const isOverdue = t.scheduled_at && new Date(t.scheduled_at) < new Date(new Date().setHours(0,0,0,0))
                    return (
                      <div key={t.id} onClick={() => selectTask(t)}
                        style={{ padding:'8px 12px', cursor:'pointer', display:'flex', alignItems:'center', gap:'8px', fontSize:'13px' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background='#f9f9f7'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background='transparent'}>
                        <div style={{ width:'7px', height:'7px', borderRadius:'50%', background: t.category?.color || '#ccc', flexShrink:0 }} />
                        <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.description}</span>
                        {dateLabel && (
                          <span style={{ fontSize:'10px', color: isOverdue ? '#A32D2D' : '#3B6D11', background: isOverdue ? '#FCEBEB' : '#EAF3DE', padding:'2px 6px', borderRadius:'10px', fontWeight:'500', whiteSpace:'nowrap' }}>
                            {dateLabel}
                          </span>
                        )}
                        {t.category?.name && <span style={{ fontSize:'11px', color:'#999', whiteSpace:'nowrap' }}>{t.category.name}</span>}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <select style={{ fontSize:'12px', border:'0.5px solid rgba(0,0,0,0.1)', borderRadius:'20px', padding:'4px 10px', background:'#f9f9f7', color:'#555', outline:'none' }}
              value={catId} onChange={e => setCatId(e.target.value)}>
              <option value="">Catégorie</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <span style={{ fontSize:'18px', fontWeight: timerState === 'paused' ? '400' : '500', minWidth:'74px', textAlign:'right', fontVariantNumeric:'tabular-nums', color: timerState === 'paused' ? '#aaa' : '#111' }}>{fmt(elapsed)}</span>

            {timerState === 'idle' && (
              <button onClick={startTimer} title="Démarrer"
                style={{ width:'34px', height:'34px', borderRadius:'50%', background:'#F2E000', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <svg width="11" height="11" viewBox="0 0 10 12"><polygon points="0,0 10,6 0,12" fill="#111"/></svg>
              </button>
            )}

            {timerState === 'running' && (
              <>
                <button onClick={pauseTimer} title="Pause"
                  style={{ width:'34px', height:'34px', borderRadius:'50%', background:'#F2E000', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <svg width="12" height="12" viewBox="0 0 12 12"><rect x="1" y="0" width="3.5" height="12" fill="#111"/><rect x="7.5" y="0" width="3.5" height="12" fill="#111"/></svg>
                </button>
                <button onClick={stopTimer} title="Arrêter et sauvegarder"
                  style={{ width:'34px', height:'34px', borderRadius:'50%', background:'#E24B4A', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <svg width="11" height="11" viewBox="0 0 12 12"><rect x="0" y="0" width="12" height="12" fill="white"/></svg>
                </button>
              </>
            )}

            {timerState === 'paused' && (
              <>
                <button onClick={startTimer} title="Reprendre"
                  style={{ width:'34px', height:'34px', borderRadius:'50%', background:'#F2E000', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <svg width="11" height="11" viewBox="0 0 10 12"><polygon points="0,0 10,6 0,12" fill="#111"/></svg>
                </button>
                <button onClick={stopTimer} title="Arrêter et sauvegarder"
                  style={{ width:'34px', height:'34px', borderRadius:'50%', background:'#E24B4A', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <svg width="11" height="11" viewBox="0 0 12 12"><rect x="0" y="0" width="12" height="12" fill="white"/></svg>
                </button>
              </>
            )}
          </div>

          {timerState === 'paused' && (
            <div style={{ fontSize:'11px', color:'#888', marginTop:'-6px', paddingLeft:'14px' }}>
              ⏸ Chrono en pause — cliquez sur ▶ pour reprendre ou ⏹ pour sauvegarder
            </div>
          )}

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
                <div style={{ display:'flex', gap:'4px' }}>
                  <div onClick={() => openEditEntry(e)} title="Modifier"
                    style={{ width:'24px', height:'24px', borderRadius:'50%', background:'#f5f4f0', border:'0.5px solid rgba(0,0,0,0.1)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}
                    onMouseEnter={ev => (ev.currentTarget as HTMLElement).style.background='#FEFDE6'}
                    onMouseLeave={ev => (ev.currentTarget as HTMLElement).style.background='#f5f4f0'}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="#555" strokeWidth="1.5" strokeLinecap="round"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="#555" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  </div>
                  <div onClick={() => deleteEntry(e.id)} title="Supprimer"
                    style={{ width:'24px', height:'24px', borderRadius:'50%', background:'#f5f4f0', border:'0.5px solid rgba(0,0,0,0.1)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}
                    onMouseEnter={ev => (ev.currentTarget as HTMLElement).style.background='#FCEBEB'}
                    onMouseLeave={ev => (ev.currentTarget as HTMLElement).style.background='#f5f4f0'}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M6 18L18 6" stroke="#A32D2D" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  </div>
                </div>
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
              { label:'Cette semaine', val: fmtH(weekTotal), sub:'lun – dim' },
              { label:'Ce mois', val: fmtH(monthTotal), sub: new Date().toLocaleString('fr-CA',{month:'long',year:'numeric'}) },
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

      {/* Popup d'édition d'une entrée */}
      {editEntry && (
        <div onClick={() => setEditEntry(null)}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background:'white', borderRadius:'12px', padding:'1.25rem', width:'440px', maxWidth:'90vw', boxShadow:'0 20px 60px rgba(0,0,0,0.3)' }}>
            <h3 style={{ fontSize:'14px', fontWeight:'500', marginBottom:'14px' }}>Modifier l'entrée</h3>

            <div style={{ marginBottom:'10px' }}>
              <label style={{ display:'block', fontSize:'11px', color:'#777', marginBottom:'4px' }}>Description</label>
              <input autoFocus value={editDesc} onChange={e => setEditDesc(e.target.value)}
                style={{ width:'100%', padding:'8px 10px', fontSize:'13px', border:'0.5px solid rgba(0,0,0,0.15)', borderRadius:'6px', outline:'none' }} />
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'8px', marginBottom:'14px' }}>
              <div>
                <label style={{ display:'block', fontSize:'11px', color:'#777', marginBottom:'4px' }}>Début</label>
                <input type="time" value={editStart} onChange={e => setEditStart(e.target.value)}
                  style={{ width:'100%', padding:'7px 8px', fontSize:'13px', border:'0.5px solid rgba(0,0,0,0.15)', borderRadius:'6px', outline:'none' }} />
              </div>
              <div>
                <label style={{ display:'block', fontSize:'11px', color:'#777', marginBottom:'4px' }}>Fin</label>
                <input type="time" value={editEnd} onChange={e => setEditEnd(e.target.value)}
                  style={{ width:'100%', padding:'7px 8px', fontSize:'13px', border:'0.5px solid rgba(0,0,0,0.15)', borderRadius:'6px', outline:'none' }} />
              </div>
              <div>
                <label style={{ display:'block', fontSize:'11px', color:'#777', marginBottom:'4px' }}>Catégorie</label>
                <select value={editCat} onChange={e => setEditCat(e.target.value)}
                  style={{ width:'100%', padding:'7px 8px', fontSize:'13px', border:'0.5px solid rgba(0,0,0,0.15)', borderRadius:'6px', outline:'none', background:'white' }}>
                  <option value="">–</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end' }}>
              <button onClick={() => setEditEntry(null)}
                style={{ padding:'7px 14px', fontSize:'13px', border:'0.5px solid rgba(0,0,0,0.15)', borderRadius:'8px', background:'white', cursor:'pointer' }}>
                Annuler
              </button>
              <button onClick={saveEditedEntry}
                style={{ padding:'7px 16px', fontSize:'13px', background:'#F2E000', border:'none', borderRadius:'8px', fontWeight:'500', cursor:'pointer' }}>
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
