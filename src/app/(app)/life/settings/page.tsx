'use client'
import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ModuleHeader from '@/components/shared/ModuleHeader'
import LoadingSpinner from '@/components/shared/LoadingSpinner'
import { Hourglass, Loader2, Plus, Trash2, CalendarHeart, Pencil, Check, ChevronDown } from 'lucide-react'
import type { LifeEvent, LifeEventKind, LifeRecurrence } from '@/types/database.types'

const KINDS: { key: LifeEventKind; label: string; hint: string }[] = [
  { key: 'milestone', label: 'Milestone', hint: 'A past moment — colours its week on the grid' },
  { key: 'intention', label: 'Intention', hint: 'A future goal — outlines its week ahead' },
  { key: 'reminder', label: 'Reminder', hint: 'A dated/recurring nudge in Upcoming' },
]
const SWATCHES = ['#C9A84C', '#10B981', '#3B82F6', '#EF4444', '#A855F7', '#EC4899', '#F59E0B', '#14B8A6']
const inputCls = 'w-full px-4 py-3 rounded-xl text-sm'
const inputStyle = { background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' } as const

export default function LifeSettingsPage() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const autoEditId = searchParams.get('edit')
  const editTriggered = useRef(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [dob, setDob] = useState('')
  const [years, setYears] = useState(63)

  const [open, setOpen] = useState<Set<string>>(new Set(['Life Tracker']))
  const toggle = (t: string) => setOpen(s => { const n = new Set(s); n.has(t) ? n.delete(t) : n.add(t); return n })
  const [events, setEvents] = useState<LifeEvent[]>([])
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const blank = { label: '', event_date: '', kind: 'milestone' as LifeEventKind, color: SWATCHES[0], recurrence: 'none' as LifeRecurrence, notes: '' }
  const [form, setForm] = useState(blank)
  const F = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }))

  function startEdit(ev: LifeEvent) {
    setEditingId(ev.id)
    setForm({ label: ev.label, event_date: ev.event_date, kind: ev.kind, color: ev.color, recurrence: ev.recurrence, notes: ev.notes ?? '' })
    if (typeof window !== 'undefined') window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
  }
  function cancelEdit() { setEditingId(null); setForm(blank) }

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    const [{ data: prof }, { data: evs }] = await Promise.all([
      supabase.from('profiles').select('date_of_birth, life_expectancy_years').eq('id', user!.id).single(),
      supabase.from('life_events').select('*').eq('owner_id', user!.id).order('event_date'),
    ])
    setDob((prof as any)?.date_of_birth ?? '')
    setYears((prof as any)?.life_expectancy_years ?? 63)
    const evList = (evs as LifeEvent[]) ?? []
    setEvents(evList)
    setLoading(false)
    // Auto-open edit form if navigated from grid with ?edit=<id>
    if (autoEditId && !editTriggered.current) {
      const target = evList.find(e => e.id === autoEditId)
      if (target) { editTriggered.current = true; startEdit(target) }
    }
  }
  useEffect(() => { load() }, [])

  async function saveProfile() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('profiles').update({
      date_of_birth: dob || null,
      life_expectancy_years: years || 63,
    }).eq('id', user!.id)
    setSaving(false)
    if (error) { alert('Could not save: ' + error.message); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function saveEvent() {
    if (!form.label.trim() || !form.event_date) return
    setAdding(true)
    const { data: { user } } = await supabase.auth.getUser()
    const payload = {
      label: form.label.trim(),
      event_date: form.event_date,
      kind: form.kind,
      color: form.color,
      recurrence: form.recurrence,
      notes: form.notes.trim() || null,
    }
    const { error } = editingId
      ? await supabase.from('life_events').update(payload).eq('id', editingId)
      : await supabase.from('life_events').insert({ owner_id: user!.id, ...payload })
    if (error) { setAdding(false); alert('Could not save event: ' + error.message); return }
    setForm(blank)
    setEditingId(null)
    await load()
    setAdding(false)
  }

  async function deleteEvent(id: string) {
    if (!confirm('Delete this event?')) return
    const { error } = await supabase.from('life_events').delete().eq('id', id)
    if (error) { alert('Could not delete: ' + error.message); return }
    setEvents(e => e.filter(x => x.id !== id))
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="flex flex-col gap-4 p-4 animate-slide-up">
      <ModuleHeader title="Life Settings" subtitle="Set the span you're measuring against" backHref="/life" />

      {/* Life span */}
      <div className="card p-4">
        <button className="flex items-center justify-between w-full" onClick={() => toggle('Life Tracker')}>
          <div className="flex items-center gap-2">
            <Hourglass size={15} style={{ color: 'var(--gold)' }} />
            <h3 className="text-sm font-semibold">Life Tracker</h3>
          </div>
          <ChevronDown size={15} style={{ color: 'var(--text-muted)', transform: open.has('Life Tracker') ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </button>
        {open.has('Life Tracker') && (
          <div className="flex flex-col gap-3 mt-3">
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Date of birth</label>
              <input type="date" value={dob} onChange={e => setDob(e.target.value)} className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Life expectancy (age)</label>
              <input type="number" min={1} max={120} value={years}
                onChange={e => setYears(parseInt(e.target.value) || 63)} className={inputCls} style={inputStyle} />
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Default 63 — the age of the Prophet ﷺ. Used only to visualise the life that remains. Only Allah knows the true term.
            </p>
            <button onClick={saveProfile} disabled={saving}
              className="w-full py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
              style={{ background: saved ? '#10B981' : 'var(--gold)', color: '#0a0a0a', transition: 'background 0.3s' }}>
              {saving && <Loader2 size={15} className="animate-spin" />}
              {saved ? 'Saved!' : saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        )}
      </div>

      {/* Life events */}
      <div className="card p-4">
        <button className="flex items-center justify-between w-full" onClick={() => toggle('Life Events')}>
          <div className="flex items-center gap-2">
            <CalendarHeart size={15} style={{ color: 'var(--gold)' }} />
            <h3 className="text-sm font-semibold">Life Events</h3>
            {events.length > 0 && <span className="text-[11px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>{events.length}</span>}
          </div>
          <ChevronDown size={15} style={{ color: 'var(--text-muted)', transform: open.has('Life Events') ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </button>
        {open.has('Life Events') && <div className="mt-3">

        {/* existing events */}
        {events.length > 0 && (
          <div className="flex flex-col gap-2 mb-4">
            {events.map(ev => (
              <div key={ev.id} className="flex items-center justify-between p-2.5 rounded-xl" style={{ background: 'var(--surface-2)' }}>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: ev.color }} />
                  <div className="min-w-0">
                    <p className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>{ev.label}</p>
                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      {new Date(ev.event_date).toLocaleDateString()} · {ev.kind}{ev.recurrence !== 'none' ? ` · ${ev.recurrence}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center shrink-0">
                  <button onClick={() => startEdit(ev)} aria-label="Edit" className="p-1.5 rounded-lg" style={{ color: 'var(--text-muted)' }}>
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => deleteEvent(ev.id)} aria-label="Delete" className="p-1.5 rounded-lg" style={{ color: '#EF4444' }}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* add form */}
        <div className="flex flex-col gap-3">
          <input placeholder="Label (e.g. Married, First child, Hajj)" value={form.label}
            onChange={e => F('label', e.target.value)} className={inputCls} style={inputStyle} />
          <input type="date" value={form.event_date} onChange={e => F('event_date', e.target.value)} className={inputCls} style={inputStyle} />

          <div>
            <label className="text-xs mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Type</label>
            <div className="grid grid-cols-3 gap-2">
              {KINDS.map(k => (
                <button key={k.key} type="button" onClick={() => F('kind', k.key)} title={k.hint}
                  className="py-2 rounded-xl text-xs font-medium"
                  style={{
                    background: form.kind === k.key ? 'var(--gold-dim)' : 'var(--surface-2)',
                    border: `1px solid ${form.kind === k.key ? 'var(--gold)' : 'var(--border)'}`,
                    color: form.kind === k.key ? 'var(--gold)' : 'var(--text-muted)',
                  }}>{k.label}</button>
              ))}
            </div>
            <p className="text-[11px] mt-1.5" style={{ color: 'var(--text-muted)' }}>{KINDS.find(k => k.key === form.kind)?.hint}</p>
          </div>

          {form.kind === 'reminder' && (
            <div>
              <label className="text-xs mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Repeat</label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { val: 'none', label: 'None' },
                  { val: 'monthly', label: 'Monthly' },
                  { val: 'yearly', label: 'Yearly' },
                  { val: 'hijri_yearly', label: 'Hijri yearly (Zakat)' },
                ] as { val: LifeRecurrence; label: string }[]).map(r => (
                  <button key={r.val} type="button" onClick={() => F('recurrence', r.val)}
                    className="py-2 rounded-xl text-xs font-medium"
                    style={{
                      background: form.recurrence === r.val ? 'var(--gold-dim)' : 'var(--surface-2)',
                      border: `1px solid ${form.recurrence === r.val ? 'var(--gold)' : 'var(--border)'}`,
                      color: form.recurrence === r.val ? 'var(--gold)' : 'var(--text-muted)',
                    }}>{r.label}</button>
                ))}
              </div>
              <p className="text-[11px] mt-1.5" style={{ color: 'var(--text-muted)' }}>
                Hijri yearly tracks the lunar calendar — set your (or your wife's) Zakat date once and it re-marks every Islamic year.
              </p>
            </div>
          )}

          <div>
            <label className="text-xs mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Colour</label>
            <div className="flex flex-wrap items-center gap-2">
              {SWATCHES.map(c => (
                <button key={c} type="button" onClick={() => F('color', c)} aria-label={c}
                  className="w-7 h-7 rounded-lg"
                  style={{ background: c, outline: form.color === c ? '2px solid var(--text-primary)' : 'none', outlineOffset: '2px' }} />
              ))}
              <input type="color" value={form.color} onChange={e => F('color', e.target.value)}
                className="w-7 h-7 rounded-lg bg-transparent cursor-pointer" aria-label="Custom colour" />
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={saveEvent} disabled={adding || !form.label.trim() || !form.event_date}
              className="flex-1 py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ background: 'var(--gold)', color: '#0a0a0a' }}>
              {adding ? <Loader2 size={15} className="animate-spin" /> : editingId ? <Check size={15} /> : <Plus size={15} />}
              {editingId ? 'Save changes' : 'Add event'}
            </button>
            {editingId && (
              <button onClick={cancelEdit} className="px-4 py-2.5 rounded-xl font-semibold text-sm"
                style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
                Cancel
              </button>
            )}
          </div>
        </div>
        </div>}
      </div>
    </div>
  )
}
