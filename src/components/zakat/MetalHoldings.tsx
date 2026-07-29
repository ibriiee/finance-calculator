'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Coins, Plus, Pencil, Trash2, Check, X, Loader2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface Holding { id: string; metal: 'gold' | 'silver'; grams: number; description: string | null }

/**
 * Gold & silver you actually hold (#94), feeding the zakat calculation.
 *
 * Grams are stored; value is derived at read time from the live rate. Storing a
 * valuation would rot the moment the metal price moved — the same reason the
 * loans module keeps gold loans in grams.
 *
 * Renders nothing until phase10-upgrades.sql creates metal_holdings. Every row
 * is editable and deletable from day one (project CRUD-parity rule).
 */
export default function MetalHoldings({ goldRate, silverRate, onApply }: {
  goldRate: number
  silverRate: number
  /** Push the totals into the zakat asset fields */
  onApply: (goldGrams: number, silverGrams: number) => void
}) {
  const supabase = createClient()
  const [rows, setRows] = useState<Holding[]>([])
  const [available, setAvailable] = useState(true)
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ metal: 'gold' as 'gold' | 'silver', grams: '', description: '' })

  async function load() {
    const { data, error: err } = await supabase
      .from('metal_holdings').select('*').eq('is_active', true).order('created_at')
    if (err) {
      if (err.code === '42P01' || err.code === 'PGRST205') setAvailable(false)
      return
    }
    setRows((data as any) ?? [])
  }
  useEffect(() => { load() }, [])

  const reset = () => { setForm({ metal: 'gold', grams: '', description: '' }); setAdding(false); setEditingId(null); setError('') }

  async function save() {
    const grams = parseFloat(form.grams)
    if (!(grams > 0)) { setError('Enter the weight in grams'); return }
    setBusy(true); setError('')
    const { data: { user } } = await supabase.auth.getUser()
    const payload = { metal: form.metal, grams, description: form.description.trim() || null }
    const { error: err } = editingId
      ? await supabase.from('metal_holdings').update(payload as any).eq('id', editingId)
      : await supabase.from('metal_holdings').insert({ ...payload, owner_id: user!.id, is_active: true } as any)
    setBusy(false)
    if (err) { setError(err.message); return }
    reset(); load()
  }

  async function remove(h: Holding) {
    if (!confirm(`Delete ${h.grams}g of ${h.metal}${h.description ? ` (${h.description})` : ''}?`)) return
    const { error: err } = await supabase.from('metal_holdings').delete().eq('id', h.id)
    if (err) { alert('Could not delete: ' + err.message); return }
    load()
  }

  if (!available) return null

  const totalGold = rows.filter(r => r.metal === 'gold').reduce((s, r) => s + Number(r.grams), 0)
  const totalSilver = rows.filter(r => r.metal === 'silver').reduce((s, r) => s + Number(r.grams), 0)
  const totalValue = totalGold * goldRate + totalSilver * silverRate

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Coins size={15} style={{ color: 'var(--gold)' }} />
          <h3 className="text-sm font-semibold">Gold &amp; Silver Held</h3>
        </div>
        {!adding && !editingId && (
          <button onClick={() => setAdding(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold"
            style={{ background: 'var(--gold-dim)', color: 'var(--gold)' }}>
            <Plus size={12} /> Add
          </button>
        )}
      </div>

      {rows.length === 0 && !adding && (
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Record what you physically hold — it flows straight into the zakat fields below.
        </p>
      )}

      {rows.map(h => (
        <div key={h.id} className="flex items-center justify-between py-2 border-t first:border-0" style={{ borderColor: 'var(--border)' }}>
          {editingId === h.id ? null : (
            <>
              <div className="min-w-0 mr-3">
                <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                  {h.grams}g {h.metal}
                </p>
                {h.description && <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>{h.description}</p>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-xs font-semibold mr-1" style={{ color: 'var(--gold)' }}>
                  {formatCurrency(Number(h.grams) * (h.metal === 'gold' ? goldRate : silverRate), 'AED', true)}
                </span>
                <button aria-label="Edit holding"
                  onClick={() => { setEditingId(h.id); setAdding(false); setForm({ metal: h.metal, grams: String(h.grams), description: h.description ?? '' }) }}
                  className="p-1.5 rounded-lg" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
                  <Pencil size={11} />
                </button>
                <button onClick={() => remove(h)} aria-label="Delete holding"
                  className="p-1.5 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
                  <Trash2 size={11} />
                </button>
              </div>
            </>
          )}
        </div>
      ))}

      {(adding || editingId) && (
        <div className="flex flex-col gap-2 mt-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="grid grid-cols-2 gap-2">
            {(['gold', 'silver'] as const).map(m => (
              <button key={m} onClick={() => setForm(p => ({ ...p, metal: m }))}
                className="py-2 rounded-xl text-xs font-medium capitalize"
                style={{
                  background: form.metal === m ? 'var(--gold-dim)' : 'var(--surface-2)',
                  border: `1px solid ${form.metal === m ? 'var(--gold)' : 'var(--border)'}`,
                  color: form.metal === m ? 'var(--gold)' : 'var(--text-muted)',
                }}>{m}</button>
            ))}
          </div>
          <input type="number" inputMode="decimal" placeholder="Weight in grams" value={form.grams}
            onChange={e => setForm(p => ({ ...p, grams: e.target.value }))}
            className="px-3 py-2.5 rounded-xl text-sm"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
          <input placeholder="What is it? (e.g. wife's bangles)" value={form.description}
            onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            className="px-3 py-2.5 rounded-xl text-sm"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
          {error && <p className="text-[11px]" style={{ color: '#EF4444' }}>⚠ {error}</p>}
          <div className="flex gap-2">
            <button onClick={save} disabled={busy}
              className="flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5"
              style={{ background: 'var(--gold)', color: '#0a0a0a' }}>
              {busy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              {editingId ? 'Save' : 'Add'}
            </button>
            <button onClick={reset}
              className="px-3 py-2 rounded-lg text-xs" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
              <X size={12} />
            </button>
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {totalGold > 0 && `${totalGold}g gold`}{totalGold > 0 && totalSilver > 0 && ' · '}
              {totalSilver > 0 && `${totalSilver}g silver`}
            </span>
            <span className="text-sm font-semibold" style={{ color: 'var(--gold)' }}>
              {formatCurrency(totalValue, 'AED', true)}
            </span>
          </div>
          <button onClick={() => onApply(totalGold, totalSilver)}
            className="w-full py-2 rounded-lg text-xs font-semibold"
            style={{ background: 'var(--gold-dim)', color: 'var(--gold)' }}>
            Use these totals in the zakat fields below ↓
          </button>
        </div>
      )}
    </div>
  )
}
