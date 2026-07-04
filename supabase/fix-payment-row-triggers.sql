-- ============================================================
-- FIX-16 — payment rows must be invisible to all 3 sadaka triggers
-- (2026-07 CTO audit second pass)
--
-- Root cause: the sadaka model's invariant is "a row is a PAYMENT when
-- amount_owed = 0 and amount_given > 0; an OBLIGATION when amount_owed > 0"
-- (src/lib/sadaka.ts). Payment rows carry status = 'given' or
-- 'advance_given'. All three trigger functions below filtered on STATUS
-- instead of the amount_owed invariant, so an 'advance_given' PAYMENT
-- row could get amount_owed rewritten into it by editing its linked
-- income, changing sadaka %, or deleting the income — silently turning
-- a completed charity payment into a phantom obligation.
--
-- Fix: add "AND amount_owed > 0" (or "s.amount_owed > 0") to every
-- UPDATE that touches sadaka_entries in these three functions. Nothing
-- else changes — CREATE OR REPLACE FUNCTION re-targets the existing
-- triggers automatically; no need to re-create them.
--
-- Safe to re-run. Run in Supabase → SQL Editor → Run.
-- ============================================================

-- ------------------------------------------------------------
-- PRE-FLIGHT: rows already corrupted by past edits. Any hits here were
-- payments that got flipped into obligations before this fix — review
-- each and, if confirmed, restore with:
--   UPDATE sadaka_entries SET amount_owed = 0 WHERE id = '<id>';
-- ------------------------------------------------------------
SELECT id, status, amount_owed, amount_given
FROM public.sadaka_entries
WHERE status = 'advance_given' AND amount_owed > 0;

-- ------------------------------------------------------------
-- 1) adjust_sadaka_on_income_edit (sadaka-trigger-v2.sql)
--    Income amount edited → only touch OBLIGATION rows (amount_owed > 0).
-- ------------------------------------------------------------
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
      AND s.status <> 'given'      -- given entries stay locked
      AND s.amount_owed > 0;       -- payment rows (amount_owed = 0) are invisible here
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------
-- 2) sync_sadaka_on_income_delete (sadaka-sync.sql)
--    Income deleted → the UPDATE arm (partially-given obligations) must
--    only close OBLIGATION rows, never a linked payment row.
--    The DELETE arm (amount_given = 0) already only matches obligations
--    that were never paid toward — left unchanged.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_sadaka_on_income_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Nothing given yet → the obligation disappears with the income
  DELETE FROM public.sadaka_entries
  WHERE source_income_id = OLD.id AND amount_given = 0;

  -- Partially given OBLIGATION → close the entry at what was actually given
  UPDATE public.sadaka_entries
  SET amount_owed = amount_given, status = 'given'
  WHERE source_income_id = OLD.id AND amount_owed > 0 AND amount_given > 0;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------
-- 3) recalc_sadaka_on_pct_change (sadaka-sync.sql)
--    Sadaka % changed in Settings → both UPDATEs must skip payment rows.
-- ------------------------------------------------------------
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
      AND s.status <> 'given'
      AND s.amount_owed > 0;

    -- Refresh status after the recalc
    UPDATE public.sadaka_entries
    SET status = CASE
      WHEN amount_given > 0 AND amount_given >= amount_owed THEN 'given'
      WHEN amount_given > 0 THEN 'partially_given'
      ELSE 'pending'
    END
    WHERE owner_id = NEW.id
      AND source_income_id IS NOT NULL
      AND status <> 'given'
      AND amount_owed > 0;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
