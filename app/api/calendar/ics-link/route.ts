import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// Retourne (et crée au besoin) le lien iCal personnel de l'utilisateur authentifié.
// Authentifié via le jeton de session Supabase passé en en-tête Authorization.
export async function GET(req: NextRequest) {
  const jwt = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!jwt) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(jwt)
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: row } = await supabaseAdmin
    .from('users').select('calendar_token').eq('id', user.id).single()

  let calToken = row?.calendar_token
  if (!calToken) {
    calToken = (randomUUID() + randomUUID()).replace(/-/g, '')
    await supabaseAdmin.from('users').update({ calendar_token: calToken }).eq('id', user.id)
  }

  return NextResponse.json({ url: `${req.nextUrl.origin}/api/calendar/ics?token=${calToken}` })
}
