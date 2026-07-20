# Mizan — Upgrade Execution Plan (2026-07-18)

Companion to `UPGRADES.md` (the WHAT). This file is the HOW: phases, which model builds
what, and ready-to-execute specs for everything delegated to a smaller model.

---

## Model policy (the rule, verbatim intent from owner)

> Never a compromise on code quality. A lower model is used ONLY when the task is so simple
> that it is 120% certain quality cannot drop and no future bugs can be introduced.
> Everything else runs on Fable 5 (or Opus when Fable is unavailable).

Practical test — a task may go to Sonnet/Haiku only if ALL of these hold:
1. **No money math.** It never touches amounts, currency folding, sadaka/zakat/balance logic.
2. **No cross-module state.** Single file, or a mechanical repeat of the same one-line change.
3. **Pattern already exists in the repo** and the spec below names it — the model copies, never invents.
4. **Failure is loud and cosmetic.** If it breaks, the page looks wrong; totals can never be wrong.
5. **A spec in this file covers it** — files, exact change, acceptance check. No improvisation.

If any doubt at execution time → escalate to Fable 5. Sunk planning is not a reason to stay low.

| Model | Use for | Items |
|-------|---------|-------|
| **Fable 5** | money math, RLS/schema, multi-file features, new modules, anything ambiguous | All P0 (✅ done), Phases 2–4 core, L-section bets |
| **Opus** | same class as Fable 5 when Fable is unavailable; hard debugging | Fallback only — same list as Fable 5 |
| **Sonnet** | mechanical repeats of an existing pattern, spec'd below | S-1 … S-8 |
| **Haiku** | one-file, one-block, zero-logic edits, spec'd below | H-1 … H-3 |

---

## Phases

### Phase 0 — Reported bugs (✅ shipped 2026-07-18, Fable 5, commit `6b576ab`)
Joint txn edit/delete + green/red direction language in TxnForm.

### Phase 1 — P0 CRUD & direction parity (✅ shipped 2026-07-18, Fable 5, this commit)
UPGRADES items 1–12 (except #10 wasiyya — see note):
- **Goals** — goal edit/delete; contribution history list (new) with inline edit/delete; deleting a goal warns about cascading contributions.
- **Ledger** — entry edit (unsettled only); form + rows unified on debt-perspective colors (green = they owe you, red = you owe); live "X will owe you…" preview in form.
- **Loans** — loan edit (owner/adder gated, status recomputed against repaid total); repayment history expandable with edit/delete (gated to whoever logged it, matching RLS); status stays honest after every repayment change.
- **Savings** — entry edit; form fully green/red (type buttons, signed currency chip, live IN/OUT preview, colored submit).
- **Recipients** — edit; smart delete (hard delete if unused, archive if payment history exists — FK `sadaka_entries.recipient_id` has no cascade, history is protected).
- **Zakat** — snapshot delete with confirm.
- **Joint account** — account edit (rename/bank/currency with no-conversion warning) + archive; Joint page now correctly hides archived accounts (`is_active` filter was missing — latent bug found & fixed).
- *#10 Wasiyya deferred deliberately*: module is flagged "user wants rethink" in PROJECT_STATUS — building CRUD on a shape that will be replaced is waste. CRUD ships as part of the rethink (Phase 4, Fable 5).

### Phase 2 — Navigation & entry speed (✅ shipped 2026-07-19, Fable 5)
- **#16 "All modules" hub** — new `/modules` page (static grid, every enabled module, 2 taps from Home); "All modules" card on dashboard. Live per-card stats skipped — dashboard already shows stats (YAGNI).
- **#17 Pick-your-3 nav tabs** — Settings → Bottom Navigation card; per-device localStorage `mizan_nav_tabs` (tap order = bar order); BottomNav honors it. No schema change needed.
- **#18 Quick-add FAB** — dashboard floating +, 5 shortcuts deep-linking with `?add=1`; expenses/income/sadaka/ledger open their form on arrival, joint opens the first account's TxnForm.
- **#22/#24 entry speed** — ExpenseForm remembers last category/currency and offers a one-tap "Same as last: Petrol · AED 50" chip (localStorage `mizan_last_expense`).
- **#25 recurring expenses** — DEFERRED (needs owner-run migration; spec: `is_recurring` column + on-load "due this month" confirm-to-create rows, no cron). → next Fable session.

### Phase 3 — Dashboard insight & household (✅ shipped 2026-07-19, Fable 5)
- **#31 Spending this month** card — top-4 category bars (labels reused from ExpenseForm), your-share AED-folded.
- **#32 MoM delta** — "↑/↓ N% vs last month" on the spending card.
- **#34 Obligations strip** — horizontal chips: zakat countdown, loan due, goal deadline, nisab hint.
- **#50 Recent activity** feed — joint txns + unsettled IOUs merged, newest 6, names + signed amounts.
- **#52 "Chip in now"** — fairness banner button pre-fills the equalizing deposit (TxnForm `defaultAmount`).
- **#55 attribution** — joint expense rows show "by you/Abu Bakar" (`created_by_id`). Ledger has no author column — not retrofittable without a migration; skipped.
- **#67 manual rate override** — found ALREADY BUILT in Settings → Exchange Rates; no work needed.
- **#33 sadaka streak** — DEFERRED (month-bucketing of obligations needs care with `computeSadaka`; do it properly next Fable session, on the Sadaka page).
- **#53 expense→joint combined action** — CUT (advisor): the Expenses "split with brother" toggle already covers the real case; a joint-account variant is speculative. Revisit only if you actually hit the workflow.

### Phase 4 — Islamic core (✅ trimmed & shipped 2026-07-19, Fable 5)
- **#42 Ramadan mode** — gold dashboard banner during Ramadan (via `hijri.ts`), links to Sadaka.
- **#40 Zakat countdown** — "Zakat in Nd" chip from `hawl_start_date + 354d`, red inside 30 days.
- **#44 Nisab awareness** — savings+stash vs silver nisab; "set your hawl date" chip when above with no hawl set.
- **#39 per-asset hawl** — CUT (advisor): real fiqh nuance, but a per-asset anniversary engine for 2 users whose zakat is one yearly sitting is over-engineering. The snapshot + hawl date model is correct enough. Revisit only if a scholar you follow requires per-asset hawl.
- **#41 per-stream sadaka %** — DEFERRED: requires changing the DB trigger (`sadaka-trigger-v2.sql`) + migration; money-math, Fable 5 only, own session.
- **#43 qard hasan intents** — CUT (already covered): loans have due dates + overdue states today.
- **#47 wasiyya rethink** — SKIPPED by owner decision (2026-07-19). All context for the future session: current module `src/app/(app)/wasiyya/page.tsx` + `src/components/wasiyya/WasiyyaForm.tsx` (basic vault, no CRUD — the last module without edit/delete); requirements gathered so far in `PROJECT_STATUS.md` (Modules table row "Wasiyya", Roadmap "Wasiyya rethink"); design direction in `UPGRADES.md` item 47 (guided faraid-aware flow: assets → debts → bequests ≤⅓ → witnesses → print/PDF) + related items 98 (faraid calculator) and 10 (CRUD must ship with it). Fable 5 only.

### Phase 5 — Delegated simple items (✅ shipped 2026-07-20, Fable 5)
All 11 items (S-1…S-8, H-1…H-3) done in one session — owner opted to run the batch on Fable 5
directly instead of delegating. Specs below followed verbatim; tsc after every item, tests +
build green before commit. Notes: S-3 income page already had its button (skipped); S-6 search
matches sadaka entries on recipient name OR linked income name (the entry's displayed title);
H-2 found `themeColor` already present, added only `viewportFit: 'cover'`.

### Phase 6 — Deferred Fable-5 work (partially shipped 2026-07-20)
- **#33 sadaka streak** — ✅ **shipped 2026-07-20**. Dashboard card "N months giving in a row"
  (gold, gated `enabled('sadaka')` + streak ≥ 2). New pure helper `sadakaStreak()` in `src/lib/sadaka.ts`
  (consecutive gift-months by `date_given`, UTC-bucketed, one-month grace so an abandoned run reads 0);
  giving-consistency, NOT obligation-clearing math — deliberately sidesteps the computeSadaka
  month-bucketing subtlety that got it deferred, so it can never show a wrong money figure. 7 assertions
  added to `sadaka.test.ts`. No migration, no money mutation.
- **#25 recurring expenses** — ⏸ **BLOCKED ON OWNER MIGRATION.** Needs an `is_recurring` column on
  `expenses` (owner runs SQL) + a confirm-to-create flow that writes real expense rows (feeds "yours to
  keep"). Not built: shipping dormant, money-writing code before the column exists adds unattended-longevity
  surface with no working feature. Ready to build on request — SplitForm already has the `is_recurring`
  UI pattern to copy, and LoanForm has the column-missing (42703/PGRST204) graceful-degrade pattern.
- **#41 per-stream sadaka %** — ⏸ **NEEDS OWNER DESIGN + NOT AUTO-SHIPPED.** Rewrites the
  `auto_create_sadaka` + `adjust_sadaka_on_income_edit` triggers (`sadaka-trigger-v2.sql`) — the money-math
  heart. Open decisions before any code: (a) where per-type % lives (new `sadaka_rates` table vs JSON on
  `profiles`), (b) which income types get their own rate, (c) defaults + fallback to global `sadaka_pct`.
  A live trigger change to a financial DB is not something to push without owner sign-off + testing.
- Then Phase L bets on demand (#91 budgets, #92 receipts, #54 monthly statement).
- **#47 wasiyya rethink** stays parked until owner asks for it.

---

## Delegation specs — Sonnet (S-1 … S-8)

**S-1. `inputMode="decimal"` on all amount inputs** *(UPGRADES #89)*
Every `<input type="number"` in `src/components/**` and `src/app/(app)/**` gets `inputMode="decimal"` added.
Pure attribute add; change nothing else on the line. ~20 occurrences (grep `type="number"`).
Accept: grep shows every `type="number"` line also contains `inputMode="decimal"`; build passes.

**S-2. Haptic tick on successful save** *(#60)*
In every form component in `src/components/*/`, immediately before each `onSaved()` call that follows
a successful insert/update (i.e., after the `if (err)` guard), add exactly:
`if (typeof navigator !== 'undefined') navigator.vibrate?.(10)`.
Do NOT add it on error paths. Accept: each form has it once per success path; build passes.

**S-3. Empty-state action buttons** *(#79)*
Pattern: `src/app/(app)/savings/page.tsx` lines with `<EmptyState … action={…}>` (it passes an
"Add First Savings" button). Replicate for the EmptyStates in: goals, ledger, joint, loans,
recipients, income, expenses, sadaka pages — button opens that page's existing `setShowForm(true)`
(or equivalent) and copies the page's existing gold button classes exactly.
Accept: every module's empty state has a working add button; no new styles invented.

**S-4. Amount quick-chips** *(#23)*
In `ExpenseForm`, `TxnForm` (joint), `SavingsForm` only: under the amount input add a row of 4
chips `+100 +500 +1k +5k` that add to the current numeric value (`(parseFloat(form.amount)||0)+n`).
Style: copy the type-button idle style already in the same file (`background: var(--surface-2)`,
border `var(--border)`, text `var(--text-muted)`, `rounded-xl text-xs`). One shared row, no new component.
Accept: tapping chips accumulates; typing still works; build passes.

**S-5. "Today / Yesterday" date chips** *(#27)*
Same three forms as S-4: above the date input add two chips setting `entry/txn date` to today /
yesterday (`new Date(Date.now()-86400000).toISOString().split('T')[0]`). Same chip style as S-4.
Accept: chips set the date field; manual picker untouched.

**S-6. Client-side search box on histories** *(#82)*
Income, Expenses, Sadaka pages: a single `<input placeholder="Search…">` above the list, filtering
the already-loaded array by name/description (case-insensitive `.includes`), state `const [q, setQ]`.
Filter BEFORE the existing `.slice(0, visible)` pagination. Copy input styling from the page's
existing inputs. No querying, no debounce, no fuzzy logic.
Accept: typing narrows the list live; clearing restores; totals/summary cards are NOT affected
(they must keep using the unfiltered array — do not touch their inputs).

**S-7. Persistent field labels** *(#88)*
In all form components: every input that has only a placeholder gets a tiny label line above it,
copying the exact pattern already in `GoalForm` (`<label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>`).
Text = shortened placeholder. Do not change any input logic.
Accept: visual only; build passes.

**S-8. Reduce-motion + skeleton polish** *(#86 + #61-lite)*
(a) In `src/app/globals.css` add a `@media (prefers-reduced-motion: reduce)` block disabling
`animate-slide-up`, `animate-fill`, `animate-pulse-gold` (set `animation: none`).
(b) Nothing else. Skeleton loaders (#61 full) stay with Fable 5.
Accept: CSS-only diff.

## Delegation specs — Haiku (H-1 … H-3)

**H-1. PWA shortcuts** *(#58)* — In `public/manifest.json` add a `"shortcuts"` array with three
entries: Add Expense → `/expenses`, Joint Account → `/joint`, Sadaka → `/sadaka`, each with
`name`, `short_name`, `url`; icons omitted (fallback is app icon). JSON syntax must validate.

**H-2. Keyboard hint meta** — verify `<meta name="theme-color">` and `viewport-fit=cover` exist in
`src/app/layout.tsx`; add if missing, exactly as Next.js metadata API expects (`themeColor` in the
exported `viewport`/`metadata` object — check `node_modules/next/dist/docs/` first per project rule).

**H-3. Backup-age nudge copy** *(#65-lite)* — Settings → Data & Backup section: under the export
button add one muted line: "Tip: export a backup every few months — this app runs unattended."
Static text only, copy the section's existing `text-xs` muted style. (The dynamic last-backup
tracking version stays with Fable 5.)

---

## Standing quality gates (every phase, every model)
1. `npx tsc --noEmit` clean, `npm test` green, `npm run build` passes — before every commit.
2. Every new create-flow ships WITH edit + delete (memory: crud-parity-rule).
3. Money direction always green/red + signed (pattern: joint TxnForm).
4. No new dependency without owner sign-off; nothing that decays unattended (rates, external APIs).
5. PROJECT_STATUS.md changelog updated in the same commit.
6. Push to main = live deploy (Vercel) — Ibrahim tap-tests on phone after each phase.
