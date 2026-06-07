'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, shortDate } from '@/lib/utils'
import ModuleHeader from '@/components/shared/ModuleHeader'
import StatusBadge from '@/components/shared/StatusBadge'
import EmptyState from '@/components/shared/EmptyState'
import LoadingSpinner from '@/components/shared/LoadingSpinner'
import { Plus, Scissors } from 'lucide-react'
import SplitForm from '@/components/splits/SplitForm'
import type { SharedCost } from '@/types/database.types'

export default function SplitsPage() {
  const [splits, setSplits] = useState<SharedCost[]>([])
  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const supabase = createClient()

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    setUserId(user!.id)
    const { data } = await supabase.from('shared_costs').select('*').order('cost_date', { ascending: false })
    setSplits(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const catIcons: Record<string, string> = { house: '🏠', vehicle: '🚗', gift: '🎁', charity: '🤲', investment: '📈', business: '💼', other: '•' }

  if (loading) return <LoadingSpinner />

  return (
    <div className="flex flex-col gap-4 p-4 animate-slide-up">
      <ModuleHeader title="Shared Splits" subtitle="Expenses split between both"
        action={
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold"
            style={{ background: 'var(--gold)', color: '#0a0a0a' }}>
            <Plus size={14} /> Add
          </button>
        } />

      {splits.length === 0 ? (
        <EmptyState icon={Scissors} title="No shared expenses"
          description="Log house rent, car costs, gifts — split the right way" />
      ) : (
        <div className="flex flex-col gap-3">
          {splits.map(split => {
            const ibrahimAmt = split.total_amount * split.ibrahim_pct
            const abuBakarAmt = split.total_amount * (1 - split.ibrahim_pct)
            return (
              <div key={split.id} className="card p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2 flex-1 mr-3">
                    <span className="text-xl">{catIcons[split.category]}</span>
                    <div>
                      <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{split.name}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {shortDate(split.cost_date)}
                        {split.is_recurring && ' · Monthly'}
                        · Paid by {split.paid_by === 'both' ? 'both' : split.paid_by === 'ibrahim' ? 'Ibrahim' : 'Abu Bakar'}
                      </p>
                    </div>
                  </div>
                  <span className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                    {formatCurrency(split.total_amount, split.currency)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="card-inner p-2.5 text-center">
                    <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>Ibrahim</p>
                    <p className="text-sm font-bold" style={{ color: 'var(--gold)' }}>
                      {formatCurrency(ibrahimAmt, split.currency)}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{(split.ibrahim_pct * 100).toFixed(0)}%</p>
                  </div>
                  <div className="card-inner p-2.5 text-center">
                    <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>Abu Bakar</p>
                    <p className="text-sm font-bold" style={{ color: 'var(--gold)' }}>
                      {formatCurrency(abuBakarAmt, split.currency)}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{((1 - split.ibrahim_pct) * 100).toFixed(0)}%</p>
                  </div>
                </div>

                {!split.ledger_entry_created && split.paid_by !== 'both' && (
                  <button onClick={async () => {
                    const payerId = split.paid_by === 'ibrahim' ? userId : 'other'
                    // Push to brother ledger
                    const { data: { user } } = await supabase.auth.getUser()
                    const otherShare = split.paid_by === 'ibrahim' ? abuBakarAmt : ibrahimAmt
                    // Get other user id
                    const { data: profiles } = await supabase.from('profiles').select('id').neq('id', user!.id).single()
                    if (profiles) {
                      await supabase.from('brother_ledger').insert({
                        from_user_id: split.paid_by === 'ibrahim' ? user!.id : profiles.id,
                        to_user_id: split.paid_by === 'ibrahim' ? profiles.id : user!.id,
                        amount: otherShare, currency: split.currency,
                        category: 'shared_cost', description: `Split: ${split.name}`,
                        transaction_date: split.cost_date, source_type: 'shared_split', source_id: split.id, is_settled: false,
                      })
                      await supabase.from('shared_costs').update({ ledger_entry_created: true }).eq('id', split.id)
                      load()
                    }
                  }} className="mt-3 w-full py-2 rounded-lg text-xs font-semibold"
                     style={{ background: 'var(--gold-dim)', color: 'var(--gold)' }}>
                    → Push to Ledger
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showForm && <SplitForm onClose={() => setShowForm(false)} onSaved={load} />}
    </div>
  )
}
