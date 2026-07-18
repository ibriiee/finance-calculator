'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, Loader2 } from 'lucide-react'
import FormSheet from '@/components/shared/FormSheet'
import { validateAmount, formatCurrency } from '@/lib/utils'
import type { Profile, BrotherLedgerEntry } from '@/types/database.types'

interface Props { onClose: () => void; onSaved: () => void; userId: string; otherUser?: Profile; editEntry?: BrotherLedgerEntry | null }

const GREEN = '#10B981'
const RED = '#EF4444'

export default function LedgerForm({ onClose, onSaved, userId, otherUser, editEntry }: Props) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    // i_paid = I fronted money for them (they owe me)
    direction: (editEntry ? (editEntry.from_user_id === userId ? 'i_paid' : 'they_paid') : 'i_paid') as 'i_paid' | 'they_paid',
    amount: editEntry ? String(editEntry.amount) : '',
    currency: (editEntry?.currency ?? 'AED') as 'AED' | 'PKR',
    category: editEntry?.category ?? 'bought_for_me',
    description: editEntry?.description ?? '',
    transaction_date: editEntry?.transaction_date ?? new Date().toISOString().split('T')[0],
  })

  const F = (f: string, v: string) => setForm(p => ({ ...p, [f]: v }))

  async function save() {
    const amtErr = validateAmount(form.amount, form.currency)
    if (amtErr) { setError(amtErr); return }
    if (!form.description.trim()) { setError('Description is required'); return }
    if (!otherUser?.id) {
      setError('Your brother\'s profile isn\'t loaded yet. Make sure both accounts exist, then reopen this page.')
      return
    }
    setSaving(true)
    setError('')
    // i_paid = I fronted money FOR them → I'm the creditor (from_user)
    const from = form.direction === 'i_paid' ? userId : otherUser.id
    const to   = form.direction === 'i_paid' ? otherUser.id : userId
    const payload = {
      from_user_id: from, to_user_id: to,
      amount: parseFloat(form.amount), currency: form.currency,
      category: form.category as any, description: form.description,
      transaction_date: form.transaction_date,
    }
    const { error: insErr } = editEntry
      ? await supabase.from('brother_ledger').update(payload).eq('id', editEntry.id)
      : await supabase.from('brother_ledger').insert({ ...payload, source_type: 'manual', is_settled: false })
    setSaving(false)
    if (insErr) { setError(insErr.message); return }
    onSaved(); onClose()
  }

  const iPaid = form.direction === 'i_paid'
  const accent = iPaid ? GREEN : RED
  const accentBg = iPaid ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)'
  const otherName = otherUser?.display_name ?? 'your brother'
  const amt = parseFloat(form.amount)

  return (
    <FormSheet onClose={onClose}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold">{editEntry ? 'Edit Ledger Entry' : 'Add Ledger Entry'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ background: 'var(--surface-2)' }}><X size={16} /></button>
        </div>

        <div className="flex flex-col gap-3">
          {/* Direction — green = they'll owe you, red = you'll owe them */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { val: 'i_paid', label: `I paid for ${otherUser?.display_name ?? 'them'}`, color: GREEN, bg: 'rgba(16,185,129,0.12)' },
              { val: 'they_paid', label: `${otherUser?.display_name ?? 'They'} paid for me`, color: RED, bg: 'rgba(239,68,68,0.12)' },
            ].map(opt => (
              <button key={opt.val} onClick={() => F('direction', opt.val)}
                className="py-2.5 px-3 rounded-xl text-xs font-medium text-center"
                style={{
                  background: form.direction === opt.val ? opt.bg : 'var(--surface-2)',
                  border: `1px solid ${form.direction === opt.val ? opt.color : 'var(--border)'}`,
                  color: form.direction === opt.val ? opt.color : 'var(--text-muted)',
                }}>
                {opt.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <select value={form.currency} onChange={e => F('currency', e.target.value)}
              className="px-3 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
              <option value="AED">AED</option>
              <option value="PKR">PKR</option>
            </select>
            <input placeholder="Amount" type="number" value={form.amount} onChange={e => F('amount', e.target.value)}
              className="col-span-2 px-4 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
          </div>

          <select value={form.category} onChange={e => F('category', e.target.value)}
            className="px-3 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
            <option value="bought_for_me">Bought something</option>
            <option value="paid_my_share">Paid my share</option>
            <option value="project_expense">Project expense</option>
            <option value="salary_advance">Salary advance</option>
            <option value="joint_sadaka_contribution">Joint sadaka</option>
            <option value="other">Other</option>
          </select>

          <input placeholder="What was it for?" value={form.description} onChange={e => F('description', e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />

          <input type="date" value={form.transaction_date} onChange={e => F('transaction_date', e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />

          {/* Live preview of the resulting debt */}
          {!isNaN(amt) && amt > 0 && (
            <div className="px-3 py-2.5 rounded-xl text-xs font-semibold" style={{ background: accentBg, color: accent }}>
              {iPaid
                ? `${otherName} will owe you ${formatCurrency(amt, form.currency, true)}`
                : `You will owe ${otherName} ${formatCurrency(amt, form.currency, true)}`}
            </div>
          )}

          {error && (
            <div className="px-3 py-2.5 rounded-xl text-xs" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#EF4444' }}>
              ⚠ {error}
            </div>
          )}

          <button onClick={save} disabled={saving || !form.amount || !form.description}
            className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
            style={{ background: 'var(--gold)', color: '#0a0a0a' }}>
            {saving && <Loader2 size={15} className="animate-spin" />}
            {saving ? 'Saving…' : 'Log Transaction'}
          </button>
        </div>
    </FormSheet>
  )
}
