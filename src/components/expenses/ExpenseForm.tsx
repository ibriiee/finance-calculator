'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, Loader2, ChevronDown, ChevronUp, Users } from 'lucide-react'
import FormSheet from '@/components/shared/FormSheet'
import { validateAmount } from '@/lib/utils'
import type { Expense } from '@/types/database.types'

interface Props { onClose: () => void; onSaved: () => void; editItem?: Expense | null }

export const EXPENSE_CATEGORIES: { value: string; label: string }[] = [
  { value: 'rent', label: '🏠 Rent / Housing' },
  { value: 'utilities', label: '💡 Bills (Du, internet)' },
  { value: 'groceries', label: '🛒 Groceries' },
  { value: 'food_out', label: '🍔 Food / Eating out' },
  { value: 'petrol', label: '⛽ Petrol / Transport' },
  { value: 'vape', label: '💨 Vape / Nicotine' },
  { value: 'sent_home', label: '🏡 Sent home' },
  { value: 'health', label: '💊 Health' },
  { value: 'gift', label: '🎁 Gift' },
  { value: 'subscription', label: '📱 Subscription' },
  { value: 'business', label: '💼 Business' },
  { value: 'other', label: '• Other' },
]

export default function ExpenseForm({ onClose, onSaved, editItem }: Props) {
  const supabase = createClient()
  const isEdit = !!editItem
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [customCat, setCustomCat] = useState(
    !!editItem && !EXPENSE_CATEGORIES.some(c => c.value === editItem.category)
  )
  const [form, setForm] = useState({
    description: editItem?.description ?? '',
    category: editItem?.category ?? 'groceries',
    custom_category: editItem && !EXPENSE_CATEGORIES.some(c => c.value === editItem.category) ? editItem.category : '',
    amount: editItem?.amount ? String(editItem.amount) : '',
    currency: editItem?.currency ?? 'AED',
    expense_date: editItem?.expense_date ?? new Date().toISOString().split('T')[0],
    is_shared: editItem?.is_shared ?? false,
    my_pct: editItem?.my_pct != null ? Math.round(editItem.my_pct * 100) : 50,
    notes: editItem?.notes ?? '',
  })
  const F = (f: string, v: any) => setForm(p => ({ ...p, [f]: v }))

  const amountNum = parseFloat(form.amount || '0')
  const myShare = form.is_shared ? amountNum * (form.my_pct / 100) : amountNum
  const theirShare = amountNum - myShare

  async function save() {
    if (!form.description.trim()) { setError('What was it for?'); return }
    const amtErr = validateAmount(form.amount, form.currency)
    if (amtErr) { setError(amtErr); return }
    if (customCat && !form.custom_category.trim()) { setError('Type your custom category'); return }
    setSaving(true); setError('')
    const { data: { user } } = await supabase.auth.getUser()
    const category = customCat ? form.custom_category.trim().toLowerCase() : form.category
    const myPct = form.is_shared ? form.my_pct / 100 : 1

    const payload = {
      owner_id: user!.id,
      description: form.description.trim(),
      category,
      amount: amountNum,
      currency: form.currency as 'AED' | 'PKR',
      expense_date: form.expense_date,
      is_shared: form.is_shared,
      my_pct: myPct,
      notes: form.notes.trim() || null,
    }

    let expenseId = editItem?.id
    if (isEdit) {
      const { error: err } = await supabase.from('expenses').update(payload).eq('id', editItem!.id)
      if (err) { setSaving(false); setError(err.message); return }
    } else {
      const { data, error: err } = await supabase.from('expenses').insert(payload).select('id').single()
      if (err) { setSaving(false); setError(err.message); return }
      expenseId = data!.id
    }

    // Shared → the brother owes me his share. Create one brother_ledger IOU
    // (only on create, to avoid duplicating on edit — edit keeps it simple).
    // Every step is checked: the expense is already saved at this point, so a
    // silent IOU failure would leave the brother's share untracked (P2-22).
    if (!isEdit && form.is_shared && theirShare > 0) {
      const iouFail = (msg: string) => {
        setSaving(false)
        onSaved()   // refresh the list — the expense itself DID save
        setError(`Expense saved, but the IOU for your brother could NOT be created (${msg}). Delete this expense and re-add it.`)
      }
      const { data: other, error: profErr } = await supabase.from('profiles').select('id').neq('id', user!.id).single()
      if (profErr || !other) { iouFail(profErr?.message ?? 'brother profile not found'); return }
      const { data: led, error: ledErr } = await supabase.from('brother_ledger').insert({
        from_user_id: user!.id,        // I paid → I'm owed
        to_user_id: other.id,          // brother owes his share
        amount: theirShare,
        currency: form.currency as 'AED' | 'PKR',
        category: 'shared_cost',
        description: `Shared: ${form.description.trim()}`,
        transaction_date: form.expense_date,
        source_type: 'shared_split',
        source_id: expenseId ?? null,
        is_settled: false,
      }).select('id').single()
      if (ledErr || !led) { iouFail(ledErr?.message ?? 'no row returned'); return }
      const { error: linkErr } = await supabase.from('expenses').update({ ledger_entry_id: led.id }).eq('id', expenseId!)
      if (linkErr) {
        setSaving(false); onSaved()
        setError(`Saved, but the expense could not be linked to its IOU (${linkErr.message}) — deleting this expense later will NOT remove the IOU automatically.`)
        return
      }
    }

    setSaving(false); onSaved(); onClose()
  }

  return (
    <FormSheet onClose={onClose}>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-bold">{isEdit ? 'Edit' : 'Add'} Expense</h2>
        <button onClick={onClose} className="p-1.5 rounded-lg" style={{ background: 'var(--surface-2)' }}><X size={16} /></button>
      </div>

      <div className="flex flex-col gap-3">
        {/* Amount */}
        <div className="grid grid-cols-3 gap-2">
          <select value={form.currency} onChange={e => F('currency', e.target.value)}
            className="px-3 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
            <option value="AED">AED</option>
            <option value="PKR">PKR</option>
          </select>
          <input placeholder="Amount" type="number" value={form.amount} onChange={e => F('amount', e.target.value)}
            className="col-span-2 px-4 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
        </div>

        {/* Category */}
        <select value={customCat ? '__custom' : form.category}
          onChange={e => {
            if (e.target.value === '__custom') setCustomCat(true)
            else { setCustomCat(false); F('category', e.target.value) }
          }}
          className="px-3 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
          {EXPENSE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          <option value="__custom">✏️ Custom…</option>
        </select>
        {customCat && (
          <input placeholder="Custom category" value={form.custom_category} onChange={e => F('custom_category', e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--gold)', color: 'var(--text-primary)' }} />
        )}

        {/* Description */}
        <input placeholder="What was it for?" value={form.description} onChange={e => F('description', e.target.value)}
          className="w-full px-4 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />

        {/* Date */}
        <input type="date" value={form.expense_date} onChange={e => F('expense_date', e.target.value)}
          className="w-full px-3 py-2.5 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />

        {/* Advanced toggle */}
        <button type="button" onClick={() => setShowAdvanced(v => !v)}
          className="flex items-center gap-1.5 text-xs py-1" style={{ color: 'var(--text-muted)' }}>
          {showAdvanced ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          Advanced {showAdvanced ? '▲' : '▾'}
        </button>

        {showAdvanced && (
          <div className="flex flex-col gap-3">
            {/* Shared split */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_shared} onChange={e => F('is_shared', e.target.checked)}
                className="w-4 h-4 rounded accent-[var(--gold)]" />
              <span className="text-sm flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                <Users size={13} /> Split with brother
              </span>
            </label>

            {form.is_shared && (
              <div className="rounded-xl p-3 flex flex-col gap-2" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
                  <span>My share: {form.my_pct}%</span>
                  <span>Brother: {100 - form.my_pct}%</span>
                </div>
                <input type="range" min={0} max={100} step={5} value={form.my_pct}
                  onChange={e => F('my_pct', parseInt(e.target.value))} className="w-full accent-[var(--gold)]" />
                {amountNum > 0 && (
                  <p className="text-[11px]" style={{ color: 'var(--gold)' }}>
                    You bear {myShare.toLocaleString()} {form.currency} · brother owes you {theirShare.toLocaleString()} {form.currency} (added to ledger)
                  </p>
                )}
              </div>
            )}

            <textarea placeholder="Notes (optional)" value={form.notes} onChange={e => F('notes', e.target.value)} rows={2}
              className="w-full px-4 py-3 rounded-xl text-sm resize-none" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
          </div>
        )}

        {error && <div className="px-3 py-2.5 rounded-xl text-xs" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#EF4444' }}>⚠ {error}</div>}

        <button onClick={save} disabled={saving || !form.amount || !form.description}
          className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
          style={{ background: 'var(--gold)', color: '#0a0a0a' }}>
          {saving && <Loader2 size={15} className="animate-spin" />}
          {saving ? 'Saving…' : isEdit ? 'Update Expense' : 'Save Expense'}
        </button>
      </div>
    </FormSheet>
  )
}
