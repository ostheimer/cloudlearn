-- Harden profiles against client-side privilege escalation.
-- The "users_own_profile" RLS policy is `for all using (auth.uid() = id)` with no WITH CHECK,
-- so an authenticated user could PATCH their own profiles row via PostgREST and set
-- lp_balance / subscription_tier / ... themselves (self-mint LP, free Pro). All profile
-- mutations happen server-side via the service role; the client never writes profiles directly.
-- Fix: revoke blanket UPDATE from clients and re-grant ONLY the cosmetic, user-editable columns.
-- service_role is unaffected and keeps full write access.
REVOKE UPDATE ON public.profiles FROM anon, authenticated;
GRANT UPDATE (display_name, avatar_url, preferred_language, locale, timezone)
  ON public.profiles TO authenticated;
