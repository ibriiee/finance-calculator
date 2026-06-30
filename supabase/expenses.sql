-- ============================================================
-- EXPENSES MODULE (migration 13)
-- The missing half: personal/living expenses so "yours to keep"
-- reflects real cash, not just income minus obligations.
-- A shared expense (is_shared) auto-creates a brother_ledger IOU
-- for the other person's portion — folding the old Splits module in.
-- Safe to re-run. Run in Supabase → SQL Editor → Run.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.expenses (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id      UUID NOT NULL REFERENCES auth.users(id),
  description   TEXT NOT NULL,
  category      TEXT NOT NULL DEFAULT 'other',  -- rent | utilities | petrol | food_out | groceries | vape | sent_home | health | gift | subscription | business | other | (custom text)
  amount        NUMERIC(14,2) NOT NULL,          -- total paid out of pocket
  currency      TEXT NOT NULL DEFAULT 'AED',     -- AED | PKR
  expense_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  is_shared     BOOLEAN NOT NULL DEFAULT false,  -- split with brother?
  my_pct        NUMERIC(5,4) NOT NULL DEFAULT 1.0, -- owner's share (1.0 = all mine, 0.5 = even split)
  ledger_entry_id UUID REFERENCES public.brother_ledger(id) ON DELETE SET NULL, -- the IOU created for the other's share
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Personal expenses are private to their owner. The shared portion reaches the
-- brother through the brother_ledger IOU (which is already visible to both).
DROP POLICY IF EXISTS "expenses_own" ON public.expenses;
CREATE POLICY "expenses_own" ON public.expenses FOR ALL USING (auth.uid() = owner_id);

CREATE INDEX IF NOT EXISTS idx_expenses_owner_date ON public.expenses(owner_id, expense_date DESC);
