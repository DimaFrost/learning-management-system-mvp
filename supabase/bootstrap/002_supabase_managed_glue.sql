-- Supabase-managed schema glue for fresh Member Testing / Production projects.
-- Run after 001_dev_public_schema_baseline.sql on a fresh Supabase project.
-- This file intentionally avoids recreating Supabase-managed auth/storage tables.

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tbo-lms', 'tbo-lms', true, null, null)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists storage_delete on storage.objects;
create policy storage_delete on storage.objects
for delete
to authenticated
using (
  bucket_id = 'tbo-lms'
  and (
    auth.uid()::text = (storage.foldername(name))[1]
    or public.is_admin()
  )
);

drop policy if exists storage_select on storage.objects;
create policy storage_select on storage.objects
for select
to authenticated
using (bucket_id = 'tbo-lms');

drop policy if exists storage_upload on storage.objects;
create policy storage_upload on storage.objects
for insert
to authenticated
with check (bucket_id = 'tbo-lms');
