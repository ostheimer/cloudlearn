-- Ordner bekommen, was Kurse konnten: Beschreibung und Reihenfolge (#437)
--
-- Kurse werden abgeschafft, ihre zwei brauchbaren Eigenschaften wandern in die
-- Ordner. Diese Migration legt nur die Spalten an; die Kurs-Daten wandern in
-- einem eigenen, späteren Schritt.

alter table public.folders
  add column if not exists description text;

-- Absichtlich NULL-bar — NICHT `not null default 0` wie bei course_decks.
--
-- Mit Default 0 trügen alle Zeilen dieselbe Zahl, und die Reihenfolge wäre
-- weiterhin Zufall. Genau das ist der Zustand von course_decks in der
-- Produktion: 4 Kurse, kein einziger mit echter Reihenfolge, weil niemand die
-- Null je überschrieben hat. Die Spalte sah nach Ordnung aus und war keine.
--
-- NULL sagt dagegen ehrlich „nie sortiert". Gelesen wird mit
--   order by position nulls last, added_at asc
-- Damit gilt: nie sortierte Ordner behalten die Reihenfolge des Hinzufügens
-- (heute ist sie unbestimmt), und ein neu hinzugefügtes Deck bekommt NULL und
-- landet unten — nicht mitten in einer bestehenden Reihenfolge.
alter table public.folder_decks
  add column if not exists position int;
