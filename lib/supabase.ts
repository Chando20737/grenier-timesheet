import { createClient } from '@supabase/supabase-js'

// Client public (clé « publishable »/anon) — protégé par les politiques RLS.
// Utilisable côté navigateur ; les variables NEXT_PUBLIC_* sont exposées au client.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)
