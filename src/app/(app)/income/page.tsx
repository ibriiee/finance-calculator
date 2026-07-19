'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, shortDate, getLagDays, getLagColor } from '@/lib/utils'
import ModuleHeader from '@/components/shared/ModuleHeader'
import EmptyState from '@/components/shared/EmptyState'
import LoadingSpinner from '@/components/shared/LoadingSpinner'
import LoadError from '@/components/shared/LoadError'
import { Plus, Briefcase, Clock, Pencil, Trash2, HandHeart, Check, Lock, ChevronDown, ChevronUp } from 'lucide-react'
import IncomeForm from '@/components/income/IncomeForm'
import { computeSadaka } from '@/lib/sadaka'
import type { IncomeProject } from '@/types/database.types'

export default function IncomePage() {
  const [items, setItems] = useState<IncomeProject[]>([])
  const [sadakaByIncome, setSadakaByIncome] = useState<Record<string, { owed: number; given: number }>>({})
  // Individual sadaka payments per income — so the breakdown shows WHERE it went,
  // even after the payment cards disappear from the Sadaka tab (once fully given).
  const [paymentsByIncome, setPaymentsByIncome] = useState<Record<string, { name: string; amount: number; date: string | null; currency: string }[]>>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<IncomeProject | null>(null)
  const [filter, setFilter] = useState<'all' | 'pending' | 'received'>('all')
  const [devMode, setDevMode] = useState(false)
  const [showNet, setShowNet] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [visible, setVisible] = useState(50)
  const [pkrToAed, setPkrToAed] = useState(0.0132)
  const supabase = createClient()

  useEffect(() => { setDevMode(localStorage.getItem('mizan_dev_mode') === '1') }, [])

  async function load() {
    const [{ data, error }, { data: sadaka }, { data: rate }] = await Promise.all([
      supabase.from('income_projects').select('*').order('created_at', { ascending: false }),
      supabase.from('sadaka_entries').select('*'),
      supabase.from('rates_cache').select('rate_value').eq('rate_type', 'pkr_to_aed').single(),
    ])
    if (error) { setLoadError(true); setLoading(false); return }
    setLoadError(false)
    if (rate?.rate_value) setPkrToAed(Number(rate.rate_value))
    setItems(data ?? [])
    // Resolve via the shared engine so per-income sadaka matches the Sadaka page exactly.
    const computed = computeSadaka((sadaka as any[]) ?? [])
    const map: Record<string, { owed: number; given: number }> = {}
    ;(sadaka ?? []).forEach((s: any) => {
      if (!s.source_income_id || Number(s.amount_owed) <= 0) return   // obligations only
      const st = computed.byId.get(s.id)
      const m = map[s.source_income_id] ?? { owed: 0, given: 0 }
      m.owed += st?.owed ?? Number(s.amount_owed)
      m.given += st?.given ?? Number(s.amount_given)
      map[s.source_income_id] = m
    })
    setSadakaByIncome(map)
    // Collect each income's actual sadaka payments (recipient + amount + date).
    const pmap: Record<string, { name: string; amount: number; date: string | null; currency: string }[]> = {}
    ;(sadaka ?? []).forEach((s: any) => {
      if (!s.source_income_id || Number(s.amount_owed) !== 0 || Number(s.amount_given) <= 0) return  // payments only
      ;(pmap[s.source_income_id] ??= []).push({
        name: s.recipient_name ?? 'Sadaka given',
        amount: Number(s.amount_given),
        date: s.date_given ?? s.created_at ?? null,
        currency: s.currency,
      })
    })
    Object.values(pmap).forEach(list => list.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '')))
    setPaymentsByIncome(pmap)
    setLoading(false)
  }

  async function deleteItem(id: string) {
    if (!confirm('Delete this income entry? Its not-yet-given sadaka obligation will be removed with it.')) return
    const { error } = await supabase.from('income_projects').delete().eq('id', id)
    if (error) { alert(`Could not delete: ${error.message}`); return }
    load()
  }

  useEffect(() => {
    load()
    if (new URLSearchParams(window.location.search).get('add')) setShowForm(true)
  }, [])

  function toggleExpand(id: string) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // isReceived: treat actual_received_date as ground truth — status may lag if
  // the date was set via edit form rather than the "Mark Received" button.
  const isReceivedItem = (item: IncomeProject) =>
    item.status === 'received' || !!(item as any).actual_received_date

  const filtered = filter === 'all' ? items
    : items.filter(i => filter === 'pending' ? !isReceivedItem(i) : isReceivedItem(i))

  // Fold PKR at the cached rate — these tiles were AED-only, silently dropping
  // PKR income from the header totals (P2-25).
  const toAed = (n: number, cur: string) => cur === 'PKR' ? n * pkrToAed : n
  const totalEarned = items.reduce((s, i) => s + toAed(Number(i.amount), i.currency), 0)
  const totalPending = items.filter(i => !isReceivedItem(i)).reduce((s, i) => s + toAed(Number(i.amount), i.currency), 0)

  if (loading) return <LoadingSpinner />
  if (loadError) return (
    <div className="flex flex-col gap-4 animate-slide-up">
      <ModuleHeader title="Income & Projects" />
      <LoadError onRetry={load} />
    </div>
  )

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

      <p className="text-xs -mt-1" style={{ color: 'var(--text-muted)' }}>
        {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      </p>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card p-3">
          <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Total Earned</p>
          <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            {formatCurrency(totalEarned, 'AED', true)}
          </p>
        </div>
        <div className="card p-3">
          <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Pending Payment</p>
          <p className="text-lg font-bold text-amber-400">{formatCurrency(totalPending, 'AED', true)}</p>
        </div>
      </div>

      {/* Tabs + net toggle on same row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2">
          {(['all', 'pending', 'received'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className="px-3 py-1.5 rounded-full text-xs font-medium capitalize"
              style={{ background: filter === f ? 'var(--gold)' : 'var(--surface-2)', color: filter === f ? '#0a0a0a' : 'var(--text-muted)' }}>
              {f}
            </button>
          ))}
        </div>
        <button onClick={() => setShowNet(v => !v)}
          className="px-2.5 py-1.5 rounded-full text-[11px] font-medium"
          style={{ background: showNet ? 'rgba(16,185,129,0.15)' : 'var(--surface-2)', color: showNet ? '#10B981' : 'var(--text-muted)' }}>
          {showNet ? 'Net ✓' : 'Net'}
        </button>
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
          {filtered.slice(0, visible).map(item => {
            const received = isReceivedItem(item)
            const ongoing = (item as any).is_ongoing || !item.work_completed_date
            const lagDays = item.work_completed_date ? getLagDays(item.work_completed_date, item.actual_received_date) : 0
            const lagColor = getLagColor(lagDays)
            const isOverdue = !received && item.expected_payment_date && new Date(item.expected_payment_date) < new Date()
            const sad = sadakaByIncome[item.id]
            const sadakaPending = sad ? Math.max(0, sad.owed - sad.given) : 0
            const netAmount = item.amount - (sad?.owed ?? 0)
            const expanded = expandedIds.has(item.id)
            // green = received, red = not yet received (needs action)
            const borderColor = received ? '#10B981' : '#EF4444'

            return (
              <div key={item.id} className="card p-4" style={{ borderLeft: `3px solid ${borderColor}` }}>
                <div className="flex items-start justify-between mb-1">
                  <div className="flex-1 mr-3">
                    <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{item.name}</p>
                    <p className="text-xs mt-0.5 capitalize" style={{ color: 'var(--text-muted)' }}>
                      {item.type.replace('_', ' ')} · {item.ownership === 'shared' ? 'Shared' : item.ownership === 'ibrahim' ? 'Ibrahim' : 'Abu Bakar'}
                      {ongoing && ' · Ongoing'}
                      {received && (item as any).actual_received_date && ` · Rcvd ${shortDate((item as any).actual_received_date)}`}
                      {isOverdue && <span className="text-red-400"> · ⚠ Overdue</span>}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-bold" style={{ color: showNet && sad?.owed ? (netAmount >= 0 ? '#10B981' : '#EF4444') : 'var(--gold)' }}>
                      {showNet && sad?.owed
                        ? formatCurrency(netAmount, item.currency)
                        : formatCurrency(item.amount, item.currency)}
                    </span>
                    {showNet && sad?.owed && (
                      <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>net after sadaka</p>
                    )}
                  </div>
                </div>

                {/* Sadaka line */}
                {sad && sad.owed > 0 && (
                  <div className="flex items-center gap-1.5 text-xs mt-1">
                    <HandHeart size={11} style={{ color: sadakaPending === 0 ? '#10B981' : 'var(--gold)' }} />
                    <span style={{ color: sadakaPending === 0 ? '#10B981' : 'var(--gold)' }}>
                      Sadaka {formatCurrency(sad.given, item.currency, true)}/{formatCurrency(sad.owed, item.currency, true)} given
                      {sadakaPending === 0 && ' ✓'}
                    </span>
                  </div>
                )}

                {/* Breakdown toggle */}
                {sad && sad.owed > 0 && (
                  <button onClick={() => toggleExpand(item.id)}
                    className="flex items-center gap-1 mt-1.5 text-[11px]"
                    style={{ color: 'var(--text-muted)' }}>
                    {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                    {expanded ? 'Hide breakdown' : 'Show breakdown'}
                  </button>
                )}

                {/* Breakdown panel */}
                {expanded && sad && sad.owed > 0 && (
                  <div className="mt-2 rounded-lg p-3 text-xs flex flex-col gap-1" style={{ background: 'var(--surface-2)' }}>
                    <div className="flex justify-between" style={{ color: 'var(--text-secondary)' }}>
                      <span>Gross income</span>
                      <span>{formatCurrency(item.amount, item.currency)}</span>
                    </div>
                    <div className="flex justify-between" style={{ color: 'var(--gold)' }}>
                      <span>− Sadaka obligation ({item.amount > 0 ? Math.round((sad.owed / item.amount) * 100) : 0}%)</span>
                      <span>−{formatCurrency(sad.owed, item.currency, true)}</span>
                    </div>
                    <div className="border-t pt-1 mt-1 flex justify-between font-semibold"
                         style={{ borderColor: 'var(--border)', color: netAmount >= 0 ? '#10B981' : '#EF4444' }}>
                      <span>Net yours</span>
                      <span>{formatCurrency(netAmount, item.currency)}</span>
                    </div>
                    {sad.given > 0 && (
                      <div className="border-t pt-1 mt-1 flex flex-col gap-1" style={{ borderColor: 'var(--border)' }}>
                        <div className="flex justify-between text-emerald-400">
                          <span>Sadaka given so far</span>
                          <span>{formatCurrency(sad.given, item.currency, true)}</span>
                        </div>
                        {sadakaPending > 0 && (
                          <div className="flex justify-between" style={{ color: 'var(--gold)' }}>
                            <span>Still owed</span>
                            <span>{formatCurrency(sadakaPending, item.currency, true)}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Where the sadaka actually went — survives even after the
                        payment cards disappear from the Sadaka tab once fully given. */}
                    {(paymentsByIncome[item.id]?.length ?? 0) > 0 && (
                      <div className="border-t pt-1.5 mt-1 flex flex-col gap-1" style={{ borderColor: 'var(--border)' }}>
                        <p className="text-[11px] mb-0.5 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                          <HandHeart size={10} /> Given to
                        </p>
                        {paymentsByIncome[item.id].map((p, i) => (
                          <div key={i} className="flex justify-between">
                            <span style={{ color: 'var(--text-secondary)' }}>
                              {p.name}{p.date ? ` · ${shortDate(p.date)}` : ''}
                            </span>
                            <span className="text-emerald-400">{formatCurrency(p.amount, p.currency, true)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Lag details — collapsed by default */}
                {!ongoing && (
                  <button onClick={() => toggleExpand(item.id + '_lag')}
                    className="flex items-center gap-1 mt-2 text-[11px]"
                    style={{ color: 'var(--text-muted)' }}>
                    <Clock size={10} className={lagColor} />
                    <span className={lagColor}>{lagDays}d lag</span>
                    {expandedIds.has(item.id + '_lag') ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                  </button>
                )}

                {(expandedIds.has(item.id + '_lag') || ongoing) && (
                  <div className="flex items-center gap-1 text-xs mt-1 flex-wrap" style={{ color: 'var(--text-muted)' }}>
                    {(item as any).work_started_date && <span>Started {shortDate((item as any).work_started_date)} ·</span>}
                    <span>{ongoing ? 'In progress' : `Done ${shortDate(item.work_completed_date ?? '')}`}</span>
                    {item.expected_payment_date && (
                      <span className={isOverdue ? 'text-red-400' : ''}>
                        · {isOverdue ? '⚠ Due' : 'Due'} {shortDate(item.expected_payment_date)}
                      </span>
                    )}
                  </div>
                )}

                {/* Actions */}
                {received && !devMode ? (
                  <div className="flex items-center gap-1.5 mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                    <Lock size={11} /> Locked — payment received
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mt-3">
                    {!received && (
                      <button
                        onClick={async () => {
                          if (!confirm('Mark as received? This locks the entry.')) return
                          const { error } = await supabase.from('income_projects').update({
                            status: 'received',
                            actual_received_date: new Date().toISOString().split('T')[0]
                          }).eq('id', item.id)
                          if (error) { alert('Could not save: ' + error.message); return }
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
                )}
              </div>
            )
          })}
          {filtered.length > visible && (
            <button onClick={() => setVisible(v => v + 50)}
              className="py-2.5 rounded-xl text-xs font-semibold"
              style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
              Load more ({filtered.length - visible} more)
            </button>
          )}
        </div>
      )}

      {showForm && <IncomeForm onClose={() => { setShowForm(false); setEditItem(null) }} onSaved={load} editItem={editItem} />}
    </div>
  )
}
