-- ============================================================
-- ZAKAT PAYMENT LOG
-- Track whether each year's zakat has been paid, and when.
-- Run in Supabase → SQL Editor → New Query → Run.
-- ============================================================

ALTER TABLE public.zakat_snapshots
  ADD COLUMN IF NOT EXISTS zakat_paid BOOLEAN DEFAULT false;

ALTER TABLE public.zakat_snapshots
  ADD COLUMN IF NOT EXISTS zakat_paid_date DATE;

ALTER TABLE public.zakat_snapshots
  ADD COLUMN IF NOT EXISTS nisab_basis TEXT DEFAULT 'silver';

ALTER TABLE public.zakat_snapshots
  ADD COLUMN IF NOT EXISTS due_date DATE;  -- hawl completion / pay-by date
