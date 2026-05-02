import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

function ymd(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth()+1).padStart(2,'0')
  const dd = String(d.getDate()).padStart(2,'0')
  return `${yyyy}-${mm}-${dd}`
}

function recurrenceMatches(recurrence: string, baseDate: Date, targetDate: Date): boolean {
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

export async function GET(req: NextRequest) {
  // Sécurité : vérifier le secret Vercel Cron
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const yesterdayStr = ymd(yesterday)
  const todayStr = ymd(today)

  let rolledNormal = 0
  let rolledRecurring = 0

  // 1) TÂCHES NORMALES non terminées dont scheduled_at < aujourd'hui
  const { data: lateTasks } = await supabase.from('tasks')
    .select('id, scheduled_at, recurrence, is_done')
    .eq('is_done', false)
    .is('recurrence', null)
    .lt('scheduled_at', today.toISOString())
    .not('scheduled_at', 'is', null)

  if (lateTasks) {
    for (const t of lateTasks) {
      const oldDt = new Date(t.scheduled_at)
      const newDt = new Date(today)
      newDt.setHours(oldDt.getHours(), oldDt.getMinutes(), 0, 0)
      await supabase.from('tasks').update({
        scheduled_at: newDt.toISOString()
      }).eq('id', t.id)
      rolledNormal++
    }
  }

  // 2) TÂCHES RÉCURRENTES : on regarde si une occurrence d'hier n'a pas été faite
  const { data: recurringTasks } = await supabase.from('tasks')
    .select('id, user_id, description, scheduled_at, recurrence, estimated_duration, category_id')
    .eq('is_done', false)
    .not('recurrence', 'is', null)

  if (recurringTasks) {
    // Charger toutes les occurrences pour hier
    const { data: existingOccs } = await supabase.from('task_occurrences')
      .select('*')
      .eq('occurrence_date', yesterdayStr)

    const occMap = new Map<string, any>()
    ;(existingOccs || []).forEach((o: any) => {
      occMap.set(o.task_id, o)
    })

    for (const t of recurringTasks) {
      const baseDt = new Date(t.scheduled_at)

      // Cette tâche aurait-elle dû apparaître hier ?
      if (!recurrenceMatches(t.recurrence, baseDt, yesterday)) continue

      const occ = occMap.get(t.id)

      // Si déjà marquée terminée ou skipped → on saute
      if (occ?.is_done || occ?.is_skipped) continue
      // Si déjà repoussée vers une date qui n'est pas hier → on saute
      if (occ?.rolled_to_date && occ.rolled_to_date !== yesterdayStr) continue

      // Marquer l'occurrence d'hier comme "repoussée vers aujourd'hui"
      await supabase.from('task_occurrences').upsert({
        task_id: t.id,
        occurrence_date: yesterdayStr,
        is_skipped: true,
        rolled_to_date: todayStr,
      }, { onConflict: 'task_id,occurrence_date' })

      // Créer une tâche unique (non récurrente) pour aujourd'hui
      const newDt = new Date(today)
      newDt.setHours(baseDt.getHours(), baseDt.getMinutes(), 0, 0)
      await supabase.from('tasks').insert({
        user_id: t.user_id,
        description: t.description,
        scheduled_at: newDt.toISOString(),
        estimated_duration: t.estimated_duration,
        category_id: t.category_id,
        source: 'manual',
        is_done: false,
      })

      rolledRecurring++
    }
  }

  return NextResponse.json({
    success: true,
    rolledNormal,
    rolledRecurring,
    runAt: now.toISOString(),
  })
}
