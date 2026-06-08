'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import ModuleHeader from '@/components/shared/ModuleHeader'
import LoadingSpinner from '@/components/shared/LoadingSpinner'
import { Donut, MonthlyBars } from '@/components/analytics/Charts'
import { TrendingUp, HandHeart, Wallet, Target } from 'lucide-react'

export default function AnalyticsPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [income, setIncome] = useState<any[]>([])
  const [sadaka, setSadaka] = useState<any[]>([])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    const [{ data: inc }, { data: sad }] = await Promise.all([
      supabase.from('income_projects').select('amount, currency, status, work_completed_date, created_at').eq('owner_id', user!.id),
      supabase.from('sadaka_entries').select('amount_owed, amount_given, currency, location, date_given, created_at').or(`owner_id.eq.${user!.id},is_joint.eq.true`),
    ])
    setIncome((inc as any) ?? [])
    setSadaka((sad as any) ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  if (loading) return <LoadingSpinner />

  const aed = (arr: any[], f: (x: any) => number) => arr.filter(x => x.currency === 'AED').reduce((s, x) => s + f(x), 0)
  const earned = aed(income, x => Number(x.amount))
  const received = aed(income.filter(x => x.status === 'received'), x => Number(x.amount))
  const sadakaGiven = aed(sadaka, x => Number(x.amount_given))
  const sadakaOwed = aed(sadaka, x => Number(x.amount_owed))
  const sadakaPending = Math.max(0, sadakaOwed - sadakaGiven)
  const givenPct = earned > 0 ? Math.round((sadakaGiven / earned) * 100) : 0

  // Last 6 months earned vs sadaka given
  const months: { month: string; key: string; earned: number; sadaka: number }[] = []
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push({ month: d.toLocaleDateString('en-GB', { month: 'short' }), key: `${d.getFullYear()}-${d.getMonth()}`, earned: 0, sadaka: 0 })
  }
  const bucket = (dateStr: string) => { const d = new Date(dateStr); return `${d.getFullYear()}-${d.getMonth()}` }
  income.filter(x => x.currency === 'AED').forEach(x => {
    const m = months.find(mo => mo.key === bucket(x.work_completed_date ?? x.created_at))
    if (m) m.earned += Number(x.amount)
  })
  sadaka.filter(x => x.currency === 'AED' && x.amount_given > 0).forEach(x => {
    const m = months.find(mo => mo.key === bucket(x.date_given ?? x.created_at))
    if (m) m.sadaka += Number(x.amount_given)
  })

  // Sadaka given by location
  const locColors: Record<string, string> = { UAE: '#C9A84C', Pakistan: '#10B981', other: '#7C6A2D' }
  const byLoc: Record<string, number> = {}
  sadaka.forEach(x => {
    const v = aed([x], xx => Number(xx.amount_given))
    if (v > 0) { const l = x.location ?? 'other'; byLoc[l] = (byLoc[l] ?? 0) + v }
  })
  const locSegments = Object.entries(byLoc).map(([label, value]) => ({ label, value, color: locColors[label] ?? '#7C6A2D' }))

  const stats = [
    { label: 'Earned (AED)', value: formatCurrency(earned, 'AED', true), Icon: TrendingUp, color: 'var(--gold)' },
    { label: 'Received', value: formatCurrency(received, 'AED', true), Icon: Wallet, color: '#10B981' },
    { label: 'Sadaka given', value: formatCurrency(sadakaGiven, 'AED', true), Icon: HandHeart, color: '#10B981' },
    { label: 'Sadaka pending', value: formatCurrency(sadakaPending, 'AED', true), Icon: Target, color: sadakaPending > 0 ? '#F59E0B' : '#10B981' },
  ]

  return (
    <div className="flex flex-col gap-4 p-4 animate-slide-up">
      <ModuleHeader title="Analytics" subtitle="Earnings & sadaka insights" />

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-3">
        {stats.map(({ label, value, Icon, color }) => (
          <div key={label} className="card p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Icon size={13} style={{ color }} />
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</p>
            </div>
            <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Sadaka discipline ring */}
      <div className="card p-4">
        <h3 className="text-sm font-semibold mb-3">Sadaka vs Earnings</h3>
        <Donut
          centerValue={`${givenPct}%`}
          centerLabel="of earnings"
          segments={[
            { label: 'Sadaka given', value: sadakaGiven, color: '#10B981' },
            { label: 'Kept', value: Math.max(0, earned - sadakaGiven), color: '#C9A84C' },
          ]}
        />
        <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
          You've given {formatCurrency(sadakaGiven, 'AED', true)} sadaka from {formatCurrency(earned, 'AED', true)} earned.
        </p>
      </div>

      {/* Monthly trend */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold">Last 6 Months</h3>
          <div className="flex items-center gap-3 text-[10px]">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ background: '#C9A84C' }} /> Earned</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ background: '#10B981' }} /> Sadaka</span>
          </div>
        </div>
        <MonthlyBars data={months} />
      </div>

      {/* By location */}
      {locSegments.length > 0 && (
        <div className="card p-4">
          <h3 className="text-sm font-semibold mb-3">Sadaka by Location</h3>
          <Donut segments={locSegments} />
        </div>
      )}
    </div>
  )
}
