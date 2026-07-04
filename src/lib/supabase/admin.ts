import { createClient as createSbClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

// Server-only client for privileged writes (rates_cache is service_role-only via RLS).
// NEVER import this in a 'use client' file — it carries the service role key.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createSbClient<Database>(url, key, { auth: { persistSession: false } })
}
