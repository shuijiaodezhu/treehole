import { createBrowserClient } from '@supabase/ssr'

const SUPABASE_URL = 'https://cdmytrvpskkdwjsenidt.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNkbXl0cnZwc2trZHdqc2VuaWR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4ODE1MDQsImV4cCI6MjEwNzQ1NzUwNH0.xqcHSmAJ-dw-toxDL1jsi5N51uJg53zOIoJcJjbpsxM'

export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_KEY)
}