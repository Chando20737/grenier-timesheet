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
  console.log('APP_URL:', process.env.NEXT_PUBLIC_APP_URL)
  console.log('CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? 'présent' : 'MANQUANT')
  console.log('CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? 'présent' : 'MANQUANT')

  if (!code || !state) {
    console.log('ERREUR: code ou state manquant')
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/google`
  console.log('redirect_uri utilisé:', redirectUri)

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
  console.log('tokens response:', JSON.stringify(tokens))

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
