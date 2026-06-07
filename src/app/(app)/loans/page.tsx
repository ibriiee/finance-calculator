'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, shortDate } from '@/lib/utils'
import ModuleHeader from '@/components/shared/ModuleHeader'
import StatusBadge from '@/components/shared/StatusBadge'
import EmptyState from '@/components/shared/EmptyState'
import LoadingSpinner from '@/components/shared/LoadingSpinner'
import { Plus, CreditCard } from 'lucide-react'
import LoanForm from '@/components/loans/LoanForm'
import type { Loan } from '@/types/database.types'

const RATES_DEFAULTS = { gold_aed_gram: 330, silver_aed_gram: 3.8 }

export default function LoansPage() {
  const [loans, setLoans] = useState<Loan[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [rates, setRates] = useState(RATES_DEFAULTS)
  const supabase = createClient()

  async function load() {
    const [{ data: l }, { data: r }] = await Promise.all([
      supabase.from('loans').select('*').order('created_at', { ascending: false }),
      supabase.from('rates_cache').select('*'),
    ])
    setLoans(l ?? [])
    if (r) {
      const rMap: Record<string, number> = {}
      r.forEach((row: any) => { rMap[row.rate_type] = row.rate_value })
      setRates({ gold_aed_gram: rMap.gold_aed_gram ?? 330, silver_aed_gram: rMap.silver_aed_gram ?? 3.8 })
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const outstanding = loans.filter(l => l.status !== 'cleared')
  const iOwe = outstanding.filter(l => l.loan_type === 'i_owe')
  const theyOwe = outstanding.filter(l => l.loan_type === 'they_owe')

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

  if (loading) return <LoadingSpinner />

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

      {loans.length === 0 ? (
        <EmptyState icon={CreditCard} title="No loans recorded"
          description="Track loans you owe or are owed — with Islamic repayment rules" />
      ) : (
        <div className="flex flex-col gap-3">
          {loans.map(loan => {
            const isOverdue = loan.due_date && new Date(loan.due_date) < new Date() && loan.status !== 'cleared'
            const isGold = ['gold_grams', 'silver_grams'].includes(loan.currency_type)
            return (
              <div key={loan.id} className="card p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 mr-3">
                    <div className="flex items-center gap-2 mb-1">
                      <StatusBadge status={loan.loan_type === 'i_owe' ? 'outstanding' : 'given'}
                        label={loan.loan_type === 'i_owe' ? 'I Owe' : loan.loan_type === 'they_owe' ? 'They Owe' : 'Joint'} size="xs" />
                      <StatusBadge status={loan.status} size="xs" />
                      {loan.loan_type === 'joint' && <StatusBadge status="joint" size="xs" />}
                    </div>
                    <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{loan.counterparty_name}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      Taken {shortDate(loan.date_taken)}
                      {loan.due_date && ` · Due ${shortDate(loan.due_date)}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-bold" style={{ color: isGold ? 'var(--gold)' : 'var(--text-primary)' }}>
                      {getReturnDisplay(loan)}
                    </p>
                    {isGold && (
                      <p className="text-xs text-amber-400">Today's value (Qard rule)</p>
                    )}
                  </div>
                </div>
                {isOverdue && (
                  <div className="mt-2 px-3 py-1.5 rounded-lg text-xs text-red-400" style={{ background: 'rgba(239,68,68,0.1)' }}>
                    ⚠ Overdue
                  </div>
                )}
                {loan.notes && (
                  <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>{loan.notes}</p>
                )}
                {loan.status !== 'cleared' && (
                  <button onClick={async () => {
                    await supabase.from('loans').update({ status: 'cleared' }).eq('id', loan.id)
                    load()
                  }} className="mt-3 w-full py-2 rounded-lg text-xs font-semibold"
                     style={{ background: 'rgba(16,185,129,0.15)', color: '#10B981' }}>
                    ✓ Mark Cleared
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showForm && <LoanForm onClose={() => setShowForm(false)} onSaved={load} />}
    </div>
  )
}
