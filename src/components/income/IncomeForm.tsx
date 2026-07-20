'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ownershipForEmail, validateAmount } from '@/lib/utils'
import { X, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import FormSheet from '@/components/shared/FormSheet'
import type { Currency, IncomeType, Ownership } from '@/types/database.types'

interface Props { onClose: () => void; onSaved: () => void; editItem?: any }

export default function IncomeForm({ onClose, onSaved, editItem }: Props) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const isEdit = !!editItem
  // Currency/ownership edits don't reach the sadaka trigger (it only reacts to
  // amount), so changing either here would silently desync a linked
  // obligation's currency or split. Lock both once sadaka has been triggered.
  const sadakaLocked = isEdit && !!editItem?.sadaka_triggered
  const DRAFT_KEY = 'mizan_income_draft'
  const defaultForm = {
    name: editItem?.name ?? '',
    type: (editItem?.type ?? 'gig') as IncomeType,
    currency: (editItem?.currency ?? 'AED') as Currency,
    amount: editItem?.amount ? String(editItem.amount) : '',
    work_started_date: editItem?.work_started_date ?? '',
    work_completed_date: editItem?.work_completed_date ?? new Date().toISOString().split('T')[0],
    expected_payment_date: editItem?.expected_payment_date ?? '',
    ownership: (editItem?.ownership ?? 'ibrahim') as Ownership,
    is_ongoing: editItem?.is_ongoing ?? false,
    notes: editItem?.notes ?? '',
  }
  const [form, setForm] = useState(() => {
    if (!editItem && typeof window !== 'undefined') {
      try { const s = localStorage.getItem(DRAFT_KEY); if (s) return { ...defaultForm, ...JSON.parse(s) } } catch {}
    }
    return defaultForm
  })

  // New entries default to the logged-in user's ownership, not a fixed name
  useEffect(() => {
    if (isEdit) return
    supabase.auth.getUser().then(({ data: { user } }) => {
      const mine = ownershipForEmail(user?.email)
      if (mine) setForm((p: any) => ({ ...p, ownership: mine }))
    })
  }, [])

  async function save() {
    if (!form.name.trim()) { setError('Project name is required'); return }
    const amtErr = validateAmount(form.amount, form.currency)
    if (amtErr) { setError(amtErr); return }
    setSaving(true); setError('')
    const { data: { user } } = await supabase.auth.getUser()
    const payload = {
      name: form.name, type: form.type, currency: form.currency,
      amount: parseFloat(form.amount),
      work_started_date: form.work_started_date || null,
      work_completed_date: form.is_ongoing ? null : form.work_completed_date,
      expected_payment_date: form.expected_payment_date || null,
      ownership: form.ownership, is_ongoing: form.is_ongoing,
      notes: form.notes || null,
    }
    let err
    if (isEdit) {
      ;({ error: err } = await supabase.from('income_projects').update(payload).eq('id', editItem.id))
    } else {
      ;({ error: err } = await supabase.from('income_projects').insert({
        ...payload, owner_id: user!.id, status: 'pending', sadaka_triggered: false,
      }))
    }
    setSaving(false)
    if (err) { setError(err.message); return }
    try { localStorage.removeItem(DRAFT_KEY) } catch {}
    if (typeof navigator !== 'undefined') navigator.vibrate?.(10)
    onSaved(); onClose()
  }

  const F = (field: string, val: any) => setForm((p: any) => {
    const next = { ...p, [field]: val }
    if (!isEdit) { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(next)) } catch {} }
    return next
  })

  return (
    <FormSheet onClose={onClose}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold">{isEdit ? 'Edit' : 'Add'} Income / Project</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ background: 'var(--surface-2)' }}>
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Project name</label>
            <input placeholder="Project name" value={form.name} onChange={e => F('name', e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <select value={form.type} onChange={e => F('type', e.target.value)}
              className="px-3 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
              <option value="gig">Gig (1-3 days)</option>
              <option value="short_contract">Short Contract</option>
              <option value="long_contract">Long Contract</option>
              <option value="gift">Gift</option>
              <option value="other">Other</option>
            </select>
            <select value={form.ownership} onChange={e => F('ownership', e.target.value)} disabled={sadakaLocked}
              className="px-3 py-3 rounded-xl text-sm disabled:opacity-50" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
              <option value="ibrahim">Ibrahim</option>
              <option value="abu_bakar">Abu Bakar</option>
              <option value="shared">Shared</option>
            </select>
          </div>

          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Amount</label>
            <div className="grid grid-cols-3 gap-2">
              <select value={form.currency} onChange={e => F('currency', e.target.value)} disabled={sadakaLocked}
                className="px-3 py-3 rounded-xl text-sm disabled:opacity-50" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                <option value="AED">AED</option>
                <option value="PKR">PKR</option>
              </select>
              <input placeholder="Amount" type="number" inputMode="decimal" value={form.amount} onChange={e => F('amount', e.target.value)}
                className="col-span-2 px-4 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
            </div>
          </div>
          {sadakaLocked && (
            <p className="text-[11px] -mt-1" style={{ color: 'var(--text-muted)' }}>
              Currency & ownership locked — linked sadaka exists (delete & re-add to change).
            </p>
          )}

          {/* ── ADVANCED TOGGLE ── */}
          <button type="button" onClick={() => setShowAdvanced(v => !v)}
            className="flex items-center gap-1.5 text-xs py-1" style={{ color: 'var(--text-muted)' }}>
            {showAdvanced ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            Advanced {showAdvanced ? '▲' : '▾'}
          </button>

          {showAdvanced && (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Work started</label>
                  <input type="date" value={form.work_started_date} onChange={e => F('work_started_date', e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Work completed</label>
                  <input type="date" value={form.work_completed_date} disabled={form.is_ongoing}
                    onChange={e => F('work_completed_date', e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl text-sm disabled:opacity-40" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_ongoing} onChange={e => F('is_ongoing', e.target.checked)}
                  className="w-4 h-4 rounded accent-[var(--gold)]" />
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Work is still ongoing (no completion date yet)</span>
              </label>

              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Expected payment</label>
                <input type="date" value={form.expected_payment_date} onChange={e => F('expected_payment_date', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
              </div>

              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Notes</label>
                <textarea placeholder="Notes (optional)" value={form.notes} onChange={e => F('notes', e.target.value)} rows={2}
                  className="w-full px-4 py-3 rounded-xl text-sm resize-none" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
              </div>
            </div>
          )}

          {error && <div className="px-3 py-2.5 rounded-xl text-xs" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#EF4444' }}>⚠ {error}</div>}

          <button onClick={save} disabled={saving || !form.name || !form.amount}
            className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
            style={{ background: (!form.name || !form.amount) ? 'var(--border)' : 'var(--gold)', color: '#0a0a0a' }}>
            {saving && <Loader2 size={15} className="animate-spin" />}
            {saving ? 'Saving…' : isEdit ? 'Update Income' : 'Save Income'}
          </button>
        </div>
    </FormSheet>
  )
}
