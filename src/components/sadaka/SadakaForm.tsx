'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, Loader2 } from 'lucide-react'
import type { Currency } from '@/types/database.types'

interface Props { onClose: () => void; onSaved: () => void }

export default function SadakaForm({ onClose, onSaved }: Props) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    amount_owed: '', currency: 'AED' as Currency,
    is_advance: false, is_joint: false,
    recipient_name: '', recipient_type: 'named_relative',
    location: 'UAE', method: 'cash', notes: '',
    status: 'pending',
  })
  const F = (f: string, v: any) => setForm(p => ({ ...p, [f]: v }))

  async function save() {
    if (!form.amount_owed) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('sadaka_entries').insert({
      owner_id: user!.id,
      amount_owed: parseFloat(form.amount_owed), amount_given: 0,
      currency: form.currency, status: form.status,
      is_advance: form.is_advance, is_joint: form.is_joint,
      joint_ibrahim_pct: 0.5,
      recipient_name: form.recipient_name || null,
      recipient_type: form.recipient_type as any,
      location: form.location as any, method: form.method as any,
      notes: form.notes || null,
    })
    setSaving(false); onSaved(); onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-lg mx-auto animate-slide-up rounded-t-2xl overflow-y-auto max-h-[85vh] p-5 pb-8"
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

          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_advance} onChange={e => F('is_advance', e.target.checked)}
                className="w-4 h-4 rounded accent-[var(--gold)]" />
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Advance (before income)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_joint} onChange={e => F('is_joint', e.target.checked)}
                className="w-4 h-4 rounded accent-[var(--gold)]" />
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Joint (both brothers)</span>
            </label>
          </div>

          <button onClick={save} disabled={saving || !form.amount_owed}
            className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
            style={{ background: 'var(--gold)', color: '#0a0a0a' }}>
            {saving && <Loader2 size={15} className="animate-spin" />}
            {saving ? 'Savingâ€¦' : 'Save Sadaka'}
          </button>
        </div>
      </div>
    </div>
  )
}


