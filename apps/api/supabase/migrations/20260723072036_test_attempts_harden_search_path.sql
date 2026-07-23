-- Suchpfad fest verankern (set search_path = '') und alle Objekte
-- schema-qualifizieren. Nimmt der Funktion die Advisor-Warnung
-- "Function Search Path Mutable" und schliesst die Klasse, an der dieses
-- Projekt schon einmal hing (delete_account_data, 20260720075944). Reine
-- Haertung, keine Logikaenderung — vorab im Rueckroll-Block gegen dieselben
-- vier Verhaltensfaelle geprueft (Idempotenz, greatest-Monotonie,
-- Deck-Diebstahl, Constraints).
--
-- Als eigene Migration nach 20260723071835, weil die Haertung erst nach dem
-- ersten Advisor-Lauf auffiel; so bleibt die Repo-Historie deckungsgleich mit
-- der Prod-Registry (beide Versionen dort angewendet).
create or replace function record_test_attempt(
  p_user      uuid,
  p_deck      uuid,
  p_key       text,
  p_questions int,
  p_correct   int
) returns public.test_attempts
language plpgsql
set search_path = ''
as $$
declare
  v_row public.test_attempts;
begin
  insert into public.test_attempts as ta
    (user_id, deck_id, idempotency_key, question_count, correct_count)
  values (p_user, p_deck, p_key, p_questions, p_correct)
  on conflict (user_id, idempotency_key) do update
     set question_count = greatest(ta.question_count, excluded.question_count),
         correct_count  = greatest(ta.correct_count,  excluded.correct_count)
   where ta.deck_id = excluded.deck_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'test attempt key already used for another deck'
      using errcode = 'unique_violation';
  end if;

  return v_row;
end;
$$;

revoke execute on function record_test_attempt(uuid, uuid, text, int, int) from public;
revoke execute on function record_test_attempt(uuid, uuid, text, int, int) from anon;
revoke execute on function record_test_attempt(uuid, uuid, text, int, int) from authenticated;
grant  execute on function record_test_attempt(uuid, uuid, text, int, int) to service_role;
