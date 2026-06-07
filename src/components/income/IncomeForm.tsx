'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, Loader2 } from 'lucide-react'
import type { Currency, IncomeType, Ownership } from '@/types/database.types'

interface Props { onClose: () => void; onSaved: () => void }

export default function IncomeForm({ onClose, onSaved }: Props) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '', type: 'gig' as IncomeType, currency: 'AED' as Currency,
    amount: '', work_completed_date: new Date().toISOString().split('T')[0],
    expected_payment_date: '', ownership: 'ibrahim' as Ownership, notes: '',
  })

  async function save() {
    if (!form.name || !form.amount) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('income_projects').insert({
      owner_id: user!.id,
      name: form.name, type: form.type, currency: form.currency,
      amount: parseFloat(form.amount),
      work_completed_date: form.work_completed_date,
      expected_payment_date: form.expected_payment_date || null,
      ownership: form.ownership, notes: form.notes || null,
      status: 'pending', sadaka_triggered: false,
    })
    setSaving(false)
    onSaved()
    onClose()
  }

  const F = (field: string, val: string) => setForm(p => ({ ...p, [field]: val }))

  return (
    <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-lg mx-auto animate-slide-up rounded-t-2xl p-5 pb-8"
           style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
           onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold">Add Income / Project</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ background: 'var(--surface-2)' }}>
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <input placeholder="Project name" value={form.name} onChange={e => F('name', e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />

          <div className="grid grid-cols-2 gap-2">
            <select value={form.type} onChange={e => F('type', e.target.value)}
              className="px-3 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
              <option value="gig">Gig (1-3 days)</option>
              <option value="short_contract">Short Contract</option>
              <option value="long_contract">Long Contract</option>
              <option value="gift">Gift</option>
              <option value="other">Other</option>
            </select>
            <select value={form.ownership} onChange={e => F('ownership', e.target.value)}
              className="px-3 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
              <option value="ibrahim">Ibrahim</option>
              <option value="abu_bakar">Abu Bakar</option>
              <option value="shared">Shared</option>
            </select>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <select value={form.currency} onChange={e => F('currency', e.target.value)}
              className="px-3 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
              <option value="AED">AED</option>
              <option value="PKR">PKR</option>
              <option value="USD">USD</option>
            </select>
            <input placeholder="Amount" type="number" value={form.amount} onChange={e => F('amount', e.target.value)}
              className="col-span-2 px-4 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Work completed</label>
              <input type="date" value={form.work_completed_date} onChange={e => F('work_completed_date', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Expected payment</label>
              <input type="date" value={form.expected_payment_date} onChange={e => F('expected_payment_date', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
            </div>
          </div>

          <textarea placeholder="Notes (optional)" value={form.notes} onChange={e => F('notes', e.target.value)} rows={2}
            className="w-full px-4 py-3 rounded-xl text-sm resize-none" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />

          <button onClick={save} disabled={saving || !form.name || !form.amount}
            className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
            style={{ background: (!form.name || !form.amount) ? 'var(--border)' : 'var(--gold)', color: '#0a0a0a' }}>
            {saving && <Loader2 size={15} className="animate-spin" />}
            {saving ? 'Saving…' : 'Save Income'}
          </button>
        </div>
      </div>
    </div>
  )
}
