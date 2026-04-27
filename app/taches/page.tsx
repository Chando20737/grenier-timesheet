'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const COLORS = ['#185FA5','#533AB7','#3B6D11','#854F0B','#A32D2D','#0F6E56','#9a8600','#633806']

export default function TachesPage() {
  const [tasks, setTasks] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [filter, setFilter] = useState('toutes')
  const [showModal, setShowModal] = useState(false)
  const [showCatModal, setShowCatModal] = useState(false)
  const [desc, setDesc] = useState('')
  const [catId, setCatId] = useState('')
  const [est, setEst] = useState('')
  const [catName, setCatName] = useState('')
  const [catColor, setCatColor] = useState(COLORS[0])
  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setUserId(session.user.id)
        loadCategories(session.user.id)
        loadTasks(session.user.id)
        setLoading(false)
      } else if (event === 'SIGNED_OUT') {
        window.location.href = '/login'
      } else if (event === 'INITIAL_SESSION' && !session) {
        window.location.href = '/login'
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function loadCategories(uid: string) {
    const { data, error } = await supabase.from('categories').select('*').or(`user_id.eq.${uid},is_global.eq.true`).order('name')
    if (error) console.error('categories error:', error)
    setCategories(data || [])
  }

  async function loadTasks(uid: string) {
    const { data, error } = await supabase.from('tasks').select('*, category:categories(name,color)').eq('user_id', uid).order('created_at', { ascending: false })
    if (error) console.error('tasks error:', error)
    setTasks(data || [])
  }

  async function addTask() {
    if (!desc.trim() || !userId) return
    const { error } = await supabase.from('tasks').insert({
      user_id: userId,
      description: desc,
      category_id: catId || null,
      estimated_duration: est || null,
      source: 'manual'
    })
    if (error) { console.error('insert task error:', error); return }
    setDesc(''); setCatId(''); setEst(''); setShowModal(false)
    loadTasks(userId)
  }

  async function addCategory() {
    if (!catName.trim() || !userId) return
    const { error } = await supabase.from('categories').insert({
      user_id: userId,
      name: catName,
      color: catColor,
      is_global: false
    })
    if (error) { console.error('insert category error:', error); return }
    setCatName(''); setCatColor(COLORS[0]); setShowCatModal(false)
    loadCategories(userId)
  }

  async function toggleDone(id: string, done: boolean) {
    await supabase.from('tasks').update({ is_done: !done }).eq('id', id)
    loadTasks(userId)
  }

  async function deleteTask(id: string) {
    await supabase.from('tasks').delete().eq('id', id)
    loadTasks(userId)
  }

  const filtered = filter === 'toutes' ? tasks : tasks.filter(t => t.category?.name === filter)

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f5f4f0' }}>
      <div style={{ fontSize:'13px', color:'#aaa' }}>Chargement...</div>
    </div>
  )

  return (
    <div style={{ display:'flex', minHeight:'100vh' }}>
      <div style={{ width:'52px', background:'#111', display:'flex', flexDirection:'column', alignItems:'center', padding:'12px 0', gap:'6px', flexShrink:0 }}>
        {[
          { href:'/dashboard', icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="13" r="8" stroke="white" strokeWidth="1.5"/><path d="M12 9v4l2.5 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg> },
          { href:'/taches', active:true, icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="16" rx="2" stroke="#111" strokeWidth="1.5"/><path d="M8 9h8M8 13h5" stroke="#111" strokeWidth="1.5" strokeLinecap="round"/></svg> },
          { href:'/gmail', icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M20 4H4C2.9 4 2 4.9 2 6v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2z" stroke="white" strokeWidth="1.5"/><path d="M2 6l10 7 10-7" stroke="white" strokeWidth="1.5"/></svg> },
          { href:'/rapport', icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 20V8l8-5 8 5v12H4z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/><path d="M9 20v-6h6v6" stroke="white" strokeWidth="1.5"/></svg> },
          { href:'/employes', icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="9" cy="7" r="3" stroke="white" strokeWidth="1.5"/><path d="M3 17c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg> },
        ].map(item => (
          <div key={item.href} onClick={() => window.location.href = item.href}
            style={{ width:'36px', height:'36px', borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', background: item.active ? '#F2E000' : 'transparent' }}>
            {item.icon}
          </div>
        ))}
        <div style={{ flex:1 }} />
        <div onClick={() => supabase.auth.signOut().then(() => window.location.href = '/login')}
          style={{ width:'30px', height:'30px', borderRadius:'50%', background:'#F2E000', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'11px', fontWeight:'500', color:'#111', cursor:'pointer' }}>
          ÉG
        </div>
      </div>

      <div style={{ flex:1, background:'#f5f4f0', padding:'1.25rem' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1rem' }}>
          <h1 style={{ fontSize:'15px', fontWeight:'500' }}>Mes tâches</h1>
          <button onClick={() => setShowModal(true)}
            style={{ background:'#F2E000', border:'none', borderRadius:'8px', padding:'7px 14px', fontSize:'13px', fontWeight:'500', cursor:'pointer' }}>
            + Nouvelle tâche
          </button>
        </div>

        <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', marginBottom:'1rem' }}>
          <div onClick={() => setFilter('toutes')}
            style={{ padding:'5px 12px', borderRadius:'20px', border:'0.5px solid rgba(0,0,0,0.15)', background: filter==='toutes' ? '#111' : 'white', color: filter==='toutes' ? '#F2E000' : '#555', fontSize:'12px', cursor:'pointer' }}>
            Toutes
          </div>
          {categories.map(c => (
            <div key={c.id} onClick={() => setFilter(c.name)}
              style={{ padding:'5px 12px', borderRadius:'20px', border:'0.5px solid rgba(0,0,0,0.15)', background: filter===c.name ? '#111' : 'white', color: filter===c.name ? '#F2E000' : '#555', fontSize:'12px', cursor:'pointer', display:'flex', alignItems:'center', gap:'5px' }}>
              <span style={{ width:'7px', height:'7px', borderRadius:'50%', background: filter===c.name ? '#F2E000' : c.color, display:'inline-block' }} />
              {c.name}
            </div>
          ))}
          <div onClick={() => setShowCatModal(true)}
            style={{ padding:'5px 12px', borderRadius:'20px', border:'0.5px dashed rgba(0,0,0,0.2)', background:'white', color:'#aaa', fontSize:'12px', cursor:'pointer' }}>
            + Nouvelle catégorie
          </div>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
          {filtered.length === 0 && <div style={{ textAlign:'center', fontSize:'13px', color:'#aaa', padding:'2rem 0' }}>Aucune tâche.</div>}
          {filtered.map(t => (
            <div key={t.id} style={{ background:'white', border:'0.5px solid rgba(0,0,0,0.1)', borderRadius:'10px', padding:'10px 14px', display:'flex', alignItems:'center', gap:'12px' }}>
              <div onClick={() => toggleDone(t.id, t.is_done)}
                style={{ width:'18px', height:'18px', borderRadius:'50%', border: t.is_done ? 'none' : '1.5px solid rgba(0,0,0,0.2)', background: t.is_done ? '#3B6D11' : 'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                {t.is_done && <svg width="10" height="10" viewBox="0 0 12 12"><polyline points="2,6 5,9 10,3" stroke="white" strokeWidth="1.8" fill="none" strokeLinecap="round"/></svg>}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:'13px', textDecoration: t.is_done ? 'line-through' : 'none', color: t.is_done ? '#aaa' : '#111' }}>{t.description}</div>
                <div style={{ display:'flex', gap:'8px', marginTop:'3px', alignItems:'center' }}>
                  {t.category && <span style={{ fontSize:'11px', color: t.category.color }}>{t.category.name}</span>}
                  {t.estimated_duration && <span style={{ fontSize:'11px', color:'#aaa' }}>⏱ {t.estimated_duration}</span>}
                  <span style={{ fontSize:'10px', padding:'2px 6px', borderRadius:'10px', background: t.source==='gmail' ? '#FCEBEB' : '#f5f4f0', color: t.source==='gmail' ? '#A32D2D' : '#aaa' }}>
                    {t.source === 'gmail' ? 'Gmail' : 'Manuel'}
                  </span>
                </div>
              </div>
              <div onClick={() => deleteTask(t.id)} style={{ cursor:'pointer', color:'#ccc', fontSize:'18px', padding:'0 4px' }}>×</div>
            </div>
          ))}
        </div>

        {showModal && (
          <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.35)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50 }}>
            <div style={{ background:'white', borderRadius:'16px', padding:'1.5rem', width:'320px' }}>
              <div style={{ fontSize:'14px', fontWeight:'500', marginBottom:'1rem' }}>Nouvelle tâche</div>
              <div style={{ marginBottom:'10px' }}>
                <label style={{ fontSize:'11px', color:'#777', display:'block', marginBottom:'4px' }}>Description</label>
                <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Ex: Préparer la réunion"
                  style={{ width:'100%', padding:'8px 10px', fontSize:'13px', border:'0.5px solid rgba(0,0,0,0.15)', borderRadius:'8px', outline:'none' }} />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'12px' }}>
                <div>
                  <label style={{ fontSize:'11px', color:'#777', display:'block', marginBottom:'4px' }}>Catégorie</label>
                  <select value={catId} onChange={e => setCatId(e.target.value)}
                    style={{ width:'100%', padding:'8px 10px', fontSize:'13px', border:'0.5px solid rgba(0,0,0,0.15)', borderRadius:'8px', outline:'none' }}>
                    <option value="">–</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:'11px', color:'#777', display:'block', marginBottom:'4px' }}>Durée estimée</label>
                  <input value={est} onChange={e => setEst(e.target.value)} placeholder="ex: 1h 30"
                    style={{ width:'100%', padding:'8px 10px', fontSize:'13px', border:'0.5px solid rgba(0,0,0,0.15)', borderRadius:'8px', outline:'none' }} />
                </div>
              </div>
              <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end' }}>
                <button onClick={() => setShowModal(false)} style={{ padding:'7px 14px', fontSize:'13px', border:'0.5px solid rgba(0,0,0,0.15)', borderRadius:'8px', background:'none', cursor:'pointer' }}>Annuler</button>
                <button onClick={addTask} style={{ padding:'7px 16px', fontSize:'13px', background:'#F2E000', border:'none', borderRadius:'8px', fontWeight:'500', cursor:'pointer' }}>Ajouter</button>
              </div>
            </div>
          </div>
        )}

        {showCatModal && (
          <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.35)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50 }}>
            <div style={{ background:'white', borderRadius:'16px', padding:'1.5rem', width:'300px' }}>
              <div style={{ fontSize:'14px', fontWeight:'500', marginBottom:'4px' }}>Nouvelle catégorie</div>
              <div style={{ fontSize:'12px', color:'#aaa', marginBottom:'1rem' }}>Visible par vous seulement.</div>
              <div style={{ marginBottom:'12px' }}>
                <label style={{ fontSize:'11px', color:'#777', display:'block', marginBottom:'4px' }}>Nom</label>
                <input value={catName} onChange={e => setCatName(e.target.value)} placeholder="Ex: Marketing"
                  style={{ width:'100%', padding:'8px 10px', fontSize:'13px', border:'0.5px solid rgba(0,0,0,0.15)', borderRadius:'8px', outline:'none' }} />
              </div>
              <div style={{ marginBottom:'12px' }}>
                <label style={{ fontSize:'11px', color:'#777', display:'block', marginBottom:'6px' }}>Couleur</label>
                <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                  {COLORS.map(c => (
                    <div key={c} onClick={() => setCatColor(c)}
                      style={{ width:'22px', height:'22px', borderRadius:'50%', background:c, cursor:'pointer', border: catColor===c ? '2px solid #111' : '2px solid transparent' }} />
                  ))}
                </div>
              </div>
              <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end' }}>
                <button onClick={() => setShowCatModal(false)} style={{ padding:'7px 14px', fontSize:'13px', border:'0.5px solid rgba(0,0,0,0.15)', borderRadius:'8px', background:'none', cursor:'pointer' }}>Annuler</button>
                <button onClick={addCategory} style={{ padding:'7px 16px', fontSize:'13px', background:'#F2E000', border:'none', borderRadius:'8px', fontWeight:'500', cursor:'pointer' }}>Créer</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
