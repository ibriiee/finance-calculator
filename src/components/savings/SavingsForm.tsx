'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, Loader2 } from 'lucide-react'
import FormSheet from '@/components/shared/FormSheet'
import { validateAmount } from '@/lib/utils'

interface Props {
  onClose: () => void
  onSaved: () => void
  /** Pre-fill the account when adding from an existing stash card */
  defaults?: { account_name?: string; location?: string; currency?: string }
}

export default function SavingsForm({ onClose, onSaved, defaults }: Props) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    account_name: defaults?.account_name ?? '',
    location: defaults?.location ?? 'UAE',
    currency: defaults?.currency ?? 'AED',
    txn_type: 'deposit' as 'deposit' | 'withdrawal',
    amount: '',
    entry_date: new Date().toISOString().split('T')[0],
    notes: '',
  })
  const F = (f: string, v: string) => setForm(p => ({ ...p, [f]: v }))

  async function save() {
    if (!form.account_name.trim()) { setError('Account name is required'); return }
    const amtErr = validateAmount(form.amount, form.currency)
    if (amtErr) { setError(amtErr); return }
    setSaving(true); setError('')
    const { data: { user } } = await supabase.auth.getUser()
    const { error: err } = await supabase.from('savings_entries').insert({
      owner_id: user!.id,
      account_name: form.account_name,
      location: form.location as any,
      currency: form.currency as any,
      txn_type: form.txn_type,
      amount: parseFloat(form.amount),
      entry_date: form.entry_date,
      notes: form.notes || null,
    })
    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved(); onClose()
  }

  return (
    <FormSheet onClose={onClose}>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-bold">{form.txn_type === 'deposit' ? 'Add to Savings' : 'Take from Savings'}</h2>
        <button onClick={onClose} className="p-1.5 rounded-lg" style={{ background: 'var(--surface-2)' }}><X size={16} /></button>
      </div>

      <div className="flex flex-col gap-3">
        {/* Type */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { val: 'deposit', label: 'Put aside (save)' },
            { val: 'withdrawal', label: 'Take out (use)' },
          ].map(o => (
            <button key={o.val} type="button" onClick={() => F('txn_type', o.val)}
              className="py-2.5 px-2 rounded-xl text-xs font-medium"
              style={{
                background: form.txn_type === o.val ? 'var(--gold-dim)' : 'var(--surface-2)',
                border: `1px solid ${form.txn_type === o.val ? 'var(--gold)' : 'var(--border)'}`,
                color: form.txn_type === o.val ? 'var(--gold)' : 'var(--text-muted)',
              }}>{o.label}</button>
          ))}
        </div>

        <input placeholder="Where is it kept? (e.g. Meezan Bank PKR, ADIB Dubai)" value={form.account_name}
          onChange={e => F('account_name', e.target.value)}
          className="w-full px-4 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />

        <div className="grid grid-cols-2 gap-2">
          <select value={form.location} onChange={e => F('location', e.target.value)}
            className="px-3 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
            <option value="UAE">UAE</option>
            <option value="Pakistan">Pakistan</option>
            <option value="other">Other</option>
          </select>
          <select value={form.currency} onChange={e => F('currency', e.target.value)}
            className="px-3 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
            <option value="AED">AED</option>
            <option value="PKR">PKR</option>
          </select>
        </div>

        <input placeholder="Amount" type="number" value={form.amount} onChange={e => F('amount', e.target.value)}
          className="w-full px-4 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />

        <input type="date" value={form.entry_date} onChange={e => F('entry_date', e.target.value)}
          className="w-full px-4 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />

        <input placeholder="Note (optional — e.g. backup for slow months)" value={form.notes} onChange={e => F('notes', e.target.value)}
          className="w-full px-4 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />

        {error && <div className="px-3 py-2.5 rounded-xl text-xs" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#EF4444' }}>⚠ {error}</div>}

        <button onClick={save} disabled={saving || !form.account_name || !form.amount}
          className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
          style={{ background: 'var(--gold)', color: '#0a0a0a' }}>
          {saving && <Loader2 size={15} className="animate-spin" />}
          {saving ? 'Saving…' : form.txn_type === 'deposit' ? 'Add to Savings' : 'Record Withdrawal'}
        </button>
      </div>
    </FormSheet>
  )
}
