-- Wann kam die Wiederholung beim Server an? (Vorarbeit für den Deckel pro Lerntag)
--
-- review_logs speichert bisher nur `reviewed_at` — den Zeitpunkt, den das GERÄT
-- meldet. Wann die Zeile wirklich eintraf, wurde nie festgehalten. Damit lässt
-- sich die eine Zahl nicht ermitteln, die für Laras gewählten „Deckel pro
-- Lerntag" gebraucht wird: wie spät Offline-Nachzügler tatsächlich ankommen.
--
-- Warum die Zahl zählt: Der Deckel deckelt je LERNTAG (nicht je Abrechnungstag),
-- damit Offline-Lernen nicht bestraft wird. Grundlage ist dann `reviewed_at` —
-- und genau das setzt der Client selbst. Ohne Altersgrenze bucht ein
-- manipulierter Client 365 erfundene Lerntage à 30 LP. Die Grenze soll aber
-- nicht geraten werden, sondern aus echten Daten kommen: „Nachzügler sind in
-- der Praxis höchstens X Tage alt."
--
-- ZWEI SCHRITTE, mit Absicht:
--   1. Spalte OHNE Default anlegen  -> bestehende 464 Zeilen bekommen NULL
--   2. Default erst danach setzen   -> nur NEUE Zeilen bekommen now()
--
-- Ein `ADD COLUMN ... DEFAULT now()` in einem Rutsch würde den Wert einmal
-- auswerten und ALLEN Altzeilen zuweisen (PG11+ speichert ihn als
-- attmissingval). Sie behaupteten dann alle, exakt zum Migrationszeitpunkt
-- eingetroffen zu sein — eine erfundene Zahl, die später als Messgrundlage
-- dient. NULL heißt ehrlich: „vor Beginn der Aufzeichnung, unbekannt".
--
-- Bewusst NULLABLE: Für die Altzeilen gibt es keinen wahren Wert. NOT NULL
-- ginge nur mit einer Lüge.
--
-- Bewusst ohne Index: 464 Zeilen. Der kommt, wenn die Auswertung ihn braucht.
--
-- SPÄTERE AUSWERTUNG (nach ein paar Wochen), beantwortet die offene Frage:
--   select
--     case
--       when inserted_at - reviewed_at < interval '1 minute'  then 'sofort'
--       when inserted_at - reviewed_at < interval '1 hour'    then 'unter 1 Stunde'
--       when inserted_at - reviewed_at < interval '1 day'     then 'unter 1 Tag'
--       when inserted_at - reviewed_at < interval '7 days'    then 'unter 1 Woche'
--       else 'älter'
--     end as versatz,
--     count(*)
--   from review_logs
--   where inserted_at is not null
--   group by 1;
alter table public.review_logs
  add column if not exists inserted_at timestamptz;

alter table public.review_logs
  alter column inserted_at set default now();

comment on column public.review_logs.inserted_at is
  'Eintreffzeitpunkt beim Server. NULL = vor Beginn der Aufzeichnung (20.07.2026). Zusammen mit reviewed_at (vom Client gemeldet) ergibt sich der Versatz, den der Deckel pro Lerntag als Altersgrenze braucht.';
