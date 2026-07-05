'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import FormSheet from '@/components/shared/FormSheet'
import { incomeOutstanding, isIncomeSettled, remainingForIncome } from '@/lib/sadaka'
import { validateAmount } from '@/lib/utils'
import type { Currency, SadakaEntry } from '@/types/database.types'

interface Props { onClose: () => void; onSaved: () => void; editItem?: any }

export default function SadakaForm({ onClose, onSaved, editItem }: Props) {
  const supabase = createClient()
  const isEdit = !!editItem
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [me, setMe] = useState<{ id: string; name: string } | null>(null)
  const [other, setOther] = useState<{ id: string; name: string } | null>(null)
  const [recipients, setRecipients] = useState<{ id: string; name: string }[]>([])
  const [incomes, setIncomes] = useState<{ id: string; name: string }[]>([])
  const DRAFT_KEY = 'mizan_sadaka_draft'
  const [outstanding, setOutstanding] = useState<ReturnType<typeof incomeOutstanding>>(new Map())
  const [secondaryIncomeId, setSecondaryIncomeId] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [profilesLoaded, setProfilesLoaded] = useState(false)
  const [behalfTouched, setBehalfTouched] = useState(false)

  const defaultForm = {
    amount_owed: (editItem?.amount_owed || editItem?.amount_given) ? String(editItem.amount_owed || editItem.amount_given) : '',
    currency: (editItem?.currency ?? 'AED') as Currency,
    is_advance: editItem?.is_advance ?? false,
    on_behalf: 'me' as 'me' | 'other' | 'joint',
    from_income_id: editItem?.source_income_id ?? '',
    recipient_id: editItem?.recipient_id ?? '', recipient_name: editItem?.recipient_name ?? '',
    recipient_type: editItem?.recipient_type ?? 'named_relative',
    location: editItem?.location ?? 'UAE', method: editItem?.method ?? 'cash', notes: editItem?.notes ?? '',
    status: editItem?.status ?? 'pending',
  }

  const [form, setForm] = useState(() => {
    // Only restore draft for new entries, not edits
    if (!editItem && typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(DRAFT_KEY)
        if (saved) return { ...defaultForm, ...JSON.parse(saved) }
      } catch {}
    }
    return defaultForm
  })

  const F = (f: string, v: any) => setForm((p: any) => {
    const next = { ...p, [f]: v }
    if (!editItem) {
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify(next)) } catch {}
    }
    return next
  })

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const [{ data: profs }, { data: recs }, { data: inc }, { data: sad }] = await Promise.all([
        supabase.from('profiles').select('id, display_name'),
        supabase.from('sadaka_recipients').select('id, name').eq('is_active', true).order('name'),
        supabase.from('income_projects').select('id, name, owner_id, ownership').order('created_at', { ascending: false }),
        supabase.from('sadaka_entries').select('*').or(`owner_id.eq.${user!.id},is_joint.eq.true,shared.eq.true`),
      ])
      setOutstanding(incomeOutstanding((sad as SadakaEntry[]) ?? []))
      const mine = profs?.find((p: any) => p.id === user!.id)
      const theirs = profs?.find((p: any) => p.id !== user!.id)
      setMe({ id: user!.id, name: mine?.display_name ?? 'Me' })
      if (theirs) setOther({ id: theirs.id, name: theirs.display_name ?? 'Brother' })
      setRecipients(((recs as any) ?? []).map((r: any) => ({ id: r.id, name: r.name })))
      // income I can attribute sadaka to: my own + anything shared
      setIncomes(((inc as any) ?? [])
        .filter((i: any) => i.owner_id === user!.id || i.ownership === 'shared')
        .map((i: any) => ({ id: i.id, name: i.name })))
      // derive on_behalf for edit mode
      if (editItem) {
        const ob = editItem.is_joint ? 'joint' : (editItem.owner_id && editItem.owner_id !== user!.id ? 'other' : 'me')
        setForm((p: any) => ({ ...p, on_behalf: ob }))
      }
      setProfilesLoaded(true)
    })()
  }, [])

  async function save() {
    if (!me) return
    const amtErr = validateAmount(form.amount_owed, form.currency)
    if (amtErr) { setError(amtErr); return }
    if (form.on_behalf === 'other' && !other) {
      setError('Your brother\'s profile isn\'t loaded yet.'); return
    }
    setSaving(true); setError('')
    const amount = parseFloat(form.amount_owed)

    if (isEdit) {
      // Edit mode never recomputes the payload from scratch — build a DELTA so an
      // innocent edit (fixing a typo in notes) can't wipe amount_given, rewrite
      // date_given to today, or reassign ownership (FIX-17). Shared metadata is
      // always safe to update; owed/given/date_given/status/ownership are gated.
      const wasPayment = Number(editItem.amount_owed) === 0 && Number(editItem.amount_given) > 0
      const statusChanged = form.status !== editItem.status
      const willBePayment = statusChanged ? (form.status === 'given' || form.status === 'advance_given') : wasPayment

      const payload: any = {
        currency: form.currency,
        is_advance: form.is_advance || form.status === 'advance_given',
        source_income_id: form.from_income_id || null,
        recipient_id: form.recipient_id || null,
        recipient_name: form.recipient_name || (form.recipient_id ? recipients.find(r => r.id === form.recipient_id)?.name : null) || null,
        recipient_type: form.recipient_type as any,
        location: form.location as any, method: form.method as any,
        notes: form.notes || null,
      }
      if (statusChanged) payload.status = form.status

      if (willBePayment) {
        payload.amount_given = amount
        payload.amount_owed = 0
        // Preserve the original date_given fact — only stamp today's date the
        // first time this row becomes a payment.
        payload.date_given = editItem.date_given ?? new Date().toISOString().split('T')[0]
      } else {
        payload.amount_owed = amount
        // amount_given / date_given deliberately omitted: an obligation-only
        // edit must never touch what's already been paid toward it.
      }

      if (behalfTouched) {
        payload.owner_id = form.on_behalf === 'other' ? other!.id : me.id
        payload.is_joint = form.on_behalf === 'joint'
        payload.shared = form.on_behalf !== 'me'
      }

      const { error: err } = await supabase.from('sadaka_entries').update(payload).eq('id', editItem.id)
      setSaving(false)
      if (err) { setError(err.message); return }
      onSaved(); onClose()
      return
    }

    // Create mode (untouched): a "given"/"advance" entry is MONEY PAID, not a new
    // obligation. Record it as a pure payment (owed 0, given = amount) so it
    // DEDUCTS from your pending pool instead of inventing a self-cancelling
    // obligation. A "pending" entry is a new obligation (owed = amount).
    const isPayment = form.status === 'given' || form.status === 'advance_given'
    const owed = isPayment ? 0 : amount
    const given = isPayment ? amount : 0
    const isJoint = form.on_behalf === 'joint'
    const ownerId = form.on_behalf === 'other' ? other!.id : me.id
    const shared = form.on_behalf !== 'me'   // brother's or joint entries are visible to both

    const payload: any = {
      owner_id: ownerId,
      amount_owed: owed, amount_given: given,
      currency: form.currency, status: form.status,
      is_advance: form.is_advance || form.status === 'advance_given',
      is_joint: isJoint, shared,
      joint_ibrahim_pct: 0.5,
      source_income_id: form.from_income_id || null,   // which income this sadaka is for
      date_given: given > 0 ? new Date().toISOString().split('T')[0] : null,
      recipient_id: form.recipient_id || null,
      recipient_name: form.recipient_name || (form.recipient_id ? recipients.find(r => r.id === form.recipient_id)?.name : null) || null,
      recipient_type: form.recipient_type as any,
      location: form.location as any, method: form.method as any,
      notes: form.notes || null,
    }
    // Smart split: if paying more than one income owes, route the overflow to a second income
    const linkedRemaining = form.from_income_id ? remainingForIncome(outstanding, form.from_income_id) : 0
    const isOverpay = isPayment && form.from_income_id && amount > linkedRemaining && linkedRemaining > 0
    const canSplit = isOverpay && secondaryIncomeId

    let err
    if (canSplit) {
      // Two entries: primary clears its income exactly, secondary gets the rest
      const secondaryAmount = amount - linkedRemaining
      const base = { ...payload, added_by_id: me.id, amount_owed: 0 }
      const [r1, r2] = await Promise.all([
        supabase.from('sadaka_entries').insert({ ...base, amount_given: linkedRemaining, source_income_id: form.from_income_id }),
        supabase.from('sadaka_entries').insert({ ...base, amount_given: secondaryAmount, source_income_id: secondaryIncomeId }),
      ])
      err = r1.error ?? r2.error
    } else {
      ;({ error: err } = await supabase.from('sadaka_entries').insert({ ...payload, added_by_id: me.id }))
    }
    setSaving(false)
    if (err) { setError(err.message); return }
    try { localStorage.removeItem(DRAFT_KEY) } catch {}
    onSaved(); onClose()
  }

  return (
    <FormSheet onClose={onClose}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold">{isEdit ? 'Edit' : 'Add'} Sadaka Entry</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ background: 'var(--surface-2)' }}><X size={16} /></button>
        </div>

        <div className="flex flex-col gap-3">
          {/* ── PRIMARY FIELDS ── */}
          <div className="grid grid-cols-3 gap-2">
            <select value={form.currency} onChange={e => F('currency', e.target.value)}
              className="px-3 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
              <option value="AED">AED</option>
              <option value="PKR">PKR</option>
            </select>
            <input placeholder="Amount" type="number" value={form.amount_owed} onChange={e => F('amount_owed', e.target.value)}
              className="col-span-2 px-4 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
          </div>

          <select value={form.status} onChange={e => F('status', e.target.value)}
            className="px-3 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
            {editItem?.status === 'partially_given' && (
              <option value="partially_given" disabled>
                Partially given ({editItem.amount_given} of {editItem.amount_owed})
              </option>
            )}
            <option value="pending">Pending (obligation)</option>
            <option value="given">Already Given</option>
            <option value="advance_given">Advance Given</option>
          </select>

          <p className="text-[11px] -mt-1" style={{ color: 'var(--text-muted)' }}>
            {form.status === 'pending'
              ? 'Adds a new amount you owe (raises your pending sadaka).'
              : 'Records money you gave — this DEDUCTS from your pending sadaka.'}
          </p>

          {recipients.length > 0 && (
            <select value={form.recipient_id} onChange={e => F('recipient_id', e.target.value)}
              className="px-3 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
              <option value="">Saved recipient (optional)…</option>
              {recipients.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          )}

          {!form.recipient_id && (
            <input placeholder="Or type recipient name (optional)" value={form.recipient_name} onChange={e => F('recipient_name', e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
          )}

          {/* ── ADVANCED TOGGLE ── */}
          <button type="button" onClick={() => setShowAdvanced(v => !v)}
            className="flex items-center gap-1.5 text-xs py-1" style={{ color: 'var(--text-muted)' }}>
            {showAdvanced ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            Advanced {showAdvanced ? '▲' : '▾'}
          </button>

          {showAdvanced && (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-2">
                <select value={form.recipient_type} onChange={e => F('recipient_type', e.target.value)}
                  className="px-3 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                  <option value="named_relative">Named relative</option>
                  <option value="anonymous_needy">Anonymous needy</option>
                  <option value="masjid">Masjid</option>
                  <option value="gift">Gift</option>
                  <option value="other">Other</option>
                </select>
                <select value={form.location} onChange={e => F('location', e.target.value)}
                  className="px-3 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                  <option value="UAE">UAE</option>
                  <option value="Pakistan">Pakistan</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <select value={form.method} onChange={e => F('method', e.target.value)}
                className="px-3 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                <option value="cash">Cash</option>
                <option value="gift">Gift</option>
                <option value="food">Food</option>
                <option value="bank_transfer">Bank transfer</option>
                <option value="other">Other</option>
              </select>

              {/* Income linking */}
              {(() => {
                const isPayment = form.status === 'given' || form.status === 'advance_given'
                const selectable = incomes.filter(i =>
                  !isPayment || i.id === form.from_income_id || !isIncomeSettled(outstanding, i.id))
                if (incomes.length === 0) return null
                const linkedRemaining = form.from_income_id ? remainingForIncome(outstanding, form.from_income_id) : 0
                const amount = parseFloat(form.amount_owed || '0')
                const overpayAmount = isPayment && form.from_income_id && amount > linkedRemaining && linkedRemaining > 0
                  ? amount - linkedRemaining : 0
                const secondaryOptions = selectable.filter(i => i.id !== form.from_income_id && !isIncomeSettled(outstanding, i.id))
                return (
                  <div className="flex flex-col gap-2">
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {isPayment ? 'Pay toward which income (optional)' : 'From which income (optional)'}
                    </p>
                    <select value={form.from_income_id} onChange={e => { F('from_income_id', e.target.value); setSecondaryIncomeId('') }}
                      className="w-full px-3 py-3 rounded-xl text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                      <option value="">Not linked to a specific income</option>
                      {selectable.map(i => {
                        const rem = remainingForIncome(outstanding, i.id)
                        return <option key={i.id} value={i.id}>{i.name}{isPayment && rem > 0 ? ` — ${rem} ${form.currency} due` : ''}</option>
                      })}
                    </select>
                    {overpayAmount > 0 && (
                      <div className="rounded-xl p-3 flex flex-col gap-2" style={{ background: 'var(--surface-2)', border: '1px solid var(--gold)' }}>
                        <p className="text-[11px] font-medium" style={{ color: 'var(--gold)' }}>
                          ✓ Clears {linkedRemaining.toLocaleString()} {form.currency} on this income
                        </p>
                        {secondaryOptions.length > 0 ? (
                          <>
                            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                              Remaining {overpayAmount.toLocaleString()} {form.currency} — route to:
                            </p>
                            <select value={secondaryIncomeId} onChange={e => setSecondaryIncomeId(e.target.value)}
                              className="w-full px-3 py-2.5 rounded-lg text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                              <option value="">Leave as advance credit</option>
                              {secondaryOptions.map(i => {
                                const rem = remainingForIncome(outstanding, i.id)
                                return <option key={i.id} value={i.id}>{i.name} — {rem} {form.currency} due</option>
                              })}
                            </select>
                            {secondaryIncomeId && (
                              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                Split: {linkedRemaining.toLocaleString()} → {incomes.find(i => i.id === form.from_income_id)?.name} · {overpayAmount.toLocaleString()} → {incomes.find(i => i.id === secondaryIncomeId)?.name}
                              </p>
                            )}
                          </>
                        ) : (
                          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                            Extra {overpayAmount.toLocaleString()} {form.currency} carries forward as advance credit.
                          </p>
                        )}
                      </div>
                    )}
                    {isPayment && !form.from_income_id && form.status === 'advance_given' && (
                      <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        Builds advance credit — auto-offsets your next income obligation.
                      </p>
                    )}
                  </div>
                )
              })()}

              {/* Whose sadaka */}
              <div>
                <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Whose sadaka</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { val: 'me', label: me?.name ?? 'Me' },
                    { val: 'other', label: other?.name ?? 'Brother' },
                    { val: 'joint', label: 'Joint' },
                  ].map(opt => (
                    <button key={opt.val} type="button" onClick={() => { F('on_behalf', opt.val); if (profilesLoaded) setBehalfTouched(true) }}
                      className="py-2.5 px-2 rounded-xl text-xs font-medium truncate"
                      style={{
                        background: form.on_behalf === opt.val ? 'var(--gold-dim)' : 'var(--surface-2)',
                        border: `1px solid ${form.on_behalf === opt.val ? 'var(--gold)' : 'var(--border)'}`,
                        color: form.on_behalf === opt.val ? 'var(--gold)' : 'var(--text-muted)',
                      }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
                {form.on_behalf === 'other' && (
                  <p className="text-[11px] mt-1.5" style={{ color: 'var(--text-muted)' }}>
                    Logged on {other?.name}'s behalf — both of you can see and manage it.
                  </p>
                )}
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_advance} onChange={e => F('is_advance', e.target.checked)}
                  className="w-4 h-4 rounded accent-[var(--gold)]" />
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Advance (given before income)</span>
              </label>
            </div>
          )}

          {error && (
            <div className="px-3 py-2.5 rounded-xl text-xs" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#EF4444' }}>
              ⚠ {error}
            </div>
          )}

          <button onClick={save} disabled={saving || !form.amount_owed || (isEdit && !profilesLoaded)}
            className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
            style={{ background: 'var(--gold)', color: '#0a0a0a' }}>
            {saving && <Loader2 size={15} className="animate-spin" />}
            {saving ? 'Saving…' : isEdit ? 'Update Sadaka' : 'Save Sadaka'}
          </button>
        </div>
    </FormSheet>
  )
}
