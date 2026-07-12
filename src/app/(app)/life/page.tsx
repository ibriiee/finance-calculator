'use client'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import ModuleHeader from '@/components/shared/ModuleHeader'
import EmptyState from '@/components/shared/EmptyState'
import LoadingSpinner from '@/components/shared/LoadingSpinner'
import LoadError from '@/components/shared/LoadError'
import { Hourglass, Settings, Bell, X, CalendarDays, Pencil, ChevronLeft, ChevronRight, TrendingUp } from 'lucide-react'
import {
  deathDate, daysLeft, weeksLeft, monthsLeft, weeksLived, totalWeeks, percentLived,
  weekIndexOf, nextOccurrence, weekStartDate, ageAtWeek, weekOfYear,
} from '@/lib/lifeMath'
import { islamicHolidaysBetween, toHijri, fromHijri, hijriLabel, hijriDay, isWhiteDay, markCovers, ISLAMIC_HOLIDAYS, type HijriMark } from '@/lib/hijri'
import type { LifeEvent } from '@/types/database.types'

// View keys: 'all' | 'plain' | 'decades' | 'cat:<category>' (category lenses are data-driven).
// Subtle per-decade palette for the "Decades" view (index = age / 10).
const DECADE_COLORS = ['#C9A84C', '#D4A017', '#10B981', '#3B82F6', '#A855F7', '#EC4899', '#EF4444', '#14B8A6', '#F59E0B', '#8B5CF6', '#06B6D4', '#84CC16']
const MS_DAY = 86_400_000
// 6-digit hex + alpha suffix for period tints (event colours are hex swatches/picker output).
const hexA = (c: string, a: string) => (c.length === 7 ? c + a : c)
// How a point event draws: shape × colour × filled (lived) / outline (future).
function shapeStyle(shape: string | null | undefined, color: string, filled: boolean): React.CSSProperties {
  const s: React.CSSProperties = filled && shape !== 'ring'
    ? { background: color }
    : { background: 'transparent', boxShadow: `inset 0 0 0 1.5px ${color}` }
  if (shape === 'circle') s.borderRadius = '50%'
  if (shape === 'diamond') { s.transform = 'rotate(45deg) scale(0.75)'; s.borderRadius = '1px' }
  return s
}

export default function LifePage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [dob, setDob] = useState<string | null>(null)
  const [years, setYears] = useState(63)
  const [events, setEvents] = useState<LifeEvent[]>([])
  const [view, setView] = useState('all')
  const [gridPrefs, setGridPrefs] = useState<{ plain: boolean; decades: boolean; cats: Record<string, boolean> }>({ plain: true, decades: true, cats: {} })
  const [selected, setSelected] = useState<number | null>(null)
  const [yearExpanded, setYearExpanded] = useState(false)
  const [calMonth, setCalMonth] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('mizan_life_cal_month')
      if (saved) { const d = new Date(saved); if (!isNaN(d.getTime())) return d }
    }
    const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [showIslamic, setShowIslamic] = useState(false)

  useEffect(() => {
    setShowIslamic(localStorage.getItem('mizan_islamic_dates') !== '0')
    try {
      const saved = JSON.parse(localStorage.getItem('mizan_life_views') ?? '{}')
      setGridPrefs(p => ({ ...p, ...saved, cats: { ...(saved.cats ?? {}) } }))
    } catch {}
  }, [])

  // Islamic markers across the whole lifespan: preset holidays (toggle) + any
  // Hijri-recurring events (e.g. a Zakat date) repeated on every lunar anniversary.
  // Memoised — enumerating ~60 Hijri years hits Intl a few thousand times.
  const markersByWeek = useMemo(() => {
    const m = new Map<number, { label: string; color: string }[]>()
    if (!dob) return m
    const dobD = new Date(dob)
    const death = deathDate(dobD, years)
    const total = totalWeeks(years)
    const pushW = (wi: number, label: string, color: string) => {
      if (wi < 0 || wi >= total) return
      const arr = m.get(wi) ?? []
      if (!arr.some(x => x.label === label)) arr.push({ label, color })
      m.set(wi, arr)
    }
    const push = (date: Date, label: string, color: string) => pushW(weekIndexOf(dobD, date), label, color)
    if (showIslamic) for (const h of islamicHolidaysBetween(dobD, death)) {
      if (h.end) {
        // Span (Ramadan, Dhul Hijjah 1–9, 9–10 Muharram): colour EVERY week it touches.
        const w1 = weekIndexOf(dobD, new Date(h.end.getTime() - MS_DAY))
        for (let wi = weekIndexOf(dobD, h.date); wi <= w1; wi++) pushW(wi, h.label, h.color)
      } else push(h.date, h.label, h.color)
    }
    for (const ev of events.filter(e => e.recurrence === 'hijri_yearly')) {
      const h = toHijri(new Date(ev.event_date))
      for (let y = toHijri(dobD).y; y <= toHijri(death).y; y++) push(fromHijri(y, h.m, h.day), ev.label, ev.color)
    }
    return m
  }, [dob, years, events, showIslamic])
  function toggleIslamic(v: boolean) { setShowIslamic(v); localStorage.setItem('mizan_islamic_dates', v ? '1' : '0') }

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    const [{ data: prof, error }, { data: evs }] = await Promise.all([
      supabase.from('profiles').select('date_of_birth, life_expectancy_years').eq('id', user!.id).single(),
      supabase.from('life_events').select('*').eq('owner_id', user!.id).order('event_date'),
    ])
    if (error) { setLoadError(true); setLoading(false); return }
    setLoadError(false)
    setDob((prof as any)?.date_of_birth ?? null)
    setYears((prof as any)?.life_expectancy_years ?? 63)
    setEvents((evs as LifeEvent[]) ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  if (loading) return <LoadingSpinner />
  if (loadError) return (
    <div className="flex flex-col gap-4 p-4 animate-slide-up">
      <ModuleHeader title="Life Tracker" subtitle="Remember death — live with intention" back={false} />
      <LoadError onRetry={load} />
    </div>
  )

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
  // Islamic spans carry an exclusive `end` (Ramadan covers its whole month).
  function eventsBetween(start: Date, end: Date): HijriMark[] {
    const out: HijriMark[] = []
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

  // Point events land on one week-cell (last write wins); events with an
  // end_date are PERIODS spanning a run of weeks (course, job, city).
  const eventByWeek = new Map<number, LifeEvent>()
  const periods: { ev: LifeEvent; w0: number; w1: number }[] = []
  for (const ev of events) {
    const wi = weekIndexOf(dobDate, new Date(ev.event_date))
    if (wi >= total) continue
    if (ev.end_date) periods.push({ ev, w0: wi, w1: Math.min(total - 1, weekIndexOf(dobDate, new Date(ev.end_date))) })
    else eventByWeek.set(wi, ev)
  }

  // Data-driven view tabs: Events, then one lens per category, then the
  // settings-toggleable Plain/Decades. Unknown active view falls back to Events.
  const cats = [...new Set(events.map(e => e.category).filter((c): c is string => !!c))]
  const views: { key: string; label: string }[] = [
    { key: 'all', label: 'Events' },
    ...cats.filter(c => gridPrefs.cats[c] !== false).map(c => ({ key: `cat:${c}`, label: c })),
    ...(gridPrefs.plain ? [{ key: 'plain', label: 'Plain' }] : []),
    ...(gridPrefs.decades ? [{ key: 'decades', label: 'Decades' }] : []),
  ]
  const activeView = views.some(v => v.key === view) ? view : 'all'
  const activeCat = activeView.startsWith('cat:') ? activeView.slice(4) : undefined
  const inLens = (e: LifeEvent) => !activeCat || e.category === activeCat

  // Periods that contain today → live progress (the "course from date to date" tracker).
  const activePeriods = periods.filter(p => {
    const s = new Date(p.ev.event_date), e = new Date(p.ev.end_date!)
    return s <= now && now <= new Date(e.getTime() + MS_DAY)
  })
  const periodPct = (ev: LifeEvent) => {
    const s = new Date(ev.event_date).getTime(), e = new Date(ev.end_date!).getTime() + MS_DAY
    return Math.min(100, Math.max(0, Math.round(((now.getTime() - s) / (e - s)) * 100)))
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

    // Islamic dates + Hijri-recurring marks are an OVERLAY — they paint on top
    // of every view (Plain, Decades, category lenses), not just Events.
    const mk = markersByWeek.get(i)?.[0]
    const markerCss: React.CSSProperties | undefined = mk
      ? (isLived ? { background: mk.color } : { background: 'transparent', boxShadow: `inset 0 0 0 1.5px ${mk.color}` })
      : undefined

    if (activeView === 'plain') return markerCss ?? { background: isLived ? 'var(--gold)' : 'var(--border)' }

    if (activeView === 'decades') {
      if (markerCss) return markerCss
      if (!isLived) return { background: 'var(--border)' }
      // One solid colour per 10-year band (matches the legend), not per year.
      return { background: DECADE_COLORS[Math.floor(ageAtWeek(i) / 10) % DECADE_COLORS.length] }
    }

    // 'all' / category lens — point events (shape × colour), then period tints, then the overlay.
    const ev = eventByWeek.get(i)
    if (ev && inLens(ev)) return shapeStyle(ev.shape, ev.color, isLived)
    const per = periods.find(p => p.w0 <= i && i <= p.w1 && inLens(p.ev))?.ev
    if (per) return { background: hexA(per.color, isLived ? '99' : '3A') }
    if (markerCss) return markerCss
    // In a category lens the base dims so that layer's colours pop.
    return { background: isLived ? (activeCat ? 'var(--gold-dim)' : 'var(--gold)') : 'var(--border)' }
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
          // Samsung-style dual calendar: small Hijri day under each Gregorian day.
          const y = calMonth.getFullYear(), m = calMonth.getMonth()
          const first = new Date(y, m, 1)
          const daysInMonth = new Date(y, m + 1, 0).getDate()
          const last = new Date(y, m, daysInMonth)
          const lead = (first.getDay() + 6) % 7   // Mon-first offset
          const monthMarks = eventsBetween(first, last)
          const dayMark = (d: Date) => monthMarks.find(mk => markCovers(mk, d))
          const uniqMarks = [...new Map(monthMarks.map(mk => [mk.label, mk])).values()]
          const hMonth = (d: Date) => new Intl.DateTimeFormat('en-US-u-ca-islamic', { month: 'long', year: 'numeric' }).format(d)
          return (
            <div className="mt-1">
              <div className="flex items-center justify-between mb-1">
                <button onClick={() => { const d = new Date(y, m - 1, 1); setCalMonth(d); localStorage.setItem('mizan_life_cal_month', d.toISOString()) }} className="px-2 py-1 rounded-lg" style={{ color: 'var(--text-secondary)' }}>◀</button>
                <span className="text-sm font-semibold">{first.toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
                <button onClick={() => { const d = new Date(y, m + 1, 1); setCalMonth(d); localStorage.setItem('mizan_life_cal_month', d.toISOString()) }} className="px-2 py-1 rounded-lg" style={{ color: 'var(--text-secondary)' }}>▶</button>
              </div>
              {showIslamic && (
                <p className="text-center text-[10px] mb-2" style={{ color: 'var(--text-muted)' }}>
                  {hMonth(first)}{hMonth(last) !== hMonth(first) ? ` – ${hMonth(last)}` : ''}
                </p>
              )}
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
                  const mk = dayMark(date)
                  const white = showIslamic && isWhiteDay(date)
                  return (
                    <div key={day} title={mk?.label ?? (white ? 'White day 13–15 Hijri (sunnah fast)' : undefined)}
                      className="aspect-square flex flex-col items-center justify-center rounded-lg text-[11px] leading-none relative"
                      style={{
                        background: isToday ? 'var(--gold)' : 'var(--surface-2)',
                        color: isToday ? '#0a0a0a' : date < now ? 'var(--text-muted)' : 'var(--text-secondary)',
                        boxShadow: mk ? `inset 0 0 0 1.5px ${mk.color}` : undefined,
                      }}>
                      {day}
                      {showIslamic && <span className="text-[7px] mt-[3px] opacity-70">{hijriDay(date)}</span>}
                      {mk && <span className="absolute bottom-0.5 w-1 h-1 rounded-full" style={{ background: mk.color }} />}
                      {white && !isToday && <span className="absolute top-0.5 right-0.5 w-1 h-1 rounded-full" style={{ background: 'var(--gold)', opacity: 0.8 }} />}
                    </div>
                  )
                })}
              </div>
              {showIslamic && (
                <p className="text-[10px] mt-2" style={{ color: 'var(--text-muted)' }}>
                  Small number = Hijri day · gold corner dot = white day (13–15 Hijri, sunnah fast)
                </p>
              )}
              {uniqMarks.length > 0 && (
                <div className="flex flex-col gap-1 mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                  {uniqMarks.map((mk, i) => {
                    // Clamp span display to this month (Ramadan may start in the previous one).
                    const s = mk.date < first ? first : mk.date
                    const e = mk.end ? new Date(Math.min(mk.end.getTime() - MS_DAY, last.getTime())) : s
                    return (
                      <div key={i} className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: mk.color }} />
                        <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                          {s.getDate()}{e.getDate() !== s.getDate() ? `–${e.getDate()}` : ''} {first.toLocaleString('default', { month: 'short' })} · {mk.label}
                        </span>
                      </div>
                    )
                  })}
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

      {/* In progress — periods containing today, with live progress (course tracker) */}
      {activePeriods.length > 0 && (
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={15} style={{ color: 'var(--gold)' }} />
            <h3 className="text-sm font-semibold">In progress</h3>
          </div>
          <div className="flex flex-col gap-3">
            {activePeriods.map(({ ev }) => {
              const pct = periodPct(ev)
              const dLeftP = Math.max(0, Math.ceil((new Date(ev.end_date!).getTime() - now.getTime()) / MS_DAY))
              return (
                <button key={ev.id} onClick={() => setSelected(weekIndexOf(dobDate, now))} className="text-left">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: ev.color }} />
                      <span className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>{ev.label}</span>
                      {ev.category && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>{ev.category}</span>
                      )}
                    </div>
                    <span className="text-[11px] font-semibold shrink-0 ml-2" style={{ color: 'var(--gold)' }}>{pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: ev.color }} />
                  </div>
                  <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                    {new Date(ev.event_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} → {new Date(ev.end_date!).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} · {dLeftP}d left
                  </p>
                </button>
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

        {/* View switcher — chips scroll (snap) once category lenses outgrow the row */}
        <div className="flex gap-1 p-1 rounded-xl mb-3 overflow-x-auto snap-x" style={{ background: 'var(--surface-2)', scrollbarWidth: 'none' }}>
          {views.map(v => (
            <button key={v.key} onClick={() => setView(v.key)}
              className="flex-1 shrink-0 snap-start px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all"
              style={activeView === v.key
                ? { background: 'var(--gold)', color: 'var(--background)' }
                : { color: 'var(--text-muted)' }}>{v.label}</button>
          ))}
        </div>

        {/* Islamic dates toggle — an overlay across EVERY view (Plain, Decades, lenses) */}
        <label className="flex items-center justify-between mb-3 cursor-pointer">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Islamic dates overlay (full Ramadan, Eids, Dhul Hijjah & Arafah, Ashura) — on any view</span>
          <div className="relative">
            <input type="checkbox" className="sr-only peer" checked={showIslamic} onChange={e => toggleIslamic(e.target.checked)} />
            <div className="w-9 h-5 rounded-full peer-checked:after:translate-x-4 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"
              style={{ background: showIslamic ? 'var(--gold)' : 'var(--border)' }} />
          </div>
        </label>

        <div className="grid gap-[2px]" style={{ gridTemplateColumns: 'repeat(52, minmax(0, 1fr))' }}>
          {Array.from({ length: total }).map((_, i) => {
            const ev = activeView === 'plain' || activeView === 'decades' ? undefined : eventByWeek.get(i)
            return (
              <button key={i} onClick={() => setSelected(s => s === i ? null : i)}
                className="aspect-square rounded-[1px] cursor-pointer"
                style={{ ...cellStyle(i), ...(selected === i ? { outline: '1.5px solid var(--text-primary)', outlineOffset: '0px' } : {}) }}
                title={ev?.label ?? `Week ${i + 1} · age ${ageAtWeek(i)}`} />
            )
          })}
        </div>

        {/* Selected week — bottom-sheet popup, ◀ ▶ walks weeks, 7-day zoom with per-day dots */}
        {sel !== null && selStart && selEnd && (() => {
          const weekMarks = eventsBetween(selStart, selEnd)
          const uniqWeekMarks = [...new Map(weekMarks.map(mk => [mk.label, mk])).values()]
          const weekPeriods = periods.filter(p => p.w0 <= sel && sel <= p.w1)
          const dayDots = (d: Date) => {
            const dots: string[] = []
            for (const mk of weekMarks) if (markCovers(mk, d)) dots.push(mk.color)
            for (const e of events) if (!e.end_date && new Date(e.event_date).toDateString() === d.toDateString()) dots.push(e.color)
            return dots.slice(0, 3)
          }
          return (
            <>
              <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setSelected(null)} />
              <div className="fixed left-0 right-0 bottom-0 z-50 mx-auto w-full max-w-md p-4 rounded-t-2xl animate-slide-up"
                style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)', boxShadow: '0 -8px 30px rgba(0,0,0,0.5)', maxHeight: '70vh', overflowY: 'auto', paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    Week {sel + 1} · age {ageAtWeek(sel)}
                  </p>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setSelected(s => Math.max(0, (s ?? 0) - 1))} aria-label="Previous week"
                      className="p-1.5 rounded-lg" style={{ color: 'var(--text-muted)', background: 'var(--surface-2)' }}><ChevronLeft size={14} /></button>
                    <button onClick={() => setSelected(s => Math.min(total - 1, (s ?? 0) + 1))} aria-label="Next week"
                      className="p-1.5 rounded-lg" style={{ color: 'var(--text-muted)', background: 'var(--surface-2)' }}><ChevronRight size={14} /></button>
                    <button onClick={() => setSelected(null)} aria-label="Close" className="p-1.5 rounded-lg" style={{ color: 'var(--text-muted)' }}>
                      <X size={14} />
                    </button>
                  </div>
                </div>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                  {selStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – {selEnd.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  {hijriLabel(selStart)} – {hijriLabel(selEnd)} (Hijri)
                </p>
                {/* 7-day zoom: each day with its event / Islamic dots */}
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
                        <span className="flex gap-0.5 h-1">
                          {dayDots(day).map((c, j) => <span key={j} className="w-1 h-1 rounded-full" style={{ background: c }} />)}
                        </span>
                      </div>
                    )
                  })}
                </div>
                {/* Periods covering this week — with live progress when ongoing */}
                {weekPeriods.length > 0 && (
                  <div className="mt-3 flex flex-col gap-2">
                    {weekPeriods.map(({ ev }) => {
                      const s = new Date(ev.event_date), e = new Date(ev.end_date!)
                      const totalD = Math.max(1, Math.round((e.getTime() - s.getTime()) / MS_DAY) + 1)
                      const ongoing = s <= now && now <= new Date(e.getTime() + MS_DAY)
                      const dayN = Math.min(totalD, Math.max(1, Math.floor((now.getTime() - s.getTime()) / MS_DAY) + 1))
                      return (
                        <div key={ev.id}>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: hexA(ev.color, '99') }} />
                              <p className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>{ev.label}</p>
                              {ev.category && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>{ev.category}</span>
                              )}
                            </div>
                            <Link href={`/life/settings?edit=${ev.id}`} className="p-1.5 rounded-lg shrink-0"
                              style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                              <Pencil size={12} />
                            </Link>
                          </div>
                          <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            {s.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} → {e.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                            {ongoing ? ` · day ${dayN} of ${totalD} (${periodPct(ev)}%)` : e < now ? ` · completed · ${totalD}d` : ` · starts in ${Math.ceil((s.getTime() - now.getTime()) / MS_DAY)}d`}
                          </p>
                          {ongoing && (
                            <div className="h-1 rounded-full overflow-hidden mt-1" style={{ background: 'var(--border)' }}>
                              <div className="h-full rounded-full" style={{ width: `${periodPct(ev)}%`, background: ev.color }} />
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
                {selEvent && (
                  <div className="mt-3 flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      <span className="w-3 h-3 rounded-sm mt-0.5 shrink-0" style={shapeStyle(selEvent.shape, selEvent.color, true)} />
                      <div className="min-w-0">
                        <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{selEvent.label}</p>
                        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                          {selEvent.kind}{selEvent.category ? ` · ${selEvent.category}` : ''}{selEvent.recurrence !== 'none' ? ` · ${selEvent.recurrence}` : ''}
                        </p>
                        {selEvent.notes && <p className="text-[11px] mt-1" style={{ color: 'var(--text-secondary)' }}>{selEvent.notes}</p>}
                      </div>
                    </div>
                    <Link href={`/life/settings?edit=${selEvent.id}`} className="p-1.5 rounded-lg shrink-0"
                      style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                      <Pencil size={12} />
                    </Link>
                  </div>
                )}
                {uniqWeekMarks.length > 0 && (
                  <div className="mt-3 flex flex-col gap-1">
                    {uniqWeekMarks.map((mk, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: mk.color }} />
                        <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{mk.label}</p>
                      </div>
                    ))}
                  </div>
                )}
                {!selEvent && weekPeriods.length === 0 && uniqWeekMarks.length === 0 && (
                  <p className="text-[11px] mt-3" style={{ color: 'var(--text-muted)' }}>
                    No event this week. <Link href="/life/settings" style={{ color: 'var(--gold)' }}>Add one →</Link>
                  </p>
                )}
              </div>
            </>
          )
        })()}

        <p className="text-[11px] mt-3" style={{ color: 'var(--text-muted)' }}>
          Each square is one week — tap any to see its dates. {remainingCells.toLocaleString()} remain.
        </p>

        {/* Decades legend */}
        {activeView === 'decades' && (
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
        {showIslamic && (
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
            {ISLAMIC_HOLIDAYS.map(h => (
              <div key={h.label} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: h.color }} />
                <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{h.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Legend (clickable → jumps to that week); category lens shows only its layer */}
        {(activeView === 'all' || activeCat) && events.some(inLens) && (
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
            {events.filter(inLens).map(ev => {
              const y0 = new Date(ev.event_date).getFullYear()
              const y1 = ev.end_date ? new Date(ev.end_date).getFullYear() : y0
              return (
                <button key={ev.id} onClick={() => setSelected(weekIndexOf(dobDate, new Date(ev.event_date)))}
                  className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={ev.end_date ? { background: hexA(ev.color, '99') } : shapeStyle(ev.shape, ev.color, true)} />
                  <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    {ev.label} <span style={{ color: 'var(--text-secondary)' }}>{y1 !== y0 ? `${y0}–${y1}` : y0}</span>
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
