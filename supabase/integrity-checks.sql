-- ============================================================
-- INTEGRITY FLOOR — CHECK constraints (2026-07 audit FIX-04)
-- 1) PRE-FLIGHT: each SELECT must return 0 rows. If not, fix
--    those rows first (they are already-corrupt data).
-- ============================================================
SELECT id, amount        FROM public.income_projects  WHERE amount <= 0 OR amount IS NULL;
SELECT id, amount_owed, amount_given FROM public.sadaka_entries
  WHERE amount_owed < 0 OR amount_given < 0 OR (amount_owed = 0 AND amount_given = 0);
SELECT id, amount        FROM public.brother_ledger   WHERE amount <= 0;
SELECT id, original_amount FROM public.loans          WHERE original_amount <= 0;
SELECT id, amount        FROM public.loan_repayments  WHERE amount <= 0;
SELECT id, amount        FROM public.goal_contributions WHERE amount <= 0;
SELECT id, amount        FROM public.savings_entries  WHERE amount <= 0;
SELECT id, amount        FROM public.joint_account_txns WHERE amount <= 0;
SELECT id, amount, my_pct FROM public.expenses WHERE amount <= 0 OR my_pct < 0 OR my_pct > 1;
SELECT rate_type, rate_value FROM public.rates_cache  WHERE rate_value <= 0;

-- 2) CONSTRAINTS (safe to re-run: duplicate_object is swallowed)
DO $$ BEGIN
  ALTER TABLE public.income_projects  ADD CONSTRAINT chk_income_amount_pos    CHECK (amount > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.income_projects  ADD CONSTRAINT chk_income_currency      CHECK (currency IN ('AED','PKR'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.income_projects  ADD CONSTRAINT chk_income_status        CHECK (status IN ('pending','partial','received','cancelled'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.income_projects  ADD CONSTRAINT chk_income_ownership     CHECK (ownership IN ('ibrahim','abu_bakar','shared'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.sadaka_entries   ADD CONSTRAINT chk_sadaka_nonneg        CHECK (amount_owed >= 0 AND amount_given >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.sadaka_entries   ADD CONSTRAINT chk_sadaka_currency      CHECK (currency IN ('AED','PKR'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.brother_ledger   ADD CONSTRAINT chk_ledger_amount_pos    CHECK (amount > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.brother_ledger   ADD CONSTRAINT chk_ledger_currency      CHECK (currency IN ('AED','PKR'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.loans            ADD CONSTRAINT chk_loans_amount_pos     CHECK (original_amount > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.loan_repayments  ADD CONSTRAINT chk_repay_amount_pos     CHECK (amount > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.goal_contributions ADD CONSTRAINT chk_contrib_amount_pos CHECK (amount > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.savings_entries  ADD CONSTRAINT chk_savings_amount_pos   CHECK (amount > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.joint_account_txns ADD CONSTRAINT chk_jtxn_amount_pos    CHECK (amount > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.expenses         ADD CONSTRAINT chk_expense_amount_pos   CHECK (amount > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.expenses         ADD CONSTRAINT chk_expense_pct          CHECK (my_pct >= 0 AND my_pct <= 1);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.rates_cache      ADD CONSTRAINT chk_rates_value_pos      CHECK (rate_value > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Do NOT add a CHECK on sadaka_entries.status — the trigger and app write
-- several values (pending/advance_given/partially_given/given); freezing
-- them without a full sweep risks breaking the trigger. Skipped deliberately.
