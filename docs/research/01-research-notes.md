# Research Notes — Comparable Projects & References

**Date:** 2026-06-07
**Compiled by:** Claude (AI Product Partner)

---

## 1. Existing Zakat / Charity Calculators

### What exists:
- **Islamic Relief Zakat Calculator** (https://islamic-relief.org/zakat-calculator/)
  - Nisab: Gold 87.48g / Silver 612.36g (Hanafi gold standard)
  - Live gold/silver prices
  - No login, no history, no tracking
  - Public calculator only

- **ZakatCalculator2025** (GitHub: ZakatCalculator2025/Zakat-Calculator)
  - Open source, web-based
  - Asset input, debt subtraction, 2.5% calculation
  - No login, no multi-user

- **emonbhuiyan/Zakat-Calculator** (GitHub)
  - JS + Bootstrap, mobile-friendly
  - Fetches live exchange rates
  - No accounts, no tracking

### Gap identified:
None of these track Sadaka over time, connect to income, support multi-user login,
or function as a running financial record. They are snapshots only.

---

## 2. Shared Expense / IOU Trackers

### Spliit (GitHub: spliit-app/spliit)
- Free, open-source Splitwise alternative
- Group expense splitting, real-time balance
- No login required (group-based)
- Key pattern used: "minimal settle-up" algorithm (fewest transactions to clear debts)
- **Relevance:** The brother ledger module borrows this logic

### SplitPro (GitHub: oss-apps/split-pro)
- Self-hosted Splitwise alternative
- Multiple split methods: equal, percentage, share, exact
- Categories, currencies, receipt attachments
- **Relevance:** Multi-currency split logic and settlement patterns

### Splitwise
- Best UX in category, but paid for multi-currency, no Islamic layer
- **Relevance:** UX benchmark for the Brother Ledger module

---

## 3. Family Finance Trackers

### Family Finance Tracker (familyfinancetracker.com)
- Multi-device sync, shared budget
- No Islamic financial layer
- **Relevance:** Multi-user sync patterns

### Goodbudget
- Envelope budgeting shared across accounts
- **Relevance:** Shared budget model (less relevant — too budget-focused)

---

## 4. Financial Goals Apps

### Finan360
- Family sharing for savings goals
- Smart path calculation: "save X/month to hit goal by date"
- Real-time updates
- **Relevance:** Goal tracking UI patterns — progress bar + monthly target calculation

### Quicken Simplifi
- Unlimited savings goals built into spending plan
- **Relevance:** Goal-to-income linking concept

---

## 5. Tech Stack Research

### Supabase vs Firebase (2026)
- Supabase wins for:
  - Predictable pricing (resource-based vs Firebase operation-based)
  - PostgreSQL (relational — perfect for our debt/split logic with foreign keys)
  - Built-in Auth with email login
  - Row-Level Security (critical for private data per user)
  - Free tier: 500MB DB, 50K MAUs — massively sufficient for 2 users
- Firebase better for: teams already in Google ecosystem
- **Decision: Supabase**

### Vercel
- Best-in-class hosting for Next.js
- Free tier: unlimited personal projects
- Auto HTTPS, global CDN, instant deploy from GitHub
- **Decision: Vercel**

### Next.js 14
- React framework with server components
- Perfect for mobile-first PWA
- Works seamlessly with Supabase + Vercel
- **Decision: Next.js 14**

---

## 6. Islamic Finance References

### Qard Hasan (Interest-Free Loan) Rules
Source: Wikipedia, FundingSouq, IslamQA

Key principle: *"Gold for gold, silver for silver... like for like, same for same"* (Hadith)

**Cash loans:** Return exact face value in same currency
- e.g., Took 1000 PKR → return 1000 PKR regardless of exchange rate changes
- The currency's purchasing power change is irrelevant — you return the unit

**Commodity/Gold loans:** Return same quantity at current market value
- e.g., Took 2g gold when worth $200 → return 2g gold (or equivalent at today's price)
- If today's price is $300 for 2g → you owe $300
- The commodity itself must be returned, not the price at time of borrowing

**No interest (Riba):** No additional amount above principal
**Voluntary gift:** Borrower may give extra as appreciation, but cannot be contractually required

### Zakat — Hanafi Rules
- Nisab threshold: 87.48g gold (or equivalent cash value)
- Rate: 2.5% of net zakatable wealth
- Hawl: Must hold wealth above nisab for a full lunar year (354 days)
- Jewelry: All gold/silver jewelry included (Hanafi includes all, not just unused)
- Debts: Deduct liabilities due within the year
- Receivables: Include money owed TO you (expected income)

---

## 7. Live API Options

### Gold/Silver Prices
- **Gold-API.io** — Free tier: 100 requests/month (sufficient for personal app)
- **metals-api.com** — Free tier available
- **Alternative:** goldpricez.com or xe.com scraping (last resort)

### Currency Exchange Rates
- **exchangerate-api.com** — Free tier: 1,500 requests/month
- **fixer.io** — Free tier: 100 requests/month (EUR base only on free)
- **frankfurter.app** — Completely free, no key required, ECB data
- **Recommendation:** exchangerate-api.com for AED/PKR/USD

---

## Summary: What Makes This App Unique

No existing app combines:
1. ✅ Earned vs. received income tracking (payment lag)
2. ✅ Automated Sadaka % from every inflow
3. ✅ Advance Sadaka on unearned income
4. ✅ Two-person private IOU ledger (not a group tool)
5. ✅ Islamic Qard Hasan loan rules enforced by type
6. ✅ Shared split costs auto-synced to brother ledger
7. ✅ Hanafi Zakat with hawl tracking
8. ✅ Digital Wasiyya asset register
9. ✅ Offline-first with cloud sync
10. ✅ Dark, mobile-first UI for fast-paced professionals

**This gap is the product.**
