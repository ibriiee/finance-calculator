-- ============================================================
-- SHARED INCOME VISIBILITY (migration 20 — 2026-07-11 audit FIX-23)
--
-- Root cause: income_projects RLS is strictly owner-scoped, but three code
-- paths assume a row with ownership = 'shared' is visible to BOTH brothers:
--   1. Dashboard counts shared income at 50% per brother (FIX-07) — for a
--      shared income the OTHER brother added, RLS returned nothing, so the
--      non-adding brother's half never appeared in his cash model while the
--      sadaka trigger (SECURITY DEFINER) still created his obligation.
--   2. SadakaForm's "pay toward which income" picker filters for shared rows
--      that RLS never returned.
--   3. The Sadaka page's income-name lookup fell back to a generic label.
--
-- Fix: ADD a SELECT-only policy so shared rows are readable by both.
-- Writes stay owner-only (the existing income_own FOR ALL policy is
-- unchanged; Postgres ORs permissive policies together).
--
-- Safe to re-run. Run in Supabase → SQL Editor → Run.
-- ============================================================

DROP POLICY IF EXISTS "income_shared_select" ON public.income_projects;
CREATE POLICY "income_shared_select" ON public.income_projects
  FOR SELECT USING (auth.uid() = owner_id OR ownership = 'shared');
