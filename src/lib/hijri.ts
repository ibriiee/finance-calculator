// Hijri (Islamic) calendar helpers for the Life Tracker.
// No dependency — Intl already ships the Umm al-Qura ('islamic') calendar, which
// is what the Life page already uses for "today in Hijri". We only need the
// reverse direction (Hijri → Gregorian), done by estimating then refining
// against Intl so the result matches the same calendar everywhere in the app.

const MS_DAY = 86_400_000

/** Gregorian Date → Hijri parts (Umm al-Qura, matches Intl elsewhere). */
export function toHijri(d: Date): { y: number; m: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-US-u-ca-islamic', {
    day: 'numeric', month: 'numeric', year: 'numeric',
  }).formatToParts(d)
  const get = (t: string) => Number(parts.find(p => p.type === t)!.value)
  return { y: get('year'), m: get('month'), day: get('day') }
}

// Monotonic day-ordinal of a Hijri date — only used to size the refinement step,
// so the ~29.53 average month length is plenty (the ±window below nails the exact day).
function hijriOrdinal(y: number, m: number, day: number): number {
  return Math.round((y - 1) * 354.367 + (m - 1) * 29.53 + day)
}

/** Hijri (y, m, day) → the Gregorian Date it falls on. */
export function fromHijri(y: number, m: number, day: number): Date {
  const target = hijriOrdinal(y, m, day)
  // Start near 1 Muharram 1 AH (proleptic Gregorian ≈ 19 Jul 622) + estimated days.
  let guess = new Date(Date.UTC(622, 6, 19) + target * MS_DAY)
  // Converge to within a day or two of the real date.
  for (let i = 0; i < 5; i++) {
    const h = toHijri(guess)
    const diff = target - hijriOrdinal(h.y, h.m, h.day)
    if (diff === 0) break
    guess = new Date(guess.getTime() + diff * MS_DAY)
  }
  // Land the exact day.
  for (let off = -5; off <= 5; off++) {
    const c = new Date(guess.getTime() + off * MS_DAY)
    const h = toHijri(c)
    if (h.y === y && h.m === m && h.day === day) return c
  }
  return guess
}

/** Fixed Islamic dates worth highlighting on the grid. */
export const ISLAMIC_HOLIDAYS: { m: number; day: number; label: string; color: string }[] = [
  { m: 1,  day: 1,  label: 'Islamic New Year', color: '#14B8A6' },
  { m: 1,  day: 10, label: 'Ashura',           color: '#06B6D4' },
  { m: 9,  day: 1,  label: 'Ramadan begins',   color: '#A855F7' },
  { m: 10, day: 1,  label: 'Eid al-Fitr',      color: '#EC4899' },
  { m: 12, day: 10, label: 'Eid al-Adha',      color: '#F59E0B' },
]

/** Every preset Islamic holiday falling between two Gregorian dates. */
export function islamicHolidaysBetween(start: Date, end: Date) {
  const out: { date: Date; label: string; color: string }[] = []
  const hStart = toHijri(start).y
  const hEnd = toHijri(end).y
  for (let y = hStart; y <= hEnd; y++) {
    for (const h of ISLAMIC_HOLIDAYS) {
      const d = fromHijri(y, h.m, h.day)
      if (d >= start && d <= end) out.push({ date: d, label: h.label, color: h.color })
    }
  }
  return out
}

/** Next time a Hijri month/day recurs on/after `now` (lunar anniversary). */
export function nextHijriOccurrence(eventDate: Date, now: Date): Date {
  const h = toHijri(eventDate)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const hyNow = toHijri(today).y
  let d = fromHijri(hyNow, h.m, h.day)
  if (d < today) d = fromHijri(hyNow + 1, h.m, h.day)
  return d
}

/** Short Hijri label, e.g. "10 Muharram 1447". */
export function hijriLabel(d: Date): string {
  return new Intl.DateTimeFormat('en-US-u-ca-islamic', {
    day: 'numeric', month: 'long', year: 'numeric',
  }).format(d)
}

// ── self-check: `npx tsx src/lib/hijri.ts` ───────────────────────────────────
// ponytail: one round-trip + one known date; enough to catch a broken refinement.
if (typeof require !== 'undefined' && require.main === module) {
  const assert = (c: boolean, m: string) => { if (!c) throw new Error('FAIL: ' + m) }
  // Round-trip: Gregorian → Hijri → Gregorian lands the same calendar day.
  for (const iso of ['2026-06-28', '2000-01-01', '1990-12-31', '2030-03-15']) {
    const g = new Date(iso + 'T00:00:00Z')
    const h = toHijri(g)
    const back = fromHijri(h.y, h.m, h.day)
    assert(back.toISOString().slice(0, 10) === iso, `round-trip ${iso} → ${back.toISOString()}`)
  }
  // Holiday enumeration is non-empty and ordered within a year span.
  const hits = islamicHolidaysBetween(new Date('2026-01-01'), new Date('2027-12-31'))
  assert(hits.length >= 8, `expected ≥8 holidays over 2y, got ${hits.length}`)
  console.log('hijri.ts OK —', hits.length, 'holidays 2026-2027')
}
