-- Kurse abschaffen, Abschluss: die leeren Tabellen fallen (#437)
--
-- Die Daten sind seit 20260722081225 in den Ordnern (beide Tabellen seither
-- 0 Zeilen), der letzte App-Build ohne Kurse-Reiter laeuft auf dem Geraet,
-- und die /api/v1/courses-Routen sind im selben PR entfernt. Es gibt keinen
-- Leser und keinen Schreiber mehr.
--
-- course_decks zuerst: sie referenziert courses per Fremdschluessel.

drop table if exists public.course_decks;
drop table if exists public.courses;
