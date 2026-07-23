-- ─────────────────────────────────────────────────────────────────────────────
-- Abgegebene Pruefungen — eine Zeile je Pruefung.
--
-- Eigene Tabelle statt Auswertung von review_logs: eine Pruefung ist aus den
-- Einzelantworten nicht als Einheit rekonstruierbar (kein Gruppenschluessel,
-- jeder Idempotenz-Schluessel dort ist fuer sich zufaellig, kein deck_id, zwei
-- Pruefungen am selben Tag im selben Deck verschmelzen).
--
-- SERVER-EIGENE TABELLE: RLS an, KEINE Policy (Muster von monthly_lp_grants,
-- friend_streaks). Nur die API schreibt mit service_role und umgeht RLS. Das
-- ist die tragende Verteidigung: mit einer nutzer-eigenen Policy koennte jede
-- eingeloggte Person sich beliebige "30 von 30" eintragen und missratene
-- Pruefungen loeschen. Der Advisor meldet danach INFO "RLS Enabled No Policy" —
-- das ist die Absicht.
--
-- DIE ZAHLEN KOMMEN NICHT AUS DEM BODY. Der Client schickt nur die Antwortliste;
-- der Server verwirft alles, was nicht als eigene, nicht geloeschte Karte dieses
-- Decks nachweisbar ist, entdoppelt und zaehlt selbst. Die CHECKs sind
-- Tippfehlerschutz, KEINE Sicherheitsgrenze — an der Zahl haengt nichts (keine
-- LP, kein Lernplan, keine Rangliste).
--
-- KEIN deck_title: Der Name wird beim Lesen aus decks gejoint (sonst zeigte die
-- Liste nach einer Umbenennung fuer immer den alten Namen). Der Join erledigt
-- zugleich "Deck geloescht -> Pruefungen weg": Decks werden WEICH geloescht
-- (nur deleted_at), ein FK-Cascade feuert dabei nie. Das on-delete-cascade unten
-- greift bei der Konto-Loeschung, wo die profiles-Zeile wirklich entfernt wird.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists test_attempts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references profiles(id) on delete cascade,
  deck_id         uuid not null references decks(id) on delete cascade,
  -- Ein Schluessel je Pruefungs-RUNDE, vom Client beim START der Runde erzeugt.
  -- Deshalb treffen doppeltes Abgeben (Zeit-Modus) und jede spaetere
  -- Nachbewertung dieselbe Zeile, statt neue anzulegen.
  idempotency_key text not null,
  question_count  int not null,
  correct_count   int not null,
  -- Serverzeit, bewusst nicht vom Client: hier haengt nichts am Zeitpunkt ausser
  -- der Anzeige, ein client-gesetzter Wert liesse sich nur rueckdatieren.
  submitted_at    timestamptz not null default now(),
  -- Obergrenze bewusst grosszuegig und NICHT die Produktgrenze (die steht im
  -- zod-Schema und soll sich ohne Migration aendern koennen). Hier nur die
  -- Absurditaetsgrenze.
  constraint test_attempts_score_check check (
    question_count between 1 and 5000
    and correct_count between 0 and question_count
  )
);

-- Doppeltes Abgeben ist im Zeit-Modus der Normalfall (Uhr laeuft ab, waehrend
-- der Finger auf Abgeben liegt). Unique je NUTZER wie review_logs_idempotency.
create unique index if not exists test_attempts_idempotency_key_idx
  on test_attempts (user_id, idempotency_key);

-- Der einzige Lesezugriff ist "die letzten fuenf dieser Nutzerin" in genau
-- dieser Sortierung.
create index if not exists test_attempts_user_submitted_idx
  on test_attempts (user_id, submitted_at desc);

alter table test_attempts enable row level security;

-- Guertel UND Hosentraeger. RLS ohne Policy sperrt bereits alle vier Verben zu;
-- der Entzug nimmt zusaetzlich die Standard-Grants weg, die Supabase neuen
-- Tabellen in public erteilt — genau diese stille Vorgabe war mehrfach das Loch.
revoke all on table public.test_attempts from anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- record_test_attempt: anlegen ODER korrigieren, in EINER Anweisung.
--  1. KEIN RENNEN: zwei gleichzeitige Abgaben (Zeitablauf + Fingerdruck) treffen
--     ueber das ON CONFLICT dieselbe Zeile statt mit 23505 als 500 zu scheitern.
--  2. KEIN VERLORENES UPDATE: "War doch richtig" meldet dieselbe Runde mit
--     hoeherer Trefferzahl; greatest() macht die Korrektur monoton (nur STEIGEN).
--     Gilt auch fuer question_count, falls zwischenzeitlich eine Karte geloescht
--     wird — der Nenner soll nicht schrumpfen.
--  3. KEIN DECK-DIEBSTAHL: der Konfliktschluessel ist (user_id, key), die Zeile
--     traegt aber deck_id. Ohne die WHERE-Zeile wuerde derselbe Schluessel mit
--     einem ANDEREN Deck die alte Zeile umschreiben. Schlaegt die WHERE-Bedingung
--     fehl, liefert das Statement KEINE Zeile — daher die Pruefung darunter.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function record_test_attempt(
  p_user      uuid,
  p_deck      uuid,
  p_key       text,
  p_questions int,
  p_correct   int
) returns test_attempts
language plpgsql
as $$
declare
  v_row test_attempts;
begin
  insert into test_attempts (user_id, deck_id, idempotency_key, question_count, correct_count)
  values (p_user, p_deck, p_key, p_questions, p_correct)
  on conflict (user_id, idempotency_key) do update
     set question_count = greatest(test_attempts.question_count, excluded.question_count),
         correct_count  = greatest(test_attempts.correct_count,  excluded.correct_count)
   where test_attempts.deck_id = excluded.deck_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'test attempt key already used for another deck'
      using errcode = 'unique_violation';
  end if;

  return v_row;
end;
$$;

-- "revoke from public" allein sperrt NICHT zu: Supabase erteilt EXECUTE in public
-- zusaetzlich ausdruecklich an anon und authenticated. Genau diese Luecke hat
-- delete_account_data 40 Minuten fuer jeden aufrufbar gemacht.
revoke execute on function record_test_attempt(uuid, uuid, text, int, int) from public;
revoke execute on function record_test_attempt(uuid, uuid, text, int, int) from anon;
revoke execute on function record_test_attempt(uuid, uuid, text, int, int) from authenticated;
grant  execute on function record_test_attempt(uuid, uuid, text, int, int) to service_role;

comment on table public.test_attempts is
  'Eine Zeile je ABGEGEBENER Pruefung. Abbrechen speichert nichts. Nur der Server schreibt (service_role); RLS an, bewusst ohne Policy. Deck-Name per Join aus decks; Pruefungen zu weich geloeschten Decks blendet der Leser aus.';

comment on column public.test_attempts.question_count is
  'Vom Server gezaehlt: Antworten, deren Karte nachweislich zu diesem Deck und dieser Nutzerin gehoert und nicht geloescht ist, ohne Doppelungen. NICHT aus dem Request-Body.';

comment on column public.test_attempts.correct_count is
  'Vom Server gezaehlt, inkl. nachtraeglichem "War doch richtig". Korrekturen kommen mit demselben idempotency_key und werden monoton zusammengefuehrt (greatest); submitted_at bleibt der Abgabezeitpunkt.';
