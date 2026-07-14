-- Freunde-Streak (friend streak) — a shared streak two friends keep alive
-- together (#237 follow-up). Both must study on the same local day for the
-- shared flame to advance. A one-day gap can be bridged by a personal streak
-- freeze from either member ("Schutz rettet auch hier"). Progression runs in
-- SQL under a row lock so the two members' concurrent reviews stay correct.

-- One row per unordered pair, stored canonically as (low < high). Server-managed
-- (service role bypasses RLS), no client policies — mirrors streak_freeze_uses.
create table if not exists friend_streaks (
  user_low   uuid not null references profiles(id) on delete cascade,
  user_high  uuid not null references profiles(id) on delete cascade,
  status     text not null default 'pending' check (status in ('pending', 'active')),
  invited_by uuid not null references profiles(id) on delete cascade,
  current_streak   int not null default 0,
  longest_streak   int not null default 0,
  last_day_low     date,   -- last local day the low member studied
  last_day_high    date,   -- last local day the high member studied
  last_extended_on date,   -- last shared day the streak was counted (dedupe guard)
  created_at timestamptz not null default now(),
  primary key (user_low, user_high),
  check (user_low < user_high)
);
alter table friend_streaks enable row level security;

-- Invite a friend into a shared streak. Requires an existing friendship.
-- Returns: 'invited' (new pending), 'pending'/'active' (already exists),
-- 'not_friends', or 'self'.
create or replace function invite_friend_streak(p_inviter uuid, p_invitee uuid)
returns text language plpgsql as $$
declare v_low uuid; v_high uuid; v_status text;
begin
  if p_inviter = p_invitee then return 'self'; end if;
  if not exists (
    select 1 from friend_connections where user_id = p_inviter and friend_id = p_invitee
  ) then
    return 'not_friends';
  end if;
  v_low := least(p_inviter, p_invitee);
  v_high := greatest(p_inviter, p_invitee);
  select status into v_status from friend_streaks where user_low = v_low and user_high = v_high;
  if v_status is not null then return v_status; end if;
  insert into friend_streaks(user_low, user_high, status, invited_by)
    values (v_low, v_high, 'pending', p_inviter);
  return 'invited';
end; $$;
grant execute on function invite_friend_streak(uuid, uuid) to service_role;

-- The invitee accepts a pending invite. Only the other party (not the inviter)
-- can accept. Returns true when a pending invite was activated.
create or replace function accept_friend_streak(p_user uuid, p_other uuid)
returns boolean language plpgsql as $$
declare v_rows int;
begin
  update friend_streaks set status = 'active'
    where user_low = least(p_user, p_other) and user_high = greatest(p_user, p_other)
      and status = 'pending' and invited_by = p_other;
  get diagnostics v_rows = row_count;
  return v_rows > 0;
end; $$;
grant execute on function accept_friend_streak(uuid, uuid) to service_role;

-- Record that p_user studied on p_today, and advance every active shared streak
-- whose other member also studied today. Called after each review. The
-- last_extended_on guard makes it idempotent within a day.
create or replace function mark_friend_streak_day(p_user uuid, p_today date)
returns void language plpgsql as $$
declare fs record; v_low_day date; v_high_day date;
        v_current int; v_longest int; v_last date; v_saved boolean;
begin
  for fs in
    select * from friend_streaks
      where status = 'active' and (user_low = p_user or user_high = p_user)
      for update
  loop
    if fs.user_low = p_user then
      v_low_day := p_today; v_high_day := fs.last_day_high;
    else
      v_low_day := fs.last_day_low; v_high_day := p_today;
    end if;

    v_current := fs.current_streak;
    v_longest := fs.longest_streak;
    v_last := fs.last_extended_on;

    -- Shared day complete (both studied today) and not yet counted today.
    if v_low_day = p_today and v_high_day = p_today
       and fs.last_extended_on is distinct from p_today then
      if fs.last_extended_on is null then
        v_current := 1;
      elsif p_today = fs.last_extended_on + 1 then
        v_current := fs.current_streak + 1;
      elsif p_today = fs.last_extended_on + 2 then
        -- one shared day missed: a personal freeze from either member saves it
        v_saved := false;
        update profiles set streak_freezes = streak_freezes - 1
          where id = fs.user_low and streak_freezes > 0;
        if found then
          v_saved := true;
          insert into streak_freeze_uses(user_id, used_on) values (fs.user_low, p_today - 1)
            on conflict do nothing;
        else
          update profiles set streak_freezes = streak_freezes - 1
            where id = fs.user_high and streak_freezes > 0;
          if found then
            v_saved := true;
            insert into streak_freeze_uses(user_id, used_on) values (fs.user_high, p_today - 1)
              on conflict do nothing;
          end if;
        end if;
        v_current := case when v_saved then fs.current_streak + 1 else 1 end;
      else
        v_current := 1;
      end if;
      v_longest := greatest(v_current, fs.longest_streak);
      v_last := p_today;
    end if;

    update friend_streaks set
        last_day_low = v_low_day,
        last_day_high = v_high_day,
        current_streak = v_current,
        longest_streak = v_longest,
        last_extended_on = v_last
      where user_low = fs.user_low and user_high = fs.user_high;
  end loop;
end; $$;
grant execute on function mark_friend_streak_day(uuid, date) to service_role;
