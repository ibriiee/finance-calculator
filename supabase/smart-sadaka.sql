-- ============================================================
-- SMART SADAKA ENGINE
-- When income is added, auto-create a PENDING sadaka obligation
-- = income amount * the owner's sadaka_pct.
-- Run in Supabase → SQL Editor → New Query → Run.
-- ============================================================

CREATE OR REPLACE FUNCTION public.auto_create_sadaka()
RETURNS TRIGGER AS $$
DECLARE
  pct NUMERIC(5,4);
BEGIN
  -- Only create once per income row
  IF NEW.sadaka_triggered THEN
    RETURN NEW;
  END IF;

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

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mark the income row so we never double-create
CREATE OR REPLACE FUNCTION public.mark_sadaka_triggered()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.income_projects SET sadaka_triggered = true WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_sadaka ON public.income_projects;
CREATE TRIGGER trg_auto_sadaka
  AFTER INSERT ON public.income_projects
  FOR EACH ROW
  WHEN (NEW.sadaka_triggered IS NOT TRUE)
  EXECUTE FUNCTION public.auto_create_sadaka();

DROP TRIGGER IF EXISTS trg_mark_sadaka ON public.income_projects;
CREATE TRIGGER trg_mark_sadaka
  AFTER INSERT ON public.income_projects
  FOR EACH ROW
  WHEN (NEW.sadaka_triggered IS NOT TRUE)
  EXECUTE FUNCTION public.mark_sadaka_triggered();

-- Backfill: create sadaka for existing income that has none yet
INSERT INTO public.sadaka_entries (owner_id, source_income_id, amount_owed, amount_given, currency, status, is_advance, is_joint)
SELECT ip.owner_id, ip.id,
       ROUND(ip.amount * COALESCE(p.sadaka_pct, 0.20), 2), 0,
       ip.currency, 'pending', false, false
FROM public.income_projects ip
JOIN public.profiles p ON p.id = ip.owner_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.sadaka_entries s WHERE s.source_income_id = ip.id
);

UPDATE public.income_projects SET sadaka_triggered = true WHERE sadaka_triggered IS NOT TRUE;
