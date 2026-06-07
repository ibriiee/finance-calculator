# Product Requirements Document (PRD)
## Mizan — Personal Financial Operating System

**Version:** 1.0
**Date:** 2026-06-07
**Authors:** Ibrahim Naeem + Claude (AI Product Partner)
**Status:** Approved — Ready for Architecture Phase

---

## 1. Executive Summary

Mizan is a private, mobile-first web application for two Muslim freelance brothers working
in Dubai's event industry. It is a complete financial operating system with Islamic principles
(Sadaka, Zakat, Qard Hasan, Wasiyya) embedded into the core data model — not added as features.

The app replaces: WhatsApp for debt tracking, manual Sadaka calculation, spreadsheets for
income/project tracking, and the lack of any joint financial goal system.

**App Name:** Mizan (ميزان — Arabic for "balance" / "scale")
**Tagline:** Your money, in balance.

---

## 2. Users

| User | Email | Role |
|---|---|---|
| Ibrahim Naeem | ibrahim_naeem@outlook.com | User 1 (Admin) |
| Abu Bakar | TBD | User 2 |

- Authentication: Email + Password via Supabase Auth
- No public registration — only these 2 emails can create accounts
- Both users see shared data (Brother Ledger, Shared Goals, Shared Splits)
- Private data visible only to owner (Individual Goals, Individual Income)

---

## 3. Platform Requirements

- **Primary:** Mobile web (PWA) — iOS Safari, Android Chrome
- **Secondary:** Desktop browser (Chrome, Safari, Firefox)
- **Split:** 80% mobile / 20% desktop
- **Offline:** Must log transactions without internet; sync on reconnect (Service Worker + local queue)
- **Performance target:** Dashboard loads in under 2 seconds on 4G mobile

---

## 4. Design System

- **Theme:** Dark mode only (no light mode toggle in v1)
- **Primary color palette:**
  - Background: `#0A0A0A` (near black)
  - Surface: `#141414` / `#1C1C1C`
  - Primary accent: Gold `#C9A84C` (wealth, Islamic aesthetic)
  - Secondary accent: Emerald `#10B981` (positive/received)
  - Danger: `#EF4444` (debt, overdue)
  - Warning: `#F59E0B` (pending)
  - Text: `#F5F5F5` (primary) / `#9CA3AF` (secondary)
- **Typography:** Inter (Latin) — clean, modern, financial-grade readability
- **Components:** shadcn/ui customized to dark theme
- **Interactions:** Fast, minimal taps — no more than 3 taps to log any transaction
- **Animations:** Subtle — numbers should count up, progress bars animate in

---

## 5. Module Specifications

---

### MODULE 1: Dashboard (The Cockpit)

**Purpose:** One screen showing complete financial health at a glance.

**Accessible to:** Both users (each sees their own personal data + shared data)

**Sections:**

#### A. Personal Status Card (top)
- Current net position: what you're owed - what you owe (external people)
- This month: income earned vs. income actually received
- Badge: Sadaka pending this month (tap to go to Module 3)

#### B. Brother Ledger Snapshot
- Large, prominent: "Abu Bakar owes you AED 1,200" or "You owe Abu Bakar AED 850"
- Green = you're owed | Red = you owe
- "Settle Up" button
- Tap to go to Module 4

#### C. Sadaka Status Bar
- This month: total Sadaka owed vs. given (progress bar)
- Advance Sadaka balance (if any)
- Colour: fills green as you give more

#### D. Zakat Status Indicator
- Simple pill: "Zakat: WAJIB — AED X due" (red) or "Zakat: Not yet due" (green)
- Shows days until hawl completes (if tracking)

#### E. Active Goals Preview
- 2-3 goals shown as progress bars with labels
- "Car Fund — 34% — AED 8,200 to go"

#### F. Pending Payments (Income)
- Projects where payment not yet received
- "Dubai Expo Gig — AED 4,500 — overdue 12 days"

#### G. Upcoming Loan Repayments
- Any loans (yours or joint) with upcoming due dates

**Technical notes:**
- Dashboard data loaded server-side for speed
- Refresh on pull-down (mobile gesture)
- All amounts tappable → navigate to relevant module

---

### MODULE 2: Income & Projects

**Purpose:** Track every inflow with its earned date, expected payment date, and received date.

**Accessible to:** Each user sees their own; shared projects visible to both.

**Data fields per income entry:**

| Field | Type | Notes |
|---|---|---|
| Project / Income name | Text | e.g., "Dubai Expo Setup", "Gift from Uncle" |
| Type | Enum | Gig (1-3 days) / Short Contract / Long Contract / Gift / Other |
| Currency | Enum | AED / PKR / USD |
| Amount | Decimal | Gross amount |
| Work completed date | Date | When the work was done |
| Expected payment date | Date | Per agreement or estimate |
| Actual received date | Date | Set when money lands — triggers "Received" status |
| Status | Enum | Pending / Partial / Received / Cancelled |
| Ownership | Enum | Ibrahim / Abu Bakar / Shared |
| Notes | Text | Optional client name, contract ref, etc. |
| Sadaka triggered | Boolean | Auto-set on creation |

**Automatic trigger on "Received":**
→ Sadaka entry created in Module 3 (or updated if advance was given)
→ Dashboard updates immediately
→ If shared project → split into both users' records

**The Lag Visualizer:**
- Per project: horizontal timeline bar
- "Worked [date] ——— Expected payment [date] ——— Received [date or PENDING]"
- Colour: green (on time), orange (late by X days), red (very overdue)

**Monthly summary:**
- Total earned this month / Total received this month
- Difference = "Pending income" shown prominently

---

### MODULE 3: Sadaka Tracker

**Purpose:** Track the compulsory self-imposed charity from every inflow.

**Accessible to:** Each user sees their own Sadaka. Joint Sadaka visible to both.

**Settings input (from Module 10):**
- Default Sadaka rate: 20% (adjustable per user)
- Can be overridden per individual income entry (sometimes more)

**Sadaka entry states:**

| Status | Meaning |
|---|---|
| `Pending` | Income logged, Sadaka calculated, not yet given |
| `Advance Given` | Given before income received (supported and tracked) |
| `Partially Given` | e.g., gave 10 of 20% owed |
| `Given` | Fully disbursed — record who, where, what |

**Per Sadaka log entry:**
| Field | Notes |
|---|---|
| Source income | Link to income entry |
| Amount owed | Auto-calculated from % × income |
| Amount given | Updated as given |
| Date given | |
| Recipient | Named (relative name) or "Anonymous needy" / "Masjid" |
| Location | UAE / Pakistan |
| Method | Cash / Gift / Food / Bank transfer |
| Advance | Boolean — was this given before income received? |
| Joint sadaka | Boolean — if true, both brothers share credit |

**Joint Sadaka flow:**
1. User marks a Sadaka as "joint" and enters total amount
2. App splits it 50/50 (or custom %) into each user's Sadaka given
3. Auto-pushes Ibrahim's share as "paid by Abu Bakar for Ibrahim" into Brother Ledger
   (or vice versa depending on who actually paid)

**Annual summary:**
- Total Sadaka given this year
- Breakdown: UAE vs Pakistan, cash vs gifts
- Month-by-month chart

---

### MODULE 4: Brother Ledger

**Purpose:** Replace WhatsApp for all financial transactions between the two brothers.
Single source of truth for who owes whom.

**Accessible to:** Both users (full visibility — this is shared truth)

**The Core Balance (top of screen):**
- Large number: "Abu Bakar owes you AED 1,200" or "You owe AED 850"
- AED balance and PKR balance shown separately (currencies NOT mixed)
- Settle Up button

**Per transaction entry:**

| Field | Notes |
|---|---|
| Direction | Ibrahim → Abu Bakar (I paid for him) or vice versa |
| Amount | |
| Currency | AED or PKR (tracked separately) |
| Category | Bought for me / Paid my share / Project expense / Shared sadaka contribution / Shared cost / Salary advance / Other |
| Description | Short note e.g., "bought camera battery in Deira" |
| Date | |
| Source | Manual / From Shared Split (Module 6) / From Joint Sadaka (Module 3) |
| Settled | Boolean — marked when included in a settlement |

**Settlement flow:**
1. Tap "Settle Up"
2. See net balance: "Abu Bakar owes you AED 1,200"
3. Record how it was settled: Cash / Bank transfer / Goods
4. Settlement logs as a transaction and resets the balance
5. History is preserved — never deleted

**External person (3rd party):**
- Can add a named external person (not an app user)
- Track IOU with them: "Khalid owes me AED 500 for the projector"
- Same ledger logic, private to the user who added them
- External persons cannot see or access the app

---

### MODULE 5: Loans (External Debts)

**Purpose:** Track all formal/informal loans with people outside the brother relationship.

**Accessible to:** Each user sees their own. Joint loans visible to both.

**Loan types:**
| Type | Description |
|---|---|
| I owe someone | I borrowed from a person |
| Someone owes me | I lent to a person |
| Joint loan | Both brothers are responsible |

**Currency types (determines Islamic repayment rule):**
| Currency type | Repayment rule |
|---|---|
| Cash (PKR) | Return exact face value in PKR — no exchange rate adjustment |
| Cash (AED) | Return exact face value in AED |
| Cash (USD) | Return exact face value in USD |
| Gold (grams) | Return same quantity; app shows today's value in AED/USD |
| Silver (grams) | Return same quantity; app shows today's value |

**Per loan entry:**

| Field | Notes |
|---|---|
| Lender / Borrower name | |
| Loan type | I owe / They owe / Joint |
| Currency type | Cash (with currency) or Gold/Silver (in grams) |
| Original amount | |
| Date taken | |
| Due date | Optional |
| Status | Outstanding / Partial / Cleared |
| Repayment log | List of partial payments with dates |
| Notes | Context, relationship to lender |
| Current value (gold) | Live price × grams (auto-calculated for gold/silver loans) |

**Islamic rule display:**
- For cash loans: shows "Return: PKR X,XXX (same as borrowed)"
- For gold loans: shows "Return: Xg gold = AED Y at today's price (AED Z/g)"

**Joint loan split:**
- If joint, shows each brother's share
- When one pays, logs in Brother Ledger automatically

---

### MODULE 6: Shared / Split Costs

**Purpose:** Log expenses that are split between the two brothers.

**Accessible to:** Both users

**Per split entry:**

| Field | Notes |
|---|---|
| Name | e.g., "July House Rent", "Parents' Eid gift", "Camera equipment" |
| Category | House / Vehicle / Gift / Charity / Investment / Business / Other |
| Total amount | |
| Currency | AED or PKR |
| Split % | Default 50/50; adjustable per entry |
| Ibrahim pays | Auto-calculated |
| Abu Bakar pays | Auto-calculated |
| Who actually paid | Ibrahim / Abu Bakar / Both (if each paid their share directly) |
| Date | |
| Recurring | Boolean — for monthly house expenses (auto-generated monthly) |

**Auto-push to Brother Ledger:**
- When "Who paid" = Ibrahim: Abu Bakar's share auto-added to Ledger as "Abu Bakar owes Ibrahim"
- When "Who paid" = Abu Bakar: Ibrahim's share auto-added as "Ibrahim owes Abu Bakar"
- When "Both paid own share": no ledger entry created

---

### MODULE 7: Zakat Calculator

**Purpose:** Annual Zakat calculation per Hanafi rules.

**Accessible to:** Each user separately (private calculation)

**Hanafi rules enforced:**
- Nisab: 87.48g gold equivalent (live price fetched)
- Rate: 2.5%
- Includes: all gold/silver jewelry (Hanafi — not just unused)
- Receivables: include money owed to you
- Deductions: debts due within the year, basic living expenses
- Hawl: must track 1 full Islamic lunar year (354 days)

**Input sections:**

**Cash & Bank:**
- Cash in hand (AED, PKR, USD — converted to single currency)
- Bank account balances
- Stablecoins / digital cash equivalents

**Gold & Silver:**
- Gold owned (grams) → live price auto-fetches AED equivalent
- Silver owned (grams) → live price auto-fetches
- Includes all jewelry (Hanafi)

**Investments:**
- Stocks / funds (current market value)
- Crypto (current value)
- Business inventory / receivables

**Liabilities (subtract):**
- Loans you owe (due within 12 months)
- Bills due within 12 months

**Output:**
- Nisab threshold today: "AED X (87.48g gold at AED Y/g)"
- Net zakatable wealth: AED Z
- Is Zakat wajib? YES / NO (green/red indicator — large and clear)
- Amount due: AED Z × 2.5%
- Hawl tracker: "You have held wealth above nisab for X days / 354 days"

**Snapshots:**
- Save a snapshot per Islamic year
- History of each year's calculation

---

### MODULE 8: Financial Goals

**Purpose:** Track individual and joint savings goals with progress and monthly targets.

**Accessible to:**
- Individual goals: visible only to owner
- Joint goals: visible to both brothers

**Per goal entry:**

| Field | Notes |
|---|---|
| Name | "Emergency 1-year fund", "Toyota Camry", "Parents' house renovation" |
| Type | Individual / Joint |
| Target amount | |
| Currency | AED or PKR |
| Target date | |
| Current saved | Manual update or auto-linked to income |
| Contribution method | Manual top-up / Auto X% from each received income |
| For joint goals | Each brother's contribution tracked separately |

**For joint goals:**
- Each brother's contribution shown individually AND as combined total
- Both can add to the goal independently
- Progress visible to both

**Per goal display:**
- Progress bar (% of target reached)
- "AED X to go"
- "Y months remaining"
- "You need to save AED Z/month to reach goal by target date"
- Status: On Track / Slightly Behind / Significantly Behind / Ahead of Schedule

**Project-linked goals:**
- Can link a goal to expected income projects
- "When Dubai Expo payment received → auto-contribute AED X to Car Fund"

---

### MODULE 9: Wasiyya / Digital Will Vault

**Purpose:** Secure in-app record of all assets, accounts, and Islamic inheritance instructions.

**Accessible to:** Each user separately, with extra PIN/biometric lock

**Sections:**

#### A. External Document Links
- Link to Google Doc / Google Sheet (the full will document)
- Link label + URL + last updated date
- Physical will location: city, who holds it, witness names

#### B. Bank Accounts
- Bank name
- Country
- Account type (current / savings / investment)
- Approximate balance range (not exact — for reference)
- Currency
- Note (e.g., "joint with Abu Bakar", "salary account")
- NO account numbers stored in-app (those go in the Google Doc)

#### C. Physical Assets
- Property: location, approximate value
- Vehicles: make/model/year
- Jewellery: description, approximate value

#### D. Digital Assets
- Email accounts: provider + email (no passwords)
- Social media accounts: platform + handle
- Domain names
- Software licenses / subscriptions

#### E. Crypto & Digital Investments
- Wallet type (hardware/software — NOT private keys)
- Exchange account names
- Approximate holdings (for beneficiary awareness)

#### F. Business Interests
- Company names
- % ownership
- Contact for business partner

#### G. Beneficiaries (Islamic Faraid — informational)
- List of beneficiaries
- Relationship (spouse, child, parent, sibling)
- Intended share % per Islamic inheritance
- Special notes

#### H. Emergency Instructions
- First person to call upon death
- First account to access
- Location of physical documents
- Instructions for digital account access process

**Security:**
- Extra 6-digit PIN or biometric required to open this module
- Data encrypted at rest (Supabase + additional encryption layer)
- No export function in v1 (view only in-app)

---

### MODULE 10: Settings & Admin

**Purpose:** Configure all personal preferences, notification rules, and system settings.

**Sections:**

#### A. Profile
- Name, email (view only — linked to auth)
- Profile photo (optional)
- Default currency
- Hawl start date (for Zakat module)

#### B. Sadaka Settings
- Default Sadaka % (Ibrahim's independent of Abu Bakar's)
- Apply to: Salary / Gifts / All inflows (checkbox)
- Show Sadaka reminder after each income entry: on/off

#### C. Notification Settings
- Master switch: Notifications on/off
- Push notifications: on/off (requires browser permission)
- WhatsApp/in-app: on/off
- Specific alerts (each with on/off):
  - Payment overdue reminder
  - Sadaka pending reminder (after X days)
  - Loan due date reminder
  - Goal milestone reached
  - Brother Ledger balance exceeds AED X

#### D. Live Rate Settings
- Auto-fetch gold/silver prices: on/off
- Auto-fetch AED/PKR/USD rates: on/off
- Last fetched timestamp shown
- Manual override: enter custom rate

#### E. Madhab
- Locked to: Hanafi (display only in v1)

#### F. Data & Privacy
- Export my data (JSON)
- Wasiyya vault PIN change
- Session management (active devices)

---

## 6. Non-Functional Requirements

| Requirement | Specification |
|---|---|
| Mobile performance | Dashboard < 2s load on 4G |
| Offline | All create/edit operations queued and synced on reconnect |
| Security | Supabase Row-Level Security — each user can only access their own data + explicitly shared data |
| Data isolation | Individual goals/income never visible to other user |
| Auth | Email + password; JWT tokens; session refresh |
| Backup | Supabase daily automated backups |
| Data retention | All records kept indefinitely — no auto-deletion |
| Accessibility | WCAG 2.1 AA minimum |

---

## 7. MVP Scope (Phase 3)

The MVP includes these modules only:

1. ✅ Authentication (login by email, 2 users)
2. ✅ Dashboard (simplified — no Zakat/Goals sections yet)
3. ✅ Income & Projects (Module 2)
4. ✅ Brother Ledger (Module 4)

**Not in MVP:**
- Sadaka (Phase 4)
- Shared splits (Phase 4)
- External loans (Phase 4)
- Zakat (Phase 5)
- Goals (Phase 5)
- Wasiyya (Phase 6)

**Rationale:** The MVP solves the two biggest daily pains immediately:
1. Income/payment lag tracking
2. WhatsApp debt chaos

Everything else is built on top of a proven, used foundation.

---

## 8. Future Phases (v2 — Sellable Product)

Phase 7 vision: expand to a "Household Financial OS" product

- Household leader can invite spouse, children, family members
- Role-based access: Leader / Partner / View-only
- Each member has their own Sadaka settings
- Shared goals per household
- Family Zakat calculation (aggregate or individual)
- Subscription model: free for 2 users, paid for household
- Multi-language: English + Urdu
- White-label for Islamic finance apps / banks

---

## 9. Tech Stack Summary

| Component | Technology | Version | Free Tier |
|---|---|---|---|
| Framework | Next.js | 14 | n/a |
| Styling | Tailwind CSS + shadcn/ui | Latest | Yes |
| Database | Supabase (PostgreSQL) | Latest | 500MB, 50K MAUs |
| Auth | Supabase Auth | Latest | 50K MAUs |
| Hosting | Vercel | Latest | Unlimited personal |
| Gold/Silver prices | Gold-API.io | v1 | 100 req/month |
| FX rates | exchangerate-api.com | v6 | 1,500 req/month |
| Offline sync | Service Worker + IndexedDB | Browser API | n/a |
| Charts | Recharts | Latest | Open source |

---

*Document status: Approved. Proceed to Phase 2 — Architecture & Data Model.*
