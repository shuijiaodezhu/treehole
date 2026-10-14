import { createBrowserClient } from '@supabase/ssr'

const SUPABASE_URL = 'https://cdmytrvpskkdwjsenidt.supabase.co'
const SUPABASE_KEY = 'sb_publishable_jSjl7WWkrn9AYMGm1EwLjA_v3yvQRo-'

export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_KEY)
}