import { createClient } from '@supabase/supabase-js'

const url = 'https://qnrfzfwvddrgyscnxfhh.supabase.co'
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFucmZ6Znd2ZGRyZ3lzY254ZmhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMTczOTUsImV4cCI6MjA5Mjg5MzM5NX0.bxiwa54-SECHk8361Gt0MZjV7ktAmtAh67GuKMkHvYI'

export const supabase = createClient(url, key)
export const supabaseAdmin = createClient(url, key)
