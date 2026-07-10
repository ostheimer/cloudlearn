-- Persistent, cross-instance rate limiting. Atomic check-and-increment in one statement (also race-safe).
create table if not exists rate_limits (
  key text primary key,
  count int not null default 0,
  window_start timestamptz not null default now()
);

create or replace function check_rate_limit(p_key text, p_limit int, p_window_seconds int default 60)
returns boolean language plpgsql as $$
declare v_count int;
begin
  insert into rate_limits(key, count, window_start)
    values (p_key, 1, now())
  on conflict (key) do update set
    count = case when now() - rate_limits.window_start >= make_interval(secs => p_window_seconds)
                 then 1 else rate_limits.count + 1 end,
    window_start = case when now() - rate_limits.window_start >= make_interval(secs => p_window_seconds)
                        then now() else rate_limits.window_start end
  returning count into v_count;
  return v_count <= p_limit;
end; $$;
grant execute on function check_rate_limit(text, int, int) to service_role;

-- Persistent idempotency store (first write wins).
create table if not exists idempotency_keys (
  key text primary key,
  response jsonb,
  created_at timestamptz not null default now()
);
