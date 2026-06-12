'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'

export type DueToast = { id: string; description: string }

// Notifie une fois lorsqu'une tâche (normale) atteint son heure prévue :
// notification système (si autorisée) + bannière (via `dueToast`) + petit son.
// Actif uniquement tant que l'onglet est ouvert. Le hook interroge lui-même
// Supabase, il est donc indépendant de la façon dont chaque page stocke ses tâches.
// Les tâches récurrentes sont exclues (leur scheduled_at est une ancre dans le passé).
export function useDueTaskNotifications(userId: string | undefined) {
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>('default')
  const [dueToast, setDueToast] = useState<DueToast[]>([])
  const notifiedIdsRef = useRef<Set<string>>(new Set())
  const seededRef = useRef(false)

  // Lit l'état de permission au montage
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) setNotifPerm(Notification.permission)
  }, [])

  useEffect(() => {
    if (!userId) return
    let cancelled = false

    function playChime() {
      try {
        const AC = (window as any).AudioContext || (window as any).webkitAudioContext
        if (!AC) return
        const ctx = new AC()
        const o = ctx.createOscillator(), g = ctx.createGain()
        o.connect(g); g.connect(ctx.destination)
        o.type = 'sine'; o.frequency.value = 880
        g.gain.setValueAtTime(0.0001, ctx.currentTime)
        g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02)
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.45)
        o.start(); o.stop(ctx.currentTime + 0.45)
      } catch {}
    }

    async function check() {
      const nowIso = new Date().toISOString()
      const { data: due } = await supabase.from('tasks')
        .select('id, description')
        .eq('user_id', userId)
        .eq('is_done', false)
        .is('recurrence', null)
        .not('scheduled_at', 'is', null)
        .lte('scheduled_at', nowIso)
      if (cancelled || !due) return

      const dueIds = new Set(due.map((t: any) => t.id))
      // Réarme une tâche qui n'est plus due (terminée ou reportée plus tard)
      Array.from(notifiedIdsRef.current).forEach(id => { if (!dueIds.has(id)) notifiedIdsRef.current.delete(id) })

      // Première passe : mémoriser les tâches déjà dues sans notifier (pas de rafale au chargement)
      if (!seededRef.current) {
        due.forEach((t: any) => notifiedIdsRef.current.add(t.id))
        seededRef.current = true
        return
      }

      const fresh = due.filter((t: any) => !notifiedIdsRef.current.has(t.id))
      if (fresh.length === 0) return
      fresh.forEach((t: any) => notifiedIdsRef.current.add(t.id))

      playChime()
      if ('Notification' in window && Notification.permission === 'granted') {
        fresh.forEach((t: any) => {
          try { new Notification("C'est l'heure d'une tâche", { body: t.description, tag: 'grenier-task-' + t.id }) } catch {}
        })
      }
      setDueToast(prev => {
        const seen = new Set(prev.map(p => p.id))
        return [...prev, ...fresh.filter((t: any) => !seen.has(t.id)).map((t: any) => ({ id: t.id, description: t.description }))]
      })
    }

    check()
    const id = setInterval(check, 30_000)
    function onVisible() { if (document.visibilityState === 'visible') check() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [userId])

  // Auto-fermeture des bannières après 25 s
  useEffect(() => {
    if (dueToast.length === 0) return
    const id = setTimeout(() => setDueToast([]), 25_000)
    return () => clearTimeout(id)
  }, [dueToast])

  function enableNotifications() {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    Notification.requestPermission().then(p => setNotifPerm(p)).catch(() => {})
  }
  function dismissToast(id: string) { setDueToast(prev => prev.filter(p => p.id !== id)) }

  return { notifPerm, enableNotifications, dueToast, dismissToast }
}
