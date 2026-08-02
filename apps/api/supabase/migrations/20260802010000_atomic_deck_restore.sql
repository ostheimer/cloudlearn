-- Restore a deleted deck without a time-of-check/time-of-use gap (#702).
--
-- Two concurrent requests used to count the same 19 live decks and then both
-- restore one, leaving a free account with 21/20 decks. The transaction-level
-- advisory lock serializes restores for one user; the capacity check and both
-- updates then happen in this single database transaction.
create or replace function public.restore_deck_with_limit(
  p_user uuid,
  p_deck uuid,
  p_max_decks integer
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted_at timestamptz;
  v_live_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));

  select deleted_at
    into v_deleted_at
    from public.decks
   where id = p_deck
     and user_id = p_user
     and deleted_at is not null
   for update;

  if not found then
    return 'not_found';
  end if;

  select count(*)
    into v_live_count
    from public.decks
   where user_id = p_user
     and deleted_at is null;

  if v_live_count >= p_max_decks then
    return 'limit_reached';
  end if;

  update public.cards
     set deleted_at = null
   where deck_id = p_deck
     and user_id = p_user
     and deleted_at = v_deleted_at;

  update public.decks
     set deleted_at = null,
         updated_at = now()
   where id = p_deck
     and user_id = p_user
     and deleted_at = v_deleted_at;

  return 'restored';
end;
$$;

revoke all on function public.restore_deck_with_limit(uuid, uuid, integer) from public;
revoke execute on function public.restore_deck_with_limit(uuid, uuid, integer) from anon, authenticated;
grant execute on function public.restore_deck_with_limit(uuid, uuid, integer) to service_role;
