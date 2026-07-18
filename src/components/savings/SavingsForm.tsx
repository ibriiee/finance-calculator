'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, Loader2, ArrowDownCircle, ArrowUpCircle } from 'lucide-react'
import FormSheet from '@/components/shared/FormSheet'
import { validateAmount, formatCurrency } from '@/lib/utils'
import type { SavingsEntry } from '@/types/database.types'

interface Props {
  onClose: () => void
  onSaved: () => void
  /** Pre-fill the account when adding from an existing stash card */
  defaults?: { account_name?: string; location?: string; currency?: string }
  editEntry?: SavingsEntry | null
}

const GREEN = '#10B981'
const RED = '#EF4444'

export default function SavingsForm({ onClose, onSaved, defaults, editEntry }: Props) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    account_name: editEntry?.account_name ?? defaults?.account_name ?? '',
    location: editEntry?.location ?? defaults?.location ?? 'UAE',
    currency: editEntry?.currency ?? defaults?.currency ?? 'AED',
    txn_type: (editEntry?.txn_type ?? 'deposit') as 'deposit' | 'withdrawal',
    amount: editEntry ? String(editEntry.amount) : '',
    entry_date: editEntry?.entry_date ?? new Date().toISOString().split('T')[0],
    notes: editEntry?.notes ?? '',
  })
  const F = (f: string, v: string) => setForm(p => ({ ...p, [f]: v }))

  async function save() {
    if (!form.account_name.trim()) { setError('Account name is required'); return }
    const amtErr = validateAmount(form.amount, form.currency)
    if (amtErr) { setError(amtErr); return }
    setSaving(true); setError('')
    const { data: { user } } = await supabase.auth.getUser()
    const payload = {
      account_name: form.account_name,
      location: form.location as any,
      currency: form.currency as any,
      txn_type: form.txn_type,
      amount: parseFloat(form.amount),
      entry_date: form.entry_date,
      notes: form.notes || null,
    }
    const { error: err } = editEntry
      ? await supabase.from('savings_entries').update(payload).eq('id', editEntry.id)
      : await supabase.from('savings_entries').insert({ ...payload, owner_id: user!.id })
    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved(); onClose()
  }

  const isDeposit = form.txn_type === 'deposit'
  const accent = isDeposit ? GREEN : RED
  const accentBg = isDeposit ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)'
  const amt = parseFloat(form.amount)

  return (
    <FormSheet onClose={onClose}>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-bold">
          {editEntry ? 'Edit Savings Entry' : isDeposit ? 'Add to Savings' : 'Take from Savings'}
        </h2>
        <button onClick={onClose} className="p-1.5 rounded-lg" style={{ background: 'var(--surface-2)' }}><X size={16} /></button>
      </div>

      <div className="flex flex-col gap-3">
        {/* Type — green = money saved, red = money taken out */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { val: 'deposit', label: 'Put aside (save)', Icon: ArrowDownCircle, color: GREEN, bg: 'rgba(16,185,129,0.12)' },
            { val: 'withdrawal', label: 'Take out (use)', Icon: ArrowUpCircle, color: RED, bg: 'rgba(239,68,68,0.12)' },
          ].map(o => {
            const active = form.txn_type === o.val
            return (
              <button key={o.val} type="button" onClick={() => F('txn_type', o.val)}
                className="py-2.5 px-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5"
                style={{
                  background: active ? o.bg : 'var(--surface-2)',
                  border: `1px solid ${active ? o.color : 'var(--border)'}`,
                  color: active ? o.color : 'var(--text-muted)',
                }}><o.Icon size={14} /> {o.label}</button>
            )
          })}
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

        {/* Amount — sign + border follow the type */}
        <div className="grid grid-cols-3 gap-2">
          <div className="flex items-center justify-center gap-1 rounded-xl text-sm font-semibold"
            style={{ background: accentBg, border: `1px solid ${accent}`, color: accent }}>
            {isDeposit ? '+' : '−'} {form.currency}</div>
          <input placeholder="Amount" type="number" value={form.amount} onChange={e => F('amount', e.target.value)}
            className="col-span-2 px-4 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: `1px solid ${accent}`, color: 'var(--text-primary)' }} />
        </div>

        <input type="date" value={form.entry_date} onChange={e => F('entry_date', e.target.value)}
          className="w-full px-4 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />

        <input placeholder="Note (optional — e.g. backup for slow months)" value={form.notes} onChange={e => F('notes', e.target.value)}
          className="w-full px-4 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />

        {/* Live preview of what this entry does to the stash */}
        {!isNaN(amt) && amt > 0 && (
          <div className="px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5"
            style={{ background: accentBg, color: accent }}>
            {isDeposit ? <ArrowDownCircle size={14} /> : <ArrowUpCircle size={14} />}
            {isDeposit
              ? `+${formatCurrency(amt, form.currency, true)} goes INTO this stash`
              : `−${formatCurrency(amt, form.currency, true)} comes OUT of this stash`}
          </div>
        )}

        {error && <div className="px-3 py-2.5 rounded-xl text-xs" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#EF4444' }}>⚠ {error}</div>}

        <button onClick={save} disabled={saving || !form.account_name || !form.amount}
          className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
          style={{ background: accent, color: '#fff' }}>
          {saving && <Loader2 size={15} className="animate-spin" />}
          {saving ? 'Saving…' : editEntry ? 'Save Changes' : isDeposit ? 'Add to Savings +' : 'Record Withdrawal −'}
        </button>
      </div>
    </FormSheet>
  )
}
