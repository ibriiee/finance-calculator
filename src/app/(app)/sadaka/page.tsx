'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, shortDate } from '@/lib/utils'
import ModuleHeader from '@/components/shared/ModuleHeader'
import StatusBadge from '@/components/shared/StatusBadge'
import EmptyState from '@/components/shared/EmptyState'
import LoadingSpinner from '@/components/shared/LoadingSpinner'
import { Plus, HandHeart } from 'lucide-react'
import SadakaForm from '@/components/sadaka/SadakaForm'
import type { SadakaEntry } from '@/types/database.types'

export default function SadakaPage() {
  const [entries, setEntries] = useState<SadakaEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter] = useState<'pending' | 'given' | 'all'>('pending')
  const [sadakaRate, setSadakaRate] = useState(0.2)
  const supabase = createClient()

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    const [{ data: sadaka }, { data: profile }] = await Promise.all([
      supabase.from('sadaka_entries').select('*').or(`owner_id.eq.${user!.id},is_joint.eq.true`).order('created_at', { ascending: false }),
      supabase.from('profiles').select('sadaka_rate').eq('id', user!.id).single(),
    ])
    setEntries(sadaka ?? [])
    setSadakaRate(profile?.sadaka_rate ?? 0.2)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const totalOwed = entries.filter(e => ['pending', 'partially_given'].includes(e.status))
    .reduce((s, e) => s + (e.amount_owed - e.amount_given), 0)
  const totalGiven = entries.filter(e => e.status === 'given')
    .reduce((s, e) => s + e.amount_given, 0)

  const filtered = filter === 'all' ? entries
    : filter === 'pending' ? entries.filter(e => ['pending', 'partially_given', 'advance_given'].includes(e.status))
    : entries.filter(e => e.status === 'given')

  if (loading) return <LoadingSpinner />

  const LOCATION_LABELS: Record<string, string> = { UAE: 'ðŸ‡¦ðŸ‡ª UAE', Pakistan: 'ðŸ‡µðŸ‡° Pakistan', other: 'ðŸŒ Other' }
  const METHOD_ICONS: Record<string, string> = { cash: 'ðŸ’µ', gift: 'ðŸŽ', food: 'ðŸ½', bank_transfer: 'ðŸ¦', other: 'â€¢' }

  return (
    <div className="flex flex-col gap-4 p-4 animate-slide-up">
      <ModuleHeader title="back Sadaka" subtitle={`${(sadakaRate * 100).toFixed(0)}% self-tax Â· ${entries.length} entries`}
        action={
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold"
            style={{ background: 'var(--gold)', color: '#0a0a0a' }}>
            <Plus size={14} /> Add
          </button>
        } />

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card p-3" style={{ border: totalOwed > 0 ? '1px solid rgba(201,168,76,0.4)' : undefined }}>
          <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Still Owed</p>
          <p className="text-lg font-bold" style={{ color: totalOwed > 0 ? 'var(--gold)' : '#10B981' }}>
            {formatCurrency(totalOwed, 'AED', true)}
          </p>
          {totalOwed === 0 && <p className="text-xs text-emerald-400">All given âœ“</p>}
        </div>
        <div className="card p-3">
          <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Total Given</p>
          <p className="text-lg font-bold text-emerald-400">{formatCurrency(totalGiven, 'AED', true)}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(['pending', 'given', 'all'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className="px-3 py-1.5 rounded-full text-xs font-medium capitalize"
            style={{ background: filter === f ? 'var(--gold)' : 'var(--surface-2)', color: filter === f ? '#0a0a0a' : 'var(--text-muted)' }}>
            {f === 'pending' ? 'Pending' : f === 'given' ? 'Given' : 'All'}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState icon={HandHeart} title="No sadaka entries"
          description="Add a sadaka entry manually or it auto-creates when income is received" />
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(entry => (
            <div key={entry.id} className="card p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 mr-3">
                  <div className="flex items-center gap-2 mb-1">
                    <StatusBadge status={entry.status} size="xs" />
                    {entry.is_advance && <StatusBadge status="advance_given" label="Advance" size="xs" />}
                    {entry.is_joint && <StatusBadge status="joint" label="Joint" size="xs" />}
                  </div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {entry.recipient_name ?? 'Unspecified recipient'}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {entry.recipient_type?.replace('_', ' ')}
                    {entry.location && ` Â· ${LOCATION_LABELS[entry.location]}`}
                    {entry.method && ` Â· ${METHOD_ICONS[entry.method]} ${entry.method.replace('_', ' ')}`}
                    {entry.date_given && ` Â· ${shortDate(entry.date_given)}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-base font-bold" style={{ color: 'var(--gold)' }}>
                    {formatCurrency(entry.amount_owed, entry.currency)}
                  </p>
                  {entry.amount_given > 0 && entry.amount_given < entry.amount_owed && (
                    <p className="text-xs text-emerald-400">{formatCurrency(entry.amount_given, entry.currency)} given</p>
                  )}
                </div>
              </div>

              {/* Progress bar for partial */}
              {entry.amount_owed > 0 && (
                <div className="mt-2">
                  <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                    <div className="h-full rounded-full"
                         style={{ width: `${Math.min(100, (entry.amount_given / entry.amount_owed) * 100)}%`, background: 'var(--gold)' }} />
                  </div>
                </div>
              )}

              {/* Mark given button */}
              {entry.status !== 'given' && (
                <button
                  onClick={async () => {
                    await supabase.from('sadaka_entries').update({
                      status: 'given', amount_given: entry.amount_owed,
                      date_given: new Date().toISOString().split('T')[0],
                    }).eq('id', entry.id)
                    load()
                  }}
                  className="mt-3 w-full py-2 rounded-lg text-xs font-semibold"
                  style={{ background: 'var(--gold-dim)', color: 'var(--gold)' }}>
                  âœ“ Mark as Given
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {showForm && <SadakaForm onClose={() => setShowForm(false)} onSaved={load} />}
    </div>
  )
}

