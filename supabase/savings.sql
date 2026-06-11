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
