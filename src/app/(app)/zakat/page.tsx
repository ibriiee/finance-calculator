'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, shortDate } from '@/lib/utils'
import ModuleHeader from '@/components/shared/ModuleHeader'
import LoadingSpinner from '@/components/shared/LoadingSpinner'
import { Scale, CheckCircle2, XCircle, Info } from 'lucide-react'
import type { ZakatSnapshot } from '@/types/database.types'

const NISAB_GOLD_GRAMS = 87.48
const ZAKAT_RATE = 0.025

interface Rates { gold: number; silver: number; pkr: number; usd: number }

export default function ZakatPage() {
  const [loading, setLoading] = useState(true)
  const [snapshots, setSnapshots] = useState<ZakatSnapshot[]>([])
  const [rates, setRates] = useState<Rates>({ gold: 330, silver: 3.8, pkr: 0.013, usd: 3.6725 })
  const [hawlStart, setHawlStart] = useState<string | null>(null)
  const [assets, setAssets] = useState({
    cash_aed: '', cash_pkr: '', cash_usd: '',
    gold_grams: '', silver_grams: '', investments_aed: '',
    crypto_aed: '', business_assets_aed: '', receivables_aed: '', liabilities_aed: '',
  })
  const [result, setResult] = useState<{ nisab: number; net: number; due: number; wajib: boolean; hawlDays: number } | null>(null)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    const [{ data: snaps }, { data: profile }, { data: rCache }] = await Promise.all([
      supabase.from('zakat_snapshots').select('*').eq('owner_id', user!.id).order('created_at', { ascending: false }),
      supabase.from('profiles').select('hawl_start_date').eq('id', user!.id).single(),
      supabase.from('rates_cache').select('*'),
    ])
    setSnapshots(snaps ?? [])
    setHawlStart(profile?.hawl_start_date ?? null)
    if (rCache) {
      const m: Record<string, number> = {}
      rCache.forEach((r: any) => { m[r.rate_type] = r.rate_value })
      setRates({ gold: m.gold_aed_gram ?? 330, silver: m.silver_aed_gram ?? 3.8, pkr: m.pkr_to_aed ?? 0.013, usd: m.usd_to_aed ?? 3.6725 })
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

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
    const nisab = NISAB_GOLD_GRAMS * rates.gold
    const hawlDays = hawlStart ? Math.floor((Date.now() - new Date(hawlStart).getTime()) / 86400000) : 0
    const wajib = net >= nisab && hawlDays >= 354
    setResult({ nisab, net, due: wajib ? net * ZAKAT_RATE : 0, wajib, hawlDays })
  }

  async function saveSnapshot() {
    if (!result) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const n = (s: string) => parseFloat(s || '0') || 0
    const year = new Date().toLocaleDateString('en-GB', { year: 'numeric', calendar: 'islamic' }).split('/').pop() ?? '1447'
    await supabase.from('zakat_snapshots').upsert({
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
    }, { onConflict: 'owner_id,snapshot_year' })
    setSaving(false); load()
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

  return (
    <div className="flex flex-col gap-4 p-4 animate-slide-up">
      <ModuleHeader title="Zakat" subtitle="Hanafi school · 2.5% on net wealth" />

      {/* Live rates info */}
      <div className="card p-3 flex gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
        <span>🟡 Gold: AED {rates.gold}/g</span>
        <span>⚪ Silver: AED {rates.silver}/g</span>
        <span>PKR: {rates.pkr.toFixed(4)}</span>
      </div>

      {/* Nisab info */}
      <div className="card-inner p-3 flex items-start gap-2">
        <Info size={14} style={{ color: 'var(--gold)' }} className="mt-0.5 shrink-0" />
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          Nisab threshold: {NISAB_GOLD_GRAMS}g gold = <strong style={{ color: 'var(--gold)' }}>AED {(NISAB_GOLD_GRAMS * rates.gold).toFixed(0)}</strong>
          {hawlStart && ` · Hawl: ${Math.floor((Date.now() - new Date(hawlStart).getTime()) / 86400000)} days`}
        </p>
      </div>

      {/* Asset inputs */}
      <div className="card p-4">
        <h3 className="text-sm font-semibold mb-3">Your Assets & Liabilities</h3>
        <div className="flex flex-col gap-2">
          {fields.map(({ key, label }) => (
            <div key={key} className="grid grid-cols-2 gap-2 items-center">
              <label className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</label>
              <input type="number" placeholder="0" value={(assets as any)[key]}
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
            {result.hawlDays < 354 && (
              <p className="text-xs text-amber-400 mt-1">
                ⚠ Hawl: {result.hawlDays}/354 days complete — {354 - result.hawlDays} days remaining
              </p>
            )}
          </div>

          <button onClick={saveSnapshot} disabled={saving}
            className="mt-4 w-full py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
            💾 Save This Year's Snapshot
          </button>
        </div>
      )}

      {/* History */}
      {snapshots.length > 0 && (
        <div className="card p-4">
          <h3 className="text-sm font-semibold mb-3">Previous Years</h3>
          <div className="flex flex-col gap-2">
            {snapshots.map(s => (
              <div key={s.id} className="flex items-center justify-between py-2"
                   style={{ borderBottom: '1px solid var(--border)' }}>
                <div>
                  <p className="text-sm font-medium">{shortDate(s.snapshot_date)}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Islamic Year {s.snapshot_year}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-bold ${s.is_wajib ? 'text-red-400' : 'text-emerald-400'}`}>
                    {s.is_wajib ? formatCurrency(s.zakat_due_aed ?? 0, 'AED', true) : 'Not due'}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {s.is_wajib ? 'Wajib' : 'Below nisab'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
