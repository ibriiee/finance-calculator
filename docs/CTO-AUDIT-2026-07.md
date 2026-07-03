# Mizan — CTO Audit & Upgrade Plan (2026-07-02)

> **Purpose.** Full-codebase audit of Mizan against its north star: *run correctly,
> unattended, for 2–5+ years, for exactly 2 users, with no developer available.*
> Every finding below was **verified against the actual code/SQL** (file + line cited),
> not guessed. Fixes are specified so a smaller model (Haiku/Sonnet) can execute them
> without re-deriving the analysis.
>
> **How to use this doc (executor protocol):**
> 1. Work tasks **in ID order** (FIX-01 → …). Never skip a P0 to do a P2.
> 2. One task = one commit. Run the task's **Verify** block before committing.
> 3. Anchors are given as *code snippets*, not just line numbers — search for the snippet.
> 4. If a Verify step fails twice → STOP, leave the task, write what happened in
>    SESSION_LOG.md. Do not improvise a different fix.
> 5. SQL blocks are run by the **owner** in Supabase → SQL Editor (same flow as all
>    migrations in `supabase/`). The model's job is to create the `.sql` file and tell
>    the owner to run it — never assume it ran.
> 6. Update `PROJECT_STATUS.md` (changelog + SQL list) after each landed task.
>
> **Guardrails (do NOT):** no new runtime dependencies (devDep `tsx` in FIX-06 is the
> one sanctioned exception); no `npm update`; no restructuring folders; no edits via
> PowerShell `Set-Content` (mojibake — use editor tools); never touch
> `computeSadaka()` / `lifeMath.ts` / `hijri.ts` logic (all self-checks pass; they are
> the verified core); never weaken RLS on money tables.

---

## 1. Executive verdict

**Has issues — three of them silent and load-bearing.** The pure money math
(`computeSadaka`, zakat formula, life math) is correct and self-tested. The failures
are in the *plumbing*: the FX/metals rate pipeline has been **dead since install**
(RLS silently rejects every write), the dashboard hero mixes currencies
**asymmetrically** (PKR outflows subtract, PKR income never adds), and the
backup/restore + export/reset paths **silently drop the `life_events` table**.
None of these throw an error anywhere — which is exactly the failure class that kills
an unattended app.

Health signals verified 2026-07-02:
- `npx tsc --noEmit` → **0 errors** ✓
- `npx tsx src/lib/sadaka.test.ts` → pass ✓ · `lifeMath.test.ts` → pass ✓ · `hijri.test.ts` → pass ✓
- Service-role key confined to `scripts/` ✓ · `.env*` gitignored ✓ · RLS enabled on all tables ✓
- Error boundaries present (`(app)/error.tsx`, `global-error.tsx`, `not-found.tsx`) ✓
- `package-lock.json` committed ✓ · service worker network-first ✓

---

## 2. What is GOOD — do not "improve" these

| Area | Evidence | Rule for future models |
|---|---|---|
| Sadaka engine | `src/lib/sadaka.ts` — income-scoped FIFO, advance pool, cent-snapping; test passes | Never rewrite. Extend only with new tests. |
| Zakat formula | `zakat/page.tsx` — nisab 87.48g gold / 612.36g silver, 2.5%, 354-day hawl | Constants are fiqh — never change without owner + scholar. |
| Life/Hijri math | `lifeMath.ts`, `hijri.ts` — pure, Intl-based, no deps, tests pass | Same. |
| RLS posture | owner-scoped policies on money tables | Only ever ADD policies via migration files. |
| Ops docs | `MAINTENANCE.md`, `docs/DISASTER-RECOVERY.md` | Keep updated when touching backup paths. |

---

## 3. P0 — CRITICAL (silent, wrong-money-number class)

### FIX-01 · The rates pipeline is dead: RLS rejects every write, errors are swallowed
**Severity:** CRITICAL · **Model:** Sonnet · **Files:** `src/app/api/rates/route.ts`, `src/lib/supabase/` (new file), `supabase/` (no SQL change needed)

**Verified root-cause chain:**
1. `supabase/schema.sql` (~line 356):
   `CREATE POLICY "rates_write" ON public.rates_cache FOR ALL USING (auth.role() = 'service_role');`
   No later migration widens this (grepped all 18 SQL files — only `schema.sql` and
   `FRESH-INSTALL.sql` mention `rates_cache` policies).
2. `src/app/api/rates/route.ts` builds its client via `createClient()` from
   `src/lib/supabase/server.ts` → **anon key + user cookies = `authenticated` role**,
   not `service_role` → every `rates_cache` upsert is rejected by RLS.
3. The upsert loop ignores errors:
   ```ts
   for (const rate of rates) {
     await supabase.from('rates_cache').upsert(   // ← result never checked
   ```
4. The Settings page has **no `rates_cache` writer at all** (grepped
   `settings/page.tsx` — zero matches), even though `MAINTENANCE.md` and the
   dashboard's stale banner say "update in Settings → Currencies".

**Net effect:** `rates_cache` still holds the June-2026 **seed** values
(`gold 272 AED/g`, `silver 3.15 AED/g`, `pkr_to_aed 0.0132`). Zakat page reads these
(seed silver 3.15 vs. real ≈ 5–6) → **nisab threshold computed ~45% too low** → a
borderline user can be told Zakat is WAJIB/not-WAJIB **wrongly**. Dashboard PKR→AED
folding also uses the frozen 0.0132 forever.

**Fix spec (in order):**
1. Create `src/lib/supabase/admin.ts`:
   ```ts
   import { createClient as createSbClient } from '@supabase/supabase-js'
   // Server-only client for privileged writes (rates_cache). NEVER import in 'use client' files.
   export function createAdminClient() {
     const url = process.env.NEXT_PUBLIC_SUPABASE_URL
     const key = process.env.SUPABASE_SERVICE_ROLE_KEY
     if (!url || !key) return null   // degrade visibly, not silently (see step 3)
     return createSbClient(url, key, { auth: { persistSession: false } })
   }
   ```
   (`SUPABASE_SERVICE_ROLE_KEY` is already set in Vercel — confirmed in
   PROJECT_STATUS 2026-06-22 rebuild entry. Verify in Vercel dashboard before deploy.)
2. In `route.ts`: keep the existing auth **gate** (401 for non-logged-in) using the
   normal server client, but perform the **upserts with `createAdminClient()`**.
3. Stop swallowing errors: collect each upsert's `error`; if any failed, include
   `"writeErrors": [...]` in the JSON response and `console.error` them (shows in
   Vercel logs). If `createAdminClient()` returned null, respond
   `{ success:false, error:'rates writer not configured' }` with status 500.
4. **Clamp before writing** (a hijacked/broken free API must never poison the DB —
   this app runs unattended for years). Reject (keep old value + flag in response)
   anything outside:
   ```
   pkr_to_aed     0.001 – 0.1      usd_to_aed   3.5 – 3.8   (AED is USD-pegged)
   gold_aed_gram  100 – 2000       silver_aed_gram  1 – 50
   gold_usd_oz    800 – 20000      silver_usd_oz    5 – 500
   ```
5. Add the missing **manual override** in Settings → new small "Currencies" card:
   one input for PKR→AED + Save button that POSTs to a new thin route
   `src/app/api/rates/manual/route.ts` (auth-gated, admin client, clamps as above,
   writes `pkr_to_aed` with `source:'manual'`). This is the owner's no-API escape
   hatch for the next 5 years and makes MAINTENANCE.md's instruction true.

**Verify:**
- `npx tsc --noEmit` → 0 errors.
- Locally with `.env.local`: log in, `curl -b <cookies> localhost:3000/api/rates` →
  response has `"cached": false` first call, **no `writeErrors`**; then check
  Supabase table editor: `rates_cache.updated_at` is *now* and `source` is
  `api`/`fallback`, no longer `seed`.
- Zakat page: silver rate shown changes from 3.15 to a live/fallback value.
- Dashboard stale-rates banner disappears (next 24h window).

**Rollback:** revert the commit; the old (dead) behavior returns — nothing breaks harder.

---

### FIX-02 · Dashboard "Yours to keep": PKR income is dropped while PKR outflows subtract
**Severity:** CRITICAL · **Model:** Sonnet · **File:** `src/app/(app)/dashboard/page.tsx`

**Verified asymmetry** (this is the *same bug class* fixed three times before —
time-window mismatch — now in the **currency** dimension):

| Arm | Currency handling | Anchor snippet |
|---|---|---|
| In hand (income received) | **AED only** — PKR income excluded | `i.status === 'received' && i.currency === 'AED'` |
| Awaiting | **AED only** | `i.currency === 'AED' && i.status !== 'received'` |
| − Sadaka given | AED **+ PKR×rate** | `sumGiven('AED') + sumGiven('PKR') * pkrToAed` |
| − Expenses | AED **+ PKR×rate** | `expenseShare('AED') + expenseShare('PKR') * pkrToAed` |
| − Loans owed | **AED only** | `l.currency_type === 'AED'` |
| − Ledger debt | **AED only** | `if (e.currency === 'AED') aedBalance += …` |

`IncomeForm.tsx` offers **AED and PKR** (`<option value="PKR">`), so PKR income is a
real, reachable state. A brother who receives PKR income and gives PKR sadaka sees the
sadaka **subtracted** from a hero that never **added** the income → understated or
falsely negative "Yours to keep" (the exact symptom of the 2026-07-01 bug, returning
through the other door).

**Fix spec — make every arm fold PKR at `pkrToAed`, symmetric with sadaka/expenses:**
1. `totalReceived`: compute `receivedAed + receivedPkr * pkrToAed` (same
   status/month filters; just add a second `.filter(currency==='PKR')` reduction).
2. `awaitingAed`: same treatment → rename `awaitingAedTotal` internally if clearer,
   display unchanged.
3. `loanDebtAed`: include `currency_type === 'PKR'` loans × `pkrToAed`
   (leave USD/gold/silver loans out — display-only in /loans, note in code comment).
4. `ledgerDebtAed`: fold `pkrBalance < 0` × `pkrToAed` into `totalOwedAed`
   (keep the per-currency Brother Ledger card exactly as is — it's correct).
5. Add one footnote line under the hero (matches the existing PKR footnote style):
   `PKR folded in at {pkrToAed} — see Settings → Currencies.` Only render it when any
   PKR amount was folded.
6. Add a comment block at the top of the money section: *"EVERY arm of this model must
   apply the same time window AND the same currency folding. Asymmetry here has caused
   3 shipped bugs (see PROJECT_STATUS 2026-06-30, 2026-07-01 ×2)."*

**Verify:**
- `npx tsc --noEmit` → 0.
- Manual scenario on localhost (test mode): add PKR income 100,000 received today +
  PKR sadaka given 20,000. Hero must move by `(100000 − 20000) × pkr_to_aed`, not by
  `−20000 × rate`. Check both All-time and This-month toggles.
- Regression: with **zero** PKR rows, output identical to before the change
  (screenshot-compare the numbers).

**Rollback:** single-file revert.

---

### FIX-03 · `life_events` silently missing from backup, export, and reset
**Severity:** CRITICAL (silent data loss on disaster-recovery) · **Model:** Haiku
**Files:** `scripts/backup.mjs`, `src/app/(app)/settings/page.tsx`, `PROJECT_STATUS.md`, `docs/DISASTER-RECOVERY.md`

**Verified:** `backup.mjs` `TABLES = [ … 19 names … ]` has **no `life_events`**;
Settings `DATA_TABLES` (drives BOTH "export JSON" and "Reset all financial data") has
**no `life_events`** either. The `life_events` table shipped in migration 15 (after the
backup tooling, 2026-06-22) and was never added. `restore.mjs` iterates the dump's own
keys, so fixing `backup.mjs` fixes restore automatically (executor: confirm restore
has no separate hardcoded list — grep `TABLES` in `restore.mjs`).

A disaster-recovery cycle today would **silently lose every life event** (milestones,
intentions, Zakat hijri reminders).

**Fix spec:**
1. `backup.mjs`: add `'life_events',` to `TABLES` (after `'expenses',`).
2. `settings/page.tsx`: add `'life_events',` to `DATA_TABLES`.
   ⚠ Note: this also makes "Reset all financial data" clear life events. That matches
   the reset's documented promise ("clears every module's data") — but add
   `life events` to the reset warning text so the owner isn't surprised.
3. Update the "18 tables" wording in `PROJECT_STATUS.md` (§ Key technical notes,
   backup bullet) and in `docs/DISASTER-RECOVERY.md` to "20 tables".
4. Owner action: run `npm run backup` once after merge; confirm the new JSON contains
   a `life_events` key with the expected row count.

**Verify:** run `npm run backup` → open newest `backups/*.json` → `tables.life_events`
exists (array, length ≥ 0, matches Supabase table editor count).

---

## 4. P1 — HIGH (integrity floor & durability)

### FIX-04 · Add the missing DB integrity floor (CHECK constraints)
**Severity:** HIGH · **Model:** SQL below is final; executor = Haiku (create file, hand to owner) · **File (new):** `supabase/integrity-checks.sql`

**Verified:** zero column `CHECK` constraints across all 18 SQL files (every `CHECK (`
match is an RLS `WITH CHECK`). All money integrity currently rests on the app-layer
`validateAmount()` — one future form or API bug away from NaN/negative rows poisoning
every downstream sum, with nobody watching for 2 years. The DB must be the last line.

**Create `supabase/integrity-checks.sql` with exactly this content** (idempotent;
run-order: preflight SELECTs first — any rows returned must be fixed by the owner
before the ALTERs):

```sql
-- ============================================================
-- INTEGRITY FLOOR — CHECK constraints (2026-07 audit FIX-04)
-- 1) PRE-FLIGHT: each SELECT must return 0 rows. If not, fix
--    those rows first (they are already-corrupt data).
-- ============================================================
SELECT id, amount        FROM public.income_projects  WHERE amount <= 0 OR amount IS NULL;
SELECT id, amount_owed, amount_given FROM public.sadaka_entries
  WHERE amount_owed < 0 OR amount_given < 0 OR (amount_owed = 0 AND amount_given = 0);
SELECT id, amount        FROM public.brother_ledger   WHERE amount <= 0;
SELECT id, original_amount FROM public.loans          WHERE original_amount <= 0;
SELECT id, amount        FROM public.loan_repayments  WHERE amount <= 0;
SELECT id, amount        FROM public.goal_contributions WHERE amount <= 0;
SELECT id, amount        FROM public.savings_entries  WHERE amount <= 0;
SELECT id, amount        FROM public.joint_account_txns WHERE amount <= 0;
SELECT id, amount, my_pct FROM public.expenses WHERE amount <= 0 OR my_pct < 0 OR my_pct > 1;
SELECT rate_type, rate_value FROM public.rates_cache  WHERE rate_value <= 0;

-- 2) CONSTRAINTS (safe to re-run: duplicate_object is swallowed)
DO $$ BEGIN
  ALTER TABLE public.income_projects  ADD CONSTRAINT chk_income_amount_pos    CHECK (amount > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.income_projects  ADD CONSTRAINT chk_income_currency      CHECK (currency IN ('AED','PKR'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.income_projects  ADD CONSTRAINT chk_income_status        CHECK (status IN ('pending','partial','received','cancelled'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.income_projects  ADD CONSTRAINT chk_income_ownership     CHECK (ownership IN ('ibrahim','abu_bakar','shared'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.sadaka_entries   ADD CONSTRAINT chk_sadaka_nonneg        CHECK (amount_owed >= 0 AND amount_given >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.sadaka_entries   ADD CONSTRAINT chk_sadaka_currency      CHECK (currency IN ('AED','PKR'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.brother_ledger   ADD CONSTRAINT chk_ledger_amount_pos    CHECK (amount > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.brother_ledger   ADD CONSTRAINT chk_ledger_currency      CHECK (currency IN ('AED','PKR'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.loans            ADD CONSTRAINT chk_loans_amount_pos     CHECK (original_amount > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.loan_repayments  ADD CONSTRAINT chk_repay_amount_pos     CHECK (amount > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.goal_contributions ADD CONSTRAINT chk_contrib_amount_pos CHECK (amount > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.savings_entries  ADD CONSTRAINT chk_savings_amount_pos   CHECK (amount > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.joint_account_txns ADD CONSTRAINT chk_jtxn_amount_pos    CHECK (amount > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.expenses         ADD CONSTRAINT chk_expense_amount_pos   CHECK (amount > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.expenses         ADD CONSTRAINT chk_expense_pct          CHECK (my_pct >= 0 AND my_pct <= 1);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.rates_cache      ADD CONSTRAINT chk_rates_value_pos      CHECK (rate_value > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
```

Then: add it as migration **18** in `PROJECT_STATUS.md`'s SQL list, owner runs it.

**Verify:** re-run the file (idempotent — completes clean); try inserting a negative
income in Supabase table editor → must be rejected with `chk_income_amount_pos`.

**Do not** add a CHECK on `sadaka_entries.status` — the trigger and app write several
values (`pending/advance_given/partially_given/given`); freezing them without a full
sweep risks breaking the trigger. Skip deliberately.

### FIX-05 · Remove `ignoreBuildErrors` (it is no longer load-bearing)
**Severity:** HIGH (durability) · **Model:** Haiku · **File:** `next.config.ts`

`tsc --noEmit` is 0 errors (verified). While `typescript: { ignoreBuildErrors: true }`
stays, any type error a future (weaker) model introduces ships to production silently.
Delete that line. **Verify:** `npm run build` → completes green. If it fails, the
build output lists real errors — fix those, don't restore the flag.

### FIX-06 · Make the tests runnable forever: pin `tsx`, add `npm test`
**Severity:** HIGH (durability) · **Model:** Haiku · **File:** `package.json`

Verified: `tsx` is **not** in devDependencies; the documented test commands only work
via npx's remote fetch (fails offline / registry drift / years later).
1. `npm install --save-dev --save-exact tsx` (sanctioned exception to the no-deps rule;
   dev-only, never ships to the client bundle).
2. Add script: `"test": "tsx src/lib/sadaka.test.ts && tsx src/lib/lifeMath.test.ts && tsx src/lib/hijri.test.ts"`.
3. `MAINTENANCE.md`: add "run `npm test` after ANY code change — all three must pass."

**Verify:** `npm test` → three ✓ lines, exit 0.

### FIX-07 · Shared income counted at 100% in EACH brother's personal cash — OWNER DECISION
**Severity:** HIGH (correctness of the hero number) · **Model:** Sonnet *after the owner answers* · **File:** `dashboard/page.tsx`

Verified inconsistency: `myIncome` includes `ownership === 'shared'` rows at **full
amount** for **both** brothers (`i.ownership === 'shared' || i.ownership === myOwnership`),
while the sadaka trigger (`sadaka-trigger-v2.sql`) correctly splits shared income
**50/50** (`NEW.amount * 0.5 * prof.pct`). So a shared 10,000 shows as +10,000 cash
*in each* dashboard (20,000 of perceived cash from 10,000 real), each carrying only
his 50% sadaka obligation.

**Ask the owner:** "Shared income on the dashboard: count 50% per brother
(recommended — matches the sadaka split and physical reality), or keep 100% for both
(current)?" If 50%: multiply shared rows by 0.5 in `totalReceived` and `awaitingAed`
only (do NOT touch the Income page listing — it's a record, not a cash model).
Label the hero footnote `shared income counted at your half`.

### FIX-08 · Zakat page hardening (stale rates can flip a fiqh verdict)
**Severity:** HIGH · **Model:** Sonnet · **File:** `src/app/(app)/zakat/page.tsx`

1. **Stale-rate banner** (mirror the dashboard's): after `load()`, if the newest
   `rates_cache.updated_at` is older than 7 days, render an amber banner above the
   calculator: *"Rates last updated N days ago — nisab may be off. Refresh via
   Settings → Currencies."* (After FIX-01 lands, `updated_at` is finally meaningful.)
2. **`snapshot_year` robustness**: replace the fragile
   `toLocaleDateString('en-GB',{year:'numeric',calendar:'islamic'}).split('/').pop()`
   with `formatToParts`:
   ```ts
   const year = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { year: 'numeric' })
     .formatToParts(new Date()).find(p => p.type === 'year')?.value ?? '1447'
   ```
   (Guarantees digits-only; the current string can carry an " AH" suffix depending on
   runtime — which would corrupt the `UNIQUE (owner_id, snapshot_year)` key space.)
3. **`markPaid` error surfacing**: capture `{ error }` and show a toast/inline message
   on failure (currently silent).

**Verify:** `npm test` (untouched libs still pass); on localhost, calculate → save
snapshot → row's `snapshot_year` is pure digits; temporarily set a rates row
`updated_at` 8 days back in the table editor → banner appears.

---

## 5. P2 — MEDIUM (paper cuts; batch into one session)

| ID | Finding (verified) | Fix | Model |
|---|---|---|---|
| P2-09 | `formatCurrency` compact: `1_500_000` renders `1500K` | Add M tier: `>= 1_000_000 → (n/1e6).toFixed(1)+'M'` in `utils.ts` | Haiku |
| P2-10 | `proxy.ts` matcher doesn't exclude `/api` → logged-out API calls get a 307-to-login HTML instead of JSON 401 | Leave the matcher (session-refresh side effect is useful); ensure every **new** API route self-guards like `/api/rates` does. Documentation-only: add comment in `proxy.ts`. | Haiku |
| P2-11 | No CSP header (`next.config.ts` has the legacy `X-XSS-Protection` instead) | Add `Content-Security-Policy-Report-Only` first: `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https://*.supabase.co; font-src 'self' data:`. Watch console for a week; then enforce. Never ship enforcing CSP untested — a blocked Supabase call = dead app for 2 users with no dev. | Sonnet |
| P2-12 | `next-pwa` in dependencies but never imported (`next.config.ts` doesn't use it; SW registered manually) | Flag to owner: `npm uninstall next-pwa` (removes ~0 risk, shrinks install). Do only with owner's go-ahead per no-dep-changes rule. | Haiku |
| P2-13 | Month boundary uses server TZ (Vercel = UTC) vs users in UAE (UTC+4): entries logged 00:00–04:00 Gulf time land in the "wrong" month view | Accept + document (2-user app; cosmetic). Add code comment at `monthStart` in dashboard. | Haiku |
| P2-14 | `validateAmount` cap is 10M — fine for AED, but PKR incomes can legitimately exceed it (10M PKR ≈ AED 132k) | Raise cap to 100M **for PKR only**: pass currency into `validateAmount(raw, currency?)`, keep 10M default. Update all call sites (grep `validateAmount(`). | Sonnet |

---

## 6. Durability engineering — the "unattended years" checklist

**Researched, current as of 2026-07:** Supabase **free-tier projects pause after ~7
days of database inactivity** (compute stops; data preserved; manual dashboard restore,
cold start up to ~60s). Long-paused free projects are subject to eventual cleanup —
**the owner must either upgrade to Pro or keep a heartbeat**. Sources:
[Supabase docs — pausing](https://supabase.com/docs/guides/troubleshooting/pausing-pro-projects-vNL-2a),
[supabase-pause-prevention (GitHub)](https://github.com/travisvn/supabase-pause-prevention),
[GitHub-Actions keep-alive pattern](https://dev.to/jps27cse/how-to-prevent-your-supabase-project-database-from-being-paused-using-github-actions-3hel).

| # | Time-bomb | Detection (no dev needed) | Mitigation (this plan) |
|---|---|---|---|
| 1 | Supabase pauses after 7 idle days | Login fails / "Failed to fetch" (already happened once — 2026-06-22 rebuild) | Owner: GitHub Action cron (twice-weekly REST ping) **or** Supabase Pro. See FIX-15. |
| 2 | FX/metals APIs die or change shape | Dashboard + Zakat stale banners (FIX-01/FIX-08) | Clamps reject garbage; manual PKR override in Settings survives all API deaths (FIX-01 step 5). |
| 3 | A future edit introduces a type error | Build fails loudly (FIX-05) instead of shipping broken | `npm test` gate (FIX-06). |
| 4 | Bad row poisons every sum | Impossible at DB level after FIX-04 | CHECK constraints. |
| 5 | Disaster recovery loses a table | `npm run backup` row-count vs. dashboard | FIX-03 + quarterly backup reminder already in MAINTENANCE.md. |
| 6 | `npm update` / Node major bump breaks the frozen stack | — | Already documented ("don't npm update"); lockfile committed. Never touch `next`/`react` versions. |
| 7 | Vercel subdomain (`fin9-ivory.vercel.app`) | None needed — no custom domain to expire | Keep it; do not buy a domain that can lapse. |

### FIX-15 · Supabase heartbeat (owner-deploy, zero-dependency)
**Model:** Haiku creates the file; owner enables it in the GitHub repo.
Create `.github/workflows/keepalive.yml`:
```yaml
name: supabase-keepalive
on:
  schedule: [{ cron: '0 6 * * 1,4' }]   # Mon+Thu 06:00 UTC — well inside the 7-day window
  workflow_dispatch: {}
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Ping database (counts as DB activity)
        run: |
          curl -sf "${{ secrets.SUPABASE_URL }}/auth/v1/health" \
            -H "apikey: ${{ secrets.SUPABASE_ANON_KEY }}" > /dev/null
```
Owner adds repo secrets `SUPABASE_URL`, `SUPABASE_ANON_KEY` (anon key only — safe;
RLS still applies). If the health endpoint doesn't register as *database* activity,
switch the curl to a REST select on a table with an anon-readable policy — executor:
test once via `workflow_dispatch` and confirm the Supabase dashboard's activity graph
moved. **Verify:** Actions tab → manual run → green.

---

## 7. Execution order & session plan

| Session | Tasks | Model | Preconditions |
|---|---|---|---|
| 1 | FIX-03 (backup tables) → FIX-05 (build errors) → FIX-06 (tsx + npm test) | Haiku | none |
| 2 | FIX-01 (rates pipeline) | Sonnet | Vercel env has `SUPABASE_SERVICE_ROLE_KEY` (owner confirms) |
| 3 | FIX-02 (currency symmetry) | Sonnet | FIX-01 merged (needs live `pkrToAed`) |
| 4 | FIX-04 (SQL file) + FIX-15 (workflow file) | Haiku (files) + **owner runs both** | — |
| 5 | FIX-07 (owner decision) + FIX-08 (zakat) | Sonnet | Owner answered FIX-07 question |
| 6 | P2 batch (09–14) | Haiku/Sonnet per table | all P0/P1 landed |

Per-session close-out ritual: `npm test` ✓ → `npm run build` ✓ → commit (one task per
commit, message `fix(scope): <FIX-ID> <one-liner>`) → push → update
`PROJECT_STATUS.md` changelog → append `SESSION_LOG.md`.

---

## 8. Explicitly NOT in scope (do not let a future session scope-creep these in)

- Wasiyya encryption, 2FA, audit-trail table, family mode, i18n, App Store — all
  tracked in `LAUNCH.md`, all owner-initiated only.
- Any rewrite of `computeSadaka` / Life / Hijri math.
- Any new runtime dependency. Any framework upgrade. Any folder restructure.
- Web-push notifications (`.ics` route preferred per PROJECT_STATUS roadmap).

*Audit performed 2026-07-02 — 25+ source files, all 18 SQL migrations, RLS policies,
scripts, and all three self-check suites read/executed. Every finding cites its
evidence; nothing herein is speculative.*
