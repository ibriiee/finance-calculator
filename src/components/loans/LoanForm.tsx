'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import FormSheet from '@/components/shared/FormSheet'
import { validateAmount } from '@/lib/utils'
import type { LoanType, LoanCurrencyType } from '@/types/database.types'

interface Props { onClose: () => void; onSaved: () => void }

export default function LoanForm({ onClose, onSaved }: Props) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [me, setMe] = useState('')
  const [people, setPeople] = useState<{ id: string; name: string }[]>([])
  const [ownerId, setOwnerId] = useState('')
  const [form, setForm] = useState({
    counterparty_name: '', loan_type: 'i_owe' as LoanType,
    currency_type: 'AED' as LoanCurrencyType, original_amount: '',
    date_taken: new Date().toISOString().split('T')[0], due_date: '', notes: '',
  })
  const F = (f: string, v: string) => setForm(p => ({ ...p, [f]: v }))
  const isGold = ['gold_grams', 'silver_grams'].includes(form.currency_type)

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setMe(user!.id); setOwnerId(user!.id)
      const { data: profs } = await supabase.from('profiles').select('id, display_name')
      setPeople((profs ?? []).map((p: any) => ({ id: p.id, name: p.display_name ?? 'User' })))
    })()
  }, [])

  async function save() {
    if (!form.counterparty_name.trim()) { setError('Name is required'); return }
    const amtErr = validateAmount(form.original_amount, form.currency_type)
    if (amtErr) { setError(amtErr); return }
    if (!me) return
    setSaving(true); setError('')
    const row = {
      owner_id: ownerId || me, counterparty_name: form.counterparty_name,
      loan_type: form.loan_type, currency_type: form.currency_type,
      original_amount: parseFloat(form.original_amount),
      date_taken: form.date_taken, due_date: form.due_date || null,
      status: 'outstanding' as const, notes: form.notes || null, joint_ibrahim_pct: 0.5,
    }
    let { error: err } = await supabase.from('loans').insert({ ...row, added_by_id: me })
    // Until migration 12 (loans-shared.sql) runs, the column doesn't exist — save without it
    // (42703 = Postgres undefined column, PGRST204 = PostgREST column not in schema cache)
    if (err && (err.code === '42703' || err.code === 'PGRST204' || err.message.includes('added_by_id'))) {
      ({ error: err } = await supabase.from('loans').insert(row))
    }
    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved(); onClose()
  }

  return (
    <FormSheet onClose={onClose}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold">Add Loan</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ background: 'var(--surface-2)' }}><X size={16} /></button>
        </div>

        <div className="flex flex-col gap-3">
          <input placeholder="Person / Organisation name" value={form.counterparty_name} onChange={e => F('counterparty_name', e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />

          {/* Whose loan — recorded with "Added by you" so the other brother sees who reported it */}
          {people.length > 1 && (
            <div>
              <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Whose loan is this?</p>
              <div className="grid grid-cols-2 gap-2">
                {people.map(p => (
                  <button key={p.id} type="button" onClick={() => setOwnerId(p.id)}
                    className="py-2.5 px-2 rounded-xl text-xs font-medium truncate"
                    style={{
                      background: ownerId === p.id ? 'var(--gold-dim)' : 'var(--surface-2)',
                      border: `1px solid ${ownerId === p.id ? 'var(--gold)' : 'var(--border)'}`,
                      color: ownerId === p.id ? 'var(--gold)' : 'var(--text-muted)',
                    }}>
                    {p.id === me ? `${p.name} (you)` : p.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            {(['i_owe', 'they_owe', 'joint'] as LoanType[]).map(t => (
              <button key={t} onClick={() => F('loan_type', t)}
                className="py-2.5 rounded-xl text-xs font-medium"
                style={{
                  background: form.loan_type === t ? 'var(--gold-dim)' : 'var(--surface-2)',
                  border: `1px solid ${form.loan_type === t ? 'var(--gold)' : 'var(--border)'}`,
                  color: form.loan_type === t ? 'var(--gold)' : 'var(--text-muted)',
                }}>
                {t === 'i_owe' ? 'I owe' : t === 'they_owe' ? 'They owe' : 'Joint'}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <select value={form.currency_type} onChange={e => F('currency_type', e.target.value)}
              className="px-3 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
              <option value="AED">AED (cash)</option>
              <option value="PKR">PKR (cash)</option>
              <option value="USD">USD (cash)</option>
              <option value="gold_grams">Gold (grams)</option>
              <option value="silver_grams">Silver (grams)</option>
            </select>
            <input placeholder={isGold ? 'Grams' : 'Amount'} type="number" value={form.original_amount} onChange={e => F('original_amount', e.target.value)}
              className="px-4 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
          </div>

          {/* ── ADVANCED TOGGLE ── */}
          <button type="button" onClick={() => setShowAdvanced(v => !v)}
            className="flex items-center gap-1.5 text-xs py-1" style={{ color: 'var(--text-muted)' }}>
            {showAdvanced ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            Advanced {showAdvanced ? '▲' : '▾'}
          </button>

          {showAdvanced && (
            <div className="flex flex-col gap-3">
              {isGold && (
                <div className="px-3 py-2 rounded-lg text-xs" style={{ background: 'rgba(201,168,76,0.1)', color: 'var(--gold)' }}>
                  ℹ Gold/silver loans: return same grams at today's price (Qard Hasan rule)
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Date taken</label>
                  <input type="date" value={form.date_taken} onChange={e => F('date_taken', e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Due date (opt.)</label>
                  <input type="date" value={form.due_date} onChange={e => F('due_date', e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
                </div>
              </div>

              <input placeholder="Notes (optional)" value={form.notes} onChange={e => F('notes', e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
            </div>
          )}

          {error && <div className="px-3 py-2.5 rounded-xl text-xs" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#EF4444' }}>⚠ {error}</div>}

          <button onClick={save} disabled={saving || !form.counterparty_name || !form.original_amount}
            className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
            style={{ background: 'var(--gold)', color: '#0a0a0a' }}>
            {saving && <Loader2 size={15} className="animate-spin" />}
            {saving ? 'Saving…' : 'Save Loan'}
          </button>
        </div>
    </FormSheet>
  )
}
