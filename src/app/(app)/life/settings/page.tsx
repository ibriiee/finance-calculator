'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import ModuleHeader from '@/components/shared/ModuleHeader'
import LoadingSpinner from '@/components/shared/LoadingSpinner'
import { Hourglass, Loader2 } from 'lucide-react'

export default function LifeSettingsPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [dob, setDob] = useState('')
  const [years, setYears] = useState(63)

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const { data } = await supabase.from('profiles')
        .select('date_of_birth, life_expectancy_years').eq('id', user!.id).single()
      setDob((data as any)?.date_of_birth ?? '')
      setYears((data as any)?.life_expectancy_years ?? 63)
      setLoading(false)
    })()
  }, [])

  async function save() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('profiles').update({
      date_of_birth: dob || null,
      life_expectancy_years: years || 63,
    }).eq('id', user!.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="flex flex-col gap-4 p-4 animate-slide-up">
      <ModuleHeader title="Life Settings" subtitle="Set the span you're measuring against" backHref="/life" />

      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Hourglass size={15} style={{ color: 'var(--gold)' }} />
          <h3 className="text-sm font-semibold">Life Tracker</h3>
        </div>
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Date of birth</label>
            <input type="date" value={dob} onChange={e => setDob(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Life expectancy (age)</label>
            <input type="number" min={1} max={120} value={years}
              onChange={e => setYears(parseInt(e.target.value) || 63)}
              className="w-full px-4 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
          </div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Default 63 — the age of the Prophet ﷺ. Used only to visualise the life that remains. Only Allah knows the true term.
          </p>
        </div>
      </div>

      <button onClick={save} disabled={saving}
        className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
        style={{ background: saved ? '#10B981' : 'var(--gold)', color: '#0a0a0a', transition: 'background 0.3s' }}>
        {saving && <Loader2 size={15} className="animate-spin" />}
        {saved ? 'Saved!' : saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  )
}
