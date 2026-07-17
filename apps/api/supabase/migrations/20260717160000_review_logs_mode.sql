-- Ein Etikett je Wiederholung: aus welchem Modus kam sie?
--
-- Bisher schaltet EIN review_logs-Eintrag fünf Dinge gleichzeitig: den
-- FSRS-Lernplan, die Lernpunkte, den Streak (samt Freunde-Streak), das
-- Tagesziel und die Statistik. Es gibt keine Spalte, die Arten unterscheidet —
-- deshalb kollidieren Laras Regeln miteinander, obwohl jede für sich vernünftig
-- ist:
--   „Test = Messen: keine Punkte, kein Tagesziel — aber Streak hält und die
--    Genauigkeit zählt", und „Zuordnen/Multiple Choice = Punkte ja, Lernplan
--    nein".
-- Beides braucht die Unterscheidung, die hier entsteht.
--
-- Dies ist Schritt 3 von 10 und für sich genommen WIRKUNGSLOS: die Spalte wird
-- nur angelegt. Niemand schreibt sie (der Client kennt sie noch nicht), niemand
-- liest sie (die Leser lernen die Regel erst in Schritt 5/6). Erst danach
-- schicken die Oberflächen ihren Modus — in dieser Reihenfolge, weil andersherum
-- das LP-Wasserzeichen über Test-Zeilen hinweglaufen und danach echte Lern-LP
-- verschlucken würde.
--
-- Default 'flashcard' statt eines 'legacy'-Werts: Alte App-Builds (kein OTA,
-- #337) schreiben Wiederholungen ausschließlich aus Karteikarten, Üben,
-- Lückentext und Occlusion — also genau aus den Modi, die für alles zählen
-- sollen. Der Default bildet ihre Zeilen damit exakt richtig ab. Ein
-- 'legacy'-Wert wäre für die Statistik hübscher, aber eine Fußangel: wer ihn in
-- einer der „zählt"-Listen vergisst, nimmt alten Nutzern still die Lernpunkte
-- weg.
--
-- ADD COLUMN mit konstantem Default ist seit PG11 metadata-only — kein
-- Table-Rewrite, kein Backfill nötig. Die Tabelle hat aktuell 431 Zeilen.
alter table public.review_logs
  add column if not exists mode text not null default 'flashcard';

-- Benannt, damit sich die Liste später per DROP/ADD erweitern lässt, ohne die
-- Spalte anzufassen. Der Check schützt vor Tippfehlern im Client — er ist KEINE
-- Sicherheitsgrenze: welchen Modus eine Zeile trägt, bestimmt der Client, und
-- er könnte auch 'flashcard' behaupten. Die tragende Verteidigung bleibt die
-- Tageskappe.
alter table public.review_logs
  drop constraint if exists review_logs_mode_check;

alter table public.review_logs
  add constraint review_logs_mode_check
  check (mode in ('flashcard', 'practice', 'cloze', 'occlusion', 'quiz', 'match', 'test'));
