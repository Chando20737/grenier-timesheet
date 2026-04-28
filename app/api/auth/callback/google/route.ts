import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state') // user_id

  if (!code || !state) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  // Échanger le code contre un token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/google`,
      grant_type: 'authorization_code',
    }),
  })

  const tokens = await tokenRes.json()

  if (tokens.error) {
    console.error('Token error:', tokens.error)
    return NextResponse.redirect(new URL('/calendrier?error=auth', req.url))
  }

  // Sauvegarder les tokens dans Supabase
  await supabase.from('users').update({
    google_access_token: tokens.access_token,
    google_refresh_token: tokens.refresh_token || null,
  }).eq('id', state)

  return NextResponse.redirect(new URL('/calendrier?google=connected', req.url))
}
