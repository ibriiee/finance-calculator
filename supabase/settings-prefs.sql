-- ============================================================
-- SETTINGS PREFERENCES
-- Currency default, zakat nisab basis, and per-module on/off toggles.
-- Run in Supabase → SQL Editor → New Query → Run.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS nisab_basis TEXT DEFAULT 'silver';   -- silver | gold

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS enabled_modules JSONB DEFAULT '{
    "income": true,
    "sadaka": true,
    "ledger": true,
    "goals": true,
    "loans": true,
    "splits": true,
    "wasiyya": true,
    "zakat": true,
    "joint_account": true
  }'::jsonb;

-- default_currency already exists (DEFAULT 'AED'). Make sure it's set.
UPDATE public.profiles SET default_currency = 'AED' WHERE default_currency IS NULL;
UPDATE public.profiles SET nisab_basis = 'silver' WHERE nisab_basis IS NULL;
