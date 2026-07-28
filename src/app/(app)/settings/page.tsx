'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import ModuleHeader from '@/components/shared/ModuleHeader'
import LoadingSpinner from '@/components/shared/LoadingSpinner'
import { User, Percent, LogOut, RefreshCw, Scale, Loader2, Coins, LayoutGrid, Download, Database, FlaskConical, Trash2, ChevronDown } from 'lucide-react'
import CalendarExport from '@/components/shared/CalendarExport'
import type { Profile, Currency } from '@/types/database.types'

const MODULES: { key: string; label: string }[] = [
  { key: 'income', label: 'Income & Projects' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'sadaka', label: 'Sadaka' },
  { key: 'ledger', label: 'Brother Ledger' },
  { key: 'goals', label: 'Goals' },
  { key: 'loans', label: 'Loans' },
  { key: 'savings', label: 'Savings' },
  { key: 'wasiyya', label: 'Wasiyya' },
  { key: 'zakat', label: 'Zakat' },
  { key: 'joint_account', label: 'Joint Bank Account' },
  { key: 'life', label: 'Life Tracker' },
]
const DEFAULT_MODULES = Object.fromEntries(MODULES.map(m => [m.key, true]))

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState<null | 'export' | 'excel' | 'reset'>(null)
  const [testMode, setTestMode] = useState(false)
  const [devMode, setDevMode] = useState(false)
  const [open, setOpen] = useState<Set<string>>(new Set(['Profile']))
  const [lastBackup, setLastBackup] = useState<string | null>(null)
  const toggle = (t: string) => setOpen(s => { const n = new Set(s); n.has(t) ? n.delete(t) : n.add(t); return n })

  useEffect(() => {
    setTestMode(localStorage.getItem('mizan_test_mode') === '1')
    setDevMode(localStorage.getItem('mizan_dev_mode') === '1')
    setLastBackup(localStorage.getItem('mizan_last_backup'))
  }, [])

  // Backup age (#65). Per-device by design: the file lands on THIS device, so
  // "when did I last save one" is a device-local fact, not account state.
  // Only ever stamped after a download actually succeeded.
  function markBackupDone() {
    const now = new Date().toISOString()
    try { localStorage.setItem('mizan_last_backup', now) } catch {}
    setLastBackup(now)
  }
  const backupAgeDays = lastBackup
    ? Math.floor((Date.now() - new Date(lastBackup).getTime()) / 86400000)
    : null
  function toggleTestMode(v: boolean) {
    setTestMode(v)
    localStorage.setItem('mizan_test_mode', v ? '1' : '0')
  }
  function toggleDevMode(v: boolean) {
    if (v && !confirm('Developer Mode lets you EDIT and DELETE entries that are normally locked (received income, given sadaka).\n\nThis can corrupt your real records and break sadaka/zakat calculations. Only use it to fix mistakes. Continue?')) return
    setDevMode(v)
    localStorage.setItem('mizan_dev_mode', v ? '1' : '0')
  }
  const [form, setForm] = useState({
    display_name: '', sadaka_pct: 20, hawl_start_date: '',
    default_currency: 'AED', nisab_basis: 'silver',
    enabled_modules: DEFAULT_MODULES as Record<string, boolean>,
  })
  const supabase = createClient()
  const router = useRouter()

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase.from('profiles').select('*').eq('id', user!.id).single()
    if (data) {
      setProfile(data)
      setForm({
        display_name: data.display_name ?? '',
        sadaka_pct: data.sadaka_pct ? Math.round(data.sadaka_pct * 100) : 20,
        hawl_start_date: data.hawl_start_date ?? '',
        default_currency: (data as any).default_currency ?? 'AED',
        nisab_basis: (data as any).nisab_basis ?? 'silver',
        enabled_modules: { ...DEFAULT_MODULES, ...((data as any).enabled_modules ?? {}) },
      })
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const F = (f: string, v: any) => setForm(p => ({ ...p, [f]: v }))

  async function save() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('profiles').update({
      display_name: form.display_name || null,
      sadaka_pct: form.sadaka_pct / 100,
      hawl_start_date: form.hawl_start_date || null,
      default_currency: form.default_currency as Currency,
      nisab_basis: form.nisab_basis as 'gold' | 'silver',
      enabled_modules: form.enabled_modules,
    }).eq('id', user!.id)
    setSaving(false)
    if (error) { alert('Could not save: ' + error.message); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const [rateResult, setRateResult] = useState<string | null>(null)
  async function refreshRates() {
    setRefreshing(true)
    setRateResult(null)
    try {
      const res = await fetch('/api/rates')
      const json = await res.json()
      if (!json.success) setRateResult(json.error ?? 'Refresh failed')
      else if (json.writeErrors?.length) setRateResult(`Saved with issues: ${json.writeErrors.join('; ')}`)
      else if (json.stale) setRateResult('Rate sources unavailable — showing last known values.')
      else setRateResult('Rates refreshed ✓')
    } catch {
      setRateResult('Refresh failed — network error')
    }
    setRefreshing(false)
  }

  const [pkrOverride, setPkrOverride] = useState('')
  // Bottom-nav tab picker — per-device (localStorage), tap order = display order
  const NAV_CHOICES: { key: string; label: string }[] = [
    { key: 'income', label: 'Income' }, { key: 'expenses', label: 'Expenses' },
    { key: 'sadaka', label: 'Sadaka' }, { key: 'ledger', label: 'Ledger' },
    { key: 'joint_account', label: 'Joint' }, { key: 'goals', label: 'Goals' },
  ]
  const [navTabs, setNavTabs] = useState<string[]>([])
  useEffect(() => {
    try { setNavTabs(JSON.parse(localStorage.getItem('mizan_nav_tabs') ?? 'null') ?? ['income', 'expenses', 'sadaka']) } catch {}
  }, [])
  function toggleNavTab(key: string) {
    setNavTabs(prev => {
      const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key].slice(-3)
      try { localStorage.setItem('mizan_nav_tabs', JSON.stringify(next)) } catch {}
      return next
    })
  }
  const [savingPkr, setSavingPkr] = useState(false)
  const [pkrResult, setPkrResult] = useState<string | null>(null)
  async function saveManualPkr() {
    const value = parseFloat(pkrOverride)
    if (!value || value <= 0) { setPkrResult('Enter a valid PKR→AED rate'); return }
    setSavingPkr(true)
    setPkrResult(null)
    try {
      const res = await fetch('/api/rates/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pkr_to_aed: value }),
      })
      const json = await res.json()
      setPkrResult(json.success ? 'Saved ✓' : (json.error ?? 'Save failed'))
      if (json.success) setPkrOverride('')
    } catch {
      setPkrResult('Save failed — network error')
    }
    setSavingPkr(false)
  }

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // Tables to include in backup / reset
  const DATA_TABLES = [
    'income_projects', 'sadaka_entries', 'sadaka_recipients', 'brother_ledger',
    'ledger_settlements', 'external_ledger', 'loans', 'loan_repayments',
    'shared_costs', 'zakat_snapshots', 'financial_goals', 'goal_contributions',
    'wasiyya_entries', 'joint_accounts', 'joint_account_txns', 'savings_entries', 'expenses', 'life_events',
  ]

  // Fetch every row of a table, paged past PostgREST's max-rows cap (default
  // 1000) so a big table can never silently truncate a backup. Throws on any
  // error so a failed read can't masquerade as an empty table.
  async function fetchAllRows(table: string) {
    const PAGE = 1000
    const rows: any[] = []
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase.from(table).select('*')
        .order('id', { ascending: true }).range(from, from + PAGE - 1)
      if (error) throw new Error(`${table}: ${error.message}`)
      rows.push(...(data ?? []))
      if ((data ?? []).length < PAGE) break
    }
    return rows
  }

  async function exportData() {
    setBusy('export')
    try {
      const backup: Record<string, any> = { exported_at: new Date().toISOString(), tables: {} }
      for (const t of DATA_TABLES) {
        backup.tables[t] = await fetchAllRows(t)
      }
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `mizan-backup-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
      markBackupDone()
    } catch (e: any) {
      alert(`Backup failed — file NOT saved.\n${e.message}\nTry again in a moment.`)
    }
    setBusy(null)
  }

  function esc(v: any) {
    const s = v === null || v === undefined ? '' : String(v)
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }

  async function exportExcel() {
    setBusy('excel')
    try {
      let html = '<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body>'
      for (const t of DATA_TABLES) {
        const rows = await fetchAllRows(t)
        html += `<h3>${t}</h3>`
        if (rows.length === 0) { html += '<p>(no data)</p>'; continue }
        const cols = Object.keys(rows[0])
        html += '<table border="1"><tr>' + cols.map(c => `<th>${esc(c)}</th>`).join('') + '</tr>'
        rows.forEach(r => { html += '<tr>' + cols.map(c => `<td>${esc(r[c])}</td>`).join('') + '</tr>' })
        html += '</table><br/>'
      }
      html += '</body></html>'
      const blob = new Blob([html], { type: 'application/vnd.ms-excel' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `mizan-backup-${new Date().toISOString().split('T')[0]}.xls`
      a.click()
      URL.revokeObjectURL(url)
      markBackupDone()
    } catch (e: any) {
      alert(`Backup failed — file NOT saved.\n${e.message}\nTry again in a moment.`)
    }
    setBusy(null)
  }

  async function resetData() {
    const ok = prompt('This permanently deletes ALL financial data (income, sadaka, ledger, joint account, zakat, goals, loans, splits, wasiyya, recipients, life events). Your account & settings stay.\n\n⚠ Shared records (ledger, joint account, splits, shared sadaka) are deleted for BOTH of you — make sure your brother is okay with this and export a backup first.\n\nType DELETE to confirm.')
    if (ok !== 'DELETE') return
    setBusy('reset')
    const failed: string[] = []
    for (const t of DATA_TABLES) {
      // delete every row the current policies allow this user to remove
      const { error } = await supabase.from(t).delete().not('id', 'is', null)
      if (error) failed.push(`${t}: ${error.message}`)
    }
    setBusy(null)
    if (failed.length) {
      alert('Reset finished WITH ERRORS — these tables may still hold data:\n' + failed.join('\n'))
    } else {
      alert('All test data cleared. You can now start with real data.')
    }
  }

  if (loading) return <LoadingSpinner />

  const sections = [
    {
      title: 'Profile',
      icon: User,
      content: (
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Display name</label>
            <input value={form.display_name} onChange={e => F('display_name', e.target.value)} placeholder="Your name"
              className="w-full px-4 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
          </div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Email: <span style={{ color: 'var(--text-secondary)' }}>{profile?.email}</span>
          </p>
        </div>
      )
    },
    {
      title: 'Currency',
      icon: Coins,
      content: (
        <div>
          <label className="text-xs mb-2 block" style={{ color: 'var(--text-muted)' }}>Default display currency</label>
          <div className="grid grid-cols-2 gap-2">
            {['AED', 'PKR'].map(c => (
              <button key={c} type="button" onClick={() => F('default_currency', c)}
                className="py-2.5 rounded-xl text-sm font-medium"
                style={{
                  background: form.default_currency === c ? 'var(--gold-dim)' : 'var(--surface-2)',
                  border: `1px solid ${form.default_currency === c ? 'var(--gold)' : 'var(--border)'}`,
                  color: form.default_currency === c ? 'var(--gold)' : 'var(--text-muted)',
                }}>{c}</button>
            ))}
          </div>
          <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
            Spending & sadaka always show both AED and PKR. Earning stays in AED.
          </p>
        </div>
      )
    },
    {
      title: 'Zakat Nisab',
      icon: Scale,
      content: (
        <div>
          <label className="text-xs mb-2 block" style={{ color: 'var(--text-muted)' }}>Threshold basis</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { val: 'silver', label: 'Silver (612.36g)' },
              { val: 'gold', label: 'Gold (87.48g)' },
            ].map(o => (
              <button key={o.val} type="button" onClick={() => F('nisab_basis', o.val)}
                className="py-2.5 rounded-xl text-xs font-medium"
                style={{
                  background: form.nisab_basis === o.val ? 'var(--gold-dim)' : 'var(--surface-2)',
                  border: `1px solid ${form.nisab_basis === o.val ? 'var(--gold)' : 'var(--border)'}`,
                  color: form.nisab_basis === o.val ? 'var(--gold)' : 'var(--text-muted)',
                }}>{o.label}</button>
            ))}
          </div>
          <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
            Silver is the lower (more cautious) threshold. Both are shown in the Zakat module.
          </p>
        </div>
      )
    },
    {
      title: 'Modules',
      icon: LayoutGrid,
      content: (
        <div className="flex flex-col gap-2">
          <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Turn off what you don't use — it hides from nav & home.</p>
          {MODULES.map(({ key, label }) => (
            <label key={key} className="flex items-center justify-between p-3 rounded-xl cursor-pointer"
              style={{ background: 'var(--surface-2)' }}>
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{label}</span>
              <div className="relative">
                <input type="checkbox" className="sr-only peer"
                  checked={form.enabled_modules[key] !== false}
                  onChange={e => F('enabled_modules', { ...form.enabled_modules, [key]: e.target.checked })} />
                <div className="w-11 h-6 rounded-full peer-checked:after:translate-x-5 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"
                  style={{ background: form.enabled_modules[key] !== false ? 'var(--gold)' : 'var(--border)' }} />
              </div>
            </label>
          ))}
        </div>
      )
    },
    {
      title: 'Sadaka Default',
      icon: Percent,
      content: (
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Auto-sadaka rate</label>
            <span className="text-sm font-bold" style={{ color: 'var(--gold)' }}>{form.sadaka_pct}%</span>
          </div>
          <input type="range" min={1} max={50} step={1} value={form.sadaka_pct}
            onChange={e => F('sadaka_pct', parseInt(e.target.value))}
            className="w-full accent-[var(--gold)]" />
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            {form.sadaka_pct}% of every income entry will be suggested as sadaka
          </p>
        </div>
      )
    },
    {
      title: 'Zakat Hawl',
      icon: Scale,
      content: (
        <div>
          <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Hawl start date (when you first reached nisab)</label>
          <input type="date" value={form.hawl_start_date} onChange={e => F('hawl_start_date', e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            Zakat is due after 354 days (1 lunar year) above nisab
          </p>
        </div>
      )
    },
  ]

  return (
    <div className="flex flex-col gap-4 p-4 animate-slide-up">
      <ModuleHeader title="Settings" subtitle="Your preferences" />

      {sections.map(({ title, icon: Icon, content }) => (
        <div key={title} className="card p-4">
          <button className="flex items-center justify-between w-full" onClick={() => toggle(title)}>
            <div className="flex items-center gap-2">
              <Icon size={15} style={{ color: 'var(--gold)' }} />
              <h3 className="text-sm font-semibold">{title}</h3>
            </div>
            <ChevronDown size={15} style={{ color: 'var(--text-muted)', transform: open.has(title) ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>
          {open.has(title) && <div className="mt-3">{content}</div>}
        </div>
      ))}

      {/* Rates cache */}
      <div className="card p-4">
        <button className="flex items-center justify-between w-full" onClick={() => toggle('Exchange Rates')}>
          <div className="flex items-center gap-2">
            <RefreshCw size={15} style={{ color: 'var(--gold)' }} />
            <h3 className="text-sm font-semibold">Exchange Rates</h3>
          </div>
          <ChevronDown size={15} style={{ color: 'var(--text-muted)', transform: open.has('Exchange Rates') ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </button>
        {open.has('Exchange Rates') && (
          <div className="mt-3">
            <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
              Gold, silver, and FX rates are cached for up to 1 hour. Force refresh if you need latest prices.
            </p>
            <button onClick={refreshRates} disabled={refreshing}
              className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
              style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
              {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              {refreshing ? 'Refreshing…' : 'Refresh Rates Now'}
            </button>
            {rateResult && (
              <p className="text-xs mt-2" style={{ color: rateResult.includes('✓') ? 'var(--emerald)' : '#EF4444' }}>
                {rateResult}
              </p>
            )}
            <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>
                Manual PKR → AED override (if auto-refresh ever fails)
              </label>
              <div className="flex gap-2">
                <input value={pkrOverride} onChange={e => setPkrOverride(e.target.value)}
                  type="number" inputMode="decimal" step="0.0001" placeholder="e.g. 0.0132"
                  className="flex-1 px-3 py-2 rounded-xl text-sm"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
                <button onClick={saveManualPkr} disabled={savingPkr}
                  className="px-4 py-2 rounded-xl text-sm font-semibold"
                  style={{ background: 'var(--gold-dim)', color: 'var(--gold)', border: '1px solid var(--gold)' }}>
                  {savingPkr ? '…' : 'Save'}
                </button>
              </div>
              {pkrResult && (
                <p className="text-xs mt-2" style={{ color: pkrResult.includes('✓') ? 'var(--emerald)' : '#EF4444' }}>
                  {pkrResult}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom navigation picker — per-device */}
      <div className="card p-4">
        <button className="flex items-center justify-between w-full" onClick={() => toggle('Bottom Navigation')}>
          <div className="flex items-center gap-2">
            <LayoutGrid size={15} style={{ color: 'var(--gold)' }} />
            <h3 className="text-sm font-semibold">Bottom Navigation</h3>
          </div>
          <ChevronDown size={15} style={{ color: 'var(--text-muted)', transform: open.has('Bottom Navigation') ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </button>
        {open.has('Bottom Navigation') && (
          <div className="mt-3">
            <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
              Pick up to 3 tabs for the bottom bar (this phone only). Tap order = bar order. Everything else stays reachable from Home → All modules.
            </p>
            <div className="grid grid-cols-3 gap-2">
              {NAV_CHOICES.map(c => {
                const idx = navTabs.indexOf(c.key)
                const active = idx >= 0
                return (
                  <button key={c.key} onClick={() => toggleNavTab(c.key)}
                    className="py-2.5 px-2 rounded-xl text-xs font-medium"
                    style={{ background: active ? 'var(--gold-dim)' : 'var(--surface-2)',
                      border: `1px solid ${active ? 'var(--gold)' : 'var(--border)'}`,
                      color: active ? 'var(--gold)' : 'var(--text-muted)' }}>
                    {active ? `${idx + 1}. ` : ''}{c.label}
                  </button>
                )
              })}
            </div>
            <p className="text-[11px] mt-2" style={{ color: 'var(--text-muted)' }}>
              Change takes effect next page load.
            </p>
          </div>
        )}
      </div>

      {/* Test mode */}
      <div className="card p-4">
        <button className="flex items-center justify-between w-full" onClick={() => toggle('Test Mode')}>
          <div className="flex items-center gap-2">
            <FlaskConical size={15} style={{ color: 'var(--gold)' }} />
            <h3 className="text-sm font-semibold">Test Mode</h3>
          </div>
          <ChevronDown size={15} style={{ color: 'var(--text-muted)', transform: open.has('Test Mode') ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </button>
        {open.has('Test Mode') && (
          <div className="mt-3 flex flex-col gap-3">
            <label className="flex items-center justify-between p-3 rounded-xl cursor-pointer" style={{ background: 'var(--surface-2)' }}>
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Show a TEST banner while trying things out</span>
              <div className="relative">
                <input type="checkbox" className="sr-only peer" checked={testMode} onChange={e => toggleTestMode(e.target.checked)} />
                <div className="w-11 h-6 rounded-full peer-checked:after:translate-x-5 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"
                  style={{ background: testMode ? 'var(--gold)' : 'var(--border)' }} />
              </div>
            </label>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              When you're done testing, export a backup then reset the data below to start with real figures.
            </p>
            <label className="flex items-center justify-between p-3 rounded-xl cursor-pointer" style={{ background: 'var(--surface-2)' }}>
              <span className="text-sm" style={{ color: '#F59E0B' }}>Developer Mode — unlock edit/delete on locked entries</span>
              <div className="relative">
                <input type="checkbox" className="sr-only peer" checked={devMode} onChange={e => toggleDevMode(e.target.checked)} />
                <div className="w-11 h-6 rounded-full peer-checked:after:translate-x-5 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"
                  style={{ background: devMode ? '#F59E0B' : 'var(--border)' }} />
              </div>
            </label>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              ⚠ Lets you change received income & given sadaka. Can corrupt records — use only to fix mistakes, then turn off.
            </p>
          </div>
        )}
      </div>

      {/* Data & backup */}
      <div className="card p-4">
        <button className="flex items-center justify-between w-full" onClick={() => toggle('Data & Backup')}>
          <div className="flex items-center gap-2">
            <Database size={15} style={{ color: 'var(--gold)' }} />
            <h3 className="text-sm font-semibold">Data &amp; Backup</h3>
          </div>
          <ChevronDown size={15} style={{ color: 'var(--text-muted)', transform: open.has('Data & Backup') ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </button>
        {open.has('Data & Backup') && (
          <div className="mt-3 flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-2">
              <button onClick={exportData} disabled={busy !== null}
                className="py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
                style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
                {busy === 'export' ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                JSON
              </button>
              <button onClick={exportExcel} disabled={busy !== null}
                className="py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
                style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
                {busy === 'excel' ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                Excel
              </button>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Downloads every record to a file on your device. Keep it safe — that's your backup.
            </p>
            {/* Backup age — the nudge that makes "I'll do it later" visible (#65) */}
            <p className="text-xs" style={{ color: backupAgeDays !== null && backupAgeDays >= 90 ? '#F59E0B' : 'var(--text-muted)' }}>
              {backupAgeDays === null
                ? 'No backup taken on this device yet — export one now, this app runs unattended.'
                : backupAgeDays === 0
                  ? 'Last backup: today ✓'
                  : `Last backup: ${backupAgeDays} day${backupAgeDays === 1 ? '' : 's'} ago${backupAgeDays >= 90 ? ' — time for a fresh one.' : '.'}`}
            </p>
            {/* Finance dates → .ics (#59) */}
            <div className="pt-2 mt-1 flex flex-col gap-2" style={{ borderTop: '1px solid var(--border)' }}>
              <CalendarExport />
            </div>

            <button onClick={resetData} disabled={busy !== null}
              className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
              style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)', marginTop: '0.5rem' }}>
              {busy === 'reset' ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              {busy === 'reset' ? 'Clearing…' : 'Reset all financial data'}
            </button>
          </div>
        )}
      </div>

      {/* Save button */}
      <button onClick={save} disabled={saving}
        className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
        style={{ background: saved ? '#10B981' : 'var(--gold)', color: '#0a0a0a', transition: 'background 0.3s' }}>
        {saving && <Loader2 size={15} className="animate-spin" />}
        {saved ? 'Saved!' : saving ? 'Saving…' : 'Save Settings'}
      </button>

      {/* Logout */}
      <button onClick={logout}
        className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 mt-2"
        style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)' }}>
        <LogOut size={15} />
        Sign Out
      </button>

      <p className="text-center text-xs pb-4" style={{ color: 'var(--text-muted)' }}>
        Mizan v1.0 · Built for Ibrahim & Abu Bakar
      </p>
    </div>
  )
}
