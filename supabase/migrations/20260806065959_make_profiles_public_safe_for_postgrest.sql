-- PostgREST needs table-level SELECT on exposed tables. Keep public.profiles
-- directory-safe by moving private fields fully into profile_private_data, then
-- restore SELECT for authenticated users.

alter table public.profiles
  alter column email drop not null;

alter table public.profiles
  alter column notification_preferences drop not null;

insert into public.profile_private_data (
  profile_id,
  email
)
select
  id,
  coalesce(email, '')
from public.profiles
on conflict (profile_id) do nothing;

alter table public.profiles disable trigger prevent_profile_privilege_escalation;
update public.profiles
set
  email = null,
  phone = null,
  notification_preferences = null;
alter table public.profiles enable trigger prevent_profile_privilege_escalation;

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

  insert into public.profiles (id, name, roles)
  values (
    new.id,
    profile_name,
    '{}'::text[]
  )
  on conflict (id) do nothing;

  insert into public.profile_private_data (profile_id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (profile_id) do update
  set
    email = excluded.email,
    updated_at = now();

  return new;
end;
$$;

create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required to update profiles.';
  end if;

  if new.email is distinct from old.email
    or new.phone is distinct from old.phone
    or new.notification_preferences is distinct from old.notification_preferences
  then
    raise exception 'Profile contact and notification fields must be updated through profile_private_data.';
  end if;

  if public.is_admin() then
    return new;
  end if;

  if old.id is distinct from (select auth.uid()) then
    raise exception 'Only administrators can update other profiles.';
  end if;

  if new.id is distinct from old.id
    or new.roles is distinct from old.roles
    or new.teaching_course_types is distinct from old.teaching_course_types
    or new.is_online_student is distinct from old.is_online_student
    or new.created_at is distinct from old.created_at
  then
    raise exception 'Only administrators can update protected profile fields.';
  end if;

  return new;
end;
$$;

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (
  name,
  roles,
  first_name,
  last_name,
  avatar_url,
  preferred_language,
  teaching_course_types,
  is_online_student,
  updated_at
) on public.profiles to authenticated;
grant delete on public.profiles to authenticated;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.prevent_profile_privilege_escalation() from public, anon, authenticated;
