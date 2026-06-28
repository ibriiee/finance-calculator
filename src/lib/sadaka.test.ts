// Runnable self-check for sadaka. No framework — run with:
//   npx tsx src/lib/sadaka.test.ts
import assert from 'node:assert'
import { incomeOutstanding, remainingForIncome, isIncomeSettled } from './sadaka'
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

console.log('sadaka: all assertions passed ✓')
