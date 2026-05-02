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
  console.log('[gmail refresh] Google response:', JSON.stringify({
    has_token: !!data.access_token,
    token_length: data.access_token?.length,
    scope: data.scope,
    token_type: data.token_type,
    expires_in: data.expires_in,
    error: data.error,
    error_description: data.error_description,
  }))
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
    console.log('[gmail] not_connected for user', userId)
    return NextResponse.json({ error: 'not_connected' }, { status: 401 })
  }

  let accessToken = user.google_access_token
  console.log('[gmail] DB token length:', accessToken.length, 'starts with:', accessToken.substring(0, 20))

  // 1. Lister les IDs des messages de l'inbox (en excluant trash et spam)
  const listParams = new URLSearchParams({
    labelIds: 'INBOX',
    q: '-in:trash -in:spam',
    maxResults: '50',
  })
  if (pageToken) listParams.append('pageToken', pageToken)
  const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?${listParams}`

  const fetchList = (token: string) =>
    fetch(listUrl, { headers: { Authorization: `Bearer ${token}` } })

  let listRes = await fetchList(accessToken)
  console.log('[gmail] initial list response:', listRes.status, 'has_refresh:', !!user.google_refresh_token)

  if (listRes.status === 401) {
    if (!user.google_refresh_token) {
      console.log('[gmail] no refresh token available')
      return NextResponse.json({ error: 'no_refresh_token' }, { status: 401 })
    }
    console.log('[gmail] access token expired, refreshing...')
    const newToken = await refreshToken(userId, user.google_refresh_token)
    if (!newToken) {
      console.log('[gmail] refresh failed')
      return NextResponse.json({ error: 'token_expired' }, { status: 401 })
    }
    accessToken = newToken
    console.log('[gmail] new token length:', accessToken.length, 'starts with:', accessToken.substring(0, 20))
    listRes = await fetchList(accessToken)
    console.log('[gmail] retry response:', listRes.status)
  }

  if (!listRes.ok) {
    const errBody = await listRes.text()
    console.log('[gmail] list failed:', listRes.status, errBody)
    return NextResponse.json({ error: 'gmail_list_failed', details: errBody }, { status: listRes.status })
  }

  const listData = await listRes.json()
  const messageIds: { id: string }[] = listData.messages || []

  if (messageIds.length === 0) {
    return NextResponse.json({ messages: [], nextPageToken: null })
  }

  // 2. Pour chaque message, récupérer les métadonnées
  const messages = await Promise.all(
    messageIds.map(async ({ id }) => {
      try {
        const res = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        )
        if (!res.ok) return null
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
      } catch {
        return null
      }
    })
  )

  const validMessages = messages.filter(m => m !== null)

  return NextResponse.json({
    messages: validMessages,
    nextPageToken: listData.nextPageToken || null,
  })
}
