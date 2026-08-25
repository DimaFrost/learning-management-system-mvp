alter table public.profiles
  add column if not exists student_number text;

update public.profiles
set student_number = upper(regexp_replace(student_number, '\s+', '', 'g'))
where student_number is not null;

alter table public.profiles
  drop constraint if exists profiles_student_number_format_check;

alter table public.profiles
  add constraint profiles_student_number_format_check
  check (
    student_number is null
    or student_number ~ '^[A-Z0-9]{1,10}$'
  );

create unique index if not exists profiles_student_number_unique_idx
  on public.profiles (student_number)
  where student_number is not null;

grant update (
  student_number
) on public.profiles to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_record public.profile_invites%rowtype;
  invite_payload jsonb := '{}'::jsonb;
  invite_roles text[] := '{}'::text[];
  invite_teaching_course_types text[] := '{}'::text[];
  invite_notification_preferences jsonb := null;
  profile_name text;
  derived_first_name text;
  derived_last_name text;
  default_notification_preferences jsonb := jsonb_build_object(
    'announcements', true,
    'roleChange', true,
    'enrollment', true,
    'messages', true
  );
begin
  select *
  into invite_record
  from public.profile_invites
  where lower(email) = lower(coalesce(new.email, ''))
    and status = 'pending'
  order by created_at desc
  limit 1;

  if invite_record.id is not null then
    invite_payload := coalesce(invite_record.payload, '{}'::jsonb);

    select coalesce(array_agg(value), '{}'::text[])
    into invite_roles
    from jsonb_array_elements_text(coalesce(invite_payload->'roles', '[]'::jsonb)) as value;

    select coalesce(array_agg(value), '{}'::text[])
    into invite_teaching_course_types
    from jsonb_array_elements_text(coalesce(invite_payload->'teachingCourseTypes', '[]'::jsonb)) as value;
  end if;

  profile_name := coalesce(
    nullif(invite_payload->>'name', ''),
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(new.email, '@', 1)
  );

  derived_first_name := coalesce(
    nullif(invite_payload->>'firstName', ''),
    split_part(profile_name, ' ', 1),
    ''
  );
  derived_last_name := coalesce(
    nullif(invite_payload->>'lastName', ''),
    nullif(trim(regexp_replace(profile_name, '^\S+\s*', '')), ''),
    ''
  );

  insert into public.profiles (
    id,
    name,
    roles,
    first_name,
    last_name,
    preferred_language,
    teaching_course_types,
    is_online_student,
    student_number
  )
  values (
    new.id,
    profile_name,
    invite_roles,
    derived_first_name,
    derived_last_name,
    case when invite_payload->>'preferredLanguage' = 'bg' then 'bg' else 'en' end,
    invite_teaching_course_types,
    case
      when invite_payload->>'isOnlineStudent' in ('true', 'false') then (invite_payload->>'isOnlineStudent')::boolean
      else false
    end,
    nullif(upper(regexp_replace(coalesce(invite_payload->>'studentNumber', ''), '\s+', '', 'g')), '')
  )
  on conflict (id) do update
  set
    name = excluded.name,
    roles = case
      when cardinality(excluded.roles) > 0 then excluded.roles
      else public.profiles.roles
    end,
    first_name = coalesce(nullif(excluded.first_name, ''), public.profiles.first_name, ''),
    last_name = coalesce(nullif(excluded.last_name, ''), public.profiles.last_name, ''),
    preferred_language = excluded.preferred_language,
    teaching_course_types = excluded.teaching_course_types,
    is_online_student = excluded.is_online_student,
    student_number = coalesce(excluded.student_number, public.profiles.student_number),
    updated_at = now();

  invite_notification_preferences := invite_payload->'notificationPreferences';

  insert into public.profile_private_data (
    profile_id,
    email,
    phone,
    notification_preferences
  )
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(invite_payload->>'phone', ''),
    case
      when jsonb_typeof(invite_notification_preferences) = 'object' then invite_notification_preferences
      else default_notification_preferences
    end
  )
  on conflict (profile_id) do update
  set
    email = excluded.email,
    phone = coalesce(excluded.phone, public.profile_private_data.phone),
    notification_preferences = coalesce(
      excluded.notification_preferences,
      public.profile_private_data.notification_preferences,
      default_notification_preferences
    ),
    updated_at = now();

  if invite_record.id is not null then
    update public.profile_invites
    set
      status = 'accepted',
      claimed_by = new.id,
      claimed_at = now(),
      updated_at = now()
    where id = invite_record.id;
  end if;

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
