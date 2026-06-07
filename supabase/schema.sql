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

-- Profiles: own row only
CREATE POLICY "profiles_own" ON public.profiles FOR ALL USING (auth.uid() = id);

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
