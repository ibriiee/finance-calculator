// Memento mori math for the Life Tracker module.
// Pure functions, no React — so they're unit-testable (see lifeMath.test.ts).
// All "left" values clamp at 0 once you pass the projected death date.

const MS_PER_DAY = 86_400_000
const DAYS_PER_WEEK = 7
const AVG_DAYS_PER_MONTH = 365.25 / 12   // 30.4375 — calendar-average, good enough

/** Projected death date = dob + N years (same month/day). */
export function deathDate(dob: Date, lifeExpectancyYears: number): Date {
  const d = new Date(dob)
  d.setFullYear(d.getFullYear() + lifeExpectancyYears)
  return d
}

function daysBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / MS_PER_DAY
}

export function daysLeft(dob: Date, years: number, now: Date): number {
  return Math.max(0, Math.floor(daysBetween(now, deathDate(dob, years))))
}

export function weeksLeft(dob: Date, years: number, now: Date): number {
  return Math.floor(daysLeft(dob, years, now) / DAYS_PER_WEEK)
}

export function monthsLeft(dob: Date, years: number, now: Date): number {
  return Math.floor(daysLeft(dob, years, now) / AVG_DAYS_PER_MONTH)
}

/** Whole weeks already lived since birth (for the grid fill). */
export function weeksLived(dob: Date, now: Date): number {
  return Math.max(0, Math.floor(daysBetween(dob, now) / DAYS_PER_WEEK))
}

/** Total weeks in the projected lifespan (grid size). */
export function totalWeeks(years: number): number {
  return Math.round(years * (365.25 / DAYS_PER_WEEK))
}

/** Percentage of projected life lived, 0–100. */
export function percentLived(dob: Date, years: number, now: Date): number {
  const total = daysBetween(dob, deathDate(dob, years))
  if (total <= 0) return 100
  const lived = daysBetween(dob, now)
  return Math.min(100, Math.max(0, Math.round((lived / total) * 100)))
}

/** Which week-cell of the life grid a given date lands in (0-based). */
export function weekIndexOf(dob: Date, date: Date): number {
  return Math.max(0, Math.floor(daysBetween(dob, date) / DAYS_PER_WEEK))
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export type Recurrence = 'none' | 'monthly' | 'yearly'

/** Next time an event fires on/after `now`. Non-recurring → the date itself. */
export function nextOccurrence(eventDate: Date, recurrence: Recurrence, now: Date): Date {
  if (recurrence === 'none') return eventDate
  const today = startOfDay(now)
  const day = eventDate.getDate()
  // ponytail: day-overflow (e.g. 31st in Feb) rolls into the next month — fine for nudges.
  if (recurrence === 'yearly') {
    const m = eventDate.getMonth()
    let d = new Date(today.getFullYear(), m, day)
    if (d < today) d = new Date(today.getFullYear() + 1, m, day)
    return d
  }
  // monthly
  let d = new Date(today.getFullYear(), today.getMonth(), day)
  if (d < today) d = new Date(today.getFullYear(), today.getMonth() + 1, day)
  return d
}
