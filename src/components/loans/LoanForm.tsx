'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, Loader2 } from 'lucide-react'
import FormSheet from '@/components/shared/FormSheet'
import type { LoanType, LoanCurrencyType } from '@/types/database.types'

interface Props { onClose: () => void; onSaved: () => void }

export default function LoanForm({ onClose, onSaved }: Props) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    counterparty_name: '', loan_type: 'i_owe' as LoanType,
    currency_type: 'AED' as LoanCurrencyType, original_amount: '',
    date_taken: new Date().toISOString().split('T')[0], due_date: '', notes: '',
  })
  const F = (f: string, v: string) => setForm(p => ({ ...p, [f]: v }))
  const isGold = ['gold_grams', 'silver_grams'].includes(form.currency_type)

  async function save() {
    if (!form.counterparty_name || !form.original_amount) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('loans').insert({
      owner_id: user!.id, counterparty_name: form.counterparty_name,
      loan_type: form.loan_type, currency_type: form.currency_type,
      original_amount: parseFloat(form.original_amount),
      date_taken: form.date_taken, due_date: form.due_date || null,
      status: 'outstanding', notes: form.notes || null, joint_ibrahim_pct: 0.5,
    })
    setSaving(false); onSaved(); onClose()
  }

  return (
    <FormSheet onClose={onClose}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold">Add Loan</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ background: 'var(--surface-2)' }}><X size={16} /></button>
        </div>

        <div className="flex flex-col gap-3">
          <input placeholder="Person / Organisation name" value={form.counterparty_name} onChange={e => F('counterparty_name', e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />

          <div className="grid grid-cols-3 gap-2">
            {(['i_owe', 'they_owe', 'joint'] as LoanType[]).map(t => (
              <button key={t} onClick={() => F('loan_type', t)}
                className="py-2.5 rounded-xl text-xs font-medium"
                style={{
                  background: form.loan_type === t ? 'var(--gold-dim)' : 'var(--surface-2)',
                  border: `1px solid ${form.loan_type === t ? 'var(--gold)' : 'var(--border)'}`,
                  color: form.loan_type === t ? 'var(--gold)' : 'var(--text-muted)',
                }}>
                {t === 'i_owe' ? 'I owe' : t === 'they_owe' ? 'They owe' : 'Joint'}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <select value={form.currency_type} onChange={e => F('currency_type', e.target.value)}
              className="px-3 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
              <option value="AED">AED (cash)</option>
              <option value="PKR">PKR (cash)</option>
              <option value="USD">USD (cash)</option>
              <option value="gold_grams">Gold (grams)</option>
              <option value="silver_grams">Silver (grams)</option>
            </select>
            <input placeholder={isGold ? 'Grams' : 'Amount'} type="number" value={form.original_amount} onChange={e => F('original_amount', e.target.value)}
              className="px-4 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
          </div>

          {isGold && (
            <div className="px-3 py-2 rounded-lg text-xs" style={{ background: 'rgba(201,168,76,0.1)', color: 'var(--gold)' }}>
              ℹ Gold/silver loans: return same grams at today's price (Qard Hasan rule)
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Date taken</label>
              <input type="date" value={form.date_taken} onChange={e => F('date_taken', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Due date (opt.)</label>
              <input type="date" value={form.due_date} onChange={e => F('due_date', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
            </div>
          </div>

          <input placeholder="Notes (optional)" value={form.notes} onChange={e => F('notes', e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />

          <button onClick={save} disabled={saving || !form.counterparty_name || !form.original_amount}
            className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
            style={{ background: 'var(--gold)', color: '#0a0a0a' }}>
            {saving && <Loader2 size={15} className="animate-spin" />}
            {saving ? 'Saving…' : 'Save Loan'}
          </button>
        </div>
    </FormSheet>
  )
}
