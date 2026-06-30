#!/usr/bin/env node
// ============================================================
// MIZAN — restore a backup into a (fresh) project
// Run:  npm run restore -- backups/mizan-backup-YYYY-MM-DD-HH-MM-SS.json
//
// PREREQUISITES on the target project:
//   1. supabase/FRESH-INSTALL.sql has been run (tables + RLS exist).
//   2. The two auth users already exist (Authentication > Users),
//      with the SAME emails as in the backup. Their profiles are
//      auto-created by the on_auth_user_created trigger.
//
// What it does:
//   • Reads the new project's profiles to learn the NEW user ids.
//   • Builds oldId -> email -> newId, then walks every backed-up row
//     and rewrites any field whose value is an OLD user id to the
//     matching NEW id. All other PKs/FKs are preserved as-is.
//   • Upserts rows table-by-table in FK-safe order (service_role,
//     so RLS is bypassed).
//
// Idempotent: upsert on primary key, so re-running is safe.
// ============================================================
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
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
  } catch { /* */ }
  return env
}

// Same FK-safe order as backup. profiles first (upsert settings onto
// the trigger-created rows), then everything that references users.
const ORDER = [
  'profiles', 'sadaka_recipients', 'income_projects', 'sadaka_entries',
  'brother_ledger', 'ledger_settlements', 'external_ledger',
  'joint_accounts', 'joint_account_txns', 'loans', 'loan_repayments',
  'financial_goals', 'goal_contributions', 'shared_costs',
  'zakat_snapshots', 'wasiyya_entries', 'savings_entries', 'expenses', 'rates_cache',
]

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function main() {
  const file = process.argv[2]
  if (!file) { console.error('Usage: npm run restore -- <backup.json>'); process.exit(1) }

  const env = loadEnv()
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || key.startsWith('PASTE_')) {
    console.error('✗ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
    process.exit(1)
  }
  const db = createClient(url, key, { auth: { persistSession: false } })
  const dump = JSON.parse(readFileSync(join(ROOT, file), 'utf8'))

  // --- build oldId -> newId via email ---
  const { data: newProfiles, error: pErr } = await db.from('profiles').select('id,email')
  if (pErr) { console.error('✗ Cannot read target profiles:', pErr.message); process.exit(1) }
  const emailToNewId = new Map((newProfiles ?? []).map(p => [String(p.email).toLowerCase(), p.id]))
  const oldIdToNewId = new Map()
  for (const u of (dump._meta?.userMap ?? [])) {
    const newId = emailToNewId.get(String(u.email).toLowerCase())
    if (newId) oldIdToNewId.set(u.id, newId)
    else console.warn(`  ! No target user for email ${u.email} — rows owned by them will be skipped`)
  }
  console.log(`Remapping ${oldIdToNewId.size} user id(s):`)
  for (const [o, n] of oldIdToNewId) console.log(`  ${o}  ->  ${n}`)

  const knownOldUserIds = new Set(oldIdToNewId.keys())
  const remapRow = (row) => {
    const out = { ...row }
    let skip = false
    for (const k of Object.keys(out)) {
      const v = out[k]
      if (typeof v === 'string' && UUID_RE.test(v) && knownOldUserIds.has(v)) {
        const mapped = oldIdToNewId.get(v)
        if (!mapped) { skip = true; break }
        out[k] = mapped
      }
    }
    return skip ? null : out
  }

  for (const table of ORDER) {
    const rows = dump.tables?.[table] ?? []
    if (!rows.length) { console.log(`  · ${table}: 0 (nothing to restore)`); continue }
    const mapped = rows.map(remapRow).filter(Boolean)

    if (table === 'profiles') {
      // Rows already exist (trigger). Upsert to restore settings; never
      // change the PK — match the trigger-created row by id.
      for (const p of mapped) {
        const { id, email, ...settings } = p
        const { error } = await db.from('profiles').update(settings).eq('id', id)
        if (error) console.warn(`  ! profiles ${id}: ${error.message}`)
      }
      console.log(`  ✓ profiles: ${mapped.length} updated`)
      continue
    }

    const { error } = await db.from(table).upsert(mapped, { onConflict: 'id' })
    if (error) console.error(`  ✗ ${table}: ${error.message}`)
    else console.log(`  ✓ ${table}: ${mapped.length} restored`)
  }

  console.log('\n✓ Restore finished. Open the app and verify your data, then re-run any')
  console.log('  not-yet-given sadaka checks if numbers look off.')
}

main().catch(e => { console.error(e); process.exit(1) })
