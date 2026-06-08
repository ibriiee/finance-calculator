'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, Loader2 } from 'lucide-react'

interface Props { onClose: () => void; onSaved: () => void }

export default function SplitForm({ onClose, onSaved }: Props) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '', category: 'house', total_amount: '', currency: 'AED',
    ibrahim_pct: 50, paid_by: 'ibrahim', cost_date: new Date().toISOString().split('T')[0],
    is_recurring: false, notes: '',
  })
  const F = (f: string, v: any) => setForm(p => ({ ...p, [f]: v }))

  async function save() {
    if (!form.name || !form.total_amount) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('shared_costs').insert({
      created_by_id: user!.id, name: form.name, category: form.category as any,
      total_amount: parseFloat(form.total_amount), currency: form.currency as any,
      ibrahim_pct: form.ibrahim_pct / 100, paid_by: form.paid_by as any,
      cost_date: form.cost_date, is_recurring: form.is_recurring,
      notes: form.notes || null, ledger_entry_created: false,
    })
    setSaving(false); onSaved(); onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-lg mx-auto animate-slide-up rounded-t-2xl p-5 pb-8 max-h-[88vh] overflow-y-auto"
           style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
           onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold">Add Shared Cost</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ background: 'var(--surface-2)' }}><X size={16} /></button>
        </div>

        <div className="flex flex-col gap-3">
          <input placeholder="What is this?" value={form.name} onChange={e => F('name', e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />

          <div className="grid grid-cols-2 gap-2">
            <select value={form.category} onChange={e => F('category', e.target.value)}
              className="px-3 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
              <option value="house">🏠 House</option>
              <option value="vehicle">🚗 Vehicle</option>
              <option value="gift">🎁 Gift</option>
              <option value="charity">🤲 Charity</option>
              <option value="investment">📈 Investment</option>
              <option value="business">💼 Business</option>
              <option value="other">Other</option>
            </select>
            <select value={form.currency} onChange={e => F('currency', e.target.value)}
              className="px-3 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
              <option value="AED">AED</option>
              <option value="PKR">PKR</option>
            </select>
          </div>

          <input placeholder="Total amount" type="number" value={form.total_amount} onChange={e => F('total_amount', e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Ibrahim's share: {form.ibrahim_pct}%</label>
              <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Abu Bakar: {100 - form.ibrahim_pct}%</label>
            </div>
            <input type="range" min={0} max={100} step={5} value={form.ibrahim_pct}
              onChange={e => F('ibrahim_pct', parseInt(e.target.value))}
              className="w-full accent-[var(--gold)]" />
          </div>

          <div className="grid grid-cols-3 gap-2">
            {(['ibrahim', 'abu_bakar', 'both'] as const).map(p => (
              <button key={p} onClick={() => F('paid_by', p)}
                className="py-2 rounded-xl text-xs font-medium"
                style={{
                  background: form.paid_by === p ? 'var(--gold-dim)' : 'var(--surface-2)',
                  border: `1px solid ${form.paid_by === p ? 'var(--gold)' : 'var(--border)'}`,
                  color: form.paid_by === p ? 'var(--gold)' : 'var(--text-muted)',
                }}>
                Paid: {p === 'abu_bakar' ? 'Abu Bakar' : p === 'ibrahim' ? 'Ibrahim' : 'Both'}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <input type="date" value={form.cost_date} onChange={e => F('cost_date', e.target.value)}
              className="flex-1 mr-2 px-3 py-2.5 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
            <label className="flex items-center gap-2 cursor-pointer shrink-0">
              <input type="checkbox" checked={form.is_recurring} onChange={e => F('is_recurring', e.target.checked)}
                className="w-4 h-4 rounded accent-[var(--gold)]" />
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Monthly</span>
            </label>
          </div>

          <button onClick={save} disabled={saving || !form.name || !form.total_amount}
            className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
            style={{ background: 'var(--gold)', color: '#0a0a0a' }}>
            {saving && <Loader2 size={15} className="animate-spin" />}
            {saving ? 'Saving…' : 'Save Split'}
          </button>
        </div>
      </div>
    </div>
  )
}
