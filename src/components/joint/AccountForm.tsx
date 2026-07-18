'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, Loader2, Archive } from 'lucide-react'
import FormSheet from '@/components/shared/FormSheet'

interface EditableAccount { id: string; name: string; bank_name: string | null; currency: string }

interface Props { onClose: () => void; onSaved: () => void; editAccount?: EditableAccount | null }

export default function AccountForm({ onClose, onSaved, editAccount }: Props) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: editAccount?.name ?? '',
    bank_name: editAccount?.bank_name ?? '',
    currency: editAccount?.currency ?? 'AED',
  })
  const F = (f: string, v: string) => setForm(p => ({ ...p, [f]: v }))

  async function save() {
    if (!form.name) return
    // Amounts are NOT converted — changing an account's currency relabels every txn
    if (editAccount && form.currency !== editAccount.currency &&
        !confirm(`Change currency ${editAccount.currency} → ${form.currency}? Existing transaction amounts are NOT converted — they will just show as ${form.currency}.`)) return
    setSaving(true); setError('')
    const { data: { user } } = await supabase.auth.getUser()
    const payload = { name: form.name, bank_name: form.bank_name || null, currency: form.currency as 'AED' | 'PKR' }
    const { error: err } = editAccount
      ? await supabase.from('joint_accounts').update(payload).eq('id', editAccount.id)
      : await supabase.from('joint_accounts').insert({ ...payload, created_by_id: user!.id, is_active: true })
    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved(); onClose()
  }

  async function archive() {
    if (!editAccount) return
    if (!confirm(`Archive "${editAccount.name}"? It disappears from the Joint page for both of you, but all its transactions stay saved. This can only be undone from the database.`)) return
    setSaving(true); setError('')
    const { error: err } = await supabase.from('joint_accounts').update({ is_active: false }).eq('id', editAccount.id)
    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved(); onClose()
  }

  return (
    <FormSheet onClose={onClose}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold">{editAccount ? 'Edit Account' : 'New Joint Account'}</h2>
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
            {saving && <Loader2 size={15} className="animate-spin" />}{saving ? 'Saving…' : editAccount ? 'Save Changes' : 'Create Account'}
          </button>
          {editAccount && (
            <button onClick={archive} disabled={saving}
              className="w-full py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5"
              style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
              <Archive size={13} /> Archive this account
            </button>
          )}
        </div>
    </FormSheet>
  )
}
