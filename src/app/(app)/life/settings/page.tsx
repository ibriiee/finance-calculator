'use client'
import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ModuleHeader from '@/components/shared/ModuleHeader'
import LoadingSpinner from '@/components/shared/LoadingSpinner'
import { Hourglass, Loader2, Plus, Trash2, CalendarHeart, Pencil, Check, ChevronDown, LayoutGrid } from 'lucide-react'
import type { LifeEvent, LifeEventKind, LifeRecurrence, LifeShape } from '@/types/database.types'

const KINDS: { key: LifeEventKind; label: string; hint: string }[] = [
  { key: 'milestone', label: 'Milestone', hint: 'A past moment — colours its week on the grid' },
  { key: 'intention', label: 'Intention', hint: 'A future goal — outlines its week ahead' },
  { key: 'reminder', label: 'Reminder', hint: 'A dated/recurring nudge in Upcoming' },
]
const SWATCHES = [
  '#C9A84C', '#10B981', '#3B82F6', '#EF4444', '#A855F7', '#EC4899', '#F59E0B', '#14B8A6',
  '#84CC16', '#06B6D4', '#F97316', '#E11D48', '#8B5CF6', '#0EA5E9', '#D946EF', '#64748B',
]
// Suggested layer tags — every distinct category becomes its own tab on the life grid.
const CATEGORY_PRESETS = ['Deen', 'Family', 'Work', 'Study', 'Health', 'Travel']
const SHAPES: LifeShape[] = ['square', 'circle', 'diamond', 'ring']
// Mini preview of how a mark shape renders on the grid / legend.
const shapePreview = (s: LifeShape, c: string): React.CSSProperties => ({
  background: s === 'ring' ? 'transparent' : c,
  boxShadow: s === 'ring' ? `inset 0 0 0 2px ${c}` : undefined,
  borderRadius: s === 'circle' ? '50%' : 2,
  transform: s === 'diamond' ? 'rotate(45deg)' : undefined,
})
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
  const blank = { label: '', event_date: '', end_date: '', kind: 'milestone' as LifeEventKind, color: SWATCHES[0], recurrence: 'none' as LifeRecurrence, notes: '', category: '', shape: 'square' as LifeShape }
  const [form, setForm] = useState(blank)
  const F = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }))

  // Which grid views are visible on the Life page (device-local, like the Islamic
  // toggle). cats[name] === false hides that category's tab; missing = shown.
  const [gridViews, setGridViews] = useState<{ plain: boolean; decades: boolean; cats: Record<string, boolean> }>({ plain: true, decades: true, cats: {} })
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('mizan_life_views') ?? '{}')
      setGridViews(v => ({ ...v, ...saved, cats: { ...(saved.cats ?? {}) } }))
    } catch {}
  }, [])
  function saveGridViews(n: typeof gridViews) { setGridViews(n); localStorage.setItem('mizan_life_views', JSON.stringify(n)) }
  const toggleGridView = (key: 'plain' | 'decades') => saveGridViews({ ...gridViews, [key]: !gridViews[key] })
  const toggleCatView = (name: string) => saveGridViews({ ...gridViews, cats: { ...gridViews.cats, [name]: gridViews.cats[name] === false } })

  function startEdit(ev: LifeEvent) {
    setEditingId(ev.id)
    setForm({ label: ev.label, event_date: ev.event_date, end_date: ev.end_date ?? '', kind: ev.kind, color: ev.color, recurrence: ev.recurrence, notes: ev.notes ?? '', category: ev.category ?? '', shape: ev.shape ?? 'square' })
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
    if (form.end_date && form.end_date < form.event_date) { alert('End date is before the start date.'); return }
    setAdding(true)
    const { data: { user } } = await supabase.auth.getUser()
    const payload = {
      label: form.label.trim(),
      event_date: form.event_date,
      end_date: form.end_date || null,
      kind: form.kind,
      color: form.color,
      recurrence: form.recurrence,
      notes: form.notes.trim() || null,
      category: form.category.trim() || null,
      shape: form.shape,
    }
    const { error } = editingId
      ? await supabase.from('life_events').update(payload).eq('id', editingId)
      : await supabase.from('life_events').insert({ owner_id: user!.id, ...payload })
    if (error) {
      setAdding(false)
      // Missing category/end_date columns = migration 21 not run yet — say so plainly.
      alert(/category|end_date|shape/.test(error.message) && /column|schema cache/.test(error.message)
        ? 'Migration needed: run supabase/life-layers.sql (21) and life-shapes.sql (22) in the Supabase SQL Editor, then save again.'
        : 'Could not save event: ' + error.message)
      return
    }
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

      {/* Grid views — which tabs show on the life grid */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3">
          <LayoutGrid size={15} style={{ color: 'var(--gold)' }} />
          <h3 className="text-sm font-semibold">Grid views</h3>
        </div>
        {([['plain', 'Plain', 'Just lived vs remaining'], ['decades', 'Decades', 'One colour per 10-year band']] as const).map(([key, label, hint]) => (
          <label key={key} className="flex items-center justify-between py-1.5 cursor-pointer">
            <div>
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{label}</span>
              <span className="text-[11px] ml-2" style={{ color: 'var(--text-muted)' }}>{hint}</span>
            </div>
            <div className="relative">
              <input type="checkbox" className="sr-only peer" checked={gridViews[key]} onChange={() => toggleGridView(key)} />
              <div className="w-9 h-5 rounded-full peer-checked:after:translate-x-4 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"
                style={{ background: gridViews[key] ? 'var(--gold)' : 'var(--border)' }} />
            </div>
          </label>
        ))}
        {/* One toggle per category currently in use — hide any tab you don't want. */}
        {[...new Set(events.map(e => e.category).filter((c): c is string => !!c))].map(cat => (
          <label key={cat} className="flex items-center justify-between py-1.5 cursor-pointer">
            <div>
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{cat}</span>
              <span className="text-[11px] ml-2" style={{ color: 'var(--text-muted)' }}>category tab</span>
            </div>
            <div className="relative">
              <input type="checkbox" className="sr-only peer" checked={gridViews.cats[cat] !== false} onChange={() => toggleCatView(cat)} />
              <div className="w-9 h-5 rounded-full peer-checked:after:translate-x-4 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"
                style={{ background: gridViews.cats[cat] !== false ? 'var(--gold)' : 'var(--border)' }} />
            </div>
          </label>
        ))}
        <p className="text-[11px] mt-2" style={{ color: 'var(--text-muted)' }}>
          Events is always on. A tab per category (Deen, Work, Study…) appears automatically once an
          event carries that category — switch any of them off here. Hiding a tab never deletes events.
        </p>
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
                      {new Date(ev.event_date).toLocaleDateString()}{ev.end_date ? ` → ${new Date(ev.end_date).toLocaleDateString()}` : ''} · {ev.kind}
                      {ev.category ? ` · ${ev.category}` : ''}{ev.recurrence !== 'none' ? ` · ${ev.recurrence}` : ''}
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
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Date</label>
              <input type="date" value={form.event_date} onChange={e => F('event_date', e.target.value)} className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>End date (optional)</label>
              <input type="date" value={form.end_date} onChange={e => F('end_date', e.target.value)} className={inputCls} style={inputStyle} />
            </div>
          </div>
          {form.end_date && (
            <p className="text-[11px] -mt-1" style={{ color: 'var(--text-muted)' }}>
              Period — tints every week from start to end on the grid, with a live progress bar while it&apos;s ongoing (a course, a job, a city).
            </p>
          )}

          <div>
            <label className="text-xs mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Category (optional — becomes its own tab on the grid)</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {[...new Set([...CATEGORY_PRESETS, ...events.map(e => e.category).filter((c): c is string => !!c)])].map(c => (
                <button key={c} type="button" onClick={() => F('category', form.category === c ? '' : c)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{
                    background: form.category === c ? 'var(--gold-dim)' : 'var(--surface-2)',
                    border: `1px solid ${form.category === c ? 'var(--gold)' : 'var(--border)'}`,
                    color: form.category === c ? 'var(--gold)' : 'var(--text-muted)',
                  }}>{c}</button>
              ))}
            </div>
            <input placeholder="Or type your own (e.g. Quran, Business)" value={form.category}
              onChange={e => F('category', e.target.value)} className={inputCls} style={inputStyle} />
          </div>

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
            <p className="text-[11px] mt-1.5" style={{ color: 'var(--text-muted)' }}>Last swatch = any custom colour.</p>
          </div>

          <div>
            <label className="text-xs mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Mark shape (how it draws on the grid)</label>
            <div className="flex gap-2">
              {SHAPES.map(s => (
                <button key={s} type="button" onClick={() => F('shape', s)} aria-label={s} title={s}
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{
                    background: form.shape === s ? 'var(--gold-dim)' : 'var(--surface-2)',
                    border: `1px solid ${form.shape === s ? 'var(--gold)' : 'var(--border)'}`,
                  }}>
                  <span className="w-4 h-4 block" style={shapePreview(s, form.color)} />
                </button>
              ))}
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
