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

### Phase 2 — Navigation & entry speed (Fable 5) — NEXT
Order of execution, one session:
1. **#16 "All modules" hub** — new `/modules` page: tappable grid of every enabled module with live one-line stat per card (reuses dashboard queries, trimmed). Add compass icon to bottom nav's Home row? No — hub becomes the 5th tab replacing nothing: nav stays Home + 3 + Settings; hub link goes in ModuleHeader of dashboard ("All →") + quick-links row.
2. **#17 Pick-your-3 nav tabs** — Settings section writing `profiles.enabled_modules` order → `ROOMS.finance.tabs` sorted by stored preference before `slice(0,3)` in BottomNav.
3. **#18 Global quick-add FAB** — dashboard-only floating button opening a FormSheet with 5 shortcuts (Expense/Income/Sadaka/Joint txn/IOU), each deep-links to the module with its form open via `?add=1` param each page already reads `showForm` state — add a `useSearchParams` open-on-mount.
4. **#22 last-used defaults** + **#24 duplicate-last** — localStorage per form (`mizan_last_expense` etc.), applied as initial state; "same as last" chip in ExpenseForm.
5. **#25 recurring expenses** — `is_recurring` column migration + on-load synthesis of "due this month" pending rows (confirm-to-create, no cron).

### Phase 3 — Dashboard insight & household (Fable 5)
#31 category mini-breakdown, #32 MoM deltas, #33 sadaka streak, #34 obligations strip,
#50 activity feed, #52 one-tap settle-up on fairness banner, #53 expense→joint+IOU combined action,
#55 attribution everywhere, #67 manual-rate override surface.

### Phase 4 — Islamic core (Fable 5)
#39 hawl-aware zakat per asset, #40 zakat countdown chip, #41 per-stream sadaka %,
#42 Ramadan mode, #43 qard hasan repayment intents, #47 wasiyya rethink (incl. its CRUD),
#44 nisab-crossing alert.

### Phase 5 — Delegated simple items (Sonnet/Haiku, specs below)
Run AFTER Phase 2 so patterns are stable. Batch all Sonnet items in one session, Haiku items in another (or same). **Every item: run `npx tsc --noEmit` + `npm run build` before commit; if either fails and the fix isn't obvious in 2 minutes → stop and leave for Fable 5.**

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
