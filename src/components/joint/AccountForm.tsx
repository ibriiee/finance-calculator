'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, Loader2 } from 'lucide-react'
import FormSheet from '@/components/shared/FormSheet'

interface Props { onClose: () => void; onSaved: () => void }

export default function AccountForm({ onClose, onSaved }: Props) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: '', bank_name: '', currency: 'AED' })
  const F = (f: string, v: string) => setForm(p => ({ ...p, [f]: v }))

  async function save() {
    if (!form.name) return
    setSaving(true); setError('')
    const { data: { user } } = await supabase.auth.getUser()
    const { error: err } = await supabase.from('joint_accounts').insert({
      name: form.name, bank_name: form.bank_name || null,
      currency: form.currency as 'AED' | 'PKR', created_by_id: user!.id, is_active: true,
    })
    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved(); onClose()
  }

  return (
    <FormSheet onClose={onClose}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold">New Joint Account</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ background: 'var(--surface-2)' }}><X size={16} /></button>
        </div>
        <div className="flex flex-col gap-3">
          <input placeholder="Account name (e.g. House Expenses)" value={form.name} onChange={e => F('name', e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
          <input placeholder="Bank name (optional, e.g. Emirates NBD)" value={form.bank_name} onChange={e => F('bank_name', e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
          <div>
            <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Account currency</p>
            <div className="grid grid-cols-2 gap-2">
              {['AED', 'PKR'].map(c => (
                <button key={c} type="button" onClick={() => F('currency', c)}
                  className="py-2.5 rounded-xl text-sm font-medium"
                  style={{ background: form.currency === c ? 'var(--gold-dim)' : 'var(--surface-2)',
                    border: `1px solid ${form.currency === c ? 'var(--gold)' : 'var(--border)'}`,
                    color: form.currency === c ? 'var(--gold)' : 'var(--text-muted)' }}>{c}</button>
              ))}
            </div>
          </div>
          {error && <div className="px-3 py-2.5 rounded-xl text-xs" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#EF4444' }}>⚠ {error}</div>}
          <button onClick={save} disabled={saving || !form.name}
            className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
            style={{ background: 'var(--gold)', color: '#0a0a0a' }}>
            {saving && <Loader2 size={15} className="animate-spin" />}{saving ? 'Saving…' : 'Create Account'}
          </button>
        </div>
    </FormSheet>
  )
}
