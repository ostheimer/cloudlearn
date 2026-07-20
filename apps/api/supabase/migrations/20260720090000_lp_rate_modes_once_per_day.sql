-- Rate-Modi zahlen je Karte nur EINMAL pro Tag (Entkopplung, Schritt 8).
--
-- Anlass: Mit Schritt 8 schreiben Quiz und Zuordnen bei jeder Antwort eine
-- Zeile — sonst gäbe es dort keine Lernpunkte („warum bekommt man nur Punkte,
-- wenn man was falsch hat?"). Die Prüfung rechnete nach, was das öffnet:
--
--   Zuordnen: 6 Paare in ~15-20 s, „Nochmal" klicken, wieder 6 LP
--             -> ~1200 LP/Stunde, ohne jedes Wissen
--   Quiz:     blind eine Option antippen, „Weiter" -> ~2-3 s je LP
--             -> ~1500 LP/Stunde
--   Echtes Lernen: 5-10 s je Karte -> ~500 LP/Stunde
--
-- Raten wäre damit dreimal schneller als lernen gewesen. Und weil der Überschuss
-- über der Tageskappe im Übertrag liegen bleibt, versickert nichts: eine Stunde
-- Klicken bankt ~1000 LP = 33 Tage Kappe = ~100 KI-Scans. LP sind kaufbar.
--
-- Die Regel: In den RATE-Modi zählt jede Karte pro Tag nur einmal. Wer dieselbe
-- Runde wiederholt, übt weiter (Streak, Statistik, Planung bei Fehlern bleiben
-- unberührt) — nur bezahlt wird sie nicht doppelt.
--
-- ABRUF-Modi bleiben ausdrücklich unangetastet: Wer eine Karte beim Lernen
-- mehrfach durchgeht, hat sie mehrfach abgerufen. An echten Daten geprüft:
-- diese Fassung kostet ALLE fünf Konten in Prod exakt 0 LP. Eine Variante, die
-- auch Abruf-Modi entdoppelt hätte, hätte allein Lara 24 LP genommen.
--
-- Umsetzung: v_total zählt Rate-Zeilen über (card_id, Lerntag) entdoppelt.
-- Berlin-Zeit, wie überall sonst (#211).
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

  -- Prüfungen zählen gar nicht (Schritt 6). Abruf-Modi zählen jede Zeile.
  -- Rate-Modi (quiz, match) zählen je Karte und Lerntag nur einmal.
  SELECT
    count(*) FILTER (WHERE mode NOT IN ('test', 'quiz', 'match'))
    + count(DISTINCT (card_id, (reviewed_at AT TIME ZONE 'Europe/Berlin')::date))
        FILTER (WHERE mode IN ('quiz', 'match'))
    INTO v_total
    FROM public.review_logs WHERE user_id = p_user;

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
