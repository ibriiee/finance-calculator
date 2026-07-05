'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, shortDate } from '@/lib/utils'
import ModuleHeader from '@/components/shared/ModuleHeader'
import EmptyState from '@/components/shared/EmptyState'
import LoadingSpinner from '@/components/shared/LoadingSpinner'
import LoadError from '@/components/shared/LoadError'
import { Plus, Users, Share2, Check, AlertTriangle } from 'lucide-react'
import RecipientForm from '@/components/sadaka/RecipientForm'

interface Recipient { id: string; name: string; relation: string | null; location: string | null; contact: string | null; notes: string | null }
interface Entry { id: string; recipient_id: string | null; amount_given: number; currency: string; date_given: string | null; created_at: string }

function monthsSince(dateStr: string | null): number | null {
  if (!dateStr) return null
  const d = new Date(dateStr)
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 30.44))
}

export default function RecipientsPage() {
  const supabase = createClient()
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [copied, setCopied] = useState(false)
  const [visible, setVisible] = useState(50)

  async function load() {
    const [{ data: recs, error }, { data: ents }] = await Promise.all([
      supabase.from('sadaka_recipients').select('*').eq('is_active', true).order('name'),
      supabase.from('sadaka_entries').select('id, recipient_id, amount_given, currency, date_given, created_at').gt('amount_given', 0),
    ])
    if (error) { setLoadError(true); setLoading(false); return }
    setLoadError(false)
    setRecipients((recs as any) ?? [])
    setEntries((ents as any) ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function stats(r: Recipient) {
    const paid = entries.filter(e => e.recipient_id === r.id)
    const aed = paid.filter(e => e.currency === 'AED').reduce((s, e) => s + Number(e.amount_given), 0)
    const pkr = paid.filter(e => e.currency === 'PKR').reduce((s, e) => s + Number(e.amount_given), 0)
    const dates = paid.map(e => e.date_given ?? e.created_at).filter(Boolean).sort().reverse()
    const lastPaid = dates[0] ?? null
    const months = monthsSince(lastPaid)
    const overdue = months === null || months >= 3
    return { count: paid.length, aed, pkr, lastPaid, months, overdue }
  }

  // sort: never-paid first, then longest since paid
  const ranked = [...recipients].map(r => ({ r, s: stats(r) }))
    .sort((a, b) => {
      const am = a.s.months === null ? Infinity : a.s.months
      const bm = b.s.months === null ? Infinity : b.s.months
      return bm - am
    })

  function buildExport() {
    const lines = ['*Sadaka — Recipients Summary*', `_As of ${shortDate(new Date().toISOString())}_`, '']
    ranked.forEach(({ r, s }) => {
      const tot = [s.aed > 0 ? formatCurrency(s.aed, 'AED') : '', s.pkr > 0 ? formatCurrency(s.pkr, 'PKR') : ''].filter(Boolean).join(' + ') || 'nothing yet'
      const last = s.lastPaid ? shortDate(s.lastPaid) : 'never'
      const flag = s.overdue ? ' ⚠️ prioritise' : ''
      lines.push(`• ${r.name} (${r.relation ?? '—'}) — given ${tot}, last: ${last}${flag}`)
    })
    const overdue = ranked.filter(x => x.s.overdue)
    if (overdue.length) {
      lines.push('', '*Prioritise next batch:*')
      overdue.forEach(({ r, s }) => lines.push(`• ${r.name} — ${s.months === null ? 'never paid' : s.months + ' months ago'}`))
    }
    return lines.join('\n')
  }

  async function copyExport() {
    try {
      await navigator.clipboard.writeText(buildExport())
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard blocked */ }
  }

  if (loading) return <LoadingSpinner />
  if (loadError) return (
    <div className="flex flex-col gap-4 animate-slide-up">
      <ModuleHeader title="Recipients" />
      <LoadError onRetry={load} />
    </div>
  )

  const overdueCount = ranked.filter(x => x.s.overdue).length

  return (
    <div className="flex flex-col gap-4 p-4 animate-slide-up">
      <ModuleHeader title="Recipients" subtitle={`${recipients.length} people · ${overdueCount} to prioritise`}
        action={
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold"
            style={{ background: 'var(--gold)', color: '#0a0a0a' }}>
            <Plus size={14} /> Add
          </button>
        } />

      {recipients.length > 0 && (
        <button onClick={copyExport}
          className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
          style={{ background: copied ? 'rgba(16,185,129,0.15)' : 'var(--surface-2)', color: copied ? '#10B981' : 'var(--text-secondary)' }}>
          {copied ? <><Check size={15} /> Copied — paste into WhatsApp</> : <><Share2 size={15} /> Copy WhatsApp summary</>}
        </button>
      )}

      {recipients.length === 0 ? (
        <EmptyState icon={Users} title="No recipients yet"
          description="Add people you give sadaka to (e.g. Norine Aunty) to track who's been paid and who's overdue." />
      ) : (
        <div className="flex flex-col gap-2">
          {ranked.slice(0, visible).map(({ r, s }) => (
            <div key={r.id} className="card p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{r.name}</p>
                    {s.overdue && (
                      <span className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded"
                        style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B' }}>
                        <AlertTriangle size={9} /> prioritise
                      </span>
                    )}
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {r.relation}{r.location && ` · ${r.location}`}
                    {r.contact && ` · ${r.contact}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold" style={{ color: 'var(--gold)' }}>
                    {s.aed > 0 ? formatCurrency(s.aed, 'AED', true) : ''}{s.aed > 0 && s.pkr > 0 ? ' · ' : ''}{s.pkr > 0 ? formatCurrency(s.pkr, 'PKR', true) : ''}
                    {s.aed === 0 && s.pkr === 0 ? '—' : ''}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {s.lastPaid ? `last ${shortDate(s.lastPaid)}` : 'never paid'}
                  </p>
                </div>
              </div>
              {s.months !== null && (
                <p className="text-[11px] mt-2" style={{ color: s.overdue ? '#F59E0B' : 'var(--text-muted)' }}>
                  {s.count} payment{s.count !== 1 ? 's' : ''} · last given {s.months === 0 ? 'this month' : `${s.months} month${s.months !== 1 ? 's' : ''} ago`}
                </p>
              )}
            </div>
          ))}
          {ranked.length > visible && (
            <button onClick={() => setVisible(v => v + 50)}
              className="py-2.5 rounded-xl text-xs font-semibold"
              style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
              Load more ({ranked.length - visible} more)
            </button>
          )}
        </div>
      )}

      {showForm && <RecipientForm onClose={() => setShowForm(false)} onSaved={load} />}
    </div>
  )
}
