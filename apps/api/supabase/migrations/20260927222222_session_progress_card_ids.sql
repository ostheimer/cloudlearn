-- Ursprüngliche Kartenreihenfolge einer unterbrochenen Runde (#697).
-- Bei „Nur fällige“ verschwinden bereits beantwortete Karten aus der Quelle.
-- Der Snapshot erlaubt den Clients, Position und Ergebnisse dennoch richtig
-- zuzuordnen. NULL erhält die Bedeutung alter Merker ohne Snapshot.
alter table public.session_progress
  add column if not exists card_ids uuid[];

comment on column public.session_progress.card_ids is
  'Ordered original review queue; NULL for progress saved by older clients.';
