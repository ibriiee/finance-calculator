'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, Loader2 } from 'lucide-react'
import FormSheet from '@/components/shared/FormSheet'
import { formatCurrency } from '@/lib/utils'

interface Props {
  onClose: () => void; onSaved: () => void
  userId: string; aedBalance: number; pkrBalance: number
}

export default function SettleUpModal({ onClose, onSaved, userId, aedBalance, pkrBalance }: Props) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [method, setMethod] = useState<'cash' | 'bank_transfer' | 'goods'>('cash')
  const [notes, setNotes] = useState('')

  // Returns an error string, or null on success. Both writes are checked —
  // a failed settlement must never close the modal looking settled (P2-21).
  async function settleCurrency(currency: 'AED' | 'PKR', balance: number) {
    const { data: settlement, error: insErr } = await supabase.from('ledger_settlements').insert({
      settled_by_id: userId, currency,
      amount: Math.abs(balance), settlement_method: method,
      settlement_date: new Date().toISOString().split('T')[0], notes,
    }).select().single()
    if (insErr || !settlement) return `Could not record the ${currency} settlement: ${insErr?.message ?? 'no row returned'}`
    const { error: updErr } = await supabase.from('brother_ledger')
      .update({ is_settled: true, settlement_id: settlement.id })
      .eq('currency', currency).eq('is_settled', false)
    if (updErr) return `${currency} settlement was recorded, but the ledger entries could not be marked settled: ${updErr.message}. Check the ledger before retrying — a retry would record a second settlement.`
    return null
  }

  async function settle() {
    setSaving(true); setError('')
    if (aedBalance !== 0) {
      const err = await settleCurrency('AED', aedBalance)
      if (err) { setSaving(false); setError(err); return }
    }
    if (pkrBalance !== 0) {
      const err = await settleCurrency('PKR', pkrBalance)
      if (err) { setSaving(false); setError(err); return }
    }
    setSaving(false); onSaved(); onClose()
  }

  return (
    <FormSheet onClose={onClose}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold">Settle Up</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ background: 'var(--surface-2)' }}><X size={16} /></button>
        </div>

        <div className="card-inner p-4 mb-4">
          <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Settling these balances:</p>
          {aedBalance !== 0 && <p className="text-base font-bold text-emerald-400">{formatCurrency(Math.abs(aedBalance), 'AED')}</p>}
          {pkrBalance !== 0 && <p className="text-base font-bold text-emerald-400">{formatCurrency(Math.abs(pkrBalance), 'PKR')}</p>}
        </div>

        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-2">
            {(['cash', 'bank_transfer', 'goods'] as const).map(m => (
              <button key={m} onClick={() => setMethod(m)}
                className="py-2 rounded-xl text-xs font-medium capitalize"
                style={{
                  background: method === m ? 'var(--gold-dim)' : 'var(--surface-2)',
                  border: `1px solid ${method === m ? 'var(--gold)' : 'var(--border)'}`,
                  color: method === m ? 'var(--gold)' : 'var(--text-muted)',
                }}>
                {m.replace('_', ' ')}
              </button>
            ))}
          </div>

          <input placeholder="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />

          {error && (
            <div className="px-3 py-2.5 rounded-xl text-xs" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#EF4444' }}>
              ⚠ {error}
            </div>
          )}

          <button onClick={settle} disabled={saving}
            className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
            style={{ background: '#10B981', color: '#fff' }}>
            {saving && <Loader2 size={15} className="animate-spin" />}
            {saving ? 'Settling…' : 'Confirm Settlement'}
          </button>
        </div>
    </FormSheet>
  )
}
