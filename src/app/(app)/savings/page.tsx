'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, shortDate } from '@/lib/utils'
import ModuleHeader from '@/components/shared/ModuleHeader'
import EmptyState from '@/components/shared/EmptyState'
import LoadingSpinner from '@/components/shared/LoadingSpinner'
import LoadError from '@/components/shared/LoadError'
import { Plus, PiggyBank, MapPin, ArrowDownCircle, ArrowUpCircle, Trash2 } from 'lucide-react'
import SavingsForm from '@/components/savings/SavingsForm'
import type { SavingsEntry } from '@/types/database.types'

export default function SavingsPage() {
  const supabase = createClient()
  const [entries, setEntries] = useState<SavingsEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [tableMissing, setTableMissing] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [formDefaults, setFormDefaults] = useState<{ account_name?: string; location?: string; currency?: string } | undefined>()
  const [expanded, setExpanded] = useState<string | null>(null)

  async function load() {
    const { data, error } = await supabase.from('savings_entries')
      .select('*').order('entry_date', { ascending: false })
    if (error) {
      // Only a missing relation means "migration not run" — anything else is a
      // transient failure and must show the retry banner, not a fake state (P2-20).
      if (error.code === '42P01' || error.code === 'PGRST205') setTableMissing(true)
      else setLoadError(true)
      setLoading(false)
      return
    }
    setLoadError(false)
    setEntries((data as any) ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function deleteEntry(id: string) {
    if (!confirm('Delete this savings entry?')) return
    const { error } = await supabase.from('savings_entries').delete().eq('id', id)
    if (error) { alert(`Could not delete: ${error.message}`); return }
    load()
  }

  // Group into stashes by account + currency
  const stashKey = (e: SavingsEntry) => `${e.account_name}::${e.currency}`
  const stashes: Record<string, { name: string; location: string; currency: string; balance: number; entries: SavingsEntry[] }> = {}
  entries.forEach(e => {
    const k = stashKey(e)
    stashes[k] = stashes[k] ?? { name: e.account_name, location: e.location, currency: e.currency, balance: 0, entries: [] }
    stashes[k].balance += (e.txn_type === 'withdrawal' ? -1 : 1) * Number(e.amount)
    stashes[k].entries.push(e)
  })
  const totalBy = (cur: string) => Object.values(stashes)
    .filter(s => s.currency === cur)
    .reduce((t, s) => t + s.balance, 0)

  if (loading) return <LoadingSpinner />
  if (loadError) return (
    <div className="flex flex-col gap-4 animate-slide-up">
      <ModuleHeader title="Savings" />
      <LoadError onRetry={load} />
    </div>
  )

  return (
    <div className="flex flex-col gap-4 p-4 animate-slide-up">
      <ModuleHeader title="Savings" subtitle="Backup money — survival fund"
        action={
          <button onClick={() => { setFormDefaults(undefined); setShowForm(true) }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold"
            style={{ background: 'var(--gold)', color: '#0a0a0a' }}>
            <Plus size={14} /> Add
          </button>
        } />

      {tableMissing && (
        <div className="px-4 py-3 rounded-xl text-xs" style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.35)', color: '#F59E0B' }}>
          ⚠ Savings table not found — run <b>supabase/savings.sql</b> in the Supabase SQL Editor first.
        </div>
      )}

      {/* Totals */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card p-3">
          <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Saved (AED)</p>
          <p className="font-display text-lg font-semibold text-emerald-400">{formatCurrency(totalBy('AED'), 'AED', true)}</p>
        </div>
        <div className="card p-3">
          <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Saved (PKR)</p>
          <p className="font-display text-lg font-semibold text-emerald-400">{formatCurrency(totalBy('PKR'), 'PKR', true)}</p>
        </div>
      </div>

      {entries.length === 0 && !tableMissing ? (
        <EmptyState icon={PiggyBank} title="No savings yet"
          description="Put money aside per account — PKR in Pakistan, AED in Dubai — so you can survive the months with no projects."
          action={
            <button onClick={() => { setFormDefaults(undefined); setShowForm(true) }}
              className="px-4 py-2 rounded-xl text-sm font-semibold"
              style={{ background: 'var(--gold)', color: '#0a0a0a' }}>
              Add First Savings
            </button>
          } />
      ) : (
        <div className="flex flex-col gap-3">
          {Object.entries(stashes).map(([key, s]) => (
            <div key={key} className="card p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 mr-3">
                  <div className="flex items-center gap-2">
                    <PiggyBank size={15} style={{ color: 'var(--gold)' }} />
                    <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{s.name}</p>
                  </div>
                  <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                    <MapPin size={10} /> {s.location} · {s.currency}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display text-lg font-semibold" style={{ color: s.balance >= 0 ? 'var(--text-primary)' : '#EF4444' }}>
                    {formatCurrency(s.balance, s.currency)}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 mt-2">
                <button onClick={() => { setFormDefaults({ account_name: s.name, location: s.location, currency: s.currency }); setShowForm(true) }}
                  className="flex-1 py-2 rounded-lg text-xs font-semibold"
                  style={{ background: 'var(--gold-dim)', color: 'var(--gold)' }}>
                  + Add / Withdraw
                </button>
                <button onClick={() => setExpanded(expanded === key ? null : key)}
                  className="flex-1 py-2 rounded-lg text-xs"
                  style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                  {expanded === key ? 'Hide' : `Show ${s.entries.length} entries`}
                </button>
              </div>
              {expanded === key && (
                <div className="flex flex-col mt-2">
                  {s.entries.map(e => {
                    const isDep = e.txn_type === 'deposit'
                    return (
                      <div key={e.id} className="flex items-center justify-between py-2 px-1 border-t" style={{ borderColor: 'var(--border)' }}>
                        <div className="flex items-center gap-2">
                          {isDep ? <ArrowDownCircle size={15} className="text-emerald-400" /> : <ArrowUpCircle size={15} className="text-red-400" />}
                          <div>
                            <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                              {e.notes ?? (isDep ? 'Saved' : 'Withdrawn')}
                            </p>
                            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{shortDate(e.entry_date)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold ${isDep ? 'text-emerald-400' : 'text-red-400'}`}>
                            {isDep ? '+' : '-'}{formatCurrency(e.amount, e.currency, true)}
                          </span>
                          <button onClick={() => deleteEntry(e.id)} className="p-1.5 rounded-lg"
                            style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showForm && <SavingsForm onClose={() => setShowForm(false)} onSaved={load} defaults={formDefaults} />}
    </div>
  )
}
