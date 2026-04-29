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

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: '785771322332-oiflm3ig5j55uinj1geu7tcimsn7s28t.apps.googleusercontent.com',
      client_secret: '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',
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
