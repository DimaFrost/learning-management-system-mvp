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
    or new.student_number is distinct from old.student_number
    or new.created_at is distinct from old.created_at
  then
    raise exception 'Only administrators can update protected profile fields.';
  end if;

  return new;
end;
$$;

revoke execute on function public.prevent_profile_privilege_escalation() from public, anon, authenticated;
