# Mizan — Project Status & Evolution Log

> **Maintenance rule:** Update this file before a session ends, or after a couple of
> meaningful edits / a new module. Keep the Changelog newest-first. This is the
> single source of truth for "where the project is" — read it at the start of any session.

Private Islamic financial OS for **2 users** (Ibrahim & Abu Bakar). Next.js 16 (App Router,
Turbopack) + Supabase (auth, Postgres, RLS, realtime) + PWA. Deployed on Vercel at
`fin9-ivory.vercel.app`.

---

## Core purpose
Track monthly/yearly **earnings** → ensure the dedicated **sadaka** is actually paid from them →
track **who** received sadaka, when, and who is overdue → manage **joint** household money,
**zakat**, **goals**, and a digital **wasiyya**. Personalised for exactly 2 users.

---

## Modules & status

| Module | Route | Status | Notes |
|--------|-------|--------|-------|
| Dashboard | `/dashboard` | ✅ | Hero = **Yours to keep** (real cash on hand) with a collapsible waterfall: **all received − sadaka actually paid − expenses − owed to people** (all cumulative, not monthly — else last month's income drops out while its sadaka stays subtracted → false negative); still-owed sadaka shown as a reminder (held in that cash, not double-counted). **All time ⇄ This month toggle** (`?view=month`): monthly view scopes income/sadaka/expenses to the current month and drops debt (a running balance, not a monthly flow). PKR folded into AED via `pkr_to_aed`. Summary cards + quick links |
| Expenses | `/expenses` | ✅ | **Personal/living expenses** (rent, Du/bills, petrol, food-out, groceries, vape, sent-home, health, gift, subscription, custom). Category breakdown, this-month vs all, per-currency spend (your share). **Shared toggle** folds in the old Splits: a split expense auto-creates one `brother_ledger` IOU for the other's share. Feeds the dashboard cash model. Owner-private RLS |
| Income | `/income` | ✅ | Individual. Start date, ongoing flag, edit/delete, per-entry **sadaka-paid status**. Editing does NOT re-trigger sadaka (insert-only trigger) |
| Sadaka | `/sadaka` | ✅ v2 | Auto-obligation from income, advance netting, AED/PKR + joint totals, on-behalf w/ attribution. **Export record** card: CSV + printable PDF of sadaka given, scoped all-time or by month (`src/lib/sadakaExport.ts`). **Smart income linking** (`src/lib/sadaka.ts`): the "pay toward which income" picker hides streams whose sadaka chapter is fully given (settled), shows "X due" per open stream, and warns when a payment overpays a linked stream (excess → advance) |
| Recipients | `/recipients` | ✅ | Directory of sadaka recipients; total received, last paid, overdue→prioritise flags, **WhatsApp export**. Linked from Sadaka + selectable in SadakaForm |
| Brother Ledger | `/ledger` | ✅ | IOU between brothers; fixed profile-read RLS hang |
| Joint Account | `/joint` | ✅ | House account: deposits/withdrawals, balance, equal-share fairness, AED↔PKR, realtime |
| Zakat | `/zakat` | ✅ | Silver nisab active (+gold ref), assets−liabilities, pay-by date, yearly paid log |
| Goals | `/goals` | ✅ basic | Individual/joint goals, contributions |
| Loans | `/loans` | ✅ v2 | Qard Hasan tracking; **both brothers see all loans**, "Added by X" tag, "You owe — by person" breakdown (incl. ledger debt), repayments shown, on-behalf entry |
| Splits | `/splits` | ⚠️ deprecated | **Folded into Expenses** (use the "Split with brother" toggle). Removed from nav + dashboard; old `shared_costs` data still reachable at `/splits` by URL. Page file kept for history |
| Savings | `/savings` | ✅ | **Backup-money stashes** per account/place (AED Dubai, PKR Pakistan…), deposit/withdraw, totals per currency; dashboard Savings card = goals + stash |
| Wasiyya | `/wasiyya` | ✅ basic | Digital will vault (user wants rethink) |
| Analytics | `/analytics` | ✅ v2 | **Monthly/Yearly toggle**, **Net Position card** (savings + owed-to-you − loans − ledger = surplus/loss), sadaka donut, trend bars, location donut |
| Life Tracker | `/life` | ✅ v4 | Memento mori, lives in its own **Life room** (nav toggle Finance ⇄ Life; **bottom tab icons hidden in Life** — only the room pill + top Settings, for a full-screen grid). Per-user DOB + life-expectancy age (default **63**, age of Prophet ﷺ) on `profiles`. Days/weeks/months left, % lived, "life in weeks" grid. **Life events** (`life_events` table): milestones colour their week, intentions outline a future week, reminders (none/monthly/yearly/**hijri_yearly**) show in an **Upcoming** list. **Interactive grid** (tap cell → week dates + **Hijri range** + age + 7-day row + event/marker detail), **3 views** (Events/Plain/Decades + **Decades legend**), **you-are-here** pulse, **this-year** row that **expands to a month-by-month calendar**, **Hijri** today+age, clickable legend, event **edit**. **Islamic dates overlay** (toggle): preset holidays (Ramadan / Eid al-Fitr / Eid al-Adha / Islamic New Year / Ashura) + any `hijri_yearly` event (e.g. a Zakat date) marked on every lunar anniversary across the lifespan. Hijri math in `src/lib/hijri.ts` (Intl-based, no dep, +self-check); life math in `src/lib/lifeMath.ts` (+self-check). Reminder push delivery deferred (prefer .ics — see Roadmap) |
| Settings | `/settings` | ✅ | All sections **collapsible** (chevron; Profile open by default). Currency, nisab basis, module toggles, sadaka %, hawl, notifications, **test mode**, **data backup (JSON export) + reset**. (Life Tracker DOB/age + events moved to `/life/settings`, also collapsible.) |

### Locking & data rules
- Income: once **Received**, entry is locked (no edit/delete).
- Sadaka: once **Given**, entry is locked (no edit/delete). Otherwise editable/deletable.
- Settings → Data & Backup: export all records to JSON; "Reset all financial data" clears every
  module's data (keeps account+settings) for the test→real transition.
- Test mode: localStorage flag `mizan_test_mode`; shows a TEST banner (TestBanner component).

---

## SQL migrations (run in Supabase SQL Editor, in this order)
All are safe to re-run (idempotent). Files live in `supabase/`.

1. `schema.sql` — base 14-table schema + RLS + seeds
2. `fix-profiles-rls.sql` — both brothers can READ all profiles (fixes ledger hang)
3. `smart-sadaka.sql` — trigger: income insert → auto pending sadaka; backfills existing
4. `sadaka-shared.sql` — `added_by_id` + `shared`; RLS for on-behalf entries
5. `settings-prefs.sql` — `nisab_basis`, `enabled_modules` JSONB
6. `joint-account.sql` — `joint_accounts` + `joint_account_txns` + RLS + realtime
7. `zakat-paid.sql` — `zakat_paid`, `zakat_paid_date`, `nisab_basis`, `due_date`
8. `sadaka-recipients.sql` — recipient directory + `recipient_id` on sadaka (Sadaka v2)
9. `income-upgrades.sql` — `work_started_date`, `is_ongoing`; income own RLS for update/delete
10. `sadaka-trigger-v2.sql` — shared income splits sadaka 50/50 (one entry per
    brother at his own pct); editing income amount adjusts linked not-yet-given sadaka
11. `sadaka-sync.sql` — fixes income DELETE (FKs were blocking it silently);
    deleting income removes its not-yet-given sadaka; changing sadaka % recalcs pending obligations
12. `loans-shared.sql` — `added_by_id` on loans + both brothers see all loans
    (RLS); needed for the "Added by X" tag and on-behalf loan entry
13. `savings.sql` — `savings_entries` table + RLS for the new Savings module
14. `life-tracker.sql` — `date_of_birth` + `life_expectancy_years` (default 63) on `profiles`
    for the Life Tracker module. **Run as of 2026-06-28** — confirmed by Ibrahim.
15. `life-events.sql` — `life_events` table (milestones / intentions / reminders) + RLS + index.
    **Must be run before Life events / Upcoming work.**

16. `performance-indexes.sql` — 4 performance indexes: `idx_sadaka_income_date`, `idx_repay_loan`, `idx_ledger_settled_date`, `idx_rates_type (UNIQUE)`. **Run 2026-06-30** — confirmed by Ibrahim.
17. `expenses.sql` — `expenses` table (personal/living costs, owner-private RLS, `is_shared`+`my_pct`+`ledger_entry_id` for split→ledger) + index. **⚠️ MUST RUN — Expenses module won't save until this runs.**

(`RUN-ME-run-all-pending.sql` = 10–13 combined into one paste; **migrations 1–16 all run as of 2026-06-30** — confirmed by Ibrahim.)

(`FRESH-INSTALL.sql` = **all 13 migrations concatenated in order**, for standing up a brand-new
project in one paste. Used during the 2026-06-22 project rebuild — see Changelog.)

---

## Key technical notes
- Next.js 16: auth middleware is `src/proxy.ts` (`export async function proxy`), NOT middleware.ts.
  Its matcher must exclude `avatars`, static, manifest, sw.js.
- **Supabase typing is now real** (2026-06-30): `Database` in `src/types/database.types.ts` uses
  `type Loosen<T> = { [K in keyof T]: T[K] }` + `Relationships: []` per table so `.from().select()`
  returns true row types instead of `never`. `tsc --noEmit` is **0 errors**. When adding a table:
  define its `interface`, then add `tablename: Tbl<Interface>` to `Database['public']['Tables']`.
  (`next.config.ts` may still carry `ignoreBuildErrors`; it's no longer load-bearing.)
- Service worker `public/sw.js` is **network-first** (no stale cache).
- **Encoding:** never bulk-edit files with PowerShell `Set-Content -Encoding utf8` — it mangles
  emojis/special chars into mojibake. Use the Edit/Write tools (UTF-8 safe).
- FX: `rates_cache` table holds `pkr_to_aed`, `gold_aed_gram`, `silver_aed_gram`, etc.
- Sadaka netting: pending = max(0, Σowed − Σgiven); advance = max(0, Σgiven − Σowed).
  A **given/advance entry is a PAYMENT** (`amount_owed = 0`, `amount_given = X`) so it
  deducts from the pending pool instead of inventing a self-cancelling obligation. The
  Sadaka list FIFO-allocates payments across open obligations (per owner+currency,
  oldest first) for display only — DB rows stay clean, so each obligation card shows
  what's still due and the cards reconcile with the header total. `source_income_id`
  optionally tags which income a payment/obligation relates to.
- **Backups / disaster recovery:** `npm run backup` dumps all 18 tables (both users,
  service_role) to git-ignored `backups/*.json`; `npm run restore -- <file>` reloads
  into a fresh project, remapping user UUIDs by email. Full runbook (incl. what to do
  if Supabase access is lost) in `docs/DISASTER-RECOVERY.md`. Run a backup regularly +
  before risky changes.

---

## Changelog (newest first)
- **2026-07-03** — **CTO audit second pass — FIX-16..19 + P2-15..18 appended to `docs/CTO-AUDIT-2026-07.md`.**
  Audit-only, no code changed. New HIGH findings: *FIX-16* — all 3 sadaka trigger functions (income
  edit / income delete / sadaka-% change) filter by `status` instead of the `amount_owed = 0` payment
  invariant, so a linked **advance_given payment row gets converted into an obligation** (silent
  charity-record corruption; SQL fix specced as migration 19, owner must run). *FIX-17* — SadakaForm
  **edit wipes `amount_given`** on partially-given obligations + rewrites `date_given` to today.
  *FIX-18* — a failed fetch renders as a fake "No entries yet" empty state on every page (certain to
  fire on Supabase free-tier resume). *FIX-19* — ~8 mutation writes ignore their result (Settings
  shows "Saved ✓" even on failure). Also *FIX-01 step 4b*: the rates fallback path overwrites
  last-known-good rates with hardcoded constants AND bumps `updated_at` (resets the staleness clock).
  P2 adds: month-scope sadaka by `date_given` (P2-15), reset-password proxy bounce (P2-16), analytics
  PKR goal-contribution conversion (P2-17), income currency/ownership edit lock (P2-18). Execution
  order updated (8 sessions). Verified this pass: `tsc` 0 errors; all 3 self-checks pass.
- **2026-07-02** — **CTO audit → `docs/CTO-AUDIT-2026-07.md` (read it before ANY new work).**
  Full-codebase audit (25+ files, all 18 migrations, RLS, scripts; all 3 self-check suites run — pass;
  `tsc` 0 errors). **3 CRITICAL silent bugs found, none yet fixed:** (1) rates pipeline dead since
  install — `rates_write` RLS is service_role-only but `/api/rates` writes as the logged-in user, every
  upsert silently rejected, so zakat/nisab + PKR folding still run on June seed values (silver 3.15 vs
  real ≈ 5–6 → nisab ~45% low, can flip a WAJIB verdict); (2) dashboard "Yours to keep" currency
  asymmetry — PKR sadaka/expenses subtract (×rate) but PKR income never adds (AED-only filter), the
  negative-keep bug class returning in the currency dimension; (3) `life_events` missing from
  `backup.mjs` TABLES + Settings `DATA_TABLES` → disaster-recovery/export silently lose it. Plus P1s:
  zero DB CHECK constraints, `ignoreBuildErrors` still on, `tsx` not a devDep (tests unrunnable offline),
  shared income counted 100% in each brother's cash (vs 50/50 sadaka split — owner decision), zakat
  `snapshot_year` fragile parse. The audit doc has full fix specs (FIX-01…FIX-15), model routing,
  verify steps, execution order — written for Haiku/Sonnet execution.
- **2026-07-01** — **Near-term upgrade sweep: pagination + rate-limit + LAUNCH.md correction.**
  *Pagination*: Income, Sadaka, Loans, Recipients lists now render-slice to 50 with a "Load more"
  button — fetch stays full (totals + `computeSadaka()` FIFO allocation need the complete
  dataset), only the `.map()` render window is capped. *Security*: `/api/rates` now requires a
  logged-in session (401 otherwise) — was callable by anyone. Skipped the Upstash per-user
  throttle from LAUNCH.md; the existing 60-min `rates_cache` TTL already caps real external API
  calls to 1/hour regardless of request count, which is stronger protection than 1/user/min
  without a new dependency. *Doc fix*: LAUNCH.md's "UI REDESIGN — next session priority" section
  (left-border status, collapsible Advanced, dashboard hero flip) was stale — all three shipped
  2026-06-30, checklist just never got updated. `tsc --noEmit` 0 errors.
- **2026-07-01** — **Toggle follow-up fix (Awaiting) + input hardening + MAINTENANCE.md.**
  *Bug:* in "This month" view the **Awaiting** stat showed inflated (30K vs true 15K) — it was computed
  `earned − received`, and monthly scopes *received* to this month (→0) while *earned* stayed all-time.
  Now computed straight from status (sum of non-received income), so it's identical in both views.
  *Data integrity:* the last two forms writing amounts without validation — **GoalForm** and joint
  **TxnForm** — now use `validateAmount()` (rejects empty/0/negative/huge), closing the last paths that
  could write `NaN` into the DB and poison every downstream sum. TxnForm also now requires a contributor
  on deposits. *New doc:* **MAINTENANCE.md** — plain-language survival guide (Supabase pause, account
  upkeep, backups, "don't npm update") for running the app for years with no developer. `next build` green.
- **2026-07-01** — **Dashboard "All time ⇄ This month" toggle + 2-year hardening pass.**
  *Toggle* (`?view=month`): default hero = lifetime cash on hand; monthly view scopes income
  (by `actual_received_date`), sadaka given (by `created_at`) and expenses (by `expense_date`) to the
  current month and omits debt owed (a cumulative balance, not a monthly flow — mixing it in was the
  original negative-keep bug class). Pills on the "Your Money" card; labels adapt (In hand → Received).
  *Hardening for long unattended runtime (no Claude for ~2 yrs):* added **error boundaries** —
  `(app)/error.tsx` (recoverable "try again" screen), `global-error.tsx` (root-layout last resort),
  `not-found.tsx` — so one bad query/render no longer bricks a page. Added **division-by-zero guards**
  in goals + dashboard goal-progress + income sadaka-% (were unguarded → `NaN%` on a 0 amount).
  *Audited clean, no change needed:* RLS enabled on all 19 tables; service worker is network-first
  (always fresh online, never caches financial/API data); `package-lock.json` committed (build frozen).
  Full `next build` green. Operational risks flagged (not code): Supabase free-tier pauses after
  inactivity; PKR-rate fallback goes stale — update in Settings → Currencies; don't run `npm update`.
- **2026-07-01** — **Fix: "Yours to keep" went negative (−7.5K) — cash-model time-window mismatch.**
  Dashboard scoped *in-hand* to income received **this calendar month** (`actual_received_date >= monthStart`)
  while sadaka given and money owed were counted **all-time**. Income received in a prior month dropped out
  of "in hand", but the sadaka paid from it stayed subtracted → false negative (received 15k on 30 Jun, gave
  3.75k + 3.75k advance sadaka → showed −7.5k red instead of +7.5k). Cash on hand is cumulative, not monthly:
  made every arm lifetime — income = **all received** (`status != cancelled`, no date filter), expenses = **all-time**
  (was this-month). Relabelled hero section "This Month" → "Your Money", waterfall "Expenses (this month)" → "Expenses".
  Advance sadaka now correctly nets against the income it was drawn from. `dashboard/page.tsx` only; typecheck clean.
- **2026-06-30** — **Expenses module + cash-on-hand model + full type safety + UI pass (big session).**
  *New Expenses module* (`/expenses`, migration `expenses.sql` — **must run**): the missing half —
  personal/living costs so "yours to keep" reflects real cash. Categories, date, currency,
  this-month/all, category breakdown. **Splits folded in**: a shared expense auto-creates one
  `brother_ledger` IOU; Splits removed from nav + dashboard. *Cash model*: dashboard "Yours to keep"
  = received − **sadaka actually paid (incl. advances)** − this-month expenses − debts (was showing
  income minus only unpaid obligations). *Sadaka engine unified* (`src/lib/sadaka.ts` `computeSadaka()`):
  single income-scoped source of truth used by Sadaka + Income pages — kills the cross-income payment
  leak (the "35 ghost") where the list pooled payments by owner+currency and mislabelled the shortfall;
  float dust now snaps to 0. *Full Supabase typing*: `Database` type fixed (`Loosen<T>` mapped type +
  `Relationships: []` so `.from().select()` stops inferring `never`) → **73 hidden type errors → 0**,
  real compile-time checking now active; added 4 missing tables to the type (sadaka_recipients,
  joint_accounts, joint_account_txns, life_events) + expenses, and missing columns. *UI*: status
  **left-border** strips (red = needs action / unpaid, green = done) across sadaka/income/loans/ledger;
  **collapsible "Advanced"** in Sadaka/Income/Loan forms; **dashboard hero flip** ("Yours to keep" is
  the big number, waterfall under a "How is this calculated ▾"); income card **breakdown** + Net
  toggle (incl. a **"Given to"** list of each sadaka payment — recipient/date/amount — so it survives
  after the payment cards leave the Sadaka tab); sadaka card breakdown. *Ledger delete* button added.
  `tsc` 0 errors, `next build` clean.
- **2026-06-30** — **Security hardening + UX upgrades (batch).** *Security:* (1) CSV injection fix in `sadakaExport.ts` — formula chars (`=+-@`) prefixed with `'` before CSV write. (2) `validateAmount()` shared helper in `utils.ts` (> 0, ≤ 10M, not NaN) — applied to **6 forms**: Sadaka, Income, Loan, Ledger, Savings, Splits. (3) Supabase DB indexes: `performance-indexes.sql` added and run — `idx_sadaka_income_date`, `idx_repay_loan`, `idx_ledger_settled_date`, `idx_rates_type`. *UX — quick wins:* (4) Dashboard stale PKR rates banner when `rates_cache.updated_at` > 24h old. (5) Loans: repayment **progress bar** + **inline "Log Repayment"** form — auto-sets status to `partial` or `cleared` based on total repaid. (6) Ledger: **Reverse Entry** button creates equal-opposite transaction. (7) Offline **draft persistence** for SadakaForm + IncomeForm via `localStorage` (survives signal loss on mobile). (8) "Added by" label now shows on **every** sadaka + loan entry, not just shared ones. *Sadaka UX:* (9) **Smart overflow split** — paying 4000 toward a 3750-due income shows a secondary picker to route the extra 250 to another open income or leave as advance. (10) Income name shown as card **title** (was buried as sub-label). *Life room:* (11) **Quick-edit from grid** — pencil icon in week detail panel → `/life/settings?edit=<id>` auto-opens edit form. (12) Calendar month persists in `localStorage` across visits. *Deferred:* `LAUNCH.md` created with all deferred upgrades (family mode, AI, encrypted Wasiyya, 2FA, audit trail, i18n, App Store).
- **2026-06-28** — **Life Tracker v4 (Hijri + UX) & Sadaka smart linking.** *Life:* (1) **Islamic
  calendar** — new `src/lib/hijri.ts` (Hijri↔Gregorian via `Intl` Umm al-Qura, **no dep**,
  self-check passes) powers an **Islamic-dates overlay** toggle on the grid: preset holidays
  (Ramadan, Eid al-Fitr, Eid al-Adha, Islamic New Year, Ashura) + a new **`hijri_yearly`**
  recurrence so a **Zakat date** (yours or your wife's) re-marks on every lunar anniversary across
  the whole lifespan. Recurrence is a plain TEXT column → **no migration needed**. (2) Week-detail
  panel now shows the **Hijri date range** + a **7-day row** (today highlighted). (3) **Decades view
  legend** (age bands ↔ colours). (4) **This-year** card **expands** to a month-by-month calendar.
  (5) **Bottom tab icons hidden in the Life room** (room pill + top Settings only). *Settings:* all
  cards (Finance + Life) are now **collapsible** (chevron, one open by default) — less scatter.
  *Sadaka:* new `src/lib/sadaka.ts` (per-income outstanding, self-check passes) — the "pay toward
  which income" picker **hides fully-given (settled) streams** (closed chapter), shows **"X due"**
  per open stream, and **warns on overpay** (e.g. 4000 toward a 3750 obligation → clears it, 250
  carries as advance). No new deps. Strict `tsc` clean on all touched files (repo's pre-existing
  untyped-client `never` noise unchanged; build uses `ignoreBuildErrors`).
- **2026-06-28** — **Life Tracker v3 — interactive grid + views.** Grid cells are now tappable
  (→ detail panel: week dates, age, and the event there if any). Three **views** (Events / Plain /
  Decades — decade-coloured lived weeks). **You-are-here** pulse on the current week. **This-year**
  52-week row. **Hijri** today + Hijri years lived (via `Intl`, no dep). **Event editing** in
  `/life/settings` (was add/delete only). Legend entries clickable → jump to that week. New math
  `weekStartDate` / `ageAtWeek` / `weekOfYear` (self-check extended, passes). No new deps. Deferred
  upgrades logged under Roadmap (deeper zoom, .ics calendar sync, push, MS To Do).
- **2026-06-28** — **Life room + Life events (Life Tracker v2).** Split the app into two
  **rooms** with a Finance ⇄ Life toggle pill above the bottom nav (`BottomNav.tsx`); each room
  owns its own nav + Settings tab, so Life no longer competes with Finance for the 3 module
  slots. Room is sticky (persists on shared pages like Settings via `localStorage`).
  `ModuleHeader` gained `backHref` for room-aware back. New **`/life/settings`** owns DOB + age
  (moved out of Finance settings so saving finance prefs can't wipe life data) and full **life
  events** CRUD. New **`life_events`** table (migration 15): `milestone` (colours its lived
  week), `intention` (outlines a future week), `reminder` (none/monthly/yearly → **Upcoming**
  list). Grid legend added. New math `weekIndexOf` + `nextOccurrence` (self-check extended,
  passes). **Reminder push delivery deferred** — needs web-push/service-worker/cron, flagged
  before adding any dep. No new deps.
- **2026-06-28** — **New module: Life Tracker (`/life`).** Memento mori. Per-user DOB +
  life-expectancy age (default 63, age of Prophet ﷺ) added to `profiles` via migration 14
  (`life-tracker.sql` — must be run). Shows days/weeks/months left, % of life lived, and a
  "life in weeks" grid. DOB + age set in Settings; gated by `enabled_modules.life`; dashboard
  shows "≈ N days left" card. Date math isolated in `src/lib/lifeMath.ts` with a runnable
  self-check (`lifeMath.test.ts`, passes). No new table, no notifications/reminders (deferred —
  would need push infra). No new deps. Reused EmptyState/ModuleHeader/LoadingSpinner.
- **2026-06-22** — **Sadaka fix: giving money now actually reduces pending.** Root cause: a
  "Given" entry was stored as `amount_owed = amount_given = X`, inventing a self-cancelling
  obligation — so paying AED 500 raised owed to 8,000 and left pending at 7,500 (did nothing).
  Now a given/advance entry is a **pure payment** (`amount_owed = 0`, `amount_given = X`) →
  pending drops by the amount paid. Added an optional **"from/toward which income"** selector
  (`source_income_id`) on `SadakaForm`, plain-language helper text, and FIFO **display
  allocation** on the Sadaka list so pending obligation cards shrink as payments apply (with
  progress bar + "X of Y given") and reconcile with the header. "Mark as Given" now clears only
  what's still due after payments (no double-count). Prod build clean (22 routes).
- **2026-06-22** — **Backup + disaster-recovery tooling** (so a repeat of the outage below
  can't lose data). Added `npm run backup` (`scripts/backup.mjs`, dumps all 18 tables for
  both users to git-ignored `backups/*.json` with an id↔email map) and `npm run restore`
  (`scripts/restore.mjs`, reloads into a fresh project and remaps user UUIDs by email,
  idempotent). New `docs/DISASTER-RECOVERY.md` runbook covers prevention (2nd org owner,
  account password, keep project active) + the full rebuild/restore steps. Backup script
  smoke-tested against the live project.
- **2026-06-22** — **Supabase project rebuilt (login was down: "Failed to fetch").** The original
  project `iybcesqfjfxdxsybmyob` became unreachable (NXDOMAIN — account access was lost, project
  effectively gone). Stood up a **new project `clfnismubljgmkjrxwxs`** under *ibriiee's Org* (Free),
  ran the full schema via new **`supabase/FRESH-INSTALL.sql`** (all 13 migrations in order),
  recreated the two auth users, set Auth Site URL to `fin9-ivory.vercel.app`, and updated the 3
  Supabase env vars in Vercel (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`) + `.env.local`, then redeployed. Login verified working.
  **Data from the old project was NOT recovered** (no DB access) — fresh start, re-enter data.
- **2026-06-12** — **Feedback: in-hand clarity + sadaka record export.** (1) *Dashboard "This Month"
  rebuilt as a waterfall* — hero is now **in hand (received)** (earned/awaiting kept as a secondary
  split), then `In hand − Sadaka due − Owed to people (short-term, loans + brother ledger) = Yours
  to keep`. PKR sadaka folded into the AED total via `pkr_to_aed` (with a footnote); "Yours to keep"
  goes red when negative. Sadaka/Owed rows link to their modules. (2) *Income↔sadaka link* already
  surfaced per-entry on `/income` ("Sadaka X/Y given" line) — left as-is. (3) *Sadaka export record*:
  new card on `/sadaka` with a month/all-time selector and **CSV** (Excel-friendly, BOM) + **PDF
  record** (printable keepsake via a styled print window) of sadaka actually given —
  `src/lib/sadakaExport.ts`. Prod build clean (22 routes).
- **2026-06-11** — **Post-deploy review pass (multi-angle code review of the feedback round)**:
  Settings backup/export/reset now includes `savings_entries`; new **Savings module toggle** in
  Settings (dashboard card falls back to goals-only when off); analytics loans query filtered to
  owner at the source; SplitForm marks `ledger_entry_created` only **after** the joint withdrawal
  succeeds (no phantom-settled splits if the txn insert fails); LoanForm pre-migration fallback
  also matches Postgres/PostgREST error codes (42703/PGRST204). Build clean; dashboard/settings
  verified against live data on localhost.
- **2026-06-11** — **Feedback round: 9 fixes/features.** (1) *Income delete fixed*: it was silently
  blocked by FKs (sadaka/goals referenced income with no ON DELETE) — `sadaka-sync.sql` makes them
  SET NULL, deletes not-yet-given sadaka with the income, and recalcs pending sadaka when the % is
  changed in Settings; delete errors now surface in the UI. (2) *Back navigation sped up*: dashboard's
  ~12 sequential Supabase queries now run in parallel (`Promise.all`), back arrow is a prefetched
  `<Link>`, and `dashboard/loading.tsx` gives instant feedback. (3) *Joint chip-in nudge*: amber
  dashboard banner ("Abu Bakar chipped in to X — chip in PKR 150,000 to be equal") persists until
  contributions are equal; links to /joint. (4) *You-owe card clickable* → /loans, which now has a
  "You owe — by person" breakdown (loans net of repayments + brother-ledger debt). (5) *Loans v2*:
  `loans-shared.sql` adds `added_by_id` + shared visibility; "Added by Abu Bakar" tag, "Whose loan
  is this?" picker in the form, brother's loans section. (6) *Savings module* (`/savings`,
  `savings.sql`): stashes per account/place in AED/PKR, deposit/withdraw, dashboard Savings card =
  goals + stash and links there. (7) *Analytics v2*: Monthly/Yearly toggle (tiles + trend bars by
  month or year) and a Net Position card folding in loans, ledger debt, savings and goals (PKR→AED)
  with surplus/loss verdict. (8) *Splits v2*: "paid by Both" can pay straight **from a joint
  account** (records the withdrawal there, no ledger push needed), breakdown textarea renders as
  bullets on the card, custom categories, and the Monthly checkbox is explicitly a tag — nothing is
  ever auto-added. (9) Verified: prod build clean, all 13 routes 200 logged-in, dashboard HTML
  (live data) shows the chip-in banner/links. **Run migrations 10–13 in Supabase!**
- **2026-06-11** — **Responsive form modals + app-wide padding fix**. (1) New shared
  `FormSheet` component (`src/components/shared/FormSheet.tsx`) renders every add/edit form via a
  React **portal to `document.body`** — so the overlay is always viewport-relative and can never be
  clipped/misaligned by an ancestor transform (the desktop bug where "New Joint Account" was cut
  off on the left). It's responsive: bottom sheet on mobile (`items-end`, full width), **centered
  dialog on desktop** (`sm:items-center`, max-w-md, aligned to the app column). Adds Esc-to-close
  and body-scroll-lock. All 11 forms (Income, Sadaka, Recipient, Ledger, SettleUp, Joint Account,
  Joint Txn, Goal, Loan, Split, Wasiyya) refactored to use it. New `.animate-sheet-in` keyframe
  (fill-mode `both`) locks the entrance's final frame. (2) **Critical CSS fix**: the global
  `* { padding: 0 }` reset was *unlayered*, so in Tailwind v4 it overrode every `p-*`/`px-*`/`py-*`
  utility in the app — every input, button, and card had been rendering with **zero padding**.
  Wrapped the reset in `@layer base` so utilities win again; proper spacing is restored everywhere.
  Verified at mobile (375) + desktop (1349) widths: forms center correctly, no left-clipping, save
  buttons clear the nav, no horizontal overflow on any page, zero console/server errors.
- **2026-06-11** — **Design refresh ("book of record")**: new type pairing — Fraunces display
  serif (page titles + all money figures, via `--font-display` / `.font-display`) with Inter for
  UI; warm candlelit-ink palette (background `#0B0A07`, gold-tinted surfaces/borders, warmer
  text tones) replacing flat gray-blacks; signature *manuscript rule* divider (`.divider-rule`,
  hairline + centered ✦) used on the dashboard hero; `.section-label` small-caps utility (module
  subtitles, section headers); cards get a subtle vertical gradient + inset hairline; BottomNav
  is now glassy (blur) with a ✦ marker over the active tab; dashboard "This Month" rebuilt as a
  hero card (large serif Earned figure, Received/Awaiting split). Gold reserved for meaning
  (obligations + primary actions). Verified on localhost: all 13 pages render, forms still open
  above nav, zero console/server errors.
- **2026-06-11** — **Form sheets hidden behind bottom nav fixed**: all 11 bottom-sheet forms
  (Income, Sadaka, Recipient, Ledger, SettleUp, Joint Account, Joint Txn, Goal, Loan, Split,
  Wasiyya) used `z-50` — same as BottomNav, which renders later in the DOM and covered the
  save/currency buttons (user couldn't create a Joint Account on mobile). All sheets raised to
  `z-[60]`. Also fixed `.env.local`: `NEXT_PUBLIC_SUPABASE_URL` had a stray `/rest/v1/` suffix
  that broke ALL auth on localhost (production Vercel env was correct, so prod was unaffected).
  Full logged-in walkthrough test done on localhost (mobile viewport): every page loads, every
  form opens fully above the nav with save button clickable, joint-account create verified
  end-to-end against Supabase (test row deleted after), zero console/server errors.
- **2026-06-10** — 360 review fixes: forgot-password OTP flow wired up on login; rates route reads
  `GOLD_API_KEY` (was wrong env name; fallbacks updated $4000/oz gold, $50/oz silver — **get a real
  goldapi.io key into .env.local + Vercel for live nisab**); zakat page auto-refreshes rates;
  joint-goal breakdown uses real profile names (was swapped for Abu Bakar); dashboard pending-sadaka
  now netted per currency (AED·PKR, no more mixing); dashboard income matched by email not
  display-name; dashboard cards/quick-links gated by module toggles; IncomeForm defaults ownership
  to logged-in user; USD removed from Income/Sadaka forms (was invisible in totals); sw.js now
  actually caches for offline; decorative notification toggles removed from Settings; reset-data
  warning covers shared tables; wasiyya copy no longer claims encryption. New migration
  `sadaka-trigger-v2.sql` (run it!).
- **2026-06-08** — Login fix: Abu Bakar email hardcoded (`bakarnaeem@hotmail.com`) since `NEXT_PUBLIC_USER_2_EMAIL` was never set in Vercel; login now shows the real Supabase auth error instead of a generic message.
- **2026-06-08** — Branded desktop side panels (logo, ميزان wordmark, feature list, Ar-Rahman 55:9 verse) + richer backdrop to fill empty PC sides. Mobile unchanged.
- **2026-06-08** — Developer Mode (Settings) unlocks edit/delete on locked income/sadaka. Excel (.xls) export alongside JSON. Income shows today's date. Dashboard: Savings (goals) + You-owe (loans+ledger debt) cards.
- **2026-06-08** — Analytics page (donuts + monthly bars). Income/Sadaka locking once received/given. Sadaka edit/delete. Desktop UI backdrop + typography + selection color. Settings: backup/reset + test mode.
- **2026-06-08** — Income upgrades: work-started date, ongoing flag, edit/delete, per-entry sadaka-paid status badge.
- **2026-06-08** — Sadaka v2: recipient directory `/recipients` (totals, last-paid, overdue prioritisation, WhatsApp export); recipient picker in SadakaForm; PROJECT_STATUS.md + AGENTS.md maintenance loop added.
- **2026-06-08** — Zakat upgrade (silver nisab active + gold ref, pay-by date, yearly paid log).
- **2026-06-08** — Joint Account module built (accounts, deposits/withdrawals, fairness, AED↔PKR, realtime).
- **2026-06-08** — Settings: currency, nisab basis, module on/off toggles; nav respects toggles + Settings tab.
- **2026-06-08** — On-behalf/shared sadaka with attribution; fixed "given" amount bug; joint PKR totals.
- **2026-06-08** — Smart Sadaka engine: income→auto obligation trigger, advance netting, AED/PKR + joint totals.
- **2026-06-08** — Fixed Brother Ledger hang (profiles RLS) + surfaced insert errors.
- **2026-06-08** — Restored UTF-8 (removed mojibake), back buttons on all pages, scrollable form sheets.

---

## Open items / session handoff (2026-06-11)
- ✅ **Both users log in** (Ibrahim + Abu Bakar).
- ✅ Feedback round (9 fixes/features) + review pass deployed (commits `e59c6b2`, `b5f7797`,
  `5b1d2fb`), live at `fin9-ivory.vercel.app`.
- ✅ **All migrations 1–13 run in Supabase** (Ibrahim ran `RUN-ME-run-all-pending.sql`).

## Roadmap / TODO
- [x] ~~Run migrations 10–13 in Supabase SQL Editor~~ — done 2026-06-11 via
      `RUN-ME-run-all-pending.sql`.
- [ ] **Get a free goldapi.io key** → set `GOLD_API_KEY` in `.env.local` AND Vercel env vars.
      Until then, fallback rates are used (gold AED 472/g, silver AED 5.9/g).
- [ ] Wasiyya rethink (user unhappy with current shape — deferred).
- [ ] Real push/email notifications via Supabase Edge Functions (toggles removed until implemented).

### Life Tracker — planned upgrades (not built)
Done so far: rooms, life events (milestone/intention/reminder/**hijri_yearly**), colored weeks
grid with legend, **interactive cells** (tap → week dates + **Hijri range** + age + 7-day row +
event/marker detail), **3 views** (Events / Plain / Decades + **legend**), **you-are-here** pulse,
**this-year** row (**expands to month grid**), **Hijri** today + age, **Islamic-dates overlay**
(holidays + Zakat lunar anniversaries), **event edit**, clickable legend (jumps to week),
**Life-room chrome cleanup** (bottom tabs hidden).
- [x] ~~Decades legend~~ — done (age-band swatches under the grid).
- [x] ~~This-year deeper zoom~~ — done (year card expands to a month-by-month calendar).
- [x] ~~Islamic calendar / Zakat date highlighting~~ — done (`hijri.ts`, overlay toggle,
      `hijri_yearly` recurrence).
- [ ] **Deeper grid zoom** — tap a year/decade in the *life* grid to expand into a day-level grid
      for that span (the this-year card already does month-level).
- [ ] **Wife as a second person** — current data model is 2 brothers; a true per-wife Zakat/profile
      needs a relationships rework. For now add her Zakat as a second `hijri_yearly` event.
- [ ] **Calendar sync (.ics export / subscription feed)** — generate an iCal feed the phone's
      own calendar (Samsung/Google) subscribes to; the phone fires the notifications. **Free, no
      push infra, no dep.** Preferred over web-push. Two-way sync (write back from Samsung) is NOT
      possible via .ics — would need Google/Microsoft Graph OAuth (heavy, a dep, a decision).
- [ ] **Web-push notifications** (service worker + Vercel cron + web-push lib) — only if .ics
      proves insufficient. Adds a dependency — flag before building.
- [ ] **Microsoft To Do / external task app** integration — Graph API OAuth; separate decision.
- [ ] Age/season **bands** shading + decade gridlines as a refinement of Decades view.
- [ ] Notes/dua richer surface; bucket-list / before-death intentions; shared events (RLS rework).
