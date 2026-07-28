'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import ModuleHeader from '@/components/shared/ModuleHeader'
import LoadingSpinner from '@/components/shared/LoadingSpinner'
import LoadError from '@/components/shared/LoadError'
import { Donut, MonthlyBars, StackedBars, GroupedBars } from '@/components/analytics/Charts'
import { EXPENSE_CATEGORIES } from '@/components/expenses/ExpenseForm'
import { TrendingUp, HandHeart, Wallet, Target, Scale, Receipt, Landmark, Award, Users, Briefcase } from 'lucide-react'

// Shared palette for category/recipient/source slices — gold-family first so the
// charts stay on-brand, then contrasting hues for readability.
const PALETTE = ['#C9A84C', '#10B981', '#E8C97A', '#3B82F6', '#A855F7', '#7C6A2D', '#5C574A']
const catLabel = (c: string) =>
  EXPENSE_CATEGORIES.find(x => x.value === c)?.label ?? `• ${c.charAt(0).toUpperCase()}${c.slice(1)}`

export default function AnalyticsPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [period, setPeriod] = useState<'monthly' | 'yearly'>('monthly')
  const [income, setIncome] = useState<any[]>([])
  const [sadaka, setSadaka] = useState<any[]>([])
  const [loans, setLoans] = useState<any[]>([])
  const [repays, setRepays] = useState<any[]>([])
  const [ledger, setLedger] = useState<any[]>([])
  const [savings, setSavings] = useState<any[]>([])
  const [contribs, setContribs] = useState<any[]>([])
  const [goalCurrencies, setGoalCurrencies] = useState<Record<string, string>>({})
  const [expenses, setExpenses] = useState<any[]>([])
  const [jointTxns, setJointTxns] = useState<any[]>([])
  const [accCurrency, setAccCurrency] = useState<Record<string, string>>({})
  const [zakatSnaps, setZakatSnaps] = useState<any[]>([])
  const [pkrToAed, setPkrToAed] = useState(0.0132)
  const [userId, setUserId] = useState('')

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    setUserId(user!.id)
    const [{ data: inc, error }, { data: sad }, { data: lns }, { data: reps }, { data: led }, { data: sav }, { data: con }, { data: rate }, { data: gls }, { data: exp }, { data: jAcc }, { data: jTx }, { data: zak }] = await Promise.all([
      supabase.from('income_projects').select('name, amount, currency, status, work_completed_date, created_at').eq('owner_id', user!.id),
      supabase.from('sadaka_entries').select('amount_owed, amount_given, currency, location, recipient_name, date_given, created_at').or(`owner_id.eq.${user!.id},is_joint.eq.true`),
      supabase.from('loans').select('id, owner_id, loan_type, currency_type, original_amount, status').eq('owner_id', user!.id).neq('status', 'cleared'),
      supabase.from('loan_repayments').select('loan_id, amount'),
      supabase.from('brother_ledger').select('from_user_id, to_user_id, amount, currency').eq('is_settled', false),
      supabase.from('savings_entries').select('currency, txn_type, amount').eq('owner_id', user!.id),
      supabase.from('goal_contributions').select('goal_id, amount, contributor_id'),
      supabase.from('rates_cache').select('rate_value').eq('rate_type', 'pkr_to_aed').single(),
      supabase.from('financial_goals').select('id, currency'),
      supabase.from('expenses').select('amount, currency, my_pct, expense_date, category').eq('owner_id', user!.id),
      supabase.from('joint_accounts').select('id, currency').eq('is_active', true),
      supabase.from('joint_account_txns').select('account_id, txn_type, amount, txn_date'),
      supabase.from('zakat_snapshots').select('snapshot_year, zakat_due_aed, is_wajib').eq('owner_id', user!.id),
    ])
    if (error) { setLoadError(true); setLoading(false); return }
    setLoadError(false)
    setIncome((inc as any) ?? [])
    setSadaka((sad as any) ?? [])
    setLoans((lns as any) ?? [])
    setRepays((reps as any) ?? [])
    setLedger((led as any) ?? [])
    setSavings((sav as any) ?? [])
    setContribs((con as any) ?? [])
    const gcMap: Record<string, string> = {}
    ;(gls ?? []).forEach((g: any) => { gcMap[g.id] = g.currency })
    setGoalCurrencies(gcMap)
    setExpenses((exp as any) ?? [])
    setJointTxns((jTx as any) ?? [])
    const accMap: Record<string, string> = {}
    ;(jAcc ?? []).forEach((a: any) => { accMap[a.id] = a.currency })
    setAccCurrency(accMap)
    setZakatSnaps((zak as any) ?? [])
    if (rate?.rate_value) setPkrToAed(Number(rate.rate_value))
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  if (loading) return <LoadingSpinner />
  if (loadError) return (
    <div className="flex flex-col gap-4 animate-slide-up">
      <ModuleHeader title="Analytics" />
      <LoadError onRetry={load} />
    </div>
  )

  const toAed = (amount: number, cur: string) => cur === 'PKR' ? amount * pkrToAed : cur === 'AED' ? amount : 0
  // Sum an array folding PKR→AED. These tiles/donuts were previously AED-only,
  // which zeroed out PKR sadaka (most Pakistan giving) while the Net Position
  // card right below converted PKR properly (P2-25).
  const sumAed = (arr: any[], f: (x: any) => number) => arr.reduce((s, x) => s + toAed(f(x), x.currency), 0)

  // ---- Period scoping ----
  const now = new Date()
  const periodStart = period === 'monthly'
    ? new Date(now.getFullYear(), now.getMonth(), 1)
    : new Date(now.getFullYear(), 0, 1)
  const inPeriod = (dateStr?: string | null) => dateStr ? new Date(dateStr) >= periodStart : false

  const periodIncome = income.filter(x => inPeriod(x.work_completed_date ?? x.created_at))
  const periodSadakaGiven = sadaka.filter(x => Number(x.amount_given) > 0 && inPeriod(x.date_given ?? x.created_at))

  const earned = sumAed(periodIncome, x => Number(x.amount))
  const received = sumAed(periodIncome.filter(x => x.status === 'received'), x => Number(x.amount))
  const sadakaGiven = sumAed(periodSadakaGiven, x => Number(x.amount_given))
  // Pending is a "right now" number — always all-time net
  const sadakaPending = Math.max(0, sumAed(sadaka, x => Number(x.amount_owed)) - sumAed(sadaka, x => Number(x.amount_given)))
  const givenPct = earned > 0 ? Math.round((sadakaGiven / earned) * 100) : 0

  // ---- Trend buckets ----
  const trend: { month: string; key: string; earned: number; sadaka: number }[] = []
  if (period === 'monthly') {
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      trend.push({ month: d.toLocaleDateString('en-GB', { month: 'short' }), key: `${d.getFullYear()}-${d.getMonth()}`, earned: 0, sadaka: 0 })
    }
  } else {
    for (let i = 3; i >= 0; i--) {
      const y = now.getFullYear() - i
      trend.push({ month: `${y}`, key: `${y}`, earned: 0, sadaka: 0 })
    }
  }
  const bucket = (dateStr: string) => {
    const d = new Date(dateStr)
    return period === 'monthly' ? `${d.getFullYear()}-${d.getMonth()}` : `${d.getFullYear()}`
  }
  income.forEach(x => {
    const m = trend.find(mo => mo.key === bucket(x.work_completed_date ?? x.created_at))
    if (m) m.earned += toAed(Number(x.amount), x.currency)
  })
  sadaka.filter(x => x.amount_given > 0).forEach(x => {
    const m = trend.find(mo => mo.key === bucket(x.date_given ?? x.created_at))
    if (m) m.sadaka += toAed(Number(x.amount_given), x.currency)
  })

  // ---- Net position (loans & debts included → profit or loss?) ----
  const repaidFor = (id: string) => repays.filter((r: any) => r.loan_id === id).reduce((s: number, r: any) => s + Number(r.amount), 0)
  let iOweAed = 0, owedToMeAed = 0
  loans.forEach((l: any) => {
    const remaining = Math.max(0, Number(l.original_amount) - repaidFor(l.id))
    const inAed = toAed(remaining, l.currency_type)   // gold/silver loans excluded from cash net
    if (l.loan_type === 'i_owe') iOweAed += inAed
    if (l.loan_type === 'they_owe') owedToMeAed += inAed
  })
  let ledgerNetAed = 0
  ledger.forEach((e: any) => {
    const sign = e.from_user_id === userId ? 1 : -1
    ledgerNetAed += sign * toAed(Number(e.amount), e.currency)
  })
  const savingsAed = savings.reduce((t: number, s: any) =>
    t + (s.txn_type === 'withdrawal' ? -1 : 1) * toAed(Number(s.amount), s.currency), 0)
  // goal_contributions has no currency column of its own — a PKR goal's
  // contributions were counted 1:1 as AED. Convert via the parent goal's currency.
  const goalSavedAed = contribs.filter((c: any) => c.contributor_id === userId)
    .reduce((s: number, c: any) => s + toAed(Number(c.amount), goalCurrencies[c.goal_id] ?? 'AED'), 0)

  const assets = savingsAed + goalSavedAed + owedToMeAed + Math.max(0, ledgerNetAed)
  const liabilities = iOweAed + Math.max(0, -ledgerNetAed)
  const netPosition = assets - liabilities
  const inProfit = netPosition >= 0

  const stats = [
    { label: `Earned (${period === 'monthly' ? 'this month' : 'this year'})`, value: formatCurrency(earned, 'AED', true), Icon: TrendingUp, color: 'var(--gold)' },
    { label: 'Received', value: formatCurrency(received, 'AED', true), Icon: Wallet, color: '#10B981' },
    { label: 'Sadaka given', value: formatCurrency(sadakaGiven, 'AED', true), Icon: HandHeart, color: '#10B981' },
    { label: 'Sadaka pending (now)', value: formatCurrency(sadakaPending, 'AED', true), Icon: Target, color: sadakaPending > 0 ? '#F59E0B' : '#10B981' },
  ]

  // Sadaka given by location (all-time)
  const locColors: Record<string, string> = { UAE: '#C9A84C', Pakistan: '#10B981', other: '#7C6A2D' }
  const byLoc: Record<string, number> = {}
  sadaka.forEach(x => {
    const v = toAed(Number(x.amount_given), x.currency)
    if (v > 0) { const l = x.location ?? 'other'; byLoc[l] = (byLoc[l] ?? 0) + v }
  })
  const locSegments = Object.entries(byLoc).map(([label, value]) => ({ label, value, color: locColors[label] ?? '#7C6A2D' }))

  // ---- New charts (#73-#78). All reuse `trend`'s buckets, so every chart below
  // follows the monthly/yearly toggle rather than inventing its own window. ----
  const buckets = trend.map(t => ({ label: t.month, key: t.key }))
  const topSlice = (rec: Record<string, number>, n: number) =>
    Object.entries(rec).sort((a, b) => b[1] - a[1]).slice(0, n)
      .map(([label, value], i) => ({ label, value, color: PALETTE[i % PALETTE.length] }))

  // #73 Expense category trend — your share, AED-folded, top 5 categories + Other
  const expShare = (e: any) => toAed(Number(e.amount) * Number(e.my_pct ?? 1), e.currency)
  const catTotals: Record<string, number> = {}
  expenses.forEach(e => { catTotals[e.category ?? 'other'] = (catTotals[e.category ?? 'other'] ?? 0) + expShare(e) })
  const topCats = Object.entries(catTotals).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([c]) => c)
  const OTHER_COLOR = PALETTE[PALETTE.length - 1]
  const expenseTrend = buckets.map(bk => {
    const inB = expenses.filter(e => e.expense_date && bucket(e.expense_date) === bk.key)
    const parts = topCats.map((c, i) => ({
      key: catLabel(c), color: PALETTE[i % PALETTE.length],
      value: inB.filter(e => (e.category ?? 'other') === c).reduce((s, e) => s + expShare(e), 0),
    }))
    const other = inB.filter(e => !topCats.includes(e.category ?? 'other')).reduce((s, e) => s + expShare(e), 0)
    if (other > 0) parts.push({ key: 'Other', value: other, color: OTHER_COLOR })
    return { label: bk.label, parts: [...parts].sort((a, b) => b.value - a.value) }
  })
  const anyExpenses = Object.keys(catTotals).length > 0

  // #74 Sadaka by recipient (all-time given) — who actually received what
  const byRecipient: Record<string, number> = {}
  sadaka.forEach(x => {
    const v = toAed(Number(x.amount_given), x.currency)
    if (v > 0) { const n = x.recipient_name || 'Unnamed / general'; byRecipient[n] = (byRecipient[n] ?? 0) + v }
  })
  const recipientSegments = topSlice(byRecipient, 6)

  // #75 Income source breakdown — per client/project share of the selected period
  const bySource: Record<string, number> = {}
  periodIncome.forEach(x => {
    const n = x.name || 'Unnamed'
    bySource[n] = (bySource[n] ?? 0) + toAed(Number(x.amount), x.currency)
  })
  const sourceSegments = topSlice(bySource, 6)

  // #76 Joint account rhythm — money in vs money out per period
  const txnCurrency = (t: any) => accCurrency[t.account_id] ?? 'AED'
  const jointSeries = buckets.map(bk => {
    const inB = jointTxns.filter(t => t.txn_date && bucket(t.txn_date) === bk.key)
    return {
      label: bk.label,
      a: inB.filter(t => t.txn_type === 'deposit').reduce((s, t) => s + toAed(Number(t.amount), txnCurrency(t)), 0),
      b: inB.filter(t => t.txn_type === 'withdrawal').reduce((s, t) => s + toAed(Number(t.amount), txnCurrency(t)), 0),
    }
  })
  const anyJoint = jointSeries.some(j => j.a > 0 || j.b > 0)

  // #77 Zakat year over year — zakat due per snapshot year, oldest first
  const zakatYears = [...zakatSnaps]
    .sort((a, b) => Number(a.snapshot_year) - Number(b.snapshot_year))
    .map(z => ({
      label: String(z.snapshot_year),
      parts: [{ key: 'Zakat due', value: Number(z.zakat_due_aed ?? 0), color: PALETTE[0] }],
    }))

  // #78 Best / worst months — always all-time monthly, independent of the toggle
  const mKey = (d: string) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}` }
  const mLabel = (k: string) => {
    const [y, m] = k.split('-').map(Number)
    return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  }
  const addTo = (rec: Record<string, number>, d: string | null | undefined, v: number) => {
    if (!d || !(v > 0)) return
    const k = mKey(d); rec[k] = (rec[k] ?? 0) + v
  }
  const incByMonth: Record<string, number> = {}
  const expByMonth: Record<string, number> = {}
  const sadByMonth: Record<string, number> = {}
  income.forEach(x => addTo(incByMonth, x.work_completed_date ?? x.created_at, toAed(Number(x.amount), x.currency)))
  expenses.forEach(e => addTo(expByMonth, e.expense_date, expShare(e)))
  sadaka.forEach(x => addTo(sadByMonth, x.date_given ?? x.created_at, toAed(Number(x.amount_given), x.currency)))
  const peak = (rec: Record<string, number>) => Object.entries(rec).sort((a, b) => b[1] - a[1])[0] ?? null
  const records = [
    { label: 'Best earning month', entry: peak(incByMonth), Icon: TrendingUp, color: 'var(--gold)' },
    { label: 'Most generous month', entry: peak(sadByMonth), Icon: HandHeart, color: '#10B981' },
    { label: 'Highest spending month', entry: peak(expByMonth), Icon: Receipt, color: '#EF4444' },
  ].filter(r => r.entry !== null)

  return (
    <div className="flex flex-col gap-4 p-4 animate-slide-up">
      <ModuleHeader title="Analytics" subtitle="Earnings, sadaka & net position" />

      {/* Monthly / Yearly toggle */}
      <div className="flex gap-2">
        {(['monthly', 'yearly'] as const).map(p => (
          <button key={p} onClick={() => setPeriod(p)}
            className="px-4 py-1.5 rounded-full text-xs font-medium capitalize transition-all"
            style={{
              background: period === p ? 'var(--gold)' : 'var(--surface-2)',
              color: period === p ? '#0a0a0a' : 'var(--text-muted)',
            }}>
            {p}
          </button>
        ))}
      </div>

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

      {/* Net position — are you in profit or loss overall? */}
      <div className="card p-4" style={{ border: `1px solid ${inProfit ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Scale size={15} style={{ color: inProfit ? '#10B981' : '#EF4444' }} />
            <h3 className="text-sm font-semibold">Net Position</h3>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
            style={{ background: inProfit ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: inProfit ? '#10B981' : '#EF4444' }}>
            {inProfit ? 'In surplus' : 'In loss'}
          </span>
        </div>
        <p className="font-display text-3xl font-semibold mb-3" style={{ color: inProfit ? '#10B981' : '#EF4444' }}>
          {netPosition < 0 ? '-' : ''}{formatCurrency(Math.abs(netPosition), 'AED', true)}
        </p>
        <div className="flex flex-col gap-1.5 text-xs">
          <div className="flex justify-between"><span style={{ color: 'var(--text-muted)' }}>Savings + goals</span><span className="text-emerald-400 font-semibold">{formatCurrency(savingsAed + goalSavedAed, 'AED', true)}</span></div>
          <div className="flex justify-between"><span style={{ color: 'var(--text-muted)' }}>Owed to you (loans{ledgerNetAed > 0 ? ' + ledger' : ''})</span><span className="text-emerald-400 font-semibold">{formatCurrency(owedToMeAed + Math.max(0, ledgerNetAed), 'AED', true)}</span></div>
          <div className="flex justify-between"><span style={{ color: 'var(--text-muted)' }}>You owe (loans{ledgerNetAed < 0 ? ' + ledger' : ''})</span><span className="text-red-400 font-semibold">-{formatCurrency(liabilities, 'AED', true)}</span></div>
        </div>
        <p className="text-[11px] mt-3" style={{ color: 'var(--text-muted)' }}>
          PKR amounts converted at {pkrToAed} · gold/silver loans not included. Liabilities here are
          what Zakat counts as deductible debts.
        </p>
      </div>

      {/* Sadaka discipline ring */}
      <div className="card p-4">
        <h3 className="text-sm font-semibold mb-3">Sadaka vs Earnings ({period === 'monthly' ? 'this month' : 'this year'})</h3>
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

      {/* Trend */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold">{period === 'monthly' ? 'Last 6 Months' : 'Last 4 Years'}</h3>
          <div className="flex items-center gap-3 text-[10px]">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ background: '#C9A84C' }} /> Earned</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ background: '#10B981' }} /> Sadaka</span>
          </div>
        </div>
        <MonthlyBars data={trend} />
      </div>

      {/* By location */}
      {locSegments.length > 0 && (
        <div className="card p-4">
          <h3 className="text-sm font-semibold mb-3">Sadaka by Location</h3>
          <Donut segments={locSegments} />
        </div>
      )}

      {/* #73 Expense category trend */}
      {anyExpenses && (
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-1">
            <Receipt size={15} style={{ color: 'var(--gold)' }} />
            <h3 className="text-sm font-semibold">Spending by Category</h3>
          </div>
          <StackedBars data={expenseTrend} />
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3">
            {topCats.map((c, i) => (
              <span key={c} className="flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                <span className="w-2 h-2 rounded-sm" style={{ background: PALETTE[i % PALETTE.length] }} />
                {catLabel(c)}
              </span>
            ))}
            <span className="flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--text-secondary)' }}>
              <span className="w-2 h-2 rounded-sm" style={{ background: OTHER_COLOR }} /> Other
            </span>
          </div>
          <p className="text-[11px] mt-2" style={{ color: 'var(--text-muted)' }}>
            Your share only — a split expense counts at your percentage.
          </p>
        </div>
      )}

      {/* #78 Records — best and worst months, all-time */}
      {records.length > 0 && (
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Award size={15} style={{ color: 'var(--gold)' }} />
            <h3 className="text-sm font-semibold">Records (all time)</h3>
          </div>
          <div className="flex flex-col gap-2.5">
            {records.map(({ label, entry, Icon, color }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                  <Icon size={13} style={{ color }} /> {label}
                </span>
                <span className="text-right">
                  <span className="text-sm font-semibold block" style={{ color: 'var(--text-primary)' }}>
                    {formatCurrency(entry![1], 'AED', true)}
                  </span>
                  <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{mLabel(entry![0])}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* #75 Income sources */}
      {sourceSegments.length > 0 && (
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Briefcase size={15} style={{ color: 'var(--gold)' }} />
            <h3 className="text-sm font-semibold">Income by Source ({period === 'monthly' ? 'this month' : 'this year'})</h3>
          </div>
          <Donut segments={sourceSegments} />
        </div>
      )}

      {/* #74 Sadaka by recipient */}
      {recipientSegments.length > 0 && (
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users size={15} style={{ color: 'var(--gold)' }} />
            <h3 className="text-sm font-semibold">Sadaka by Recipient (all time)</h3>
          </div>
          <Donut segments={recipientSegments} />
        </div>
      )}

      {/* #76 Joint account rhythm */}
      {anyJoint && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Landmark size={15} style={{ color: 'var(--gold)' }} />
              <h3 className="text-sm font-semibold">Joint Account Rhythm</h3>
            </div>
            <div className="flex items-center gap-3 text-[10px]">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ background: '#10B981' }} /> In</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ background: '#EF4444' }} /> Out</span>
            </div>
          </div>
          <GroupedBars data={jointSeries} labelA="In" labelB="Out" />
        </div>
      )}

      {/* #77 Zakat year over year */}
      {zakatYears.length > 0 && (
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-1">
            <Scale size={15} style={{ color: 'var(--gold)' }} />
            <h3 className="text-sm font-semibold">Zakat by Year</h3>
          </div>
          <StackedBars data={zakatYears} />
          <p className="text-[11px] mt-2" style={{ color: 'var(--text-muted)' }}>
            Zakat due per saved snapshot. {zakatYears.length === 1 ? 'Save another year to see the trend.' : ''}
          </p>
        </div>
      )}
    </div>
  )
}
