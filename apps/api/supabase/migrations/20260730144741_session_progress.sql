-- Lernstand geräteübergreifend (#610).
--
-- Bisher lebte der „Weitermachen"-Merker nur auf dem Gerät: im Browser unter
-- clearn:lernstand:<modus>:<deckId>, in der App unter review-progress:… . Wer
-- am Handy 40 Karten eines großen Decks lernte und am Laptop weitermachte,
-- fing dort wieder bei Karte 1 an — und bewertete die ersten 40 ein zweites
-- Mal. Jede Bewertung verschiebt die Wiederhol-Planung der Karte, doppelte
-- Bewertungen verstellen also den Lernplan.
--
-- Eine Zeile je (Nutzer, Deck, Lernart): Ein Deck kann gleichzeitig eine
-- unterbrochene Karteikarten- UND Lückentext-Runde haben, und das sind
-- verschiedene Stapel (der Lückentext lernt nur eintippbare Karten). Genau der
-- Schlüssel, den die lokalen Merker schon benutzen.
--
-- card_id bewusst OHNE Fremdschlüssel: Karten werden weich gelöscht
-- (deleted_at), und ein harter Verweis brächte hier nichts — die Clients
-- prüfen ohnehin über isProgressUsable, ob an der gemerkten Position noch
-- dieselbe Karte liegt, und beginnen sonst ehrlich von vorn.
--
-- Server-verwaltet (service_role umgeht RLS), keine Client-Policies — spiegelt
-- friend_push_log. RLS an + keine Policy = anon/authenticated kommen an keine
-- Zeile, nur der Server liest und schreibt.
create table if not exists session_progress (
  user_id    uuid not null references profiles(id) on delete cascade,
  deck_id    uuid not null references decks(id) on delete cascade,
  mode       text not null check (mode in ('flashcards', 'cloze')),
  -- Nullbasierte Position in der Runde; muss unter total liegen, sonst wäre
  -- die Runde fertig und nichts mehr fortzusetzen.
  card_index int not null check (card_index >= 0),
  -- Karte, die beim Speichern an card_index lag (Echtheitsprüfung der Position).
  card_id    uuid not null,
  -- Kartenquelle der Runde ("all" | "starred" | "wobbly" | "due").
  source     text not null,
  -- Ob rückwärts (Rückseite zuerst) abgefragt wurde.
  reverse    boolean not null default false,
  total      int not null check (total > 0),
  -- Ausgänge der schon beantworteten Karten, nach Karten-Id — damit die
  -- Auswertung nach einem Weitermachen die ganze Runde zählt.
  results    jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, deck_id, mode),
  constraint session_progress_index_below_total check (card_index < total)
);
alter table session_progress enable row level security;

comment on table session_progress is
  'Wo eine unterbrochene Lern-Runde stand, je Nutzer/Deck/Lernart — geräteübergreifend (#610). Wird nur ANGEBOTEN, nie automatisch angewendet; die Clients prüfen zusätzlich, ob an der Position noch dieselbe Karte liegt.';
