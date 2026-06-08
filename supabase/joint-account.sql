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
