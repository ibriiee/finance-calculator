// Runnable self-check for sadaka. No framework — run with:
//   npx tsx src/lib/sadaka.test.ts
import assert from 'node:assert'
import { incomeOutstanding, remainingForIncome, isIncomeSettled, computeSadaka, sadakaStreak } from './sadaka'
import type { SadakaEntry } from '@/types/database.types'

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
assert.equal(remainingForIncome(out, 'snk'), 0, 'snk should be cleared')
assert.equal(isIncomeSettled(out, 'snk'), true, 'snk chapter closed')
assert.equal(remainingForIncome(out, 'shop'), 1000, 'shop still owes 1000')
assert.equal(isIncomeSettled(out, 'shop'), false, 'shop still open')
assert.equal(isIncomeSettled(out, 'unknown'), false, 'no-obligation income stays open')

// ── computeSadaka: the real-data regression that exposed the cross-income leak ──
// Two contracts, each owes 3750 (owner ibrahim, AED). Contract A paid 3715.42
// (genuinely 34.58 short); Contract B paid exactly 3750 (cleared). The OLD pooled
// allocator mislabelled the 35 onto the wrong card. The engine must keep each
// income's payments on its own obligation.
const near = (a: number, b: number, msg: string) => assert.ok(Math.abs(a - b) < 0.01, `${msg} (got ${a}, want ${b})`)
const O = (income: string, owed: number, t: string) => E({ id: `obl-${income}`, owner_id: 'ib', source_income_id: income, amount_owed: owed, created_at: t })
const P = (income: string, given: number, t: string) => E({ owner_id: 'ib', source_income_id: income, amount_given: given, created_at: t })

const { byId } = computeSadaka([
  O('A', 3750, '2026-06-01'),
  O('B', 3750, '2026-06-02'),
  P('A', 500,    '2026-06-03'), P('A', 150, '2026-06-04'), P('A', 1115, '2026-06-05'),
  P('A', 328,    '2026-06-06'), P('A', 328, '2026-06-07'), P('A', 600,  '2026-06-08'),
  P('A', 130,    '2026-06-09'), P('A', 130, '2026-06-10'), P('A', 184.42, '2026-06-11'),
  P('A', 250,    '2026-06-12'),
  P('B', 3750,   '2026-06-13'),
])
near(byId.get('obl-A')!.remaining, 34.58, 'Contract A still owes 34.58')
near(byId.get('obl-B')!.remaining, 0, 'Contract B fully cleared')
near(byId.get('obl-A')!.given, 3715.42, 'Contract A given is its own payments only')

// Float dust must snap to 0 — payments summing to owed (with binary-float
// residue) must leave remaining EXACTLY 0, else the card leaks into Pending.
const { byId: b3 } = computeSadaka([
  O('D', 3750, '2026-06-01'),
  P('D', 500, '2'), P('D', 150, '3'), P('D', 1115, '4'), P('D', 328, '5'),
  P('D', 328, '6'), P('D', 600, '7'), P('D', 130, '8'), P('D', 130, '9'),
  P('D', 184.42, '10'), P('D', 250, '11'), P('D', 34.58, '12'),  // sums to 3750
])
assert.strictEqual(b3.get('obl-D')!.remaining, 0, 'fully-paid obligation must snap to exactly 0')

// Advance credit (untagged) offsets remaining obligations oldest-first.
const { byId: b2 } = computeSadaka([
  O('X', 1000, '2026-01-01'),
  P('',   400, '2026-01-02'),   // untagged advance
])
near(b2.get('obl-X')!.remaining, 600, 'untagged advance offsets X by 400')

// ── sadakaStreak: consecutive giving months, UTC-bucketed, one-month grace ──
const G = (given: number, date: string) => ({ amount_given: given, date_given: date, created_at: date })
const at = (s: string) => new Date(s + 'T00:00:00Z')
assert.equal(sadakaStreak([G(10, '2026-05-10'), G(10, '2026-06-02'), G(10, '2026-07-01')], at('2026-07-20')), 3, '3 gift-months in a row incl this month')
assert.equal(sadakaStreak([G(10, '2026-05-10'), G(10, '2026-07-01')], at('2026-07-20')), 1, 'a skipped month breaks the run')
assert.equal(sadakaStreak([G(10, '2026-05-10'), G(10, '2026-06-10')], at('2026-07-05')), 2, 'one-month grace keeps a run of 2 alive')
assert.equal(sadakaStreak([G(10, '2026-03-10'), G(10, '2026-04-10')], at('2026-07-20')), 0, 'a run older than last month is inactive')
assert.equal(sadakaStreak([G(0, '2026-07-01')], at('2026-07-20')), 0, 'obligation rows (given=0) never count')
assert.equal(sadakaStreak([G(10, '2025-12-15'), G(10, '2026-01-10')], at('2026-01-20')), 2, 'run crosses the year boundary')
assert.equal(sadakaStreak([], at('2026-07-20')), 0, 'no entries → no streak')

console.log('sadaka: all assertions passed ✓')
