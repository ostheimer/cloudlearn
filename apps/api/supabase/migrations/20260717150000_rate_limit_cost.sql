-- Rate-Limit kann jetzt GEWICHTETE Anfragen zählen (p_cost).
--
-- Anlass: Die Bremse auf /cards/[id]/review (300/min) war über /learn/sync
-- umgehbar. syncService ruft storeReview direkt als Funktion — die Route und
-- damit checkRateLimit wird nie durchlaufen. Ein Sync-Paket darf 500
-- Operationen tragen und zählte als EIN Aufruf: 10 Pakete/min = 5000
-- Wiederholungen/min statt 300. Der Kommentar in der Review-Route versprach
-- also einen Schutz, den es nicht gab.
--
-- Mit p_cost kann der Sync-Pfad sein Gewicht in Höhe der enthaltenen Reviews
-- aus DEMSELBEN Topf ziehen wie der Einzelweg.
--
-- Rückwärtskompatibel: p_cost hat einen Default. Der noch laufende alte Code
-- ruft mit drei Argumenten und verhält sich damit exakt wie bisher (+1).
-- Deshalb ist die Reihenfolge Migration-zuerst-dann-Deploy hier ungefährlich.
--
-- Das DROP ist nötig, weil ein zusätzlicher Parameter in Postgres eine neue
-- Funktion erzeugen würde statt die alte zu ersetzen — und PostgREST kann bei
-- Überladungen nicht sicher wählen ("could not choose the best candidate
-- function"). Die Lücke zwischen DROP und CREATE ist innerhalb der Migration
-- transaktional; selbst ein Fehlschlag wäre harmlos, weil checkRateLimit im
-- Anwendungscode bewusst OPEN failt (kein Lockout bei DB-Problemen).
drop function if exists check_rate_limit(text, int, int);

create or replace function check_rate_limit(
  p_key text,
  p_limit int,
  p_window_seconds int default 60,
  p_cost int default 1
)
returns boolean language plpgsql as $$
declare v_count int; v_cost int;
begin
  -- Ein Gewicht unter 1 würde die Bremse aushebeln (0 = zählt nie).
  v_cost := greatest(coalesce(p_cost, 1), 1);
  insert into rate_limits(key, count, window_start)
    values (p_key, v_cost, now())
  on conflict (key) do update set
    count = case when now() - rate_limits.window_start >= make_interval(secs => p_window_seconds)
                 then v_cost else rate_limits.count + v_cost end,
    window_start = case when now() - rate_limits.window_start >= make_interval(secs => p_window_seconds)
                        then now() else rate_limits.window_start end
  returning count into v_count;
  return v_count <= p_limit;
end; $$;

grant execute on function check_rate_limit(text, int, int, int) to service_role;
