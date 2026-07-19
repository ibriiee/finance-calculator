'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, shortDate } from '@/lib/utils'
import ModuleHeader from '@/components/shared/ModuleHeader'
import EmptyState from '@/components/shared/EmptyState'
import LoadingSpinner from '@/components/shared/LoadingSpinner'
import LoadError from '@/components/shared/LoadError'
import { Plus, HandHeart, Check, Users, ChevronRight, Pencil, Trash2, Lock, FileText, FileSpreadsheet, Download, ChevronDown, ChevronUp } from 'lucide-react'
import Link from 'next/link'
import SadakaForm from '@/components/sadaka/SadakaForm'
import { exportSadakaCsv, exportSadakaPdf, givenEntries } from '@/lib/sadakaExport'
import { computeSadaka } from '@/lib/sadaka'
import type { SadakaEntry } from '@/types/database.types'

type AllocResult = {
  owed: number
  remaining: number
  givenSoFar: number
  payments: { entry: SadakaEntry; applied: number }[]
}

export default function SadakaPage() {
  const [entries, setEntries] = useState<SadakaEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<SadakaEntry | null>(null)
  const [devMode, setDevMode] = useState(false)
  const [filter, setFilter] = useState<'pending' | 'given' | 'all'>('pending')
  const [exportKey, setExportKey] = useState('all')
  const [showExport, setShowExport] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [visible, setVisible] = useState(50)
  const [sadakaRate, setSadakaRate] = useState(0.2)
  const [userId, setUserId] = useState('')
  const [names, setNames] = useState<Record<string, string>>({})
  const [incomeNames, setIncomeNames] = useState<Record<string, string>>({})
  const supabase = createClient()

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    setUserId(user!.id)
    const [{ data: sadaka, error }, { data: profile }, { data: profs }, { data: inc }] = await Promise.all([
      supabase.from('sadaka_entries').select('*')
        .or(`owner_id.eq.${user!.id},is_joint.eq.true,shared.eq.true`)
        .order('created_at', { ascending: false }),
      supabase.from('profiles').select('sadaka_pct').eq('id', user!.id).single(),
      supabase.from('profiles').select('id, display_name'),
      supabase.from('income_projects').select('id, name'),
    ])
    if (error) { setLoadError(true); setLoading(false); return }
    setLoadError(false)
    setEntries(sadaka ?? [])
    setSadakaRate(profile?.sadaka_pct ?? 0.2)
    const map: Record<string, string> = {}
    ;(profs ?? []).forEach((p: any) => { map[p.id] = p.display_name ?? 'Unknown' })
    setNames(map)
    const incMap: Record<string, string> = {}
    ;(inc ?? []).forEach((i: any) => { incMap[i.id] = i.name })
    setIncomeNames(incMap)
    setLoading(false)
  }

  useEffect(() => {
    load(); setDevMode(localStorage.getItem('mizan_dev_mode') === '1')
    if (new URLSearchParams(window.location.search).get('add')) setShowForm(true)
  }, [])

  function totalsFor(list: SadakaEntry[], cur: string) {
    const owed = list.filter(e => e.currency === cur).reduce((s, e) => s + Number(e.amount_owed), 0)
    const given = list.filter(e => e.currency === cur).reduce((s, e) => s + Number(e.amount_given), 0)
    return {
      owed, given,
      pending: Math.max(0, owed - given),
      advance: Math.max(0, given - owed),
    }
  }
  const mine = entries.filter(e => !e.is_joint && e.owner_id === userId)
  const joint = entries.filter(e => e.is_joint)
  const aed = totalsFor(mine, 'AED')
  const pkr = totalsFor(mine, 'PKR')
  const jointAed = totalsFor(joint, 'AED')
  const jointPkr = totalsFor(joint, 'PKR')

  const isPayment = (e: SadakaEntry) => Number(e.amount_owed) === 0 && Number(e.amount_given) > 0

  // Single source of truth — income-scoped engine shared with Income page + Dashboard.
  // (Replaces the old owner+currency pool that leaked payments across unrelated incomes.)
  const computed = computeSadaka(entries)
  const alloc: Record<string, AllocResult> = {}
  for (const e of entries) {
    const st = computed.byId.get(e.id)
    if (st) alloc[e.id] = { owed: st.owed, remaining: st.remaining, givenSoFar: st.given, payments: st.payments }
  }
  const remainingOf = (e: SadakaEntry) => alloc[e.id]?.remaining ?? Math.max(0, Number(e.amount_owed) - Number(e.amount_given))

  const filtered = filter === 'all' ? entries
    : filter === 'pending' ? entries.filter(e => !isPayment(e) && remainingOf(e) > 0)
    : entries.filter(e => isPayment(e) || e.status === 'given' || Number(e.amount_given) > 0)

  const allGiven = givenEntries(entries)
  const monthKeyOf = (e: SadakaEntry) => {
    const d = new Date(e.date_given ?? e.created_at)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }
  const monthLabel = (key: string) => {
    const [y, m] = key.split('-').map(Number)
    return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  }
  const exportMonths = Array.from(new Set(allGiven.map(monthKeyOf))).sort().reverse()
  const exportScope = exportKey === 'all'
    ? { label: 'All time', entries: allGiven }
    : { label: monthLabel(exportKey), entries: allGiven.filter(e => monthKeyOf(e) === exportKey) }

  function toggleExpand(id: string) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  if (loading) return <LoadingSpinner />
  if (loadError) return (
    <div className="flex flex-col gap-4 animate-slide-up">
      <ModuleHeader title="Sadaka" />
      <LoadError onRetry={load} />
    </div>
  )

  const LOCATION_LABELS: Record<string, string> = { UAE: 'UAE', Pakistan: 'Pakistan', other: 'Other' }
  const METHOD_LABELS: Record<string, string> = { cash: 'Cash', gift: 'Gift', food: 'Food', bank_transfer: 'Bank transfer', other: 'Other' }

  return (
    <div className="flex flex-col gap-4 p-4 animate-slide-up">
      <ModuleHeader title="Sadaka" subtitle={`${(sadakaRate * 100).toFixed(0)}% self-tax · ${entries.length} entries`}
        action={
          <button onClick={() => { setEditItem(null); setShowForm(true) }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold"
            style={{ background: 'var(--gold)', color: '#0a0a0a' }}>
            <Plus size={14} /> Add
          </button>
        } />

      {/* Summary */}
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
          <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>Advance credit is auto-offsetting new obligations.</p>
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

      {/* Recipients link + Export icon on same row */}
      <Link href="/recipients" className="card p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users size={15} style={{ color: 'var(--gold)' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Recipients — who's paid & who's overdue</span>
        </div>
        <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
      </Link>

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
          {filtered.slice(0, visible).map(entry => {
            // green = given/cleared, red = still owed (needs action)
            const borderColor = (isPayment(entry) || remainingOf(entry) === 0) ? '#10B981' : '#EF4444'
            const a = alloc[entry.id]
            const isObligation = !isPayment(entry) && Number(entry.amount_owed) > 0
            const hasBreakdown = isObligation && a && (Number(entry.amount_given) > 0 || a.payments.length > 0)
            const expanded = expandedIds.has(entry.id)
            return (
            <div key={entry.id} className="card p-4" style={{ borderLeft: `3px solid ${borderColor}` }}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 mr-3">
                  {(entry.is_advance || entry.is_joint) && (
                    <div className="flex items-center gap-1.5 mb-1">
                      {entry.is_advance && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>Advance</span>}
                      {entry.is_joint && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>Joint</span>}
                    </div>
                  )}
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {entry.source_income_id && incomeNames[entry.source_income_id]
                      ? incomeNames[entry.source_income_id]
                      : isPayment(entry)
                        ? (entry.recipient_name ?? 'Sadaka given')
                        : 'Sadaka obligation'}
                  </p>
                  {entry.source_income_id && incomeNames[entry.source_income_id] && (
                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {isPayment(entry) ? 'Paid toward' : 'Obligation from'} this income
                    </p>
                  )}
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {entry.recipient_type?.replace('_', ' ')}
                    {entry.location && ` · ${LOCATION_LABELS[entry.location] ?? entry.location}`}
                    {entry.method && ` · ${METHOD_LABELS[entry.method] ?? entry.method}`}
                    {entry.date_given && ` · ${shortDate(entry.date_given)}`}
                  </p>
                  {entry.added_by_id && (
                    <p className="text-[11px] mt-1" style={{ color: entry.added_by_id !== userId ? 'var(--gold)' : 'var(--text-muted)' }}>
                      {entry.owner_id !== userId && entry.owner_id ? `For ${names[entry.owner_id] ?? 'brother'} · ` : ''}
                      Added by {entry.added_by_id === userId ? 'you' : (names[entry.added_by_id] ?? 'brother')}
                      {' · '}{shortDate(entry.created_at)}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  {isPayment(entry) ? (
                    <p className="text-base font-bold text-emerald-400">
                      {formatCurrency(entry.amount_given, entry.currency)}
                    </p>
                  ) : (
                    <>
                      <p className="text-base font-bold" style={{ color: remainingOf(entry) > 0 ? 'var(--gold)' : '#10B981' }}>
                        {formatCurrency(remainingOf(entry), entry.currency)}
                      </p>
                      {(a?.givenSoFar ?? 0) > 0 && (
                        <p className="text-xs text-emerald-400">
                          {remainingOf(entry) > 0
                            ? `${formatCurrency(a.givenSoFar, entry.currency)} of ${formatCurrency(entry.amount_owed, entry.currency)} given`
                            : 'fully given ✓'}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              {isObligation && Number(entry.amount_owed) > 0 && (a?.givenSoFar ?? 0) > 0 && (
                <div className="mt-2">
                  <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                    <div className="h-full rounded-full"
                         style={{ width: `${Math.min(100, ((a?.givenSoFar ?? 0) / Number(entry.amount_owed)) * 100)}%`, background: 'var(--gold)' }} />
                  </div>
                </div>
              )}

              {/* Breakdown toggle — only on obligations with some given */}
              {hasBreakdown && (
                <button onClick={() => toggleExpand(entry.id)}
                  className="flex items-center gap-1 mt-2 text-[11px]"
                  style={{ color: 'var(--text-muted)' }}>
                  {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                  {expanded ? 'Hide breakdown' : 'Show breakdown'}
                </button>
              )}

              {/* Breakdown panel */}
              {expanded && hasBreakdown && a && (
                <div className="mt-2 rounded-lg p-3 text-xs flex flex-col gap-1" style={{ background: 'var(--surface-2)' }}>
                  <div className="flex justify-between" style={{ color: 'var(--text-secondary)' }}>
                    <span>Obligation</span>
                    <span>{formatCurrency(a.owed, entry.currency)}</span>
                  </div>
                  {/* Direct mark-as-given amount on this entry */}
                  {Number(entry.amount_given) > 0 && (
                    <div className="flex justify-between text-emerald-400">
                      <span>− Marked as given</span>
                      <span>−{formatCurrency(entry.amount_given, entry.currency)}</span>
                    </div>
                  )}
                  {/* Pool payments applied */}
                  {a.payments.map((p, i) => (
                    <div key={i} className="flex justify-between text-emerald-400">
                      <span>− {p.entry.recipient_name ?? 'Sadaka payment'}{p.entry.date_given ? ` · ${shortDate(p.entry.date_given)}` : ''}</span>
                      <span>−{formatCurrency(p.applied, entry.currency)}</span>
                    </div>
                  ))}
                  <div className="border-t mt-1 pt-1 flex justify-between font-semibold"
                       style={{ borderColor: 'var(--border)', color: a.remaining > 0 ? 'var(--gold)' : '#10B981' }}>
                    <span>{a.remaining > 0 ? 'Still owed' : 'Cleared'}</span>
                    <span>{formatCurrency(a.remaining, entry.currency)}</span>
                  </div>
                </div>
              )}

              {/* Actions */}
              {entry.status === 'given' && !devMode ? (
                <div className="flex items-center gap-1.5 mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                  <Lock size={11} /> Given — locked, can't be edited or deleted
                </div>
              ) : (
                <div className="flex items-center gap-2 mt-3">
                  {entry.status !== 'given' && (
                    <button
                      onClick={async () => {
                        const { error } = await supabase.from('sadaka_entries').update({
                          status: 'given',
                          amount_given: Number(entry.amount_given) + remainingOf(entry),
                          date_given: new Date().toISOString().split('T')[0],
                        }).eq('id', entry.id)
                        if (error) { alert('Could not save: ' + error.message); return }
                        load()
                      }}
                      className="flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5"
                      style={{ background: 'var(--gold-dim)', color: 'var(--gold)' }}>
                      <Check size={13} /> Mark as Given
                    </button>
                  )}
                  <button onClick={() => { setEditItem(entry); setShowForm(true) }}
                    className="px-3 py-2 rounded-lg" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
                    <Pencil size={13} />
                  </button>
                  <button onClick={async () => {
                      if (!confirm('Delete this sadaka entry?')) return
                      const { error } = await supabase.from('sadaka_entries').delete().eq('id', entry.id)
                      if (error) { alert('Could not delete: ' + error.message); return }
                      load()
                    }}
                    className="px-3 py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              )}
            </div>
          )})}
          {filtered.length > visible && (
            <button onClick={() => setVisible(v => v + 50)}
              className="py-2.5 rounded-xl text-xs font-semibold"
              style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
              Load more ({filtered.length - visible} more)
            </button>
          )}
        </div>
      )}

      {/* Export — collapsed to small row at bottom */}
      <div className="card p-3">
        <button onClick={() => setShowExport(v => !v)}
          className="w-full flex items-center justify-between"
          style={{ color: 'var(--text-muted)' }}>
          <div className="flex items-center gap-2">
            <Download size={13} />
            <span className="text-xs">Export record</span>
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>· {allGiven.length} entries</span>
          </div>
          {showExport ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
        {showExport && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                {exportScope.entries.length} given {exportScope.entries.length === 1 ? 'entry' : 'entries'}
              </p>
              <select value={exportKey} onChange={e => setExportKey(e.target.value)}
                className="text-xs rounded-lg px-2 py-1.5"
                style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                <option value="all">All time</option>
                {exportMonths.map(k => <option key={k} value={k}>{monthLabel(k)}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={() => exportSadakaCsv(exportScope)} disabled={exportScope.entries.length === 0}
                className="flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40"
                style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
                <FileSpreadsheet size={13} /> CSV
              </button>
              <button onClick={() => exportSadakaPdf(exportScope)} disabled={exportScope.entries.length === 0}
                className="flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40"
                style={{ background: 'var(--gold-dim)', color: 'var(--gold)' }}>
                <FileText size={13} /> PDF record
              </button>
            </div>
          </div>
        )}
      </div>

      {showForm && <SadakaForm onClose={() => { setShowForm(false); setEditItem(null) }} onSaved={load} editItem={editItem} />}
    </div>
  )
}
