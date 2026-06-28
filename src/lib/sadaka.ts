// Sadaka attribution math: how much sadaka each income stream still owes.
// An obligation row carries amount_owed (>0) tagged with source_income_id;
// a payment row carries amount_given tagged with the income it was paid toward.
// Remaining = owed − given, per income + currency. When it hits 0 the income's
// sadaka "chapter" is closed and should no longer be offered as a pay-toward target.
import type { SadakaEntry } from '@/types/database.types'

export interface IncomeOutstanding { owed: number; given: number; remaining: number; currency: string }

/** Map of `${income_id}|${currency}` → outstanding sadaka for that income. */
export function incomeOutstanding(entries: SadakaEntry[]): Map<string, IncomeOutstanding> {
  const m = new Map<string, IncomeOutstanding>()
  for (const e of entries) {
    if (!e.source_income_id) continue
    const key = `${e.source_income_id}|${e.currency}`
    const cur = m.get(key) ?? { owed: 0, given: 0, remaining: 0, currency: e.currency }
    cur.owed += Number(e.amount_owed)
    cur.given += Number(e.amount_given)
    cur.remaining = Math.max(0, cur.owed - cur.given)
    m.set(key, cur)
  }
  return m
}

/** Total still-due across all currencies for one income (0 if its chapter is closed). */
export function remainingForIncome(out: Map<string, IncomeOutstanding>, incomeId: string): number {
  let r = 0
  for (const [key, v] of out) if (key.startsWith(incomeId + '|')) r += v.remaining
  return r
}

/**
 * An income is "settled" — its sadaka chapter closed — when it had an obligation
 * (owed > 0) and nothing remains. Incomes with no obligation yet stay open.
 */
export function isIncomeSettled(out: Map<string, IncomeOutstanding>, incomeId: string): boolean {
  let owed = 0, remaining = 0
  for (const [key, v] of out) if (key.startsWith(incomeId + '|')) { owed += v.owed; remaining += v.remaining }
  return owed > 0 && remaining === 0
}

// ── self-check: `npx tsx src/lib/sadaka.ts` ──────────────────────────────────
if (typeof require !== 'undefined' && require.main === module) {
  const assert = (c: boolean, m: string) => { if (!c) throw new Error('FAIL: ' + m) }
  const E = (p: Partial<SadakaEntry>): SadakaEntry => ({
    id: '', owner_id: '', source_income_id: null, amount_owed: 0, amount_given: 0,
    currency: 'AED', status: 'pending', is_advance: false, is_joint: false,
    joint_ibrahim_pct: 0.5, date_given: null, recipient_name: null, recipient_type: null,
    location: null, method: null, notes: null, created_at: '', updated_at: '', ...p,
  } as SadakaEntry)
  // Sneaker Con owes 3750, paid 4000 → settled, remaining 0, 250 overpay is advance elsewhere.
  const out = incomeOutstanding([
    E({ source_income_id: 'snk', amount_owed: 3750 }),
    E({ source_income_id: 'snk', amount_given: 4000 }),
    E({ source_income_id: 'shop', amount_owed: 1000 }),     // still open
  ])
  assert(remainingForIncome(out, 'snk') === 0, 'snk should be cleared')
  assert(isIncomeSettled(out, 'snk') === true, 'snk chapter closed')
  assert(remainingForIncome(out, 'shop') === 1000, 'shop still owes 1000')
  assert(isIncomeSettled(out, 'shop') === false, 'shop still open')
  assert(isIncomeSettled(out, 'unknown') === false, 'no-obligation income stays open')
  console.log('sadaka.ts OK')
}
