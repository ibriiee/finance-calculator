'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { validateAmount } from '@/lib/utils'
import { X, Loader2 } from 'lucide-react'
import FormSheet from '@/components/shared/FormSheet'

interface Props { onClose: () => void; onSaved: () => void }

export default function GoalForm({ onClose, onSaved }: Props) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '', goal_type: 'joint' as 'individual' | 'joint',
    target_amount: '', currency: 'AED', target_date: '',
    contribution_method: 'manual', auto_pct: '',
  })
  const F = (f: string, v: any) => setForm(p => ({ ...p, [f]: v }))

  async function save() {
    if (!form.name.trim()) { setError('Goal name is required'); return }
    const amtErr = validateAmount(form.target_amount, form.currency)
    if (amtErr) { setError(amtErr); return }
    setSaving(true); setError('')
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('financial_goals').insert({
      owner_id: form.goal_type === 'individual' ? user!.id : null,
      goal_type: form.goal_type, name: form.name,
      target_amount: parseFloat(form.target_amount), currency: form.currency as any,
      target_date: form.target_date || null,
      contribution_method: form.contribution_method as any,
      auto_pct: form.auto_pct ? parseFloat(form.auto_pct) / 100 : null,
      is_active: true,
    })
    setSaving(false); onSaved(); onClose()
  }

  return (
    <FormSheet onClose={onClose}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold">New Goal</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ background: 'var(--surface-2)' }}><X size={16} /></button>
        </div>

        <div className="flex flex-col gap-3">
          <input placeholder="Goal name (e.g. Emergency Fund, Toyota Camry)" value={form.name} onChange={e => F('name', e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />

          <div className="grid grid-cols-2 gap-2">
            {(['individual', 'joint'] as const).map(t => (
              <button key={t} onClick={() => F('goal_type', t)}
                className="py-2.5 rounded-xl text-sm font-medium"
                style={{
                  background: form.goal_type === t ? 'var(--gold-dim)' : 'var(--surface-2)',
                  border: `1px solid ${form.goal_type === t ? 'var(--gold)' : 'var(--border)'}`,
                  color: form.goal_type === t ? 'var(--gold)' : 'var(--text-muted)',
                }}>
                {t === 'joint' ? '👥 Joint' : '👤 Individual'}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <select value={form.currency} onChange={e => F('currency', e.target.value)}
              className="px-3 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
              <option value="AED">AED</option>
              <option value="PKR">PKR</option>
            </select>
            <input placeholder="Target amount" type="number" value={form.target_amount} onChange={e => F('target_amount', e.target.value)}
              className="col-span-2 px-4 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
          </div>

          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Target date (optional)</label>
            <input type="date" value={form.target_date} onChange={e => F('target_date', e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
          </div>

          {error && <p className="text-xs" style={{ color: '#EF4444' }}>{error}</p>}

          <button onClick={save} disabled={saving || !form.name || !form.target_amount}
            className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
            style={{ background: 'var(--gold)', color: '#0a0a0a' }}>
            {saving && <Loader2 size={15} className="animate-spin" />}
            {saving ? 'Saving…' : 'Create Goal'}
          </button>
        </div>
    </FormSheet>
  )
}
