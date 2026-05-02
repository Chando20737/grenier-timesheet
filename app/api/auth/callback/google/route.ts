import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')

  console.log('=== GOOGLE CALLBACK ===')
  console.log('code:', code ? 'présent' : 'MANQUANT')
  console.log('state (userId):', state)

  if (!code || !state) {
    console.log('ERREUR: code ou state manquant')
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  const redirectUri = 'https://grenier-timesheet.vercel.app/api/auth/callback/google'
  console.log('redirect_uri utilisé:', redirectUri)
  console.log('client_id starts with:', process.env.GOOGLE_CLIENT_ID?.substring(0, 30))
  console.log('client_secret starts with:', process.env.GOOGLE_CLIENT_SECRET?.substring(0, 12))

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  const tokens = await tokenRes.json()
  console.log('tokens response:', JSON.stringify({
    has_access: !!tokens.access_token,
    has_refresh: !!tokens.refresh_token,
    scope: tokens.scope,
    error: tokens.error,
    error_description: tokens.error_description,
  }))

  if (tokens.error) {
    console.error('Token error:', tokens.error, tokens.error_description)
    return NextResponse.redirect(new URL('/calendrier?error=auth', req.url))
  }

  const { error: dbError } = await supabase.from('users').update({
    google_access_token: tokens.access_token,
    google_refresh_token: tokens.refresh_token || null,
  }).eq('id', state)
  console.log('DB update error:', dbError)

  return NextResponse.redirect(new URL('/calendrier?google=connected', req.url))
}
