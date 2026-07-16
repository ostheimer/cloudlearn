-- ANGEWENDET auf Prod am 2026-07-16 (Version 20260716133138 = Anwendungszeit,
-- daher der Dateiname: per MCP apply_migration eingespielt, das die Uhrzeit statt
-- der Repo-Version einträgt — Datei danach angeglichen, damit Repo und DB
-- übereinstimmen und niemand sie versehentlich erneut einspielt).
--
-- Zusätzlich zu dieser Struktur-Änderung wurden auf Laras ausdrücklichen Wunsch
-- ALLE bestehenden Profile auf 30 gesetzt (4 Zeilen von 10 → 30; 2 hatten
-- bereits 30). Das war ein einmaliger Daten-Eingriff, bewusst NICHT Teil dieser
-- Migration.

-- Tagesziel: Standard für neue Profile von 10 auf 30 Karten.
--
-- Der Standard steckte allein in der Spalte selbst (`daily_goal int NOT NULL
-- DEFAULT 10`, Migration 20260211190000_add_streak_stats). Der Server-Code liest
-- zwar an mehreren Stellen `daily_goal ?? 30` (db.ts), aber dieser Rückfallwert
-- greift NIE: die Spalte ist NOT NULL, jedes Profil bekommt beim Anlegen einen
-- Wert. Effektiv startete also jede/r bei 10, obwohl der Code 30 nahelegte —
-- nach dieser Migration stimmen Spalte und Code überein.
--
-- Wirkt NUR auf NEU angelegte Profile. Bestehende behalten ihren Wert; wer
-- bewusst etwas anderes gewählt hat (Profil-Einstellung „Tagesziel"), bleibt
-- unangetastet. Ein Backfill bestehender Zeilen ist absichtlich NICHT Teil
-- dieser Migration — das wäre ein Daten-Eingriff und würde bewusste
-- Nutzer-Entscheidungen überschreiben.

ALTER TABLE profiles ALTER COLUMN daily_goal SET DEFAULT 30;
