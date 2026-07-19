import { createClient } from '@/lib/supabase/server'
import { formatCurrency, shortDate, ownershipForEmail } from '@/lib/utils'
import Link from 'next/link'
import { ArrowRight, HandHeart, Scale, ArrowLeftRight, Target, LogOut, CreditCard, Receipt, ScrollText, Landmark, BarChart3, Hourglass, LayoutGrid, Moon } from 'lucide-react'
import { EXPENSE_CATEGORIES } from '@/components/expenses/ExpenseForm'
import StatusBadge from '@/components/shared/StatusBadge'
import QuickAdd from '@/components/shared/QuickAdd'
import { daysLeft } from '@/lib/lifeMath'
import { toHijri } from '@/lib/hijri'

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // "This month" toggle. Default = lifetime cash on hand (what you actually have).
  // ?view=month = this month's flow only: received − sadaka given − expenses this
  // month. Debt owed is a running balance, not a this-month outgoing, so it's left
  // out of the monthly figure (mixing a cumulative balance into a monthly window is
  // exactly the class of bug that made "yours to keep" go negative before).
  const monthly = (await searchParams).view === 'month'
  // Month boundary uses server TZ (Vercel = UTC), not the users' Gulf time
  // (UTC+4) — an entry logged 00:00-04:00 Gulf time can land in the "wrong"
  // month view. Accepted as cosmetic for a 2-user app (P2-13); not fixed.
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
  const inMonth = (d?: string | null) => !!d && new Date(d) >= monthStart

  // All independent reads in parallel — these were sequential before and
  // made every "back to home" navigation feel slow.
  const [
    { data: profile },
    { data: profiles },
    { data: monthIncome },
    { data: sadakaEntries },
    { data: ledgerEntries },
    { data: pendingProjects },
    { data: latestZakat },
    { data: goals },
    { data: loansData },
    { data: jointAccounts },
    { data: jointTxns },
    { data: savingsEntries },
    { data: expensesData },
    { data: pkrRate },
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user!.id).single(),
    supabase.from('profiles').select('id, display_name') as any,
    // Cash on hand is cumulative, not monthly: count ALL received income (any date)
    // so sadaka/expenses paid from an earlier month net against the income they came
    // from. Scoping this to the current month was the "yours to keep goes negative"
    // bug — last month's 15k dropped out while its sadaka stayed subtracted all-time.
    supabase.from('income_projects')
      .select('id, amount, status, currency, ownership, actual_received_date')
      .neq('status', 'cancelled')
      .in('ownership', ['ibrahim', 'abu_bakar', 'shared']),
    supabase.from('sadaka_entries')
      .select('source_income_id, amount_owed, amount_given, currency, created_at, date_given')
      .eq('owner_id', user!.id)
      .eq('is_joint', false),
    supabase.from('brother_ledger')
      .select('from_user_id, to_user_id, amount, currency, description, transaction_date')
      .eq('is_settled', false),
    supabase.from('income_projects')
      .select('id, name, amount, currency, expected_payment_date, work_completed_date')
      .eq('owner_id', user!.id)
      .eq('status', 'pending')
      .order('expected_payment_date', { ascending: true })
      .limit(3),
    supabase.from('zakat_snapshots')
      .select('is_wajib, zakat_due_aed, snapshot_year')
      .eq('owner_id', user!.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single(),
    supabase.from('financial_goals')
      .select('id, name, target_amount, currency, target_date, is_active')
      .or(`owner_id.eq.${user!.id},goal_type.eq.joint`)
      .eq('is_active', true)
      .limit(3),
    supabase.from('loans')
      .select('id, loan_type, currency_type, original_amount, status, due_date, counterparty_name')
      .eq('owner_id', user!.id)
      .neq('status', 'cleared'),
    supabase.from('joint_accounts').select('id, name, currency').eq('is_active', true),
    supabase.from('joint_account_txns').select('account_id, txn_type, contributor_id, amount, description, category, txn_date, created_by_id'),
    supabase.from('savings_entries').select('currency, txn_type, amount').eq('owner_id', user!.id),
    supabase.from('expenses')
      .select('amount, currency, my_pct, expense_date, category')
      .eq('owner_id', user!.id),
    supabase.from('rates_cache').select('rate_type, rate_value, updated_at'),
  ]) as any[]
  const rateMap: Record<string, { value: number; updated_at: string | null }> = {}
  ;((pkrRate ?? []) as any[]).forEach(r => { rateMap[r.rate_type] = { value: Number(r.rate_value), updated_at: r.updated_at } })
  const pkrToAed = rateMap.pkr_to_aed?.value || 0.0132
  const silverAedGram = rateMap.silver_aed_gram?.value || 5.9
  const ratesStale = !rateMap.pkr_to_aed?.updated_at || (Date.now() - new Date(rateMap.pkr_to_aed.updated_at!).getTime() > 24 * 60 * 60 * 1000)
  const otherProfile = (profiles as Array<{ id: string; display_name: string | null }> | null)
    ?.find(p => p.id !== user!.id)

  // EVERY arm of this money model must apply the same time window AND the same
  // currency folding. Asymmetry here has caused 3 shipped bugs (see PROJECT_STATUS
  // 2026-06-30, 2026-07-01 ×2) — a currency-dimension repeat was FIX-02 (2026-07-04).
  const myOwnership = ownershipForEmail(user!.email ?? profile?.email)
  const myIncome = monthIncome?.filter((i: any) =>
    i.ownership === 'shared' || i.ownership === myOwnership
  ) ?? []
  // Each brother's income is separate money — a "shared" row is split 50/50
  // (matches the sadaka trigger's split), never counted at 100% for both.
  const incomeShare = (i: any) => i.ownership === 'shared' ? 0.5 : 1
  const toAed = (amount: number, currency: string) => currency === 'PKR' ? amount * pkrToAed : amount

  // Awaiting = still-pending income (status not yet received). Computed from status
  // directly, NOT as earned−received, so it stays correct in the monthly view where
  // "received" is month-scoped (else received-this-month=0 wrongly inflated awaiting).
  const awaitingAed = myIncome
    .filter((i: any) => i.status !== 'received')
    .reduce((s: number, i: any) => s + toAed(Number(i.amount) * incomeShare(i), i.currency), 0)
  // In hand: all received (lifetime), or just what landed this month when toggled.
  const totalReceived = myIncome
    .filter((i: any) => i.status === 'received' && (!monthly || inMonth(i.actual_received_date)))
    .reduce((s: number, i: any) => s + toAed(Number(i.amount) * incomeShare(i), i.currency), 0)

  // All-time pending sadaka (still owed) — for the "Sadaka" card + a reminder line.
  const sadakaPending = (cur: string) => {
    const list = (sadakaEntries ?? []).filter((e: any) => e.currency === cur)
    const owed = list.reduce((s: number, e: any) => s + Number(e.amount_owed), 0)
    const given = list.reduce((s: number, e: any) => s + Number(e.amount_given), 0)
    return Math.max(0, owed - given)
  }
  const sadakaOwedAed = sadakaPending('AED')
  const sadakaOwedPkr = sadakaPending('PKR')

  // Cash model: sadaka actually PAID OUT (cash gone, incl. advances). This leaves
  // "yours to keep" because it already left your pocket.
  const sumGiven = (cur: string) => (sadakaEntries ?? [])
    .filter((e: any) => e.currency === cur && (!monthly || inMonth(e.date_given ?? e.created_at)))
    .reduce((s: number, e: any) => s + Number(e.amount_given), 0)
  const sadakaGivenAed = sumGiven('AED') + sumGiven('PKR') * pkrToAed

  // Expenses all-time (your share — shared expenses only cost you my_pct).
  const expenseShare = (cur: string) => (expensesData ?? [])
    .filter((e: any) => e.currency === cur && (!monthly || inMonth(e.expense_date)))
    .reduce((s: number, e: any) => s + Number(e.amount) * Number(e.my_pct ?? 1), 0)
  const expensesAed = expenseShare('AED') + expenseShare('PKR') * pkrToAed

  // Brother ledger balance
  let aedBalance = 0, pkrBalance = 0
  ledgerEntries?.forEach((e: any) => {
    const sign = e.from_user_id === user!.id ? 1 : -1
    if (e.currency === 'AED') aedBalance += sign * e.amount
    if (e.currency === 'PKR') pkrBalance += sign * e.amount
  })

  // Dependent reads (need goal/loan ids) — also in parallel with each other
  const loanIds = (loansData ?? []).map((l: any) => l.id)
  const [{ data: contributions }, { data: repays }] = await Promise.all([
    goals?.length
      ? supabase.from('goal_contributions').select('goal_id, amount')
      : Promise.resolve({ data: [] as any[] }),
    loanIds.length
      ? supabase.from('loan_repayments').select('loan_id, amount').in('loan_id', loanIds)
      : Promise.resolve({ data: [] as any[] }),
  ]) as any[]

  const goalProgress = (goals as any[] | null)?.map((g: any) => {
    const saved = contributions?.filter((c: any) => c.goal_id === g.id).reduce((s: number, c: any) => s + c.amount, 0) ?? 0
    return { ...g, saved, pct: g.target_amount > 0 ? Math.min(100, Math.round((saved / g.target_amount) * 100)) : 0 }
  })
  let loanDebtAed = 0
  ;(loansData ?? []).forEach((l: any) => {
    // USD/gold/silver loans are left out — display-only in /loans, not folded here.
    if (l.loan_type === 'i_owe' && (l.currency_type === 'AED' || l.currency_type === 'PKR')) {
      const repaid = (repays ?? []).filter((r: any) => r.loan_id === l.id).reduce((s: number, r: any) => s + Number(r.amount), 0)
      const remaining = Math.max(0, Number(l.original_amount) - repaid)
      loanDebtAed += toAed(remaining, l.currency_type)
    }
  })
  // Brother Ledger card below keeps aedBalance/pkrBalance exactly as-is (per-currency,
  // already correct) — only this rollup total folds PKR for the hero waterfall.
  const ledgerDebtAed = (aedBalance < 0 ? -aedBalance : 0) + (pkrBalance < 0 ? -pkrBalance * pkrToAed : 0)
  const totalOwedAed = loanDebtAed + ledgerDebtAed
  const anyPkrFolded = myIncome.some((i: any) => i.currency === 'PKR')
    || (sadakaEntries ?? []).some((e: any) => e.currency === 'PKR' && Number(e.amount_given) > 0)
    || (expensesData ?? []).some((e: any) => e.currency === 'PKR')
    || (loansData ?? []).some((l: any) => l.loan_type === 'i_owe' && l.currency_type === 'PKR')
    || pkrBalance < 0
  const anySharedIncome = myIncome.some((i: any) => i.ownership === 'shared')

  // Real cash on hand = all received − all sadaka paid − all expenses (your share)
  // − short-term debts you owe. Money you physically have left to spend. Every arm
  // is cumulative so money-in and money-out share the same time window (see income query).
  const inHandAed = totalReceived
  // Monthly view is a pure cash flow: debt owed is a cumulative balance, not a
  // this-month outgoing, so it only reduces the lifetime figure.
  const owedApplied = monthly ? 0 : totalOwedAed
  const yoursToKeepAed = inHandAed - sadakaGivenAed - expensesAed - owedApplied
  const totalSavingsAed = (goalProgress ?? []).filter(g => g.currency === 'AED').reduce((s, g) => s + g.saved, 0)

  // Savings stash (backup money — /savings module)
  const stash = (cur: string) => (savingsEntries ?? [])
    .filter((s: any) => s.currency === cur)
    .reduce((t: number, s: any) => t + (s.txn_type === 'withdrawal' ? -1 : 1) * Number(s.amount), 0)
  const stashAed = Math.max(0, stash('AED'))
  const stashPkr = Math.max(0, stash('PKR'))

  // Joint account fairness: persistent nudge while the other brother has chipped in more
  const chipNudges: { account: string; currency: string; otherName: string; diff: number }[] = []
  ;(jointAccounts ?? []).forEach((acc: any) => {
    const deps = (jointTxns ?? []).filter((t: any) => t.account_id === acc.id && t.txn_type === 'deposit')
    const mine = deps.filter((t: any) => t.contributor_id === user!.id).reduce((s: number, t: any) => s + Number(t.amount), 0)
    const others = deps.filter((t: any) => t.contributor_id && t.contributor_id !== user!.id).reduce((s: number, t: any) => s + Number(t.amount), 0)
    if (others > mine) chipNudges.push({
      account: acc.name, currency: acc.currency,
      otherName: otherProfile?.display_name ?? 'Your brother', diff: others - mine,
    })
  })

  // Respect Settings → Modules toggles (default: enabled)
  const enabledModules: Record<string, boolean> = (profile as any)?.enabled_modules ?? {}
  const enabled = (key: string) => enabledModules[key] !== false

  const nameMap: Record<string, string> = {}
  ;(profiles as any[] ?? []).forEach(p => { nameMap[p.id] = p.display_name ?? 'User' })

  // This month's spending by category (your share, folded to AED) + vs last month
  const lastMonthStart = new Date(monthStart); lastMonthStart.setMonth(lastMonthStart.getMonth() - 1)
  const inLastMonth = (d?: string | null) => !!d && new Date(d) >= lastMonthStart && new Date(d) < monthStart
  const byCategory: Record<string, number> = {}
  let expThisMonth = 0, expLastMonth = 0
  ;(expensesData ?? []).forEach((e: any) => {
    const share = toAed(Number(e.amount) * Number(e.my_pct ?? 1), e.currency)
    if (inMonth(e.expense_date)) {
      expThisMonth += share
      byCategory[e.category ?? 'other'] = (byCategory[e.category ?? 'other'] ?? 0) + share
    } else if (inLastMonth(e.expense_date)) expLastMonth += share
  })
  const topCategories = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 4)
  const maxCat = topCategories[0]?.[1] ?? 0
  const momPct = expLastMonth > 0 ? Math.round(((expThisMonth - expLastMonth) / expLastMonth) * 100) : null

  // Household activity feed — joint txns + unsettled IOUs, newest first
  const accCurrency: Record<string, string> = {}
  ;(jointAccounts as any[] ?? []).forEach(a => { accCurrency[a.id] = a.currency })
  const feed = [
    ...(jointTxns ?? []).map((t: any) => ({
      date: t.txn_date as string,
      label: t.description ?? (t.txn_type === 'deposit' ? 'Deposit' : (t.category ?? 'Expense')),
      sub: t.txn_type === 'deposit'
        ? `${nameMap[t.contributor_id] ?? 'Someone'} chipped in`
        : `house expense${t.created_by_id ? ` · by ${nameMap[t.created_by_id] ?? '?'}` : ''}`,
      amount: Number(t.amount), currency: accCurrency[t.account_id] ?? 'PKR',
      sign: t.txn_type === 'deposit' ? 1 : -1, href: '/joint',
    })),
    ...(ledgerEntries ?? []).map((e: any) => ({
      date: e.transaction_date as string,
      label: e.description ?? 'IOU',
      sub: `owed to ${nameMap[e.from_user_id] ?? '?'} by ${nameMap[e.to_user_id] ?? '?'}`,
      amount: Number(e.amount), currency: e.currency, sign: e.from_user_id === user!.id ? 1 : -1, href: '/ledger',
    })),
  ].filter(f => !!f.date).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6)

  // Upcoming obligations — one strip, everything with a date or amount due
  const today = new Date().toISOString().split('T')[0]
  const hawlStartDate = (profile as any)?.hawl_start_date as string | null
  let zakatDue: { date: string; days: number } | null = null
  if (hawlStartDate) {
    const due = new Date(hawlStartDate); due.setDate(due.getDate() + 354)
    const days = Math.ceil((due.getTime() - Date.now()) / 86400000)
    if (days >= 0) zakatDue = { date: due.toISOString().split('T')[0], days }
  }
  const nextLoanDue = (loansData as any[] ?? [])
    .filter(l => l.loan_type === 'i_owe' && l.due_date && l.due_date >= today)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))[0] ?? null
  const nextGoalDue = (goalProgress ?? [])
    .filter(g => g.target_date && g.target_date >= today && g.pct < 100)
    .sort((a, b) => a.target_date!.localeCompare(b.target_date!))[0] ?? null

  // Islamic context: Ramadan card + nisab awareness
  const hijriToday = toHijri(new Date())
  const isRamadan = hijriToday.m === 9
  const stashAedForNisab = stash('AED') + stash('PKR') * pkrToAed
  const wealthAed = stashAedForNisab + totalSavingsAed
  const nisabSilverAed = 612.36 * silverAedGram
  const aboveNisabNoHawl = wealthAed >= nisabSilverAed && !hawlStartDate

  // Life Tracker — days remaining to projected term (only if DOB set)
  const lifeDob = (profile as any)?.date_of_birth as string | null
  const lifeYears = (profile as any)?.life_expectancy_years ?? 63
  const lifeDaysLeft = lifeDob ? daysLeft(new Date(lifeDob), lifeYears, new Date()) : null

  const userName = profile?.display_name ?? 'Ibrahim'
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="flex flex-col gap-4 p-4 animate-slide-up">

      {/* Header */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <p className="section-label">{greeting}</p>
          <h1 className="font-display text-2xl font-semibold text-gold-gradient mt-0.5">{userName}</h1>
        </div>
        <form action="/api/logout" method="POST">
          <button className="p-2 rounded-xl" style={{ background: 'var(--surface-2)' }}>
            <LogOut size={16} style={{ color: 'var(--text-muted)' }} />
          </button>
        </form>
      </div>

      {/* Stale exchange-rate warning — shown whenever ANY PKR amount is being
          folded at the cached rate, not just pending PKR sadaka (P2-28) */}
      {ratesStale && (anyPkrFolded || sadakaOwedPkr > 0) && (
        <div className="rounded-xl px-4 py-2.5 text-xs" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', color: '#F59E0B' }}>
          ⚠ Exchange rates may be stale — PKR amounts converted at last known rate. Refresh in Settings → Currencies.
        </div>
      )}

      {/* Joint chip-in reminder — stays until you've matched your brother */}
      {enabled('joint_account') && chipNudges.map(n => (
        <Link key={n.account} href="/joint"
          className="rounded-xl px-4 py-3 flex items-center justify-between gap-2"
          style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.35)' }}>
          <p className="text-xs leading-relaxed" style={{ color: '#F59E0B' }}>
            <span className="font-semibold">{n.otherName} chipped in to {n.account}.</span>{' '}
            Chip in {formatCurrency(n.diff, n.currency)} to be equal.
          </p>
          <ArrowRight size={14} className="shrink-0" style={{ color: '#F59E0B' }} />
        </Link>
      ))}

      {/* Ramadan — the giving month */}
      {isRamadan && enabled('sadaka') && (
        <Link href="/sadaka" className="rounded-xl px-4 py-3 flex items-center justify-between"
          style={{ background: 'var(--gold-dim)', border: '1px solid var(--gold)' }}>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--gold)' }}>
            <span className="font-semibold flex items-center gap-1.5"><Moon size={13} /> Ramadan Mubarak</span>
            Rewards are multiplied — give a little sadaka every day.
          </p>
          <ArrowRight size={14} className="shrink-0" style={{ color: 'var(--gold)' }} />
        </Link>
      )}

      {/* Upcoming obligations — everything with a deadline, one strip */}
      {(zakatDue || nextLoanDue || nextGoalDue || aboveNisabNoHawl) && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
          {zakatDue && enabled('zakat') && (
            <Link href="/zakat" className="shrink-0 px-3 py-2 rounded-xl text-xs font-medium"
              style={{ background: zakatDue.days <= 30 ? 'rgba(239,68,68,0.12)' : 'var(--surface-2)', border: '1px solid var(--border)',
                color: zakatDue.days <= 30 ? '#EF4444' : 'var(--text-secondary)' }}>
              ⚖ Zakat in {zakatDue.days}d · {shortDate(zakatDue.date)}
            </Link>
          )}
          {aboveNisabNoHawl && enabled('zakat') && (
            <Link href="/settings" className="shrink-0 px-3 py-2 rounded-xl text-xs font-medium"
              style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.35)', color: '#F59E0B' }}>
              ⚖ Savings above nisab — set your hawl date
            </Link>
          )}
          {nextLoanDue && enabled('loans') && (
            <Link href="/loans" className="shrink-0 px-3 py-2 rounded-xl text-xs font-medium"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
              💳 {nextLoanDue.counterparty_name} · due {shortDate(nextLoanDue.due_date)}
            </Link>
          )}
          {nextGoalDue && enabled('goals') && (
            <Link href="/goals" className="shrink-0 px-3 py-2 rounded-xl text-xs font-medium"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
              🎯 {nextGoalDue.name} · {shortDate(nextGoalDue.target_date)}
            </Link>
          )}
        </div>
      )}

      {/* This month — Yours to Keep as hero, waterfall in collapsible */}
      {enabled('income') && (
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="section-label">Your Money</span>
          <Link href="/income" className="text-xs" style={{ color: 'var(--gold)' }}>View all →</Link>
        </div>

        {/* All-time cash on hand ⇄ this-month flow */}
        <div className="flex gap-2 mb-4">
          <Link href="/dashboard" scroll={false}
            className="text-[11px] px-3 py-1 rounded-full font-medium"
            style={!monthly
              ? { background: 'rgba(201,168,76,0.15)', color: 'var(--gold)', border: '1px solid rgba(201,168,76,0.4)' }
              : { color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
            All time
          </Link>
          <Link href="/dashboard?view=month" scroll={false}
            className="text-[11px] px-3 py-1 rounded-full font-medium"
            style={monthly
              ? { background: 'rgba(201,168,76,0.15)', color: 'var(--gold)', border: '1px solid rgba(201,168,76,0.4)' }
              : { color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
            This month
          </Link>
        </div>

        {/* Hero = yours to keep */}
        <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Yours to keep</p>
        <p className="font-display text-4xl font-semibold leading-tight"
           style={{ color: yoursToKeepAed >= 0 ? 'var(--emerald)' : '#EF4444' }}>
          {formatCurrency(yoursToKeepAed, 'AED', true)}
        </p>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <div>
            <p className="text-[11px] mb-0.5" style={{ color: 'var(--text-muted)' }}>{monthly ? 'Received' : 'In hand'}</p>
            <p className="font-display text-base font-semibold" style={{ color: 'var(--text-secondary)' }}>
              {formatCurrency(inHandAed, 'AED', true)}
            </p>
          </div>
          <div>
            <p className="text-[11px] mb-0.5" style={{ color: 'var(--text-muted)' }}>Awaiting</p>
            <p className="font-display text-base font-semibold"
               style={{ color: awaitingAed > 0 ? 'var(--amber)' : 'var(--text-muted)' }}>
              {formatCurrency(awaitingAed, 'AED', true)}
            </p>
          </div>
        </div>

        {/* Collapsible waterfall */}
        <details className="mt-4">
          <summary className="text-xs cursor-pointer select-none list-none flex items-center gap-1"
                   style={{ color: 'var(--text-muted)' }}>
            <span>How is this calculated ▾</span>
          </summary>
          <div className="flex flex-col gap-2.5 mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{monthly ? 'Received this month' : 'In hand (received)'}</span>
              <span className="font-display text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
                {formatCurrency(inHandAed, 'AED', true)}
              </span>
            </div>
            <Link href="/sadaka" className="flex items-center justify-between">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>− Sadaka given (paid)</span>
              <span className="font-display text-sm font-semibold" style={{ color: sadakaGivenAed > 0 ? 'var(--emerald)' : 'var(--text-muted)' }}>
                {sadakaGivenAed > 0 ? '−' : ''}{formatCurrency(sadakaGivenAed, 'AED', true)}
              </span>
            </Link>
            <Link href="/expenses" className="flex items-center justify-between">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>− Expenses</span>
              <span className="font-display text-sm font-semibold" style={{ color: expensesAed > 0 ? '#EF4444' : 'var(--text-muted)' }}>
                {expensesAed > 0 ? '−' : ''}{formatCurrency(expensesAed, 'AED', true)}
              </span>
            </Link>
            {!monthly && (
            <Link href="/loans" className="flex items-center justify-between">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>− Owed to people</span>
              <span className="font-display text-sm font-semibold" style={{ color: totalOwedAed > 0 ? '#EF4444' : 'var(--text-muted)' }}>
                {totalOwedAed > 0 ? '−' : ''}{formatCurrency(totalOwedAed, 'AED', true)}
              </span>
            </Link>
            )}
            <div className="flex items-center justify-between pt-2" style={{ borderTop: '1px solid var(--border)' }}>
              <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>= Yours to keep</span>
              <span className="font-display text-sm font-semibold"
                    style={{ color: yoursToKeepAed >= 0 ? 'var(--emerald)' : '#EF4444' }}>
                {formatCurrency(yoursToKeepAed, 'AED', true)}
              </span>
            </div>
            {(sadakaOwedAed > 0 || sadakaOwedPkr > 0) && (
              <p className="text-[11px] pt-1" style={{ color: 'var(--gold)' }}>
                ⚠ You still owe {formatCurrency(sadakaOwedAed, 'AED', true)}{sadakaOwedPkr > 0 && ` · ${formatCurrency(sadakaOwedPkr, 'PKR', true)}`} sadaka — held in the cash above, not yet given.
              </p>
            )}
            {anyPkrFolded && (
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                PKR folded in at {pkrToAed.toFixed(4)} — see Settings → Currencies.
              </p>
            )}
            {anySharedIncome && (
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                Shared income counted at your half.
              </p>
            )}
          </div>
        </details>
      </div>
      )}

      {/* Savings & what you owe — both tap through to their modules */}
      <div className="grid grid-cols-2 gap-3">
        <Link href={enabled('savings') ? '/savings' : '/goals'} className="card p-3 block">
          <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{enabled('savings') ? 'Savings' : 'Savings (goals)'}</p>
          <p className="font-display text-lg font-semibold text-emerald-400">
            {formatCurrency(totalSavingsAed + (enabled('savings') ? stashAed : 0), 'AED', true)}
          </p>
          {enabled('savings') && (
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {stashPkr > 0 ? `+ ${formatCurrency(stashPkr, 'PKR', true)} stashed · ` : ''}goals + stash →
            </p>
          )}
        </Link>
        <Link href="/loans" className="card p-3 block" style={{ border: totalOwedAed > 0 ? '1px solid rgba(239,68,68,0.3)' : undefined }}>
          <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>You owe (debt)</p>
          <p className="font-display text-lg font-semibold" style={{ color: totalOwedAed > 0 ? '#EF4444' : '#10B981' }}>
            {totalOwedAed > 0 ? formatCurrency(totalOwedAed, 'AED', true) : 'Clear'}
          </p>
          {totalOwedAed > 0 && (
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {loanDebtAed > 0 && `loans ${formatCurrency(loanDebtAed, 'AED', true)}`}
              {loanDebtAed > 0 && ledgerDebtAed > 0 && ' · '}
              {ledgerDebtAed > 0 && `ledger ${formatCurrency(ledgerDebtAed, 'AED', true)}`}
              {' →'}
            </p>
          )}
        </Link>
      </div>

      {/* This month's spending — where the money actually went */}
      {enabled('expenses') && topCategories.length > 0 && (
        <Link href="/expenses" className="card p-4 block">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Receipt size={16} style={{ color: 'var(--gold)' }} />
              <span className="text-sm font-semibold">Spending this month</span>
            </div>
            <div className="text-right">
              <span className="font-display text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {formatCurrency(expThisMonth, 'AED', true)}
              </span>
              {momPct !== null && (
                <p className="text-[11px]" style={{ color: momPct > 0 ? '#EF4444' : 'var(--emerald)' }}>
                  {momPct > 0 ? '↑' : '↓'} {Math.abs(momPct)}% vs last month
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            {topCategories.map(([cat, amt]) => (
              <div key={cat}>
                <div className="flex items-center justify-between text-xs mb-0.5">
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {EXPENSE_CATEGORIES.find(c => c.value === cat)?.label ?? cat}
                  </span>
                  <span style={{ color: 'var(--text-muted)' }}>{formatCurrency(amt, 'AED', true)}</span>
                </div>
                <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                  <div className="h-full rounded-full" style={{ width: `${maxCat > 0 ? Math.round((amt / maxCat) * 100) : 0}%`, background: 'var(--gold)' }} />
                </div>
              </div>
            ))}
          </div>
        </Link>
      )}

      {/* Household activity — what you both did lately */}
      {feed.length > 0 && (enabled('joint_account') || enabled('ledger')) && (
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <ArrowLeftRight size={16} style={{ color: 'var(--gold)' }} />
            <span className="text-sm font-semibold">Recent activity</span>
          </div>
          <div className="flex flex-col">
            {feed.map((f, i) => (
              <Link key={i} href={f.href} className="flex items-center justify-between py-2"
                style={{ borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                <div className="min-w-0 mr-3">
                  <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{f.label}</p>
                  <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>{f.sub} · {shortDate(f.date)}</p>
                </div>
                <span className={`text-xs font-bold shrink-0 ${f.sign > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {f.sign > 0 ? '+' : '−'}{formatCurrency(f.amount, f.currency, true)}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Brother Ledger */}
      {enabled('ledger') && (
      <Link href="/ledger" className="card p-4 block">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ArrowLeftRight size={16} style={{ color: 'var(--gold)' }} />
            <span className="text-sm font-semibold">Brother Ledger</span>
          </div>
          <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />
        </div>
        {aedBalance === 0 && pkrBalance === 0 ? (
          <p className="text-sm text-emerald-400 font-medium">All clear ✓ No outstanding balance</p>
        ) : (
          <div className="flex flex-col gap-2">
            {aedBalance !== 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {aedBalance > 0 ? `${otherProfile?.display_name} owes you` : `You owe ${otherProfile?.display_name}`}
                </span>
                <span className={`font-display text-base font-semibold ${aedBalance > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatCurrency(Math.abs(aedBalance), 'AED')}
                </span>
              </div>
            )}
            {pkrBalance !== 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {pkrBalance > 0 ? `${otherProfile?.display_name} owes you` : `You owe ${otherProfile?.display_name}`}
                </span>
                <span className={`font-display text-base font-semibold ${pkrBalance > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatCurrency(Math.abs(pkrBalance), 'PKR')}
                </span>
              </div>
            )}
          </div>
        )}
      </Link>
      )}

      {/* Sadaka */}
      {enabled('sadaka') && (
      <Link href="/sadaka" className="card p-4 block">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <HandHeart size={16} style={{ color: 'var(--gold)' }} />
            <span className="text-sm font-semibold">Sadaka</span>
          </div>
          <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />
        </div>
        {sadakaOwedAed > 0 || sadakaOwedPkr > 0 ? (
          <div className="flex items-center justify-between">
            <span className="text-xs animate-pulse-gold" style={{ color: 'var(--gold)' }}>Pending charity</span>
            <span className="font-display text-base font-semibold text-right" style={{ color: 'var(--gold)' }}>
              {sadakaOwedAed > 0 && formatCurrency(sadakaOwedAed, 'AED', true)}
              {sadakaOwedAed > 0 && sadakaOwedPkr > 0 && ' · '}
              {sadakaOwedPkr > 0 && formatCurrency(sadakaOwedPkr, 'PKR', true)}
            </span>
          </div>
        ) : (
          <p className="text-sm text-emerald-400 font-medium">All Sadaka given ✓</p>
        )}
      </Link>
      )}

      {/* Goals preview */}
      {enabled('goals') && goalProgress && goalProgress.length > 0 && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Target size={16} style={{ color: 'var(--gold)' }} />
              <span className="text-sm font-semibold">Goals</span>
            </div>
            <Link href="/goals" className="text-xs" style={{ color: 'var(--gold)' }}>View all →</Link>
          </div>
          <div className="flex flex-col gap-3">
            {goalProgress.map(g => (
              <div key={g.id}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{g.name}</span>
                  <span className="text-xs font-bold" style={{ color: g.pct >= 80 ? 'var(--emerald)' : 'var(--gold)' }}>{g.pct}%</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                  <div className="h-full rounded-full animate-fill"
                       style={{ width: `${g.pct}%`, background: g.pct >= 80 ? 'var(--emerald)' : 'var(--gold)' }} />
                </div>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {formatCurrency(g.saved, g.currency, true)} of {formatCurrency(g.target_amount, g.currency, true)}
                  {g.target_date && ` · by ${shortDate(g.target_date)}`}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Zakat status */}
      {enabled('zakat') && (
      <Link href="/zakat" className="card p-4 block">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scale size={16} style={{ color: 'var(--gold)' }} />
            <span className="text-sm font-semibold">Zakat</span>
          </div>
          <div className="flex items-center gap-2">
            {latestZakat ? (
              <>
                <StatusBadge status={latestZakat.is_wajib ? 'wajib' : 'not_wajib'}
                  label={latestZakat.is_wajib ? 'Wajib' : 'Not Due'} />
                {latestZakat.is_wajib && (
                  <span className="text-sm font-bold text-red-400">
                    {formatCurrency(latestZakat.zakat_due_aed ?? 0, 'AED', true)}
                  </span>
                )}
              </>
            ) : (
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Not calculated →</span>
            )}
          </div>
        </div>
      </Link>
      )}

      {/* Pending payments */}
      {enabled('income') && pendingProjects && pendingProjects.length > 0 && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold">Awaiting Payment</p>
            <Link href="/income" className="text-xs" style={{ color: 'var(--gold)' }}>See all →</Link>
          </div>
          <div className="flex flex-col gap-2">
            {pendingProjects.map((p: any) => {
              const overdue = p.expected_payment_date && new Date(p.expected_payment_date) < new Date()
              return (
                <div key={p.id} className="flex items-center justify-between py-2 border-b last:border-0"
                     style={{ borderColor: 'var(--border)' }}>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{p.name}</p>
                    <p className="text-xs" style={{ color: overdue ? '#EF4444' : 'var(--text-muted)' }}>
                      {overdue ? '⚠ Overdue' : p.expected_payment_date ? `Due ${shortDate(p.expected_payment_date)}` : 'No due date'}
                    </p>
                  </div>
                  <span className="text-sm font-semibold" style={{ color: 'var(--gold)' }}>
                    {formatCurrency(p.amount, p.currency, true)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Life Tracker — memento mori */}
      {enabled('life') && lifeDaysLeft !== null && (
        <Link href="/life" className="card p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Hourglass size={16} style={{ color: 'var(--gold)' }} />
            <span className="text-sm font-semibold">Life Tracker</span>
          </div>
          <span className="font-display text-base font-semibold" style={{ color: 'var(--gold)' }}>
            ≈ {lifeDaysLeft.toLocaleString()} days left →
          </span>
        </Link>
      )}

      {/* Analytics banner */}
      <Link href="/analytics" className="card p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 size={16} style={{ color: 'var(--gold)' }} />
          <span className="text-sm font-semibold">Analytics</span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>earnings & sadaka insights</span>
        </div>
        <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />
      </Link>

      {/* All modules hub */}
      <Link href="/modules" className="card p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LayoutGrid size={15} style={{ color: 'var(--gold)' }} />
          <span className="text-sm font-semibold">All modules</span>
        </div>
        <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />
      </Link>

      {/* Quick links — gated by module toggles */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { href: '/expenses', label: 'Expenses', Icon: Receipt,     key: 'expenses' },
          { href: '/joint',    label: 'Joint',    Icon: Landmark,    key: 'joint_account' },
          { href: '/loans',    label: 'Loans',    Icon: CreditCard,  key: 'loans' },
          { href: '/wasiyya',  label: 'Wasiyya',  Icon: ScrollText,  key: 'wasiyya' },
        ].filter(({ key }) => enabled(key)).map(({ href, label, Icon }) => (
          <Link key={href} href={href}
            className="card-inner p-3 flex flex-col items-center gap-1.5 rounded-xl">
            <Icon size={18} style={{ color: 'var(--gold)' }} />
            <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</span>
          </Link>
        ))}
      </div>

      <QuickAdd />
    </div>
  )
}
