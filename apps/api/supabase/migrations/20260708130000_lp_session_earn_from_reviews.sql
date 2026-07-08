-- Tie "session" LP earning to server-recorded reviews instead of a client-asserted
-- card count. LP is real money, so the client must never be the source of truth for
-- how many cards were studied. The authoritative record is `review_logs` (one row per
-- reviewed card, deduped by idempotency key in storeReview).
--
-- Anti-double-reward: a monotonic watermark counts how many of the user's reviews have
-- already been converted into session LP. Each earn pays only for the reviews above the
-- watermark, in whole chunks, then advances the watermark by exactly what it paid for.

-- 1. Watermark column. Not client-writable: blanket UPDATE on profiles was revoked from
--    clients in 20260404140000; only service_role (via the RPC below) can move it.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS lp_rewarded_review_count INTEGER NOT NULL DEFAULT 0;

-- 2. Baseline backfill: treat every review recorded BEFORE this migration as already
--    rewarded, so shipping the feature does not retroactively pay out historical reviews.
UPDATE public.profiles p
   SET lp_rewarded_review_count = COALESCE(
     (SELECT count(*) FROM public.review_logs r WHERE r.user_id = p.id), 0
   );

-- 3. Atomic session earn. Under a single row lock: day-reset the per-day counters,
--    count real reviews, pay for whole unrewarded chunks up to the daily cap, advance
--    the watermark, and write the ledger row — mirroring earn_lp's atomicity guarantees.
CREATE OR REPLACE FUNCTION earn_session_lp(
  p_user uuid,
  p_lp_per_chunk int,
  p_cards_per_chunk int,
  p_earn_cap int,
  p_today date)
RETURNS TABLE(granted int, new_balance int, cap_reached boolean)
LANGUAGE plpgsql AS $$
DECLARE
  v_bal int; v_earned int; v_ads int; v_rewarded int; v_same boolean;
  v_total int; v_pending int; v_raw int; v_remaining int; v_grant int; v_consumed int;
BEGIN
  SELECT lp_balance, lp_earned_today, lp_ads_today, lp_rewarded_review_count,
         (lp_period_start = p_today)
    INTO v_bal, v_earned, v_ads, v_rewarded, v_same
    FROM public.profiles WHERE id = p_user FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT 0, 0, false; RETURN; END IF;

  -- Day-reset the per-day counters, exactly like earn_lp.
  IF NOT v_same THEN v_earned := 0; v_ads := 0; END IF;

  -- Server-side truth: how many reviews this user has actually recorded.
  SELECT count(*) INTO v_total FROM public.review_logs WHERE user_id = p_user;
  v_pending := greatest(v_total - v_rewarded, 0);

  -- Whole chunks only (e.g. 5 LP per 5 recorded cards), then clamp to the remaining cap.
  v_raw := (v_pending / p_cards_per_chunk) * p_lp_per_chunk;
  v_remaining := greatest(p_earn_cap - v_earned, 0);
  v_grant := least(v_raw, v_remaining);
  -- Keep the grant a whole number of chunks so the watermark advance stays exact even
  -- if a future cap is not a multiple of the chunk.
  v_grant := (v_grant / p_lp_per_chunk) * p_lp_per_chunk;

  IF v_grant <= 0 THEN
    -- cap_reached=true only when reviews were pending but the daily cap blocked them.
    RETURN QUERY SELECT 0, v_bal, (v_raw > 0 AND v_remaining <= 0);
    RETURN;
  END IF;

  -- Advance the watermark by exactly the reviews we just paid for.
  v_consumed := (v_grant / p_lp_per_chunk) * p_cards_per_chunk;

  UPDATE public.profiles SET
    lp_balance = v_bal + v_grant,
    lp_earned_today = v_earned + v_grant,
    lp_ads_today = v_ads,
    lp_rewarded_review_count = v_rewarded + v_consumed,
    lp_period_start = p_today,
    updated_at = now()
    WHERE id = p_user;

  INSERT INTO public.lp_transactions(user_id, type, amount, reason)
    VALUES (p_user, 'earned', v_grant, 'session');

  RETURN QUERY SELECT v_grant, v_bal + v_grant, false;
END; $$;

GRANT EXECUTE ON FUNCTION earn_session_lp(uuid, int, int, int, date) TO service_role;
