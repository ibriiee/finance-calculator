// Finance dates → .ics file (zakat due, loan due dates, goal deadlines).
// A downloaded file, NOT a subscribable URL: a live feed would need a public
// tokenized endpoint exposing financial dates, which is a security decision the
// owner has to make. A download has zero auth surface and no infra to decay,
// which is what the 2-5-year-unattended rule actually cares about (UPGRADES #59).
// Client-only: Blob + anchor download, no external deps.

export interface CalEvent {
  /** Stable-ish unique key, e.g. `loan-<uuid>` */
  uid: string
  /** All-day date, YYYY-MM-DD */
  date: string
  summary: string
  description?: string
}

/** RFC 5545 TEXT escaping: backslash, semicolon, comma, newline. Order matters. */
function escText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/** Fold lines at 75 octets with CRLF + single space, per RFC 5545 §3.1. */
function fold(line: string): string {
  if (line.length <= 75) return line
  const parts: string[] = [line.slice(0, 75)]
  let rest = line.slice(75)
  while (rest.length > 74) { parts.push(' ' + rest.slice(0, 74)); rest = rest.slice(74) }
  if (rest.length) parts.push(' ' + rest)
  return parts.join('\r\n')
}

const ymd = (isoDate: string) => isoDate.replace(/-/g, '')

/** Day after `isoDate`, as YYYYMMDD — all-day DTEND is exclusive. */
function nextYmd(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().split('T')[0].replace(/-/g, '')
}

/** Build a valid VCALENDAR string. Pure — unit-tested in calendarExport.test.ts. */
export function buildIcs(events: CalEvent[], now: Date = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Mizan//Finance//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Mizan — Finance dates',
  ]
  for (const e of events) {
    lines.push(
      'BEGIN:VEVENT',
      fold(`UID:${e.uid}@mizan`),
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ymd(e.date)}`,
      `DTEND;VALUE=DATE:${nextYmd(e.date)}`,
      fold(`SUMMARY:${escText(e.summary)}`),
    )
    if (e.description) lines.push(fold(`DESCRIPTION:${escText(e.description)}`))
    // A day-before reminder is the whole point of putting these in a calendar.
    lines.push(
      'BEGIN:VALARM', 'ACTION:DISPLAY', fold(`DESCRIPTION:${escText(e.summary)}`),
      'TRIGGER:-P1D', 'END:VALARM',
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

export function downloadIcs(events: CalEvent[], filename = 'mizan-finance.ics') {
  const blob = new Blob([buildIcs(events)], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click()
  document.body.removeChild(a); URL.revokeObjectURL(url)
}
