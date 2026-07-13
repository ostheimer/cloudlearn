-- Atomic, idempotent referral claim with a per-referrer cap (#203).
--
-- The referral claim route previously did a non-atomic read-modify-write across
-- FOUR separate round-trips (claimer lookup, referrer lookup, referrer grant,
-- claimer grant) with only a self-referral check and NO cap. That is:
--   * farmable  — one referrer could collect unlimited 50 LP payouts;
--   * lost-update prone — concurrent grants to the same referrer overwrite each
--     other's lp_balance (last write wins), so LP drift/vanish;
--   * TOCTOU racy — two concurrent claims by the same claimer both pass the
--     "already referred?" check before either writes referred_by.
--
-- This function collapses the whole flow into ONE transaction:
--   * the `for update` row-lock on the claimer row closes the TOCTOU race;
--   * the `referred_by is null` guard makes retries idempotent (a second claim
--     by the same claimer short-circuits as 'already_referred');
--   * the `for update` row-lock on the referrer row serialises concurrent
--     claims against the SAME referrer, so the cap count is exact (no two
--     claims can both read a stale count below the cap and both pay out).
create or replace function claim_referral(
  p_claimer uuid,
  p_code text,
  p_referrer_bonus int,
  p_claimer_bonus int,
  p_referrer_cap int
) returns jsonb language plpgsql as $$
declare
  v_referrer uuid;
  v_claimer_referred uuid;
  v_new_balance int;
  v_referrer_count int;
  v_referrer_granted int := 0;
begin
  select referred_by into v_claimer_referred from profiles where id = p_claimer for update;
  if not found then return jsonb_build_object('status','claimer_not_found'); end if;
  if v_claimer_referred is not null then return jsonb_build_object('status','already_referred'); end if;

  select id into v_referrer from profiles where referral_code = p_code;
  if v_referrer is null then return jsonb_build_object('status','code_not_found'); end if;
  if v_referrer = p_claimer then return jsonb_build_object('status','self'); end if;

  update profiles set lp_balance = coalesce(lp_balance,0) + p_claimer_bonus, referred_by = v_referrer
    where id = p_claimer returning lp_balance into v_new_balance;
  insert into lp_transactions(user_id, type, amount, reason)
    values (p_claimer, 'referral', p_claimer_bonus, 'referral_received_from_'||v_referrer);

  perform 1 from profiles where id = v_referrer for update;
  select count(*) into v_referrer_count from lp_transactions
    where user_id = v_referrer and type='referral' and reason like 'referral_sent_to_%';
  if v_referrer_count < p_referrer_cap then
    update profiles set lp_balance = coalesce(lp_balance,0) + p_referrer_bonus where id = v_referrer;
    insert into lp_transactions(user_id, type, amount, reason)
      values (v_referrer, 'referral', p_referrer_bonus, 'referral_sent_to_'||p_claimer);
    v_referrer_granted := p_referrer_bonus;
  end if;

  return jsonb_build_object('status','ok','claimerBonus',p_claimer_bonus,'referrerBonus',v_referrer_granted,'referrerCapped',(v_referrer_granted = 0),'newBalance',v_new_balance);
end; $$;
grant execute on function claim_referral(uuid, text, int, int, int) to service_role;
