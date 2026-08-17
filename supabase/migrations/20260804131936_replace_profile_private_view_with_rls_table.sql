drop view if exists public.profile_private_access;

create table if not exists public.profile_private_data (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  email text not null,
  phone text,
  notification_preferences jsonb not null default '{"announcements": true, "roleChange": true, "enrollment": true, "messages": true}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.profile_private_data (
  profile_id,
  email,
  phone,
  notification_preferences,
  created_at,
  updated_at
)
select
  id,
  email,
  phone,
  notification_preferences,
  created_at,
  updated_at
from public.profiles
on conflict (profile_id) do update
set
  email = excluded.email,
  phone = excluded.phone,
  notification_preferences = excluded.notification_preferences,
  updated_at = excluded.updated_at;

alter table public.profile_private_data enable row level security;

drop policy if exists "profile_private_data_select" on public.profile_private_data;
create policy "profile_private_data_select"
  on public.profile_private_data
  for select
  to authenticated
  using (((select auth.uid()) = profile_id) or public.is_admin());

drop policy if exists "profile_private_data_insert" on public.profile_private_data;
create policy "profile_private_data_insert"
  on public.profile_private_data
  for insert
  to authenticated
  with check (((select auth.uid()) = profile_id) or public.is_admin());

drop policy if exists "profile_private_data_update" on public.profile_private_data;
create policy "profile_private_data_update"
  on public.profile_private_data
  for update
  to authenticated
  using (((select auth.uid()) = profile_id) or public.is_admin())
  with check (((select auth.uid()) = profile_id) or public.is_admin());

create or replace function public.prevent_profile_private_data_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required to update private profile data.';
  end if;

  if public.is_admin() then
    new.updated_at = now();
    return new;
  end if;

  if old.profile_id is distinct from (select auth.uid()) then
    raise exception 'Only administrators can update other private profile data.';
  end if;

  if new.profile_id is distinct from old.profile_id
    or new.email is distinct from old.email
    or new.phone is distinct from old.phone
    or new.created_at is distinct from old.created_at
  then
    raise exception 'Only administrators can update protected private profile fields.';
  end if;

  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.prevent_profile_private_data_escalation() from public, anon, authenticated;

drop trigger if exists prevent_profile_private_data_escalation on public.profile_private_data;
create trigger prevent_profile_private_data_escalation
  before update on public.profile_private_data
  for each row
  execute function public.prevent_profile_private_data_escalation();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_name text;
begin
  profile_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(new.email, '@', 1)
  );

  insert into public.profiles (id, name, email, roles)
  values (
    new.id,
    profile_name,
    new.email,
    '{}'::text[]
  )
  on conflict (id) do nothing;

  insert into public.profile_private_data (profile_id, email)
  values (new.id, new.email)
  on conflict (profile_id) do update
  set email = excluded.email;

  return new;
end;
$$;

revoke all on public.profile_private_data from anon, authenticated;
grant select, insert, update on public.profile_private_data to authenticated;
