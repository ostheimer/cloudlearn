-- Kurse abschaffen, Teil 1: die Daten ziehen in die Ordner um (#437)
--
-- Jeder Kurs wird ein gleichnamiger Ordner (samt Beschreibung, Farbe und
-- Erstelldatum), seine Deck-Zuordnungen wandern mit. Danach werden die
-- Kurs-Zeilen geloescht — die Ordner SIND ab hier die Daten. Die leeren
-- Tabellen und API-Routen bleiben vorerst stehen (Huelle), damit der alte
-- App-Build einen leeren Kurse-Reiter zeigt statt eines Fehlers; sie fallen
-- nach dem naechsten Sammel-Build.
--
-- Die Ordner uebernehmen die IDs der Kurse (beides UUIDs, getrennte
-- Tabellen, keine Kollisionsgefahr) — so braucht die Deck-Wanderung kein
-- fehlertraechtiges Matching ueber Namen.

insert into folders (id, user_id, title, description, color, created_at, updated_at)
select id, user_id, title, description, color, created_at, updated_at
from courses;

-- position bewusst NULL statt der alten 0: die 0 in course_decks war nie
-- eine echte Sortierung, nur der nie angefasste Default. NULL heisst im
-- neuen Schema ehrlich "nie sortiert" (siehe 20260722075529).
insert into folder_decks (folder_id, deck_id, position, added_at)
select course_id, deck_id, null, added_at
from course_decks;

delete from course_decks;
delete from courses;
