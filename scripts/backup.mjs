#!/usr/bin/env node
// ============================================================
// MIZAN — full data backup
// Dumps every table to a timestamped JSON file in ./backups/.
// Run:  npm run backup
// Needs (from .env.local):  NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// Why service_role: it bypasses RLS, so we get ALL rows for BOTH
// users in one pass. Keep the backup file private — it contains
// everyone's financial data.
//
// The dump preserves every row's original primary key, and records
// the profiles id<->email map. restore.mjs uses that map to remap
// user UUIDs when loading into a fresh project (where the auth users
// get brand-new ids). See docs/DISASTER-RECOVERY.md.
// ============================================================
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

// --- tiny .env.local loader (no dotenv dependency) ---
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

// Tables in FK-safe order (parents before children). Internal FKs
// (source_income_id, recipient_id, account_id, loan_id, goal_id …)
// reference rows by their own preserved PKs, so this order is what
// restore needs too.
const TABLES = [
  'profiles',
  'sadaka_recipients',
  'income_projects',
  'sadaka_entries',
  'brother_ledger',
  'ledger_settlements',
  'external_ledger',
  'joint_accounts',
  'joint_account_txns',
  'loans',
  'loan_repayments',
  'financial_goals',
  'goal_contributions',
  'shared_costs',
  'zakat_snapshots',
  'wasiyya_entries',
  'savings_entries',
  'expenses',
  'life_events',
  'rates_cache',
]

async function main() {
  const env = loadEnv()
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || key.startsWith('PASTE_')) {
    console.error('✗ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
    process.exit(1)
  }
  const db = createClient(url, key, { auth: { persistSession: false } })

  const dump = { _meta: { app: 'mizan', takenAt: new Date().toISOString(), projectUrl: url }, tables: {} }
  let total = 0
  for (const t of TABLES) {
    const { data, error } = await db.from(t).select('*')
    if (error) {
      // A table missing just means that migration hasn't run — warn, don't abort.
      console.warn(`  ! ${t}: ${error.message} (skipped)`)
      dump.tables[t] = []
      continue
    }
    dump.tables[t] = data
    total += data.length
    console.log(`  ✓ ${t}: ${data.length}`)
  }

  // id<->email map for restore remapping (profiles has both)
  dump._meta.userMap = (dump.tables.profiles ?? []).map(p => ({ id: p.id, email: p.email }))

  const dir = join(ROOT, 'backups')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  const file = join(dir, `mizan-backup-${stamp}.json`)
  writeFileSync(file, JSON.stringify(dump, null, 2))
  console.log(`\n✓ Backup complete — ${total} rows across ${TABLES.length} tables`)
  console.log(`  → ${file}`)
  console.log('  Keep this file private and off the project repo (it is git-ignored).')
}

main().catch(e => { console.error(e); process.exit(1) })
