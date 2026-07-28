'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, shortDate } from '@/lib/utils'
import ModuleHeader from '@/components/shared/ModuleHeader'
import EmptyState from '@/components/shared/EmptyState'
import LoadingSpinner from '@/components/shared/LoadingSpinner'
import LoadError from '@/components/shared/LoadError'
import { Plus, Wallet, Pencil, Trash2, Users } from 'lucide-react'
import ExpenseForm, { EXPENSE_CATEGORIES } from '@/components/expenses/ExpenseForm'
import type { Expense } from '@/types/database.types'

const CAT_LABEL: Record<string, string> = Object.fromEntries(EXPENSE_CATEGORIES.map(c => [c.value, c.label]))
const catLabel = (c: string) => CAT_LABEL[c] ?? `• ${c.charAt(0).toUpperCase()}${c.slice(1)}`

export default function ExpensesPage() {
  const [items, setItems] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<Expense | null>(null)
  const [scope, setScope] = useState<'month' | 'all'>('month')
  const [q, setQ] = useState('')
  const supabase = createClient()

  async function load() {
    const { data, error } = await supabase.from('expenses').select('*').order('expense_date', { ascending: false })
    if (error) { setLoadError(true); setLoading(false); return }
    setLoadError(false)
    setItems((data as Expense[]) ?? [])
    setLoading(false)
  }
  useEffect(() => {
    load()
    if (new URLSearchParams(window.location.search).get('add')) setShowForm(true)
  }, [])

  async function deleteItem(e: Expense) {
    if (!confirm('Delete this expense?')) return
    // Remove the linked ledger IOU too, if it was a shared expense — but never
    // delete a SETTLED IOU, that would erase the record of a debt that was
    // actually paid. Only an open (unsettled) IOU dies with its expense.
    if (e.ledger_entry_id) {
      const { data: ledgerEntry, error: fetchErr } = await supabase.from('brother_ledger').select('is_settled').eq('id', e.ledger_entry_id).single()
      // PGRST116 = zero rows (IOU already gone) — fine. Any other error means
      // we can't KNOW the IOU state; deleting anyway would strand it (P2-24).
      if (fetchErr && fetchErr.code !== 'PGRST116') {
        alert('Could not check the linked ledger entry: ' + fetchErr.message + '\nNothing was deleted — try again.')
        return
      }
      if (ledgerEntry && !ledgerEntry.is_settled) {
        const { error: ledgerErr } = await supabase.from('brother_ledger').delete().eq('id', e.ledger_entry_id)
        if (ledgerErr) { alert('Could not delete linked ledger entry: ' + ledgerErr.message); return }
      } else if (ledgerEntry?.is_settled) {
        alert('This expense\'s ledger record is already settled — it will be kept; only the expense is deleted.')
      }
    }
    const { error } = await supabase.from('expenses').delete().eq('id', e.id)
    if (error) { alert('Could not delete: ' + error.message); return }
    load()
  }

  const now = new Date()
  const inMonth = (e: Expense) => {
    const d = new Date(e.expense_date)
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  }
  const scoped = scope === 'month' ? items.filter(inMonth) : items
  // Your own past descriptions, newest first — feeds the form's native autocomplete (#26).
  // items is already ordered newest-first by the query, so a Set preserves that order.
  const descriptionSuggestions = [...new Set(items.map(e => e.description).filter(Boolean))].slice(0, 30)
  // Search narrows the list only — the spent summary keeps using the full scoped array
  const searched = q ? scoped.filter(e => (e.description ?? '').toLowerCase().includes(q.toLowerCase())) : scoped

  // My-share totals per currency (shared expenses only cost me my_pct).
  const myShare = (e: Expense) => Number(e.amount) * Number(e.my_pct ?? 1)
  const totalFor = (cur: string) => scoped.filter(e => e.currency === cur).reduce((s, e) => s + myShare(e), 0)
  const aedTotal = totalFor('AED')
  const pkrTotal = totalFor('PKR')

  // Category breakdown (AED, my share) — top spenders first
  const byCat: Record<string, number> = {}
  scoped.filter(e => e.currency === 'AED').forEach(e => { byCat[e.category] = (byCat[e.category] ?? 0) + myShare(e) })
  const catRows = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 6)

  if (loading) return <LoadingSpinner />
  if (loadError) return (
    <div className="flex flex-col gap-4 animate-slide-up">
      <ModuleHeader title="Expenses" />
      <LoadError onRetry={load} />
    </div>
  )

  return (
    <div className="flex flex-col gap-4 p-4 animate-slide-up">
      <ModuleHeader title="Expenses" subtitle={`${items.length} logged`}
        action={
          <button onClick={() => { setEditItem(null); setShowForm(true) }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold"
            style={{ background: 'var(--gold)', color: '#0a0a0a' }}>
            <Plus size={14} /> Add
          </button>
        } />

      {/* Spent summary */}
      <div className="card p-4">
        <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
          {scope === 'month' ? 'Spent this month' : 'Spent (all time)'} · your share
        </p>
        <p className="font-display text-3xl font-semibold" style={{ color: 'var(--text-primary)' }}>
          {formatCurrency(aedTotal, 'AED', true)}
        </p>
        {pkrTotal > 0 && <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>+ {formatCurrency(pkrTotal, 'PKR', true)}</p>}

        {catRows.length > 0 && (
          <div className="mt-3 pt-3 flex flex-col gap-1.5" style={{ borderTop: '1px solid var(--border)' }}>
            {catRows.map(([cat, amt]) => (
              <div key={cat} className="flex items-center justify-between text-xs">
                <span style={{ color: 'var(--text-secondary)' }}>{catLabel(cat)}</span>
                <span style={{ color: 'var(--text-muted)' }}>{formatCurrency(amt, 'AED', true)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Scope tabs */}
      <div className="flex gap-2">
        {(['month', 'all'] as const).map(s => (
          <button key={s} onClick={() => setScope(s)}
            className="px-3 py-1.5 rounded-full text-xs font-medium capitalize"
            style={{ background: scope === s ? 'var(--gold)' : 'var(--surface-2)', color: scope === s ? '#0a0a0a' : 'var(--text-muted)' }}>
            {s === 'month' ? 'This month' : 'All'}
          </button>
        ))}
      </div>

      {/* Search */}
      <input placeholder="Search…" value={q} onChange={e => setQ(e.target.value)}
        className="w-full px-4 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />

      {/* List */}
      {scoped.length === 0 ? (
        <EmptyState icon={Wallet} title="No expenses yet"
          description="Log petrol, food, bills, rent — so 'yours to keep' shows real cash"
          action={
            <button onClick={() => { setEditItem(null); setShowForm(true) }}
              className="px-4 py-2 rounded-xl text-sm font-semibold"
              style={{ background: 'var(--gold)', color: '#0a0a0a' }}>
              Add First Expense
            </button>
          } />
      ) : (
        <div className="flex flex-col gap-3">
          {searched.map(e => (
            <div key={e.id} className="card p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 mr-3">
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{e.description}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {catLabel(e.category)} · {shortDate(e.expense_date)}
                    {e.is_shared && <span className="inline-flex items-center gap-0.5 ml-1" style={{ color: 'var(--gold)' }}><Users size={10} /> split</span>}
                  </p>
                </div>
                <div className="text-right">
                  {/* Expenses are an outflow — signed + red, app-wide rule (#15) */}
                  <p className="text-base font-bold text-red-400">
                    −{formatCurrency(myShare(e), e.currency)}
                  </p>
                  {e.is_shared && (
                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      of {formatCurrency(e.amount, e.currency)} total
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <button onClick={() => { setEditItem(e); setShowForm(true) }}
                  className="px-3 py-2 rounded-lg" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
                  <Pencil size={13} />
                </button>
                <button onClick={() => deleteItem(e)}
                  className="px-3 py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && <ExpenseForm onClose={() => { setShowForm(false); setEditItem(null) }} onSaved={load} editItem={editItem}
        suggestions={descriptionSuggestions} />}
    </div>
  )
}
