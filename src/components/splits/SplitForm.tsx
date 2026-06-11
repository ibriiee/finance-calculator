'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, Loader2, Landmark } from 'lucide-react'
import FormSheet from '@/components/shared/FormSheet'

interface Props { onClose: () => void; onSaved: () => void }
interface JointAccount { id: string; name: string; currency: string }

export default function SplitForm({ onClose, onSaved }: Props) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [jointAccounts, setJointAccounts] = useState<JointAccount[]>([])
  const [customCategory, setCustomCategory] = useState(false)
  const [form, setForm] = useState({
    name: '', category: 'house', custom_category: '', total_amount: '', currency: 'AED',
    ibrahim_pct: 50, paid_by: 'ibrahim', paid_from_joint: '', cost_date: new Date().toISOString().split('T')[0],
    is_recurring: false, breakdown: '',
  })
  const F = (f: string, v: any) => setForm(p => ({ ...p, [f]: v }))

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('joint_accounts').select('id, name, currency').eq('is_active', true)
      setJointAccounts((data as any) ?? [])
    })()
  }, [])

  const matchingAccounts = jointAccounts.filter(a => a.currency === form.currency)

  async function save() {
    if (!form.name || !form.total_amount) return
    if (customCategory && !form.custom_category.trim()) { setError('Type your custom category'); return }
    setSaving(true); setError('')
    const { data: { user } } = await supabase.auth.getUser()
    const category = customCategory ? form.custom_category.trim().toLowerCase() : form.category
    const fromJoint = form.paid_by === 'both' && form.paid_from_joint
      ? jointAccounts.find(a => a.id === form.paid_from_joint) : null

    const { data: inserted, error: err } = await supabase.from('shared_costs').insert({
      created_by_id: user!.id, name: form.name, category: category as any,
      total_amount: parseFloat(form.total_amount), currency: form.currency as any,
      ibrahim_pct: form.ibrahim_pct / 100, paid_by: form.paid_by as any,
      cost_date: form.cost_date, is_recurring: form.is_recurring,
      notes: form.breakdown.trim() || null,
      ledger_entry_created: false,
    }).select('id').single()
    if (err) { setSaving(false); setError(err.message); return }

    // Paid from the joint account → record the withdrawal there too,
    // and only then mark the split as settled (nothing left to push to ledger)
    if (fromJoint) {
      const { error: txnErr } = await supabase.from('joint_account_txns').insert({
        account_id: fromJoint.id, txn_type: 'withdrawal', contributor_id: null,
        amount: parseFloat(form.total_amount),
        description: `Split: ${form.name}`,
        category: 'house_expense', txn_date: form.cost_date,
        created_by_id: user!.id,
      })
      if (txnErr) {
        setSaving(false)
        setError(`Split saved, but the joint withdrawal failed: ${txnErr.message}. Add the withdrawal manually in Joint Account.`)
        onSaved()
        return
      }
      await supabase.from('shared_costs').update({ ledger_entry_created: true }).eq('id', inserted!.id)
    }
    setSaving(false); onSaved(); onClose()
  }

  return (
    <FormSheet onClose={onClose}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold">Add Shared Cost</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ background: 'var(--surface-2)' }}><X size={16} /></button>
        </div>

        <div className="flex flex-col gap-3">
          <input placeholder="What is this? (e.g. June house expenses)" value={form.name} onChange={e => F('name', e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />

          <div className="grid grid-cols-2 gap-2">
            <select value={customCategory ? '__custom' : form.category}
              onChange={e => {
                if (e.target.value === '__custom') { setCustomCategory(true) }
                else { setCustomCategory(false); F('category', e.target.value) }
              }}
              className="px-3 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
              <option value="house">🏠 House</option>
              <option value="vehicle">🚗 Vehicle</option>
              <option value="gift">🎁 Gift</option>
              <option value="charity">🤲 Charity</option>
              <option value="investment">📈 Investment</option>
              <option value="business">💼 Business</option>
              <option value="other">Other</option>
              <option value="__custom">✏️ Custom category…</option>
            </select>
            <select value={form.currency} onChange={e => F('currency', e.target.value)}
              className="px-3 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
              <option value="AED">AED</option>
              <option value="PKR">PKR</option>
            </select>
          </div>

          {customCategory && (
            <input placeholder="Custom category (e.g. Islamic tuition, transportation)" value={form.custom_category}
              onChange={e => F('custom_category', e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--gold)', color: 'var(--text-primary)' }} />
          )}

          <input placeholder="Total amount" type="number" value={form.total_amount} onChange={e => F('total_amount', e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />

          {/* Breakdown — one line per item, shown as bullets on the split card */}
          <textarea placeholder={'Breakdown (optional) — one item per line:\n30,000 groceries\n10,000 Islamic tuition for both wives\n5,000 transport'}
            value={form.breakdown} onChange={e => F('breakdown', e.target.value)} rows={3}
            className="w-full px-4 py-3 rounded-xl text-sm resize-y" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />

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

          {/* Paid by both → optionally pay straight from a joint account */}
          {form.paid_by === 'both' && matchingAccounts.length > 0 && (
            <div className="rounded-xl p-3" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <p className="text-xs mb-2 flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                <Landmark size={12} style={{ color: 'var(--gold)' }} /> Where is it being paid from?
              </p>
              <select value={form.paid_from_joint} onChange={e => F('paid_from_joint', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-sm" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                <option value="">Separately (not from joint account)</option>
                {matchingAccounts.map(a => (
                  <option key={a.id} value={a.id}>Joint: {a.name} ({a.currency})</option>
                ))}
              </select>
              {form.paid_from_joint && (
                <p className="text-[11px] mt-2" style={{ color: 'var(--gold)' }}>
                  The amount will be deducted from this joint account as a withdrawal.
                </p>
              )}
            </div>
          )}

          <div className="flex items-center justify-between">
            <input type="date" value={form.cost_date} onChange={e => F('cost_date', e.target.value)}
              className="flex-1 mr-2 px-3 py-2.5 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
            <label className="flex items-center gap-2 cursor-pointer shrink-0">
              <input type="checkbox" checked={form.is_recurring} onChange={e => F('is_recurring', e.target.checked)}
                className="w-4 h-4 rounded accent-[var(--gold)]" />
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Monthly tag</span>
            </label>
          </div>
          {form.is_recurring && (
            <p className="text-[11px] -mt-1" style={{ color: 'var(--text-muted)' }}>
              "Monthly" is only a label for recurring costs — nothing is ever added automatically.
              Every month's entry is added by you.
            </p>
          )}

          {error && <div className="px-3 py-2.5 rounded-xl text-xs" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#EF4444' }}>⚠ {error}</div>}

          <button onClick={save} disabled={saving || !form.name || !form.total_amount}
            className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
            style={{ background: 'var(--gold)', color: '#0a0a0a' }}>
            {saving && <Loader2 size={15} className="animate-spin" />}
            {saving ? 'Saving…' : 'Save Split'}
          </button>
        </div>
    </FormSheet>
  )
}
