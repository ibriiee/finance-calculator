'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, shortDate } from '@/lib/utils'
import ModuleHeader from '@/components/shared/ModuleHeader'
import EmptyState from '@/components/shared/EmptyState'
import LoadingSpinner from '@/components/shared/LoadingSpinner'
import LoadError from '@/components/shared/LoadError'
import { Plus, Landmark, ArrowDownCircle, ArrowUpCircle, Building2, Pencil, Trash2, Share2, Check, Bell } from 'lucide-react'
import AccountForm from '@/components/joint/AccountForm'
import TxnForm from '@/components/joint/TxnForm'
import TxnComments from '@/components/joint/TxnComments'

interface Account { id: string; name: string; bank_name: string | null; currency: string; is_active: boolean }
interface Txn { id: string; account_id: string; txn_type: string; contributor_id: string | null; amount: number; description: string | null; category: string | null; txn_date: string; created_by_id: string | null }

export default function JointAccountPage() {
  const supabase = createClient()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [txns, setTxns] = useState<Txn[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [userId, setUserId] = useState('')
  const [pkrToAed, setPkrToAed] = useState(0.0132)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [showAccountForm, setShowAccountForm] = useState(false)
  const [editAccount, setEditAccount] = useState<Account | null>(null)
  const [txnFor, setTxnFor] = useState<Account | null>(null)
  const [editTxn, setEditTxn] = useState<{ acc: Account; txn: Txn } | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [wantAdd, setWantAdd] = useState(false)
  const [equalize, setEqualize] = useState<{ acc: Account; amount: number } | null>(null)
  const [copied, setCopied] = useState('')

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('add')) setWantAdd(true)
  }, [])
  // Quick-add lands before accounts load — open the form once they're in
  useEffect(() => {
    if (wantAdd && accounts.length > 0) { setTxnFor(accounts[0]); setWantAdd(false) }
  }, [wantAdd, accounts])

  async function deleteTxn(txn: Txn, currency: string) {
    const label = txn.txn_type === 'deposit' ? 'deposit' : 'expense'
    if (!confirm(`Delete this ${label} of ${formatCurrency(Number(txn.amount), currency)}? Both of you will see it removed.`)) return
    const { error } = await supabase.from('joint_account_txns').delete().eq('id', txn.id)
    if (error) { alert(`Could not delete: ${error.message}`); return }
    load()
  }

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    setUserId(user!.id)
    const [{ data: accs, error }, { data: tx }, { data: profs }, { data: rate }] = await Promise.all([
      supabase.from('joint_accounts').select('*').eq('is_active', true).order('created_at', { ascending: true }),
      supabase.from('joint_account_txns').select('*').order('txn_date', { ascending: false }),
      supabase.from('profiles').select('id, display_name'),
      supabase.from('rates_cache').select('rate_value').eq('rate_type', 'pkr_to_aed').single(),
    ])
    if (error) { setLoadError(true); setLoading(false); return }
    setLoadError(false)
    setAccounts((accs as any) ?? [])
    setTxns((tx as any) ?? [])
    const map: Record<string, string> = {}
    ;(profs ?? []).forEach((p: any) => { map[p.id] = p.display_name ?? 'User' })
    setNames(map)
    if (rate?.rate_value) setPkrToAed(Number(rate.rate_value))
    setLoading(false)
  }

  useEffect(() => {
    load()
    const ch = supabase.channel('joint_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'joint_account_txns' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'joint_accounts' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  // Convert an amount in `cur` to the opposite currency for display
  function convert(amount: number, cur: string) {
    if (cur === 'AED') return { other: 'PKR', value: amount / pkrToAed }
    return { other: 'AED', value: amount * pkrToAed }
  }

  function accountStats(acc: Account) {
    const t = txns.filter(x => x.account_id === acc.id)
    const deposits = t.filter(x => x.txn_type === 'deposit')
    const withdrawals = t.filter(x => x.txn_type === 'withdrawal')
    const totalIn = deposits.reduce((s, x) => s + Number(x.amount), 0)
    const totalOut = withdrawals.reduce((s, x) => s + Number(x.amount), 0)
    const balance = totalIn - totalOut
    // contributions per person
    const byPerson: Record<string, number> = {}
    deposits.forEach(x => { if (x.contributor_id) byPerson[x.contributor_id] = (byPerson[x.contributor_id] ?? 0) + Number(x.amount) })
    return { t, deposits, withdrawals, totalIn, totalOut, balance, byPerson }
  }

  // Copy text to the clipboard for the user to paste — never sends anything itself.
  async function copyText(text: string, tag: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(tag); setTimeout(() => setCopied(''), 2000)
    } catch { alert('Could not copy — your browser blocked clipboard access.') }
  }

  /**
   * Monthly household statement (#54): this month's contributions, spending by
   * category and fairness per account, as plain WhatsApp-ready text. Reads only
   * what's already loaded — no new query, no money mutation.
   */
  function buildStatement(): string {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const inThisMonth = (d: string) => new Date(d) >= monthStart
    const title = now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    const lines = [`*Household statement — ${title}*`, '']

    accounts.forEach(acc => {
      const t = txns.filter(x => x.account_id === acc.id && inThisMonth(x.txn_date))
      if (t.length === 0) return
      const deps = t.filter(x => x.txn_type === 'deposit')
      const withd = t.filter(x => x.txn_type === 'withdrawal')
      const totalIn = deps.reduce((s, x) => s + Number(x.amount), 0)
      const totalOut = withd.reduce((s, x) => s + Number(x.amount), 0)
      lines.push(`*${acc.name}* (${acc.currency})`)
      lines.push(`In: ${formatCurrency(totalIn, acc.currency)} · Out: ${formatCurrency(totalOut, acc.currency)}`)

      // Who chipped in, this month
      const byPerson: Record<string, number> = {}
      deps.forEach(x => { if (x.contributor_id) byPerson[x.contributor_id] = (byPerson[x.contributor_id] ?? 0) + Number(x.amount) })
      Object.entries(byPerson).forEach(([id, amt]) =>
        lines.push(`• ${names[id] ?? 'Someone'} chipped in ${formatCurrency(amt, acc.currency)}`))

      // Where it went
      const byCat: Record<string, number> = {}
      withd.forEach(x => { const c = x.category ?? 'other'; byCat[c] = (byCat[c] ?? 0) + Number(x.amount) })
      Object.entries(byCat).sort((a, b) => b[1] - a[1]).forEach(([c, amt]) =>
        lines.push(`• ${c.replace(/_/g, ' ')}: ${formatCurrency(amt, acc.currency)}`))

      // Fairness uses the SAME all-time contribution basis as the card above —
      // a month-scoped fairness figure would contradict the on-screen banner.
      const s = accountStats(acc)
      const contribs = Object.keys(names).map(id => ({ id, amount: s.byPerson[id] ?? 0 }))
      const maxC = Math.max(0, ...contribs.map(c => c.amount))
      const behindList = contribs.filter(c => c.amount < maxC)
      if (behindList.length === 0 && s.totalIn > 0) lines.push('Contributions are equal ✓')
      else behindList.forEach(b =>
        lines.push(`${names[b.id] ?? 'Someone'} owes ${formatCurrency(maxC - b.amount, acc.currency)} to be equal (all-time)`))
      lines.push('')
    })

    if (lines.length <= 2) lines.push('No joint activity recorded this month.')
    return lines.join('\n')
  }

  if (loading) return <LoadingSpinner />
  if (loadError) return (
    <div className="flex flex-col gap-4 animate-slide-up">
      <ModuleHeader title="Joint Account" />
      <LoadError onRetry={load} />
    </div>
  )

  const peopleIds = Object.keys(names)

  return (
    <div className="flex flex-col gap-4 p-4 animate-slide-up">
      <ModuleHeader title="Joint Account" subtitle="Shared house expenses"
        action={
          <button onClick={() => setShowAccountForm(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold"
            style={{ background: 'var(--gold)', color: '#0a0a0a' }}>
            <Plus size={14} /> Account
          </button>
        } />

      {/* #54 — monthly household statement, WhatsApp-ready */}
      {accounts.length > 0 && (
        <button onClick={() => copyText(buildStatement(), 'statement')}
          className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
          style={{ background: copied === 'statement' ? 'rgba(16,185,129,0.15)' : 'var(--surface-2)',
            color: copied === 'statement' ? '#10B981' : 'var(--text-secondary)' }}>
          {copied === 'statement'
            ? <><Check size={15} /> Copied — paste into WhatsApp</>
            : <><Share2 size={15} /> Copy this month's statement</>}
        </button>
      )}

      {accounts.length === 0 ? (
        <EmptyState icon={Landmark} title="No joint account yet"
          description="Create a shared house account — both chip in, expenses come out, balance stays clear."
          action={
            <button onClick={() => setShowAccountForm(true)}
              className="px-4 py-2 rounded-xl text-sm font-semibold"
              style={{ background: 'var(--gold)', color: '#0a0a0a' }}>
              Create First Account
            </button>
          } />
      ) : (
        accounts.map(acc => {
          const s = accountStats(acc)
          const conv = convert(s.balance, acc.currency)
          // fairness: who's behind on equal contribution
          const contribs = peopleIds.map(id => ({ id, name: names[id], amount: s.byPerson[id] ?? 0 }))
          const maxC = Math.max(0, ...contribs.map(c => c.amount))
          const behind = contribs.filter(c => c.amount < maxC).map(c => ({ ...c, owes: maxC - c.amount }))
          return (
            <div key={acc.id} className="card p-4">
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Landmark size={15} style={{ color: 'var(--gold)' }} />
                    <h3 className="text-sm font-semibold">{acc.name}</h3>
                  </div>
                  {acc.bank_name && (
                    <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                      <Building2 size={11} /> {acc.bank_name}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => { setEditAccount(acc); setShowAccountForm(true) }} aria-label="Edit account"
                    className="p-1.5 rounded-lg" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
                    <Pencil size={12} />
                  </button>
                  <button onClick={() => setTxnFor(acc)}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1"
                    style={{ background: 'var(--gold-dim)', color: 'var(--gold)' }}>
                    <Plus size={12} /> Txn
                  </button>
                </div>
              </div>

              {/* Balance */}
              <div className="rounded-xl p-3 mb-3" style={{ background: 'var(--surface-2)' }}>
                <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Current balance</p>
                <p className="font-display text-2xl font-semibold" style={{ color: s.balance >= 0 ? 'var(--text-primary)' : '#EF4444' }}>
                  {formatCurrency(s.balance, acc.currency)}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  ≈ {formatCurrency(conv.value, conv.other)}
                </p>
                <div className="flex gap-4 mt-2 text-xs">
                  <span className="text-emerald-400">In {formatCurrency(s.totalIn, acc.currency, true)}</span>
                  <span className="text-red-400">Out {formatCurrency(s.totalOut, acc.currency, true)}</span>
                </div>
              </div>

              {/* Contributions + fairness */}
              <div className="flex flex-col gap-1.5 mb-1">
                {contribs.map(c => (
                  <div key={c.id} className="flex items-center justify-between text-xs">
                    <span style={{ color: 'var(--text-secondary)' }}>{c.id === userId ? `${c.name} (you)` : c.name} chipped in</span>
                    <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{formatCurrency(c.amount, acc.currency, true)}</span>
                  </div>
                ))}
              </div>
              {behind.length > 0 ? (
                behind.map(b => (
                  <div key={b.id} className="flex items-center justify-between gap-2 text-xs mt-1.5 px-2.5 py-1.5 rounded-lg" style={{ background: 'rgba(245,158,11,0.1)', color: '#F59E0B' }}>
                    <span>{b.id === userId ? 'You owe' : `${b.name} owes`} {formatCurrency(b.owes, acc.currency)} to be equal</span>
                    {b.id === userId ? (
                      <button onClick={() => setEqualize({ acc, amount: b.owes })}
                        className="shrink-0 px-2 py-1 rounded-lg font-semibold"
                        style={{ background: 'rgba(16,185,129,0.15)', color: '#10B981' }}>
                        Chip in now
                      </button>
                    ) : (
                      /* #56 — composes the reminder and copies it. You send it. */
                      <button onClick={() => copyText(
                        `Salam ${b.name} — quick reminder about *${acc.name}*: you're ${formatCurrency(b.owes, acc.currency)} behind to be equal on contributions. No rush, just so it's tracked. (via Mizan)`,
                        `nudge-${acc.id}-${b.id}`)}
                        className="shrink-0 px-2 py-1 rounded-lg font-semibold flex items-center gap-1"
                        style={{ background: 'rgba(245,158,11,0.18)', color: '#F59E0B' }}>
                        {copied === `nudge-${acc.id}-${b.id}`
                          ? <><Check size={11} /> Copied</>
                          : <><Bell size={11} /> Remind</>}
                      </button>
                    )}
                  </div>
                ))
              ) : (
                s.totalIn > 0 && <p className="text-xs mt-1.5 text-emerald-400">Contributions are equal ✓</p>
              )}

              {/* History toggle */}
              {s.t.length > 0 && (
                <button onClick={() => setExpanded(expanded === acc.id ? null : acc.id)}
                  className="text-xs mt-3 w-full text-center py-2 rounded-lg" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                  {expanded === acc.id ? 'Hide' : `Show ${s.t.length} transactions`}
                </button>
              )}
              {expanded === acc.id && (
                <div className="flex flex-col gap-2 mt-2">
                  {s.t.map(x => {
                    const isDep = x.txn_type === 'deposit'
                    return (
                      <div key={x.id} className="py-2 px-1 border-t" style={{ borderColor: 'var(--border)' }}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {isDep ? <ArrowDownCircle size={16} className="text-emerald-400" /> : <ArrowUpCircle size={16} className="text-red-400" />}
                          <div>
                            <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                              {x.description ?? (isDep ? 'Deposit' : (x.category ?? 'Expense'))}
                            </p>
                            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                              {isDep && x.contributor_id ? `${names[x.contributor_id] ?? 'User'} · ` : ''}{shortDate(x.txn_date)}
                              {!isDep && x.created_by_id ? ` · by ${x.created_by_id === userId ? 'you' : (names[x.created_by_id] ?? 'other')}` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className={`text-xs font-bold mr-1 ${isDep ? 'text-emerald-400' : 'text-red-400'}`}>
                            {isDep ? '+' : '-'}{formatCurrency(x.amount, acc.currency, true)}
                          </span>
                          <button onClick={() => setEditTxn({ acc, txn: x })} aria-label="Edit transaction"
                            className="p-1.5 rounded-lg" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
                            <Pencil size={12} />
                          </button>
                          <button onClick={() => deleteTxn(x, acc.currency)} aria-label="Delete transaction"
                            className="p-1.5 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                      {/* #51 — notes live next to the number they're about */}
                      <TxnComments txnId={x.id} userId={userId} names={names} />
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })
      )}

      {showAccountForm && <AccountForm onClose={() => { setShowAccountForm(false); setEditAccount(null) }} onSaved={load} editAccount={editAccount} />}
      {txnFor && <TxnForm onClose={() => setTxnFor(null)} onSaved={load} accountId={txnFor.id} accountCurrency={txnFor.currency} />}
      {editTxn && <TxnForm onClose={() => setEditTxn(null)} onSaved={load} accountId={editTxn.acc.id} accountCurrency={editTxn.acc.currency} editTxn={editTxn.txn} />}
      {equalize && <TxnForm onClose={() => setEqualize(null)} onSaved={load} accountId={equalize.acc.id} accountCurrency={equalize.acc.currency} defaultAmount={equalize.amount} />}
    </div>
  )
}
