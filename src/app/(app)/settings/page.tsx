'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import ModuleHeader from '@/components/shared/ModuleHeader'
import LoadingSpinner from '@/components/shared/LoadingSpinner'
import { User, Bell, Percent, Calendar, LogOut, RefreshCw, Scale, Loader2 } from 'lucide-react'
import type { Profile } from '@/types/database.types'

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({
    display_name: '', sadaka_pct: 20, hawl_start_date: '',
    notify_income_received: true, notify_ledger_update: true, notify_sadaka_due: true,
    notify_zakat_due: true,
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
        notify_income_received: data.notify_income_received ?? true,
        notify_ledger_update: data.notify_ledger_update ?? true,
        notify_sadaka_due: data.notify_sadaka_due ?? true,
        notify_zakat_due: data.notify_zakat_due ?? true,
      })
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const F = (f: string, v: any) => setForm(p => ({ ...p, [f]: v }))

  async function save() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('profiles').update({
      display_name: form.display_name || null,
      sadaka_pct: form.sadaka_pct / 100,
      hawl_start_date: form.hawl_start_date || null,
      notify_income_received: form.notify_income_received,
      notify_ledger_update: form.notify_ledger_update,
      notify_sadaka_due: form.notify_sadaka_due,
      notify_zakat_due: form.notify_zakat_due,
    }).eq('id', user!.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function refreshRates() {
    setRefreshing(true)
    await fetch('/api/rates')
    setRefreshing(false)
  }

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
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
    {
      title: 'Notifications',
      icon: Bell,
      content: (
        <div className="flex flex-col gap-2">
          {[
            { key: 'notify_income_received', label: 'Income marked received' },
            { key: 'notify_ledger_update', label: 'Ledger balance updates' },
            { key: 'notify_sadaka_due', label: 'Sadaka payment reminders' },
            { key: 'notify_zakat_due', label: 'Zakat hawl completion' },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center justify-between p-3 rounded-xl cursor-pointer"
              style={{ background: 'var(--surface-2)' }}>
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{label}</span>
              <div className="relative">
                <input type="checkbox" className="sr-only peer" checked={(form as any)[key]} onChange={e => F(key, e.target.checked)} />
                <div className="w-11 h-6 rounded-full peer-checked:after:translate-x-5 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"
                  style={{ background: (form as any)[key] ? 'var(--gold)' : 'var(--border)' }} />
              </div>
            </label>
          ))}
        </div>
      )
    },
  ]

  return (
    <div className="flex flex-col gap-4 p-4 animate-slide-up">
      <ModuleHeader title="Settings" subtitle="Your preferences" />

      {sections.map(({ title, icon: Icon, content }) => (
        <div key={title} className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Icon size={15} style={{ color: 'var(--gold)' }} />
            <h3 className="text-sm font-semibold">{title}</h3>
          </div>
          {content}
        </div>
      ))}

      {/* Rates cache */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3">
          <RefreshCw size={15} style={{ color: 'var(--gold)' }} />
          <h3 className="text-sm font-semibold">Exchange Rates</h3>
        </div>
        <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
          Gold, silver, and FX rates are cached for up to 1 hour. Force refresh if you need latest prices.
        </p>
        <button onClick={refreshRates} disabled={refreshing}
          className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
          style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
          {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          {refreshing ? 'Refreshing…' : 'Refresh Rates Now'}
        </button>
      </div>

      {/* Save button */}
      <button onClick={save} disabled={saving}
        className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
        style={{ background: saved ? '#10B981' : 'var(--gold)', color: '#0a0a0a', transition: 'background 0.3s' }}>
        {saving && <Loader2 size={15} className="animate-spin" />}
        {saved ? '✓ Saved!' : saving ? 'Saving…' : 'Save Settings'}
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
