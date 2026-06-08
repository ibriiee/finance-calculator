-- ============================================================
-- SADAKA RECIPIENTS (directory)
-- Saved people who receive sadaka (e.g. "Norine Unty").
-- Lets us track total received, last paid date, and who is overdue
-- so they can be prioritised in the next sadaka batch.
-- Shared directory — both brothers see & manage it.
-- Run in Supabase → SQL Editor → New Query → Run.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.sadaka_recipients (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  relation      TEXT,                       -- relative | needy | masjid | student | widow | other
  location      TEXT DEFAULT 'UAE',         -- UAE | Pakistan | other
  contact       TEXT,
  notes         TEXT,
  is_active     BOOLEAN DEFAULT true,
  created_by_id UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.sadaka_entries
  ADD COLUMN IF NOT EXISTS recipient_id UUID REFERENCES public.sadaka_recipients(id);

ALTER TABLE public.sadaka_recipients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sadaka_recipients_all" ON public.sadaka_recipients;
CREATE POLICY "sadaka_recipients_all" ON public.sadaka_recipients
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

ALTER PUBLICATION supabase_realtime ADD TABLE public.sadaka_recipients;
