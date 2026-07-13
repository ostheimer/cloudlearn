-- Card images storage (Occlusion & future image cards) — 2026-07-13
-- Private bucket "card-images". Each user reaches only files under their own
-- {userId}/... path prefix. Card rows keep the image URL in source_image_url
-- and the occlusion regions in extra_data (both columns already exist).
--
-- Applied to production via Supabase MCP on 2026-07-13 (version 20260713091652).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'card-images', 'card-images', false, 5242880,
  array['image/png','image/jpeg','image/webp','image/gif']
)
on conflict (id) do nothing;

-- storage.objects has RLS enabled globally; add per-bucket, per-user policies.
-- The first path segment must equal the caller's user id.
create policy "card-images: read own"
  on storage.objects for select to authenticated
  using (bucket_id = 'card-images' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "card-images: insert own"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'card-images' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "card-images: update own"
  on storage.objects for update to authenticated
  using (bucket_id = 'card-images' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'card-images' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "card-images: delete own"
  on storage.objects for delete to authenticated
  using (bucket_id = 'card-images' and (storage.foldername(name))[1] = auth.uid()::text);
