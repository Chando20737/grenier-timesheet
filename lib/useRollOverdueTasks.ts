'use client'
import { useEffect, useRef } from 'react'
import { supabase } from './supabase'

// Repousse les tâches normales en retard par tranches de 15 minutes
// (9:00 → 9:15 → 9:30 …) tant qu'elles ne sont pas terminées (is_done = true les
// sort du roulement). La vérification tourne chaque minute, mais l'heure n'avance
// qu'aux marques de 15 min. Actif uniquement tant que l'onglet est ouvert
// (dashboard ou calendrier). Les tâches récurrentes sont volontairement exclues
// (leur scheduled_at sert d'ancre de récurrence) et demeurent gérées par le cron
// quotidien /api/cron/roll-tasks.
//
// onRolled : appelé seulement si des tâches ont bougé, pour recharger l'affichage.
export function useRollOverdueTasks(opts: {
  userId: string | undefined
  onRolled: () => void
}) {
  const onRolledRef = useRef(opts.onRolled)
  onRolledRef.current = opts.onRolled

  const userId = opts.userId
  useEffect(() => {
    if (!userId) return
    let cancelled = false

    // Id de la tâche en cours de chronométrage (ou en pause), lu depuis l'état du
    // chrono que le dashboard persiste dans localStorage. Comme localStorage est
    // partagé entre tous les onglets/pages de l'origine, le calendrier aussi évite
    // ainsi de repousser la tâche qu'on est en train de faire.
    function activeTimedTaskId(): string | null {
      try {
        const raw = localStorage.getItem('grenier-timer')
        if (!raw) return null
        const s = JSON.parse(raw)
        if (s.userId !== userId) return null
        if (!(s.running || s.paused)) return null
        return s.selectedTask?.id ?? null
      } catch { return null }
    }

    async function roll() {
      // Tranche de 15 min courante : la tâche avance par pas de 15 min, sur des
      // heures rondes (9:00, 9:15, 9:30 …), plutôt qu'à chaque minute.
      const STEP_MS = 15 * 60 * 1000
      const slotIso = new Date(Math.floor(Date.now() / STEP_MS) * STEP_MS).toISOString()
      let query = supabase.from('tasks')
        .update({ scheduled_at: slotIso })
        .eq('user_id', userId)
        .eq('is_done', false)
        .is('recurrence', null)
        .not('scheduled_at', 'is', null)
        .lt('scheduled_at', slotIso)
      // Ne pas repousser la tâche qu'on est en train de chronométrer (sur n'importe quelle page)
      const activeId = activeTimedTaskId()
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
