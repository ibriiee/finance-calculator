'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, Loader2 } from 'lucide-react'
import FormSheet from '@/components/shared/FormSheet'

interface EditableRecipient { id: string; name: string; relation: string | null; location: string | null; contact: string | null; notes: string | null }

interface Props { onClose: () => void; onSaved: () => void; editRecipient?: EditableRecipient | null }

export default function RecipientForm({ onClose, onSaved, editRecipient }: Props) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: editRecipient?.name ?? '',
    relation: editRecipient?.relation ?? 'relative',
    location: editRecipient?.location ?? 'UAE',
    contact: editRecipient?.contact ?? '',
    notes: editRecipient?.notes ?? '',
  })
  const F = (f: string, v: string) => setForm(p => ({ ...p, [f]: v }))

  async function save() {
    if (!form.name) return
    setSaving(true); setError('')
    const { data: { user } } = await supabase.auth.getUser()
    const payload = {
      name: form.name, relation: form.relation, location: form.location,
      contact: form.contact || null, notes: form.notes || null,
    }
    const { error: err } = editRecipient
      ? await supabase.from('sadaka_recipients').update(payload).eq('id', editRecipient.id)
      : await supabase.from('sadaka_recipients').insert({ ...payload, created_by_id: user!.id, is_active: true })
    setSaving(false)
    if (err) { setError(err.message); return }
    if (typeof navigator !== 'undefined') navigator.vibrate?.(10)
    onSaved(); onClose()
  }

  return (
    <FormSheet onClose={onClose}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold">{editRecipient ? 'Edit Recipient' : 'New Recipient'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ background: 'var(--surface-2)' }}><X size={16} /></button>
        </div>
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Name</label>
            <input placeholder="Name (e.g. Norine Aunty)" value={form.name} onChange={e => F('name', e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select value={form.relation} onChange={e => F('relation', e.target.value)}
              className="px-3 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
              <option value="relative">Relative</option>
              <option value="needy">Needy</option>
              <option value="widow">Widow</option>
              <option value="student">Student</option>
              <option value="masjid">Masjid</option>
              <option value="other">Other</option>
            </select>
            <select value={form.location} onChange={e => F('location', e.target.value)}
              className="px-3 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
              <option value="UAE">UAE</option>
              <option value="Pakistan">Pakistan</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Contact</label>
            <input placeholder="Contact (phone / optional)" value={form.contact} onChange={e => F('contact', e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Notes</label>
            <input placeholder="Notes (optional)" value={form.notes} onChange={e => F('notes', e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
          </div>
          {error && <div className="px-3 py-2.5 rounded-xl text-xs" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#EF4444' }}>⚠ {error}</div>}
          <button onClick={save} disabled={saving || !form.name}
            className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
            style={{ background: 'var(--gold)', color: '#0a0a0a' }}>
            {saving && <Loader2 size={15} className="animate-spin" />}{saving ? 'Saving…' : editRecipient ? 'Save Changes' : 'Add Recipient'}
          </button>
        </div>
    </FormSheet>
  )
}
