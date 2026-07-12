// Runnable self-check for hijri. No framework — run with:
//   npx tsx src/lib/hijri.test.ts
import assert from 'node:assert'
import { toHijri, fromHijri, islamicHolidaysBetween } from './hijri'

// Round-trip: Gregorian → Hijri → Gregorian lands the same calendar day.
for (const iso of ['2026-06-28', '2000-01-01', '1990-12-31', '2030-03-15']) {
  const g = new Date(iso + 'T00:00:00Z')
  const h = toHijri(g)
  const back = fromHijri(h.y, h.m, h.day)
  assert.equal(back.toISOString().slice(0, 10), iso, `round-trip ${iso} → ${back.toISOString()}`)
}

// Holiday enumeration is non-empty across a 2-year span (6 entries/year).
const hits = islamicHolidaysBetween(new Date('2026-01-01'), new Date('2027-12-31'))
assert.ok(hits.length >= 10, `expected ≥10 holidays over 2y, got ${hits.length}`)

// Ramadan is a SPAN that runs the whole month: its exclusive end is 1 Shawwal,
// i.e. the same day Eid al-Fitr starts, 29–30 days after 1 Ramadan.
const ramadan = hits.find(h => h.label.startsWith('Ramadan'))!
const fitr = hits.find(h => h.label === 'Eid al-Fitr')!
assert.ok(ramadan.end, 'Ramadan must carry an end date')
assert.equal(ramadan.end!.toDateString(), fitr.date.toDateString(), 'Ramadan ends where Eid al-Fitr begins')
const len = Math.round((ramadan.end!.getTime() - ramadan.date.getTime()) / 86_400_000)
assert.ok(len === 29 || len === 30, `Ramadan span should be 29–30 days, got ${len}`)

console.log('hijri: all assertions passed ✓ —', hits.length, 'holidays 2026-2027, Ramadan', len, 'days')
