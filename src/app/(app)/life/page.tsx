'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import ModuleHeader from '@/components/shared/ModuleHeader'
import EmptyState from '@/components/shared/EmptyState'
import LoadingSpinner from '@/components/shared/LoadingSpinner'
import { Hourglass, Settings, Bell } from 'lucide-react'
import { deathDate, daysLeft, weeksLeft, monthsLeft, weeksLived, totalWeeks, percentLived, weekIndexOf, nextOccurrence } from '@/lib/lifeMath'
import type { LifeEvent } from '@/types/database.types'

export default function LifePage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [dob, setDob] = useState<string | null>(null)
  const [years, setYears] = useState(63)
  const [events, setEvents] = useState<LifeEvent[]>([])

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

  // Map each event to its week-cell so the grid can colour it. Last write wins.
  const eventByWeek = new Map<number, LifeEvent>()
  for (const ev of events) {
    const wi = weekIndexOf(dobDate, new Date(ev.event_date))
    if (wi < total) eventByWeek.set(wi, ev)
  }

  // Upcoming: reminders + future intentions, soonest first.
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

  const daysAway = (d: Date) => Math.round((d.getTime() - now.getTime()) / 86_400_000)

  return (
    <div className="flex flex-col gap-4 p-4 animate-slide-up">
      <ModuleHeader title="Life Tracker" subtitle="Remember death — live with intention" back={false}
        action={
          <Link href="/life/settings" aria-label="Life settings"
            className="p-2 rounded-lg hover:bg-[var(--surface-2)] transition-colors">
            <Settings size={18} style={{ color: 'var(--text-secondary)' }} />
          </Link>
        } />

      {/* Micro view — counters */}
      <div className="grid grid-cols-3 gap-3">
        {counters.map(c => (
          <div key={c.label} className="card p-3 text-center">
            <p className="font-display text-2xl font-semibold text-gold-gradient leading-tight">
              {c.value.toLocaleString()}
            </p>
            <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>{c.label}</p>
          </div>
        ))}
      </div>

      {/* % lived progress */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Life lived</span>
          <span className="text-sm font-bold" style={{ color: 'var(--gold)' }}>{pct}%</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
          <div className="h-full rounded-full animate-fill"
            style={{ width: `${pct}%`, background: 'var(--gold)' }} />
        </div>
        <p className="text-[11px] mt-2" style={{ color: 'var(--text-muted)' }}>
          Born {dobDate.toLocaleDateString()} · projected {death.toLocaleDateString()} (age {years}). Only Allah knows the true term.
        </p>
      </div>

      {/* Upcoming — reminders & intentions */}
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
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>{ev.recurrence}</span>
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

      {/* Macro view — life in weeks grid */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold">Your life in weeks</span>
          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{lived.toLocaleString()} / {total.toLocaleString()}</span>
        </div>
        <div className="grid gap-[2px]" style={{ gridTemplateColumns: 'repeat(52, minmax(0, 1fr))' }}>
          {Array.from({ length: total }).map((_, i) => {
            const ev = eventByWeek.get(i)
            const isLived = i < lived
            let style: React.CSSProperties = { background: isLived ? 'var(--gold)' : 'var(--border)' }
            if (ev) {
              style = isLived
                ? { background: ev.color }
                : { background: 'transparent', boxShadow: `inset 0 0 0 1.5px ${ev.color}` }
            }
            return <div key={i} className="aspect-square rounded-[1px]" style={style} title={ev?.label} />
          })}
        </div>
        <p className="text-[11px] mt-3" style={{ color: 'var(--text-muted)' }}>
          Each square is one week. {remainingCells.toLocaleString()} squares remain — spend them well.
        </p>

        {/* Legend */}
        {events.length > 0 && (
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
            {events.map(ev => (
              <div key={ev.id} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: ev.color }} />
                <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  {ev.label} <span style={{ color: 'var(--text-secondary)' }}>{new Date(ev.event_date).getFullYear()}</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
