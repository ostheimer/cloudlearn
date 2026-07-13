-- Streak-Schutz (streak freeze) as an LP store item (#237).
--
-- A freeze is a consumable bought with LP. When exactly one local day was
-- missed, the next review consumes one freeze and the streak keeps counting
-- instead of resetting. Purchase and consumption are single Postgres
-- transactions for the same reason spend_lp/earn_lp are
-- (20260404130000_atomic_lp_operations.sql): concurrent requests must never
-- double-spend LP or double-consume a freeze.

-- How many freezes the user currently owns.
alter table profiles add column if not exists streak_freezes int not null default 0;

-- One row per covered day, so the streak calendar can show where a freeze
-- was used. Server-managed: RLS on, no client policies (the service role
-- bypasses RLS, like the other server-only tables).
create table if not exists streak_freeze_uses (
  user_id uuid not null references profiles(id) on delete cascade,
  used_on date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, used_on)
);
alter table streak_freeze_uses enable row level security;

-- Atomic purchase: balance guard, ownership cap, counter increment and ledger
-- insert in one statement + tx. When allowed = false, error_code says why:
-- 'max_owned' (cap wins if both fail) or 'insufficient_lp'.
create or replace function purchase_streak_freeze(p_user uuid, p_cost int, p_max int)
returns table(allowed boolean, error_code text, new_balance int, freezes int)
language plpgsql as $$
declare v_balance int; v_freezes int;
begin
  update profiles set
      lp_balance = lp_balance - p_cost,
      streak_freezes = streak_freezes + 1,
      updated_at = now()
    where id = p_user and lp_balance >= p_cost and streak_freezes < p_max
    returning lp_balance, streak_freezes into v_balance, v_freezes;
  if found then
    insert into lp_transactions(user_id, type, amount, reason)
      values (p_user, 'spent', -p_cost, 'streak_freeze');
    return query select true, null::text, v_balance, v_freezes;
  else
    select lp_balance, streak_freezes into v_balance, v_freezes
      from profiles where id = p_user;
    return query select false,
      case when coalesce(v_freezes, 0) >= p_max then 'max_owned' else 'insufficient_lp' end,
      coalesce(v_balance, 0), coalesce(v_freezes, 0);
  end if;
end; $$;
grant execute on function purchase_streak_freeze(uuid, int, int) to service_role;

-- Atomic streak update, replacing the API's read-modify-write (#211 follow-up):
-- the row lock makes concurrent reviews harmless. Consumes one freeze when
-- exactly one local day was missed and records the covered day for the
-- calendar. A NULL last_review_date (first ever review) falls through every
-- date comparison into the reset branch, which is exactly right: streak = 1.
create or replace function update_streak_after_review(p_user uuid, p_today date)
returns table(current_streak int, longest_streak int, last_review_date date,
              daily_goal int, streak_freezes int, freeze_used boolean)
language plpgsql as $$
declare v record; v_streak int; v_longest int; v_freezes int; v_used boolean := false;
begin
  select p.current_streak, p.longest_streak, p.last_review_date, p.daily_goal, p.streak_freezes
    into v from profiles p where p.id = p_user for update;
  if not found then return; end if;

  if v.last_review_date = p_today then
    return query select v.current_streak, v.longest_streak, v.last_review_date,
      v.daily_goal, v.streak_freezes, false;
    return;
  end if;

  if v.last_review_date = p_today - 1 then
    v_streak := v.current_streak + 1;
  elsif v.last_review_date = p_today - 2 and v.streak_freezes > 0 then
    v_streak := v.current_streak + 1;
    v_used := true;
  else
    v_streak := 1;
  end if;

  v_longest := greatest(v_streak, v.longest_streak);
  v_freezes := v.streak_freezes - (case when v_used then 1 else 0 end);

  if v_used then
    insert into streak_freeze_uses(user_id, used_on)
      values (p_user, p_today - 1)
      on conflict do nothing;
  end if;

  update profiles set
      current_streak = v_streak,
      longest_streak = v_longest,
      last_review_date = p_today,
      streak_freezes = v_freezes,
      updated_at = now()
    where id = p_user;

  return query select v_streak, v_longest, p_today, v.daily_goal, v_freezes, v_used;
end; $$;
grant execute on function update_streak_after_review(uuid, date) to service_role;
