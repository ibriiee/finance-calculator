import { createClient } from '@/lib/supabase/server'
import { formatCurrency, shortDate } from '@/lib/utils'
import Link from 'next/link'
import { ArrowRight, TrendingUp, HandHeart, Scale, ArrowLeftRight, Target, AlertCircle, LogOut, CreditCard, Scissors, ScrollText, Landmark, BarChart3 } from 'lucide-react'
import StatusBadge from '@/components/shared/StatusBadge'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch profile
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user!.id).single()
  const { data: profiles } = await supabase.from('profiles').select('id, display_name') as { data: Array<{ id: string; display_name: string | null }> | null }
  const otherProfile = profiles?.find(p => p.id !== user!.id)

  // Income this month
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0)
  const { data: monthIncome } = await supabase.from('income_projects')
    .select('amount, status, currency, ownership')
    .gte('work_completed_date', monthStart.toISOString().split('T')[0])
    .in('ownership', ['ibrahim', 'abu_bakar', 'shared'])

  const myIncome = monthIncome?.filter(i =>
    i.ownership === 'shared' ||
    (i.ownership === 'ibrahim' && profile?.display_name === 'Ibrahim') ||
    (i.ownership === 'abu_bakar' && profile?.display_name === 'Abu Bakar')
  ) ?? []

  const totalEarned = myIncome.filter(i => i.currency === 'AED').reduce((s, i) => s + i.amount, 0)
  const totalReceived = myIncome.filter(i => i.status === 'received' && i.currency === 'AED').reduce((s, i) => s + i.amount, 0)

  // Sadaka pending
  const { data: sadakaPending } = await supabase.from('sadaka_entries')
    .select('amount_owed, amount_given, currency')
    .eq('owner_id', user!.id)
    .in('status', ['pending', 'partially_given'])

  const sadakaOwed = sadakaPending?.reduce((s, e) => s + e.amount_owed - e.amount_given, 0) ?? 0

  // Brother ledger balance
  const { data: ledgerEntries } = await supabase.from('brother_ledger')
    .select('from_user_id, to_user_id, amount, currency')
    .eq('is_settled', false)

  let aedBalance = 0, pkrBalance = 0
  ledgerEntries?.forEach(e => {
    const sign = e.from_user_id === user!.id ? 1 : -1
    if (e.currency === 'AED') aedBalance += sign * e.amount
    if (e.currency === 'PKR') pkrBalance += sign * e.amount
  })

  // Pending income projects
  const { data: pendingProjects } = await supabase.from('income_projects')
    .select('id, name, amount, currency, expected_payment_date, work_completed_date')
    .eq('owner_id', user!.id)
    .eq('status', 'pending')
    .order('expected_payment_date', { ascending: true })
    .limit(3)

  // Zakat status
  const { data: latestZakat } = await supabase.from('zakat_snapshots')
    .select('is_wajib, zakat_due_aed, snapshot_year')
    .eq('owner_id', user!.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  // Goals
  const { data: goals } = await supabase.from('financial_goals')
    .select('id, name, target_amount, currency, target_date, is_active')
    .or(`owner_id.eq.${user!.id},goal_type.eq.joint`)
    .eq('is_active', true)
    .limit(3)

  const { data: contributions } = goals?.length
    ? await supabase.from('goal_contributions').select('goal_id, amount')
    : { data: [] }

  const goalProgress = goals?.map(g => {
    const saved = contributions?.filter(c => c.goal_id === g.id).reduce((s, c) => s + c.amount, 0) ?? 0
    return { ...g, saved, pct: Math.min(100, Math.round((saved / g.target_amount) * 100)) }
  })

  const userName = profile?.display_name ?? 'Ibrahim'
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="flex flex-col gap-4 p-4 animate-slide-up">

      {/* Header */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{greeting}</p>
          <h1 className="text-xl font-bold text-gold-gradient">{userName} ✦</h1>
        </div>
        <form action="/api/logout" method="POST">
          <button className="p-2 rounded-xl" style={{ background: 'var(--surface-2)' }}>
            <LogOut size={16} style={{ color: 'var(--text-muted)' }} />
          </button>
        </form>
      </div>

      {/* Income summary card */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} style={{ color: 'var(--gold)' }} />
            <span className="text-sm font-semibold">This Month</span>
          </div>
          <Link href="/income" className="text-xs" style={{ color: 'var(--gold)' }}>View all →</Link>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="card-inner p-3">
            <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Earned</p>
            <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              {formatCurrency(totalEarned, 'AED', true)}
            </p>
          </div>
          <div className="card-inner p-3">
            <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Received</p>
            <p className="text-lg font-bold text-emerald-400">
              {formatCurrency(totalReceived, 'AED', true)}
            </p>
          </div>
        </div>
        {totalEarned - totalReceived > 0 && (
          <div className="mt-2 px-3 py-2 rounded-lg flex items-center gap-2"
               style={{ background: 'rgba(245,158,11,0.1)' }}>
            <AlertCircle size={12} className="text-amber-400 shrink-0" />
            <span className="text-xs text-amber-400">
              {formatCurrency(totalEarned - totalReceived, 'AED', true)} still pending payment
            </span>
          </div>
        )}
      </div>

      {/* Brother Ledger */}
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
                <span className={`text-base font-bold ${aedBalance > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatCurrency(Math.abs(aedBalance), 'AED')}
                </span>
              </div>
            )}
            {pkrBalance !== 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {pkrBalance > 0 ? `${otherProfile?.display_name} owes you` : `You owe ${otherProfile?.display_name}`}
                </span>
                <span className={`text-base font-bold ${pkrBalance > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatCurrency(Math.abs(pkrBalance), 'PKR')}
                </span>
              </div>
            )}
          </div>
        )}
      </Link>

      {/* Sadaka */}
      <Link href="/sadaka" className="card p-4 block">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <HandHeart size={16} style={{ color: 'var(--gold)' }} />
            <span className="text-sm font-semibold">Sadaka</span>
          </div>
          <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />
        </div>
        {sadakaOwed > 0 ? (
          <div className="flex items-center justify-between">
            <span className="text-xs animate-pulse-gold" style={{ color: 'var(--gold)' }}>Pending charity</span>
            <span className="text-base font-bold" style={{ color: 'var(--gold)' }}>
              {formatCurrency(sadakaOwed, 'AED', true)}
            </span>
          </div>
        ) : (
          <p className="text-sm text-emerald-400 font-medium">All Sadaka given ✓</p>
        )}
      </Link>

      {/* Goals preview */}
      {goalProgress && goalProgress.length > 0 && (
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

      {/* Pending payments */}
      {pendingProjects && pendingProjects.length > 0 && (
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

      {/* Quick links */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { href: '/joint',   label: 'Joint',   Icon: Landmark },
          { href: '/loans',   label: 'Loans',   Icon: CreditCard },
          { href: '/splits',  label: 'Splits',  Icon: Scissors },
          { href: '/wasiyya', label: 'Wasiyya', Icon: ScrollText },
        ].map(({ href, label, Icon }) => (
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
