-- Atomic milestone reward claim.
--
-- claimMilestoneReward previously did TWO separate round-trips:
--   1. insert into rewards_claimed  (idempotency guard)
--   2. add_lp                       (credit the balance + ledger)
-- If step 2 failed AFTER step 1 committed, the reward stayed marked "claimed"
-- while the LP were never credited — and because the guard row persists, every
-- retry short-circuits as "already claimed", so the LP are lost forever.
--
-- This function moves the guard and the credit into ONE function body (one tx):
-- either the reward is claimed AND the LP are credited together, or neither.
-- LP is real money, so this all-or-nothing behaviour matters.

create or replace function claim_milestone_lp(p_user uuid, p_reward_key text, p_amount int)
returns table(granted int, already_claimed boolean, new_balance int)
language plpgsql as $$
declare
  v_rows int;
  v_bal int;
begin
  -- Idempotency guard: only the first claim inserts a row. ON CONFLICT keeps
  -- this a no-op for repeat calls instead of raising on the UNIQUE constraint.
  insert into rewards_claimed(user_id, reward_key, lp_granted)
    values (p_user, p_reward_key, p_amount)
    on conflict (user_id, reward_key) do nothing;
  get diagnostics v_rows = row_count;

  if v_rows = 0 then
    -- Already claimed on a prior call → idempotent no-op, report current balance.
    select lp_balance into v_bal from profiles where id = p_user;
    return query select 0, true, coalesce(v_bal, 0);
    return;
  end if;

  -- First claim → credit the balance and write the ledger row in the SAME tx.
  -- If the profile did not exist, the guard insert above would already have
  -- failed on the rewards_claimed → profiles FK and rolled everything back, so
  -- reaching here means the profile exists.
  update profiles set lp_balance = lp_balance + p_amount, updated_at = now()
    where id = p_user returning lp_balance into v_bal;
  insert into lp_transactions(user_id, type, amount, reason)
    values (p_user, 'earned', p_amount, 'milestone_' || p_reward_key);

  return query select p_amount, false, v_bal;
end; $$;

grant execute on function claim_milestone_lp(uuid, text, int) to service_role;
