-- Deck archivieren (#614, Laras Auswahl aus Punkt 9).
--
-- „Alt-Schuljahr raus, ohne es zu löschen": ein archiviertes Deck verschwindet
-- aus der Bibliothek und aus dem Fällig-Stapel, bleibt aber vollständig da und
-- kommt auf Knopfdruck zurück.
--
-- Bewusst dasselbe Muster wie `deleted_at`: EIN nullbarer Zeitstempel, kein
-- Flag. Der Zeitpunkt lässt sich anzeigen („archiviert am 30. Juli"), ein
-- boolean könnte das nie — und Rückgängigmachen ist in beiden Fällen ein
-- `= null`.
--
-- Additive Änderung: Die Spalte ist bei allen bestehenden Decks leer, und jeder
-- Leser, der sie nicht kennt, verhält sich unverändert. Zurücknehmen wäre ein
-- einzelnes `drop column`.
alter table decks add column if not exists archived_at timestamptz;

comment on column decks.archived_at is
  'Wann das Deck archiviert wurde (#614). NULL = aktiv. Archivierte Decks fallen aus Bibliothek und Fällig-Stapel, bleiben aber samt Karten und Lernfortschritt erhalten.';

-- Die Bibliothek fragt künftig „meine lebenden, nicht archivierten Decks" ab.
-- Der Teilindex deckt genau diese Abfrage und bleibt schmal, weil er die
-- archivierten Zeilen gar nicht erst aufnimmt.
create index if not exists decks_active_idx
  on decks (user_id, created_at desc)
  where deleted_at is null and archived_at is null;
