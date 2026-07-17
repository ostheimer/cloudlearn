-- Prüfungen geben keine Lernpunkte mehr (Entkopplung, Schritt 6).
--
-- Laras Regel: „Beim Test sollte man keine Lernpunkte bekommen oder etwas bei
-- Tagesziel, da man ja im Prinzip nicht gelernt hat." Der Streak soll trotzdem
-- halten und die Trefferquote in die Statistik — beides hängt nicht an dieser
-- Funktion, sondern am Eintrag selbst, der weiterhin geschrieben wird.
--
-- 'quiz' und 'match' zählen bewusst MIT: Laras „bei den anderen sollte man
-- schon wenigstens irgendetwas bekommen". Sie fassen nur den Lernplan nicht an
-- (Schritt 5) — dafür sorgt der Server, nicht diese Zeile.
--
-- FÜR SICH WIRKUNGSLOS, und das ist der ganze Punkt der Reihenfolge:
-- Vor dem Anwenden verifiziert — es gibt aktuell NULL Zeilen mit mode='test'
-- (431 Zeilen, alle 'flashcard'). v_total ändert sich dadurch nicht, die
-- Auszahlung bleibt exakt gleich. Erst Schritt 7 lässt die Web-Prüfung ihren
-- Modus schicken.
--
-- WARUM DIESE REIHENFOLGE ZWINGEND IST: Andersherum — erst Clients, dann
-- Filter — wären zuerst test-Zeilen entstanden und über v_total mitbezahlt
-- worden. Das Wasserzeichen lp_rewarded_review_count wäre mitgewandert. Baut
-- man den Filter DANACH ein, fällt v_total UNTER das Wasserzeichen,
-- greatest(v_total - v_rewarded, 0) liefert 0 — und echte Lern-LP würden
-- verschluckt, bis der Nutzer die Differenz nachgelernt hat.
--
-- Unverändert: Grundlage bleiben ausschließlich echte review_logs (der Client
-- kann keine Menge behaupten), Zeilensperre, Wasserzeichen gegen
-- Doppelauszahlung, Tageskappe, Berlin-Mitternacht (#211).
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
  v_total int; v_pending int; v_raw int; v_remaining int; v_grant int; v_consumed int;
BEGIN
  SELECT lp_balance, lp_earned_today, lp_ads_today, lp_rewarded_review_count,
         (lp_period_start = p_today)
    INTO v_bal, v_earned, v_ads, v_rewarded, v_same
    FROM public.profiles WHERE id = p_user FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT 0, 0, false; RETURN; END IF;

  IF NOT v_same THEN v_earned := 0; v_ads := 0; END IF;

  -- DIE EINE ÄNDERUNG: Prüfungen zählen nicht mit.
  SELECT count(*) INTO v_total FROM public.review_logs
    WHERE user_id = p_user AND mode <> 'test';
  v_pending := greatest(v_total - v_rewarded, 0);

  v_raw := (v_pending / p_cards_per_chunk) * p_lp_per_chunk;
  v_remaining := greatest(p_earn_cap - v_earned, 0);
  v_grant := least(v_raw, v_remaining);
  v_grant := (v_grant / p_lp_per_chunk) * p_lp_per_chunk;

  IF v_grant <= 0 THEN
    RETURN QUERY SELECT 0, v_bal, (v_raw > 0 AND v_remaining <= 0);
    RETURN;
  END IF;

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
END; $function$;

grant execute on function public.earn_session_lp(uuid, int, int, int, date) to service_role;
