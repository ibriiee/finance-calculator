// Runnable self-check for sadaka. No framework — run with:
//   npx tsx src/lib/sadaka.test.ts
import assert from 'node:assert'
import { incomeOutstanding, remainingForIncome, isIncomeSettled, computeSadaka } from './sadaka'
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

// Advance credit (untagged) offsets remaining obligations oldest-first.
const { byId: b2 } = computeSadaka([
  O('X', 1000, '2026-01-01'),
  P('',   400, '2026-01-02'),   // untagged advance
])
near(b2.get('obl-X')!.remaining, 600, 'untagged advance offsets X by 400')

console.log('sadaka: all assertions passed ✓')
