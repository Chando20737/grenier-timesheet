import { createClient } from '@supabase/supabase-js'

const url = 'https://qnrfzfwvddrgyscnxfhh.supabase.co'
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFucmZ6Znd2ZGRyZ3lzY254ZmhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQzMDAxLTM1MDNjNDg0M2M3NWEyYTEiLCJleHAiOjIwNTk4NzYxLTM1MDNjNDg0M2M3NWEyYTF9'

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    storageKey: 'sb-grenier-auth-token',
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
})

export const supabaseAdmin = createClient(url, key)
