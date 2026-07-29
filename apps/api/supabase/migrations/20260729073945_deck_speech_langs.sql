-- Vorlese-Sprache je Deck, getrennt für Vorder- und Rückseite.
--
-- Warum getrennt: Vokabelkarten sind zweisprachig — vorne „les données", hinten
-- „die Daten". Eine Sprache pro Deck würde die Rückseite französisch vorlesen
-- und damit das Problem nur umdrehen, das wir lösen wollen. Bisher war die
-- Stimme in App und Web fest auf de-DE verdrahtet, wodurch französische
-- Vokabeln mit deutscher Aussprache vorgelesen wurden — beim Sprachenlernen
-- nicht nur schief, sondern schädlich.
--
-- NULL heißt bewusst „nicht eingestellt" und wird von den Clients als Deutsch
-- gelesen. Damit ändert sich für kein bestehendes Deck etwas, solange niemand
-- die Einstellung anfasst; ein Default in der Spalte würde dagegen behaupten,
-- der Nutzer habe Deutsch gewählt.
--
-- Kein Constraint auf die Werte: Die erlaubten Sprachen stehen im Server-Schema
-- (deckService), das jeden Schreibweg passiert. Eine Datenbank-Prüfliste müsste
-- bei jeder neuen Sprache per Migration nachgezogen werden und wäre die zweite
-- Wahrheit neben dem Schema.
alter table decks add column if not exists speech_lang_front text;
alter table decks add column if not exists speech_lang_back text;

comment on column decks.speech_lang_front is
  'BCP-47-Sprachcode für das Vorlesen der Vorderseite (z. B. fr-FR). NULL = nicht eingestellt, Clients lesen Deutsch.';
comment on column decks.speech_lang_back is
  'BCP-47-Sprachcode für das Vorlesen der Rückseite. NULL = nicht eingestellt, Clients lesen Deutsch.';
