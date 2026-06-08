'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, shortDate, getLagDays, getLagColor } from '@/lib/utils'
import ModuleHeader from '@/components/shared/ModuleHeader'
import StatusBadge from '@/components/shared/StatusBadge'
import EmptyState from '@/components/shared/EmptyState'
import LoadingSpinner from '@/components/shared/LoadingSpinner'
import { Plus, Briefcase, Clock } from 'lucide-react'
import IncomeForm from '@/components/income/IncomeForm'
import type { IncomeProject } from '@/types/database.types'

export default function IncomePage() {
  const [items, setItems] = useState<IncomeProject[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter] = useState<'all' | 'pending' | 'received'>('all')
  const supabase = createClient()

  async function load() {
    const { data } = await supabase
      .from('income_projects')
      .select('*')
      .order('work_completed_date', { ascending: false })
    setItems(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = filter === 'all' ? items
    : items.filter(i => filter === 'pending' ? i.status !== 'received' : i.status === 'received')

  const totalEarned = items.filter(i => i.currency === 'AED').reduce((s, i) => s + i.amount, 0)
  const totalPending = items.filter(i => i.status === 'pending' && i.currency === 'AED').reduce((s, i) => s + i.amount, 0)

  if (loading) return <LoadingSpinner />

  return (
    <div className="flex flex-col gap-4 p-4 animate-slide-up">
      <ModuleHeader title="back Income & Projects" subtitle={`${items.length} entries`}
        action={
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold"
            style={{ background: 'var(--gold)', color: '#0a0a0a' }}>
            <Plus size={14} /> Add
          </button>
        } />

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card p-3">
          <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Total Earned (AED)</p>
          <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            {formatCurrency(totalEarned, 'AED', true)}
          </p>
        </div>
        <div className="card p-3">
          <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Pending Payment</p>
          <p className="text-lg font-bold text-amber-400">{formatCurrency(totalPending, 'AED', true)}</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(['all', 'pending', 'received'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className="px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-all"
            style={{
              background: filter === f ? 'var(--gold)' : 'var(--surface-2)',
              color: filter === f ? '#0a0a0a' : 'var(--text-muted)',
            }}>
            {f}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState icon={Briefcase} title="No projects yet"
          description="Add your first income project or gig"
          action={
            <button onClick={() => setShowForm(true)}
              className="px-4 py-2 rounded-xl text-sm font-semibold"
              style={{ background: 'var(--gold)', color: '#0a0a0a' }}>
              Add Income
            </button>
          } />
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(item => {
            const lagDays = getLagDays(item.work_completed_date, item.actual_received_date)
            const lagColor = getLagColor(lagDays)
            const isOverdue = item.status === 'pending' && item.expected_payment_date
              && new Date(item.expected_payment_date) < new Date()

            return (
              <div key={item.id} className="card p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 mr-3">
                    <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{item.name}</p>
                    <p className="text-xs mt-0.5 capitalize" style={{ color: 'var(--text-muted)' }}>
                      {item.type.replace('_', ' ')} Â· {item.ownership === 'shared' ? 'Shared' : item.ownership === 'ibrahim' ? 'Ibrahim' : 'Abu Bakar'}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-base font-bold" style={{ color: 'var(--gold)' }}>
                      {formatCurrency(item.amount, item.currency)}
                    </span>
                    <StatusBadge status={item.status} size="xs" />
                  </div>
                </div>

                {/* Lag visualiser */}
                <div className="flex items-center gap-2 mt-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                  <Clock size={11} className={lagColor} />
                  <div className="flex items-center gap-1 text-xs flex-wrap">
                    <span style={{ color: 'var(--text-muted)' }}>Worked {shortDate(item.work_completed_date)}</span>
                    {item.expected_payment_date && (
                      <>
                        <span style={{ color: 'var(--border)' }}>Â·</span>
                        <span className={isOverdue ? 'text-red-400' : ''} style={{ color: isOverdue ? undefined : 'var(--text-muted)' }}>
                          {isOverdue ? 'âš  Due ' : 'Due '}{shortDate(item.expected_payment_date)}
                        </span>
                      </>
                    )}
                    {item.actual_received_date && (
                      <>
                        <span style={{ color: 'var(--border)' }}>Â·</span>
                        <span className="text-emerald-400">Rcvd {shortDate(item.actual_received_date)}</span>
                      </>
                    )}
                    <span style={{ color: 'var(--border)' }}>Â·</span>
                    <span className={lagColor}>{lagDays}d lag</span>
                  </div>
                </div>

                {/* Mark received button */}
                {item.status === 'pending' && (
                  <button
                    onClick={async () => {
                      await supabase.from('income_projects').update({
                        status: 'received',
                        actual_received_date: new Date().toISOString().split('T')[0]
                      }).eq('id', item.id)
                      load()
                    }}
                    className="mt-3 w-full py-2 rounded-lg text-xs font-semibold transition-all"
                    style={{ background: 'rgba(16,185,129,0.15)', color: '#10B981' }}>
                    âœ“ Mark as Received
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showForm && <IncomeForm onClose={() => setShowForm(false)} onSaved={load} />}
    </div>
  )
}

