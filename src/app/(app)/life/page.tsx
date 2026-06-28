'use client'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import ModuleHeader from '@/components/shared/ModuleHeader'
import EmptyState from '@/components/shared/EmptyState'
import LoadingSpinner from '@/components/shared/LoadingSpinner'
import { Hourglass, Settings, Bell, X, CalendarDays } from 'lucide-react'
import {
  deathDate, daysLeft, weeksLeft, monthsLeft, weeksLived, totalWeeks, percentLived,
  weekIndexOf, nextOccurrence, weekStartDate, ageAtWeek, weekOfYear,
} from '@/lib/lifeMath'
import { islamicHolidaysBetween, toHijri, fromHijri, hijriLabel, ISLAMIC_HOLIDAYS } from '@/lib/hijri'
import type { LifeEvent } from '@/types/database.types'

type View = 'all' | 'plain' | 'decades'
const VIEWS: { key: View; label: string }[] = [
  { key: 'all', label: 'Events' },
  { key: 'plain', label: 'Plain' },
  { key: 'decades', label: 'Decades' },
]
// Subtle per-decade palette for the "Decades" view (index = age / 10).
const DECADE_COLORS = ['#C9A84C', '#D4A017', '#10B981', '#3B82F6', '#A855F7', '#EC4899', '#EF4444', '#14B8A6', '#F59E0B', '#8B5CF6', '#06B6D4', '#84CC16']
const MS_DAY = 86_400_000

export default function LifePage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [dob, setDob] = useState<string | null>(null)
  const [years, setYears] = useState(63)
  const [events, setEvents] = useState<LifeEvent[]>([])
  const [view, setView] = useState<View>('all')
  const [selected, setSelected] = useState<number | null>(null)
  const [yearExpanded, setYearExpanded] = useState(false)
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [showIslamic, setShowIslamic] = useState(false)

  useEffect(() => { setShowIslamic(localStorage.getItem('mizan_islamic_dates') !== '0') }, [])

  // Islamic markers across the whole lifespan: preset holidays (toggle) + any
  // Hijri-recurring events (e.g. a Zakat date) repeated on every lunar anniversary.
  // Memoised — enumerating ~60 Hijri years hits Intl a few thousand times.
  const markersByWeek = useMemo(() => {
    const m = new Map<number, { label: string; color: string }[]>()
    if (!dob) return m
    const dobD = new Date(dob)
    const death = deathDate(dobD, years)
    const total = totalWeeks(years)
    const push = (date: Date, label: string, color: string) => {
      const wi = weekIndexOf(dobD, date)
      if (wi < 0 || wi >= total) return
      const arr = m.get(wi) ?? []
      arr.push({ label, color }); m.set(wi, arr)
    }
    if (showIslamic) for (const h of islamicHolidaysBetween(dobD, death)) push(h.date, h.label, h.color)
    for (const ev of events.filter(e => e.recurrence === 'hijri_yearly')) {
      const h = toHijri(new Date(ev.event_date))
      for (let y = toHijri(dobD).y; y <= toHijri(death).y; y++) push(fromHijri(y, h.m, h.day), ev.label, ev.color)
    }
    return m
  }, [dob, years, events, showIslamic])
  function toggleIslamic(v: boolean) { setShowIslamic(v); localStorage.setItem('mizan_islamic_dates', v ? '1' : '0') }

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const [{ data: prof }, { data: evs }] = await Promise.all([
        supabase.from('profiles').select('date_of_birth, life_expectancy_years').eq('id', user!.id).single(),
        supabase.from('life_events').select('*').eq('owner_id', user!.id).order('event_date'),
      ])
      setDob((prof as any)?.date_of_birth ?? null)
      setYears((prof as any)?.life_expectancy_years ?? 63)
      setEvents((evs as LifeEvent[]) ?? [])
      setLoading(false)
    })()
  }, [])

  if (loading) return <LoadingSpinner />

  if (!dob) {
    return (
      <div className="flex flex-col gap-4 p-4 animate-slide-up">
        <ModuleHeader title="Life Tracker" subtitle="Remember death — live with intention" back={false} />
        <EmptyState icon={Hourglass} title="Set your date of birth"
          description="Add your birth date in Life Settings to see how much of this life remains, in shaa Allah."
          action={
            <Link href="/life/settings" className="px-4 py-2 rounded-xl text-sm font-semibold inline-flex items-center gap-2"
              style={{ background: 'var(--gold)', color: '#0a0a0a' }}>
              <Settings size={14} /> Open Settings
            </Link>
          } />
      </div>
    )
  }

  const dobDate = new Date(dob)
  const now = new Date()
  const death = deathDate(dobDate, years)
  const dLeft = daysLeft(dobDate, years, now)
  const wLeft = weeksLeft(dobDate, years, now)
  const mLeft = monthsLeft(dobDate, years, now)
  const pct = percentLived(dobDate, years, now)
  const lived = weeksLived(dobDate, now)
  const total = totalWeeks(years)
  const remainingCells = Math.max(0, total - lived)

  // Islamic holidays (if toggled) + Hijri-recurring events, as dated markers in a range.
  function eventsBetween(start: Date, end: Date): { date: Date; label: string; color: string }[] {
    const out: { date: Date; label: string; color: string }[] = []
    if (showIslamic) out.push(...islamicHolidaysBetween(start, end))
    for (const ev of events.filter(e => e.recurrence === 'hijri_yearly')) {
      const h = toHijri(new Date(ev.event_date))
      for (let yy = toHijri(start).y; yy <= toHijri(end).y; yy++) {
        const d = fromHijri(yy, h.m, h.day)
        if (d >= start && d <= end) out.push({ date: d, label: ev.label, color: ev.color })
      }
    }
    return out.sort((a, b) => a.date.getTime() - b.date.getTime())
  }

  // Hijri today + Hijri age (no dep — Intl does the Islamic calendar).
  const hijriToday = new Intl.DateTimeFormat('en-US-u-ca-islamic', { day: 'numeric', month: 'long', year: 'numeric' }).format(now)
  const hijriAge = Math.floor(((now.getTime() - dobDate.getTime()) / MS_DAY) / 354.367)

  // This calendar year progress
  const yearWeek = Math.min(52, weekOfYear(now))

  // Map each event to its week-cell. Last write wins.
  const eventByWeek = new Map<number, LifeEvent>()
  for (const ev of events) {
    const wi = weekIndexOf(dobDate, new Date(ev.event_date))
    if (wi < total) eventByWeek.set(wi, ev)
  }

  const upcoming = events
    .filter(e => e.kind === 'reminder' || e.kind === 'intention')
    .map(e => ({ ev: e, next: nextOccurrence(new Date(e.event_date), e.recurrence, now) }))
    .filter(x => x.next.getTime() >= new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime())
    .sort((a, b) => a.next.getTime() - b.next.getTime())
    .slice(0, 8)

  const counters = [
    { label: 'Days left', value: dLeft },
    { label: 'Weeks left', value: wLeft },
    { label: 'Months left', value: mLeft },
  ]
  const daysAway = (d: Date) => Math.round((d.getTime() - now.getTime()) / MS_DAY)

  function cellStyle(i: number): React.CSSProperties {
    const isLived = i < lived
    const isNow = i === lived
    if (isNow) return { background: 'var(--gold)', outline: '1.5px solid var(--text-primary)', outlineOffset: '0px' }

    if (view === 'plain') return { background: isLived ? 'var(--gold)' : 'var(--border)' }

    if (view === 'decades') {
      if (!isLived) return { background: 'var(--border)' }
      // One solid colour per 10-year band (matches the legend), not per year.
      return { background: DECADE_COLORS[Math.floor(ageAtWeek(i) / 10) % DECADE_COLORS.length] }
    }

    // 'all' — events overlay, then Islamic markers
    const ev = eventByWeek.get(i)
    if (ev) return isLived ? { background: ev.color } : { background: 'transparent', boxShadow: `inset 0 0 0 1.5px ${ev.color}` }
    const mk = markersByWeek.get(i)?.[0]
    if (mk) return { background: isLived ? mk.color : 'transparent', boxShadow: `inset 0 0 0 1.5px ${mk.color}` }
    return { background: isLived ? 'var(--gold)' : 'var(--border)' }
  }

  // Selected-week detail
  const sel = selected
  const selStart = sel !== null ? weekStartDate(dobDate, sel) : null
  const selEnd = selStart ? new Date(selStart.getTime() + 6 * MS_DAY) : null
  const selEvent = sel !== null ? eventByWeek.get(sel) : undefined

  return (
    <div className="flex flex-col gap-4 p-4 animate-slide-up">
      <ModuleHeader title="Life Tracker" subtitle="Remember death — live with intention" back={false}
        action={
          <Link href="/life/settings" aria-label="Life settings"
            className="p-2 rounded-lg hover:bg-[var(--surface-2)] transition-colors">
            <Settings size={18} style={{ color: 'var(--text-secondary)' }} />
          </Link>
        } />

      {/* Counters */}
      <div className="grid grid-cols-3 gap-3">
        {counters.map(c => (
          <div key={c.label} className="card p-3 text-center">
            <p className="font-display text-2xl font-semibold text-gold-gradient leading-tight">{c.value.toLocaleString()}</p>
            <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>{c.label}</p>
          </div>
        ))}
      </div>

      {/* % lived + Hijri */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Life lived</span>
          <span className="text-sm font-bold" style={{ color: 'var(--gold)' }}>{pct}%</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
          <div className="h-full rounded-full animate-fill" style={{ width: `${pct}%`, background: 'var(--gold)' }} />
        </div>
        <p className="text-[11px] mt-2" style={{ color: 'var(--text-muted)' }}>
          Born {dobDate.toLocaleDateString()} · projected {death.toLocaleDateString()} (age {years}). Only Allah knows the true term.
        </p>
        <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
          Today: {hijriToday} · ~{hijriAge} Hijri years lived
        </p>
      </div>

      {/* This year — year strip (glance) that expands into a real month calendar */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => setYearExpanded(e => !e)}
            className="flex items-center gap-1.5 text-sm font-semibold"
            style={{ color: 'var(--text-primary)' }}>
            <CalendarDays size={15} style={{ color: 'var(--gold)' }} />
            {now.getFullYear()}
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{yearExpanded ? 'calendar ▲' : 'calendar ▼'}</span>
          </button>
          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{yearWeek} / 52 weeks</span>
        </div>
        {!yearExpanded ? (
          <div className="grid gap-[3px]" style={{ gridTemplateColumns: 'repeat(26, minmax(0, 1fr))' }}>
            {Array.from({ length: 52 }).map((_, i) => (
              <div key={i} className="aspect-square rounded-[1px]"
                style={{ background: i < yearWeek ? 'var(--gold)' : 'var(--border)' }} />
            ))}
          </div>
        ) : (() => {
          // Real month calendar: navigable, today highlighted, Islamic dates marked.
          const y = calMonth.getFullYear(), m = calMonth.getMonth()
          const first = new Date(y, m, 1)
          const daysInMonth = new Date(y, m + 1, 0).getDate()
          const lead = (first.getDay() + 6) % 7   // Mon-first offset
          const monthMarks = eventsBetween(first, new Date(y, m, daysInMonth))
          const markByDay = new Map<number, { label: string; color: string }>()
          for (const mk of monthMarks) markByDay.set(mk.date.getDate(), mk)
          return (
            <div className="mt-1">
              <div className="flex items-center justify-between mb-2">
                <button onClick={() => setCalMonth(new Date(y, m - 1, 1))} className="px-2 py-1 rounded-lg" style={{ color: 'var(--text-secondary)' }}>◀</button>
                <span className="text-sm font-semibold">{first.toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
                <button onClick={() => setCalMonth(new Date(y, m + 1, 1))} className="px-2 py-1 rounded-lg" style={{ color: 'var(--text-secondary)' }}>▶</button>
              </div>
              <div className="grid grid-cols-7 gap-1 mb-1">
                {['M','T','W','T','F','S','S'].map((d, i) => (
                  <span key={i} className="text-center text-[10px]" style={{ color: 'var(--text-muted)' }}>{d}</span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: lead }).map((_, i) => <div key={`b${i}`} />)}
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                  const date = new Date(y, m, day)
                  const isToday = date.toDateString() === now.toDateString()
                  const mk = markByDay.get(day)
                  return (
                    <div key={day} title={mk?.label} className="aspect-square flex items-center justify-center rounded-lg text-[11px] relative"
                      style={{
                        background: isToday ? 'var(--gold)' : 'var(--surface-2)',
                        color: isToday ? '#0a0a0a' : date < now ? 'var(--text-muted)' : 'var(--text-secondary)',
                        boxShadow: mk ? `inset 0 0 0 1.5px ${mk.color}` : undefined,
                      }}>
                      {day}
                      {mk && <span className="absolute bottom-0.5 w-1 h-1 rounded-full" style={{ background: mk.color }} />}
                    </div>
                  )
                })}
              </div>
              {monthMarks.length > 0 && (
                <div className="flex flex-col gap-1 mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                  {monthMarks.map((mk, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: mk.color }} />
                      <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{mk.date.getDate()} {first.toLocaleString('default', { month: 'short' })} · {mk.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })()}
      </div>

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Bell size={15} style={{ color: 'var(--gold)' }} />
            <h3 className="text-sm font-semibold">Upcoming</h3>
          </div>
          <div className="flex flex-col gap-2">
            {upcoming.map(({ ev, next }) => {
              const away = daysAway(next)
              return (
                <div key={ev.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: ev.color }} />
                    <span className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>{ev.label}</span>
                    {ev.recurrence !== 'none' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                        {ev.recurrence === 'hijri_yearly' ? 'Hijri' : ev.recurrence}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] shrink-0 ml-2" style={{ color: 'var(--text-muted)' }}>
                    {next.toLocaleDateString()} · {away === 0 ? 'today' : `${away}d`}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Life in weeks — interactive grid */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold">Your life in weeks</span>
          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{lived.toLocaleString()} / {total.toLocaleString()}</span>
        </div>

        {/* View switcher */}
        <div className="flex gap-1 p-1 rounded-xl mb-3" style={{ background: 'var(--surface-2)' }}>
          {VIEWS.map(v => (
            <button key={v.key} onClick={() => setView(v.key)}
              className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={view === v.key
                ? { background: 'var(--gold)', color: 'var(--background)' }
                : { color: 'var(--text-muted)' }}>{v.label}</button>
          ))}
        </div>

        {/* Islamic dates toggle */}
        {view === 'all' && (
          <label className="flex items-center justify-between mb-3 cursor-pointer">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Highlight Islamic dates (Ramadan, Eids, Muharram, Ashura)</span>
            <div className="relative">
              <input type="checkbox" className="sr-only peer" checked={showIslamic} onChange={e => toggleIslamic(e.target.checked)} />
              <div className="w-9 h-5 rounded-full peer-checked:after:translate-x-4 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"
                style={{ background: showIslamic ? 'var(--gold)' : 'var(--border)' }} />
            </div>
          </label>
        )}

        <div className="grid gap-[2px]" style={{ gridTemplateColumns: 'repeat(52, minmax(0, 1fr))' }}>
          {Array.from({ length: total }).map((_, i) => {
            const ev = view === 'all' ? eventByWeek.get(i) : undefined
            return (
              <button key={i} onClick={() => setSelected(s => s === i ? null : i)}
                className="aspect-square rounded-[1px] cursor-pointer"
                style={{ ...cellStyle(i), ...(selected === i ? { outline: '1.5px solid var(--text-primary)', outlineOffset: '0px' } : {}) }}
                title={ev?.label ?? `Week ${i + 1} · age ${ageAtWeek(i)}`} />
            )
          })}
        </div>

        {/* Selected week detail */}
        {sel !== null && selStart && selEnd && (
          <div className="mt-3 p-3 rounded-xl relative" style={{ background: 'var(--surface-2)' }}>
            <button onClick={() => setSelected(null)} aria-label="Close" className="absolute top-2 right-2 p-1 rounded-lg" style={{ color: 'var(--text-muted)' }}>
              <X size={14} />
            </button>
            <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
              Week {sel + 1} · age {ageAtWeek(sel)}
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              {selStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – {selEnd.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              {hijriLabel(selStart)} – {hijriLabel(selEnd)} (Hijri)
            </p>
            {/* 7-day row */}
            <div className="flex gap-1 mt-2">
              {['M','T','W','T','F','S','S'].map((d, i) => {
                const day = new Date(selStart.getTime() + i * MS_DAY)
                const isToday = day.toDateString() === now.toDateString()
                const isPast = day < now
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                    <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{d}</span>
                    <span className="text-[11px] w-6 h-6 flex items-center justify-center rounded-full font-medium"
                      style={{
                        background: isToday ? 'var(--gold)' : 'transparent',
                        color: isToday ? '#0a0a0a' : isPast ? 'var(--text-secondary)' : 'var(--text-muted)',
                      }}>{day.getDate()}</span>
                  </div>
                )
              })}
            </div>
            {selEvent ? (
              <div className="mt-2 flex items-start gap-2">
                <span className="w-3 h-3 rounded-sm mt-0.5 shrink-0" style={{ background: selEvent.color }} />
                <div className="min-w-0">
                  <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{selEvent.label}</p>
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    {selEvent.kind}{selEvent.recurrence !== 'none' ? ` · ${selEvent.recurrence}` : ''}
                  </p>
                  {selEvent.notes && <p className="text-[11px] mt-1" style={{ color: 'var(--text-secondary)' }}>{selEvent.notes}</p>}
                </div>
              </div>
            ) : markersByWeek.get(sel)?.length ? (
              <div className="mt-2 flex flex-col gap-1">
                {markersByWeek.get(sel)!.map((mk, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: mk.color }} />
                    <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{mk.label}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] mt-2" style={{ color: 'var(--text-muted)' }}>
                No event this week. <Link href="/life/settings" style={{ color: 'var(--gold)' }}>Add one →</Link>
              </p>
            )}
          </div>
        )}

        <p className="text-[11px] mt-3" style={{ color: 'var(--text-muted)' }}>
          Each square is one week — tap any to see its dates. {remainingCells.toLocaleString()} remain.
        </p>

        {/* Decades legend */}
        {view === 'decades' && (
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
            {DECADE_COLORS.slice(0, Math.ceil(years / 10)).map((color, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: color }} />
                <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Age {i * 10}–{i * 10 + 9}</span>
              </div>
            ))}
          </div>
        )}

        {/* Islamic dates legend */}
        {view === 'all' && showIslamic && (
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
            {ISLAMIC_HOLIDAYS.map(h => (
              <div key={h.label} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: h.color }} />
                <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{h.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Legend (clickable → jumps to that week) */}
        {view === 'all' && events.length > 0 && (
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
            {events.map(ev => (
              <button key={ev.id} onClick={() => setSelected(weekIndexOf(dobDate, new Date(ev.event_date)))}
                className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: ev.color }} />
                <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  {ev.label} <span style={{ color: 'var(--text-secondary)' }}>{new Date(ev.event_date).getFullYear()}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
