-- Grant LP for a rewarded ad that AdMob Server-Side Verification (SSV) confirmed.
--
-- The reward is only booked AFTER the API route has cryptographically verified
-- Google's signature on the callback (see adSsvService). This function is the
-- money side: it credits LP under the daily ad cap and is idempotent per AdMob
-- transaction, so replaying the same signed callback cannot grant twice.
--
-- Uses a dedicated ledger type 'ad_ssv' (distinct from the retired client-side
-- 'ad_reward') so a partial unique index can enforce one grant per transaction,
-- exactly like the purchase idempotency guard in 20260709120000.

-- Allow the new ledger type.
alter table lp_transactions drop constraint if exists lp_transactions_type_check;
alter table lp_transactions add constraint lp_transactions_type_check
  check (type in (
    'abo_grant','earned','purchased','ad_reward','ad_ssv',
    'referral','spent','win_back','event_bonus','admin','refund'
  ));

-- One booking per AdMob transaction. Other types legitimately repeat reasons.
create unique index if not exists lp_transactions_ad_ssv_reason_uidx
  on lp_transactions (reason) where type = 'ad_ssv';

create or replace function grant_ad_ssv_lp(
  p_user uuid,
  p_amount int,
  p_ad_cap int,
  p_transaction_id text,
  p_today date)
returns table(granted int, already_processed boolean, new_balance int)
language plpgsql as $$
declare
  v_bal int; v_ads int; v_same boolean; v_grant int; v_rows int;
  v_reason text := 'ad_ssv_' || p_transaction_id;
begin
  select lp_balance, lp_ads_today, (lp_period_start = p_today)
    into v_bal, v_ads, v_same
    from profiles where id = p_user for update;
  if not found then
    return query select 0, false, 0; return;
  end if;

  -- Day-reset the ad counter, like earn_lp.
  if not v_same then v_ads := 0; end if;

  -- Grant up to the remaining daily ad cap.
  v_grant := least(greatest(p_amount, 0), greatest(p_ad_cap - v_ads, 0));

  -- Ledger insert IS the idempotency guard: a replayed transaction conflicts on
  -- lp_transactions_ad_ssv_reason_uidx and books nothing.
  insert into lp_transactions(user_id, type, amount, reason)
    values (p_user, 'ad_ssv', v_grant, v_reason)
    on conflict (reason) where type = 'ad_ssv' do nothing;
  get diagnostics v_rows = row_count;

  if v_rows = 0 then
    return query select 0, true, v_bal; return;  -- already processed
  end if;

  update profiles set
    lp_balance = v_bal + v_grant,
    lp_ads_today = v_ads + v_grant,
    lp_period_start = p_today,
    updated_at = now()
    where id = p_user;

  return query select v_grant, false, v_bal + v_grant;
end; $$;

grant execute on function grant_ad_ssv_lp(uuid, int, int, text, date) to service_role;
