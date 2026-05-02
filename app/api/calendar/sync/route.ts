import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

async function refreshToken(userId: string, refreshToken: string) {
  console.log('[refresh] Sending request with:', {
    client_id_length: process.env.GOOGLE_CLIENT_ID?.length,
    client_id_starts: process.env.GOOGLE_CLIENT_ID?.substring(0, 25),
    client_secret_length: process.env.GOOGLE_CLIENT_SECRET?.length,
    client_secret_starts: process.env.GOOGLE_CLIENT_SECRET?.substring(0, 12),
    refresh_token_length: refreshToken?.length,
    refresh_token_starts: refreshToken?.substring(0, 25),
  })

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
  if (!data.access_token) {
    console.log('[refresh] Google returned:', data)
    return null
  }
  await supabase.from('users').update({ google_access_token: data.access_token }).eq('id', userId)
  return data.access_token
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')
  const dateStr = searchParams.get('date')

  if (!userId || !dateStr) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 })
  }

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('google_access_token, google_refresh_token')
    .eq('id', userId)
    .single()

  if (userError) {
    console.log('[sync] DB error fetching user:', userError)
  }

  console.log('[sync] user tokens:', {
    userId,
    has_access: !!user?.google_access_token,
    has_refresh: !!user?.google_refresh_token,
    access_length: user?.google_access_token?.length,
    refresh_length: user?.google_refresh_token?.length,
  })

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
  console.log('[sync] initial Google response:', res.status)

  if (res.status === 401 && user.google_refresh_token) {
    console.log('[sync] access token expired, refreshing...')
    accessToken = await refreshToken(userId, user.google_refresh_token)
    if (!accessToken) {
      console.log('[sync] refresh failed')
      return NextResponse.json({ error: 'token_expired' }, { status: 401 })
    }
    res = await fetchEvents(accessToken)
    console.log('[sync] after refresh, Google response:', res.status)
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
