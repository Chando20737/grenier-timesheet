import { createClient } from '@supabase/supabase-js'

// Client admin (clé SECRÈTE) — contourne les politiques RLS.
// ⚠️ SERVEUR SEULEMENT. Ne jamais importer ce module dans un composant client :
// SUPABASE_SECRET_KEY n'est pas exposée au navigateur et donne un accès complet à la BD.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY!

export const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})
