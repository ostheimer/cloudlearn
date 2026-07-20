-- Deleted accounts tombstone + atomic public-data cleanup.
-- This keeps deleted user IDs blocked from future auth/session bootstrap.

create table if not exists deleted_accounts (
  user_id uuid primary key,
  email text,
  reason text not null default 'self_service',
  deleted_at timestamptz not null default now()
);

create index if not exists deleted_accounts_deleted_at_idx
  on deleted_accounts (deleted_at desc);

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

-- anon/authenticated einzeln entziehen: Supabase vergibt EXECUTE auf
-- Funktionen im Schema public ausdrücklich an diese Rollen, und ein revoke
-- gegen die PUBLIC-Pseudorolle lässt das unberührt. Ohne diese zwei Zeilen
-- ist die Funktion über /rest/v1/rpc mit dem öffentlichen anon-Key aufrufbar
-- — SECURITY DEFINER, Ziel-Kennung als Parameter, also fremde Konten löschbar.
-- Nachträglich ergänzt (20.07.), nachdem genau das beim Nachziehen dieser
-- Migration in Prod passiert ist. Diese Datei wurde nie angewendet; die
-- Ergänzung schützt frisch aufgesetzte Umgebungen.
revoke execute on function delete_account_data(uuid, text) from public;
revoke execute on function delete_account_data(uuid, text) from anon;
revoke execute on function delete_account_data(uuid, text) from authenticated;
grant execute on function delete_account_data(uuid, text) to service_role;
