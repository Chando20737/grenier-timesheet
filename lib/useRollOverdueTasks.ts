'use client'
import { useEffect, useRef } from 'react'
import { supabase } from './supabase'

// Repousse à « maintenant », chaque minute, les tâches normales non terminées
// dont l'heure est passée — elles restent ainsi à jour jusqu'à ce qu'on les
// marque terminées (is_done = true les sort du roulement). Actif uniquement
// tant que l'onglet est ouvert (dashboard ou calendrier). Les tâches récurrentes
// sont volontairement exclues (leur scheduled_at sert d'ancre de récurrence) et
// demeurent gérées par le cron quotidien /api/cron/roll-tasks.
//
// onRolled : appelé seulement si des tâches ont bougé, pour recharger l'affichage.
// getActiveTaskId : optionnel — id d'une tâche à NE PAS repousser (ex. en cours de
// chronométrage sur le dashboard).
export function useRollOverdueTasks(opts: {
  userId: string | undefined
  onRolled: () => void
  getActiveTaskId?: () => string | null
}) {
  const onRolledRef = useRef(opts.onRolled)
  const getActiveRef = useRef(opts.getActiveTaskId)
  onRolledRef.current = opts.onRolled
  getActiveRef.current = opts.getActiveTaskId

  const userId = opts.userId
  useEffect(() => {
    if (!userId) return
    let cancelled = false

    async function roll() {
      const now = new Date()
      now.setSeconds(0, 0)
      const nowIso = now.toISOString()
      let query = supabase.from('tasks')
        .update({ scheduled_at: nowIso })
        .eq('user_id', userId)
        .eq('is_done', false)
        .is('recurrence', null)
        .not('scheduled_at', 'is', null)
        .lt('scheduled_at', nowIso)
      const activeId = getActiveRef.current?.() ?? null
      if (activeId) query = query.neq('id', activeId)
      const { data: bumped } = await query.select('id')
      if (cancelled) return
      if (bumped && bumped.length > 0) onRolledRef.current()
    }

    roll()
    const id = setInterval(roll, 60_000)
    function onVisible() { if (document.visibilityState === 'visible') roll() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [userId])
}
