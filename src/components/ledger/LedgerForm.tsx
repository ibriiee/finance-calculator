'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, Loader2 } from 'lucide-react'
import type { Profile } from '@/types/database.types'

interface Props { onClose: () => void; onSaved: () => void; userId: string; otherUser?: Profile }

export default function LedgerForm({ onClose, onSaved, userId, otherUser }: Props) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    direction: 'i_paid' as 'i_paid' | 'they_paid', // i_paid = I fronted money for them
    amount: '', currency: 'AED' as 'AED' | 'PKR',
    category: 'bought_for_me',
    description: '',
    transaction_date: new Date().toISOString().split('T')[0],
  })

  const F = (f: string, v: string) => setForm(p => ({ ...p, [f]: v }))

  async function save() {
    if (!form.amount || !form.description) return
    setSaving(true)
    // direction: 'i_paid' = from_user is other (they paid for me), to_user is me
    // Actually: i_paid means I paid FOR them → I'm from_user (creditor)
    const from = form.direction === 'i_paid' ? userId : otherUser!.id
    const to   = form.direction === 'i_paid' ? otherUser!.id : userId
    await supabase.from('brother_ledger').insert({
      from_user_id: from, to_user_id: to,
      amount: parseFloat(form.amount), currency: form.currency,
      category: form.category as any, description: form.description,
      transaction_date: form.transaction_date, source_type: 'manual', is_settled: false,
    })
    setSaving(false); onSaved(); onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-lg mx-auto animate-slide-up rounded-t-2xl p-5 pb-8"
           style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
           onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold">Add Ledger Entry</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ background: 'var(--surface-2)' }}><X size={16} /></button>
        </div>

        <div className="flex flex-col gap-3">
          {/* Direction */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { val: 'i_paid', label: `I paid for ${otherUser?.display_name ?? 'them'}` },
              { val: 'they_paid', label: `${otherUser?.display_name ?? 'They'} paid for me` },
            ].map(opt => (
              <button key={opt.val} onClick={() => F('direction', opt.val)}
                className="py-2.5 px-3 rounded-xl text-xs font-medium text-center"
                style={{
                  background: form.direction === opt.val ? 'var(--gold-dim)' : 'var(--surface-2)',
                  border: `1px solid ${form.direction === opt.val ? 'var(--gold)' : 'var(--border)'}`,
                  color: form.direction === opt.val ? 'var(--gold)' : 'var(--text-muted)',
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

          <button onClick={save} disabled={saving || !form.amount || !form.description}
            className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
            style={{ background: 'var(--gold)', color: '#0a0a0a' }}>
            {saving && <Loader2 size={15} className="animate-spin" />}
            {saving ? 'Saving…' : 'Log Transaction'}
          </button>
        </div>
      </div>
    </div>
  )
}
