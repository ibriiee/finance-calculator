'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, shortDate } from '@/lib/utils'
import ModuleHeader from '@/components/shared/ModuleHeader'
import EmptyState from '@/components/shared/EmptyState'
import LoadingSpinner from '@/components/shared/LoadingSpinner'
import LoadError from '@/components/shared/LoadError'
import { Plus, CreditCard, UserRound, ArrowLeftRight, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import LoanForm from '@/components/loans/LoanForm'
import { validateAmount } from '@/lib/utils'
import type { Loan } from '@/types/database.types'

const RATES_DEFAULTS = { gold_aed_gram: 472, silver_aed_gram: 5.9 }

export default function LoansPage() {
  const [loans, setLoans] = useState<Loan[]>([])
  const [repays, setRepays] = useState<{ loan_id: string; amount: number }[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [userId, setUserId] = useState('')
  const [ledgerDebt, setLedgerDebt] = useState<{ currency: string; amount: number; toName: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [rates, setRates] = useState(RATES_DEFAULTS)
  const [visibleMine, setVisibleMine] = useState(50)
  const [visibleBrother, setVisibleBrother] = useState(50)
  const supabase = createClient()

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    setUserId(user!.id)
    const [{ data: l, error }, { data: r }, { data: profs }, { data: reps }, { data: ledger }] = await Promise.all([
      supabase.from('loans').select('*').order('created_at', { ascending: false }),
      supabase.from('rates_cache').select('*'),
      supabase.from('profiles').select('id, display_name'),
      supabase.from('loan_repayments').select('loan_id, amount'),
      supabase.from('brother_ledger').select('from_user_id, to_user_id, amount, currency').eq('is_settled', false),
    ])
    if (error) { setLoadError(true); setLoading(false); return }
    setLoadError(false)
    setLoans(l ?? [])
    setRepays((reps as any) ?? [])
    const nameMap: Record<string, string> = {}
    ;(profs ?? []).forEach((p: any) => { nameMap[p.id] = p.display_name ?? 'User' })
    setNames(nameMap)
    if (r) {
      const rMap: Record<string, number> = {}
      r.forEach((row: any) => { rMap[row.rate_type] = row.rate_value })
      setRates({ gold_aed_gram: rMap.gold_aed_gram ?? 472, silver_aed_gram: rMap.silver_aed_gram ?? 5.9 })
    }
    // What I owe my brother on the ledger (per currency)
    const byCur: Record<string, number> = {}
    let otherId = ''
    ;(ledger ?? []).forEach((e: any) => {
      const sign = e.from_user_id === user!.id ? 1 : -1
      if (sign < 0) otherId = e.from_user_id
      else otherId = otherId || e.to_user_id
      byCur[e.currency] = (byCur[e.currency] ?? 0) + sign * Number(e.amount)
    })
    setLedgerDebt(Object.entries(byCur)
      .filter(([, v]) => v < 0)
      .map(([currency, v]) => ({ currency, amount: -v, toName: nameMap[otherId] ?? 'your brother' })))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const myLoans = loans.filter(l => l.owner_id === userId || !l.owner_id)
  const brotherLoans = loans.filter(l => l.owner_id && l.owner_id !== userId)
  const outstanding = myLoans.filter(l => l.status !== 'cleared')
  const iOwe = outstanding.filter(l => l.loan_type === 'i_owe')
  const theyOwe = outstanding.filter(l => l.loan_type === 'they_owe')

  function repaidFor(loanId: string) {
    return repays.filter(r => r.loan_id === loanId).reduce((s, r) => s + Number(r.amount), 0)
  }

  // "You owe" grouped by person — loans I owe, net of repayments, per currency
  const owedByPerson: Record<string, Record<string, number>> = {}
  iOwe.forEach(l => {
    const remaining = Math.max(0, Number(l.original_amount) - repaidFor(l.id))
    if (remaining <= 0) return
    owedByPerson[l.counterparty_name] = owedByPerson[l.counterparty_name] ?? {}
    owedByPerson[l.counterparty_name][l.currency_type] = (owedByPerson[l.counterparty_name][l.currency_type] ?? 0) + remaining
  })

  function getReturnDisplay(loan: Loan) {
    if (loan.currency_type === 'gold_grams') {
      const val = loan.original_amount * rates.gold_aed_gram
      return `${loan.original_amount}g gold = AED ${val.toLocaleString()}`
    }
    if (loan.currency_type === 'silver_grams') {
      const val = loan.original_amount * rates.silver_aed_gram
      return `${loan.original_amount}g silver = AED ${val.toLocaleString()}`
    }
    return formatCurrency(loan.original_amount, loan.currency_type)
  }

  function LoanCard({ loan, mine }: { loan: Loan; mine: boolean }) {
    const [showRepay, setShowRepay] = useState(false)
    const [repayAmount, setRepayAmount] = useState('')
    const [repayDate, setRepayDate] = useState(new Date().toISOString().split('T')[0])
    const [repaying, setRepaying] = useState(false)
    const [repayError, setRepayError] = useState('')
    const isOverdue = loan.due_date && new Date(loan.due_date) < new Date() && loan.status !== 'cleared'
    const isGold = ['gold_grams', 'silver_grams'].includes(loan.currency_type)
    const addedBy = (loan as any).added_by_id as string | null
    const addedByOther = addedBy && addedBy !== userId
    const canEdit = loan.owner_id === userId || addedBy === userId
    const repaid = repaidFor(loan.id)
    const original = Number(loan.original_amount)
    const remaining = Math.max(0, original - repaid)
    const repaidPct = original > 0 ? Math.min(100, Math.round((repaid / original) * 100)) : 0

    async function logRepayment() {
      const amtErr = validateAmount(repayAmount)
      if (amtErr) { setRepayError(amtErr); return }
      setRepaying(true); setRepayError('')
      const amt = parseFloat(repayAmount)
      const { error } = await supabase.from('loan_repayments').insert({
        loan_id: loan.id, amount: amt,
        repayment_date: repayDate, notes: null,
      } as any)
      if (error) { setRepaying(false); setRepayError('Could not save repayment: ' + error.message); return }
      const newRepaid = repaid + amt
      const newStatus = newRepaid >= original ? 'cleared' : 'partial'
      const { error: statusErr } = await supabase.from('loans').update({ status: newStatus }).eq('id', loan.id)
      setRepaying(false)
      if (statusErr) { setRepayError('Repayment saved, but the card status could not update: ' + statusErr.message); return }
      setRepayAmount(''); setShowRepay(false); load()
    }

    // green = cleared, red = still outstanding (needs action)
    const borderColor = loan.status === 'cleared' ? '#10B981' : '#EF4444'
    const typeLabel = loan.loan_type === 'i_owe' ? (mine ? 'I Owe' : `${names[loan.owner_id] ?? 'They'} Owes`) : loan.loan_type === 'they_owe' ? 'They Owe' : 'Joint'
    return (
      <div className="card p-4" style={{ borderLeft: `3px solid ${borderColor}` }}>
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 mr-3">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>{typeLabel}</span>
            </div>
            <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{loan.counterparty_name}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Taken {shortDate(loan.date_taken)}
              {loan.due_date && ` · Due ${shortDate(loan.due_date)}`}
            </p>
            {addedBy && (
              <p className="text-[11px] mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full"
                style={{ background: addedByOther ? 'var(--gold-dim)' : 'var(--surface-2)', color: addedByOther ? 'var(--gold)' : 'var(--text-muted)' }}>
                <UserRound size={10} /> Added by {addedBy === userId ? 'you' : (names[addedBy] ?? 'your brother')}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-base font-bold" style={{ color: isGold ? 'var(--gold)' : 'var(--text-primary)' }}>
              {remaining > 0 ? formatCurrency(remaining, loan.currency_type) : getReturnDisplay(loan)}
            </p>
            {isGold && <p className="text-xs text-amber-400">Today's value (Qard rule)</p>}
            {repaid > 0 && <p className="text-xs text-emerald-400">{repaidPct}% repaid</p>}
          </div>
        </div>

        {/* Repayment progress bar */}
        {!isGold && repaid > 0 && (
          <div className="mt-2 mb-1">
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${repaidPct}%`, background: repaidPct === 100 ? '#10B981' : 'var(--gold)' }} />
            </div>
            <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
              {formatCurrency(repaid, loan.currency_type, true)} of {formatCurrency(original, loan.currency_type, true)} repaid
            </p>
          </div>
        )}

        {isOverdue && (
          <div className="mt-2 px-3 py-1.5 rounded-lg text-xs text-red-400" style={{ background: 'rgba(239,68,68,0.1)' }}>
            ⚠ Overdue
          </div>
        )}
        {loan.notes && <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>{loan.notes}</p>}

        {loan.status !== 'cleared' && canEdit && (
          <div className="mt-3 flex flex-col gap-2">
            <button onClick={() => setShowRepay(s => !s)}
              className="w-full py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5"
              style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
              {showRepay ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              Log Repayment
            </button>

            {showRepay && (
              <div className="flex flex-col gap-2 p-3 rounded-xl" style={{ background: 'var(--surface-2)' }}>
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" placeholder="Amount" value={repayAmount} onChange={e => setRepayAmount(e.target.value)}
                    className="px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--background)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
                  <input type="date" value={repayDate} onChange={e => setRepayDate(e.target.value)}
                    className="px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--background)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
                </div>
                <button onClick={logRepayment} disabled={repaying || !repayAmount}
                  className="w-full py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5"
                  style={{ background: 'rgba(16,185,129,0.15)', color: '#10B981' }}>
                  {repaying && <Loader2 size={12} className="animate-spin" />}
                  Save Repayment
                </button>
                {repayError && <p className="text-[11px]" style={{ color: '#EF4444' }}>⚠ {repayError}</p>}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  if (loading) return <LoadingSpinner />
  if (loadError) return (
    <div className="flex flex-col gap-4 animate-slide-up">
      <ModuleHeader title="Loans" />
      <LoadError onRetry={load} />
    </div>
  )

  return (
    <div className="flex flex-col gap-4 p-4 animate-slide-up">
      <ModuleHeader title="Loans" subtitle={`${outstanding.length} outstanding`}
        action={
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold"
            style={{ background: 'var(--gold)', color: '#0a0a0a' }}>
            <Plus size={14} /> Add
          </button>
        } />

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card p-3">
          <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>I Owe</p>
          <p className="text-lg font-bold text-red-400">{iOwe.length} loan{iOwe.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="card p-3">
          <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Owed to Me</p>
          <p className="text-lg font-bold text-emerald-400">{theyOwe.length} loan{theyOwe.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Who you owe — person by person */}
      {(Object.keys(owedByPerson).length > 0 || ledgerDebt.length > 0) && (
        <div className="card p-4">
          <p className="section-label mb-3">You owe — by person</p>
          <div className="flex flex-col gap-2">
            {Object.entries(owedByPerson).map(([person, byCur]) => (
              <div key={person} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                  <UserRound size={13} style={{ color: 'var(--text-muted)' }} /> {person}
                </span>
                <span className="font-display font-semibold text-red-400">
                  {Object.entries(byCur).map(([cur, amt]) =>
                    cur === 'gold_grams' ? `${amt}g gold` : cur === 'silver_grams' ? `${amt}g silver` : formatCurrency(amt, cur, true)
                  ).join(' · ')}
                </span>
              </div>
            ))}
            {ledgerDebt.map(d => (
              <Link key={d.currency} href="/ledger" className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                  <ArrowLeftRight size={13} style={{ color: 'var(--text-muted)' }} /> {d.toName} (brother ledger) →
                </span>
                <span className="font-display font-semibold text-red-400">{formatCurrency(d.amount, d.currency, true)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {loans.length === 0 ? (
        <EmptyState icon={CreditCard} title="No loans recorded"
          description="Track loans you owe or are owed — with Islamic repayment rules" />
      ) : (
        <div className="flex flex-col gap-3">
          {myLoans.slice(0, visibleMine).map(loan => <LoanCard key={loan.id} loan={loan} mine />)}
          {myLoans.length > visibleMine && (
            <button onClick={() => setVisibleMine(v => v + 50)}
              className="py-2.5 rounded-xl text-xs font-semibold"
              style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
              Load more ({myLoans.length - visibleMine} more)
            </button>
          )}
          {brotherLoans.length > 0 && (
            <>
              <p className="section-label mt-2">{names[brotherLoans[0].owner_id] ?? 'Brother'}'s loans</p>
              {brotherLoans.slice(0, visibleBrother).map(loan => <LoanCard key={loan.id} loan={loan} mine={false} />)}
              {brotherLoans.length > visibleBrother && (
                <button onClick={() => setVisibleBrother(v => v + 50)}
                  className="py-2.5 rounded-xl text-xs font-semibold"
                  style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
                  Load more ({brotherLoans.length - visibleBrother} more)
                </button>
              )}
            </>
          )}
        </div>
      )}

      {showForm && <LoanForm onClose={() => setShowForm(false)} onSaved={load} />}
    </div>
  )
}
