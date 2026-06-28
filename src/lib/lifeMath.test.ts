// Runnable self-check for lifeMath. No framework — run with:
//   npx tsx src/lib/lifeMath.test.ts   (or node after compile)
// ponytail: assert-based smoke test, the smallest thing that fails if the math breaks.
import assert from 'node:assert'
import { deathDate, daysLeft, weeksLeft, monthsLeft, weeksLived, totalWeeks, percentLived, weekIndexOf, nextOccurrence, weekStartDate, ageAtWeek, weekOfYear } from './lifeMath'

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

// weekIndexOf: a date 10y after birth lands ~week 521 (3652 days / 7)
assert.strictEqual(weekIndexOf(dob, new Date('2000-01-01')), 521)
// a milestone's week must fall inside the lived range
assert.ok(weekIndexOf(dob, new Date('2015-06-15')) < weeksLived(dob, now))

// nextOccurrence: none → the date itself
assert.strictEqual(nextOccurrence(new Date('1990-06-15'), 'none', now).getTime(), new Date('1990-06-15').getTime())
// yearly: 06-15 already passed on 06-28 → rolls to next year
const y = nextOccurrence(new Date('1990-06-15'), 'yearly', now)
assert.strictEqual(y.getFullYear(), 2027)
assert.strictEqual(y.getMonth(), 5) // June
// monthly: day 1 with now=06-28 → next is 07-01
const m = nextOccurrence(new Date('2000-03-01'), 'monthly', now)
assert.strictEqual(m.getMonth(), 6) // July
assert.strictEqual(m.getDate(), 1)

// weekStartDate: week 0 is the dob itself; week 52 is ~1 year later
assert.strictEqual(weekStartDate(dob, 0).getTime(), dob.getTime())
assert.strictEqual(weekStartDate(dob, 52).getFullYear(), 1990)  // 364 days in → still 1990-12-31
// ageAtWeek: week 52 → age 0 (364 days), week 53 → age 1 (371 days)
assert.strictEqual(ageAtWeek(52), 0)
assert.strictEqual(ageAtWeek(53), 1)
assert.strictEqual(ageAtWeek(521), 9)  // ~10y mark sits in age 9 until 365.25d ticks
// weekOfYear: 2026-06-28 is roughly week 26 of the year
const woy = weekOfYear(now)
assert.ok(woy >= 25 && woy <= 27, `weekOfYear unexpected: ${woy}`)

console.log('lifeMath: all assertions passed ✓')
