-- ============================================================
-- LIFE TRACKER
-- Memento mori: per-user date of birth + life-expectancy age.
-- The /life module computes days/weeks/months remaining from these.
-- Default expectancy 63 (age of the Prophet ﷺ).
-- Run in Supabase → SQL Editor → New Query → Run. Safe to re-run.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS date_of_birth date;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS life_expectancy_years int DEFAULT 63;

-- Backfill the default for existing rows (NULL → 63).
UPDATE public.profiles SET life_expectancy_years = 63 WHERE life_expectancy_years IS NULL;

-- No new RLS: profiles already has per-user policies.
