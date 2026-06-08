-- FIX: Brother Ledger was hanging because each user could only see their OWN profile.
-- This let both brothers READ each other's profile (name/id), while still
-- restricting writes to their own row.
-- Run this in Supabase → SQL Editor → New Query → Run.

DROP POLICY IF EXISTS "profiles_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;

CREATE POLICY "profiles_select_all" ON public.profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Make sure both profiles have proper display names so the app shows
-- "Abu Bakar owes you" instead of "undefined owes you".
-- Adjust the emails if different.
UPDATE public.profiles SET display_name = 'Ibrahim'
  WHERE email = 'ibrahim_naeem@outlook.com';
UPDATE public.profiles SET display_name = 'Abu Bakar'
  WHERE email = 'bakarnaeem@hotmail.com';
