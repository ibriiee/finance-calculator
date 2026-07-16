#!/usr/bin/env node
// ============================================================
// MIZAN — brain snapshot export
// Writes ../snapshot.md: goal %, sadaka owed, zakat status, this
// month's income. Read by the Brain (domains/Personal/Finance/
// MEMORY.md) on demand — never duplicate these numbers by hand.
// Run:  npm run snapshot
// Needs (from .env.local):  NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// Deliberately excludes "cash in hand" / net worth: that figure
// is the multi-source "yours to keep" calc in dashboard/page.tsx
// with 3 prior shipped bugs (currency folding + ownership splits).
// Re-deriving it here would be a second copy that can drift from
// the real one. Only the simple, single-source numbers are
// reproduced below.
// ============================================================
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

function loadEnv() {
  const env = { ...process.env }
  try {
    const raw = readFileSync(join(ROOT, '.env.local'), 'utf8')
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch { /* fall back to process.env */ }
  return env
}

const IBRAHIM_EMAIL = 'ibrahim_naeem@outlook.com'

async function main() {
  const env = loadEnv()
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || key.startsWith('PASTE_')) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
    process.exit(1)
  }
  const db = createClient(url, key, { auth: { persistSession: false } })

  const { data: profile } = await db.from('profiles').select('id, display_name').eq('email', IBRAHIM_EMAIL).single()
  if (!profile) { console.error(`No profile found for ${IBRAHIM_EMAIL}`); process.exit(1) }
  const myId = profile.id

  const { data: rate } = await db.from('rates_cache').select('rate_value').eq('rate_type', 'pkr_to_aed').single()
  const pkrToAed = Number(rate?.rate_value) || 0.0132
  const toAed = (amount, currency) => currency === 'PKR' ? amount * pkrToAed : amount

  // Sadaka pending — same aggregate as dashboard's sadakaPending()
  const { data: sadakaEntries } = await db.from('sadaka_entries')
    .select('amount_owed, amount_given, currency')
    .eq('owner_id', myId).eq('is_joint', false)
  const sadakaPending = (cur) => {
    const list = (sadakaEntries ?? []).filter(e => e.currency === cur)
    const owed = list.reduce((s, e) => s + Number(e.amount_owed), 0)
    const given = list.reduce((s, e) => s + Number(e.amount_given), 0)
    return Math.max(0, owed - given)
  }
  const sadakaOwedAed = sadakaPending('AED')
  const sadakaOwedPkr = sadakaPending('PKR')

  // Active goals + contribution totals
  const { data: goals } = await db.from('financial_goals')
    .select('id, name, target_amount, currency')
    .or(`owner_id.eq.${myId},goal_type.eq.joint`).eq('is_active', true)
  const goalLines = []
  for (const g of goals ?? []) {
    const { data: contribs } = await db.from('goal_contributions').select('amount').eq('goal_id', g.id)
    const total = (contribs ?? []).reduce((s, c) => s + Number(c.amount), 0)
    const pct = g.target_amount > 0 ? Math.round((total / g.target_amount) * 100) : 0
    goalLines.push(`- ${g.name}: ${pct}% (${total.toLocaleString()} / ${g.target_amount.toLocaleString()} ${g.currency})`)
  }

  // Zakat — latest snapshot, direct read
  const { data: zakat } = await db.from('zakat_snapshots')
    .select('is_wajib, zakat_due_aed, snapshot_year')
    .eq('owner_id', myId).order('created_at', { ascending: false }).limit(1).single()

  // This month's received income — simple filter, not the fragile cash-in-hand chain
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
  const { data: income } = await db.from('income_projects')
    .select('amount, currency, ownership, status, actual_received_date')
    .neq('status', 'cancelled').in('ownership', ['ibrahim', 'shared'])
  const monthReceivedAed = (income ?? [])
    .filter(i => i.status === 'received' && i.actual_received_date && new Date(i.actual_received_date) >= monthStart)
    .reduce((s, i) => s + toAed(Number(i.amount) * (i.ownership === 'shared' ? 0.5 : 1), i.currency), 0)

  const now = new Date().toISOString()
  const md = `# Mizan — snapshot (auto-generated, do not hand-edit)

Generated: ${now}
Run \`npm run snapshot\` in Finance Project to refresh. Read by the Brain on demand —
see domains/Personal/Finance/MEMORY.md. Not committed to git (real financial data).

## Sadaka pending
- AED: ${sadakaOwedAed.toLocaleString()}
- PKR: ${sadakaOwedPkr.toLocaleString()}

## Active goals
${goalLines.length ? goalLines.join('\n') : '- none active'}

## Zakat
- ${zakat ? `${zakat.is_wajib ? 'Wajib' : 'Not due'} — ${Number(zakat.zakat_due_aed ?? 0).toLocaleString()} AED (snapshot year ${zakat.snapshot_year})` : 'no snapshot recorded yet'}

## This month — income received
- ${monthReceivedAed.toLocaleString()} AED

## Not included (by design)
- Cash-in-hand / net worth — lives only in the dashboard's verified calc (3 prior bugs
  fixed there; not re-derived here to avoid a second copy drifting from the real one).
`

  writeFileSync(join(ROOT, 'snapshot.md'), md)
  console.log('snapshot.md written.')
}

main().catch(e => { console.error(e); process.exit(1) })
