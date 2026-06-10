-- ============================================================
-- SMART SADAKA ENGINE v2  (replaces smart-sadaka.sql triggers)
-- 1) Shared income now splits the sadaka obligation 50/50:
--    one entry per brother, each at his own sadaka_pct.
-- 2) Editing an income AMOUNT now adjusts the linked sadaka
--    obligation(s) — as long as they haven't been given yet.
-- Safe to re-run. Run in Supabase → SQL Editor → Run.
-- ============================================================

CREATE OR REPLACE FUNCTION public.auto_create_sadaka()
RETURNS TRIGGER AS $$
DECLARE
  pct NUMERIC(5,4);
  prof RECORD;
BEGIN
  IF NEW.sadaka_triggered THEN
    RETURN NEW;
  END IF;

  IF NEW.ownership = 'shared' THEN
    -- Half the income to each brother, each at his own rate
    FOR prof IN SELECT id, COALESCE(sadaka_pct, 0.20) AS pct FROM public.profiles LOOP
      INSERT INTO public.sadaka_entries (
        owner_id, source_income_id, amount_owed, amount_given,
        currency, status, is_advance, is_joint, shared
      ) VALUES (
        prof.id, NEW.id, ROUND(NEW.amount * 0.5 * prof.pct, 2), 0,
        NEW.currency, 'pending', false, false, true
      );
    END LOOP;
  ELSE
    SELECT COALESCE(sadaka_pct, 0.20) INTO pct
    FROM public.profiles WHERE id = NEW.owner_id;
    IF pct IS NULL THEN pct := 0.20; END IF;

    INSERT INTO public.sadaka_entries (
      owner_id, source_income_id, amount_owed, amount_given,
      currency, status, is_advance, is_joint
    ) VALUES (
      NEW.owner_id, NEW.id, ROUND(NEW.amount * pct, 2), 0,
      NEW.currency, 'pending', false, false
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Adjust linked, not-yet-given sadaka when the income amount changes
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
      AND s.status <> 'given';   -- given entries stay locked
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_adjust_sadaka ON public.income_projects;
CREATE TRIGGER trg_adjust_sadaka
  AFTER UPDATE OF amount ON public.income_projects
  FOR EACH ROW
  EXECUTE FUNCTION public.adjust_sadaka_on_income_edit();
