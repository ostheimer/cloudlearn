-- Aufräum-Migration zu Issue #495 (Teil 3): Deck-Löschen war ein Soft-Delete,
-- der nur das Deck markierte — die Karten blieben „lebendig". 428 solcher
-- Geister-Karten (Stand 23.07.2026, 3 Konten) zählten gegen das Karten-Limit
-- (countUserCards filtert nur cards.deleted_at). Die Leser sind seit PR #500
-- gehärtet (inner join auf lebende Decks) und softDeleteDeck markiert seither
-- die Karten mit — diese Migration zieht nur die Altdaten nach.
--
-- Lösch-Datum = deleted_at des jeweiligen Decks (Laras Entscheidung 23.07.):
-- die Daten sehen danach so aus, als hätte das Löschen schon immer beides markiert.
--
-- Sicherungstabelle nach dem Muster von 20260720075833_sicherungstabellen_rls:
-- RLS an, keine Policies — über die API kommt niemand dran, nur service_role
-- (Notfall-Kopie; Linter meldet danach absichtlich INFO "RLS Enabled No Policy").

create table public.cards_deckghost_backup_20260723 as
select c.*
from public.cards c
join public.decks d on d.id = c.deck_id
where c.deleted_at is null
  and d.deleted_at is not null;

alter table public.cards_deckghost_backup_20260723 enable row level security;

update public.cards c
set deleted_at = d.deleted_at
from public.decks d
where d.id = c.deck_id
  and c.deleted_at is null
  and d.deleted_at is not null;
