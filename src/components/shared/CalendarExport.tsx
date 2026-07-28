'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CalendarPlus, Loader2 } from 'lucide-react'
import { downloadIcs, type CalEvent } from '@/lib/calendarExport'
import { formatCurrency, shortDate } from '@/lib/utils'

/**
 * "Add my finance dates to the calendar" (#59) — zakat due, loan due dates,
 * goal deadlines as one .ics download. Display-only: reads dates that already
 * exist, writes nothing, and touches no money math.
 */
export default function CalendarExport() {
  const supabase = createClient()
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState('')

  async function run() {
    setBusy(true); setResult('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const [{ data: profile }, { data: loans }, { data: goals }] = await Promise.all([
        supabase.from('profiles').select('hawl_start_date').eq('id', user!.id).single(),
        supabase.from('loans')
          .select('id, counterparty_name, due_date, original_amount, currency_type, loan_type, status')
          .eq('owner_id', user!.id).neq('status', 'cleared'),
        supabase.from('financial_goals')
          .select('id, name, target_date, target_amount, currency')
          .or(`owner_id.eq.${user!.id},goal_type.eq.joint`).eq('is_active', true),
      ])

      const events: CalEvent[] = []

      // Zakat: hawl start + 354 days (one lunar year) — same rule as the dashboard chip.
      const hawl = (profile as any)?.hawl_start_date as string | null
      if (hawl) {
        const due = new Date(hawl + 'T00:00:00Z')
        due.setUTCDate(due.getUTCDate() + 354)
        events.push({
          uid: `zakat-${hawl}`,
          date: due.toISOString().split('T')[0],
          summary: 'Zakat due — hawl complete',
          description: 'One lunar year since your hawl start date. Open Mizan → Zakat to calculate.',
        })
      }

      ;(loans ?? []).forEach((l: any) => {
        if (!l.due_date) return
        const who = l.loan_type === 'i_owe' ? `Repay ${l.counterparty_name}` : `${l.counterparty_name} repays you`
        events.push({
          uid: `loan-${l.id}`,
          date: l.due_date,
          summary: `${who} — ${formatCurrency(Number(l.original_amount), l.currency_type)}`,
          description: 'Qard hasan — no interest, ever. Open Mizan → Loans.',
        })
      })

      ;(goals ?? []).forEach((g: any) => {
        if (!g.target_date) return
        events.push({
          uid: `goal-${g.id}`,
          date: g.target_date,
          summary: `Goal deadline: ${g.name}`,
          description: `Target ${formatCurrency(Number(g.target_amount), g.currency)} by ${shortDate(g.target_date)}.`,
        })
      })

      if (events.length === 0) {
        setResult('No dated obligations yet — set a hawl date, a loan due date, or a goal deadline first.')
        setBusy(false)
        return
      }
      downloadIcs(events)
      setResult(`✓ ${events.length} date${events.length === 1 ? '' : 's'} exported — open the file to add them.`)
    } catch (e: any) {
      setResult(`Could not build the calendar file: ${e.message}`)
    }
    setBusy(false)
  }

  return (
    <>
      <button onClick={run} disabled={busy}
        className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
        style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
        {busy ? <Loader2 size={14} className="animate-spin" /> : <CalendarPlus size={14} />}
        Add finance dates to calendar
      </button>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {result || 'Downloads zakat, loan and goal dates as a calendar file (.ics) — one-time import, works offline forever.'}
      </p>
    </>
  )
}
