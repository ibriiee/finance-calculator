# Session Log

2026-07-01 (session 3 — toggle Awaiting fix + input hardening + runbook)
- Completed: (1) Fixed "This month" view showing inflated Awaiting (30K vs 15K) — was earned−received; earned all-time but received month-scoped → 0. Now Awaiting = sum of non-received income, view-independent. (2) Closed last NaN-to-DB paths: GoalForm + joint TxnForm now use validateAmount() (were bare parseFloat); TxnForm also requires contributor on deposit. (3) Audited remaining money pages — no currency-mixing bugs (all sums filter by currency or convert via toAed). Zakat calc clean. (4) NEW MAINTENANCE.md — plain-language survival guide for the user (Supabase pause + resume, keep accounts alive, monthly backups, don't npm update). Verified: tsc 0, next build green. Couldn't test authed dashboard (no user session) — fixes are logic-traced + compiled.
- Changed files: dashboard/page.tsx, components/goals/GoalForm.tsx, components/joint/TxnForm.tsx, NEW MAINTENANCE.md, PROJECT_STATUS.md, SESSION_LOG.md
- Blockers: none. App is code-complete/hardened. Remaining work is operational (user-side), documented in MAINTENANCE.md.
- Next: nothing pending. If more polish wanted next session → Sonnet is fine (no money-math left); keep Opus only for new money/architecture features.

2026-07-01 (session 2 — monthly toggle + 2-year hardening)
- Completed: (1) Dashboard "All time ⇄ This month" toggle (?view=month) — monthly scopes income/sadaka/expenses to current month, drops debt (balance not a flow); pills on Your Money card, labels adapt. (2) Hardening for long unattended runtime: added error.tsx ((app) recoverable screen), global-error.tsx (root last-resort), not-found.tsx — a bad query no longer bricks a page. (3) Division-by-zero guards in goals + dashboard goal-progress + income sadaka-% (were NaN% on 0 amount). (4) Full audit: RLS OK on all 19 tables, SW is network-first (no stale trap), lockfile committed — no change needed. Verified: tsc 0, next build green, dev server boots + /login renders clean (couldn't test authed dashboard — no user session).
- Changed files: dashboard/page.tsx, goals/page.tsx, income/page.tsx, NEW (app)/error.tsx + global-error.tsx + not-found.tsx, PROJECT_STATUS.md, SESSION_LOG.md
- Blockers: none. Operational (non-code) risks flagged to user: Supabase free-tier pause on inactivity; stale PKR-rate fallback (update in Settings); do NOT run npm update (lockfile freeze keeps build reproducible).
- Next: nothing pending. Future small edits → Sonnet is fine; keep Opus only for money-math/architecture.

2026-07-01 (cash-model negative-keep bug)
- Completed: Fixed "Yours to keep" showing −7.5K red. Root cause = time-window mismatch, not the sadaka engine: dashboard counted in-hand income as *received this calendar month* while sadaka-given and owed were all-time, so a 15k received last month dropped out of in-hand but the 7.5k sadaka paid from it stayed subtracted (0 − 7500). Made the whole cash model cumulative: income = all received (status != cancelled, no date filter), expenses = all-time (was this-month). Relabelled "This Month" → "Your Money", "Expenses (this month)" → "Expenses". Advance sadaka now nets against the income it was drawn from → +7.5K green. Typecheck clean (tsc exit 0).
- Changed files: src/app/(app)/dashboard/page.tsx, PROJECT_STATUS.md, SESSION_LOG.md
- Blockers: none. Couldn't verify live number (needs user's authed Supabase session); confirmed by typecheck + data trace.
- Next: if "Yours to keep" should ever be a *monthly* figure instead of lifetime cash-on-hand, that's a separate design call — flagged, not built.

2026-06-30 (session 2 — UI redesign + expenses + cash model + typing)
- Completed: (1) UI: left-border status strips (red=needs action, green=done) on sadaka/income/loans/ledger; collapsible "Advanced" in Sadaka/Income/Loan forms; dashboard hero flip (Yours to keep = big number, waterfall collapsible); income card breakdown + Net toggle; sadaka card breakdown. (2) Unified sadaka engine computeSadaka() in lib/sadaka.ts — kills cross-income payment leak ("35 ghost"), float dust snaps to 0; Sadaka+Income pages use it. (3) Dashboard cash model: Yours to keep = received − all sadaka paid − this-month expenses − debts. (4) FULL Supabase typing fix (Loosen<T> + Relationships:[]) → 73 hidden `never` errors → 0; added 4 missing tables + columns. (5) NEW Expenses module (/expenses) with shared toggle → auto ledger IOU; Splits folded in + removed from nav. (6) Ledger delete button. (7) Income card breakdown now lists "Given to" — each sadaka payment (recipient + date + amount) tied to that income, so the breakdown survives after payment cards leave the Sadaka tab.
- Changed files: dashboard/income/sadaka/loans/ledger/expenses/settings pages, ExpenseForm/IncomeForm/LoanForm/SadakaForm/BottomNav/StatusBadge, lib/sadaka.ts+test, types/database.types.ts, scripts/backup+restore, supabase/expenses.sql (new), PROJECT_STATUS.md
- Blockers: **Ibrahim must run supabase/expenses.sql in Supabase** — Expenses won't save until then (degrades to empty meanwhile).
- Next: confirm expenses.sql run; monthly-rollover handling for cash model later; optionally migrate old shared_costs → expenses.

2026-06-30
- Completed: Full audit (30 findings). Security: CSV injection fix in sadaka export, validateAmount() helper applied to all 6 forms. Sadaka smart overflow: payment splits across 2 incomes when amount > linked income remaining. Quick wins: stale rates banner on dashboard, loan repayment progress bar + inline log form (auto-sets partial/cleared status), ledger reverse entry button, offline draft persistence (SadakaForm + IncomeForm). Life quick-edit: pencil from week panel → /life/settings?edit=<id>. DB: 4 performance indexes run in Supabase. LAUNCH.md created for deferred items.
- Changed files: SadakaForm.tsx, sadaka/page.tsx, sadakaExport.ts, IncomeForm.tsx, LoanForm.tsx, LedgerForm.tsx, SavingsForm.tsx, SplitForm.tsx, loans/page.tsx, ledger/page.tsx, dashboard/page.tsx, life/page.tsx, life/settings/page.tsx, lib/utils.ts, supabase/performance-indexes.sql (new), LAUNCH.md (new), PROJECT_STATUS.md
- Blockers: None
- Next: UI redesign — left-border status system (replace badges), collapsible Advanced in forms, Dashboard hero flip (Yours to Keep as hero number)

2026-06-28
- Completed: Life Tracker v2 + v3. v2: Finance/Life rooms (sticky nav toggle), /life/settings, life_events (milestones/intentions/reminders), colored weeks grid + legend + Upcoming. v3: interactive cells (tap → week dates/age + event detail), 3 views (Events/Plain/Decades), you-are-here pulse, this-year row, Hijri today+age, event edit, clickable legend. Math weekIndexOf/nextOccurrence/weekStartDate/ageAtWeek/weekOfYear (self-check passes). Docs updated (PROJECT_STATUS modules/SQL/changelog/roadmap, SESSION_LOG).
- Changed files: BottomNav.tsx, ModuleHeader.tsx, life/page.tsx, life/settings/page.tsx, settings/page.tsx, lifeMath.ts(+test), database.types.ts, supabase/life-events.sql(+FRESH-INSTALL), PROJECT_STATUS.md, SESSION_LOG.md
- Blockers: migration 15 (life-events.sql) must be run in Supabase before events/Upcoming/editing work. Reminder PUSH deferred (prefer .ics calendar feed — free, no dep; see Roadmap).
- Next: (1) run migration 15. (2) Decide calendar sync route: .ics feed (recommended, free, phone calendar fires notifications) vs web-push (needs dep+cron). (3) Optional: deeper grid zoom (year/month/day), per-year view modes, MS To Do integration.

2026-06-28 (session 2)
- Completed: Life Tracker v4 + Sadaka smart linking. LIFE: new src/lib/hijri.ts (Hijri↔Gregorian via Intl Umm al-Qura, no dep, self-check ✓) → Islamic-dates overlay toggle (Ramadan/Eid Fitr/Eid Adha/New Year/Ashura) + new hijri_yearly recurrence so a Zakat date re-marks every lunar year across the lifespan; week-detail shows Hijri range + 7-day row; Decades legend; this-year card expands to a month-by-month calendar; Life-room bottom tab icons hidden. SETTINGS: all cards (Finance + Life) collapsible. SADAKA: new src/lib/sadaka.ts (per-income outstanding, self-check ✓) → income picker hides settled streams, shows "X due" per open stream, warns on overpay (excess→advance).
- Changed files: src/lib/hijri.ts (new), src/lib/sadaka.ts (new), lifeMath.ts, database.types.ts, life/page.tsx, life/settings/page.tsx, settings/page.tsx, components/sadaka/SadakaForm.tsx, BottomNav.tsx, PROJECT_STATUS.md, SESSION_LOG.md.
- Blockers: NONE new. No DB migration needed (recurrence is plain TEXT, accepts hijri_yearly; Islamic-dates toggle is localStorage mizan_islamic_dates). Migration 15 (life-events.sql) still required if not yet run.
- Next: optional deeper life-grid zoom (tap year/decade → day grid); true per-wife profile needs a relationships rework (for now wife's Zakat = a 2nd hijri_yearly event); .ics calendar feed still the recommended notification route.

2026-07-01 (session 3)
- Completed: Closed out LAUNCH.md's "near-term" upgrade bucket. Pagination (render-slice to 50 + "Load more") on Income/Sadaka/Loans/Recipients — fetch stays full since totals + computeSadaka() FIFO need the complete dataset, only the .map() render window is capped. /api/rates now 401s without a session (was public); skipped the Upstash per-user throttle since the existing 60-min rates_cache TTL already caps real external calls to 1/hour, no new dep. Discovered the "UI REDESIGN — next session priority" section in LAUNCH.md was stale (left-border status/collapsible Advanced/dashboard hero flip all shipped 2026-06-30) — corrected the doc, wrote no code for it. tsc 0 errors, next build clean (25 routes).
- Changed files: income/page.tsx, sadaka/page.tsx, loans/page.tsx, recipients/page.tsx, api/rates/route.ts, LAUNCH.md, PROJECT_STATUS.md
- Blockers: None
- Next: LAUNCH.md's remaining buckets (security/data-integrity, AI, multi-user, i18n, App Store) are deliberately still deferred — each needs an explicit scope call (some require new deps or architecture rework) before starting.

[2026-07-02]
- Completed: full CTO audit -> docs/CTO-AUDIT-2026-07.md. 3 CRITICAL: rates pipeline
  dead (RLS blocks /api/rates writes, silent), dashboard PKR asymmetry in "Yours to
  keep", life_events missing from backup/export/reset. P1: no DB CHECK constraints,
  ignoreBuildErrors on, tsx not a devDep, shared-income 100% double-count (owner Q).
- Changed files: docs/CTO-AUDIT-2026-07.md (new), PROJECT_STATUS.md (changelog)
- Blockers: none — audit only, no code changed. FIX-01 needs owner to confirm
  SUPABASE_SERVICE_ROLE_KEY in Vercel. FIX-07 needs owner decision (50% vs 100%).
- Next: execute audit doc in ID order — Session 1 = FIX-03, FIX-05, FIX-06 (Haiku tier).
