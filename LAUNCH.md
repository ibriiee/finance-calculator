# LAUNCH.md — Deferred Upgrades & Future Roadmap

This file tracks improvements that are intentionally deferred.
Not forgotten — parked until needed or prioritised.

---

## DATABASE
- [x] ~~Performance indexes~~ — **Done 2026-06-30** (`supabase/performance-indexes.sql`, run in Supabase)

---

## SECURITY (post-launch)

- [ ] **Encrypted Wasiyya vault** — AES-256 + user passphrase, client-side only.
      Currently stores bank details/passwords in plaintext. Gate behind a "beta" flag
      until properly implemented.
- [ ] **2FA + session management** — TOTP via Supabase Auth, session timeout after
      15min idle, "active sessions" list, revoke-all for lost device.
- [ ] **Encrypted backup export** — optional AES-256 password on the JSON backup file
      downloaded from Settings → Data Backup. Add warning: "This file contains sensitive
      financial data — store securely."
- [ ] **Rate-limit /api/rates** — add Supabase Auth check + 1-req/user/min via Upstash
      or a Supabase Edge Function rate-limiter. Prevents external API quota exhaustion.

---

## DATA INTEGRITY

- [ ] **Audit trail** — `audit_log` table: entry_id, table_name, old_value, new_value,
      changed_by, changed_at. Add DB trigger on sadaka_entries, income_projects, loans.
      Required for Zakat compliance documentation and any future tax/legal review.
- [ ] **Partial loan repayments UI** — "Add Repayment" button on each loan card.
      Inserts into `loan_repayments`, then auto-updates `loans.status`:
        - total_repaid >= original_amount → 'cleared'
        - total_repaid > 0 → 'partial'
      Currently only "Mark Cleared" button exists (all-or-nothing).
- [ ] **Optimistic lock on shared ledger/loans** — prevent race condition when both
      brothers settle the same entry simultaneously. Add `updated_at` check on update:
      `.update(...).eq('updated_at', lastKnownTimestamp)`.

---

## AI FEATURES (when ready to integrate Claude API)

- [ ] **AI Monthly Financial Summary** — end-of-month: plain-English summary of
      income received, sadaka given vs. due, zakat position, loans outstanding.
      Islamic lens — no interest instruments, sadaka framing.
      Delivery: in-app notification or email (whichever is easier at the time).
- [ ] **AI Sadaka Insights** — "You've given sadaka to the same 2 people for 3 months.
      Have you considered others?" Pattern analysis, not lecturing.
- [ ] **Smart debt prioritisation** — analyse loans + ledger + sadaka together and
      suggest what to pay first based on Islamic priority (sadaka > qard hasan).

---

## UX IMPROVEMENTS

- [x] ~~Offline form persistence~~ — **Done 2026-06-30** (SadakaForm + IncomeForm, `localStorage` draft)
- [x] ~~Life room: quick-edit event from grid~~ — **Done 2026-06-30** (pencil → `/life/settings?edit=<id>`)
- [x] ~~Brother ledger: Reverse entry~~ — **Done 2026-06-30** (Reverse button on each unsettled entry)
- [x] ~~Loan partial repayment progress bar~~ — **Done 2026-06-30** (progress bar + inline Log Repayment form, auto-sets partial/cleared)
- [x] ~~Stale rates warning banner~~ — **Done 2026-06-30** (Dashboard banner when rates_cache >24h old)
- [ ] **Pagination on long lists** — Income, Sadaka, Loans, Recipients all do SELECT *.
      Add `.limit(50)` + "Load more" when each module has 50+ entries. Low priority until 100+ entries exist.

## UI REDESIGN — Next session priority

Three targeted changes that fix 80% of the UX feel (no data changes, CSS/layout only):

- [ ] **Left-border status system** — Replace status badges on all list cards with a
      3px coloured left border: gold = pending/obligation, green = done/given, red = overdue.
      Instant scannability without reading every badge. Apply to: Sadaka, Income, Loans, Ledger.
- [ ] **Collapsible "Advanced" in forms** — Show 3 primary fields first (Amount, Status/Type,
      Recipient). All secondary fields (income linking, on-behalf, advance flag, location,
      method, notes) collapse under an "Advanced ▾" toggle. Reduces overwhelm on mobile.
      Apply to: SadakaForm, IncomeForm, LoanForm.
- [ ] **Dashboard hero flip** — Move "Yours to Keep" to the TOP as the large number.
      Make the waterfall deductions a collapsible "How is this calculated ▾" below it.
      Currently the most important number is at the bottom after 4 lines of deductions.

---

## FAMILY / MULTI-USER (if/when wives or others need access)

Current architecture is hardcoded for 2 users (ibrahim + abu_bakar). If expanding:

- [ ] Add `household_id` column to all shared tables (brother_ledger, shared_costs,
      joint_accounts, life_events).
- [ ] Settings → "Invite user" flow — generate a Supabase invite link for a new email.
- [ ] RLS policies switch from 2-user hardcoded to `household_id`-scoped.
- [ ] Income remains personal; sadaka, loans, ledger become household-visible.
- [ ] Limit: settings should cap household at 5 users for simplicity.

> Note: Do NOT start this until the 2-user flow is fully stable. Multi-user is an
> architecture rewrite of all RLS policies, not an additive feature.

---

## INTERNATIONALISATION (future market expansion)

- [ ] Arabic UI + RTL layout (unlocks Gulf + MENA market)
- [ ] Urdu UI (Pakistan/diaspora)
- [ ] Additional currencies: SAR, GBP, USD, EUR, MYR, BDT
- [ ] Hijri-native mode: show Hijri dates as primary throughout the app,
      not just in Life Tracker and sadaka export

---

## APP STORE / DISTRIBUTION

- [ ] Native app via Capacitor (wraps existing PWA, submits to iOS App Store + Google Play)
- [ ] Landing page at mizan.app (or similar) with feature overview + pricing
- [ ] Pricing model: free for 2 users (personal), $5/mo for family plan (up to 5 users)

---

_Last updated: 2026-06-30_
_Owner: Ibrahim_
