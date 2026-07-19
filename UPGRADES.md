# Mizan — Upgrade Roadmap (2026-07-18)

Built from three inputs: a full walkthrough-audit of all 16 modules, the app's own history
(PROJECT_STATUS.md, both CTO audits), and research on the current best-in-class apps —
Splitwise / Tricount / Settle Up (shared expenses), Monarch / YNAB / Copilot (personal finance),
Zoya / Musaffa / Wahed (Islamic finance).

**Ground rules respected throughout:** no new dependencies without owner sign-off, must survive
2–5 years unattended (no services that decay), 2 known users — no multi-tenant complexity.

Legend: **P0** = fixes a real gap users will hit (like the Joint edit bug) · **P1** = high-value
upgrade · **P2** = nice-to-have · ⚠ = needs a dependency or external service — flag before building.

---

## A. Consistency & trust — every record must be editable (P0) — ✅ DONE 2026-07-18 (except #10 wasiyya, deferred to its rethink; see UPGRADE-PLAN.md Phase 1)

The Joint Account bug fixed today (no edit/delete on transactions) exists in the same form in
half the modules. Rule going forward: **every row a user can create, they can edit and delete**,
with received/given locking where it exists today.

1. **P0 Goals: edit + delete a goal** — currently a goal, once created, is permanent. No rename, no target change, no removal.
2. **P0 Goals: edit + delete a contribution** — a typo'd contribution amount is permanent and poisons the progress bar forever.
3. **P0 Ledger: edit an IOU entry** — delete exists, edit doesn't; fixing a wrong amount means delete + retype.
4. **P0 Loans: edit a loan** — can't correct lender name, amount, or date after creation.
5. **P0 Loans: edit/delete a repayment** — a mistyped repayment can only be fixed by deleting the whole loan.
6. **P0 Savings: edit a stash entry** — delete-only today, same class of gap.
7. **P0 Recipients: edit + delete a recipient** — names, locations, contacts change; today the directory only grows.
8. **P0 Zakat: delete a snapshot** — a bad year-snapshot (wrong assets entered) is stuck; upsert overwrites but the year key means a test entry pollutes history.
9. **P0 Joint: edit + deactivate an account** — rename a joint account, fix its bank name, or archive it when closed.
10. **P0 Wasiyya: full CRUD pass** — module is flagged "user wants rethink"; whatever the rethink is, it must ship with edit/delete from day one.

## B. Direction clarity — no ambiguous money movement (P0/P1) — ✅ #11–12 DONE 2026-07-18 (13–15 in Phase 5 / rolling)

Same idea as today's green/red TxnForm fix, applied everywhere money has a direction.

11. **P0 Savings form: green/red deposit-vs-withdraw treatment** — identical pattern to the Joint TxnForm fix (colored type buttons, signed amount, colored submit).
12. **P0 Ledger form: "who owes whom" visual** — arrows + names ("You → Abu Bakar" red, "Abu Bakar → You" green) instead of abstract from/to.
13. **P1 Expenses form: red framing for outflow** — consistent with the new visual language.
14. **P1 Income form: green framing for inflow** — same.
15. **P1 Signed, colored amounts everywhere** — every list row app-wide shows +green / −red consistently (audit found most do; make it a rule, catch stragglers).

## C. Navigation & structure (P1) — ✅ #16, #17, #18 DONE 2026-07-19 (see UPGRADE-PLAN.md Phase 2)

16. **P1 "All modules" hub screen** — nav caps at 3 module tabs + Home + Settings; Joint, Ledger, Goals, Loans, Savings, Zakat, Wasiyya, Analytics, Recipients hang off dashboard cards only. One tappable grid screen (a la banking apps' "More") makes everything reachable in 2 taps, always.
17. **P1 Choose your own 3 nav tabs** — Settings picker for which finance modules sit in the bottom bar (the ROOMS structure already supports it; today the first 3 enabled win silently).
18. **P1 Global floating "+" (quick add)** — one FAB on dashboard opening a sheet: Expense / Income / Sadaka / Joint txn / IOU. Modern apps live and die by add-speed; today every add is 2–3 taps deep inside a module.
19. **P2 Swipe between modules** — horizontal swipe on module pages to move through the nav order (native-app feel).
20. **P2 Back-to-top + pull-to-refresh** on long lists (income, sadaka histories).
21. **P2 Remove dead `/splits` page from the bundle** — deprecated and unlinked; data stays in DB, page file moves to an archive folder (keeps history, trims bundle).

## D. Entry speed & intelligence (P1) — ✅ #22, #24 DONE 2026-07-19 · #25 deferred (migration; UPGRADE-PLAN.md Phase 6)

What Copilot/Tricount get right: adding a record takes < 5 seconds.

22. **P1 Remember last-used values per form** — expenses form pre-picks your last category/currency; joint TxnForm pre-picks your usual type.
23. **P1 Amount keypad shortcuts** — +100 / +500 / +1k chips under amount fields (groceries and pocket-money amounts repeat constantly).
24. **P1 Recent-entries duplicate** — "same as last time" on expenses (Du bill, petrol) clones the row with today's date.
25. **P1 Recurring expenses** — mark rent/Du/subscriptions as monthly; the app pre-creates a pending row each month you confirm with one tap (no cron needed — computed on page load).
26. **P1 Description autocomplete** — suggest from your own past descriptions (PTCL, Mama pocket money…) — pure client-side, no dep.
27. **P2 Natural date entry** — "yesterday / 2 days ago" chips next to the date field.
28. **P2 Calculator in amount field** — type `1200+350` and it evaluates (tiny parser, no dep).
29. **P2 Voice note on any record** — attach a short audio memo (Supabase storage) for context that's faster spoken than typed.
30. **P2 Bulk import CSV** — paste bank-statement rows into a mapping screen for backfilling history.

## E. Dashboard & insight (P1) — ✅ #31, #32, #34 DONE 2026-07-19 · #33 deferred (Phase 6)

31. **P1 Spending by category this month** — the dashboard shows totals but not *where* money went; a 5-bar mini breakdown (rent/food/transport/…) answers the #1 finance-app question.
32. **P1 Month-over-month deltas** — "Expenses ↑ 12% vs last month" one-liners on the hero card (Monarch's most-loved surface).
33. **P1 Sadaka streak / consistency card** — months in a row where all owed sadaka was paid; leverages the app's core purpose.
34. **P1 Upcoming obligations strip** — one horizontal strip merging: sadaka owed, zakat due date, loan repayment intent, goal deadlines. Today these live in 4 different cards.
35. **P2 Net worth line** — savings + stash + owed-to-you − debts over time, one sparkline (analytics has pieces; dashboard needs the one number).
36. **P2 Widget-style compact mode** — a `?compact=1` dashboard variant with just Yours-to-keep + owed items, for a PWA shortcut tile.
37. **P2 Configurable card order** — drag dashboard cards into your own order (localStorage).
38. **P2 "This week" digest view** — 7-day activity feed across all modules (what got added/paid, by whom).

## F. Islamic core — deepen the differentiator (P1) — ✅ #40, #42, #44 DONE 2026-07-19 · #39/#43 advisor-cut, #41 deferred, #47 skipped by owner (details + links: UPGRADE-PLAN.md Phase 4)

Research note: Zoya/Musaffa win by making the Islamic layer *primary*, not bolted on. Mizan's
sadaka engine already beats anything on the market for this use case; these extend that lead.

39. **P1 Zakat: full hawl tracking per asset** — anniversary-aware zakat (each asset's own lunar year) using the existing `hijri.ts`; today's snapshot model is Gregorian-year keyed.
40. **P1 Zakat due date on the Life grid + dashboard countdown** — "23 days to Zakat" chip; hijri_yearly event exists, surface it in Finance too.
41. **P1 Sadaka percentage per income stream** — different niyyah percentages for different income types (project vs salary) instead of one global %.
42. **P1 Ramadan mode** — during Ramadan (hijri.ts knows), dashboard surfaces a daily-sadaka prompt and tracks the 30-day giving pattern (last-10-nights emphasis).
43. **P1 Qard Hasan etiquette on loans** — optional intended-repayment date + gentle overdue state framed Islamically (no interest, ever — it's a virtue tracker, not a penalty tracker).
44. **P2 Nisab threshold alert** — when savings+stash cross the silver nisab, tell the user their hawl clock may have started.
45. **P2 Sadaqah jariyah tagging** — mark sadaka entries as jariyah (well, Quran, tree…) and show a lifetime jariyah portfolio view.
46. **P2 Zakat al-Fitr checklist** — per-household-member fitrana line auto-appearing in Ramadan's last week.
47. **P2 Islamic will (wasiyya) rework as guided flow** — step-by-step faraid-aware structure (the flagged rethink): assets → debts → bequests (≤⅓ rule surfaced) → witnesses, with print/PDF export.
48. **P2 Dua/intention field on goals** — a goal can carry its niyyah; shown on completion.
49. **P2 Hijri-first date display option** — app-wide toggle: show hijri dates as primary with Gregorian secondary (all math exists in hijri.ts).

## G. Two-person / household features (P1) — ✅ #50, #52, #55(joint) DONE 2026-07-19 · #53 advisor-cut (see UPGRADE-PLAN.md Phase 3)

Splitwise/Tricount research: the killer features are activity feeds, comments, and settle-up flows.

50. **P1 Activity feed** — "Abu Bakar added PKR 20k Ashoora Day expense · 2h ago" — one chronological list across joint account, ledger, loans (both users see everything; realtime already exists on joint).
51. **P1 Comment/note thread on joint txns** — a one-line reply field ("this includes the gas bill?") beats a WhatsApp side-channel; single table, realtime.
52. **P1 Settle-up suggestion on Joint fairness** — the "owes PKR 2,471 to be equal" banner gets a button: one tap records the equalizing chip-in (Splitwise's signature flow).
53. **P1 Ledger ⇄ Joint awareness** — if Ibrahim pays a house expense from his own pocket, offer "record as: joint withdrawal + IOU" in one action instead of two modules.
54. **P2 Monthly household statement** — auto-composed monthly summary (contributions, expenses by category, fairness) as shareable text/PDF — extends the existing WhatsApp-export pattern.
55. **P2 Who-added-what attribution everywhere** — loans has "Added by X"; joint txns/ledger entries should show it too (created_by_id already stored).
56. **P2 Nudge button** — on an unequal joint balance, a one-tap "remind Abu Bakar" that composes the WhatsApp message.

## H. PWA & platform polish (P1)

57. **P1 Offline read cache** — service worker caching of last-loaded data so opening the app in a dead zone shows last-known balances (sw.js exists; extend it).
58. **P1 Add-to-homescreen shortcuts** — PWA `shortcuts` in manifest.json: "Add expense", "Add joint txn", "Sadaka" long-press menu items.
59. **P1 .ics calendar feed** — already on the Life roadmap; extend to finance: zakat date, loan intents, goal deadlines. Free, no push infra, survives unattended years.
60. **P2 Haptic feedback on save** — `navigator.vibrate(10)` on successful save; tiny native-feel win.
61. **P2 Skeleton loaders** — replace spinner-only loads with content-shaped skeletons on dashboard/income (perceived speed).
62. **P2 iOS/Android splash + themed status bar audit** — verify PWA meta tags render clean on both users' phones.
63. **P2 Font/asset self-hosting audit** — confirm zero external CDN requests so the app still loads in 2028 (longevity rule).
64. ⚠ **P2 Web-push notifications** — only if .ics proves insufficient (existing roadmap stance; adds a dep).

## I. Data safety & longevity (P1)

65. **P1 One-tap JSON backup reminder** — quarterly gentle banner "Last backup: 94 days ago" (backup exists; nobody remembers to run it).
66. **P1 Supabase keepalive confirmation surface** — settings shows last keepalive ping so the 2-year-pause risk is visible in-app.
67. **P1 Exchange-rate manual override UX** — the stale-rate warning links to a one-field "set today's rate" (API route exists at /api/rates/manual; surface it).
68. **P2 Undo toast after delete** — 5-second "Undo" before the row actually deletes (soft-delete then hard-delete) — safer than confirm() dialogs and faster.
69. **P2 Restore from JSON in-app** — restore script exists (scripts/restore.mjs) but requires a computer; an in-app import closes the loop.
70. **P2 Data export per module** — CSV export button pattern from Sadaka replicated on expenses, joint, ledger.
71. **P2 Audit log table** — append-only log of who changed/deleted what (now that everything is editable, trust needs a trail; cheap: one trigger).
72. **P2 Yearly archive view** — "2026 closed year" snapshot pages so old data stays fast and browsable.

## J. Analytics upgrades (P2)

73. **P2 Expense category trends** — stacked monthly bars by category (data exists; one chart).
74. **P2 Sadaka by recipient over time** — who has received what across the year (recipients page has totals; add the time axis).
75. **P2 Income source breakdown** — per-client/per-source share of yearly income.
76. **P2 Joint account monthly in/out chart** — contribution rhythm visualization.
77. **P2 Zakat year-over-year** — wealth + zakat trend across snapshot years.
78. **P2 Best/worst month cards** — highest income month, highest expense month, most generous month.

## K. UX detail polish (P2)

79. **P2 Empty states with action buttons** — every EmptyState gets its "Add first X" button (some have it, some don't).
80. **P2 Confirm dialogs → styled sheet** — replace browser `confirm()`/`alert()` with the app's own FormSheet-styled dialog (browser chrome breaks the premium feel).
81. **P2 Currency symbols in inputs as you type** — live-format `20000` → `20,000` in amount fields.
82. **P2 Search within module histories** — filter box on income/sadaka/expenses lists (client-side).
83. **P2 Date-range filter on histories** — "Jul · Jun · May · All" chips on transaction lists.
84. **P2 Tap amount to toggle currency view** — tap any AED amount to see PKR equivalent inline (rate cached already).
85. **P2 Landscape/tablet layout pass** — cards to 2-column grid ≥768px (both users occasionally on tablets/desktop).
86. **P2 Reduce-motion respect** — honor `prefers-reduced-motion` for the pulse/slide animations.
87. **P2 Larger touch targets audit** — new joint edit/delete icons are 24px; bump all icon buttons to ≥40px hit area via padding.
88. **P2 Form field labels** — placeholder-only inputs (amount, description) get tiny persistent labels; placeholders vanish on type.
89. **P2 Keyboard type hints** — `inputMode="decimal"` on all amount fields so phones open the number pad.
90. **P2 Consistent module header actions** — every module: title left, primary action right, same button style (joint/income differ today).

## L. Bigger bets (P2/⚠ — each needs a decision first)

91. **P2 Monthly budget envelopes** — YNAB-style per-category monthly limits with progress bars; biggest single missing "finance app" feature, but adds ongoing upkeep — decide deliberately.
92. **P2 Receipt photo attachments** — Supabase storage + camera capture on expenses/joint (Splitwise Pro's most-used feature). Storage quota is the risk on free tier.
93. ⚠ **P2 AI expense categorization** — Copilot's differentiator; needs an API key + cost + drift risk. Against the longevity rule — probably permanently out, listed for completeness.
94. **P2 Gold/silver holdings tracker** — grams held per person feeding zakat automatically (rate API exists with fallback).
95. **P2 Investment/asset register** — simple list of halal assets (plots, business shares) with zakat-eligibility flags; NOT live market data (decays).
96. **P2 Wife/family member as third profile** — flagged on Life roadmap; touches RLS everywhere, do as its own project.
97. **P2 Hajj savings goal template** — goal preset with cost estimate fields and dua; goals + Islamic layer meeting point.
98. **P2 Inheritance calculator (faraid)** — pure-math module complementing wasiyya; no external data, ages well.
99. **P2 Debt-free plan view** — order loans by intent date, show projected debt-free date on a timeline.
100. **P2 "Mizan Score" monthly reflection** — one composite monthly view: earned, kept, given, owed — framed as muhasabah (self-accounting), the app's philosophical close.

---

## Suggested sequence

1. **Batch 1 (P0, ~1 session):** items 1–12 — full CRUD + direction-clarity parity across all modules. Kills the entire "shitty problems" class the Joint bug came from.
2. **Batch 2 (P1 nav+speed):** 16–18, 22–26 — hub screen, custom tabs, quick-add, entry speed.
3. **Batch 3 (P1 insight+household):** 31–34, 50–53 — dashboard breakdowns, activity feed, settle-up.
4. **Batch 4 (P1 Islamic):** 39–43 — hawl-aware zakat, Ramadan mode, per-stream sadaka %.
5. Everything else on demand, P2s as filler in feature sessions.
