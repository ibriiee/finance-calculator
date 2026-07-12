-- ============================================================
-- LIFE LAYERS  (migration 21)
-- Two columns that turn life_events into a layer system:
--   category — free-text tag (Deen, Work, Study…). Each distinct
--              category becomes its own tab on the life grid.
--   end_date — optional. When set, the event is a PERIOD (course,
--              job, city) and tints every week from start to end,
--              with a live progress bar while it's ongoing.
-- Run in Supabase → SQL Editor → New Query → Run. Safe to re-run.
-- ============================================================

ALTER TABLE public.life_events ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.life_events ADD COLUMN IF NOT EXISTS end_date DATE;

-- Force PostgREST to pick up the new columns immediately (avoids
-- "Could not find the 'category' column ... in the schema cache").
NOTIFY pgrst, 'reload schema';
