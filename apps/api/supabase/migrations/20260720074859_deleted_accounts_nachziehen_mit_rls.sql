-- Konto-Löschen reparieren: die Migration vom 04.04. (20260404120000) wurde in
-- Prod nie angewendet — die zwei SPÄTEREN vom selben Tag schon, diese eine
-- wurde übersprungen. Folge: `delete_account_data` existiert dort nicht, der
-- RPC-Aufruf schlägt fehl, deleteAccount() wirft, und "Konto löschen" endet in
-- App und Web mit einem Fehler. Zusätzlich lief seit 09.05. bei JEDER
-- Anmeldung ein Fehler ins Log (125 Vorkommen), weil auth.ts die fehlende
-- Tabelle abfragt.
--
-- Diese Datei ist idempotent und wiederholt die alte Migration bewusst, statt
-- sie nachträglich zu ändern (sie ist Historie; andere Umgebungen haben sie
-- eventuell schon gelaufen).
--
-- NEU gegenüber der alten Fassung: RLS. Die alte legt eine Tabelle mit
-- E-Mail-Adressen gelöschter Nutzer an und lässt den Schutz aus. Alles im
-- Schema `public` ist über PostgREST erreichbar, und der anon-Key steckt
-- öffentlich in der Website — ohne RLS wäre die Tabelle von außen lesbar.
-- Genau dieses Muster war schon zweimal ein Loch (#356/#359 geteilte Decks,
-- #135 lp_balance). Sie hier gleich mitzunehmen ist billiger, als sie später
-- zu finden.
--
-- Bewusst OHNE Policies: nur der Admin-Client (service_role) fasst die Tabelle
-- an, und service_role umgeht RLS. Ein aktiviertes RLS ohne Policy heißt
-- deshalb "für anon/authenticated dicht" — dasselbe Muster wie
-- idempotency_keys, rate_limits und lp_transactions. Der Supabase-Linter
-- meldet das als INFO ("RLS Enabled No Policy"); das ist hier die Absicht.

create table if not exists deleted_accounts (
  user_id uuid primary key,
  email text,
  reason text not null default 'self_service',
  deleted_at timestamptz not null default now()
);

create index if not exists deleted_accounts_deleted_at_idx
  on deleted_accounts (deleted_at desc);

alter table deleted_accounts enable row level security;

-- Grabstein schreiben, dann die Profilzeile löschen. Alle Lerndaten (decks,
-- cards, review_logs, lp_transactions, scans, Freunde-Streaks, …) hängen per
-- ON DELETE CASCADE an profiles und gehen dabei mit.
--
-- Das UPDATE davor ist kein Beiwerk: profiles.referred_by zeigt auf profiles
-- und steht auf NO ACTION. Wer jemanden geworben hat, ließe sich ohne dieses
-- Lösen der Verweise gar nicht löschen — der DELETE würde am Fremdschlüssel
-- scheitern.
create or replace function delete_account_data(
  target_user_id uuid,
  target_email text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into deleted_accounts (user_id, email, reason, deleted_at)
  values (target_user_id, target_email, 'self_service', now())
  on conflict (user_id) do update
    set email = excluded.email,
        reason = excluded.reason,
        deleted_at = excluded.deleted_at;

  update profiles
  set referred_by = null
  where referred_by = target_user_id;

  delete from profiles
  where id = target_user_id;
end;
$$;

revoke all on function delete_account_data(uuid, text) from public;
grant execute on function delete_account_data(uuid, text) to service_role;
