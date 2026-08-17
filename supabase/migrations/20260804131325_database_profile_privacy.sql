-- Tighten profile access at the database/API layer.
--
-- RLS is row-level only, so this migration combines:
-- - safe column grants on public.profiles for directory-style joins
-- - a guarded private view for self/admin reads of contact/preferences fields
-- - an update trigger that prevents non-admin users from changing protected fields

alter table public.profiles enable row level security;

drop view if exists public.profile_private_access;

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

  if public.is_admin() then
    return new;
  end if;

  if old.id is distinct from (select auth.uid()) then
    raise exception 'Only administrators can update other profiles.';
  end if;

  if new.id is distinct from old.id
    or new.email is distinct from old.email
    or new.phone is distinct from old.phone
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

revoke execute on function public.prevent_profile_privilege_escalation() from public, anon, authenticated;

drop trigger if exists prevent_profile_privilege_escalation on public.profiles;
create trigger prevent_profile_privilege_escalation
  before update on public.profiles
  for each row
  execute function public.prevent_profile_privilege_escalation();

drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update"
  on public.profiles
  for update
  to authenticated
  using (((select auth.uid()) = id) or public.is_admin())
  with check (((select auth.uid()) = id) or public.is_admin());

create view public.profile_private_access as
select
  id,
  name,
  email,
  phone,
  roles,
  first_name,
  last_name,
  notification_preferences,
  avatar_url,
  preferred_language,
  teaching_course_types,
  is_online_student,
  created_at,
  updated_at
from public.profiles
where id = (select auth.uid()) or public.is_admin();

revoke all on public.profile_private_access from public, anon, authenticated;
revoke all on public.profiles from anon, authenticated;
grant select (
  id,
  name,
  roles,
  first_name,
  last_name,
  avatar_url,
  preferred_language,
  teaching_course_types,
  is_online_student
) on public.profiles to authenticated;
grant update (
  name,
  email,
  phone,
  roles,
  first_name,
  last_name,
  notification_preferences,
  avatar_url,
  preferred_language,
  teaching_course_types,
  is_online_student,
  updated_at
) on public.profiles to authenticated;
grant delete on public.profiles to authenticated;

grant select on public.profile_private_access to authenticated;
