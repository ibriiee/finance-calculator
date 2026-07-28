-- ============================================================
-- PHASE 8 UPGRADES (migration 14)
-- Four independent, purely ADDITIVE changes. Nothing here alters
-- an existing column, and nothing touches sadaka/zakat math.
--   #45 Sadaqah jariyah tagging      → sadaka_entries.is_jariyah + jariyah_type
--   #48 Niyyah (intention) on goals  → financial_goals.niyyah
--   #55 Ledger author attribution    → brother_ledger.added_by_id
--   #71 Audit log                    → public.audit_log + a defensive trigger
--
-- The app works BEFORE and AFTER this runs: every page reads with select('*'),
-- so new columns simply appear, and every write retries without the new field
-- if the column is missing (42703 / PGRST204) — same pattern as loans-shared.sql.
--
-- Safe to re-run. Run in Supabase → SQL Editor → Run.
-- ============================================================

-- ── #45 Sadaqah jariyah (ongoing charity) ───────────────────
ALTER TABLE public.sadaka_entries
  ADD COLUMN IF NOT EXISTS is_jariyah   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS jariyah_type TEXT;   -- well | quran | tree | education | masjid | other

COMMENT ON COLUMN public.sadaka_entries.is_jariyah IS
  'Sadaqah jariyah — ongoing charity whose reward continues. Display/reporting only, never part of owed/given math.';

CREATE INDEX IF NOT EXISTS idx_sadaka_jariyah
  ON public.sadaka_entries(owner_id) WHERE is_jariyah;

-- ── #48 Niyyah on a goal ────────────────────────────────────
ALTER TABLE public.financial_goals
  ADD COLUMN IF NOT EXISTS niyyah TEXT;

COMMENT ON COLUMN public.financial_goals.niyyah IS
  'The intention behind this goal, shown on the card and on completion.';

-- ── #55 Who logged a ledger entry ───────────────────────────
-- Nullable on purpose: existing rows predate this and must stay valid.
ALTER TABLE public.brother_ledger
  ADD COLUMN IF NOT EXISTS added_by_id UUID REFERENCES auth.users(id);

COMMENT ON COLUMN public.brother_ledger.added_by_id IS
  'Who recorded this IOU (not who owes). NULL for rows created before migration 14.';

-- ── #71 Append-only audit log ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_log (
  id         BIGSERIAL PRIMARY KEY,
  table_name TEXT NOT NULL,
  row_id     TEXT,
  action     TEXT NOT NULL,          -- INSERT | UPDATE | DELETE
  actor_id   UUID,                   -- auth.uid() at the time of the change
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  old_row    JSONB,
  new_row    JSONB
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Both brothers may READ the trail. Nobody may write it by hand: inserts come
-- only from the SECURITY DEFINER trigger below, so the log can't be doctored
-- from the client — that is the entire point of keeping a trail.
DROP POLICY IF EXISTS "audit_read" ON public.audit_log;
CREATE POLICY "audit_read" ON public.audit_log FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_audit_recent ON public.audit_log(changed_at DESC);

/*
 * Defensive by design: an audit failure must NEVER block a real financial write.
 * Any error inside this function is swallowed and the original operation
 * proceeds — a missing log line is an acceptable loss, a rejected expense is not.
 */
CREATE OR REPLACE FUNCTION public.write_audit_log()
RETURNS TRIGGER AS $$
BEGIN
  BEGIN
    INSERT INTO public.audit_log (table_name, row_id, action, actor_id, old_row, new_row)
    VALUES (
      TG_TABLE_NAME,
      COALESCE((to_jsonb(NEW) ->> 'id'), (to_jsonb(OLD) ->> 'id')),
      TG_OP,
      auth.uid(),
      CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) END,
      CASE WHEN TG_OP IN ('UPDATE', 'INSERT') THEN to_jsonb(NEW) END
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;   -- never break the underlying write
  END;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach to the tables where "who changed this?" actually matters.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'income_projects', 'sadaka_entries', 'expenses', 'brother_ledger',
    'joint_account_txns', 'loans', 'loan_repayments', 'financial_goals',
    'goal_contributions', 'savings_entries'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%1$s ON public.%1$I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON public.%1$I
         FOR EACH ROW EXECUTE FUNCTION public.write_audit_log()', t);
  END LOOP;
END $$;
