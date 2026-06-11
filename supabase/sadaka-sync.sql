-- ============================================================
-- SADAKA SYNC (migration 11)
-- 1) Income DELETE was silently blocked by foreign keys
--    (sadaka_entries / goal_contributions / financial_goals
--    referenced income_projects with no ON DELETE action).
--    → all three become ON DELETE SET NULL.
-- 2) Deleting an income now removes its not-yet-given sadaka
--    obligation; partially-given ones are closed at the amount
--    actually given (history kept).
-- 3) Changing your Sadaka % in Settings recalculates every
--    not-yet-given obligation from its source income.
-- Safe to re-run. Run in Supabase → SQL Editor → Run.
-- ============================================================

-- 1) Unblock income deletion ---------------------------------
ALTER TABLE public.sadaka_entries
  DROP CONSTRAINT IF EXISTS sadaka_entries_source_income_id_fkey;
ALTER TABLE public.sadaka_entries
  ADD CONSTRAINT sadaka_entries_source_income_id_fkey
  FOREIGN KEY (source_income_id) REFERENCES public.income_projects(id) ON DELETE SET NULL;

ALTER TABLE public.goal_contributions
  DROP CONSTRAINT IF EXISTS goal_contributions_source_income_id_fkey;
ALTER TABLE public.goal_contributions
  ADD CONSTRAINT goal_contributions_source_income_id_fkey
  FOREIGN KEY (source_income_id) REFERENCES public.income_projects(id) ON DELETE SET NULL;

ALTER TABLE public.financial_goals
  DROP CONSTRAINT IF EXISTS financial_goals_linked_project_id_fkey;
ALTER TABLE public.financial_goals
  ADD CONSTRAINT financial_goals_linked_project_id_fkey
  FOREIGN KEY (linked_project_id) REFERENCES public.income_projects(id) ON DELETE SET NULL;

-- 2) Deleting income syncs its sadaka obligation -------------
CREATE OR REPLACE FUNCTION public.sync_sadaka_on_income_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Nothing given yet → the obligation disappears with the income
  DELETE FROM public.sadaka_entries
  WHERE source_income_id = OLD.id AND amount_given = 0;

  -- Partially given → close the entry at what was actually given
  UPDATE public.sadaka_entries
  SET amount_owed = amount_given, status = 'given'
  WHERE source_income_id = OLD.id AND amount_given > 0;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_sadaka_income_delete ON public.income_projects;
CREATE TRIGGER trg_sync_sadaka_income_delete
  BEFORE DELETE ON public.income_projects
  FOR EACH ROW EXECUTE FUNCTION public.sync_sadaka_on_income_delete();

-- 3) Changing sadaka % recalculates not-yet-given obligations -
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
      AND s.status <> 'given';

    -- Refresh status after the recalc
    UPDATE public.sadaka_entries
    SET status = CASE
      WHEN amount_given > 0 AND amount_given >= amount_owed THEN 'given'
      WHEN amount_given > 0 THEN 'partially_given'
      ELSE 'pending'
    END
    WHERE owner_id = NEW.id
      AND source_income_id IS NOT NULL
      AND status <> 'given';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_recalc_sadaka_pct ON public.profiles;
CREATE TRIGGER trg_recalc_sadaka_pct
  AFTER UPDATE OF sadaka_pct ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.recalc_sadaka_on_pct_change();
