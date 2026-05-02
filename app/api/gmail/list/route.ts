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
  if (!data.access_token) return null
  await supabase.from('users').update({ google_access_token: data.access_token }).eq('id', userId)
  return data.access_token
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')
  const pageToken = searchParams.get('pageToken') || ''

  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
  }

  const { data: user } = await supabase
    .from('users')
    .select('google_access_token, google_refresh_token')
    .eq('id', userId)
    .single()

  if (!user?.google_access_token) {
    return NextResponse.json({ error: 'not_connected' }, { status: 401 })
  }

  let accessToken = user.google_access_token

  // 1. Lister les IDs des messages de l'inbox
  const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?labelIds=INBOX&maxResults=50${pageToken ? `&pageToken=${pageToken}` : ''}`

  const fetchList = (token: string) =>
    fetch(listUrl, { headers: { Authorization: `Bearer ${token}` } })

  let listRes = await fetchList(accessToken)

  if (listRes.status === 401 && user.google_refresh_token) {
    accessToken = await refreshToken(userId, user.google_refresh_token)
    if (!accessToken) return NextResponse.json({ error: 'token_expired' }, { status: 401 })
    listRes = await fetchList(accessToken)
  }

  const listData = await listRes.json()
  const messageIds: { id: string }[] = listData.messages || []

  // 2. Pour chaque message, récupérer les métadonnées (sujet, expéditeur, date)
  const messages = await Promise.all(
    messageIds.map(async ({ id }) => {
      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      const data = await res.json()
      const headers = data.payload?.headers || []
      const getHeader = (name: string) =>
        headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || ''

      return {
        id: data.id,
        threadId: data.threadId,
        subject: getHeader('Subject') || '(Sans sujet)',
        from: getHeader('From'),
        date: getHeader('Date'),
        snippet: data.snippet || '',
        unread: (data.labelIds || []).includes('UNREAD'),
      }
    })
  )

  return NextResponse.json({
    messages,
    nextPageToken: listData.nextPageToken || null,
  })
}
