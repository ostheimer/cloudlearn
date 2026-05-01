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

revoke all on function delete_account_data(uuid, text) from public;
grant execute on function delete_account_data(uuid, text) to service_role;
