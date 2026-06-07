# Phase 2 — Architecture & Data Model

**Version:** 1.0
**Date:** 2026-06-07
**Status:** Complete — Ready for Phase 3 Build

---

## 1. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENTS                              │
│  Ibrahim (Mobile / Desktop)   Abu Bakar (Mobile / Desktop) │
│           ↕  HTTPS + WSS (Supabase Realtime)  ↕            │
├─────────────────────────────────────────────────────────────┤
│                     VERCEL (Frontend)                       │
│              Next.js 14 App (React Server Components)       │
│         Tailwind CSS + shadcn/ui  |  Service Worker (PWA)  │
│                IndexedDB (offline queue)                    │
├─────────────────────────────────────────────────────────────┤
│                   SUPABASE (Backend)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │  Auth (JWT)  │  │  PostgreSQL  │  │   Realtime      │  │
│  │  2 users     │  │  12 tables   │  │  Subscriptions  │  │
│  │  email+pass  │  │  RLS on all  │  │  Ledger sync    │  │
│  └──────────────┘  └──────────────┘  └─────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                  EXTERNAL APIS (free tier)                  │
│   Gold-API.io (gold/silver prices)  |  exchangerate-api    │
│              (AED / PKR / USD rates)                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. User Identity Model

Supabase Auth manages authentication. Every user gets a UUID (`auth.users.id`).
We extend this with a `profiles` table for app-specific data.

**Two permitted emails (hardcoded in app env vars):**
- `NEXT_PUBLIC_USER_1_EMAIL` = ibrahim_naeem@outlook.com
- `NEXT_PUBLIC_USER_2_EMAIL` = (Abu Bakar's email — to be added in Settings)

Registration is blocked for any other email at the app layer.

**Convenience constants used throughout the schema:**
- `ibrahim_id` = UUID of Ibrahim's profile
- `abu_bakar_id` = UUID of Abu Bakar's profile

---

## 3. Complete Database Schema

### Table 1: `profiles`
Extends Supabase Auth. Created automatically on first login via a trigger.

```sql
CREATE TABLE profiles (
  id                        UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name              TEXT NOT NULL,                         -- "Ibrahim" or "Abu Bakar"
  sadaka_rate               DECIMAL(5,4) NOT NULL DEFAULT 0.20,   -- e.g. 0.20 = 20%
  default_currency          TEXT NOT NULL DEFAULT 'AED'           -- AED | PKR | USD
                            CHECK (default_currency IN ('AED','PKR','USD')),
  hawl_start_date           DATE,                                  -- for Zakat lunar year tracking
  wasiyya_pin_hash          TEXT,                                  -- bcrypt hash of 6-digit PIN
  notify_push               BOOLEAN NOT NULL DEFAULT TRUE,
  notify_overdue_payment    BOOLEAN NOT NULL DEFAULT TRUE,
  notify_sadaka_pending     BOOLEAN NOT NULL DEFAULT TRUE,
  notify_loan_due           BOOLEAN NOT NULL DEFAULT TRUE,
  notify_goal_milestone     BOOLEAN NOT NULL DEFAULT TRUE,
  notify_ledger_threshold   DECIMAL(12,2),                        -- alert if balance > this
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**RLS:** Each user can only SELECT/UPDATE their own row.
```sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile only" ON profiles
  USING (auth.uid() = id);
```

---

### Table 2: `income_projects`
Every inflow: project payment, gig, gift, or any money received.

```sql
CREATE TABLE income_projects (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id              UUID NOT NULL REFERENCES profiles(id),    -- who logged it
  name                  TEXT NOT NULL,                            -- "Dubai Expo Setup"
  type                  TEXT NOT NULL
                        CHECK (type IN ('gig','short_contract','long_contract','gift','other')),
  currency              TEXT NOT NULL DEFAULT 'AED'
                        CHECK (currency IN ('AED','PKR','USD')),
  amount                DECIMAL(14,2) NOT NULL CHECK (amount > 0),
  work_completed_date   DATE NOT NULL,
  expected_payment_date DATE,
  actual_received_date  DATE,                                     -- NULL until money lands
  status                TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','partial','received','cancelled')),
  ownership             TEXT NOT NULL DEFAULT 'individual'
                        CHECK (ownership IN ('ibrahim','abu_bakar','shared')),
  notes                 TEXT,
  sadaka_triggered      BOOLEAN NOT NULL DEFAULT FALSE,           -- set TRUE once sadaka entry created
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_income_owner    ON income_projects(owner_id);
CREATE INDEX idx_income_status   ON income_projects(status);
CREATE INDEX idx_income_received ON income_projects(actual_received_date);
```

**RLS:**
- Owner can always read/write their own income
- For `ownership = 'shared'`: both users can read
- Only owner (creator) can update/delete

```sql
ALTER TABLE income_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner or shared read" ON income_projects
  FOR SELECT USING (
    auth.uid() = owner_id
    OR ownership = 'shared'
  );

CREATE POLICY "owner write" ON income_projects
  FOR ALL USING (auth.uid() = owner_id);
```

---

### Table 3: `sadaka_entries`
Tracks the compulsory self-imposed charity from every inflow.

```sql
CREATE TABLE sadaka_entries (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id            UUID NOT NULL REFERENCES profiles(id),
  source_income_id    UUID REFERENCES income_projects(id) ON DELETE SET NULL,
  amount_owed         DECIMAL(14,2) NOT NULL CHECK (amount_owed >= 0),
  amount_given        DECIMAL(14,2) NOT NULL DEFAULT 0 CHECK (amount_given >= 0),
  currency            TEXT NOT NULL DEFAULT 'AED'
                      CHECK (currency IN ('AED','PKR','USD')),
  status              TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','advance_given','partially_given','given')),
  is_advance          BOOLEAN NOT NULL DEFAULT FALSE,   -- given before income received
  is_joint            BOOLEAN NOT NULL DEFAULT FALSE,   -- shared between both brothers
  joint_ibrahim_pct   DECIMAL(5,4) DEFAULT 0.5,         -- Ibrahim's share of joint sadaka
  date_given          DATE,
  recipient_name      TEXT,                             -- e.g. "Aunt Ruqayyah" or "Anonymous"
  recipient_type      TEXT
                      CHECK (recipient_type IN ('named_relative','anonymous_needy','masjid','gift','other')),
  location            TEXT CHECK (location IN ('UAE','Pakistan','other')),
  method              TEXT CHECK (method IN ('cash','gift','food','bank_transfer','other')),
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sadaka_owner  ON sadaka_entries(owner_id);
CREATE INDEX idx_sadaka_status ON sadaka_entries(status);
```

**RLS:**
- Own entries always readable
- Joint entries (`is_joint = TRUE`) readable by both users

```sql
ALTER TABLE sadaka_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own or joint sadaka" ON sadaka_entries
  FOR SELECT USING (
    auth.uid() = owner_id
    OR is_joint = TRUE
  );

CREATE POLICY "owner write sadaka" ON sadaka_entries
  FOR ALL USING (auth.uid() = owner_id);
```

---

### Table 4: `brother_ledger`
Every financial transaction between Ibrahim and Abu Bakar.
This is the WhatsApp killer — the single source of truth.

```sql
CREATE TABLE brother_ledger (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id     UUID NOT NULL REFERENCES profiles(id),   -- who PAID / who it came FROM
  to_user_id       UUID NOT NULL REFERENCES profiles(id),   -- who BENEFITED / who owes
  amount           DECIMAL(14,2) NOT NULL CHECK (amount > 0),
  currency         TEXT NOT NULL CHECK (currency IN ('AED','PKR')),  -- tracked separately
  category         TEXT NOT NULL
                   CHECK (category IN (
                     'bought_for_me','paid_my_share','project_expense',
                     'joint_sadaka_contribution','shared_cost','salary_advance',
                     'settlement','other'
                   )),
  description      TEXT NOT NULL,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  source_type      TEXT NOT NULL DEFAULT 'manual'
                   CHECK (source_type IN ('manual','shared_split','joint_sadaka','settlement')),
  source_id        UUID,               -- FK to shared_costs.id or sadaka_entries.id (app-level)
  is_settled       BOOLEAN NOT NULL DEFAULT FALSE,
  settlement_id    UUID REFERENCES ledger_settlements(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ledger_from     ON brother_ledger(from_user_id);
CREATE INDEX idx_ledger_to       ON brother_ledger(to_user_id);
CREATE INDEX idx_ledger_settled  ON brother_ledger(is_settled);
CREATE INDEX idx_ledger_currency ON brother_ledger(currency);
```

**RLS:** Both users can read ALL ledger entries (shared truth). Only logged-in user can INSERT.

```sql
ALTER TABLE brother_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "both users read ledger" ON brother_ledger
  FOR SELECT USING (
    auth.uid() = from_user_id OR auth.uid() = to_user_id
  );

CREATE POLICY "authenticated insert ledger" ON brother_ledger
  FOR INSERT WITH CHECK (auth.uid() = from_user_id);
```

---

### Table 5: `ledger_settlements`
Records when the running balance between the brothers is cleared.

```sql
CREATE TABLE ledger_settlements (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settled_by_id     UUID NOT NULL REFERENCES profiles(id),
  currency          TEXT NOT NULL CHECK (currency IN ('AED','PKR')),
  amount            DECIMAL(14,2) NOT NULL,
  settlement_method TEXT NOT NULL
                    CHECK (settlement_method IN ('cash','bank_transfer','goods','split_offset')),
  settlement_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**RLS:** Both users can read all settlements.

```sql
ALTER TABLE ledger_settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "both users read settlements" ON ledger_settlements
  FOR SELECT USING (TRUE);   -- all authenticated users (only 2 exist)

CREATE POLICY "authenticated insert settlement" ON ledger_settlements
  FOR INSERT WITH CHECK (auth.uid() = settled_by_id);
```

---

### Table 6: `external_ledger`
Private IOU records for 3rd-party people (not app users).

```sql
CREATE TABLE external_ledger (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id         UUID NOT NULL REFERENCES profiles(id),   -- PRIVATE to this user
  person_name      TEXT NOT NULL,
  contact_info     TEXT,
  direction        TEXT NOT NULL CHECK (direction IN ('i_owe','they_owe')),
  amount           DECIMAL(14,2) NOT NULL CHECK (amount > 0),
  currency         TEXT NOT NULL CHECK (currency IN ('AED','PKR','USD')),
  description      TEXT,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status           TEXT NOT NULL DEFAULT 'outstanding'
                   CHECK (status IN ('outstanding','partial','cleared')),
  amount_cleared   DECIMAL(14,2) NOT NULL DEFAULT 0,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**RLS:** Strictly private — owner only.

```sql
ALTER TABLE external_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "private external ledger" ON external_ledger
  USING (auth.uid() = owner_id);
```

---

### Table 7: `loans`
Formal/informal loans with people outside the brothers.

```sql
CREATE TABLE loans (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id           UUID NOT NULL REFERENCES profiles(id),
  counterparty_name  TEXT NOT NULL,
  loan_type          TEXT NOT NULL CHECK (loan_type IN ('i_owe','they_owe','joint')),
  currency_type      TEXT NOT NULL
                     CHECK (currency_type IN ('AED','PKR','USD','gold_grams','silver_grams')),
  original_amount    DECIMAL(14,4) NOT NULL CHECK (original_amount > 0),
  -- For cash loans: original_amount is the face value to return (same currency rule)
  -- For gold/silver: original_amount is the GRAMS to return (current price rule)
  date_taken         DATE NOT NULL,
  due_date           DATE,
  status             TEXT NOT NULL DEFAULT 'outstanding'
                     CHECK (status IN ('outstanding','partial','cleared')),
  joint_ibrahim_pct  DECIMAL(5,4) DEFAULT 0.5,   -- only used when loan_type = 'joint'
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_loans_owner  ON loans(owner_id);
CREATE INDEX idx_loans_status ON loans(status);
CREATE INDEX idx_loans_due    ON loans(due_date);
```

**Repayments sub-table:**
```sql
CREATE TABLE loan_repayments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id         UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  paid_by_id      UUID NOT NULL REFERENCES profiles(id),
  amount          DECIMAL(14,4) NOT NULL CHECK (amount > 0),
  payment_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**RLS:**
- Own loans: always visible
- Joint loans: both users can read

```sql
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own or joint loans" ON loans
  FOR SELECT USING (
    auth.uid() = owner_id OR loan_type = 'joint'
  );

CREATE POLICY "owner write loans" ON loans
  FOR ALL USING (auth.uid() = owner_id);

ALTER TABLE loan_repayments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "loan repayment access" ON loan_repayments
  FOR SELECT USING (
    auth.uid() = paid_by_id
    OR EXISTS (
      SELECT 1 FROM loans l
      WHERE l.id = loan_id
      AND (l.owner_id = auth.uid() OR l.loan_type = 'joint')
    )
  );
```

---

### Table 8: `shared_costs`
Expenses split between both brothers.

```sql
CREATE TABLE shared_costs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_id         UUID NOT NULL REFERENCES profiles(id),
  name                  TEXT NOT NULL,
  category              TEXT NOT NULL
                        CHECK (category IN (
                          'house','vehicle','gift','charity',
                          'investment','business','other'
                        )),
  total_amount          DECIMAL(14,2) NOT NULL CHECK (total_amount > 0),
  currency              TEXT NOT NULL CHECK (currency IN ('AED','PKR')),
  ibrahim_pct           DECIMAL(5,4) NOT NULL DEFAULT 0.5,  -- Abu Bakar's = 1 - ibrahim_pct
  paid_by               TEXT NOT NULL
                        CHECK (paid_by IN ('ibrahim','abu_bakar','both')),
  cost_date             DATE NOT NULL DEFAULT CURRENT_DATE,
  is_recurring          BOOLEAN NOT NULL DEFAULT FALSE,
  recurring_day         SMALLINT CHECK (recurring_day BETWEEN 1 AND 31),
  notes                 TEXT,
  ledger_entry_created  BOOLEAN NOT NULL DEFAULT FALSE,     -- prevent double-push
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**RLS:** Both users can read all shared costs (shared truth).

```sql
ALTER TABLE shared_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "both read shared costs" ON shared_costs
  FOR SELECT USING (TRUE);

CREATE POLICY "creator write shared costs" ON shared_costs
  FOR ALL USING (auth.uid() = created_by_id);
```

---

### Table 9: `zakat_snapshots`
Annual Zakat calculation records, one per user per Islamic year.

```sql
CREATE TABLE zakat_snapshots (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id                  UUID NOT NULL REFERENCES profiles(id),
  snapshot_year             TEXT NOT NULL,               -- Islamic year e.g. "1447"
  snapshot_date             DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Assets (all in their original currency — converted at calc time)
  cash_aed                  DECIMAL(14,2) NOT NULL DEFAULT 0,
  cash_pkr                  DECIMAL(14,2) NOT NULL DEFAULT 0,
  cash_usd                  DECIMAL(14,2) NOT NULL DEFAULT 0,
  gold_grams                DECIMAL(10,4) NOT NULL DEFAULT 0,
  silver_grams              DECIMAL(10,4) NOT NULL DEFAULT 0,
  investments_aed           DECIMAL(14,2) NOT NULL DEFAULT 0,
  crypto_aed                DECIMAL(14,2) NOT NULL DEFAULT 0,
  business_assets_aed       DECIMAL(14,2) NOT NULL DEFAULT 0,
  receivables_aed           DECIMAL(14,2) NOT NULL DEFAULT 0,  -- money owed TO you

  -- Liabilities (deducted)
  liabilities_aed           DECIMAL(14,2) NOT NULL DEFAULT 0,

  -- Live rates at time of snapshot (for audit trail)
  gold_price_aed_per_gram   DECIMAL(10,4),
  silver_price_aed_per_gram DECIMAL(10,4),
  pkr_to_aed_rate           DECIMAL(10,6),
  usd_to_aed_rate           DECIMAL(10,6),

  -- Calculated outputs
  nisab_threshold_aed       DECIMAL(14,2),   -- 87.48g × gold price
  net_zakatable_wealth_aed  DECIMAL(14,2),   -- total assets - liabilities
  zakat_due_aed             DECIMAL(14,2),   -- 2.5% of net
  is_wajib                  BOOLEAN,         -- net_zakatable_wealth >= nisab
  hawl_days_completed       INTEGER,         -- days since hawl_start_date

  notes                     TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_zakat_owner_year ON zakat_snapshots(owner_id, snapshot_year);
```

**RLS:** Strictly private.

```sql
ALTER TABLE zakat_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "private zakat" ON zakat_snapshots
  USING (auth.uid() = owner_id);
```

---

### Table 10: `financial_goals`
Individual and joint savings targets.

```sql
CREATE TABLE financial_goals (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id            UUID REFERENCES profiles(id),       -- NULL for joint goals
  goal_type           TEXT NOT NULL CHECK (goal_type IN ('individual','joint')),
  name                TEXT NOT NULL,                       -- "Emergency Fund", "Toyota Camry"
  target_amount       DECIMAL(14,2) NOT NULL CHECK (target_amount > 0),
  currency            TEXT NOT NULL CHECK (currency IN ('AED','PKR')),
  target_date         DATE,
  contribution_method TEXT NOT NULL DEFAULT 'manual'
                      CHECK (contribution_method IN ('manual','auto_pct')),
  auto_pct            DECIMAL(5,4),                        -- e.g. 0.05 = 5% of each income
  linked_project_id   UUID REFERENCES income_projects(id) ON DELETE SET NULL,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Contributions to goals (tracks who put in what)
CREATE TABLE goal_contributions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id             UUID NOT NULL REFERENCES financial_goals(id) ON DELETE CASCADE,
  contributor_id      UUID NOT NULL REFERENCES profiles(id),
  amount              DECIMAL(14,2) NOT NULL CHECK (amount > 0),
  contribution_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  source              TEXT NOT NULL DEFAULT 'manual'
                      CHECK (source IN ('manual','auto_from_income','linked_project')),
  source_income_id    UUID REFERENCES income_projects(id) ON DELETE SET NULL,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_goal_contributions_goal ON goal_contributions(goal_id);
```

**RLS:**
- Individual goals: owner only
- Joint goals: both users

```sql
ALTER TABLE financial_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "individual or joint goals" ON financial_goals
  FOR SELECT USING (
    auth.uid() = owner_id OR goal_type = 'joint'
  );

CREATE POLICY "owner write goals" ON financial_goals
  FOR ALL USING (
    auth.uid() = owner_id OR goal_type = 'joint'
  );

ALTER TABLE goal_contributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "goal contributions access" ON goal_contributions
  FOR SELECT USING (
    auth.uid() = contributor_id
    OR EXISTS (
      SELECT 1 FROM financial_goals g
      WHERE g.id = goal_id
      AND (g.owner_id = auth.uid() OR g.goal_type = 'joint')
    )
  );

CREATE POLICY "contributor insert" ON goal_contributions
  FOR INSERT WITH CHECK (auth.uid() = contributor_id);
```

---

### Table 11: `wasiyya_items`
Digital will vault — flexible JSON structure per item type.

```sql
CREATE TABLE wasiyya_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     UUID NOT NULL REFERENCES profiles(id),
  section      TEXT NOT NULL
               CHECK (section IN (
                 'document_link','bank_account','physical_asset',
                 'digital_asset','crypto','business','beneficiary','emergency'
               )),
  title        TEXT NOT NULL,
  data         JSONB NOT NULL DEFAULT '{}',   -- flexible per section type (see below)
  sort_order   INTEGER NOT NULL DEFAULT 0,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wasiyya_owner   ON wasiyya_items(owner_id);
CREATE INDEX idx_wasiyya_section ON wasiyya_items(section);
```

**JSONB `data` field shape per section:**
```json
// document_link
{ "url": "https://...", "label": "Main Will Google Doc", "last_updated": "2026-06" }

// bank_account
{ "bank": "HBL", "country": "Pakistan", "type": "savings", "currency": "PKR",
  "balance_range": "PKR 50K-100K", "note": "joint with Abu Bakar" }

// physical_asset
{ "type": "property", "description": "House in Lahore", "value_approx": "PKR 2Cr" }

// digital_asset
{ "type": "email", "provider": "Gmail", "handle": "ibrahim@gmail.com" }

// crypto
{ "wallet_type": "Ledger hardware", "exchange": "Binance", "holdings_approx": "AED 5000" }

// business
{ "company": "XYZ Events LLC", "ownership_pct": 50, "partner": "Abu Bakar",
  "contact": "+971-xx-xxx-xxxx" }

// beneficiary
{ "name": "Abu Bakar", "relation": "brother", "share_pct": 50,
  "notes": "as per Hanafi faraid" }

// emergency
{ "first_call": "Abu Bakar", "phone": "+971-xx", "first_account": "Emirates NBD",
  "documents_location": "Home safe — Lahore", "instructions": "..." }
```

**RLS:** Strictly private — encrypted at rest by Supabase, extra PIN enforced at app layer.

```sql
ALTER TABLE wasiyya_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "private wasiyya" ON wasiyya_items
  USING (auth.uid() = owner_id);
```

---

### Table 12: `rates_cache`
Live gold, silver, and FX rates — fetched once, cached for all modules.

```sql
CREATE TABLE rates_cache (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_type   TEXT NOT NULL UNIQUE
              CHECK (rate_type IN ('gold_aed_gram','silver_aed_gram','usd_to_aed','pkr_to_aed')),
  rate_value  DECIMAL(14,6) NOT NULL,
  fetched_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed with reasonable defaults (updated by the app)
INSERT INTO rates_cache (rate_type, rate_value) VALUES
  ('gold_aed_gram',  330.00),   -- approximate AED per gram of gold
  ('silver_aed_gram', 3.80),    -- approximate AED per gram of silver
  ('usd_to_aed',      3.6725),  -- AED/USD (pegged)
  ('pkr_to_aed',      0.013);   -- approximate AED per PKR
```

**RLS:** Readable by all authenticated users. Only updated by server function.

```sql
ALTER TABLE rates_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "all read rates" ON rates_cache FOR SELECT USING (TRUE);
```

---

## 4. Database Relationships Diagram

```
auth.users (Supabase managed)
    │
    └──► profiles (1:1)
              │
              ├──► income_projects (1:many)
              │         │
              │         └──► sadaka_entries (1:many, via source_income_id)
              │
              ├──► sadaka_entries (1:many, own entries)
              │
              ├──► brother_ledger (from_user_id or to_user_id)
              │         │
              │         └──► ledger_settlements (many:1)
              │
              ├──► external_ledger (1:many, private)
              │
              ├──► loans (1:many)
              │         │
              │         └──► loan_repayments (1:many)
              │
              ├──► shared_costs (1:many)
              │         │
              │         └──► brother_ledger [auto-push on creation]
              │
              ├──► zakat_snapshots (1:many)
              │
              ├──► financial_goals (1:many for individual; shared for joint)
              │         │
              │         └──► goal_contributions (1:many)
              │                   │
              │                   └──► income_projects [optional link]
              │
              └──► wasiyya_items (1:many, private)
```

---

## 5. Key Business Logic (App Layer)

These rules are enforced in the Next.js app, not in the DB:

### 5a. Income → Sadaka Auto-Trigger
```
When income_projects.status is set to 'received':
  IF sadaka_triggered = FALSE:
    INSERT INTO sadaka_entries (
      owner_id = income.owner_id,
      source_income_id = income.id,
      amount_owed = income.amount × profile.sadaka_rate,
      currency = income.currency,
      status = 'pending'
    )
    UPDATE income_projects SET sadaka_triggered = TRUE
```

### 5b. Shared Split → Brother Ledger Auto-Push
```
When shared_costs is saved AND ledger_entry_created = FALSE:
  ibrahim_owes = total_amount × (1 - ibrahim_pct)   [if paid_by = abu_bakar]
  abu_bakar_owes = total_amount × ibrahim_pct        [if paid_by = ibrahim]
  
  INSERT INTO brother_ledger (
    from_user_id = payer,
    to_user_id = other_brother,
    amount = their_share,
    currency = shared_cost.currency,
    category = 'shared_cost',
    source_type = 'shared_split',
    source_id = shared_costs.id
  )
  UPDATE shared_costs SET ledger_entry_created = TRUE
```

### 5c. Joint Sadaka → Brother Ledger Auto-Push
```
When sadaka_entry.is_joint = TRUE AND paid by one brother for both:
  other_brother_share = amount_given × (1 - joint_ibrahim_pct)
  INSERT INTO brother_ledger (
    from_user_id = payer,
    to_user_id = other_brother,
    amount = other_brother_share,
    category = 'joint_sadaka_contribution',
    source_type = 'joint_sadaka',
    source_id = sadaka_entries.id
  )
```

### 5d. Loan Repayment Rule Display
```
IF loan.currency_type IN ('AED','PKR','USD'):
  display "Return: {currency_type} {original_amount}" (face value — never changes)

IF loan.currency_type IN ('gold_grams','silver_grams'):
  metal = 'gold' or 'silver'
  rate = rates_cache WHERE rate_type = '{metal}_aed_gram'
  display "Return: {original_amount}g {metal} = AED {original_amount × rate} (today's price)"
```

### 5e. Zakat Wajib Check (Hanafi)
```
nisab = 87.48 × rates_cache['gold_aed_gram']

total_in_aed = 
  cash_aed 
  + (cash_pkr × rates_cache['pkr_to_aed'])
  + (cash_usd × rates_cache['usd_to_aed'])
  + (gold_grams × rates_cache['gold_aed_gram'])
  + (silver_grams × rates_cache['silver_aed_gram'])
  + investments_aed + crypto_aed + business_assets_aed + receivables_aed

net_zakatable = total_in_aed - liabilities_aed

is_wajib = (net_zakatable >= nisab) AND (hawl_days_completed >= 354)
zakat_due = is_wajib ? net_zakatable × 0.025 : 0
```

### 5f. Goal Monthly Target Calculation
```
months_remaining = months_between(TODAY, target_date)
amount_remaining = target_amount - current_saved
monthly_needed = amount_remaining / months_remaining

status = 
  monthly_needed <= (historical_avg_contribution) ? 'on_track' :
  monthly_needed <= (historical_avg_contribution × 1.2) ? 'slightly_behind' :
  'significantly_behind'
```

---

## 6. Realtime Subscriptions

Supabase Realtime is used for instant sync between Ibrahim's and Abu Bakar's devices:

| Table | Event | Who listens | Why |
|---|---|---|---|
| `brother_ledger` | INSERT | Both users | Instant notification when the other logs a transaction |
| `ledger_settlements` | INSERT | Both users | Both see when balance is cleared |
| `shared_costs` | INSERT | Both users | Both see new shared expenses |
| `financial_goals` (joint) | ALL | Both users | Goal contributions show up in real time |
| `income_projects` (shared) | UPDATE | Both users | Payment status updates |

---

## 7. Offline Strategy

**Problem:** Event venues often have poor signal. Transactions must be loggable offline.

**Solution:** Service Worker + IndexedDB queue

```
[User logs transaction offline]
        ↓
  Stored in IndexedDB (browser local storage)
        ↓
  UI shows "Queued — will sync"
        ↓
  Service Worker detects connectivity restored
        ↓
  Dequeues and POSTs to Supabase in order
        ↓
  UI updates, "Synced ✓"
```

**Tables that support offline create:**
- `income_projects` ✓
- `brother_ledger` ✓
- `sadaka_entries` ✓
- `external_ledger` ✓
- `loan_repayments` ✓
- `goal_contributions` ✓

**Tables that are read-only offline (display last cached data):**
- `rates_cache` (shows last known rates with "last updated" timestamp)
- Dashboard aggregates (computed from locally cached records)

---

## 8. Environment Variables Required

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://[project-ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon-key]
SUPABASE_SERVICE_ROLE_KEY=[service-role-key]   # server-side only, never exposed

# Permitted users (no public sign-up)
NEXT_PUBLIC_USER_1_EMAIL=ibrahim_naeem@outlook.com
NEXT_PUBLIC_USER_2_EMAIL=[abu-bakar-email]

# External APIs
GOLD_API_KEY=[gold-api.io key]
EXCHANGE_RATE_API_KEY=[exchangerate-api.com key]

# App
NEXT_PUBLIC_APP_URL=https://finance-calculator.vercel.app
```

---

## 9. Folder Structure — Next.js App (`/src`)

```
src/
├── app/                          # Next.js 14 App Router
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── layout.tsx
│   ├── (app)/                    # Protected routes
│   │   ├── dashboard/page.tsx
│   │   ├── income/page.tsx
│   │   ├── sadaka/page.tsx
│   │   ├── ledger/page.tsx
│   │   ├── loans/page.tsx
│   │   ├── splits/page.tsx
│   │   ├── zakat/page.tsx
│   │   ├── goals/page.tsx
│   │   ├── wasiyya/page.tsx
│   │   ├── settings/page.tsx
│   │   └── layout.tsx
│   ├── api/
│   │   ├── rates/route.ts        # Fetch + cache live rates
│   │   └── notifications/route.ts
│   └── layout.tsx
├── components/
│   ├── ui/                       # shadcn/ui components
│   ├── dashboard/
│   ├── income/
│   ├── sadaka/
│   ├── ledger/
│   ├── loans/
│   ├── splits/
│   ├── zakat/
│   ├── goals/
│   ├── wasiyya/
│   └── shared/                   # CurrencyBadge, StatusPill, AmountDisplay, etc.
├── lib/
│   ├── supabase/
│   │   ├── client.ts             # Browser Supabase client
│   │   ├── server.ts             # Server-side Supabase client
│   │   └── middleware.ts         # Auth middleware
│   ├── calculations/
│   │   ├── zakat.ts              # Zakat wajib logic
│   │   ├── sadaka.ts             # Sadaka auto-calc
│   │   ├── loan-repayment.ts     # Islamic repayment rule by type
│   │   └── goals.ts              # Monthly target calc
│   ├── offline/
│   │   ├── queue.ts              # IndexedDB queue manager
│   │   └── sync.ts               # Service Worker sync handler
│   └── utils/
│       ├── currency.ts           # Format AED/PKR/USD
│       ├── dates.ts              # Hijri date helpers
│       └── rates.ts              # Rate fetching + caching
├── hooks/
│   ├── useRates.ts
│   ├── useLedgerBalance.ts
│   ├── useSadakaStatus.ts
│   └── useZakatStatus.ts
└── types/
    └── database.types.ts         # Auto-generated from Supabase schema
```

---

*Document status: Complete. Proceed to Phase 3 — MVP Build.*
*Next: Initialize Next.js app, connect Supabase, build Auth + Dashboard + Income + Brother Ledger.*
