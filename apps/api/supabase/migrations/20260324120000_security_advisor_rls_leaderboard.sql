-- Security Advisor (Supabase splinter) fixes — 2026-03-24
-- Addresses: rls_disabled_in_public (lp_transactions, rewards_claimed),
--            security_definer_view (leaderboard_public)
--
-- LP tables are accessed only from the API via the service role key, which bypasses RLS.
-- Enabling RLS with no policies denies direct PostgREST access for anon/authenticated.

ALTER TABLE public.lp_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rewards_claimed ENABLE ROW LEVEL SECURITY;

-- View: use invoker rights so underlying table RLS applies (no privilege escalation)
CREATE OR REPLACE VIEW public.leaderboard_public
WITH (security_invoker = true) AS
SELECT
  p.id,
  COALESCE(p.display_name, 'Lernender') AS display_name,
  p.avatar_url,
  p.lp_balance,
  p.subscription_tier,
  COALESCE(streak.current_streak, 0) AS current_streak
FROM profiles p
LEFT JOIN (
  SELECT id, current_streak FROM profiles
) streak ON streak.id = p.id
WHERE p.lp_balance > 0
ORDER BY p.lp_balance DESC;
