create table if not exists public.profile_invites (
  id bigint generated always as identity primary key,
  email text not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'cancelled')),
  payload jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  claimed_by uuid references public.profiles(id) on delete set null,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profile_invites_pending_email_idx
  on public.profile_invites (lower(email))
  where status = 'pending';

alter table public.profile_invites enable row level security;

drop policy if exists "profile_invites_admin_select" on public.profile_invites;
create policy "profile_invites_admin_select"
  on public.profile_invites
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "profile_invites_admin_insert" on public.profile_invites;
create policy "profile_invites_admin_insert"
  on public.profile_invites
  for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "profile_invites_admin_update" on public.profile_invites;
create policy "profile_invites_admin_update"
  on public.profile_invites
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "profile_invites_admin_delete" on public.profile_invites;
create policy "profile_invites_admin_delete"
  on public.profile_invites
  for delete
  to authenticated
  using (public.is_admin());

revoke all on public.profile_invites from anon, authenticated;
grant select, insert, update, delete on public.profile_invites to authenticated;
grant usage, select on sequence public.profile_invites_id_seq to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_name text;
  invite_record public.profile_invites%rowtype;
  invite_payload jsonb := '{}'::jsonb;
  invite_roles text[] := '{}'::text[];
  invite_teaching_course_types text[] := '{}'::text[];
  invite_notification_preferences jsonb;
begin
  select *
  into invite_record
  from public.profile_invites
  where status = 'pending'
    and lower(email) = lower(coalesce(new.email, ''))
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

  insert into public.profiles (
    id,
    name,
    roles,
    first_name,
    last_name,
    preferred_language,
    teaching_course_types,
    is_online_student
  )
  values (
    new.id,
    profile_name,
    invite_roles,
    nullif(invite_payload->>'firstName', ''),
    nullif(invite_payload->>'lastName', ''),
    case when invite_payload->>'preferredLanguage' = 'bg' then 'bg' else 'en' end,
    invite_teaching_course_types,
    coalesce((invite_payload->>'isOnlineStudent')::boolean, false)
  )
  on conflict (id) do update
  set
    name = excluded.name,
    roles = case
      when cardinality(excluded.roles) > 0 then excluded.roles
      else public.profiles.roles
    end,
    first_name = coalesce(excluded.first_name, public.profiles.first_name),
    last_name = coalesce(excluded.last_name, public.profiles.last_name),
    preferred_language = excluded.preferred_language,
    teaching_course_types = excluded.teaching_course_types,
    is_online_student = excluded.is_online_student,
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
      else null
    end
  )
  on conflict (profile_id) do update
  set
    email = excluded.email,
    phone = coalesce(excluded.phone, public.profile_private_data.phone),
    notification_preferences = coalesce(
      excluded.notification_preferences,
      public.profile_private_data.notification_preferences
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
