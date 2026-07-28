// Runnable self-check for the .ics builder. No framework — run with:
//   npx tsx src/lib/calendarExport.test.ts
import assert from 'node:assert'
import { buildIcs } from './calendarExport'

const at = (s: string) => new Date(s + 'T00:00:00Z')

const ics = buildIcs([
  { uid: 'zakat-2026', date: '2026-08-01', summary: 'Zakat due', description: 'Hawl complete' },
], at('2026-07-20'))

// Structure
assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'), 'starts with VCALENDAR')
assert.ok(ics.endsWith('END:VCALENDAR'), 'ends with VCALENDAR')
assert.ok(ics.includes('\r\n'), 'uses CRLF line endings')
assert.ok(ics.includes('BEGIN:VEVENT') && ics.includes('END:VEVENT'), 'has an event')

// All-day dates: DTEND is the exclusive next day
assert.ok(ics.includes('DTSTART;VALUE=DATE:20260801'), 'DTSTART is the event day')
assert.ok(ics.includes('DTEND;VALUE=DATE:20260802'), 'DTEND is the day after (exclusive)')

// Month/year rollover must not produce 20260832 etc.
const roll = buildIcs([{ uid: 'x', date: '2026-12-31', summary: 'New year eve' }], at('2026-07-20'))
assert.ok(roll.includes('DTEND;VALUE=DATE:20270101'), 'Dec 31 rolls to Jan 1 next year')
const feb = buildIcs([{ uid: 'x', date: '2026-02-28', summary: 'Feb end' }], at('2026-07-20'))
assert.ok(feb.includes('DTEND;VALUE=DATE:20260301'), '2026 is not a leap year: Feb 28 → Mar 1')

// RFC 5545 TEXT escaping — a comma/semicolon in a name must not split the field
const esc = buildIcs([
  { uid: 'loan-1', date: '2026-09-05', summary: 'Repay Ali, Mohammed; cash', description: 'line1\nline2' },
], at('2026-07-20'))
assert.ok(esc.includes('SUMMARY:Repay Ali\\, Mohammed\\; cash'), 'comma and semicolon escaped')
assert.ok(esc.includes('DESCRIPTION:line1\\nline2'), 'newline escaped')

// Long summaries fold at 75 octets with CRLF + space (else calendars reject the file)
const long = buildIcs([{ uid: 'g', date: '2026-10-01', summary: 'G'.repeat(200) }], at('2026-07-20'))
assert.ok(long.split('\r\n').every(l => l.length <= 75), 'every line folded to <= 75 chars')

// Empty calendar is still structurally valid
const empty = buildIcs([], at('2026-07-20'))
assert.ok(empty.includes('BEGIN:VCALENDAR') && !empty.includes('BEGIN:VEVENT'), 'no events, still valid')

console.log('calendarExport: all assertions passed ✓')
