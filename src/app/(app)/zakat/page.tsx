'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, shortDate } from '@/lib/utils'
import ModuleHeader from '@/components/shared/ModuleHeader'
import LoadingSpinner from '@/components/shared/LoadingSpinner'
import LoadError from '@/components/shared/LoadError'
import { Scale, CheckCircle2, XCircle, Info, Trash2, Moon } from 'lucide-react'
import { toHijri } from '@/lib/hijri'
import MetalHoldings from '@/components/zakat/MetalHoldings'
import type { ZakatSnapshot } from '@/types/database.types'

const NISAB_GOLD_GRAMS = 87.48
const NISAB_SILVER_GRAMS = 612.36
const ZAKAT_RATE = 0.025
const HAWL_DAYS = 354

interface Rates { gold: number; silver: number; pkr: number; usd: number }

export default function ZakatPage() {
  const [loading, setLoading] = useState(true)
  const [snapshots, setSnapshots] = useState<ZakatSnapshot[]>([])
  const [rates, setRates] = useState<Rates>({ gold: 472, silver: 5.9, pkr: 0.013, usd: 3.6725 })
  const [hawlStart, setHawlStart] = useState<string | null>(null)
  const [nisabBasis, setNisabBasis] = useState<'silver' | 'gold'>('silver')
  const [assets, setAssets] = useState({
    cash_aed: '', cash_pkr: '', cash_usd: '',
    gold_grams: '', silver_grams: '', investments_aed: '',
    crypto_aed: '', business_assets_aed: '', receivables_aed: '', liabilities_aed: '',
  })
  const [result, setResult] = useState<{ nisab: number; nisabSilver: number; nisabGold: number; net: number; due: number; wajib: boolean; hawlDays: number; dueDate: string | null } | null>(null)
  const [saving, setSaving] = useState(false)
  const [zakatError, setZakatError] = useState<string | null>(null)
  const [ratesUpdatedAt, setRatesUpdatedAt] = useState<string | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [ratesFailed, setRatesFailed] = useState(false)
  // Zakat al-Fitr (#46) — household size and the per-head rate are local
  // preferences: the rate is set by local scholars each year and varies by
  // region, so the app must never hardcode or silently age one.
  const [fitrHeads, setFitrHeads] = useState(1)
  const [fitrRate, setFitrRate] = useState('')
  const supabase = createClient()

  useEffect(() => {
    const h = localStorage.getItem('mizan_fitr_heads')
    const r = localStorage.getItem('mizan_fitr_rate')
    if (h) setFitrHeads(Math.max(1, parseInt(h) || 1))
    if (r) setFitrRate(r)
  }, [])
  function saveFitr(heads: number, rate: string) {
    setFitrHeads(heads); setFitrRate(rate)
    try {
      localStorage.setItem('mizan_fitr_heads', String(heads))
      localStorage.setItem('mizan_fitr_rate', rate)
    } catch {}
  }
  const hijriNow = toHijri(new Date())
  const isRamadan = hijriNow.m === 9
  const fitrTotal = (parseFloat(fitrRate) || 0) * fitrHeads

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    const [{ data: snaps, error: snapsErr }, { data: profile }, { data: rCache, error: ratesErr }] = await Promise.all([
      supabase.from('zakat_snapshots').select('*').eq('owner_id', user!.id).order('created_at', { ascending: false }),
      supabase.from('profiles').select('hawl_start_date, nisab_basis').eq('id', user!.id).single(),
      supabase.from('rates_cache').select('*'),
    ])
    if (snapsErr) { setLoadError(true); setLoading(false); return }
    setLoadError(false)
    // A failed/empty rates read must be VISIBLE — otherwise the nisab silently
    // computes on the hardcoded defaults with no stale banner (FIX-25: the
    // banner keys off ratesUpdatedAt, which stays null on a failed read).
    setRatesFailed(!!ratesErr || !rCache || rCache.length === 0)
    setSnapshots(snaps ?? [])
    setHawlStart(profile?.hawl_start_date ?? null)
    setNisabBasis(((profile as any)?.nisab_basis ?? 'silver') as 'silver' | 'gold')
    if (rCache) {
      const m: Record<string, number> = {}
      rCache.forEach((r: any) => { m[r.rate_type] = r.rate_value })
      setRates({ gold: m.gold_aed_gram ?? 472, silver: m.silver_aed_gram ?? 5.9, pkr: m.pkr_to_aed ?? 0.013, usd: m.usd_to_aed ?? 3.6725 })
      const newest = rCache.reduce((max: string | null, r: any) => (!max || r.updated_at > max) ? r.updated_at : max, null as string | null)
      setRatesUpdatedAt(newest)
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
    // Refresh the rates cache in the background (server keeps a 1h TTL), then re-read
    fetch('/api/rates').then(r => { if (r.ok) load() }).catch(() => {})
  }, [])

  function calculate() {
    const n = (s: string) => parseFloat(s || '0') || 0
    const totalAed =
      n(assets.cash_aed)
      + n(assets.cash_pkr) * rates.pkr
      + n(assets.cash_usd) * rates.usd
      + n(assets.gold_grams) * rates.gold
      + n(assets.silver_grams) * rates.silver
      + n(assets.investments_aed)
      + n(assets.crypto_aed)
      + n(assets.business_assets_aed)
      + n(assets.receivables_aed)
    const net = Math.max(0, totalAed - n(assets.liabilities_aed))
    const nisabSilver = NISAB_SILVER_GRAMS * rates.silver
    const nisabGold = NISAB_GOLD_GRAMS * rates.gold
    const nisab = nisabBasis === 'gold' ? nisabGold : nisabSilver
    const hawlDays = hawlStart ? Math.floor((Date.now() - new Date(hawlStart).getTime()) / 86400000) : 0
    const wajib = net >= nisab && hawlDays >= HAWL_DAYS
    let dueDate: string | null = null
    if (hawlStart) {
      const d = new Date(hawlStart); d.setDate(d.getDate() + HAWL_DAYS)
      dueDate = d.toISOString().split('T')[0]
    }
    setResult({ nisab, nisabSilver, nisabGold, net, due: net >= nisab ? net * ZAKAT_RATE : 0, wajib, hawlDays, dueDate })
  }

  async function saveSnapshot() {
    if (!result) return
    setSaving(true); setZakatError(null)
    const { data: { user } } = await supabase.auth.getUser()
    const n = (s: string) => parseFloat(s || '0') || 0
    // formatToParts guarantees a pure-digit year — the old toLocaleDateString
    // string could carry an " AH" suffix depending on runtime, which would
    // corrupt the UNIQUE (owner_id, snapshot_year) key space.
    const year = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { year: 'numeric' })
      .formatToParts(new Date()).find(p => p.type === 'year')?.value ?? '1447'
    const { error } = await supabase.from('zakat_snapshots').upsert({
      owner_id: user!.id, snapshot_year: year,
      snapshot_date: new Date().toISOString().split('T')[0],
      cash_aed: n(assets.cash_aed), cash_pkr: n(assets.cash_pkr), cash_usd: n(assets.cash_usd),
      gold_grams: n(assets.gold_grams), silver_grams: n(assets.silver_grams),
      investments_aed: n(assets.investments_aed), crypto_aed: n(assets.crypto_aed),
      business_assets_aed: n(assets.business_assets_aed), receivables_aed: n(assets.receivables_aed),
      liabilities_aed: n(assets.liabilities_aed),
      gold_price_aed_per_gram: rates.gold, silver_price_aed_per_gram: rates.silver,
      pkr_to_aed_rate: rates.pkr, usd_to_aed_rate: rates.usd,
      nisab_threshold_aed: result.nisab, net_zakatable_wealth_aed: result.net,
      zakat_due_aed: result.due, is_wajib: result.wajib, hawl_days_completed: result.hawlDays,
      nisab_basis: nisabBasis, due_date: result.dueDate,
    }, { onConflict: 'owner_id,snapshot_year' })
    setSaving(false)
    if (error) { setZakatError('Could not save snapshot: ' + error.message); return }
    load()
  }

  async function markPaid(id: string) {
    const { error } = await supabase.from('zakat_snapshots').update({
      zakat_paid: true, zakat_paid_date: new Date().toISOString().split('T')[0],
    }).eq('id', id)
    if (error) { setZakatError('Could not mark as paid: ' + error.message); return }
    setZakatError(null)
    load()
  }

  const F = (f: string, v: string) => setAssets(p => ({ ...p, [f]: v }))

  const fields = [
    { key: 'cash_aed', label: 'Cash & Bank (AED)' },
    { key: 'cash_pkr', label: 'Cash & Bank (PKR)' },
    { key: 'cash_usd', label: 'Cash & Bank (USD)' },
    { key: 'gold_grams', label: 'Gold (grams)' },
    { key: 'silver_grams', label: 'Silver (grams)' },
    { key: 'investments_aed', label: 'Investments AED' },
    { key: 'crypto_aed', label: 'Crypto (AED value)' },
    { key: 'business_assets_aed', label: 'Business Assets AED' },
    { key: 'receivables_aed', label: 'Money owed to you AED' },
    { key: 'liabilities_aed', label: '— Liabilities / Debts AED' },
  ]

  if (loading) return <LoadingSpinner />
  if (loadError) return (
    <div className="flex flex-col gap-4 animate-slide-up">
      <ModuleHeader title="Zakat" />
      <LoadError onRetry={load} />
    </div>
  )

  return (
    <div className="flex flex-col gap-4 p-4 animate-slide-up">
      <ModuleHeader title="Zakat" subtitle="Hanafi · 2.5% on net wealth" />

      {/* Rates read failed — the calculator is silently on built-in defaults */}
      {ratesFailed && (
        <div className="rounded-xl px-4 py-2.5 text-xs" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', color: '#F59E0B' }}>
          ⚠ Couldn't load live rates — using built-in defaults. Reload before trusting the nisab.
        </div>
      )}

      {/* Stale-rate banner — a borderline nisab call on old rates is a fiqh risk */}
      {ratesUpdatedAt && (Date.now() - new Date(ratesUpdatedAt).getTime() > 7 * 24 * 60 * 60 * 1000) && (
        <div className="rounded-xl px-4 py-2.5 text-xs" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', color: '#F59E0B' }}>
          ⚠ Rates last updated {Math.floor((Date.now() - new Date(ratesUpdatedAt).getTime()) / 86400000)} days ago — nisab may be off. Refresh via Settings → Currencies.
        </div>
      )}

      {zakatError && (
        <div className="rounded-xl px-4 py-2.5 text-xs" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#EF4444' }}>
          ⚠ {zakatError}
        </div>
      )}

      {/* Live rates info */}
      <div className="card p-3 flex gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
        <span>Gold: AED {rates.gold}/g</span>
        <span>Silver: AED {rates.silver}/g</span>
        <span>PKR→AED: {rates.pkr.toFixed(4)}</span>
      </div>

      {/* Nisab info — silver is the active threshold, gold shown alongside */}
      <div className="card-inner p-3 flex items-start gap-2">
        <Info size={14} style={{ color: 'var(--gold)' }} className="mt-0.5 shrink-0" />
        <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          <p>
            Nisab ({nisabBasis === 'silver' ? 'Silver' : 'Gold'}, active):{' '}
            <strong style={{ color: 'var(--gold)' }}>
              AED {((nisabBasis === 'silver' ? NISAB_SILVER_GRAMS * rates.silver : NISAB_GOLD_GRAMS * rates.gold)).toFixed(0)}
            </strong>
          </p>
          <p className="mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {nisabBasis === 'silver'
              ? `Gold nisab for reference: AED ${(NISAB_GOLD_GRAMS * rates.gold).toFixed(0)}`
              : `Silver nisab for reference: AED ${(NISAB_SILVER_GRAMS * rates.silver).toFixed(0)}`}
            {' · '}<span style={{ color: 'var(--text-muted)' }}>change basis in Settings</span>
          </p>
          {hawlStart && <p className="mt-0.5">Hawl: {Math.floor((Date.now() - new Date(hawlStart).getTime()) / 86400000)}/{HAWL_DAYS} days</p>}
        </div>
      </div>

      {/* Zakat al-Fitr — only during Ramadan, when it's actually due (#46) */}
      {isRamadan && (
        <div className="card p-4" style={{ border: '1px solid var(--gold)' }}>
          <div className="flex items-center gap-2 mb-1">
            <Moon size={15} style={{ color: 'var(--gold)' }} />
            <h3 className="text-sm font-semibold" style={{ color: 'var(--gold)' }}>Zakat al-Fitr</h3>
            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--gold-dim)', color: 'var(--gold)' }}>
              Ramadan {hijriNow.y}
            </span>
          </div>
          <p className="text-[11px] mb-3" style={{ color: 'var(--text-muted)' }}>
            One portion per person in the household, including children — due before the Eid prayer.
          </p>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>People</label>
              <div className="flex items-center gap-2">
                <button onClick={() => saveFitr(Math.max(1, fitrHeads - 1), fitrRate)} aria-label="One fewer person"
                  className="p-2 rounded-lg" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>−</button>
                <span className="flex-1 text-center text-sm font-semibold">{fitrHeads}</span>
                <button onClick={() => saveFitr(Math.min(30, fitrHeads + 1), fitrRate)} aria-label="One more person"
                  className="p-2 rounded-lg" style={{ background: 'var(--gold-dim)', color: 'var(--gold)' }}>+</button>
              </div>
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Rate per person</label>
              <input type="number" inputMode="decimal" placeholder="e.g. 25" value={fitrRate}
                onChange={e => saveFitr(fitrHeads, e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
            </div>
          </div>
          {fitrTotal > 0 && (
            <div className="px-3 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-between"
              style={{ background: 'var(--gold-dim)', color: 'var(--gold)' }}>
              <span>{fitrHeads} × {fitrRate}</span>
              <span>{formatCurrency(fitrTotal, 'AED', true)}</span>
            </div>
          )}
          <p className="text-[11px] mt-2" style={{ color: 'var(--text-muted)' }}>
            The rate is set locally each year (roughly 2.5kg of a staple food) — enter what your
            masjid announces. Nothing here is saved to the cloud or counted in the zakat above.
          </p>
        </div>
      )}

      {/* Gold & silver held (#94) — flows into the grams fields below */}
      <MetalHoldings goldRate={rates.gold} silverRate={rates.silver}
        onApply={(g, s) => setAssets(p => ({
          ...p,
          gold_grams: g > 0 ? String(g) : p.gold_grams,
          silver_grams: s > 0 ? String(s) : p.silver_grams,
        }))} />

      {/* Asset inputs */}
      <div className="card p-4">
        <h3 className="text-sm font-semibold mb-3">Your Assets & Liabilities</h3>
        <div className="flex flex-col gap-2">
          {fields.map(({ key, label }) => (
            <div key={key} className="grid grid-cols-2 gap-2 items-center">
              <label className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</label>
              <input type="number" inputMode="decimal" placeholder="0" value={(assets as any)[key]}
                onChange={e => F(key, e.target.value)}
                className="px-3 py-2 rounded-lg text-sm text-right"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
            </div>
          ))}
        </div>
        <button onClick={calculate}
          className="mt-4 w-full py-3 rounded-xl font-semibold text-sm"
          style={{ background: 'var(--gold)', color: '#0a0a0a' }}>
          Calculate Zakat
        </button>
      </div>

      {/* Result */}
      {result && (
        <div className={`card p-5 ${result.wajib ? 'border-red-500/30' : 'border-emerald-500/30'}`}>
          <div className="flex items-center gap-3 mb-4">
            {result.wajib
              ? <XCircle size={28} className="text-red-400" />
              : <CheckCircle2 size={28} className="text-emerald-400" />}
            <div>
              <p className={`text-xl font-bold ${result.wajib ? 'text-red-400' : 'text-emerald-400'}`}>
                Zakat is {result.wajib ? 'WAJIB' : 'NOT DUE'}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {result.wajib ? 'You must pay Zakat this year' : 'Below nisab or hawl incomplete'}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <span style={{ color: 'var(--text-muted)' }}>Nisab threshold</span>
              <span className="font-medium">{formatCurrency(result.nisab, 'AED')}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--text-muted)' }}>Net zakatable wealth</span>
              <span className="font-medium">{formatCurrency(result.net, 'AED')}</span>
            </div>
            {result.wajib && (
              <div className="flex justify-between pt-2 mt-1" style={{ borderTop: '1px solid var(--border)' }}>
                <span className="font-semibold">Zakat due (2.5%)</span>
                <span className="text-lg font-bold text-red-400">{formatCurrency(result.due, 'AED')}</span>
              </div>
            )}
            {result.dueDate && (
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-muted)' }}>Pay by (hawl completes)</span>
                <span className="font-medium" style={{ color: result.wajib ? '#EF4444' : 'var(--text-secondary)' }}>{shortDate(result.dueDate)}</span>
              </div>
            )}
            {!hawlStart && (
              <p className="text-xs text-amber-400 mt-1">
                Set your hawl start date in Settings to get an exact pay-by date.
              </p>
            )}
            {hawlStart && result.hawlDays < HAWL_DAYS && (
              <p className="text-xs text-amber-400 mt-1">
                Hawl: {result.hawlDays}/{HAWL_DAYS} days — {HAWL_DAYS - result.hawlDays} days remaining
              </p>
            )}
          </div>

          <button onClick={saveSnapshot} disabled={saving}
            className="mt-4 w-full py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
            {saving ? 'Saving…' : "Save This Year's Snapshot"}
          </button>
        </div>
      )}

      {/* History */}
      {snapshots.length > 0 && (
        <div className="card p-4">
          <h3 className="text-sm font-semibold mb-3">Previous Years</h3>
          <div className="flex flex-col gap-2">
            {snapshots.map(s => (
              <div key={s.id} className="py-2" style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button aria-label="Delete snapshot"
                      onClick={async () => {
                        if (!confirm(`Delete the year ${s.snapshot_year} snapshot? You can recalculate and save it again any time.`)) return
                        const { error } = await supabase.from('zakat_snapshots').delete().eq('id', s.id)
                        if (error) { alert(`Could not delete: ${error.message}`); return }
                        load()
                      }}
                      className="p-1.5 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
                      <Trash2 size={12} />
                    </button>
                    <div>
                    <p className="text-sm font-medium">Islamic Year {s.snapshot_year}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      Snapshot {shortDate(s.snapshot_date)}
                      {(s as any).due_date && ` · pay by ${shortDate((s as any).due_date)}`}
                    </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${s.is_wajib ? 'text-red-400' : 'text-emerald-400'}`}>
                      {s.is_wajib ? formatCurrency(s.zakat_due_aed ?? 0, 'AED', true) : 'Not due'}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {(s as any).zakat_paid ? `Paid ${(s as any).zakat_paid_date ? shortDate((s as any).zakat_paid_date) : ''}` : s.is_wajib ? 'Unpaid' : 'Below nisab'}
                    </p>
                  </div>
                </div>
                {s.is_wajib && !(s as any).zakat_paid && (
                  <button onClick={() => markPaid(s.id)}
                    className="mt-2 w-full py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5"
                    style={{ background: 'var(--gold-dim)', color: 'var(--gold)' }}>
                    <CheckCircle2 size={12} /> Mark as Paid
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
