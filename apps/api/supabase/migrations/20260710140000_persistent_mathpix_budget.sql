-- Persistent per-user Mathpix cost budget (was an in-memory Map, lost on serverless cold start). (#80)
create table if not exists mathpix_usage (
  user_id uuid primary key,
  spent_usd numeric(12,6) not null default 0,
  updated_at timestamptz not null default now()
);

-- Atomic consume: add cost and return the new total (race-safe).
create or replace function consume_mathpix_cost(p_user uuid, p_cost numeric)
returns numeric language plpgsql as $$
declare v_spent numeric;
begin
  insert into mathpix_usage(user_id, spent_usd) values (p_user, p_cost)
  on conflict (user_id) do update set spent_usd = mathpix_usage.spent_usd + p_cost, updated_at = now()
  returning spent_usd into v_spent;
  return v_spent;
end; $$;
grant execute on function consume_mathpix_cost(uuid, numeric) to service_role;
