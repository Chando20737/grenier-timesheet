import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

async function refreshToken(userId: string, refreshToken: string) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json()
  if (data.access_token) {
    await supabase.from('users').update({ google_access_token: data.access_token }).eq('id', userId)
    return data.access_token
  }
  return null
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')
  const dateStr = searchParams.get('date') // YYYY-MM-DD

  if (!userId || !dateStr) return NextResponse.json({ error: 'Missing params' }, { status: 400 })

  const { data: user } = await supabase.from('users').select('google_access_token, google_refresh_token').eq('id', userId).single()

  if (!user?.google_access_token) {
    return NextResponse.json({ error: 'not_connected' }, { status: 401 })
  }

  const date = new Date(dateStr)
  const timeMin = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0).toISOString()
  const timeMax = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59).toISOString()

  let accessToken = user.google_access_token

  const fetchEvents = async (token: string) => {
    return fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
  }

  let res = await fetchEvents(accessToken)

  // Token expiré — rafraîchir
  if (res.status === 401 && user.google_refresh_token) {
    accessToken = await refreshToken(userId, user.google_refresh_token)
    if (!accessToken) return NextResponse.json({ error: 'token_expired' }, { status: 401 })
    res = await fetchEvents(accessToken)
  }

  const data = await res.json()
  const events = (data.items || []).map((e: any) => ({
    id: e.id,
    title: e.summary || 'Sans titre',
    start: e.start?.dateTime || e.start?.date,
    end: e.end?.dateTime || e.end?.date,
    allDay: !e.start?.dateTime,
  }))

  return NextResponse.json({ events })
}
