-- ============================================================
-- LIFE SHAPES  (migration 22)
-- Mark shape per life event: square | circle | diamond | ring.
-- Second visual dial next to colour — shape × colour × category
-- keeps unlimited events distinguishable on the week grid.
-- Run in Supabase → SQL Editor → New Query → Run. Safe to re-run.
-- ============================================================

ALTER TABLE public.life_events ADD COLUMN IF NOT EXISTS shape TEXT NOT NULL DEFAULT 'square';

-- Force PostgREST to pick up the new column immediately.
NOTIFY pgrst, 'reload schema';
