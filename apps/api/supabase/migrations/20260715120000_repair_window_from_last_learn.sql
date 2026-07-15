-- Fix (Lara): the streak-repair window was measured from the day the user came
-- BACK (p_today), so someone absent for weeks could return, learn one card, and
-- still repair a long-dead streak for 40 LP. The window must count from the last
-- day the streak was actually alive, so a long absence is genuinely gone.
--
-- Only line changed vs 20260714120000: on a real reset, broken_on now records
-- v.last_review_date (the last alive day) instead of p_today. The window check
-- (broken_on + 2 in purchase_streak_repair / getStreakInfo) is unchanged, so it
-- now means "repairable only if your last learning day is at most 2 days ago".

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
      v_broken_streak := v.current_streak;
      v_broken_on := v.last_review_date;   -- window counts from the last alive day
    else
      v_broken_streak := 0;
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
