// Sadaka attribution math: how much sadaka each income stream still owes.
// An obligation row carries amount_owed (>0) tagged with source_income_id;
// a payment row carries amount_given tagged with the income it was paid toward.
// Remaining = owed − given, per income + currency. When it hits 0 the income's
// sadaka "chapter" is closed and should no longer be offered as a pay-toward target.
import type { SadakaEntry } from '@/types/database.types'

export interface IncomeOutstanding { owed: number; given: number; remaining: number; currency: string }

/** Map of `${income_id}|${currency}` → outstanding sadaka for that income. */
export function incomeOutstanding(entries: SadakaEntry[]): Map<string, IncomeOutstanding> {
  const m = new Map<string, IncomeOutstanding>()
  for (const e of entries) {
    if (!e.source_income_id) continue
    const key = `${e.source_income_id}|${e.currency}`
    const cur = m.get(key) ?? { owed: 0, given: 0, remaining: 0, currency: e.currency }
    cur.owed += Number(e.amount_owed)
    cur.given += Number(e.amount_given)
    cur.remaining = Math.max(0, cur.owed - cur.given)
    m.set(key, cur)
  }
  return m
}

/** Total still-due across all currencies for one income (0 if its chapter is closed). */
export function remainingForIncome(out: Map<string, IncomeOutstanding>, incomeId: string): number {
  let r = 0
  for (const [key, v] of out) if (key.startsWith(incomeId + '|')) r += v.remaining
  return r
}

/**
 * An income is "settled" — its sadaka chapter closed — when it had an obligation
 * (owed > 0) and nothing remains. Incomes with no obligation yet stay open.
 */
export function isIncomeSettled(out: Map<string, IncomeOutstanding>, incomeId: string): boolean {
  let owed = 0, remaining = 0
  for (const [key, v] of out) if (key.startsWith(incomeId + '|')) { owed += v.owed; remaining += v.remaining }
  return owed > 0 && remaining === 0
}

// ============================================================
// UNIFIED SADAKA ENGINE — single source of truth for "how much
// is given / still owed", used by the Sadaka page, Income page,
// and Dashboard so they can never disagree.
//
// THE RULE (deterministic, income-scoped):
//  • A payment tagged with source_income_id pays ONLY that income's
//    obligation(s) of the same owner+currency. It does NOT float
//    across unrelated incomes (that floating was the old bug).
//  • An untagged payment (source_income_id = null) is advance credit:
//    it offsets any remaining obligation of the same owner+currency,
//    oldest-first.
//  • Overpaying one income spills its excess into the same advance pool.
//  • A row is a PAYMENT when amount_owed = 0 and amount_given > 0;
//    an OBLIGATION when amount_owed > 0.
// ============================================================

export interface ObligationStatus {
  owed: number
  given: number          // direct mark-as-given + linked payments + advance applied
  remaining: number
  payments: { entry: SadakaEntry; applied: number }[]  // what cleared it, for breakdowns
}

export interface SadakaComputed {
  /** obligation row id → its resolved status */
  byId: Map<string, ObligationStatus>
  /** leftover advance credit per `${ownerKey}` after offsetting */
  advanceLeft: Map<string, number>
}

const isPaymentRow = (e: SadakaEntry) => Number(e.amount_owed) === 0 && Number(e.amount_given) > 0
const isObligationRow = (e: SadakaEntry) => Number(e.amount_owed) > 0
const ownerKeyOf = (e: SadakaEntry) => e.is_joint ? `joint|${e.currency}` : `${e.owner_id}|${e.currency}`

/** Resolve every obligation deterministically. One pass, no cross-income leakage. */
export function computeSadaka(entries: SadakaEntry[]): SadakaComputed {
  const obligations = entries.filter(isObligationRow)
  const payments = entries.filter(isPaymentRow)
  const byId = new Map<string, ObligationStatus>()

  // 1) Bucket payments: income-linked vs untagged advance credit.
  const linkedByIncome = new Map<string, SadakaEntry[]>()   // `${ownerKey}|${income}` → payments
  const advanceLeft = new Map<string, number>()             // ownerKey → credit
  for (const p of payments) {
    if (p.source_income_id) {
      const k = `${ownerKeyOf(p)}|${p.source_income_id}`
      const list = linkedByIncome.get(k) ?? []
      list.push(p); linkedByIncome.set(k, list)
    } else {
      const k = ownerKeyOf(p)
      advanceLeft.set(k, (advanceLeft.get(k) ?? 0) + Number(p.amount_given))
    }
  }

  // 2) Apply each income's own payments to that income's obligation(s), oldest-first.
  const oblByIncome = new Map<string, SadakaEntry[]>()
  for (const o of obligations) {
    const k = `${ownerKeyOf(o)}|${o.source_income_id ?? 'none'}`
    const list = oblByIncome.get(k) ?? []
    list.push(o); oblByIncome.set(k, list)
  }
  for (const [k, obls] of oblByIncome) {
    obls.sort((a, b) => a.created_at.localeCompare(b.created_at))
    const pool = (linkedByIncome.get(k) ?? []).slice().sort((a, b) => a.created_at.localeCompare(b.created_at))
    let poolIdx = 0, poolLeftInRow = pool[0] ? Number(pool[0].amount_given) : 0
    for (const o of obls) {
      const owed = Number(o.amount_owed)
      const direct = Number(o.amount_given)
      let need = Math.max(0, owed - direct)
      const applied: { entry: SadakaEntry; applied: number }[] = []
      while (need > 0.0001 && poolIdx < pool.length) {
        const take = Math.min(poolLeftInRow, need)
        if (take > 0) { applied.push({ entry: pool[poolIdx], applied: take }); need -= take; poolLeftInRow -= take }
        if (poolLeftInRow <= 0.0001) { poolIdx++; poolLeftInRow = pool[poolIdx] ? Number(pool[poolIdx].amount_given) : 0 }
      }
      byId.set(o.id, { owed, given: owed - need, remaining: need, payments: applied })
    }
    // Overpaid this income → spill remaining linked credit into the advance pool.
    let spill = poolIdx < pool.length ? poolLeftInRow : 0
    for (let i = poolIdx + 1; i < pool.length; i++) spill += Number(pool[i].amount_given)
    if (spill > 0.0001) {
      const ok = ownerKeyOf(obls[0])
      advanceLeft.set(ok, (advanceLeft.get(ok) ?? 0) + spill)
    }
  }

  // 3) Apply advance credit to anything still remaining, oldest-first per owner.
  const remByOwner = new Map<string, SadakaEntry[]>()
  for (const o of obligations) {
    if ((byId.get(o.id)?.remaining ?? 0) > 0.0001) {
      const ok = ownerKeyOf(o)
      const list = remByOwner.get(ok) ?? []
      list.push(o); remByOwner.set(ok, list)
    }
  }
  for (const [ok, obls] of remByOwner) {
    obls.sort((a, b) => a.created_at.localeCompare(b.created_at))
    let credit = advanceLeft.get(ok) ?? 0
    for (const o of obls) {
      if (credit <= 0.0001) break
      const st = byId.get(o.id)!
      const take = Math.min(credit, st.remaining)
      st.given += take; st.remaining -= take; credit -= take
    }
    advanceLeft.set(ok, Math.max(0, credit))
  }

  // Snap to cents — float subtraction leaves dust (e.g. 4.5e-13) that would
  // otherwise show a fully-paid obligation as "remaining > 0" and leak it into
  // the Pending tab. Sub-cent remainders are treated as fully cleared.
  for (const st of byId.values()) {
    st.owed = round2(st.owed)
    st.given = round2(st.given)
    st.remaining = round2(st.remaining)
    if (st.remaining < 0.01) { st.remaining = 0; st.given = st.owed }
    for (const p of st.payments) p.applied = round2(p.applied)
  }

  return { byId, advanceLeft }
}

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Sadaka giving streak: consecutive calendar months — ending at the latest month
 * you gave in — that each hold at least one payment (amount_given > 0). The run
 * only counts as "active" if it reaches the current month or the one before it
 * (a one-month grace), so a long-abandoned streak reads as 0.
 *
 * Deliberately NOT obligation-clearing math: it rewards the giving *habit* and
 * can never produce a wrong money figure, which is exactly why it sidesteps the
 * income-scoped/advance-credit subtlety in computeSadaka. Months are bucketed in
 * UTC (Vercel runs UTC) by date_given, falling back to created_at for payments
 * logged before the date_given column existed. `now` is injectable for testing.
 */
export function sadakaStreak(
  entries: { amount_given: number | string; date_given: string | null; created_at: string }[],
  now: Date = new Date(),
): number {
  const key = (y: number, m: number) => `${y}-${String(m + 1).padStart(2, '0')}`
  const months = new Set<string>()
  for (const e of entries) {
    if (Number(e.amount_given) <= 0) continue
    const d = new Date(e.date_given ?? e.created_at)
    if (isNaN(d.getTime())) continue
    months.add(key(d.getUTCFullYear(), d.getUTCMonth()))
  }
  if (months.size === 0) return 0

  let y = now.getUTCFullYear(), m = now.getUTCMonth()
  if (!months.has(key(y, m))) {
    // No gift yet this month — step back one for the grace window.
    m -= 1; if (m < 0) { m = 11; y -= 1 }
    if (!months.has(key(y, m))) return 0   // latest gift is older than last month
  }
  let streak = 0
  while (months.has(key(y, m))) {
    streak++
    m -= 1; if (m < 0) { m = 11; y -= 1 }
  }
  return streak
}

// Self-check lives in sadaka.test.ts (kept out of this file so it never ships to
// the browser bundle — top-level `module`/`require` refs crash an ESM import).
