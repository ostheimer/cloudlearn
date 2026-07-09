-- Idempotent LP-pack purchase grant.
--
-- The RevenueCat webhook credited purchases with a check-then-act guard:
--   1. select ... where reason = purchase_<txid>   (isLpTransactionProcessed)
--   2. grantLpPurchase → add_lp                     (credit)
-- There is no UNIQUE constraint on the purchase reason, so two webhook
-- deliveries for the SAME transaction that arrive together both read "not yet
-- booked" (step 1) and both credit (step 2) → the LP pack is granted twice.
-- LP is real money, so this is a real loss.
--
-- Fix: let the database enforce uniqueness. A partial unique index makes a given
-- purchase reason bookable at most once, and grant_lp_purchase does the ledger
-- insert (guarded by that index) and the balance credit in ONE transaction.

-- Only 'purchased' rows are unique per reason. Normal spends (aiScan, pdfImport,
-- session, …) legitimately repeat the same reason and must stay unconstrained.
create unique index if not exists lp_transactions_purchased_reason_uidx
  on lp_transactions (reason) where type = 'purchased';

create or replace function grant_lp_purchase(p_user uuid, p_amount int, p_reason text)
returns table(granted int, already_granted boolean, new_balance int)
language plpgsql as $$
declare
  v_rows int;
  v_bal int;
begin
  -- Ledger insert is the idempotency guard: a duplicate purchase reason conflicts
  -- on lp_transactions_purchased_reason_uidx and inserts nothing.
  insert into lp_transactions(user_id, type, amount, reason)
    values (p_user, 'purchased', p_amount, p_reason)
    on conflict (reason) where type = 'purchased' do nothing;
  get diagnostics v_rows = row_count;

  if v_rows = 0 then
    -- Already granted on a prior delivery → idempotent no-op.
    select lp_balance into v_bal from profiles where id = p_user;
    return query select 0, true, coalesce(v_bal, 0);
    return;
  end if;

  -- First delivery for this transaction → credit the balance in the SAME tx.
  update profiles set lp_balance = lp_balance + p_amount, updated_at = now()
    where id = p_user returning lp_balance into v_bal;

  return query select p_amount, false, v_bal;
end; $$;

grant execute on function grant_lp_purchase(uuid, int, text) to service_role;
