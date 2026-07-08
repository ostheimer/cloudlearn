-- Atomic LP (Lernpunkte) balance operations.
--
-- LP is real money (paid packs), so mutating `profiles.lp_balance` with a
-- read-modify-write in application code is a correctness bug: two concurrent
-- requests can both read the same balance and double-spend / lose an update.
--
-- These functions move the check-and-mutate into single Postgres statements so
-- the balance guard and the ledger insert happen atomically inside one tx.

-- Atomic conditional spend: deducts only if balance suffices; writes ledger in the same tx.
create or replace function spend_lp(p_user uuid, p_cost int, p_reason text)
returns table(allowed boolean, new_balance int)
language plpgsql as $$
declare v_balance int;
begin
  update profiles set lp_balance = lp_balance - p_cost, updated_at = now()
    where id = p_user and lp_balance >= p_cost
    returning lp_balance into v_balance;
  if found then
    insert into lp_transactions(user_id, type, amount, reason)
      values (p_user, 'spent', -p_cost, p_reason);
    return query select true, v_balance;
  else
    select lp_balance into v_balance from profiles where id = p_user;
    return query select false, coalesce(v_balance, 0);
  end if;
end; $$;
grant execute on function spend_lp(uuid, int, text) to service_role, authenticated;

-- Atomic earn with day-reset + per-day caps under a row lock.
create or replace function earn_lp(
  p_user uuid, p_raw_grant int, p_is_ad boolean,
  p_earn_cap int, p_ad_cap int, p_type text, p_today date)
returns table(granted int, new_balance int, cap_reached boolean)
language plpgsql as $$
declare v_bal int; v_earned int; v_ads int; v_same boolean; v_grant int; v_used int; v_cap int;
begin
  select lp_balance, lp_earned_today, lp_ads_today, (lp_period_start = p_today)
    into v_bal, v_earned, v_ads, v_same
    from profiles where id = p_user for update;
  if not found then return query select 0, 0, false; return; end if;
  if not v_same then v_earned := 0; v_ads := 0; end if;
  if p_raw_grant <= 0 then return query select 0, v_bal, false; return; end if;
  if p_is_ad then v_used := v_ads; v_cap := p_ad_cap; else v_used := v_earned; v_cap := p_earn_cap; end if;
  v_grant := least(p_raw_grant, greatest(v_cap - v_used, 0));
  if v_grant <= 0 then return query select 0, v_bal, true; return; end if;
  update profiles set
    lp_balance = v_bal + v_grant,
    lp_earned_today = case when p_is_ad then v_earned else v_earned + v_grant end,
    lp_ads_today = case when p_is_ad then v_ads + v_grant else v_ads end,
    lp_period_start = p_today, updated_at = now()
    where id = p_user;
  insert into lp_transactions(user_id, type, amount, reason)
    values (p_user, case when p_is_ad then 'ad_reward' else 'earned' end, v_grant, p_type);
  return query select v_grant, v_bal + v_grant, false;
end; $$;
grant execute on function earn_lp(uuid, int, boolean, int, int, text, date) to service_role, authenticated;

-- Atomic unconditional credit (monthly grant, milestone, purchase).
create or replace function add_lp(p_user uuid, p_amount int, p_type text, p_reason text)
returns int language plpgsql as $$
declare v_bal int;
begin
  update profiles set lp_balance = lp_balance + p_amount, updated_at = now()
    where id = p_user returning lp_balance into v_bal;
  if not found then return null; end if;
  insert into lp_transactions(user_id, type, amount, reason) values (p_user, p_type, p_amount, p_reason);
  return v_bal;
end; $$;
grant execute on function add_lp(uuid, int, text, text) to service_role, authenticated;
