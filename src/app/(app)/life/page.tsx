'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import ModuleHeader from '@/components/shared/ModuleHeader'
import EmptyState from '@/components/shared/EmptyState'
import LoadingSpinner from '@/components/shared/LoadingSpinner'
import { Hourglass, Settings } from 'lucide-react'
import { deathDate, daysLeft, weeksLeft, monthsLeft, weeksLived, totalWeeks, percentLived } from '@/lib/lifeMath'

export default function LifePage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [dob, setDob] = useState<string | null>(null)
  const [years, setYears] = useState(63)

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const { data } = await supabase.from('profiles')
        .select('date_of_birth, life_expectancy_years').eq('id', user!.id).single()
      setDob((data as any)?.date_of_birth ?? null)
      setYears((data as any)?.life_expectancy_years ?? 63)
      setLoading(false)
    })()
  }, [])

  if (loading) return <LoadingSpinner />

  if (!dob) {
    return (
      <div className="flex flex-col gap-4 p-4 animate-slide-up">
        <ModuleHeader title="Life Tracker" subtitle="Remember death — live with intention" />
        <EmptyState icon={Hourglass} title="Set your date of birth"
          description="Add your birth date in Settings to see how much of this life remains, in shaa Allah."
          action={
            <Link href="/settings" className="px-4 py-2 rounded-xl text-sm font-semibold inline-flex items-center gap-2"
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

  const counters = [
    { label: 'Days left', value: dLeft },
    { label: 'Weeks left', value: wLeft },
    { label: 'Months left', value: mLeft },
  ]

  return (
    <div className="flex flex-col gap-4 p-4 animate-slide-up">
      <ModuleHeader title="Life Tracker" subtitle="Remember death — live with intention" />

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

      {/* Macro view — life in weeks grid (one row per year × 52ish weeks) */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold">Your life in weeks</span>
          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{lived.toLocaleString()} / {total.toLocaleString()}</span>
        </div>
        <div className="grid gap-[2px]" style={{ gridTemplateColumns: 'repeat(52, minmax(0, 1fr))' }}>
          {Array.from({ length: total }).map((_, i) => (
            <div key={i} className="aspect-square rounded-[1px]"
              style={{ background: i < lived ? 'var(--gold)' : 'var(--border)' }} />
          ))}
        </div>
        <p className="text-[11px] mt-3" style={{ color: 'var(--text-muted)' }}>
          Each square is one week. {remainingCells.toLocaleString()} squares remain — spend them well.
        </p>
      </div>
    </div>
  )
}
