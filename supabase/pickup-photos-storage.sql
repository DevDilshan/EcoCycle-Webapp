-- Run in Supabase Dashboard → SQL Editor (once per project).
-- Fixes: "new row violates row-level security policy" on pickup photo upload.
--
-- Web + mobile upload to: pickup-photos/{auth_user_id}/{timestamp}.jpg
-- Bucket must be public so getPublicUrl() works for Image.network / <img>.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pickup-photos',
  'pickup-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Authenticated residents: upload only into their own folder (first path segment = user id).
drop policy if exists "pickup_photos_insert_own_folder" on storage.objects;
create policy "pickup_photos_insert_own_folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'pickup-photos'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

-- Public read (required even when bucket.public = true if RLS is enabled on objects).
drop policy if exists "pickup_photos_public_select" on storage.objects;
create policy "pickup_photos_public_select"
on storage.objects
for select
to public
using (bucket_id = 'pickup-photos');

-- Optional: replace or remove own uploads.
drop policy if exists "pickup_photos_update_own_folder" on storage.objects;
create policy "pickup_photos_update_own_folder"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'pickup-photos'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "pickup_photos_delete_own_folder" on storage.objects;
create policy "pickup_photos_delete_own_folder"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'pickup-photos'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
