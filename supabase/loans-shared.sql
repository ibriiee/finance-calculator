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
