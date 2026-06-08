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
