-- ============================================================
-- MIZAN - ALL PENDING MIGRATIONS (10-13) IN ONE FILE
-- Paste this WHOLE file into Supabase SQL Editor and click Run.
-- Safe to run more than once.
-- ============================================================

-- ########## 10. sadaka-trigger-v2.sql ##########
-- SMART SADAKA ENGINE v2 (replaces smart-sadaka.sql triggers)
-- 1) Shared income now splits the sadaka obligation 50/50:
--    one entry per brother, each at his own sadaka_pct.
-- 2) Editing an income AMOUNT now adjusts the linked sadaka
--    obligation(s) as long as they haven't been given yet.

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
      AND s.status <> 'given';   -- given entries stay locked
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_adjust_sadaka ON public.income_projects;
CREATE TRIGGER trg_adjust_sadaka
  AFTER UPDATE OF amount ON public.income_projects
  FOR EACH ROW
  EXECUTE FUNCTION public.adjust_sadaka_on_income_edit();

-- ########## 11. sadaka-sync.sql ##########
-- 1) Income DELETE was silently blocked by foreign keys -> ON DELETE SET NULL.
-- 2) Deleting an income removes its not-yet-given sadaka obligation.
-- 3) Changing your Sadaka % recalculates every not-yet-given obligation.

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

CREATE OR REPLACE FUNCTION public.sync_sadaka_on_income_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Nothing given yet: the obligation disappears with the income
  DELETE FROM public.sadaka_entries
  WHERE source_income_id = OLD.id AND amount_given = 0;

  -- Partially given: close the entry at what was actually given
  UPDATE public.sadaka_entries
  SET amount_owed = amount_given, status = 'given'
  WHERE source_income_id = OLD.id AND amount_given > 0;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_sadaka_income_delete ON public.income_projects;
CREATE TRIGGER trg_sync_sadaka_income_delete
  BEFORE DELETE ON public.income_projects
  FOR EACH ROW EXECUTE FUNCTION public.sync_sadaka_on_income_delete();

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
      AND s.status <> 'given';

    -- Refresh status after the recalc
    UPDATE public.sadaka_entries
    SET status = CASE
      WHEN amount_given > 0 AND amount_given >= amount_owed THEN 'given'
      WHEN amount_given > 0 THEN 'partially_given'
      ELSE 'pending'
    END
    WHERE owner_id = NEW.id
      AND source_income_id IS NOT NULL
      AND status <> 'given';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_recalc_sadaka_pct ON public.profiles;
CREATE TRIGGER trg_recalc_sadaka_pct
  AFTER UPDATE OF sadaka_pct ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.recalc_sadaka_on_pct_change();

-- ########## 12. loans-shared.sql ##########
-- Both brothers can now SEE all loans; every loan records WHO added it.

ALTER TABLE public.loans
  ADD COLUMN IF NOT EXISTS added_by_id UUID REFERENCES auth.users(id);

UPDATE public.loans SET added_by_id = owner_id WHERE added_by_id IS NULL;

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

-- ########## 13. savings.sql ##########
-- Personal backup-money stashes (PKR in Pakistan, AED in Dubai, ...)

CREATE TABLE IF NOT EXISTS public.savings_entries (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_name TEXT NOT NULL,
  location     TEXT NOT NULL DEFAULT 'UAE',
  currency     TEXT NOT NULL DEFAULT 'AED',
  txn_type     TEXT NOT NULL DEFAULT 'deposit',
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
-- DONE. You should see "Success. No rows returned".
-- ============================================================
