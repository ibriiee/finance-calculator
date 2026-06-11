'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, Loader2 } from 'lucide-react'

interface Props {
  onClose: () => void
  onSaved: () => void
  accountId: string
  accountCurrency: string
}

export default function TxnForm({ onClose, onSaved, accountId, accountCurrency }: Props) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [me, setMe] = useState<{ id: string; name: string } | null>(null)
  const [people, setPeople] = useState<{ id: string; name: string }[]>([])
  const [form, setForm] = useState({
    txn_type: 'deposit' as 'deposit' | 'withdrawal',
    amount: '', description: '', category: 'house_expense',
    contributor_id: '', txn_date: new Date().toISOString().split('T')[0],
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
      setForm(p => ({ ...p, contributor_id: user!.id }))
    })()
  }, [])

  async function save() {
    if (!form.amount || !me) return
    setSaving(true); setError('')
    const { error: err } = await supabase.from('joint_account_txns').insert({
      account_id: accountId,
      txn_type: form.txn_type,
      contributor_id: form.txn_type === 'deposit' ? form.contributor_id : null,
      amount: parseFloat(form.amount),
      description: form.description || null,
      category: form.txn_type === 'withdrawal' ? form.category : null,
      txn_date: form.txn_date,
      created_by_id: me.id,
    })
    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved(); onClose()
  }

  const isDeposit = form.txn_type === 'deposit'

  return (
    <div className="fixed inset-0 z-[60] flex items-end" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-lg mx-auto animate-slide-up rounded-t-2xl p-5 pb-8 max-h-[88vh] overflow-y-auto"
           style={{ background: 'var(--surface)', border: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold">Add Transaction</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ background: 'var(--surface-2)' }}><X size={16} /></button>
        </div>
        <div className="flex flex-col gap-3">
          {/* Type */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { val: 'deposit', label: 'Chip in (deposit)' },
              { val: 'withdrawal', label: 'House expense (withdraw)' },
            ].map(o => (
              <button key={o.val} type="button" onClick={() => F('txn_type', o.val)}
                className="py-2.5 px-2 rounded-xl text-xs font-medium"
                style={{ background: form.txn_type === o.val ? 'var(--gold-dim)' : 'var(--surface-2)',
                  border: `1px solid ${form.txn_type === o.val ? 'var(--gold)' : 'var(--border)'}`,
                  color: form.txn_type === o.val ? 'var(--gold)' : 'var(--text-muted)' }}>{o.label}</button>
            ))}
          </div>

          {/* Amount */}
          <div className="grid grid-cols-3 gap-2">
            <div className="flex items-center justify-center rounded-xl text-sm font-semibold"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>{accountCurrency}</div>
            <input placeholder="Amount" type="number" value={form.amount} onChange={e => F('amount', e.target.value)}
              className="col-span-2 px-4 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
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
            <select value={form.category} onChange={e => F('category', e.target.value)}
              className="px-3 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
              <option value="house_expense">House expense</option>
              <option value="rent">Rent</option>
              <option value="utilities">Utilities</option>
              <option value="groceries">Groceries</option>
              <option value="maintenance">Maintenance</option>
              <option value="other">Other</option>
            </select>
          )}

          <input placeholder={isDeposit ? 'Note (optional)' : 'What was it for?'} value={form.description} onChange={e => F('description', e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />

          <input type="date" value={form.txn_date} onChange={e => F('txn_date', e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />

          {error && <div className="px-3 py-2.5 rounded-xl text-xs" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#EF4444' }}>⚠ {error}</div>}

          <button onClick={save} disabled={saving || !form.amount}
            className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
            style={{ background: 'var(--gold)', color: '#0a0a0a' }}>
            {saving && <Loader2 size={15} className="animate-spin" />}{saving ? 'Saving…' : 'Add Transaction'}
          </button>
        </div>
      </div>
    </div>
  )
}
