-- Push-Bremse für Freunde-Streaks, entkoppelt von der Streak-Zeile (#342).
--
-- Bisher lebte der "zuletzt gepusht"-Stempel direkt in friend_streaks (Spalten
-- last_reminded_at_low / last_reminded_at_high, Migration 20260716120000).
-- Verlässt jemand den Streak, löscht leaveFriendStreak die ganze Zeile — und
-- damit den Stempel. Neu einladen legt eine frische Zeile ohne Stempel an, also
-- gibt es einen zusätzlichen Push pro Runde (#342). Schwacher Rest der früher
-- größeren Lücke; die große ist geschlossen, dieser Rest bleibt unschön.
--
-- Lösung: eine eigene kleine Tabelle, Schlüssel (Absender, Empfänger, lokaler
-- Tag — Europe/Berlin, #211). Sie hängt NICHT an friend_streaks, überlebt also
-- das Verlassen. Eine Zeile je Richtung: wenn A B anstupst, darf das nicht den
-- Slot wegnehmen, den B→A am selben Tag braucht (spiegelt die low/high-Trennung
-- der alten Bremse und der Konvention in friend_streaks).
--
-- Server-verwaltet (service_role umgeht RLS), keine Client-Policies — spiegelt
-- friend_streaks / streak_freeze_uses. RLS an + keine Policy = anon/authenticated
-- kommen an keine Zeile, nur der Server (service_role) schreibt/liest.
--
-- Die alten Spalten last_reminded_at_low/high bleiben vorerst ungenutzt stehen:
-- Diese Migration läuft VOR dem zugehörigen Code-Deploy, und bereits laufender
-- Alt-Code liest/schreibt sie noch, bis der neue Code live ist. Ein späterer
-- Cleanup entfernt sie, sobald überall der neue Code läuft.
create table if not exists friend_push_log (
  sender_id    uuid not null references profiles(id) on delete cascade,
  recipient_id uuid not null references profiles(id) on delete cascade,
  local_day    date not null,
  created_at   timestamptz not null default now(),
  primary key (sender_id, recipient_id, local_day)
);
alter table friend_push_log enable row level security;

comment on table friend_push_log is
  'Push-Bremse für Freunde-Streaks: max. 1 Push je Absender→Empfänger und lokalem Tag (Europe/Berlin, #211). Entkoppelt von friend_streaks, überlebt das Verlassen/Neu-Einladen (#342).';
