-- Streak-Reparatur (streak repair) as a reactive counterpart to the freeze (#237 follow-up).
--
-- The freeze protects *before* a miss; the repair restores a streak *after* it
-- was already lost, for a limited window and a higher LP price. To offer it we
-- must remember what was lost, so update_streak_after_review now records the
-- broken streak on a real reset. Repair, like every LP mutation, is one atomic
-- transaction (20260404130000_atomic_lp_operations.sql).

-- What streak was lost, and on which local day the loss was detected. Both stay
-- 0/null while a streak is healthy.
alter table profiles add column if not exists broken_streak int not null default 0;
alter table profiles add column if not exists broken_on date;

-- Extend the streak update so a genuine loss (a real streak >= 2 that reset)
-- leaves a repairable marker. Consecutive days, freeze-saves and same-day
-- reviews preserve any existing marker (so the repair window survives the
-- post-break reviews); a non-meaningful reset clears it.
create or replace function update_streak_after_review(p_user uuid, p_today date)
returns table(current_streak int, longest_streak int, last_review_date date,
              daily_goal int, streak_freezes int, freeze_used boolean)
language plpgsql as $$
declare v record; v_streak int; v_longest int; v_freezes int; v_used boolean := false;
        v_broken_streak int; v_broken_on date;
begin
  select p.current_streak, p.longest_streak, p.last_review_date, p.daily_goal,
         p.streak_freezes, p.broken_streak, p.broken_on
    into v from profiles p where p.id = p_user for update;
  if not found then return; end if;

  if v.last_review_date = p_today then
    return query select v.current_streak, v.longest_streak, v.last_review_date,
      v.daily_goal, v.streak_freezes, false;
    return;
  end if;

  -- Preserve existing repair marker unless this review is itself a fresh loss.
  v_broken_streak := v.broken_streak;
  v_broken_on := v.broken_on;

  if v.last_review_date = p_today - 1 then
    v_streak := v.current_streak + 1;
  elsif v.last_review_date = p_today - 2 and v.streak_freezes > 0 then
    v_streak := v.current_streak + 1;
    v_used := true;
  else
    v_streak := 1;
    if v.last_review_date is not null and v.current_streak >= 2 then
      v_broken_streak := v.current_streak;   -- a real streak was just lost
      v_broken_on := p_today;
    else
      v_broken_streak := 0;                  -- nothing worth repairing
      v_broken_on := null;
    end if;
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
      broken_streak = v_broken_streak,
      broken_on = v_broken_on,
      updated_at = now()
    where id = p_user;

  return query select v_streak, v_longest, p_today, v.daily_goal, v_freezes, v_used;
end; $$;
grant execute on function update_streak_after_review(uuid, date) to service_role;

-- Atomic repair: within `broken_on + 2` local days of a lost streak (>= 2),
-- spend LP to restore it. The restored value is the lost streak plus whatever
-- run was rebuilt since (so repairing on the same day gives back exactly the
-- lost streak + today). error_code: 'no_repair' (nothing to repair / window
-- passed) or 'insufficient_lp'.
create or replace function purchase_streak_repair(p_user uuid, p_cost int, p_today date)
returns table(allowed boolean, error_code text, new_balance int, new_streak int)
language plpgsql as $$
declare v record; v_new_streak int;
begin
  select current_streak, longest_streak, broken_streak, broken_on, lp_balance
    into v from profiles where id = p_user for update;
  if not found then
    return query select false, 'no_repair'::text, 0, 0; return;
  end if;

  if coalesce(v.broken_streak, 0) < 2 or v.broken_on is null or p_today > v.broken_on + 2 then
    return query select false, 'no_repair'::text, coalesce(v.lp_balance, 0), coalesce(v.current_streak, 0);
    return;
  end if;
  if v.lp_balance < p_cost then
    return query select false, 'insufficient_lp'::text, v.lp_balance, v.current_streak;
    return;
  end if;

  v_new_streak := v.broken_streak + v.current_streak;
  update profiles set
      lp_balance = lp_balance - p_cost,
      current_streak = v_new_streak,
      longest_streak = greatest(v_new_streak, v.longest_streak),
      broken_streak = 0,
      broken_on = null,
      updated_at = now()
    where id = p_user;
  insert into lp_transactions(user_id, type, amount, reason)
    values (p_user, 'spent', -p_cost, 'streak_repair');
  return query select true, null::text, v.lp_balance - p_cost, v_new_streak;
end; $$;
grant execute on function purchase_streak_repair(uuid, int, date) to service_role;
