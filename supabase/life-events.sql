-- ============================================================
-- LIFE EVENTS  (migration 15)
-- Milestones, future intentions, and reminders for the Life room.
--   kind: milestone (past, colours a lived week)
--         intention (future goal, outlines a future week)
--         reminder  (dated / recurring nudge, shown in Upcoming)
--   recurrence: none | monthly | yearly
-- Per-user via owner_id; same RLS shape as the financial tables.
-- Run in Supabase → SQL Editor → New Query → Run. Safe to re-run.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.life_events (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label        TEXT NOT NULL,
  event_date   DATE NOT NULL,
  kind         TEXT NOT NULL DEFAULT 'milestone',   -- milestone | intention | reminder
  color        TEXT NOT NULL DEFAULT '#C9A84C',
  recurrence   TEXT NOT NULL DEFAULT 'none',         -- none | monthly | yearly
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.life_events ENABLE ROW LEVEL SECURITY;

-- FOR ALL USING also governs INSERT (Postgres reuses USING as WITH CHECK when omitted).
DROP POLICY IF EXISTS "life_events_own" ON public.life_events;
CREATE POLICY "life_events_own" ON public.life_events FOR ALL USING (auth.uid() = owner_id);

CREATE INDEX IF NOT EXISTS life_events_owner_idx ON public.life_events (owner_id, event_date);
