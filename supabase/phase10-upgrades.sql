-- ============================================================
-- PHASE 10 UPGRADES (migration 15)
-- Additive only. Nothing here alters an existing column and
-- nothing touches sadaka/zakat math.
--   #66 Keepalive visibility  → public.system_health
--   #51 Joint txn comments    → public.joint_txn_comments
--   #94 Gold & silver held    → public.metal_holdings
--
-- Safe to re-run. Run in Supabase → SQL Editor → Run.
-- ============================================================

-- ── #66 Keepalive / last-ping surface ───────────────────────
-- One row, id = 'keepalive'. Written by /api/keepalive ONLY when a
-- SUPABASE_SERVICE_ROLE_KEY is configured on Vercel; the weekly ping itself
-- works without it. Readable in-app so the 2-year pause risk stays visible.
CREATE TABLE IF NOT EXISTS public.system_health (
  id           TEXT PRIMARY KEY,
  last_ping_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.system_health ENABLE ROW LEVEL SECURITY;

-- Read-only to signed-in users. Writes come from the service role, which
-- bypasses RLS — so the client can never forge a "we're healthy" timestamp.
DROP POLICY IF EXISTS "system_health_read" ON public.system_health;
CREATE POLICY "system_health_read" ON public.system_health
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- ── #51 Comments on joint transactions ──────────────────────
CREATE TABLE IF NOT EXISTS public.joint_txn_comments (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  txn_id     UUID NOT NULL REFERENCES public.joint_account_txns(id) ON DELETE CASCADE,
  author_id  UUID NOT NULL REFERENCES auth.users(id),
  body       TEXT NOT NULL CHECK (length(trim(body)) > 0 AND length(body) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.joint_txn_comments ENABLE ROW LEVEL SECURITY;

-- The joint account is shared, so both brothers read every comment...
DROP POLICY IF EXISTS "joint_comments_read" ON public.joint_txn_comments;
CREATE POLICY "joint_comments_read" ON public.joint_txn_comments
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- ...but you may only post as yourself, and only edit or delete your own words.
DROP POLICY IF EXISTS "joint_comments_insert" ON public.joint_txn_comments;
CREATE POLICY "joint_comments_insert" ON public.joint_txn_comments
  FOR INSERT WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "joint_comments_update" ON public.joint_txn_comments;
CREATE POLICY "joint_comments_update" ON public.joint_txn_comments
  FOR UPDATE USING (auth.uid() = author_id);

DROP POLICY IF EXISTS "joint_comments_delete" ON public.joint_txn_comments;
CREATE POLICY "joint_comments_delete" ON public.joint_txn_comments
  FOR DELETE USING (auth.uid() = author_id);

CREATE INDEX IF NOT EXISTS idx_joint_comments_txn
  ON public.joint_txn_comments(txn_id, created_at);

-- ── #94 Gold & silver holdings (feeds zakat) ────────────────
-- Grams held, per person. Value is derived at read time from rates_cache, never
-- stored: a stored valuation would silently rot as the metal price moves.
CREATE TABLE IF NOT EXISTS public.metal_holdings (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id    UUID NOT NULL REFERENCES auth.users(id),
  metal       TEXT NOT NULL CHECK (metal IN ('gold', 'silver')),
  grams       NUMERIC(12,3) NOT NULL CHECK (grams >= 0),
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.metal_holdings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "metal_holdings_own" ON public.metal_holdings;
CREATE POLICY "metal_holdings_own" ON public.metal_holdings
  FOR ALL USING (auth.uid() = owner_id);

CREATE INDEX IF NOT EXISTS idx_metal_owner ON public.metal_holdings(owner_id) WHERE is_active;
