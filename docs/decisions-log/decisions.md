# Decisions Log — Mizan

> Running log of every significant decision made during the project, with rationale.
> Never delete entries — mark superseded decisions as [SUPERSEDED] instead.

---

## Format
Each entry: Decision → Options considered → Choice → Reason → Date

---

## PRODUCT DECISIONS

### DEC-001 — App Name
- **Options:** "Finance Calculator" / "Mizan" / "Barakah"
- **Choice:** Mizan (ميزان)
- **Reason:** Arabic for "balance/scale" — directly relevant to financial balance, Islamic in origin, short, memorable, brandable. "Finance Calculator" is descriptive but not a product name.
- **Date:** 2026-06-07

### DEC-002 — Target Users
- **Options:** Public app / Two specific users only / Family app
- **Choice:** Two specific users (Ibrahim + Abu Bakar) with future expansion path
- **Reason:** Build for the real problem first. Over-engineering auth for multiple users before the core is proven is wasted effort.
- **Date:** 2026-06-07

### DEC-003 — MVP Module Set
- **Options:** Build all 10 modules at once / Build the most-used 3 first
- **Choice:** Phase 3 MVP = Auth + Dashboard + Income + Brother Ledger
- **Reason:** These 3 modules solve the biggest daily pains (payment lag + WhatsApp chaos). Sadaka and Zakat are important but not daily-use features.
- **Date:** 2026-06-07

### DEC-004 — Sadaka as Core, Not Feature
- **Options:** Add Sadaka as a filter/tag on transactions / Build it as its own module with full lifecycle
- **Choice:** Full module with own lifecycle (pending/advance/partial/given states)
- **Reason:** The Sadaka self-tax is the most unique and personal aspect of these users' financial practice. Treating it as a tag would lose the advance-Sadaka and joint-Sadaka functionality.
- **Date:** 2026-06-07

### DEC-005 — Loan Repayment Rule by Currency Type
- **Options:** Always use today's exchange rate / Always use original rate / Differentiate by loan type
- **Choice:** Differentiate by type: Cash loans return same face value; Gold/commodity loans return same quantity at today's price
- **Reason:** This is the Islamic Qard Hasan principle. Cash: return the unit (1 PKR = 1 PKR). Commodity: return the commodity (2g gold = 2g gold at today's rate). This is confirmed by Islamic finance sources.
- **Date:** 2026-06-07

### DEC-006 — Individual vs Shared Data Visibility
- **Options:** All data shared between both users / All data private / Hybrid (explicit sharing)
- **Choice:** Hybrid: shared modules (Brother Ledger, Shared Goals, Shared Splits) visible to both; individual data (personal income, individual goals, Wasiyya) visible only to owner
- **Reason:** Privacy for personal financial goals and sensitive asset information (Wasiyya), while shared financial truth (debts between brothers) must be fully transparent to both.
- **Date:** 2026-06-07

### DEC-007 — Offline Support
- **Options:** Online-only / Offline-first with sync
- **Choice:** Offline-first
- **Reason:** Event industry venues (warehouses, outdoor locations, UAE desert) often have poor signal. Being unable to log a transaction at the moment it happens is a dealbreaker for adoption.
- **Date:** 2026-06-07

### DEC-008 — Notifications
- **Options:** In-app only / Push only / Both with admin toggle
- **Choice:** Both, with Settings panel toggle per notification type
- **Reason:** Users in fast-paced events need push for time-sensitive things (overdue payment). But in some contexts (during an event) they want silence. Give them control.
- **Date:** 2026-06-07

---

## TECHNOLOGY DECISIONS

### DEC-T001 — Backend / Database
- **Options:** Firebase / Supabase / PocketBase / custom Node.js
- **Choice:** Supabase
- **Reason:** PostgreSQL (relational, perfect for debt/split logic), predictable free-tier pricing, Row-Level Security for per-user data isolation, built-in Auth, realtime subscriptions. Firebase's NoSQL is a bad fit for relational financial data; billing can spike unexpectedly.
- **Date:** 2026-06-07

### DEC-T002 — Frontend Framework
- **Options:** React (Vite) / Next.js / SvelteKit / Vue
- **Choice:** Next.js 14 (App Router)
- **Reason:** Best-in-class for Vercel deployment, server components for fast dashboard loads, excellent PWA support, largest ecosystem for shadcn/ui components.
- **Date:** 2026-06-07

### DEC-T003 — Hosting
- **Options:** Vercel / Netlify / Railway / Render / Streamlit
- **Choice:** Vercel
- **Reason:** Free tier for personal projects, zero-config Next.js deploy, auto HTTPS, global CDN. Streamlit rejected — not mobile-first, not suitable for interactive dark-theme app.
- **Date:** 2026-06-07

### DEC-T004 — UI Library
- **Options:** shadcn/ui / Chakra UI / MUI / Mantine / custom
- **Choice:** shadcn/ui + Tailwind CSS
- **Reason:** shadcn/ui components are unstyled by default and fully owned (not a dependency to be updated). Tailwind gives complete dark theme control. Combined they give a premium financial-app look.
- **Date:** 2026-06-07

### DEC-T005 — Gold/Silver Price API
- **Options:** Gold-API.io / metals-api.com / manual entry
- **Choice:** Gold-API.io (free tier) with manual override fallback
- **Reason:** 100 free requests/month is enough for a 2-user personal app. Manual override ensures the app works even when API limit is reached.
- **Date:** 2026-06-07

### DEC-T006 — Currency FX API
- **Options:** exchangerate-api.com / fixer.io / frankfurter.app
- **Choice:** exchangerate-api.com (1,500 free requests/month)
- **Reason:** Covers AED/PKR/USD, generous free tier, simple REST API, reliable uptime. frankfurter.app is a backup (completely free but ECB data, which may not include AED/PKR as accurately).
- **Date:** 2026-06-07

### DEC-T007 — Charts
- **Options:** Chart.js / Recharts / Tremor / D3.js
- **Choice:** Recharts
- **Reason:** React-native (no DOM manipulation), responsive by default, good dark theme support, lightweight enough for mobile.
- **Date:** 2026-06-07

---

## DESIGN DECISIONS

### DEC-D001 — Theme
- **Options:** Dark only / Light only / Both with toggle
- **Choice:** Dark only (v1)
- **Reason:** User explicitly requested dark. Event industry = often dim venues. Dark is premium. Adding light mode is Phase 6+.
- **Date:** 2026-06-07

### DEC-D002 — Primary Accent Color
- **Options:** Blue / Green / Gold / Purple
- **Choice:** Gold (#C9A84C) as primary, Emerald (#10B981) for positive states
- **Reason:** Gold = wealth, Islamic aesthetic, premium feel. Emerald = money in, positive. Red = debt, negative. Consistent financial colour language.
- **Date:** 2026-06-07

### DEC-D003 — Max Taps to Log Transaction
- **Options:** No limit / 3 taps maximum
- **Choice:** 3 taps maximum for any core logging action
- **Reason:** Event professionals are busy. If it takes more than 3 taps to log a transaction, they won't do it in the moment — they'll try to remember later and forget.
- **Date:** 2026-06-07

---

*Add new decisions as the project evolves. Never delete. Date every entry.*
