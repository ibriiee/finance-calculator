'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, shortDate } from '@/lib/utils'
import ModuleHeader from '@/components/shared/ModuleHeader'
import StatusBadge from '@/components/shared/StatusBadge'
import EmptyState from '@/components/shared/EmptyState'
import LoadingSpinner from '@/components/shared/LoadingSpinner'
import { Plus, HandHeart, Check } from 'lucide-react'
import SadakaForm from '@/components/sadaka/SadakaForm'
import type { SadakaEntry } from '@/types/database.types'

export default function SadakaPage() {
  const [entries, setEntries] = useState<SadakaEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter] = useState<'pending' | 'given' | 'all'>('pending')
  const [sadakaRate, setSadakaRate] = useState(0.2)
  const [userId, setUserId] = useState('')
  const [names, setNames] = useState<Record<string, string>>({})
  const supabase = createClient()

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    setUserId(user!.id)
    const [{ data: sadaka }, { data: profile }, { data: profs }] = await Promise.all([
      supabase.from('sadaka_entries').select('*')
        .or(`owner_id.eq.${user!.id},is_joint.eq.true,shared.eq.true`)
        .order('created_at', { ascending: false }),
      supabase.from('profiles').select('sadaka_pct').eq('id', user!.id).single(),
      supabase.from('profiles').select('id, display_name'),
    ])
    setEntries(sadaka ?? [])
    setSadakaRate(profile?.sadaka_pct ?? 0.2)
    const map: Record<string, string> = {}
    ;(profs ?? []).forEach((p: any) => { map[p.id] = p.display_name ?? 'Unknown' })
    setNames(map)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // Net the whole ledger per currency: advances (given > owed) auto-offset new obligations.
  function totalsFor(list: SadakaEntry[], cur: string) {
    const owed = list.filter(e => e.currency === cur).reduce((s, e) => s + Number(e.amount_owed), 0)
    const given = list.filter(e => e.currency === cur).reduce((s, e) => s + Number(e.amount_given), 0)
    return {
      owed, given,
      pending: Math.max(0, owed - given),   // still to give
      advance: Math.max(0, given - owed),   // credit carried forward
    }
  }
  const mine = entries.filter(e => !e.is_joint && e.owner_id === userId)
  const joint = entries.filter(e => e.is_joint)
  const aed = totalsFor(mine, 'AED')
  const pkr = totalsFor(mine, 'PKR')
  const jointAed = totalsFor(joint, 'AED')
  const jointPkr = totalsFor(joint, 'PKR')

  const filtered = filter === 'all' ? entries
    : filter === 'pending' ? entries.filter(e => ['pending', 'partially_given', 'advance_given'].includes(e.status))
    : entries.filter(e => e.status === 'given')

  if (loading) return <LoadingSpinner />

  const LOCATION_LABELS: Record<string, string> = { UAE: 'UAE', Pakistan: 'Pakistan', other: 'Other' }
  const METHOD_LABELS: Record<string, string> = { cash: 'Cash', gift: 'Gift', food: 'Food', bank_transfer: 'Bank transfer', other: 'Other' }

  return (
    <div className="flex flex-col gap-4 p-4 animate-slide-up">
      <ModuleHeader title="Sadaka" subtitle={`${(sadakaRate * 100).toFixed(0)}% self-tax · ${entries.length} entries`}
        action={
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold"
            style={{ background: 'var(--gold)', color: '#0a0a0a' }}>
            <Plus size={14} /> Add
          </button>
        } />

      {/* Summary — pending / given / advance, per currency */}
      <div className="card p-4">
        <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>Your Sadaka</p>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className="text-[11px] mb-1" style={{ color: 'var(--text-muted)' }}>Pending</p>
            <p className="text-base font-bold" style={{ color: aed.pending > 0 ? 'var(--gold)' : '#10B981' }}>
              {formatCurrency(aed.pending, 'AED', true)}
            </p>
            {pkr.pending > 0 && <p className="text-xs" style={{ color: 'var(--gold)' }}>{formatCurrency(pkr.pending, 'PKR', true)}</p>}
          </div>
          <div>
            <p className="text-[11px] mb-1" style={{ color: 'var(--text-muted)' }}>Given</p>
            <p className="text-base font-bold text-emerald-400">{formatCurrency(aed.given, 'AED', true)}</p>
            {pkr.given > 0 && <p className="text-xs text-emerald-400">{formatCurrency(pkr.given, 'PKR', true)}</p>}
          </div>
          <div>
            <p className="text-[11px] mb-1" style={{ color: 'var(--text-muted)' }}>Advance</p>
            <p className="text-base font-bold" style={{ color: 'var(--text-secondary)' }}>
              {formatCurrency(aed.advance, 'AED', true)}
            </p>
            {pkr.advance > 0 && <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{formatCurrency(pkr.advance, 'PKR', true)}</p>}
          </div>
        </div>
        {aed.pending === 0 && pkr.pending === 0 && (
          <p className="text-xs text-emerald-400 mt-3">All sadaka given — you're clear{aed.advance > 0 ? `, with ${formatCurrency(aed.advance, 'AED', true)} in advance credit` : ''} ✓</p>
        )}
        {aed.advance > 0 && aed.pending > 0 && (
          <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
            Advance credit is auto-offsetting new obligations.
          </p>
        )}
      </div>

      {/* Joint sadaka summary */}
      {joint.length > 0 && (
        <div className="card p-4">
          <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Joint Sadaka (both)</p>
          <div className="flex items-center justify-between">
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Pending</span>
            <span className="text-base font-bold" style={{ color: (jointAed.pending + jointPkr.pending) > 0 ? 'var(--gold)' : '#10B981' }}>
              {formatCurrency(jointAed.pending, 'AED', true)}{jointPkr.pending > 0 && ` · ${formatCurrency(jointPkr.pending, 'PKR', true)}`}
            </span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Given together</span>
            <span className="text-sm font-semibold text-emerald-400">
              {formatCurrency(jointAed.given, 'AED', true)}{jointPkr.given > 0 && ` · ${formatCurrency(jointPkr.given, 'PKR', true)}`}
            </span>
          </div>
        </div>
      )}

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
                    {entry.recipient_name ?? (entry.source_income_id ? 'Obligation from income' : 'Pending obligation')}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {entry.recipient_type?.replace('_', ' ')}
                    {entry.location && ` · ${LOCATION_LABELS[entry.location] ?? entry.location}`}
                    {entry.method && ` · ${METHOD_LABELS[entry.method] ?? entry.method}`}
                    {entry.date_given && ` · ${shortDate(entry.date_given)}`}
                  </p>
                  {entry.added_by_id && (entry.shared || entry.is_joint || entry.owner_id !== userId) && (
                    <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
                      {entry.owner_id !== userId && entry.owner_id ? `For ${names[entry.owner_id] ?? 'brother'} · ` : ''}
                      Added by {entry.added_by_id === userId ? 'you' : (names[entry.added_by_id] ?? 'brother')}
                      {' · '}{shortDate(entry.created_at)}
                    </p>
                  )}
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
                  className="mt-3 w-full py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5"
                  style={{ background: 'var(--gold-dim)', color: 'var(--gold)' }}>
                  <Check size={13} /> Mark as Given
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
