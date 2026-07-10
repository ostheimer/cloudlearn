-- Enable RLS on the persistence tables added on 2026-07-10 (rate limiting, idempotency, mathpix budget).
-- They were created (20260710120000 / 20260710140000) without RLS while anon/authenticated hold write
-- grants, leaving them writable via PostgREST with the public anon key. No policies are needed: the server
-- uses the service_role client, which bypasses RLS; with RLS on and no policy, anon/authenticated get no
-- access. Mirrors 20260324120000 (lp_transactions). Closes #202.
--
-- NOTE: already applied to production on 2026-07-10 via MCP (registered as version 20260710125511) to close
-- the live hole immediately. This file makes the change reproducible on fresh databases and is ordered after
-- the table creations. Re-running ALTER ... ENABLE ROW LEVEL SECURITY on an already-enabled table is a no-op.
alter table public.rate_limits      enable row level security;
alter table public.idempotency_keys enable row level security;
alter table public.mathpix_usage    enable row level security;
