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

// Holiday enumeration is non-empty across a 2-year span (5 holidays/year).
const hits = islamicHolidaysBetween(new Date('2026-01-01'), new Date('2027-12-31'))
assert.ok(hits.length >= 8, `expected ≥8 holidays over 2y, got ${hits.length}`)

console.log('hijri: all assertions passed ✓ —', hits.length, 'holidays 2026-2027')
