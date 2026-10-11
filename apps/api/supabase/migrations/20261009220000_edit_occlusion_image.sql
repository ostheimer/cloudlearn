-- Atomic editor for ONE existing image. Retained card IDs, review logs and
-- FSRS fields are preserved. Removed regions use the existing soft-delete path.
create or replace function public.edit_occlusion_image(
  p_user_id uuid, p_deck_id uuid, p_image_path text,
  p_expected jsonb, p_regions jsonb, p_max_cards integer
) returns jsonb
language plpgsql security invoker set search_path = public
as $$
declare
  actual jsonb; expected jsonb; region jsonb; clean_regions jsonb;
  assigned uuid[]; cid uuid; region_index integer := 0;
  updated_count integer := 0; created_count integer := 0; deleted_count integer := 0;
  current_count integer; new_count integer;
begin
  perform 1 from public.decks where id = p_deck_id and user_id = p_user_id and deleted_at is null for update;
  if not found then raise exception 'DECK_NOT_FOUND'; end if;
  perform 1 from public.cards where deck_id = p_deck_id and user_id = p_user_id
    and card_type = 'occlusion' and source_image_url = p_image_path and deleted_at is null for update;
  select jsonb_agg(jsonb_build_object('id', id, 'back', back, 'extraData', coalesce(extra_data, '{}'::jsonb)) order by id)
    into actual from public.cards where deck_id = p_deck_id and user_id = p_user_id
      and card_type = 'occlusion' and source_image_url = p_image_path and deleted_at is null;
  select jsonb_agg(value order by (value->>'id')::uuid) into expected from jsonb_array_elements(p_expected);
  if actual is null or actual is distinct from expected then raise exception 'OCCLUSION_CONFLICT'; end if;

  select coalesce(array_agg(ids.value::uuid), '{}'::uuid[]) into assigned
    from jsonb_array_elements(p_regions) r cross join lateral jsonb_array_elements_text(r.value->'cardIds') ids;
  if cardinality(assigned) <> (select count(distinct v) from unnest(assigned) v) or
    exists (select 1 from unnest(assigned) v where not exists (select 1 from jsonb_array_elements(actual) c where (c->>'id')::uuid = v)) then
    raise exception 'INVALID_REGIONS';
  end if;
  select count(*) into new_count from jsonb_array_elements(p_regions) r where jsonb_array_length(r->'cardIds') = 0;
  select count(*) into current_count from public.cards where deck_id = p_deck_id and user_id = p_user_id and deleted_at is null;
  if new_count > 0 and current_count - jsonb_array_length(actual) + cardinality(assigned) + new_count > p_max_cards then
    raise exception 'DECK_FULL';
  end if;
  select coalesce(jsonb_agg(r - 'cardIds' order by ord), '[]'::jsonb) into clean_regions
    from jsonb_array_elements(p_regions) with ordinality as t(r, ord);
  -- Validate before the first write, also for calls made directly by the server role.
  for region in select value from jsonb_array_elements(p_regions) loop
    if (region->>'x')::numeric < 0 or (region->>'y')::numeric < 0 or
      (region->>'w')::numeric <= 0 or (region->>'h')::numeric <= 0 or
      (region->>'x')::numeric + (region->>'w')::numeric > 1.000001 or
      (region->>'y')::numeric + (region->>'h')::numeric > 1.000001 or
      length(trim(region->>'label')) not between 1 and 200 then raise exception 'INVALID_REGIONS'; end if;
  end loop;
  for region in select value from jsonb_array_elements(p_regions) loop
    if jsonb_array_length(region->'cardIds') = 0 then
      insert into public.cards(user_id, deck_id, front, back, card_type, source_image_url, extra_data)
        values(p_user_id, p_deck_id, 'Bild-Occlusion: Was ist an der markierten Stelle?', region->>'label', 'occlusion', p_image_path,
          jsonb_build_object('regions', clean_regions, 'hideIndex', region_index));
      created_count := created_count + 1;
    else
      for cid in select value::uuid from jsonb_array_elements_text(region->'cardIds') loop
        update public.cards set back = region->>'label',
          extra_data = coalesce(extra_data, '{}'::jsonb) || jsonb_build_object('regions', clean_regions, 'hideIndex', region_index), updated_at = now()
          where id = cid and user_id = p_user_id and deck_id = p_deck_id and source_image_url = p_image_path and card_type = 'occlusion' and deleted_at is null;
        updated_count := updated_count + 1;
      end loop;
    end if;
    region_index := region_index + 1;
  end loop;
  update public.cards set deleted_at = now(), updated_at = now()
    where user_id = p_user_id and deck_id = p_deck_id and source_image_url = p_image_path and card_type = 'occlusion'
      and deleted_at is null and id in (select (c->>'id')::uuid from jsonb_array_elements(actual) c)
      and not (id = any(assigned));
  get diagnostics deleted_count = row_count;
  return jsonb_build_object('updated', updated_count, 'created', created_count, 'deleted', deleted_count);
end;
$$;
revoke all on function public.edit_occlusion_image(uuid, uuid, text, jsonb, jsonb, integer) from public, anon, authenticated;
grant execute on function public.edit_occlusion_image(uuid, uuid, text, jsonb, jsonb, integer) to service_role;
