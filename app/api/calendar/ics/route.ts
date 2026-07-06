import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

const p = (n: number) => String(n).padStart(2, '0')

// Format iCal en UTC : YYYYMMDDTHHMMSSZ
const utcStamp = (d: Date) =>
  `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`

function esc(s: string) {
  return (s || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

function parseDurationMin(s: string | null): number {
  if (!s) return 30
  const m = String(s).match(/\d+/)
  return m ? Math.max(5, parseInt(m[0], 10)) : 30
}

const RRULE: Record<string, string> = {
  daily: 'FREQ=DAILY',
  weekdays: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR',
  weekly: 'FREQ=WEEKLY',
  biweekly: 'FREQ=WEEKLY;INTERVAL=2',
  monthly: 'FREQ=MONTHLY',
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return new NextResponse('Missing token', { status: 400 })

  const { data: user } = await supabaseAdmin
    .from('users').select('id').eq('calendar_token', token).single()
  if (!user) return new NextResponse('Invalid token', { status: 404 })

  const { data: tasks } = await supabaseAdmin
    .from('tasks')
    .select('id, description, scheduled_at, estimated_duration, recurrence, is_done, is_cancelled')
    .eq('user_id', user.id)
    .eq('is_cancelled', false)
    .not('scheduled_at', 'is', null)

  // Occurrences à exclure (annulées ou faites) pour les tâches récurrentes
  const recurringIds = (tasks || []).filter(t => t.recurrence).map(t => t.id)
  const exclByTask = new Map<string, any[]>()
  if (recurringIds.length) {
    const { data: occs } = await supabaseAdmin
      .from('task_occurrences')
      .select('task_id, occurrence_date, is_done, is_cancelled')
      .in('task_id', recurringIds)
    ;(occs || []).forEach((o: any) => {
      if (o.is_done || o.is_cancelled) {
        const arr = exclByTask.get(o.task_id) || []
        arr.push(o)
        exclByTask.set(o.task_id, arr)
      }
    })
  }

  const now = new Date()
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Grenier//Timesheet//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Grenier — Mes tâches',
  ]

  for (const t of (tasks || [])) {
    // Tâches ponctuelles déjà faites : on ne les publie pas
    if (!t.recurrence && t.is_done) continue

    const start = new Date(t.scheduled_at)
    const end = new Date(start.getTime() + parseDurationMin(t.estimated_duration) * 60000)

    lines.push('BEGIN:VEVENT')
    lines.push(`UID:grenier-${t.id}@grenier.qc.ca`)
    lines.push(`DTSTAMP:${utcStamp(now)}`)
    lines.push(`DTSTART:${utcStamp(start)}`)
    lines.push(`DTEND:${utcStamp(end)}`)
    lines.push(`SUMMARY:${esc(t.description)}`)

    if (t.recurrence && RRULE[t.recurrence]) {
      lines.push(`RRULE:${RRULE[t.recurrence]}`)
      for (const o of (exclByTask.get(t.id) || [])) {
        const [yy, mm, dd] = o.occurrence_date.split('-').map(Number)
        const ex = new Date(Date.UTC(yy, mm - 1, dd, start.getUTCHours(), start.getUTCMinutes(), start.getUTCSeconds()))
        lines.push(`EXDATE:${utcStamp(ex)}`)
      }
    }

    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')
  const body = lines.join('\r\n') + '\r\n'

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'Content-Disposition': 'inline; filename="grenier.ics"',
    },
  })
}
