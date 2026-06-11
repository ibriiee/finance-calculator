'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, Loader2 } from 'lucide-react'
import FormSheet from '@/components/shared/FormSheet'

interface Props { onClose: () => void; onSaved: () => void }

export default function WasiyyaForm({ onClose, onSaved }: Props) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    title: '', category: 'asset' as 'asset' | 'debt' | 'instruction' | 'password' | 'contact' | 'message',
    description: '', amount: '', currency: 'AED',
    beneficiary_name: '', beneficiary_contact: '', is_sensitive: false,
  })
  const F = (f: string, v: any) => setForm(p => ({ ...p, [f]: v }))

  async function save() {
    if (!form.title) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('wasiyya_entries').insert({
      owner_id: user!.id, title: form.title, category: form.category,
      description: form.description || null,
      amount: form.amount ? parseFloat(form.amount) : null,
      currency: form.amount ? form.currency as any : null,
      beneficiary_name: form.beneficiary_name || null,
      beneficiary_contact: form.beneficiary_contact || null,
      is_sensitive: form.is_sensitive,
    })
    setSaving(false); onSaved(); onClose()
  }

  const cats: { key: typeof form.category; icon: string; label: string }[] = [
    { key: 'asset', icon: '🏦', label: 'Asset' },
    { key: 'debt', icon: '💸', label: 'Debt' },
    { key: 'instruction', icon: '📋', label: 'Instruction' },
    { key: 'password', icon: '🔑', label: 'Password' },
    { key: 'contact', icon: '👤', label: 'Contact' },
    { key: 'message', icon: '💌', label: 'Message' },
  ]

  return (
    <FormSheet onClose={onClose}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold">New Wasiyya Entry</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ background: 'var(--surface-2)' }}><X size={16} /></button>
        </div>

        <div className="flex flex-col gap-3">
          <input placeholder="Title (e.g. Bank Account, Car Loan, Message to Family)" value={form.title} onChange={e => F('title', e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />

          {/* Category */}
          <div className="grid grid-cols-3 gap-2">
            {cats.map(c => (
              <button key={c.key} onClick={() => F('category', c.key)}
                className="py-2 rounded-xl text-xs font-medium"
                style={{
                  background: form.category === c.key ? 'var(--gold-dim)' : 'var(--surface-2)',
                  border: `1px solid ${form.category === c.key ? 'var(--gold)' : 'var(--border)'}`,
                  color: form.category === c.key ? 'var(--gold)' : 'var(--text-muted)',
                }}>
                {c.icon} {c.label}
              </button>
            ))}
          </div>

          <textarea placeholder="Description / instructions / details" value={form.description} onChange={e => F('description', e.target.value)} rows={3}
            className="w-full px-4 py-3 rounded-xl text-sm resize-none" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />

          {/* Amount (optional) */}
          <div className="grid grid-cols-3 gap-2">
            <select value={form.currency} onChange={e => F('currency', e.target.value)}
              className="px-3 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
              <option value="AED">AED</option>
              <option value="PKR">PKR</option>
            </select>
            <input placeholder="Amount (optional)" type="number" value={form.amount} onChange={e => F('amount', e.target.value)}
              className="col-span-2 px-4 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
          </div>

          <input placeholder="Beneficiary name (optional)" value={form.beneficiary_name} onChange={e => F('beneficiary_name', e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />

          <input placeholder="Beneficiary phone / email (optional)" value={form.beneficiary_contact} onChange={e => F('beneficiary_contact', e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />

          <label className="flex items-center gap-3 p-3 rounded-xl cursor-pointer"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <input type="checkbox" checked={form.is_sensitive} onChange={e => F('is_sensitive', e.target.checked)} className="w-4 h-4 accent-[var(--gold)]" />
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>🔒 Mark as sensitive</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Content hidden behind tap-to-reveal</p>
            </div>
          </label>

          <button onClick={save} disabled={saving || !form.title}
            className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
            style={{ background: 'var(--gold)', color: '#0a0a0a' }}>
            {saving && <Loader2 size={15} className="animate-spin" />}
            {saving ? 'Saving…' : 'Save Entry'}
          </button>
        </div>
    </FormSheet>
  )
}
