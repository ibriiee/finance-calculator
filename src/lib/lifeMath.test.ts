// Runnable self-check for lifeMath. No framework — run with:
//   npx tsx src/lib/lifeMath.test.ts   (or node after compile)
// ponytail: assert-based smoke test, the smallest thing that fails if the math breaks.
import assert from 'node:assert'
import { deathDate, daysLeft, weeksLeft, monthsLeft, weeksLived, totalWeeks, percentLived } from './lifeMath'

const dob = new Date('1990-01-01')
const now = new Date('2026-06-28')   // ~36.5 years lived
const years = 63                      // death ~2053-01-01

// deathDate adds years exactly
assert.strictEqual(deathDate(dob, years).getFullYear(), 2053)

// lived ≈ 36.5y → 1903 whole weeks
assert.strictEqual(weeksLived(dob, now), 1903)

// total lifespan weeks for 63y: round(63*365.25/7) = 3287
assert.strictEqual(totalWeeks(years), 3287)

// remaining is positive and less than total span in days
const left = daysLeft(dob, years, now)
assert.ok(left > 0 && left < years * 366, `daysLeft out of range: ${left}`)
assert.strictEqual(weeksLeft(dob, years, now), Math.floor(left / 7))
assert.strictEqual(monthsLeft(dob, years, now), Math.floor(left / (365.25 / 12)))

// percent lived ~58% at 36.5/63
const pct = percentLived(dob, years, now)
assert.ok(pct >= 57 && pct <= 59, `percentLived unexpected: ${pct}`)

// clamp at zero / 100 once past death
const past = new Date('2060-01-01')
assert.strictEqual(daysLeft(dob, years, past), 0)
assert.strictEqual(weeksLeft(dob, years, past), 0)
assert.strictEqual(monthsLeft(dob, years, past), 0)
assert.strictEqual(percentLived(dob, years, past), 100)

console.log('lifeMath: all assertions passed ✓')
