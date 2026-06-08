'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, shortDate, getLagDays, getLagColor } from '@/lib/utils'
import ModuleHeader from '@/components/shared/ModuleHeader'
import StatusBadge from '@/components/shared/StatusBadge'
import EmptyState from '@/components/shared/EmptyState'
import LoadingSpinner from '@/components/shared/LoadingSpinner'
import { Plus, Briefcase, Clock, Pencil, Trash2, HandHeart, Check } from 'lucide-react'
import IncomeForm from '@/components/income/IncomeForm'
import type { IncomeProject } from '@/types/database.types'

export default function IncomePage() {
  const [items, setItems] = useState<IncomeProject[]>([])
  const [sadakaByIncome, setSadakaByIncome] = useState<Record<string, { owed: number; given: number }>>({})
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<IncomeProject | null>(null)
  const [filter, setFilter] = useState<'all' | 'pending' | 'received'>('all')
  const supabase = createClient()

  async function load() {
    const [{ data }, { data: sadaka }] = await Promise.all([
      supabase.from('income_projects').select('*').order('created_at', { ascending: false }),
      supabase.from('sadaka_entries').select('source_income_id, amount_owed, amount_given'),
    ])
    setItems(data ?? [])
    const map: Record<string, { owed: number; given: number }> = {}
    ;(sadaka ?? []).forEach((s: any) => {
      if (!s.source_income_id) return
      const m = map[s.source_income_id] ?? { owed: 0, given: 0 }
      m.owed += Number(s.amount_owed); m.given += Number(s.amount_given)
      map[s.source_income_id] = m
    })
    setSadakaByIncome(map)
    setLoading(false)
  }

  async function deleteItem(id: string) {
    if (!confirm('Delete this income entry? Its linked sadaka obligation stays in the Sadaka module.')) return
    await supabase.from('income_projects').delete().eq('id', id)
    load()
  }

  useEffect(() => { load() }, [])

  const filtered = filter === 'all' ? items
    : items.filter(i => filter === 'pending' ? i.status !== 'received' : i.status === 'received')

  const totalEarned = items.filter(i => i.currency === 'AED').reduce((s, i) => s + i.amount, 0)
  const totalPending = items.filter(i => i.status === 'pending' && i.currency === 'AED').reduce((s, i) => s + i.amount, 0)

  if (loading) return <LoadingSpinner />

  return (
    <div className="flex flex-col gap-4 p-4 animate-slide-up">
      <ModuleHeader title="Income & Projects" subtitle={`${items.length} entries`}
        action={
          <button onClick={() => { setEditItem(null); setShowForm(true) }}
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
            <button onClick={() => { setEditItem(null); setShowForm(true) }}
              className="px-4 py-2 rounded-xl text-sm font-semibold"
              style={{ background: 'var(--gold)', color: '#0a0a0a' }}>
              Add Income
            </button>
          } />
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(item => {
            const ongoing = (item as any).is_ongoing || !item.work_completed_date
            const lagDays = item.work_completed_date ? getLagDays(item.work_completed_date, item.actual_received_date) : 0
            const lagColor = getLagColor(lagDays)
            const isOverdue = item.status === 'pending' && item.expected_payment_date
              && new Date(item.expected_payment_date) < new Date()
            const sad = sadakaByIncome[item.id]
            const sadakaPaid = sad ? sad.given >= sad.owed && sad.owed > 0 : false

            return (
              <div key={item.id} className="card p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 mr-3">
                    <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{item.name}</p>
                    <p className="text-xs mt-0.5 capitalize" style={{ color: 'var(--text-muted)' }}>
                      {item.type.replace('_', ' ')} · {item.ownership === 'shared' ? 'Shared' : item.ownership === 'ibrahim' ? 'Ibrahim' : 'Abu Bakar'}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-base font-bold" style={{ color: 'var(--gold)' }}>
                      {formatCurrency(item.amount, item.currency)}
                    </span>
                    <div className="flex items-center gap-1">
                      {ongoing && <StatusBadge status="pending" label="Ongoing" size="xs" />}
                      <StatusBadge status={item.status} size="xs" />
                    </div>
                  </div>
                </div>

                {/* Sadaka status for this earning */}
                {sad && sad.owed > 0 && (
                  <div className="flex items-center gap-1.5 text-xs mb-1">
                    <HandHeart size={11} style={{ color: sadakaPaid ? '#10B981' : 'var(--gold)' }} />
                    <span style={{ color: sadakaPaid ? '#10B981' : 'var(--gold)' }}>
                      {sadakaPaid
                        ? `Sadaka paid (${formatCurrency(sad.given, item.currency, true)})`
                        : `Sadaka ${formatCurrency(sad.given, item.currency, true)}/${formatCurrency(sad.owed, item.currency, true)} given`}
                    </span>
                  </div>
                )}

                {/* Lag visualiser */}
                <div className="flex items-center gap-2 mt-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                  <Clock size={11} className={lagColor} />
                  <div className="flex items-center gap-1 text-xs flex-wrap">
                    {(item as any).work_started_date && (
                      <><span style={{ color: 'var(--text-muted)' }}>Started {shortDate((item as any).work_started_date)}</span><span style={{ color: 'var(--border)' }}>·</span></>
                    )}
                    <span style={{ color: 'var(--text-muted)' }}>
                      {ongoing ? 'In progress' : `Done ${shortDate(item.work_completed_date)}`}
                    </span>
                    {item.expected_payment_date && (
                      <>
                        <span style={{ color: 'var(--border)' }}>·</span>
                        <span className={isOverdue ? 'text-red-400' : ''} style={{ color: isOverdue ? undefined : 'var(--text-muted)' }}>
                          {isOverdue ? '⚠ Due ' : 'Due '}{shortDate(item.expected_payment_date)}
                        </span>
                      </>
                    )}
                    {item.actual_received_date && (
                      <>
                        <span style={{ color: 'var(--border)' }}>·</span>
                        <span className="text-emerald-400">Rcvd {shortDate(item.actual_received_date)}</span>
                      </>
                    )}
                    <span style={{ color: 'var(--border)' }}>·</span>
                    <span className={lagColor}>{lagDays}d lag</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 mt-3">
                  {item.status === 'pending' && (
                    <button
                      onClick={async () => {
                        await supabase.from('income_projects').update({
                          status: 'received',
                          actual_received_date: new Date().toISOString().split('T')[0]
                        }).eq('id', item.id)
                        load()
                      }}
                      className="flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5"
                      style={{ background: 'rgba(16,185,129,0.15)', color: '#10B981' }}>
                      <Check size={12} /> Mark Received
                    </button>
                  )}
                  <button onClick={() => { setEditItem(item); setShowForm(true) }}
                    className="px-3 py-2 rounded-lg" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => deleteItem(item.id)}
                    className="px-3 py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showForm && <IncomeForm onClose={() => { setShowForm(false); setEditItem(null) }} onSaved={load} editItem={editItem} />}
    </div>
  )
}
