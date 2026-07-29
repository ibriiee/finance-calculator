import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * Supabase keepalive (#66).
 *
 * A free-tier Supabase project pauses after a stretch of inactivity. This app is
 * built to survive years unattended, so "nobody opened it for a few weeks" must
 * not be able to take the database down. A weekly cron (vercel.json) hits this
 * route; the query itself is the keepalive — reaching the database is the point,
 * so even an RLS-empty result counts as activity.
 *
 * Uses the ANON key deliberately: no new secret to configure, nothing here reads
 * private data. If SUPABASE_SERVICE_ROLE_KEY happens to be set, the ping is also
 * recorded in system_health so Settings can show when it last ran — but that is
 * a bonus, never a requirement.
 */
export const dynamic = 'force-dynamic'

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) {
    return NextResponse.json({ ok: false, error: 'Supabase env vars missing' }, { status: 500 })
  }

  const at = new Date().toISOString()
  try {
    // The ping. `head: true` keeps it to a count query — cheapest possible touch.
    const anonClient = createClient(url, anon)
    const { error } = await anonClient.from('profiles').select('id', { count: 'exact', head: true })
    // An RLS denial still proves the database answered, which is all we need.
    const reached = !error || error.code === 'PGRST301' || error.code === '42501'
    if (!reached) throw new Error(error!.message)

    // Optional: record it so the app can show its own last-ping date.
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY
    let recorded = false
    if (service) {
      const admin = createClient(url, service, { auth: { persistSession: false } })
      const { error: upErr } = await admin
        .from('system_health')
        .upsert({ id: 'keepalive', last_ping_at: at }, { onConflict: 'id' })
      recorded = !upErr
    }
    return NextResponse.json({ ok: true, pinged_at: at, recorded })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message, at }, { status: 500 })
  }
}
