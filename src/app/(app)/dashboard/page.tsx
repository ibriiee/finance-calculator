import { createClient } from '@/lib/supabase/server'
import { formatCurrency, shortDate, ownershipForEmail } from '@/lib/utils'
import Link from 'next/link'
import { ArrowRight, HandHeart, Scale, ArrowLeftRight, Target, LogOut, CreditCard, Scissors, ScrollText, Landmark, BarChart3 } from 'lucide-react'
import StatusBadge from '@/components/shared/StatusBadge'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // All independent reads in parallel — these were sequential before and
  // made every "back to home" navigation feel slow.
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0)
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
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user!.id).single(),
    supabase.from('profiles').select('id, display_name') as any,
    supabase.from('income_projects')
      .select('amount, status, currency, ownership')
      .gte('work_completed_date', monthStart.toISOString().split('T')[0])
      .in('ownership', ['ibrahim', 'abu_bakar', 'shared']),
    supabase.from('sadaka_entries')
      .select('amount_owed, amount_given, currency')
      .eq('owner_id', user!.id)
      .eq('is_joint', false),
    supabase.from('brother_ledger')
      .select('from_user_id, to_user_id, amount, currency')
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
      .select('id, loan_type, currency_type, original_amount, status')
      .eq('owner_id', user!.id)
      .neq('status', 'cleared'),
    supabase.from('joint_accounts').select('id, name, currency').eq('is_active', true),
    supabase.from('joint_account_txns').select('account_id, txn_type, contributor_id, amount'),
    supabase.from('savings_entries').select('currency, txn_type, amount').eq('owner_id', user!.id),
  ]) as any[]
  const otherProfile = (profiles as Array<{ id: string; display_name: string | null }> | null)
    ?.find(p => p.id !== user!.id)

  const myOwnership = ownershipForEmail(user!.email ?? profile?.email)
  const myIncome = monthIncome?.filter((i: any) =>
    i.ownership === 'shared' || i.ownership === myOwnership
  ) ?? []

  const totalEarned = myIncome.filter((i: any) => i.currency === 'AED').reduce((s: number, i: any) => s + i.amount, 0)
  const totalReceived = myIncome.filter((i: any) => i.status === 'received' && i.currency === 'AED').reduce((s: number, i: any) => s + i.amount, 0)

  // Sadaka pending — same netting as the Sadaka module: per currency,
  // advances (given > owed) offset new obligations
  const netPending = (cur: string) => {
    const list = (sadakaEntries ?? []).filter(e => e.currency === cur)
    const owed = list.reduce((s, e) => s + Number(e.amount_owed), 0)
    const given = list.reduce((s, e) => s + Number(e.amount_given), 0)
    return Math.max(0, owed - given)
  }
  const sadakaOwedAed = netPending('AED')
  const sadakaOwedPkr = netPending('PKR')

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
    return { ...g, saved, pct: Math.min(100, Math.round((saved / g.target_amount) * 100)) }
  })
  let loanDebtAed = 0
  ;(loansData ?? []).forEach((l: any) => {
    if (l.loan_type === 'i_owe' && l.currency_type === 'AED') {
      const repaid = (repays ?? []).filter((r: any) => r.loan_id === l.id).reduce((s: number, r: any) => s + Number(r.amount), 0)
      loanDebtAed += Math.max(0, Number(l.original_amount) - repaid)
    }
  })
  const ledgerDebtAed = aedBalance < 0 ? -aedBalance : 0
  const totalOwedAed = loanDebtAed + ledgerDebtAed
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

      {/* Income summary card */}
      {enabled('income') && (
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <span className="section-label">This Month</span>
          <Link href="/income" className="text-xs" style={{ color: 'var(--gold)' }}>View all →</Link>
        </div>
        <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Earned</p>
        <p className="font-display text-4xl font-semibold text-gold-gradient leading-tight">
          {formatCurrency(totalEarned, 'AED', true)}
        </p>
        <div className="divider-rule my-4">✦</div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>Received</p>
            <p className="font-display text-lg font-semibold text-emerald-400">
              {formatCurrency(totalReceived, 'AED', true)}
            </p>
          </div>
          <div>
            <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>Awaiting</p>
            <p className="font-display text-lg font-semibold"
               style={{ color: totalEarned - totalReceived > 0 ? 'var(--amber)' : 'var(--text-muted)' }}>
              {formatCurrency(Math.max(0, totalEarned - totalReceived), 'AED', true)}
            </p>
          </div>
        </div>
      </div>
      )}

      {/* Savings & what you owe — both tap through to their modules */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/savings" className="card p-3 block">
          <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Savings</p>
          <p className="font-display text-lg font-semibold text-emerald-400">{formatCurrency(totalSavingsAed + stashAed, 'AED', true)}</p>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {stashPkr > 0 ? `+ ${formatCurrency(stashPkr, 'PKR', true)} stashed · ` : ''}goals + stash →
          </p>
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
            {pendingProjects.map(p => {
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

      {/* Analytics banner */}
      <Link href="/analytics" className="card p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 size={16} style={{ color: 'var(--gold)' }} />
          <span className="text-sm font-semibold">Analytics</span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>earnings & sadaka insights</span>
        </div>
        <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />
      </Link>

      {/* Quick links — gated by module toggles */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { href: '/joint',   label: 'Joint',   Icon: Landmark,   key: 'joint_account' },
          { href: '/loans',   label: 'Loans',   Icon: CreditCard, key: 'loans' },
          { href: '/splits',  label: 'Splits',  Icon: Scissors,   key: 'splits' },
          { href: '/wasiyya', label: 'Wasiyya', Icon: ScrollText, key: 'wasiyya' },
        ].filter(({ key }) => enabled(key)).map(({ href, label, Icon }) => (
          <Link key={href} href={href}
            className="card-inner p-3 flex flex-col items-center gap-1.5 rounded-xl">
            <Icon size={18} style={{ color: 'var(--gold)' }} />
            <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</span>
          </Link>
        ))}
      </div>

    </div>
  )
}
