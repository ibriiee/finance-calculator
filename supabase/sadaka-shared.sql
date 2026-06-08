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
