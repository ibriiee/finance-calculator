'use client'
import { useState } from 'react'
import ModuleHeader from '@/components/shared/ModuleHeader'
import { Scale, Minus, Plus, AlertTriangle } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { computeFaraid, fracLabel, toNumber, type Heirs } from '@/lib/faraid'

const EMPTY: Heirs = { husband: false, wives: 0, sons: 0, daughters: 0, father: false, mother: false }

export default function FaraidPage() {
  const [heirs, setHeirs] = useState<Heirs>(EMPTY)
  const [estate, setEstate] = useState('')
  const [currency, setCurrency] = useState('AED')

  const set = <K extends keyof Heirs>(k: K, v: Heirs[K]) => setHeirs(p => ({ ...p, [k]: v }))
  const bump = (k: 'wives' | 'sons' | 'daughters', by: number) =>
    setHeirs(p => ({ ...p, [k]: Math.max(0, Math.min(20, p[k] + by)) }))

  const result = computeFaraid(heirs)
  const amount = parseFloat(estate)
  const hasEstate = !isNaN(amount) && amount > 0
  const anyHeir = heirs.husband || heirs.wives > 0 || heirs.sons > 0 || heirs.daughters > 0 || heirs.father || heirs.mother

  const Counter = ({ label, k }: { label: string; k: 'wives' | 'sons' | 'daughters' }) => (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <div className="flex items-center gap-3">
        <button onClick={() => bump(k, -1)} aria-label={`One fewer ${label}`}
          className="p-1.5 rounded-lg" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
          <Minus size={13} />
        </button>
        <span className="w-5 text-center text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{heirs[k]}</span>
        <button onClick={() => bump(k, 1)} aria-label={`One more ${label}`}
          className="p-1.5 rounded-lg" style={{ background: 'var(--gold-dim)', color: 'var(--gold)' }}>
          <Plus size={13} />
        </button>
      </div>
    </div>
  )

  const Toggle = ({ label, k }: { label: string; k: 'husband' | 'father' | 'mother' }) => (
    <button onClick={() => set(k, !heirs[k])}
      className="py-2.5 px-3 rounded-xl text-sm font-medium text-left"
      style={{
        background: heirs[k] ? 'var(--gold-dim)' : 'var(--surface-2)',
        border: `1px solid ${heirs[k] ? 'var(--gold)' : 'var(--border)'}`,
        color: heirs[k] ? 'var(--gold)' : 'var(--text-muted)',
      }}>
      {heirs[k] ? '✓ ' : ''}{label}
    </button>
  )

  return (
    <div className="flex flex-col gap-4 p-4 animate-slide-up">
      <ModuleHeader title="Faraid" subtitle="Islamic inheritance shares" />

      {/* The limits come FIRST — before anyone acts on a number. */}
      <div className="rounded-xl px-4 py-3 text-xs leading-relaxed"
        style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.35)', color: '#F59E0B' }}>
        <span className="font-semibold flex items-center gap-1.5 mb-1">
          <AlertTriangle size={13} /> Read this first
        </span>
        This covers the common estate — spouse, children, parents — including ʿawl and radd. It does
        <b> not</b> handle siblings, grandparents, grandchildren or uncles, and it cannot see debts,
        bequests or gifts made in life. Settle debts and the wasiyya (max one third) before dividing.
        Use this to understand the shape of your estate, then confirm with a qualified scholar.
      </div>

      {/* Estate */}
      <div className="card p-4">
        <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>
          Estate to divide (after debts &amp; wasiyya)
        </label>
        <div className="grid grid-cols-3 gap-2">
          <select value={currency} onChange={e => setCurrency(e.target.value)}
            className="px-3 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
            <option value="AED">AED</option>
            <option value="PKR">PKR</option>
          </select>
          <input type="number" inputMode="decimal" placeholder="Total amount" value={estate}
            onChange={e => setEstate(e.target.value)}
            className="col-span-2 px-4 py-3 rounded-xl text-sm"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
        </div>
        <p className="text-[11px] mt-2" style={{ color: 'var(--text-muted)' }}>
          Optional — leave blank to see the fractions alone.
        </p>
      </div>

      {/* Heirs */}
      <div className="card p-4">
        <h3 className="text-sm font-semibold mb-3">Who survives?</h3>
        <div className="grid grid-cols-2 gap-2 mb-1">
          <Toggle label="Husband" k="husband" />
          <Toggle label="Father" k="father" />
          <Toggle label="Mother" k="mother" />
        </div>
        <div className="mt-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
          {!heirs.husband && <Counter label="Wives" k="wives" />}
          <Counter label="Sons" k="sons" />
          <Counter label="Daughters" k="daughters" />
        </div>
        {heirs.husband && heirs.wives > 0 && (
          <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
            A husband and wives can’t both survive the same person — wives are hidden.
          </p>
        )}
        {anyHeir && (
          <button onClick={() => { setHeirs(EMPTY); setEstate('') }}
            className="w-full mt-3 py-2 rounded-lg text-xs font-semibold"
            style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
            Reset
          </button>
        )}
      </div>

      {/* Result */}
      {!anyHeir ? (
        <div className="card p-6 text-center">
          <Scale size={26} style={{ color: 'var(--text-muted)' }} className="mx-auto mb-2" />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Add the surviving heirs above to see the shares.
          </p>
        </div>
      ) : (
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Scale size={16} style={{ color: 'var(--gold)' }} />
            <h3 className="text-sm font-semibold">The shares</h3>
            {result.awl && (
              <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B' }}>ʿAwl</span>
            )}
            {result.radd && (
              <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--gold-dim)', color: 'var(--gold)' }}>Radd</span>
            )}
          </div>

          <div className="flex flex-col">
            {result.shares.map(s => {
              const pct = toNumber(s.share) * 100
              return (
                <div key={s.key} className="py-2.5 border-t first:border-0" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{s.label}</span>
                    <span className="text-right">
                      <span className="font-display text-base font-semibold block" style={{ color: 'var(--gold)' }}>
                        {fracLabel(s.share)}
                      </span>
                      {hasEstate && (
                        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                          {formatCurrency((toNumber(s.share) * amount), currency, true)}
                        </span>
                      )}
                    </span>
                  </div>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {s.reason} · {pct.toFixed(1)}%
                    {s.count > 1 && hasEstate &&
                      ` · ${formatCurrency((toNumber(s.share) * amount) / s.count, currency, true)} each`}
                    {s.count > 1 && !hasEstate && ` · split ${s.count} ways`}
                  </p>
                </div>
              )
            })}

            {toNumber(result.unassigned) > 0 && (
              <div className="py-2.5 border-t" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>No heir in scope</span>
                  <span className="font-display text-base font-semibold" style={{ color: 'var(--text-muted)' }}>
                    {fracLabel(result.unassigned)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {result.notes.length > 0 && (
            <div className="mt-3 pt-3 flex flex-col gap-2" style={{ borderTop: '1px solid var(--border)' }}>
              {result.notes.map((n, i) => (
                <p key={i} className="text-[11px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>{n}</p>
              ))}
            </div>
          )}
        </div>
      )}

      <p className="text-[11px] text-center px-4 pb-2" style={{ color: 'var(--text-muted)' }}>
        “Allah instructs you concerning your children…” — An-Nisa 4:11. A calculator is not a fatwa.
      </p>
    </div>
  )
}
