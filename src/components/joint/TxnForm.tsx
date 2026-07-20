'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { validateAmount, formatCurrency } from '@/lib/utils'
import { X, Loader2, ArrowDownCircle, ArrowUpCircle } from 'lucide-react'
import FormSheet from '@/components/shared/FormSheet'

export interface EditableTxn {
  id: string
  txn_type: string
  contributor_id: string | null
  amount: number
  description: string | null
  category: string | null
  txn_date: string
}

interface Props {
  onClose: () => void
  onSaved: () => void
  accountId: string
  accountCurrency: string
  editTxn?: EditableTxn | null
  /** Pre-fill amount (e.g. "chip in to be equal" from the fairness banner) */
  defaultAmount?: number
}

const GREEN = '#10B981'
const RED = '#EF4444'

export default function TxnForm({ onClose, onSaved, accountId, accountCurrency, editTxn, defaultAmount }: Props) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [me, setMe] = useState<{ id: string; name: string } | null>(null)
  const [people, setPeople] = useState<{ id: string; name: string }[]>([])
  const [form, setForm] = useState({
    txn_type: (editTxn?.txn_type ?? 'deposit') as 'deposit' | 'withdrawal',
    amount: editTxn ? String(editTxn.amount) : defaultAmount ? String(Math.round(defaultAmount * 100) / 100) : '',
    description: editTxn?.description ?? '',
    category: editTxn?.category ?? 'house_expense',
    contributor_id: editTxn?.contributor_id ?? '',
    txn_date: editTxn?.txn_date ?? new Date().toISOString().split('T')[0],
  })
  const F = (f: string, v: string) => setForm(p => ({ ...p, [f]: v }))

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profs } = await supabase.from('profiles').select('id, display_name')
      const list = (profs ?? []).map((p: any) => ({ id: p.id, name: p.display_name ?? 'User' }))
      setPeople(list)
      const mine = list.find(p => p.id === user!.id)
      setMe(mine ?? { id: user!.id, name: 'Me' })
      if (!editTxn) setForm(p => ({ ...p, contributor_id: user!.id }))
    })()
  }, [])

  async function save() {
    if (!me) return
    const amtErr = validateAmount(form.amount, accountCurrency)
    if (amtErr) { setError(amtErr); return }
    if (form.txn_type === 'deposit' && !form.contributor_id) { setError('Pick who chipped in'); return }
    setSaving(true); setError('')
    const payload = {
      txn_type: form.txn_type,
      contributor_id: form.txn_type === 'deposit' ? form.contributor_id : null,
      amount: parseFloat(form.amount),
      description: form.description || null,
      category: form.txn_type === 'withdrawal' ? form.category : null,
      txn_date: form.txn_date,
    }
    const { error: err } = editTxn
      ? await supabase.from('joint_account_txns').update(payload).eq('id', editTxn.id)
      : await supabase.from('joint_account_txns').insert({ ...payload, account_id: accountId, created_by_id: me.id })
    setSaving(false)
    if (err) { setError(err.message); return }
    if (typeof navigator !== 'undefined') navigator.vibrate?.(10)
    onSaved(); onClose()
  }

  const isDeposit = form.txn_type === 'deposit'
  const accent = isDeposit ? GREEN : RED
  const accentBg = isDeposit ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)'
  const amt = parseFloat(form.amount)

  return (
    <FormSheet onClose={onClose}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold">{editTxn ? 'Edit Transaction' : 'Add Transaction'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ background: 'var(--surface-2)' }}><X size={16} /></button>
        </div>
        <div className="flex flex-col gap-3">
          {/* Type — green = money in, red = money out */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { val: 'deposit', label: 'Chip in (deposit)', Icon: ArrowDownCircle, color: GREEN, bg: 'rgba(16,185,129,0.12)' },
              { val: 'withdrawal', label: 'House expense (withdraw)', Icon: ArrowUpCircle, color: RED, bg: 'rgba(239,68,68,0.12)' },
            ].map(o => {
              const active = form.txn_type === o.val
              return (
                <button key={o.val} type="button" onClick={() => F('txn_type', o.val)}
                  className="py-2.5 px-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5"
                  style={{ background: active ? o.bg : 'var(--surface-2)',
                    border: `1px solid ${active ? o.color : 'var(--border)'}`,
                    color: active ? o.color : 'var(--text-muted)' }}>
                  <o.Icon size={14} /> {o.label}</button>
              )
            })}
          </div>

          {/* Amount — sign + border follow the type */}
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Amount</label>
            <div className="grid grid-cols-3 gap-2">
              <div className="flex items-center justify-center gap-1 rounded-xl text-sm font-semibold"
                style={{ background: accentBg, border: `1px solid ${accent}`, color: accent }}>
                {isDeposit ? '+' : '−'} {accountCurrency}</div>
              <input placeholder="Amount" type="number" inputMode="decimal" value={form.amount} onChange={e => F('amount', e.target.value)}
                className="col-span-2 px-4 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: `1px solid ${accent}`, color: 'var(--text-primary)' }} />
            </div>
          </div>

          {/* Quick-add chips — accumulate onto the current amount */}
          <div className="grid grid-cols-4 gap-2">
            {[100, 500, 1000, 5000].map(n => (
              <button key={n} type="button" onClick={() => F('amount', String((parseFloat(form.amount) || 0) + n))}
                className="py-2 rounded-xl text-xs font-medium"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                +{n >= 1000 ? `${n / 1000}k` : n}
              </button>
            ))}
          </div>

          {/* Contributor (deposit only) */}
          {isDeposit && (
            <div>
              <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Who chipped in</p>
              <div className="grid grid-cols-2 gap-2">
                {people.map(p => (
                  <button key={p.id} type="button" onClick={() => F('contributor_id', p.id)}
                    className="py-2.5 px-2 rounded-xl text-xs font-medium truncate"
                    style={{ background: form.contributor_id === p.id ? 'var(--gold-dim)' : 'var(--surface-2)',
                      border: `1px solid ${form.contributor_id === p.id ? 'var(--gold)' : 'var(--border)'}`,
                      color: form.contributor_id === p.id ? 'var(--gold)' : 'var(--text-muted)' }}>
                    {p.id === me?.id ? `${p.name} (you)` : p.name}</button>
                ))}
              </div>
            </div>
          )}

          {/* Category (withdrawal only) */}
          {!isDeposit && (
            <select value={form.category ?? 'house_expense'} onChange={e => F('category', e.target.value)}
              className="px-3 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
              <option value="house_expense">House expense</option>
              <option value="rent">Rent</option>
              <option value="utilities">Utilities</option>
              <option value="groceries">Groceries</option>
              <option value="maintenance">Maintenance</option>
              <option value="other">Other</option>
            </select>
          )}

          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>{isDeposit ? 'Note' : 'Description'}</label>
            <input placeholder={isDeposit ? 'Note (optional)' : 'What was it for?'} value={form.description} onChange={e => F('description', e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
          </div>

          <div className="flex gap-2">
            <button type="button" onClick={() => F('txn_date', new Date().toISOString().split('T')[0])}
              className="px-3 py-2 rounded-xl text-xs font-medium"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              Today
            </button>
            <button type="button" onClick={() => F('txn_date', new Date(Date.now() - 86400000).toISOString().split('T')[0])}
              className="px-3 py-2 rounded-xl text-xs font-medium"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              Yesterday
            </button>
          </div>
          <input type="date" value={form.txn_date} onChange={e => F('txn_date', e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />

          {/* Live preview of what this txn does to the balance */}
          {!isNaN(amt) && amt > 0 && (
            <div className="px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5"
              style={{ background: accentBg, color: accent }}>
              {isDeposit ? <ArrowDownCircle size={14} /> : <ArrowUpCircle size={14} />}
              {isDeposit ? `+${formatCurrency(amt, accountCurrency, true)} goes IN to the account`
                : `−${formatCurrency(amt, accountCurrency, true)} comes OUT of the account`}
            </div>
          )}

          {error && <div className="px-3 py-2.5 rounded-xl text-xs" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#EF4444' }}>⚠ {error}</div>}

          <button onClick={save} disabled={saving || !form.amount}
            className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
            style={{ background: accent, color: '#fff' }}>
            {saving && <Loader2 size={15} className="animate-spin" />}
            {saving ? 'Saving…' : editTxn ? 'Save Changes' : isDeposit ? 'Add Deposit +' : 'Add Expense −'}
          </button>
        </div>
    </FormSheet>
  )
}
