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
| Settings | `/settings` | ✅ | Currency, nisab basis, **module on/off toggles**, sadaka %, hawl, notifications |

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

## Roadmap / TODO
- [ ] Analytics/charts: doughnut/rings, monthly earning vs sadaka trends, breakdowns.
- [ ] When income amount is edited, adjust the linked sadaka obligation (trigger is insert-only today).
- [ ] Gate dashboard tiles (Loans/Splits/Wasiyya/Joint) by module toggles (nav already gated).
- [ ] Wasiyya rethink (user unhappy with current shape).
