-- ============================================================
-- MIZAN — FRESH INSTALL (all 13 migrations, in order)
-- Paste this WHOLE file into a NEW Supabase project's SQL Editor and Run.
-- Safe to re-run. Generated 2026-06-22.
-- ============================================================


-- ############################################################
-- ##### schema.sql
-- ############################################################

-- ============================================================
-- MIZAN — Islamic Finance App
-- Supabase Schema v1.0
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. PROFILES (extends auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           TEXT,
  display_name    TEXT,
  sadaka_pct      NUMERIC(5,4) DEFAULT 0.20,          -- 0.20 = 20%
  default_currency TEXT DEFAULT 'AED',
  hawl_start_date DATE,
  notify_income_received  BOOLEAN DEFAULT true,
  notify_ledger_update    BOOLEAN DEFAULT true,
  notify_sadaka_due       BOOLEAN DEFAULT true,
  notify_zakat_due        BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, split_part(NEW.email, '@', 1));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 2. INCOME / PROJECTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.income_projects (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  type                  TEXT NOT NULL DEFAULT 'gig',       -- gig | short_contract | long_contract | gift | other
  currency              TEXT NOT NULL DEFAULT 'AED',
  amount                NUMERIC(14,2) NOT NULL,
  work_completed_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_payment_date DATE,
  actual_received_date  DATE,
  status                TEXT NOT NULL DEFAULT 'pending',   -- pending | partial | received | cancelled
  ownership             TEXT NOT NULL DEFAULT 'ibrahim',   -- ibrahim | abu_bakar | shared
  notes                 TEXT,
  sadaka_triggered      BOOLEAN DEFAULT false,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. SADAKA ENTRIES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sadaka_entries (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_income_id  UUID REFERENCES public.income_projects(id),
  amount_owed       NUMERIC(14,2) NOT NULL DEFAULT 0,
  amount_given      NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency          TEXT NOT NULL DEFAULT 'AED',
  status            TEXT NOT NULL DEFAULT 'pending',   -- pending | advance_given | partially_given | given
  is_advance        BOOLEAN DEFAULT false,
  is_joint          BOOLEAN DEFAULT false,
  joint_ibrahim_pct NUMERIC(5,4) DEFAULT 0.50,
  date_given        DATE,
  recipient_name    TEXT,
  recipient_type    TEXT,   -- named_relative | anonymous_needy | masjid | gift | other
  location          TEXT,   -- UAE | Pakistan | other
  method            TEXT,   -- cash | gift | food | bank_transfer | other
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. BROTHER LEDGER (IOU between Ibrahim & Abu Bakar)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.brother_ledger (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_user_id     UUID NOT NULL REFERENCES auth.users(id),
  to_user_id       UUID NOT NULL REFERENCES auth.users(id),
  amount           NUMERIC(14,2) NOT NULL,
  currency         TEXT NOT NULL DEFAULT 'AED',           -- AED | PKR only (isolated)
  category         TEXT NOT NULL DEFAULT 'other',
  description      TEXT NOT NULL,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  source_type      TEXT NOT NULL DEFAULT 'manual',        -- manual | shared_split | joint_sadaka | settlement
  source_id        UUID,
  is_settled       BOOLEAN DEFAULT false,
  settlement_id    UUID,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5. LEDGER SETTLEMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ledger_settlements (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  settled_by_id     UUID NOT NULL REFERENCES auth.users(id),
  currency          TEXT NOT NULL DEFAULT 'AED',
  amount            NUMERIC(14,2) NOT NULL,
  settlement_method TEXT NOT NULL DEFAULT 'cash',
  settlement_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 6. EXTERNAL LEDGER (loans with outsiders)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.external_ledger (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  person_name      TEXT NOT NULL,
  contact_info     TEXT,
  direction        TEXT NOT NULL DEFAULT 'they_owe',     -- i_owe | they_owe
  amount           NUMERIC(14,2) NOT NULL,
  currency         TEXT NOT NULL DEFAULT 'AED',
  description      TEXT,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status           TEXT NOT NULL DEFAULT 'outstanding',  -- outstanding | partial | cleared
  amount_cleared   NUMERIC(14,2) DEFAULT 0,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 7. LOANS (Islamic Qard Hasan)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.loans (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  counterparty_name TEXT NOT NULL,
  loan_type         TEXT NOT NULL DEFAULT 'i_owe',       -- i_owe | they_owe | joint
  currency_type     TEXT NOT NULL DEFAULT 'AED',          -- AED | PKR | USD | gold_grams | silver_grams
  original_amount   NUMERIC(14,4) NOT NULL,               -- grams if gold/silver
  date_taken        DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date          DATE,
  status            TEXT NOT NULL DEFAULT 'outstanding',
  joint_ibrahim_pct NUMERIC(5,4) DEFAULT 1.0,
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.loan_repayments (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loan_id       UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  paid_by_id    UUID NOT NULL REFERENCES auth.users(id),
  amount        NUMERIC(14,4) NOT NULL,
  payment_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 8. SHARED COSTS (Splits)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.shared_costs (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_by_id         UUID NOT NULL REFERENCES auth.users(id),
  name                  TEXT NOT NULL,
  category              TEXT NOT NULL DEFAULT 'other',
  total_amount          NUMERIC(14,2) NOT NULL,
  currency              TEXT NOT NULL DEFAULT 'AED',
  ibrahim_pct           NUMERIC(5,4) NOT NULL DEFAULT 0.50,
  paid_by               TEXT NOT NULL DEFAULT 'ibrahim',  -- ibrahim | abu_bakar | both
  cost_date             DATE NOT NULL DEFAULT CURRENT_DATE,
  is_recurring          BOOLEAN DEFAULT false,
  recurring_day         SMALLINT,
  notes                 TEXT,
  ledger_entry_created  BOOLEAN DEFAULT false,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 9. ZAKAT SNAPSHOTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.zakat_snapshots (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id                UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot_year           TEXT NOT NULL,                  -- Islamic year e.g. '1446'
  snapshot_date           DATE NOT NULL DEFAULT CURRENT_DATE,
  cash_aed                NUMERIC(14,2) DEFAULT 0,
  cash_pkr                NUMERIC(14,2) DEFAULT 0,
  cash_usd                NUMERIC(14,2) DEFAULT 0,
  gold_grams              NUMERIC(10,4) DEFAULT 0,
  silver_grams            NUMERIC(10,4) DEFAULT 0,
  investments_aed         NUMERIC(14,2) DEFAULT 0,
  crypto_aed              NUMERIC(14,2) DEFAULT 0,
  business_assets_aed     NUMERIC(14,2) DEFAULT 0,
  receivables_aed         NUMERIC(14,2) DEFAULT 0,
  liabilities_aed         NUMERIC(14,2) DEFAULT 0,
  gold_price_aed_per_gram NUMERIC(10,4),
  silver_price_aed_per_gram NUMERIC(10,4),
  pkr_to_aed_rate         NUMERIC(10,6),
  usd_to_aed_rate         NUMERIC(10,6),
  nisab_threshold_aed     NUMERIC(14,2),
  net_zakatable_wealth_aed NUMERIC(14,2),
  zakat_due_aed           NUMERIC(14,2),
  is_wajib                BOOLEAN,
  hawl_days_completed     INTEGER,
  notes                   TEXT,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (owner_id, snapshot_year)
);

-- ============================================================
-- 10. FINANCIAL GOALS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.financial_goals (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id             UUID REFERENCES auth.users(id) ON DELETE CASCADE,  -- NULL = joint
  goal_type            TEXT NOT NULL DEFAULT 'joint',   -- individual | joint
  name                 TEXT NOT NULL,
  target_amount        NUMERIC(14,2) NOT NULL,
  currency             TEXT NOT NULL DEFAULT 'AED',
  target_date          DATE,
  contribution_method  TEXT DEFAULT 'manual',           -- manual | auto_pct
  auto_pct             NUMERIC(5,4),
  linked_project_id    UUID REFERENCES public.income_projects(id),
  is_active            BOOLEAN DEFAULT true,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.goal_contributions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  goal_id           UUID NOT NULL REFERENCES public.financial_goals(id) ON DELETE CASCADE,
  contributor_id    UUID NOT NULL REFERENCES auth.users(id),
  amount            NUMERIC(14,2) NOT NULL,
  contribution_date DATE NOT NULL DEFAULT CURRENT_DATE,
  source            TEXT NOT NULL DEFAULT 'manual',     -- manual | auto_from_income | linked_project
  source_income_id  UUID REFERENCES public.income_projects(id),
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 11. WASIYYA (Digital Will Vault)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.wasiyya_entries (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category            TEXT NOT NULL DEFAULT 'asset',    -- asset | debt | instruction | password | contact | message
  title               TEXT NOT NULL,
  description         TEXT,
  amount              NUMERIC(14,2),
  currency            TEXT,
  beneficiary_name    TEXT,
  beneficiary_contact TEXT,
  is_sensitive        BOOLEAN DEFAULT false,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 12. RATES CACHE (Gold/Silver/FX prices)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.rates_cache (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rate_type   TEXT UNIQUE NOT NULL,   -- gold_aed_gram | silver_aed_gram | usd_to_aed | pkr_to_aed | etc
  rate_value  NUMERIC(14,6) NOT NULL,
  source      TEXT,                   -- 'api' | 'fallback'
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default rates (fallback values)
INSERT INTO public.rates_cache (rate_type, rate_value, source) VALUES
  ('gold_aed_gram',   272.00, 'seed'),
  ('silver_aed_gram',   3.15, 'seed'),
  ('usd_to_aed',       3.6725, 'seed'),
  ('pkr_to_aed',       0.0132, 'seed'),
  ('gold_usd_oz',    2300.00, 'seed'),
  ('silver_usd_oz',    27.00, 'seed')
ON CONFLICT (rate_type) DO NOTHING;

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.income_projects    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sadaka_entries     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brother_ledger     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_ledger    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_repayments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_costs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zakat_snapshots    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_goals    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wasiyya_entries    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rates_cache        ENABLE ROW LEVEL SECURITY;

-- Profiles: everyone (both brothers) can READ all profiles; write own row only
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Income: owner sees own; also shared entries visible to all authenticated (optional)
CREATE POLICY "income_own" ON public.income_projects FOR ALL USING (auth.uid() = owner_id);

-- Sadaka: owner only
CREATE POLICY "sadaka_own" ON public.sadaka_entries FOR ALL USING (auth.uid() = owner_id);

-- Brother Ledger: both parties see the entry
CREATE POLICY "ledger_parties" ON public.brother_ledger FOR ALL USING (
  auth.uid() = from_user_id OR auth.uid() = to_user_id
);

-- Ledger settlements: any authenticated user (both brothers)
CREATE POLICY "settlements_auth" ON public.ledger_settlements FOR ALL USING (auth.role() = 'authenticated');

-- External ledger: owner only
CREATE POLICY "ext_ledger_own" ON public.external_ledger FOR ALL USING (auth.uid() = owner_id);

-- Loans: owner only
CREATE POLICY "loans_own" ON public.loans FOR ALL USING (auth.uid() = owner_id);
CREATE POLICY "loan_repayments_own" ON public.loan_repayments FOR ALL USING (auth.uid() = paid_by_id);

-- Shared costs: all authenticated users (both brothers see all)
CREATE POLICY "shared_costs_auth" ON public.shared_costs FOR ALL USING (auth.role() = 'authenticated');

-- Zakat: owner only
CREATE POLICY "zakat_own" ON public.zakat_snapshots FOR ALL USING (auth.uid() = owner_id);

-- Financial goals: individual = owner; joint = all authenticated
CREATE POLICY "goals_auth" ON public.financial_goals FOR ALL USING (
  auth.role() = 'authenticated' AND (owner_id IS NULL OR auth.uid() = owner_id)
);
CREATE POLICY "contributions_auth" ON public.goal_contributions FOR ALL USING (auth.role() = 'authenticated');

-- Wasiyya: owner only
CREATE POLICY "wasiyya_own" ON public.wasiyya_entries FOR ALL USING (auth.uid() = owner_id);

-- Rates: read-only for authenticated; write via service role
CREATE POLICY "rates_read" ON public.rates_cache FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "rates_write" ON public.rates_cache FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- REALTIME (enable for collaborative tables)
-- ============================================================
-- Run in Supabase Dashboard > Database > Replication > Tables
-- Enable: brother_ledger, ledger_settlements, shared_costs, financial_goals, goal_contributions

-- ============================================================
-- INDEXES (performance)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_income_owner ON public.income_projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_income_status ON public.income_projects(status);
CREATE INDEX IF NOT EXISTS idx_sadaka_owner ON public.sadaka_entries(owner_id);
CREATE INDEX IF NOT EXISTS idx_ledger_from ON public.brother_ledger(from_user_id);
CREATE INDEX IF NOT EXISTS idx_ledger_to ON public.brother_ledger(to_user_id);
CREATE INDEX IF NOT EXISTS idx_ledger_settled ON public.brother_ledger(is_settled);
CREATE INDEX IF NOT EXISTS idx_loans_owner ON public.loans(owner_id);
CREATE INDEX IF NOT EXISTS idx_goals_type ON public.financial_goals(goal_type);
CREATE INDEX IF NOT EXISTS idx_wasiyya_owner ON public.wasiyya_entries(owner_id);


-- ############################################################
-- ##### fix-profiles-rls.sql
-- ############################################################

-- FIX: Brother Ledger was hanging because each user could only see their OWN profile.
-- This let both brothers READ each other's profile (name/id), while still
-- restricting writes to their own row.
-- Run this in Supabase → SQL Editor → New Query → Run.

DROP POLICY IF EXISTS "profiles_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;

CREATE POLICY "profiles_select_all" ON public.profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Make sure both profiles have proper display names so the app shows
-- "Abu Bakar owes you" instead of "undefined owes you".
-- Adjust the emails if different.
UPDATE public.profiles SET display_name = 'Ibrahim'
  WHERE email = 'ibrahim_naeem@outlook.com';
UPDATE public.profiles SET display_name = 'Abu Bakar'
  WHERE email = 'bakarnaeem@hotmail.com';


-- ############################################################
-- ##### smart-sadaka.sql
-- ############################################################

-- ============================================================
-- SMART SADAKA ENGINE
-- When income is added, auto-create a PENDING sadaka obligation
-- = income amount * the owner's sadaka_pct.
-- Run in Supabase → SQL Editor → New Query → Run.
-- ============================================================

CREATE OR REPLACE FUNCTION public.auto_create_sadaka()
RETURNS TRIGGER AS $$
DECLARE
  pct NUMERIC(5,4);
BEGIN
  -- Only create once per income row
  IF NEW.sadaka_triggered THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(sadaka_pct, 0.20) INTO pct
  FROM public.profiles WHERE id = NEW.owner_id;
  IF pct IS NULL THEN pct := 0.20; END IF;

  INSERT INTO public.sadaka_entries (
    owner_id, source_income_id, amount_owed, amount_given,
    currency, status, is_advance, is_joint
  ) VALUES (
    NEW.owner_id, NEW.id, ROUND(NEW.amount * pct, 2), 0,
    NEW.currency, 'pending', false, false
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mark the income row so we never double-create
CREATE OR REPLACE FUNCTION public.mark_sadaka_triggered()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.income_projects SET sadaka_triggered = true WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_sadaka ON public.income_projects;
CREATE TRIGGER trg_auto_sadaka
  AFTER INSERT ON public.income_projects
  FOR EACH ROW
  WHEN (NEW.sadaka_triggered IS NOT TRUE)
  EXECUTE FUNCTION public.auto_create_sadaka();

DROP TRIGGER IF EXISTS trg_mark_sadaka ON public.income_projects;
CREATE TRIGGER trg_mark_sadaka
  AFTER INSERT ON public.income_projects
  FOR EACH ROW
  WHEN (NEW.sadaka_triggered IS NOT TRUE)
  EXECUTE FUNCTION public.mark_sadaka_triggered();

-- Backfill: create sadaka for existing income that has none yet
INSERT INTO public.sadaka_entries (owner_id, source_income_id, amount_owed, amount_given, currency, status, is_advance, is_joint)
SELECT ip.owner_id, ip.id,
       ROUND(ip.amount * COALESCE(p.sadaka_pct, 0.20), 2), 0,
       ip.currency, 'pending', false, false
FROM public.income_projects ip
JOIN public.profiles p ON p.id = ip.owner_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.sadaka_entries s WHERE s.source_income_id = ip.id
);

UPDATE public.income_projects SET sadaka_triggered = true WHERE sadaka_triggered IS NOT TRUE;


-- ############################################################
-- ##### sadaka-shared.sql
-- ############################################################

-- ============================================================
-- SHARED / ON-BEHALF SADAKA
-- Lets either brother add a sadaka entry on the other's behalf
-- (e.g. Abu Bakar hands his sadaka money to Ibrahim to distribute).
-- Both can see and manage shared entries, with attribution.
-- Run in Supabase → SQL Editor → New Query → Run.
-- ============================================================

-- Who created the entry (attribution)
ALTER TABLE public.sadaka_entries
  ADD COLUMN IF NOT EXISTS added_by_id UUID REFERENCES auth.users(id);

-- Shared pool both brothers can see & manage
ALTER TABLE public.sadaka_entries
  ADD COLUMN IF NOT EXISTS shared BOOLEAN DEFAULT false;

-- Backfill attribution for existing rows
UPDATE public.sadaka_entries SET added_by_id = owner_id WHERE added_by_id IS NULL;

-- Rebuild RLS: you see your own + joint + shared; you can write your own + shared;
-- you may insert on anyone's behalf as long as you attribute yourself.
DROP POLICY IF EXISTS "sadaka_own" ON public.sadaka_entries;
DROP POLICY IF EXISTS "sadaka_select" ON public.sadaka_entries;
DROP POLICY IF EXISTS "sadaka_insert" ON public.sadaka_entries;
DROP POLICY IF EXISTS "sadaka_update" ON public.sadaka_entries;
DROP POLICY IF EXISTS "sadaka_delete" ON public.sadaka_entries;

CREATE POLICY "sadaka_select" ON public.sadaka_entries
  FOR SELECT USING (
    owner_id = auth.uid() OR is_joint = true OR shared = true
  );

CREATE POLICY "sadaka_insert" ON public.sadaka_entries
  FOR INSERT WITH CHECK (
    added_by_id = auth.uid()
  );

CREATE POLICY "sadaka_update" ON public.sadaka_entries
  FOR UPDATE USING (
    owner_id = auth.uid() OR is_joint = true OR shared = true
  );

CREATE POLICY "sadaka_delete" ON public.sadaka_entries
  FOR DELETE USING (
    owner_id = auth.uid() OR added_by_id = auth.uid() OR is_joint = true OR shared = true
  );


-- ############################################################
-- ##### settings-prefs.sql
-- ############################################################

-- ============================================================
-- SETTINGS PREFERENCES
-- Currency default, zakat nisab basis, and per-module on/off toggles.
-- Run in Supabase → SQL Editor → New Query → Run.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS nisab_basis TEXT DEFAULT 'silver';   -- silver | gold

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS enabled_modules JSONB DEFAULT '{
    "income": true,
    "sadaka": true,
    "ledger": true,
    "goals": true,
    "loans": true,
    "splits": true,
    "wasiyya": true,
    "zakat": true,
    "joint_account": true
  }'::jsonb;

-- default_currency already exists (DEFAULT 'AED'). Make sure it's set.
UPDATE public.profiles SET default_currency = 'AED' WHERE default_currency IS NULL;
UPDATE public.profiles SET nisab_basis = 'silver' WHERE nisab_basis IS NULL;


-- ############################################################
-- ##### joint-account.sql
-- ############################################################

-- ============================================================
-- JOINT BANK ACCOUNT MODULE
-- Shared house account: both chip in equally, deposits & withdrawals
-- tracked, balance + fairness (who's behind on their share) computed.
-- Run in Supabase → SQL Editor → New Query → Run.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.joint_accounts (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  bank_name     TEXT,
  currency      TEXT NOT NULL DEFAULT 'AED',   -- AED | PKR
  is_active     BOOLEAN DEFAULT true,
  created_by_id UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.joint_account_txns (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id     UUID NOT NULL REFERENCES public.joint_accounts(id) ON DELETE CASCADE,
  txn_type       TEXT NOT NULL DEFAULT 'deposit',   -- deposit | withdrawal
  contributor_id UUID REFERENCES auth.users(id),    -- deposit: who chipped in
  amount         NUMERIC(14,2) NOT NULL,
  description    TEXT,
  category       TEXT DEFAULT 'house_expense',
  txn_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by_id  UUID REFERENCES auth.users(id),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jat_account ON public.joint_account_txns(account_id);

ALTER TABLE public.joint_accounts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.joint_account_txns ENABLE ROW LEVEL SECURITY;

-- Shared resource: both brothers have full access.
DROP POLICY IF EXISTS "joint_accounts_all" ON public.joint_accounts;
CREATE POLICY "joint_accounts_all" ON public.joint_accounts
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "joint_txns_all" ON public.joint_account_txns;
CREATE POLICY "joint_txns_all" ON public.joint_account_txns
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Realtime so both see updates live
ALTER PUBLICATION supabase_realtime ADD TABLE public.joint_accounts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.joint_account_txns;


-- ############################################################
-- ##### zakat-paid.sql
-- ############################################################

-- ============================================================
-- ZAKAT PAYMENT LOG
-- Track whether each year's zakat has been paid, and when.
-- Run in Supabase → SQL Editor → New Query → Run.
-- ============================================================

ALTER TABLE public.zakat_snapshots
  ADD COLUMN IF NOT EXISTS zakat_paid BOOLEAN DEFAULT false;

ALTER TABLE public.zakat_snapshots
  ADD COLUMN IF NOT EXISTS zakat_paid_date DATE;

ALTER TABLE public.zakat_snapshots
  ADD COLUMN IF NOT EXISTS nisab_basis TEXT DEFAULT 'silver';

ALTER TABLE public.zakat_snapshots
  ADD COLUMN IF NOT EXISTS due_date DATE;  -- hawl completion / pay-by date


-- ############################################################
-- ##### sadaka-recipients.sql
-- ############################################################

-- ============================================================
-- SADAKA RECIPIENTS (directory)
-- Saved people who receive sadaka (e.g. "Norine Unty").
-- Lets us track total received, last paid date, and who is overdue
-- so they can be prioritised in the next sadaka batch.
-- Shared directory — both brothers see & manage it.
-- Run in Supabase → SQL Editor → New Query → Run.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.sadaka_recipients (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  relation      TEXT,                       -- relative | needy | masjid | student | widow | other
  location      TEXT DEFAULT 'UAE',         -- UAE | Pakistan | other
  contact       TEXT,
  notes         TEXT,
  is_active     BOOLEAN DEFAULT true,
  created_by_id UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.sadaka_entries
  ADD COLUMN IF NOT EXISTS recipient_id UUID REFERENCES public.sadaka_recipients(id);

ALTER TABLE public.sadaka_recipients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sadaka_recipients_all" ON public.sadaka_recipients;
CREATE POLICY "sadaka_recipients_all" ON public.sadaka_recipients
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

ALTER PUBLICATION supabase_realtime ADD TABLE public.sadaka_recipients;


-- ############################################################
-- ##### income-upgrades.sql
-- ############################################################

-- ============================================================
-- INCOME UPGRADES
-- Work start date + "ongoing" flag (work still in progress).
-- Run in Supabase → SQL Editor → New Query → Run.
-- ============================================================

ALTER TABLE public.income_projects
  ADD COLUMN IF NOT EXISTS work_started_date DATE;

ALTER TABLE public.income_projects
  ADD COLUMN IF NOT EXISTS is_ongoing BOOLEAN DEFAULT false;

-- Allow owner to UPDATE/DELETE their own income (RLS already FOR ALL on owner_id,
-- but make sure the policy exists after earlier edits).
DROP POLICY IF EXISTS "income_own" ON public.income_projects;
CREATE POLICY "income_own" ON public.income_projects
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);


-- ############################################################
-- ##### sadaka-trigger-v2.sql
-- ############################################################

-- ============================================================
-- SMART SADAKA ENGINE v2  (replaces smart-sadaka.sql triggers)
-- 1) Shared income now splits the sadaka obligation 50/50:
--    one entry per brother, each at his own sadaka_pct.
-- 2) Editing an income AMOUNT now adjusts the linked sadaka
--    obligation(s) — as long as they haven't been given yet.
-- Safe to re-run. Run in Supabase → SQL Editor → Run.
-- ============================================================

CREATE OR REPLACE FUNCTION public.auto_create_sadaka()
RETURNS TRIGGER AS $$
DECLARE
  pct NUMERIC(5,4);
  prof RECORD;
BEGIN
  IF NEW.sadaka_triggered THEN
    RETURN NEW;
  END IF;

  IF NEW.ownership = 'shared' THEN
    -- Half the income to each brother, each at his own rate
    FOR prof IN SELECT id, COALESCE(sadaka_pct, 0.20) AS pct FROM public.profiles LOOP
      INSERT INTO public.sadaka_entries (
        owner_id, source_income_id, amount_owed, amount_given,
        currency, status, is_advance, is_joint, shared
      ) VALUES (
        prof.id, NEW.id, ROUND(NEW.amount * 0.5 * prof.pct, 2), 0,
        NEW.currency, 'pending', false, false, true
      );
    END LOOP;
  ELSE
    SELECT COALESCE(sadaka_pct, 0.20) INTO pct
    FROM public.profiles WHERE id = NEW.owner_id;
    IF pct IS NULL THEN pct := 0.20; END IF;

    INSERT INTO public.sadaka_entries (
      owner_id, source_income_id, amount_owed, amount_given,
      currency, status, is_advance, is_joint
    ) VALUES (
      NEW.owner_id, NEW.id, ROUND(NEW.amount * pct, 2), 0,
      NEW.currency, 'pending', false, false
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Adjust linked, not-yet-given sadaka when the income amount changes
CREATE OR REPLACE FUNCTION public.adjust_sadaka_on_income_edit()
RETURNS TRIGGER AS $$
DECLARE
  factor NUMERIC := CASE WHEN NEW.ownership = 'shared' THEN 0.5 ELSE 1.0 END;
BEGIN
  IF NEW.amount IS DISTINCT FROM OLD.amount THEN
    UPDATE public.sadaka_entries s
    SET amount_owed = ROUND(NEW.amount * factor * COALESCE(p.sadaka_pct, 0.20), 2),
        status = CASE
          WHEN s.amount_given >= ROUND(NEW.amount * factor * COALESCE(p.sadaka_pct, 0.20), 2) THEN 'given'
          WHEN s.amount_given > 0 THEN 'partially_given'
          ELSE 'pending'
        END
    FROM public.profiles p
    WHERE p.id = s.owner_id
      AND s.source_income_id = NEW.id
      AND s.status <> 'given'      -- given entries stay locked
      AND s.amount_owed > 0;       -- payment rows (amount_owed = 0) are invisible here (FIX-16)
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_adjust_sadaka ON public.income_projects;
CREATE TRIGGER trg_adjust_sadaka
  AFTER UPDATE OF amount ON public.income_projects
  FOR EACH ROW
  EXECUTE FUNCTION public.adjust_sadaka_on_income_edit();


-- ############################################################
-- ##### sadaka-sync.sql
-- ############################################################

-- ============================================================
-- SADAKA SYNC (migration 11)
-- 1) Income DELETE was silently blocked by foreign keys
--    (sadaka_entries / goal_contributions / financial_goals
--    referenced income_projects with no ON DELETE action).
--    → all three become ON DELETE SET NULL.
-- 2) Deleting an income now removes its not-yet-given sadaka
--    obligation; partially-given ones are closed at the amount
--    actually given (history kept).
-- 3) Changing your Sadaka % in Settings recalculates every
--    not-yet-given obligation from its source income.
-- Safe to re-run. Run in Supabase → SQL Editor → Run.
-- ============================================================

-- 1) Unblock income deletion ---------------------------------
ALTER TABLE public.sadaka_entries
  DROP CONSTRAINT IF EXISTS sadaka_entries_source_income_id_fkey;
ALTER TABLE public.sadaka_entries
  ADD CONSTRAINT sadaka_entries_source_income_id_fkey
  FOREIGN KEY (source_income_id) REFERENCES public.income_projects(id) ON DELETE SET NULL;

ALTER TABLE public.goal_contributions
  DROP CONSTRAINT IF EXISTS goal_contributions_source_income_id_fkey;
ALTER TABLE public.goal_contributions
  ADD CONSTRAINT goal_contributions_source_income_id_fkey
  FOREIGN KEY (source_income_id) REFERENCES public.income_projects(id) ON DELETE SET NULL;

ALTER TABLE public.financial_goals
  DROP CONSTRAINT IF EXISTS financial_goals_linked_project_id_fkey;
ALTER TABLE public.financial_goals
  ADD CONSTRAINT financial_goals_linked_project_id_fkey
  FOREIGN KEY (linked_project_id) REFERENCES public.income_projects(id) ON DELETE SET NULL;

-- 2) Deleting income syncs its sadaka obligation -------------
CREATE OR REPLACE FUNCTION public.sync_sadaka_on_income_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Nothing given yet → the obligation disappears with the income
  DELETE FROM public.sadaka_entries
  WHERE source_income_id = OLD.id AND amount_given = 0;

  -- Partially given OBLIGATION → close the entry at what was actually given (FIX-16)
  UPDATE public.sadaka_entries
  SET amount_owed = amount_given, status = 'given'
  WHERE source_income_id = OLD.id AND amount_owed > 0 AND amount_given > 0;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_sadaka_income_delete ON public.income_projects;
CREATE TRIGGER trg_sync_sadaka_income_delete
  BEFORE DELETE ON public.income_projects
  FOR EACH ROW EXECUTE FUNCTION public.sync_sadaka_on_income_delete();

-- 3) Changing sadaka % recalculates not-yet-given obligations -
CREATE OR REPLACE FUNCTION public.recalc_sadaka_on_pct_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sadaka_pct IS DISTINCT FROM OLD.sadaka_pct THEN
    -- Recompute owed from the source income at the NEW rate.
    -- v2 shared entries (shared = true) carry half the income each.
    UPDATE public.sadaka_entries s
    SET amount_owed = ROUND(
          ip.amount
          * CASE WHEN ip.ownership = 'shared' AND COALESCE(s.shared, false) THEN 0.5 ELSE 1 END
          * COALESCE(NEW.sadaka_pct, 0.20), 2)
    FROM public.income_projects ip
    WHERE ip.id = s.source_income_id
      AND s.owner_id = NEW.id
      AND s.status <> 'given'
      AND s.amount_owed > 0;   -- payment rows invisible here (FIX-16)

    -- Refresh status after the recalc
    UPDATE public.sadaka_entries
    SET status = CASE
      WHEN amount_given > 0 AND amount_given >= amount_owed THEN 'given'
      WHEN amount_given > 0 THEN 'partially_given'
      ELSE 'pending'
    END
    WHERE owner_id = NEW.id
      AND source_income_id IS NOT NULL
      AND status <> 'given'
      AND amount_owed > 0;   -- payment rows invisible here (FIX-16)
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_recalc_sadaka_pct ON public.profiles;
CREATE TRIGGER trg_recalc_sadaka_pct
  AFTER UPDATE OF sadaka_pct ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.recalc_sadaka_on_pct_change();


-- ############################################################
-- ##### loans-shared.sql
-- ############################################################

-- ============================================================
-- LOANS SHARED VISIBILITY (migration 12)
-- Both brothers can now SEE all loans, and every loan records
-- WHO added it (added_by_id) so an entry reported by Abu Bakar
-- shows "Added by Abu Bakar" on Ibrahim's screen (and vice versa).
-- A loan can also be added on the other brother's behalf.
-- Safe to re-run. Run in Supabase → SQL Editor → Run.
-- ============================================================

ALTER TABLE public.loans
  ADD COLUMN IF NOT EXISTS added_by_id UUID REFERENCES auth.users(id);

-- Backfill: existing loans were added by their owner
UPDATE public.loans SET added_by_id = owner_id WHERE added_by_id IS NULL;

-- RLS: read for both; insert as yourself; modify if owner or adder
DROP POLICY IF EXISTS "loans_own" ON public.loans;
DROP POLICY IF EXISTS "loans_select_all" ON public.loans;
DROP POLICY IF EXISTS "loans_insert_adder" ON public.loans;
DROP POLICY IF EXISTS "loans_update_parties" ON public.loans;
DROP POLICY IF EXISTS "loans_delete_parties" ON public.loans;

CREATE POLICY "loans_select_all" ON public.loans
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "loans_insert_adder" ON public.loans
  FOR INSERT WITH CHECK (auth.uid() = added_by_id);
CREATE POLICY "loans_update_parties" ON public.loans
  FOR UPDATE USING (auth.uid() = owner_id OR auth.uid() = added_by_id);
CREATE POLICY "loans_delete_parties" ON public.loans
  FOR DELETE USING (auth.uid() = owner_id OR auth.uid() = added_by_id);

-- Repayments: visible to both, written by the payer
DROP POLICY IF EXISTS "loan_repayments_own" ON public.loan_repayments;
DROP POLICY IF EXISTS "loan_repayments_select" ON public.loan_repayments;
DROP POLICY IF EXISTS "loan_repayments_insert" ON public.loan_repayments;
DROP POLICY IF EXISTS "loan_repayments_update" ON public.loan_repayments;
DROP POLICY IF EXISTS "loan_repayments_delete" ON public.loan_repayments;

CREATE POLICY "loan_repayments_select" ON public.loan_repayments
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "loan_repayments_insert" ON public.loan_repayments
  FOR INSERT WITH CHECK (auth.uid() = paid_by_id);
CREATE POLICY "loan_repayments_update" ON public.loan_repayments
  FOR UPDATE USING (auth.uid() = paid_by_id);
CREATE POLICY "loan_repayments_delete" ON public.loan_repayments
  FOR DELETE USING (auth.uid() = paid_by_id);


-- ############################################################
-- ##### savings.sql
-- ############################################################

-- ============================================================
-- SAVINGS MODULE (migration 13)
-- Personal "backup money" stashes — e.g. PKR saved in Pakistan,
-- AED saved in a Dubai account — separate from goals.
-- Deposits and withdrawals per named account/place.
-- Safe to re-run. Run in Supabase → SQL Editor → Run.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.savings_entries (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_name TEXT NOT NULL,                       -- e.g. 'Meezan Bank — Pakistan'
  location     TEXT NOT NULL DEFAULT 'UAE',         -- UAE | Pakistan | other
  currency     TEXT NOT NULL DEFAULT 'AED',         -- AED | PKR
  txn_type     TEXT NOT NULL DEFAULT 'deposit',     -- deposit | withdrawal
  amount       NUMERIC(14,2) NOT NULL,
  entry_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.savings_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "savings_own" ON public.savings_entries;
CREATE POLICY "savings_own" ON public.savings_entries
  FOR ALL USING (auth.uid() = owner_id);

CREATE INDEX IF NOT EXISTS idx_savings_owner ON public.savings_entries(owner_id);

-- ============================================================
-- LIFE TRACKER (memento mori): DOB + life-expectancy age on profiles
-- ============================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS date_of_birth date;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS life_expectancy_years int DEFAULT 63;
UPDATE public.profiles SET life_expectancy_years = 63 WHERE life_expectancy_years IS NULL;

-- ============================================================
-- LIFE EVENTS: milestones, intentions & reminders for the Life room
-- ============================================================
CREATE TABLE IF NOT EXISTS public.life_events (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label        TEXT NOT NULL,
  event_date   DATE NOT NULL,
  kind         TEXT NOT NULL DEFAULT 'milestone',   -- milestone | intention | reminder
  color        TEXT NOT NULL DEFAULT '#C9A84C',
  recurrence   TEXT NOT NULL DEFAULT 'none',         -- none | monthly | yearly
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.life_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "life_events_own" ON public.life_events;
CREATE POLICY "life_events_own" ON public.life_events FOR ALL USING (auth.uid() = owner_id);

CREATE INDEX IF NOT EXISTS life_events_owner_idx ON public.life_events (owner_id, event_date);

-- ============================================================
-- SHARED INCOME VISIBILITY (migration 20 — 2026-07-11 audit FIX-23)
-- A 'shared' income must be readable by BOTH brothers: the dashboard counts
-- it at 50% each (FIX-07) and the sadaka picker links payments to it.
-- SELECT-only widening; writes stay owner-only via income_own.
-- ============================================================
DROP POLICY IF EXISTS "income_shared_select" ON public.income_projects;
CREATE POLICY "income_shared_select" ON public.income_projects
  FOR SELECT USING (auth.uid() = owner_id OR ownership = 'shared');

