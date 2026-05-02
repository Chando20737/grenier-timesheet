'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

const JOURS_LONG = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi']
const MOIS = ['jan','fév','mar','avr','mai','jun','jul','aoû','sep','oct','nov','déc']
const HOURS = Array.from({length:14}, (_,i) => i+6)
const PPH = 60, PPM = PPH/60

const RECURRENCES = [
  { value: '', label: 'Aucune' },
  { value: 'daily', label: 'Tous les jours' },
  { value: 'weekdays', label: 'Du lundi au vendredi' },
  { value: 'weekly', label: 'Toutes les semaines' },
  { value: 'biweekly', label: 'Toutes les 2 semaines' },
  { value: 'monthly', label: 'Tous les mois' },
]

const navItems = [
  { href:'/dashboard', label:'Minuterie du jour', icon:<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="13" r="8" stroke="currentColor" strokeWidth="1.5"/><path d="M12 9v4l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
  { href:'/calendrier', label:'Mon calendrier', active:true, icon:<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M3 9h18M9 3v6M15 3v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
  { href:'/taches', label:'Mes tâches', icon:<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M8 9h8M8 13h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
]

function snap5(m: number) { return Math.round(m/5)*5 }
function minToStr(m: number) { return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0') }
function parseDuration(s: string | null): number {
  if (!s) return 60
  const hm = s.match(/(\d+)h\s*(\d+)?/)
  if (hm) return parseInt(hm[1])*60 + parseInt(hm[2]||'0')
  const mins = s.match(/(\d+)/)
  if (mins) return parseInt(mins[1])
  return 60
}
function formatFrom(from: string) {
  const m = from.match(/^"?([^"<]+)"?\s*<.*>$/)
  return m ? m[1].trim() : from
}
function ymd(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth()+1).padStart(2,'0')
  const dd = String(d.getDate()).padStart(2,'0')
  return `${yyyy}-${mm}-${dd}`
}

// Vérifie si une tâche récurrente doit apparaître à une date donnée
function recurrenceMatches(recurrence: string, baseDate: Date, targetDate: Date): boolean {
  // On normalise aux dates seules (minuit local) pour éviter les problèmes de fuseaux horaires
  const base = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate())
  const target = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate())
  if (target < base) return false
  const diffDays = Math.round((target.getTime() - base.getTime()) / (1000*60*60*24))
  switch (recurrence) {
    case 'daily': return true
    case 'weekdays': {
      const day = target.getDay()
      return day >= 1 && day <= 5
    }
    case 'weekly': return target.getDay() === base.getDay()
    case 'biweekly': return target.getDay() === base.getDay() && diffDays % 14 === 0
    case 'monthly': return target.getDate() === base.getDate()
    default: return false
  }
}

export default function CalendrierPage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [weekOffset, setWeekOffset] = useState(0)
  const [unplanned, setUnplanned] = useState<any[]>([])
  const [googleConnected, setGoogleConnected] = useState(false)
  const [weekTasks, setWeekTasks] = useState<any[][]>([[],[],[],[],[]])
  const [weekGoogle, setWeekGoogle] = useState<any[][]>([[],[],[],[],[]])
  const [categories, setCategories] = useState<any[]>([])
  const [tooltip, setTooltip] = useState<{x:number,y:number,text:string}|null>(null)

  const [sidePanel, setSidePanel] = useState<'tasks' | 'gmail'>('tasks')
  const [gmailMessages, setGmailMessages] = useState<any[]>([])
  const [gmailLoading, setGmailLoading] = useState(false)

  const [showAddForm, setShowAddForm] = useState<number | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [newTime, setNewTime] = useState('09:00')
  const [newDur, setNewDur] = useState('60')
  const [newCat, setNewCat] = useState('')

  const [dropEmailModal, setDropEmailModal] = useState<{ message: any, dayIdx: number } | null>(null)
  const [emailForm, setEmailForm] = useState({ title: '', time: '09:00', dur: '30', cat: '', includeLink: true })

  // Édition d'une tâche
  const [editTask, setEditTask] = useState<any>(null)
  const [editForm, setEditForm] = useState({
    title: '', cat: '', dur: '60', date: '', time: '', recurrence: '',
  })

  const dragCalOffset = useRef(0)
  const dragWeekTask = useRef<any>(null)
  const dragWeekFromDay = useRef<number|null>(null)
  const dragEmail = useRef<any>(null)
  const [dragOverDay, setDragOverDay] = useState<number|null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { window.location.href='/login'; return }
      setUser(data.user)
      setLoading(false)
      checkGoogleConnection(data.user.id)
      loadCategories(data.user.id)
    })
    const params = new URLSearchParams(window.location.search)
    if (params.get('google') === 'connected') {
      window.history.replaceState({}, '', '/calendrier')
    }
  }, [])

  useEffect(() => {
    if (!user) return
    loadWeek(user.id)
  }, [user, weekOffset])

  useEffect(() => {
    if (sidePanel === 'gmail' && user && !gmailLoading) {
      loadGmail(user.id)
    }
  }, [sidePanel, user])

  async function checkGoogleConnection(uid: string) {
    const { data } = await supabase.from('users').select('google_access_token').eq('id', uid).single()
    setGoogleConnected(!!data?.google_access_token)
  }

  async function loadCategories(uid: string) {
    const { data } = await supabase.from('categories').select('*')
      .or(`user_id.eq.${uid},is_global.eq.true`).order('name')
    setCategories(data || [])
  }

  async function loadGmail(uid: string) {
  setGmailLoading(true)
  try {
    const res = await fetch(`/api/gmail/list?userId=${uid}&t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    })
    if (res.status === 401) { setGmailMessages([]); return }
    const data = await res.json()
    setGmailMessages(data.messages || [])
  } catch {
    setGmailMessages([])
  } finally {
    setGmailLoading(false)
  }
}

  async function loadWeek(uid: string) {
    const monday = getMonday()
    const dates = Array.from({length:5}, (_, i) => {
      const d = new Date(monday); d.setDate(monday.getDate()+i)
      return d
    })
    const dateStrs = dates.map(d => ymd(d))

    const { data: allTasks } = await supabase.from('tasks')
      .select('*, category:categories(name,color)')
      .eq('user_id', uid)
      .eq('is_done', false)
      .order('scheduled_at', { ascending: true })

    // Charger les "occurrences" terminées/ignorées pour la semaine
    const { data: occurrences } = await supabase.from('task_occurrences')
      .select('*')
      .in('occurrence_date', dateStrs)

    const occMap = new Map<string, any>()
    ;(occurrences || []).forEach((o: any) => {
      occMap.set(`${o.task_id}_${o.occurrence_date}`, o)
    })

    const tasksByDay: any[][] = [[],[],[],[],[]]
    const stillUnplanned: any[] = []

    ;(allTasks || []).forEach((t: any) => {
      if (!t.scheduled_at) {
        // Sans planification ET sans récurrence → tâches à planifier
        if (!t.recurrence) stillUnplanned.push(t)
        return
      }

      const baseDt = new Date(t.scheduled_at)

      // Tâche récurrente : générer les occurrences pour chaque jour de la semaine
      if (t.recurrence) {
        dates.forEach((targetDate, dayIdx) => {
          if (!recurrenceMatches(t.recurrence, baseDt, targetDate)) return

          const dateStr = dateStrs[dayIdx]
          const occKey = `${t.id}_${dateStr}`
          const occ = occMap.get(occKey)
          if (occ?.is_skipped || occ?.is_done) return

          tasksByDay[dayIdx].push({
            id: t.id,
            occurrenceDate: dateStr,
            isRecurring: true,
            title: t.description,
            timeMin: baseDt.getHours()*60 + baseDt.getMinutes(),
            dur: parseDuration(t.estimated_duration),
            color: t.category?.color || '#3B6D11',
            category: t.category?.name,
            scheduled_at: t.scheduled_at,
            gmail_message_id: t.gmail_message_id,
            recurrence: t.recurrence,
          })
        })
        return
      }

      // Tâche non récurrente : afficher uniquement à sa date
      const dayIdx = dateStrs.findIndex(ds => t.scheduled_at.startsWith(ds))
      if (dayIdx >= 0) {
        tasksByDay[dayIdx].push({
          id: t.id,
          isRecurring: false,
          title: t.description,
          timeMin: baseDt.getHours()*60 + baseDt.getMinutes(),
          dur: parseDuration(t.estimated_duration),
          color: t.category?.color || '#3B6D11',
          category: t.category?.name,
          scheduled_at: t.scheduled_at,
          gmail_message_id: t.gmail_message_id,
        })
      } else {
        stillUnplanned.push(t)
      }
    })

    setWeekTasks(tasksByDay)
    setUnplanned(stillUnplanned)

    try {
      const results = await Promise.all(
        dateStrs.map(ds =>
          fetch(`/api/calendar/sync?userId=${uid}&date=${ds}`)
            .then(r => r.status === 401 ? { events: [] } : r.json())
            .catch(() => ({ events: [] }))
        )
      )
      const googleByDay: any[][] = results.map((data: any) =>
        (data.events || []).filter((e: any) => !e.allDay).map((e: any) => {
          const start = new Date(e.start)
          const end = new Date(e.end)
          const timeMin = start.getHours()*60 + start.getMinutes()
          const dur = Math.round((end.getTime() - start.getTime()) / 60000)
          return { id: e.id, title: e.title, timeMin, dur, type: 'agenda' }
        })
      )
      setWeekGoogle(googleByDay)
    } catch {
      setWeekGoogle([[],[],[],[],[]])
    }
  }

  function connectGoogle() {
    if (!user) return
    const params = new URLSearchParams({
      client_id: '785771322332-ipiob24dposv8i0lhkegfhpo4sc4fua4.apps.googleusercontent.com',
      redirect_uri: `${window.location.origin}/api/auth/callback/google`,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/gmail.readonly',
      access_type: 'offline',
      prompt: 'consent',
      state: user.id,
    })
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`
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

  async function saveScheduled(taskId: string, timeMin: number, dur: number, dayIdx: number) {
    const d = getDateForDay(dayIdx)
    const h = Math.floor(timeMin/60), m = timeMin%60
    const scheduledAt = new Date(d)
    scheduledAt.setHours(h,m,0,0)
    await supabase.from('tasks').update({
      scheduled_at: scheduledAt.toISOString(),
      estimated_duration: dur+' min'
    }).eq('id', taskId)
  }

  async function removeFromCalendar(t: any) {
    // Si récurrente : on marque cette occurrence seulement comme "skipped"
    if (t.isRecurring && t.occurrenceDate) {
      await supabase.from('task_occurrences').upsert({
        task_id: t.id,
        occurrence_date: t.occurrenceDate,
        is_skipped: true,
      }, { onConflict: 'task_id,occurrence_date' })
    } else {
      await supabase.from('tasks').update({ scheduled_at: null }).eq('id', t.id)
    }
    loadWeek(user.id)
  }

  async function createTaskInDay(dayIdx: number) {
    if (!newTitle.trim() || !user) return
    const [hh, mm] = newTime.split(':').map(Number)
    if (isNaN(hh) || isNaN(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) {
      alert('Heure invalide. Format attendu : HH:MM (00:00 à 23:59)')
      return
    }
    const d = getDateForDay(dayIdx)
    d.setHours(hh, mm, 0, 0)
    await supabase.from('tasks').insert({
      user_id: user.id,
      description: newTitle.trim(),
      scheduled_at: d.toISOString(),
      estimated_duration: newDur + ' min',
      category_id: newCat || null,
      source: 'manual',
    })
    setShowAddForm(null)
    setNewTitle(''); setNewTime('09:00'); setNewDur('60'); setNewCat('')
    loadWeek(user.id)
  }

  async function createTaskFromEmail() {
    if (!user || !dropEmailModal || !emailForm.title.trim()) return
    const [hh, mm] = emailForm.time.split(':').map(Number)
    if (isNaN(hh) || isNaN(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) {
      alert('Heure invalide. Format attendu : HH:MM (00:00 à 23:59)')
      return
    }
    const { message, dayIdx } = dropEmailModal
    let description = emailForm.title.trim()
    if (emailForm.includeLink) {
      const link = `https://mail.google.com/mail/u/0/#inbox/${message.id}`
      description = `${description}\n\n📧 ${link}`
    }
    const d = getDateForDay(dayIdx)
    d.setHours(hh, mm, 0, 0)
    await supabase.from('tasks').insert({
      user_id: user.id,
      description,
      scheduled_at: d.toISOString(),
      estimated_duration: emailForm.dur + ' min',
      category_id: emailForm.cat || null,
      source: 'gmail',
      gmail_message_id: message.id,
    })
    setDropEmailModal(null)
    loadWeek(user.id)
  }

  async function openEditTask(taskId: string) {
    // On va chercher la tâche complète en DB (pour avoir tous les champs)
    const { data: t } = await supabase.from('tasks')
      .select('*, category:categories(id,name,color)')
      .eq('id', taskId).single()
    if (!t) return

    let dateStr = '', timeStr = ''
    if (t.scheduled_at) {
      const d = new Date(t.scheduled_at)
      dateStr = ymd(d)
      timeStr = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
    }

    setEditTask(t)
    setEditForm({
      title: t.description || '',
      cat: t.category_id || '',
      dur: String(parseDuration(t.estimated_duration)),
      date: dateStr,
      time: timeStr,
      recurrence: t.recurrence || '',
    })
  }

  async function saveEditedTask() {
    if (!editTask || !editForm.title.trim()) return

    let scheduledAt: string | null = null
    if (editForm.date) {
      const time = editForm.time || '09:00'
      const [hh, mm] = time.split(':').map(Number)
      if (isNaN(hh) || isNaN(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) {
        alert('Heure invalide. Format attendu : HH:MM (00:00 à 23:59)')
        return
      }
      const [yyyy, mo, dd] = editForm.date.split('-').map(Number)
      const d = new Date(yyyy, mo - 1, dd, hh, mm, 0, 0)
      scheduledAt = d.toISOString()
    }

    // Si on change la récurrence, on nettoie les anciennes occurrences "skipped"
    if (editForm.recurrence !== editTask.recurrence) {
      await supabase.from('task_occurrences').delete().eq('task_id', editTask.id)
    }

    await supabase.from('tasks').update({
      description: editForm.title.trim(),
      category_id: editForm.cat || null,
      estimated_duration: editForm.dur + ' min',
      scheduled_at: scheduledAt,
      recurrence: editForm.recurrence || null,
    }).eq('id', editTask.id)

    setEditTask(null)
    loadWeek(user.id)
  }

  async function deleteTask(taskId: string) {
    if (!confirm('Supprimer définitivement cette tâche ?')) return
    await supabase.from('tasks').delete().eq('id', taskId)
    setEditTask(null)
    loadWeek(user.id)
  }

  function getMinFromY(y: number, offsetY = 0) {
  return Math.max(6*60, Math.min(19*60+55, snap5(6*60 + (y - offsetY) / PPM)))
}

  function onWeekTaskDragStart(e: React.DragEvent, task: any, fromDay: number) {
    dragWeekTask.current = task
    dragWeekFromDay.current = fromDay
    dragCalOffset.current = e.nativeEvent.offsetY
    dragEmail.current = null
    e.dataTransfer.effectAllowed = 'move'
  }

  function onWeekUnplannedDragStart(e: React.DragEvent, task: any) {
    dragWeekTask.current = {
      id: task.id,
      title: task.description,
      dur: parseDuration(task.estimated_duration),
      timeMin: 9*60,
      isUnplanned: true,
    }
    dragWeekFromDay.current = null
    dragCalOffset.current = 0
    dragEmail.current = null
    e.dataTransfer.effectAllowed = 'move'
  }

  function onEmailDragStart(e: React.DragEvent, message: any) {
    dragEmail.current = message
    dragWeekTask.current = null
    dragWeekFromDay.current = null
    e.dataTransfer.effectAllowed = 'copy'
  }

  function onColDragOver(e: React.DragEvent, dayIdx: number) {
    e.preventDefault()
    setDragOverDay(dayIdx)

    if (dragEmail.current) return

    const t = dragWeekTask.current
    if (!t) return

    const colEl = e.currentTarget as HTMLElement
    const rect = colEl.getBoundingClientRect()
    const y = e.clientY - rect.top
    const dur = t.dur || 60
    const offsetY = dragWeekFromDay.current !== null ? dragCalOffset.current : 0
    const min = getMinFromY(y, offsetY)

    setTooltip({ x: e.clientX+12, y: e.clientY-10, text: minToStr(min)+' – '+minToStr(min+dur) })

    const ghost = document.getElementById(`week-ghost-${dayIdx}`)
    if (ghost) {
      ghost.style.top = (min - 6*60) * PPM + 'px'
      ghost.style.height = Math.max(dur * PPM, 10) + 'px'
      ghost.style.display = 'block'
    }
  }

  function onColDragLeave(e: React.DragEvent, dayIdx: number) {
    const colEl = e.currentTarget as HTMLElement
    if (e.relatedTarget && colEl.contains(e.relatedTarget as Node)) return
    setDragOverDay(null)
    setTooltip(null)
    const ghost = document.getElementById(`week-ghost-${dayIdx}`)
    if (ghost) ghost.style.display = 'none'
  }

  async function onColDrop(e: React.DragEvent, dayIdx: number) {
    e.preventDefault()
    setDragOverDay(null)
    setTooltip(null)
    const ghost = document.getElementById(`week-ghost-${dayIdx}`)
    if (ghost) ghost.style.display = 'none'

    if (dragEmail.current) {
      const msg = dragEmail.current
      setEmailForm({
        title: msg.subject || '(Sans sujet)',
        time: '09:00',
        dur: '30',
        cat: categories[0]?.id || '',
        includeLink: true,
      })
      setDropEmailModal({ message: msg, dayIdx })
      dragEmail.current = null
      return
    }

    const t = dragWeekTask.current
    if (!t) return

    // On n'autorise pas le drag des tâches récurrentes (elles ont une heure fixe)
    if (t.isRecurring) {
      alert('Pour modifier une tâche récurrente, utilisez le bouton « Modifier » (crayon).')
      dragWeekTask.current = null
      dragWeekFromDay.current = null
      return
    }

    const colEl = e.currentTarget as HTMLElement
    const rect = colEl.getBoundingClientRect()
    const y = e.clientY - rect.top
    const offsetY = dragWeekFromDay.current !== null ? dragCalOffset.current : 0
    const newTimeMin = getMinFromY(y, offsetY)

    await saveScheduled(t.id, newTimeMin, t.dur, dayIdx)
    dragWeekTask.current = null
    dragWeekFromDay.current = null
    loadWeek(user.id)
  }

  function openAddForm(dayIdx: number) {
    setShowAddForm(dayIdx)
    setNewTitle(''); setNewTime('09:00'); setNewDur('60')
    setNewCat(categories[0]?.id || '')
  }

  const monday = getMonday()
  const friday = new Date(monday); friday.setDate(monday.getDate()+4)
  const todayStr = ymd(new Date())
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

      {/* Main */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', minHeight:'100vh', minWidth:0 }}>
        <div style={{ background:'#111', padding:'10px 1rem', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0, gap:'12px' }}>
          <h1 style={{ fontSize:'15px', fontWeight:'500', color:'#F2E000' }}>Mon calendrier</h1>

          {!googleConnected ? (
            <button onClick={connectGoogle}
              style={{ background:'white', border:'none', borderRadius:'8px', padding:'6px 12px', fontSize:'12px', fontWeight:'500', cursor:'pointer', color:'#111', display:'flex', alignItems:'center', gap:'6px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Connecter Google Agenda
            </button>
          ) : (
            <div style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'12px', color:'rgba(255,255,255,0.5)' }}>
              <div style={{ width:'7px', height:'7px', borderRadius:'50%', background:'#34A853' }} />
              Google Agenda connecté
            </div>
          )}
        </div>

        <div style={{ background:'#1a1a1a', borderBottom:'0.5px solid rgba(255,255,255,0.08)', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', flexShrink:0 }}>
          <button onClick={() => setWeekOffset(w => w-1)}
            style={{ background:'#F2E000', border:'none', borderRadius:'6px', width:'28px', height:'28px', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="#111" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <span style={{ fontSize:'13px', color:'rgba(255,255,255,0.8)', fontWeight:'500' }}>
            Semaine du {monday.getDate()} {MOIS[monday.getMonth()]} au {friday.getDate()} {MOIS[friday.getMonth()]}
          </span>
          <button onClick={() => setWeekOffset(w => w+1)}
            style={{ background:'#F2E000', border:'none', borderRadius:'6px', width:'28px', height:'28px', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="#111" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>

        <div style={{ display:'flex', gap:'12px', padding:'7px 1rem', background:'white', borderBottom:'0.5px solid rgba(0,0,0,0.08)', flexShrink:0 }}>
          {[{color:'#3B6D11',label:'Tâche'},{color:'#185FA5',label:'Google Agenda'}].map(l => (
            <div key={l.label} style={{ display:'flex', alignItems:'center', gap:'5px', fontSize:'11px', color:'#777' }}>
              <div style={{ width:'8px', height:'8px', borderRadius:'2px', background:l.color }} />{l.label}
            </div>
          ))}
        </div>

        <div style={{ display:'flex', flex:1, overflow:'hidden' }}>
          <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'auto', background:'white' }}>
            <div style={{ display:'flex', position:'sticky', top:0, background:'white', zIndex:5, borderBottom:'0.5px solid rgba(0,0,0,0.08)' }}>
              <div style={{ width:'48px', flexShrink:0, borderRight:'0.5px solid rgba(0,0,0,0.08)' }} />
              {JOURS_LONG.map((jour, dayIdx) => {
                const d = getDateForDay(dayIdx)
                const ds = ymd(d)
                const isToday = ds === todayStr
                return (
                  <div key={dayIdx}
                    style={{ flex:1, minWidth:'180px', padding:'10px 12px', borderRight: dayIdx < 4 ? '0.5px solid rgba(0,0,0,0.08)' : 'none' }}>
                    <div style={{ fontSize:'13px', fontWeight:'500', color: isToday ? '#3B6D11' : '#111' }}>{jour}</div>
                    <div style={{ fontSize:'11px', color:'#888', marginTop:'2px' }}>{d.getDate()} {MOIS[d.getMonth()]}</div>

                    {showAddForm === dayIdx ? (
                      <div style={{ marginTop:'8px', background:'#f9f9f7', border:'0.5px solid rgba(0,0,0,0.1)', borderRadius:'6px', padding:'8px' }}>
                        <input autoFocus value={newTitle} onChange={e => setNewTitle(e.target.value)}
                          placeholder="Titre de la tâche"
                          style={{ width:'100%', border:'0.5px solid rgba(0,0,0,0.15)', borderRadius:'4px', padding:'5px 7px', fontSize:'12px', outline:'none', marginBottom:'5px' }}
                          onKeyDown={e => { if (e.key === 'Enter') createTaskInDay(dayIdx); if (e.key === 'Escape') setShowAddForm(null) }} />
                        <div style={{ display:'flex', gap:'4px', marginBottom:'5px' }}>
                          <input type="time" value={newTime} onChange={e => setNewTime(e.target.value)}
                            style={{ flex:1, border:'0.5px solid rgba(0,0,0,0.15)', borderRadius:'4px', padding:'4px 6px', fontSize:'11px', outline:'none' }} />
                          <input type="number" value={newDur} onChange={e => setNewDur(e.target.value)} min="5" step="5"
                            style={{ width:'60px', border:'0.5px solid rgba(0,0,0,0.15)', borderRadius:'4px', padding:'4px 6px', fontSize:'11px', outline:'none' }} />
                          <span style={{ fontSize:'10px', color:'#888', alignSelf:'center' }}>min</span>
                        </div>
                        <select value={newCat} onChange={e => setNewCat(e.target.value)}
                          style={{ width:'100%', border:'0.5px solid rgba(0,0,0,0.15)', borderRadius:'4px', padding:'4px 6px', fontSize:'11px', outline:'none', marginBottom:'6px', background:'white' }}>
                          <option value="">— Catégorie —</option>
                          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <div style={{ display:'flex', gap:'4px', justifyContent:'flex-end' }}>
                          <button onClick={() => setShowAddForm(null)}
                            style={{ fontSize:'11px', padding:'4px 8px', border:'0.5px solid rgba(0,0,0,0.1)', borderRadius:'4px', background:'white', cursor:'pointer' }}>
                            Annuler
                          </button>
                          <button onClick={() => createTaskInDay(dayIdx)}
                            style={{ fontSize:'11px', padding:'4px 10px', background:'#F2E000', border:'none', borderRadius:'4px', fontWeight:'500', cursor:'pointer' }}>
                            Ajouter
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => openAddForm(dayIdx)}
                        style={{ marginTop:'6px', width:'100%', padding:'5px', fontSize:'11px', color:'#888', background:'transparent', border:'0.5px dashed rgba(0,0,0,0.15)', borderRadius:'4px', cursor:'pointer' }}>
                        + Ajouter tâche
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            <div style={{ display:'flex', position:'relative' }}>
              <div style={{ width:'48px', flexShrink:0, borderRight:'0.5px solid rgba(0,0,0,0.08)' }}>
  {HOURS.map(h => (
    <div key={h} style={{ height:`${PPH}px`, borderBottom:'0.5px solid rgba(0,0,0,0.05)', display:'flex', alignItems:'flex-start', justifyContent:'flex-end', padding:'0 6px 0 0', fontSize:'11px', color:'#bbb' }}>
  {h}:00
</div>
  ))}
</div>

              {JOURS_LONG.map((_, dayIdx) => {
                const dayTasks = weekTasks[dayIdx] || []
                const dayGoogle = weekGoogle[dayIdx] || []
                const isOver = dragOverDay === dayIdx

                return (
                  <div key={dayIdx}
                    onDragOver={e => onColDragOver(e, dayIdx)}
                    onDragLeave={e => onColDragLeave(e, dayIdx)}
                    onDrop={e => onColDrop(e, dayIdx)}
                    style={{ flex:1, minWidth:'180px', position:'relative', height: HOURS.length*PPH+'px', borderRight: dayIdx < 4 ? '0.5px solid rgba(0,0,0,0.08)' : 'none', background: isOver ? 'rgba(242,224,0,0.04)' : 'transparent', transition:'background 0.1s' }}>
                    {HOURS.map((h,i) => (
                      <div key={h}>
                        <div style={{ position:'absolute', left:0, right:0, top:i*PPH, borderBottom:'0.5px solid rgba(0,0,0,0.06)' }} />
                        <div style={{ position:'absolute', left:0, right:0, top:i*PPH+30, borderBottom:'0.5px dashed rgba(0,0,0,0.04)' }} />
                      </div>
                    ))}

                    <div id={`week-ghost-${dayIdx}`}
                      style={{ display:'none', position:'absolute', left:'3px', right:'3px', background:'rgba(242,224,0,0.25)', border:'1.5px dashed #D4B800', borderRadius:'4px', pointerEvents:'none', zIndex:4 }} />

                    {dayGoogle.map((t, idx) => {
                      const top = (t.timeMin - 6*60) * PPM
                      const height = Math.max(t.dur * PPM, 20)
                      return (
                        <div key={`g-${t.id}-${idx}`}
                          style={{ position:'absolute', left:'3px', right:'3px', top:`${top}px`, height:`${height}px`, borderRadius:'4px', padding:'3px 5px', overflow:'hidden', zIndex:2, background:'#E6F1FB', color:'#0C447C', borderLeft:'3px solid #185FA5' }}>
                          <div style={{ fontSize:'10px', fontWeight:'500', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{t.title}</div>
                          <div style={{ fontSize:'9px', opacity:0.7, marginTop:'1px' }}>{minToStr(t.timeMin)}</div>
                        </div>
                      )
                    })}

                    {dayTasks.map((t, idx) => {
                      const top = (t.timeMin - 8*60) * PPM
                      const height = Math.max(t.dur * PPM, 20)
                      return (
                        <div key={`t-${t.id}-${t.occurrenceDate || ''}-${idx}`} draggable={!t.isRecurring}
                          onDragStart={e => onWeekTaskDragStart(e, t, dayIdx)}
                          style={{ position:'absolute', left:'3px', right:'3px', top:`${top}px`, height:`${height}px`, borderRadius:'4px', padding:'3px 32px 3px 5px', overflow:'hidden', zIndex:3, cursor: t.isRecurring ? 'default' : 'grab', background:'#EAF3DE', color:'#27500A', borderLeft:`3px solid ${t.color || '#3B6D11'}` }}>
                          <div style={{ fontSize:'10px', fontWeight:'500', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                            {t.isRecurring && '🔁 '}{t.gmail_message_id && '📧 '}{t.title.split('\n')[0]}
                          </div>
                          <div style={{ fontSize:'9px', opacity:0.7, marginTop:'1px' }}>{minToStr(t.timeMin)}</div>
                          <div onClick={ev => { ev.stopPropagation(); openEditTask(t.id) }}
                            title="Modifier"
                            style={{ position:'absolute', top:'2px', right:'18px', width:'14px', height:'14px', borderRadius:'50%', background:'rgba(0,0,0,0.1)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#27500A', opacity:0.6 }}
                            onMouseEnter={ev => (ev.currentTarget as HTMLElement).style.opacity='1'}
                            onMouseLeave={ev => (ev.currentTarget as HTMLElement).style.opacity='0.6'}>
                            <svg width="8" height="8" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="#27500A" strokeWidth="2" strokeLinecap="round"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="#27500A" strokeWidth="2" strokeLinecap="round"/></svg>
                          </div>
                          <div onClick={ev => { ev.stopPropagation(); removeFromCalendar(t) }}
                            title={t.isRecurring ? "Ignorer cette occurrence" : "Retirer du calendrier"}
                            style={{ position:'absolute', top:'2px', right:'3px', width:'14px', height:'14px', borderRadius:'50%', background:'rgba(0,0,0,0.1)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:'10px', lineHeight:'1', color:'#27500A', opacity:0.6 }}
                            onMouseEnter={ev => (ev.currentTarget as HTMLElement).style.opacity='1'}
                            onMouseLeave={ev => (ev.currentTarget as HTMLElement).style.opacity='0.6'}>
                            ×
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Panneau droit */}
          <div style={{ width:'320px', flexShrink:0, background:'#f9f9f7', display:'flex', flexDirection:'column', borderLeft:'0.5px solid rgba(0,0,0,0.1)' }}>
            <div style={{ display:'flex', background:'white', borderBottom:'0.5px solid rgba(0,0,0,0.08)' }}>
              <button onClick={() => setSidePanel('tasks')}
                style={{ flex:1, padding:'10px', fontSize:'11px', fontWeight:'500', textTransform:'uppercase', letterSpacing:'0.5px', border:'none', background: sidePanel==='tasks' ? '#f9f9f7' : 'transparent', color: sidePanel==='tasks' ? '#111' : '#888', borderBottom: sidePanel==='tasks' ? '2px solid #F2E000' : '2px solid transparent', cursor:'pointer' }}>
                Tâches ({unplanned.length})
              </button>
              <button onClick={() => setSidePanel('gmail')}
                style={{ flex:1, padding:'10px', fontSize:'11px', fontWeight:'500', textTransform:'uppercase', letterSpacing:'0.5px', border:'none', background: sidePanel==='gmail' ? '#f9f9f7' : 'transparent', color: sidePanel==='gmail' ? '#111' : '#888', borderBottom: sidePanel==='gmail' ? '2px solid #F2E000' : '2px solid transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'6px' }}>
                Inbox Gmail
                {sidePanel === 'gmail' && (
                  <span onClick={(e) => { e.stopPropagation(); user && loadGmail(user.id) }}
                    style={{ fontSize:'13px', color:'#888', cursor:'pointer', padding:'0 4px' }}
                    title="Rafraîchir">
                    ↻
                  </span>
                )}
              </button>
            </div>

            <div style={{ flex:1, overflowY:'auto' }}>
              {sidePanel === 'tasks' && (
                <div style={{ padding:'8px', display:'flex', flexDirection:'column', gap:'6px' }}>
                  {unplanned.length === 0 && (
                    <div style={{ textAlign:'center', fontSize:'11px', color:'#aaa', padding:'1.5rem' }}>Toutes les tâches sont planifiées !</div>
                  )}
                  {unplanned.map((t: any) => (
                    <div key={t.id} draggable onDragStart={e => onWeekUnplannedDragStart(e, t)}
                      style={{ background:'white', border:'0.5px solid rgba(0,0,0,0.1)', borderLeft:`3px solid ${t.category?.color || '#3B6D11'}`, borderRadius:'8px', padding:'9px 12px 9px 12px', cursor:'grab', userSelect:'none', position:'relative' }}>
                      <div style={{ fontSize:'12px', fontWeight:'500', color:'#111', paddingRight:'24px' }}>{t.description.split('\n')[0]}</div>
                      <div style={{ fontSize:'11px', color:'#aaa', marginTop:'3px', display:'flex', gap:'8px' }}>
                        <span>{t.category?.name || '–'}</span>
                        {t.estimated_duration && <span>⏱ {t.estimated_duration}</span>}
                      </div>
                      <div onClick={ev => { ev.stopPropagation(); openEditTask(t.id) }}
                        title="Modifier"
                        style={{ position:'absolute', top:'8px', right:'8px', width:'22px', height:'22px', borderRadius:'50%', background:'#f5f4f0', border:'0.5px solid rgba(0,0,0,0.1)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}
                        onMouseEnter={ev => (ev.currentTarget as HTMLElement).style.background='#FEFDE6'}
                        onMouseLeave={ev => (ev.currentTarget as HTMLElement).style.background='#f5f4f0'}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="#555" strokeWidth="1.5" strokeLinecap="round"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="#555" strokeWidth="1.5" strokeLinecap="round"/></svg>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {sidePanel === 'gmail' && (
                <div style={{ padding:'8px', display:'flex', flexDirection:'column', gap:'6px' }}>
                  {gmailLoading && <div style={{ textAlign:'center', fontSize:'11px', color:'#aaa', padding:'1.5rem' }}>Chargement...</div>}
                  {!gmailLoading && gmailMessages.length === 0 && (
                    <div style={{ textAlign:'center', fontSize:'11px', color:'#aaa', padding:'1.5rem' }}>Aucun courriel ou Gmail non connecté.</div>
                  )}
                  {gmailMessages.map((m: any) => (
                    <div key={m.id} draggable onDragStart={e => onEmailDragStart(e, m)}
                      style={{ background:'white', border:'0.5px solid rgba(0,0,0,0.1)', borderLeft:'3px solid #D93025', borderRadius:'8px', padding:'8px 10px', cursor:'grab', userSelect:'none' }}>
                      <div style={{ fontSize:'11px', color:'#888', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{formatFrom(m.from)}</div>
                      <div style={{ fontSize:'12px', fontWeight: m.unread ? '600' : '400', color:'#111', marginTop:'2px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.subject}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ fontSize:'11px', color:'#ccc', textAlign:'center', padding:'8px', borderTop:'0.5px solid rgba(0,0,0,0.05)' }}>
              ← Glissez vers un jour
            </div>
          </div>
        </div>
      </div>

      {/* Popup drop courriel */}
      {dropEmailModal && (
        <div onClick={() => setDropEmailModal(null)}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background:'white', borderRadius:'12px', padding:'1.25rem', width:'440px', maxWidth:'90vw', boxShadow:'0 20px 60px rgba(0,0,0,0.3)' }}>
            <h3 style={{ fontSize:'14px', fontWeight:'500', marginBottom:'4px' }}>Créer une tâche depuis ce courriel</h3>
            <div style={{ fontSize:'11px', color:'#888', marginBottom:'12px' }}>
              De : {formatFrom(dropEmailModal.message.from)}
            </div>

            <div style={{ marginBottom:'10px' }}>
              <label style={{ display:'block', fontSize:'11px', color:'#777', marginBottom:'4px' }}>Titre</label>
              <input autoFocus value={emailForm.title}
                onChange={e => setEmailForm({...emailForm, title: e.target.value})}
                style={{ width:'100%', padding:'8px 10px', fontSize:'13px', border:'0.5px solid rgba(0,0,0,0.15)', borderRadius:'6px', outline:'none' }} />
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'8px', marginBottom:'10px' }}>
              <div>
                <label style={{ display:'block', fontSize:'11px', color:'#777', marginBottom:'4px' }}>Heure</label>
                <input type="time" value={emailForm.time}
                  onChange={e => setEmailForm({...emailForm, time: e.target.value})}
                  style={{ width:'100%', padding:'7px 8px', fontSize:'13px', border:'0.5px solid rgba(0,0,0,0.15)', borderRadius:'6px', outline:'none' }} />
              </div>
              <div>
                <label style={{ display:'block', fontSize:'11px', color:'#777', marginBottom:'4px' }}>Durée (min)</label>
                <input type="number" value={emailForm.dur} min="5" step="5"
                  onChange={e => setEmailForm({...emailForm, dur: e.target.value})}
                  style={{ width:'100%', padding:'7px 8px', fontSize:'13px', border:'0.5px solid rgba(0,0,0,0.15)', borderRadius:'6px', outline:'none' }} />
              </div>
              <div>
                <label style={{ display:'block', fontSize:'11px', color:'#777', marginBottom:'4px' }}>Catégorie</label>
                <select value={emailForm.cat}
                  onChange={e => setEmailForm({...emailForm, cat: e.target.value})}
                  style={{ width:'100%', padding:'7px 8px', fontSize:'13px', border:'0.5px solid rgba(0,0,0,0.15)', borderRadius:'6px', outline:'none', background:'white' }}>
                  <option value="">—</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>

            <label style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'14px', cursor:'pointer', fontSize:'12px', color:'#555' }}>
              <input type="checkbox" checked={emailForm.includeLink}
                onChange={e => setEmailForm({...emailForm, includeLink: e.target.checked})} />
              Inclure le lien vers le courriel dans la tâche
            </label>

            <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end' }}>
              <button onClick={() => setDropEmailModal(null)}
                style={{ padding:'8px 14px', fontSize:'13px', border:'0.5px solid rgba(0,0,0,0.15)', borderRadius:'8px', background:'white', cursor:'pointer' }}>
                Annuler
              </button>
              <button onClick={createTaskFromEmail}
                style={{ padding:'8px 18px', fontSize:'13px', background:'#F2E000', border:'none', borderRadius:'8px', fontWeight:'500', cursor:'pointer' }}>
                Créer la tâche
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Popup d'édition de tâche */}
      {editTask && (
        <div onClick={() => setEditTask(null)}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background:'white', borderRadius:'12px', padding:'1.25rem', width:'460px', maxWidth:'90vw', boxShadow:'0 20px 60px rgba(0,0,0,0.3)' }}>
            <h3 style={{ fontSize:'14px', fontWeight:'500', marginBottom:'14px' }}>Modifier la tâche</h3>

            <div style={{ marginBottom:'10px' }}>
              <label style={{ display:'block', fontSize:'11px', color:'#777', marginBottom:'4px' }}>Titre</label>
              <input autoFocus value={editForm.title} onChange={e => setEditForm({...editForm, title: e.target.value})}
                style={{ width:'100%', padding:'8px 10px', fontSize:'13px', border:'0.5px solid rgba(0,0,0,0.15)', borderRadius:'6px', outline:'none' }} />
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'10px' }}>
              <div>
                <label style={{ display:'block', fontSize:'11px', color:'#777', marginBottom:'4px' }}>Catégorie</label>
                <select value={editForm.cat} onChange={e => setEditForm({...editForm, cat: e.target.value})}
                  style={{ width:'100%', padding:'7px 8px', fontSize:'13px', border:'0.5px solid rgba(0,0,0,0.15)', borderRadius:'6px', outline:'none', background:'white' }}>
                  <option value="">–</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display:'block', fontSize:'11px', color:'#777', marginBottom:'4px' }}>Durée (min)</label>
                <input type="number" value={editForm.dur} min="5" step="5"
                  onChange={e => setEditForm({...editForm, dur: e.target.value})}
                  style={{ width:'100%', padding:'7px 8px', fontSize:'13px', border:'0.5px solid rgba(0,0,0,0.15)', borderRadius:'6px', outline:'none' }} />
              </div>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'10px' }}>
              <div>
                <label style={{ display:'block', fontSize:'11px', color:'#777', marginBottom:'4px' }}>Date</label>
                <input type="date" value={editForm.date} onChange={e => setEditForm({...editForm, date: e.target.value})}
                  style={{ width:'100%', padding:'7px 8px', fontSize:'13px', border:'0.5px solid rgba(0,0,0,0.15)', borderRadius:'6px', outline:'none' }} />
              </div>
              <div>
                <label style={{ display:'block', fontSize:'11px', color:'#777', marginBottom:'4px' }}>Heure</label>
                <input type="time" value={editForm.time} onChange={e => setEditForm({...editForm, time: e.target.value})}
                  disabled={!editForm.date}
                  style={{ width:'100%', padding:'7px 8px', fontSize:'13px', border:'0.5px solid rgba(0,0,0,0.15)', borderRadius:'6px', outline:'none', background: editForm.date ? 'white' : '#f9f9f7' }} />
              </div>
            </div>

            <div style={{ marginBottom:'14px' }}>
              <label style={{ display:'block', fontSize:'11px', color:'#777', marginBottom:'4px' }}>🔁 Récurrence</label>
              <select value={editForm.recurrence} onChange={e => setEditForm({...editForm, recurrence: e.target.value})}
                disabled={!editForm.date}
                style={{ width:'100%', padding:'7px 8px', fontSize:'13px', border:'0.5px solid rgba(0,0,0,0.15)', borderRadius:'6px', outline:'none', background: editForm.date ? 'white' : '#f9f9f7' }}>
                {RECURRENCES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              {!editForm.date && (
                <div style={{ fontSize:'10px', color:'#aaa', marginTop:'4px' }}>
                  Une date doit être définie pour activer la récurrence.
                </div>
              )}
              {editForm.recurrence && (
                <div style={{ fontSize:'10px', color:'#3B6D11', marginTop:'4px' }}>
                  La tâche se répétera automatiquement selon cette fréquence.
                </div>
              )}
            </div>

            <div style={{ display:'flex', gap:'8px', justifyContent:'space-between', alignItems:'center' }}>
              <button onClick={() => deleteTask(editTask.id)}
                style={{ padding:'7px 14px', fontSize:'12px', border:'0.5px solid #E24B4A', borderRadius:'8px', background:'white', color:'#E24B4A', cursor:'pointer' }}>
                Supprimer
              </button>
              <div style={{ display:'flex', gap:'8px' }}>
                <button onClick={() => setEditTask(null)}
                  style={{ padding:'7px 14px', fontSize:'13px', border:'0.5px solid rgba(0,0,0,0.15)', borderRadius:'8px', background:'white', cursor:'pointer' }}>
                  Annuler
                </button>
                <button onClick={saveEditedTask}
                  style={{ padding:'7px 16px', fontSize:'13px', background:'#F2E000', border:'none', borderRadius:'8px', fontWeight:'500', cursor:'pointer' }}>
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {tooltip && (
        <div style={{ position:'fixed', left:tooltip.x, top:tooltip.y, background:'#111', color:'#F2E000', fontSize:'11px', padding:'3px 7px', borderRadius:'4px', pointerEvents:'none', zIndex:100 }}>
          {tooltip.text}
        </div>
      )}
    </div>
  )
}
