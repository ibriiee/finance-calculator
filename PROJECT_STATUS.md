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
| Dashboard | `/dashboard` | ✅ | Summary cards + quick links (icons, no emoji) |
| Income | `/income` | ✅ | Individual. Start date, ongoing flag, edit/delete, per-entry **sadaka-paid status**. Editing does NOT re-trigger sadaka (insert-only trigger) |
| Sadaka | `/sadaka` | ✅ v2 | Auto-obligation from income, advance netting, AED/PKR + joint totals, on-behalf w/ attribution |
| Recipients | `/recipients` | ✅ | Directory of sadaka recipients; total received, last paid, overdue→prioritise flags, **WhatsApp export**. Linked from Sadaka + selectable in SadakaForm |
| Brother Ledger | `/ledger` | ✅ | IOU between brothers; fixed profile-read RLS hang |
| Joint Account | `/joint` | ✅ | House account: deposits/withdrawals, balance, equal-share fairness, AED↔PKR, realtime |
| Zakat | `/zakat` | ✅ | Silver nisab active (+gold ref), assets−liabilities, pay-by date, yearly paid log |
| Goals | `/goals` | ✅ basic | Individual/joint goals, contributions |
| Loans | `/loans` | ✅ basic | Qard Hasan tracking |
| Splits | `/splits` | ✅ basic | Shared costs |
| Wasiyya | `/wasiyya` | ✅ basic | Digital will vault (user wants rethink) |
| Analytics | `/analytics` | ✅ | Custom SVG charts: sadaka-vs-earnings donut, 6-month earned/sadaka bars, sadaka-by-location donut, stat tiles |
| Settings | `/settings` | ✅ | Currency, nisab basis, module toggles, sadaka %, hawl, notifications, **test mode**, **data backup (JSON export) + reset** |

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
10. `sadaka-trigger-v2.sql` — **NOT YET RUN** — shared income splits sadaka 50/50 (one entry per
    brother at his own pct); editing income amount adjusts linked not-yet-given sadaka

---

## Key technical notes
- Next.js 16: auth middleware is `src/proxy.ts` (`export async function proxy`), NOT middleware.ts.
  Its matcher must exclude `avatars`, static, manifest, sw.js.
- `next.config.ts` has `typescript.ignoreBuildErrors: true` (Supabase generic inference returns `never`).
- Service worker `public/sw.js` is **network-first** (no stale cache).
- **Encoding:** never bulk-edit files with PowerShell `Set-Content -Encoding utf8` — it mangles
  emojis/special chars into mojibake. Use the Edit/Write tools (UTF-8 safe).
- FX: `rates_cache` table holds `pkr_to_aed`, `gold_aed_gram`, `silver_aed_gram`, etc.
- Sadaka netting: pending = max(0, Σowed − Σgiven); advance = max(0, Σgiven − Σowed).

---

## Changelog (newest first)
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

## Open items / session handoff (2026-06-10)
- ✅ **Both users log in** (Ibrahim + Abu Bakar).
- ✅ All 360-review bugs fixed and deployed (commit `3c07126`, live at `fin9-ivory.vercel.app`).
- ✅ Migrations 1–9 run in Supabase.

## Roadmap / TODO
- [ ] **Run `supabase/sadaka-trigger-v2.sql` in Supabase SQL Editor** (shared-income 50/50 sadaka
      split + edit-amount adjustment trigger). Safe to re-run.
- [ ] **Get a free goldapi.io key** → set `GOLD_API_KEY` in `.env.local` AND Vercel env vars.
      Until then, fallback rates are used (gold AED 472/g, silver AED 5.9/g).
- [ ] Wasiyya rethink (user unhappy with current shape — deferred).
- [ ] Real push/email notifications via Supabase Edge Functions (toggles removed until implemented).
