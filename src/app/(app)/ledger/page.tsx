'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, shortDate } from '@/lib/utils'
import ModuleHeader from '@/components/shared/ModuleHeader'
import EmptyState from '@/components/shared/EmptyState'
import LoadingSpinner from '@/components/shared/LoadingSpinner'
import LoadError from '@/components/shared/LoadError'
import { Plus, ArrowLeftRight, ArrowUpRight, ArrowDownLeft, CheckCircle2, RotateCcw, Trash2 } from 'lucide-react'
import LedgerForm from '@/components/ledger/LedgerForm'
import SettleUpModal from '@/components/ledger/SettleUpModal'
import type { BrotherLedgerEntry, Profile } from '@/types/database.types'

export default function LedgerPage() {
  const [entries, setEntries] = useState<BrotherLedgerEntry[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [userId, setUserId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [showSettle, setShowSettle] = useState(false)
  const [filter, setFilter] = useState<'unsettled' | 'all'>('unsettled')
  const supabase = createClient()

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    setUserId(user!.id)
    const [{ data: ledger, error }, { data: profs }] = await Promise.all([
      supabase.from('brother_ledger').select('*').order('transaction_date', { ascending: false }),
      supabase.from('profiles').select('*'),
    ])
    if (error) { setLoadError(true); setLoading(false); return }
    setLoadError(false)
    setEntries(ledger ?? [])
    setProfiles(profs ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const otherUser = profiles.find(p => p.id !== userId)
  const myProfile = profiles.find(p => p.id === userId)

  const unsettled = entries.filter(e => !e.is_settled)
  const displayed = filter === 'unsettled' ? unsettled : entries

  // Calculate balances
  let aedBalance = 0, pkrBalance = 0
  unsettled.forEach(e => {
    const sign = e.from_user_id === userId ? 1 : -1
    if (e.currency === 'AED') aedBalance += sign * e.amount
    if (e.currency === 'PKR') pkrBalance += sign * e.amount
  })

  const CATEGORY_LABELS: Record<string, string> = {
    bought_for_me: 'Bought for me', paid_my_share: 'Paid my share',
    project_expense: 'Project expense', joint_sadaka_contribution: 'Joint sadaka',
    shared_cost: 'Shared cost', salary_advance: 'Salary advance',
    settlement: 'Settlement', other: 'Other',
  }

  if (loading) return <LoadingSpinner />
  if (loadError) return (
    <div className="flex flex-col gap-4 animate-slide-up">
      <ModuleHeader title="Brother Ledger" />
      <LoadError onRetry={load} />
    </div>
  )

  return (
    <div className="flex flex-col gap-4 p-4 animate-slide-up">
      <ModuleHeader title="Brother Ledger" subtitle="Ibrahim & Abu Bakar"
        action={
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold"
            style={{ background: 'var(--gold)', color: '#0a0a0a' }}>
            <Plus size={14} /> Add
          </button>
        } />

      {/* Balance display */}
      <div className="card p-4">
        <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>Current Balance (unsettled)</p>
        {aedBalance === 0 && pkrBalance === 0 ? (
          <div className="flex items-center gap-2">
            <CheckCircle2 size={20} className="text-emerald-400" />
            <span className="text-base font-semibold text-emerald-400">All clear — nothing outstanding</span>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {aedBalance !== 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {aedBalance > 0
                    ? `${otherUser?.display_name} owes you`
                    : `You owe ${otherUser?.display_name}`}
                </span>
                <span className={`font-display text-xl font-semibold ${aedBalance > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatCurrency(Math.abs(aedBalance), 'AED')}
                </span>
              </div>
            )}
            {pkrBalance !== 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {pkrBalance > 0
                    ? `${otherUser?.display_name} owes you`
                    : `You owe ${otherUser?.display_name}`}
                </span>
                <span className={`font-display text-xl font-semibold ${pkrBalance > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatCurrency(Math.abs(pkrBalance), 'PKR')}
                </span>
              </div>
            )}
            <button onClick={() => setShowSettle(true)}
              className="mt-1 w-full py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: 'rgba(16,185,129,0.15)', color: '#10B981' }}>
              ✓ Settle Up
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(['unsettled', 'all'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className="px-3 py-1.5 rounded-full text-xs font-medium capitalize"
            style={{
              background: filter === f ? 'var(--gold)' : 'var(--surface-2)',
              color: filter === f ? '#0a0a0a' : 'var(--text-muted)',
            }}>
            {f === 'unsettled' ? `Unsettled (${unsettled.length})` : `All (${entries.length})`}
          </button>
        ))}
      </div>

      {/* List */}
      {displayed.length === 0 ? (
        <EmptyState icon={ArrowLeftRight} title="No transactions yet"
          description="Log the first IOU between you and your brother" />
      ) : (
        <div className="flex flex-col gap-2">
          {displayed.map(entry => {
            const isPayer = entry.from_user_id === userId
            const otherName = isPayer ? otherUser?.display_name : myProfile?.display_name
            // green = settled or they owe you, red = you owe (needs action)
            const borderColor = entry.is_settled ? '#10B981' : isPayer ? '#10B981' : '#EF4444'
            return (
              <div key={entry.id} className={`card p-4 ${entry.is_settled ? 'opacity-50' : ''}`} style={{ borderLeft: `3px solid ${borderColor}` }}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 flex-1 mr-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isPayer ? 'bg-red-500/15' : 'bg-emerald-500/15'}`}>
                      {isPayer
                        ? <ArrowUpRight size={14} className="text-red-400" />
                        : <ArrowDownLeft size={14} className="text-emerald-400" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{entry.description}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {CATEGORY_LABELS[entry.category]} · {shortDate(entry.transaction_date)}
                        {entry.is_settled && ' · Settled'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end gap-1">
                    <p className={`text-base font-bold ${isPayer ? 'text-red-400' : 'text-emerald-400'}`}>
                      {isPayer ? '-' : '+'}{formatCurrency(entry.amount, entry.currency)}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {isPayer ? `you → ${otherUser?.display_name}` : `${otherUser?.display_name} → you`}
                    </p>
                    {!entry.is_settled && (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={async () => {
                            if (!confirm('Reverse this entry? Creates an equal opposite transaction.')) return
                            const { error } = await supabase.from('brother_ledger').insert({
                              from_user_id: entry.to_user_id,
                              to_user_id: entry.from_user_id,
                              amount: entry.amount,
                              currency: entry.currency,
                              category: entry.category,
                              description: `↩ Reversed: ${entry.description}`,
                              transaction_date: new Date().toISOString().split('T')[0],
                              source_type: 'manual',
                              is_settled: false,
                            } as any)
                            if (error) { alert('Could not reverse: ' + error.message); return }
                            load()
                          }}
                          className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg"
                          style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                          <RotateCcw size={10} /> Reverse
                        </button>
                        <button
                          onClick={async () => {
                            if (!confirm('Delete this entry permanently? Use Reverse instead if you just want to cancel it out.')) return
                            const { error } = await supabase.from('brother_ledger').delete().eq('id', entry.id)
                            if (error) { alert('Could not delete: ' + error.message); return }
                            load()
                          }}
                          className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg"
                          style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
                          <Trash2 size={10} /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showForm && <LedgerForm onClose={() => setShowForm(false)} onSaved={load} userId={userId} otherUser={otherUser} />}
      {showSettle && <SettleUpModal onClose={() => setShowSettle(false)} onSaved={load} userId={userId} aedBalance={aedBalance} pkrBalance={pkrBalance} />}
    </div>
  )
}
