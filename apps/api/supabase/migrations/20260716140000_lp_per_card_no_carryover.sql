-- Session-LP: 1 Punkt pro Karte, Überschuss über dem Tageslimit verfällt.
--
-- Vorher: 5 LP je vollem 5-Karten-Block, und ALLES nicht Ausgezahlte blieb
-- offen — auch der Teil, der nur am Tageslimit gescheitert war. Das Limit
-- begrenzte damit nichts, es streckte die Auszahlung nur:
--
--   Mo: 80 Karten -> 30 LP, 50 Karten bleiben offen
--   Di:  5 Karten -> 30 LP (aus dem Übertrag)
--   Mi:  1 Karte  -> 20 LP (Rest des Übertrags)
--   = 86 Karten -> 80 LP, obwohl das Limit 30/Tag lautet.
--
-- Missbrauchsseite: Wer einmalig viele Reviews einträgt (die Review-Route hat
-- kein Rate-Limit), konnte den Vorrat portionsweise über Wochen abholen, ohne
-- je wieder zu lernen. Das Limit teilte die Beute nur in Tagesraten auf.
--
-- Neu: Jeder Tag zählt für sich. Alles Offene wird bei der Abrechnung als
-- erledigt markiert — ausgezahlt wird nur bis zum Tageslimit, der Rest
-- verfällt. Zusammen mit p_cards_per_chunk = 1 entfällt auch die Blockbildung,
-- die dazu führte, dass 3 gelernte Karten 0 LP ergaben.
--
-- Unverändert: Grundlage sind ausschließlich die echten review_logs (der
-- Client kann keine Menge behaupten), die Auszahlung ist atomar unter
-- Zeilensperre, das Wasserzeichen verhindert Doppelauszahlung, und die
-- Tageszähler laufen auf Berlin-Zeit (#211).
create or replace function public.earn_session_lp(
  p_user uuid,
  p_lp_per_chunk integer,
  p_cards_per_chunk integer,
  p_earn_cap integer,
  p_today date
)
returns table(granted integer, new_balance integer, cap_reached boolean)
language plpgsql
as $function$
DECLARE
  v_bal int; v_earned int; v_ads int; v_rewarded int; v_same boolean;
  v_total int; v_pending int; v_raw int; v_remaining int; v_grant int;
BEGIN
  SELECT lp_balance, lp_earned_today, lp_ads_today, lp_rewarded_review_count,
         (lp_period_start = p_today)
    INTO v_bal, v_earned, v_ads, v_rewarded, v_same
    FROM public.profiles WHERE id = p_user FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT 0, 0, false; RETURN; END IF;

  IF NOT v_same THEN v_earned := 0; v_ads := 0; END IF;

  SELECT count(*) INTO v_total FROM public.review_logs WHERE user_id = p_user;
  v_pending := greatest(v_total - v_rewarded, 0);

  -- Nichts Offenes: nicht anfassen. Sonst würde ein Aufruf ohne neue Reviews
  -- lp_period_start verschieben und damit den Tageszähler verfälschen.
  IF v_pending = 0 THEN
    RETURN QUERY SELECT 0, v_bal, false;
    RETURN;
  END IF;

  v_raw := (v_pending / p_cards_per_chunk) * p_lp_per_chunk;
  v_remaining := greatest(p_earn_cap - v_earned, 0);
  v_grant := least(v_raw, v_remaining);

  -- Der Kern der Änderung: Alles Offene gilt als abgerechnet, egal wie viel
  -- davon bezahlt wurde. Was über dem Tageslimit lag, verfällt hier — es kann
  -- an keinem späteren Tag mehr abgeholt werden.
  UPDATE public.profiles SET
    lp_balance = v_bal + v_grant,
    lp_earned_today = v_earned + v_grant,
    lp_ads_today = v_ads,
    lp_rewarded_review_count = v_rewarded + v_pending,
    lp_period_start = p_today,
    updated_at = now()
    WHERE id = p_user;

  -- Kein Ledger-Eintrag über 0 LP: der Kontoauszug soll Bewegungen zeigen,
  -- keine Nullzeilen. cap_reached sagt der Oberfläche, dass es etwas gab,
  -- das Limit aber schon voll war.
  IF v_grant > 0 THEN
    INSERT INTO public.lp_transactions(user_id, type, amount, reason)
      VALUES (p_user, 'earned', v_grant, 'session');
  END IF;

  RETURN QUERY SELECT v_grant, v_bal + v_grant, (v_raw > 0 AND v_remaining <= 0);
END; $function$;

grant execute on function public.earn_session_lp(uuid, int, int, int, date) to service_role;
