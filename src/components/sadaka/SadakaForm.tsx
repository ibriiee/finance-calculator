'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, Loader2 } from 'lucide-react'
import type { Currency } from '@/types/database.types'

interface Props { onClose: () => void; onSaved: () => void }

export default function SadakaForm({ onClose, onSaved }: Props) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [me, setMe] = useState<{ id: string; name: string } | null>(null)
  const [other, setOther] = useState<{ id: string; name: string } | null>(null)
  const [form, setForm] = useState({
    amount_owed: '', currency: 'AED' as Currency,
    is_advance: false,
    on_behalf: 'me' as 'me' | 'other' | 'joint',  // whose sadaka this is
    recipient_name: '', recipient_type: 'named_relative',
    location: 'UAE', method: 'cash', notes: '',
    status: 'pending',
  })
  const F = (f: string, v: any) => setForm(p => ({ ...p, [f]: v }))

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profs } = await supabase.from('profiles').select('id, display_name')
      const mine = profs?.find((p: any) => p.id === user!.id)
      const theirs = profs?.find((p: any) => p.id !== user!.id)
      setMe({ id: user!.id, name: mine?.display_name ?? 'Me' })
      if (theirs) setOther({ id: theirs.id, name: theirs.display_name ?? 'Brother' })
    })()
  }, [])

  async function save() {
    if (!form.amount_owed || !me) return
    if (form.on_behalf === 'other' && !other) {
      setError('Your brother\'s profile isn\'t loaded yet.'); return
    }
    setSaving(true); setError('')
    const amount = parseFloat(form.amount_owed)
    // If already given (or advance), record the amount as given so totals reflect it.
    const given = (form.status === 'given' || form.status === 'advance_given') ? amount : 0
    const isJoint = form.on_behalf === 'joint'
    const ownerId = form.on_behalf === 'other' ? other!.id : me.id
    const shared = form.on_behalf !== 'me'   // brother's or joint entries are visible to both

    const { error: insErr } = await supabase.from('sadaka_entries').insert({
      owner_id: ownerId,
      added_by_id: me.id,
      amount_owed: amount, amount_given: given,
      currency: form.currency, status: form.status,
      is_advance: form.is_advance || form.status === 'advance_given',
      is_joint: isJoint, shared,
      joint_ibrahim_pct: 0.5,
      date_given: given > 0 ? new Date().toISOString().split('T')[0] : null,
      recipient_name: form.recipient_name || null,
      recipient_type: form.recipient_type as any,
      location: form.location as any, method: form.method as any,
      notes: form.notes || null,
    })
    setSaving(false)
    if (insErr) { setError(insErr.message); return }
    onSaved(); onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-lg mx-auto animate-slide-up rounded-t-2xl p-5 pb-8 max-h-[88vh] overflow-y-auto"
           style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
           onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold">Add Sadaka Entry</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ background: 'var(--surface-2)' }}><X size={16} /></button>
        </div>

        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-2">
            <select value={form.currency} onChange={e => F('currency', e.target.value)}
              className="px-3 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
              <option value="AED">AED</option>
              <option value="PKR">PKR</option>
              <option value="USD">USD</option>
            </select>
            <input placeholder="Amount" type="number" value={form.amount_owed} onChange={e => F('amount_owed', e.target.value)}
              className="col-span-2 px-4 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
          </div>

          <input placeholder="Recipient name (optional)" value={form.recipient_name} onChange={e => F('recipient_name', e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />

          <div className="grid grid-cols-2 gap-2">
            <select value={form.recipient_type} onChange={e => F('recipient_type', e.target.value)}
              className="px-3 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
              <option value="named_relative">Named relative</option>
              <option value="anonymous_needy">Anonymous needy</option>
              <option value="masjid">Masjid</option>
              <option value="gift">Gift</option>
              <option value="other">Other</option>
            </select>
            <select value={form.location} onChange={e => F('location', e.target.value)}
              className="px-3 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
              <option value="UAE">UAE</option>
              <option value="Pakistan">Pakistan</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <select value={form.method} onChange={e => F('method', e.target.value)}
              className="px-3 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
              <option value="cash">Cash</option>
              <option value="gift">Gift</option>
              <option value="food">Food</option>
              <option value="bank_transfer">Bank transfer</option>
              <option value="other">Other</option>
            </select>
            <select value={form.status} onChange={e => F('status', e.target.value)}
              className="px-3 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
              <option value="pending">Pending</option>
              <option value="given">Already Given</option>
              <option value="advance_given">Advance Given</option>
            </select>
          </div>

          {/* Whose sadaka is this */}
          <div>
            <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Whose sadaka</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { val: 'me', label: me?.name ?? 'Me' },
                { val: 'other', label: other?.name ?? 'Brother' },
                { val: 'joint', label: 'Joint' },
              ].map(opt => (
                <button key={opt.val} type="button" onClick={() => F('on_behalf', opt.val)}
                  className="py-2.5 px-2 rounded-xl text-xs font-medium truncate"
                  style={{
                    background: form.on_behalf === opt.val ? 'var(--gold-dim)' : 'var(--surface-2)',
                    border: `1px solid ${form.on_behalf === opt.val ? 'var(--gold)' : 'var(--border)'}`,
                    color: form.on_behalf === opt.val ? 'var(--gold)' : 'var(--text-muted)',
                  }}>
                  {opt.label}
                </button>
              ))}
            </div>
            {form.on_behalf === 'other' && (
              <p className="text-[11px] mt-1.5" style={{ color: 'var(--text-muted)' }}>
                Logged on {other?.name}'s behalf — both of you can see and manage it.
              </p>
            )}
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_advance} onChange={e => F('is_advance', e.target.checked)}
              className="w-4 h-4 rounded accent-[var(--gold)]" />
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Advance (given before income)</span>
          </label>

          {error && (
            <div className="px-3 py-2.5 rounded-xl text-xs" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#EF4444' }}>
              ⚠ {error}
            </div>
          )}

          <button onClick={save} disabled={saving || !form.amount_owed}
            className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
            style={{ background: 'var(--gold)', color: '#0a0a0a' }}>
            {saving && <Loader2 size={15} className="animate-spin" />}
            {saving ? 'Saving…' : 'Save Sadaka'}
          </button>
        </div>
      </div>
    </div>
  )
}
