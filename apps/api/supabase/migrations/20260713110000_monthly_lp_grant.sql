-- Idempotent monthly LP grant for Pro subscribers (#209 Part A).
-- One grant per (user, billing period); re-delivered webhooks never double-grant.
--
-- grantMonthlyLp (lpService) had no caller, so Pro subscribers never received their
-- monthly 300 LP allotment (#209). The subscription webhook now calls grant_monthly_lp
-- on each INITIAL_PURCHASE / RENEWAL. The (user_id, period) primary key is the
-- idempotency guard: a re-delivered RevenueCat webhook for the same billing period
-- inserts nothing and credits nothing.

create table if not exists monthly_lp_grants (
  user_id uuid not null references profiles(id) on delete cascade,
  period text not null,
  tier text not null,
  granted_at timestamptz not null default now(),
  primary key (user_id, period)
);

-- Server-only table: the API uses the service_role client, which bypasses RLS.
-- With RLS on and no policy, anon/authenticated get no direct PostgREST access.
-- Mirrors the other LP tables (20260324120000: lp_transactions, rewards_claimed).
alter table monthly_lp_grants enable row level security;

-- Idempotent monthly credit. Returns true only when THIS call performed the grant;
-- a re-delivered webhook for the same (user, period) hits the ON CONFLICT no-op and
-- returns false without touching the balance. The credit reuses the existing atomic
-- add_lp(p_user, p_amount, p_type, p_reason) so lp_transactions stays the single
-- source of truth; the reason embeds the period to keep the audit trail unambiguous.
-- Guard insert + credit run in one function body → one transaction, all-or-nothing.
create or replace function grant_monthly_lp(p_user uuid, p_tier text, p_amount int, p_period text)
returns boolean language plpgsql as $$
begin
  if p_amount <= 0 then return false; end if;
  insert into monthly_lp_grants(user_id, period, tier) values (p_user, p_period, p_tier)
    on conflict (user_id, period) do nothing;
  if not found then return false; end if;  -- already granted this period
  perform add_lp(p_user, p_amount, 'abo_grant', 'monthly_' || p_tier || '_' || p_period);
  return true;
end; $$;

grant execute on function grant_monthly_lp(uuid, text, int, text) to service_role;
