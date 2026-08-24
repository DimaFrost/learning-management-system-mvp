create table if not exists public.calendar_events (
  id bigserial primary key,
  title text not null,
  description text,
  location text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean not null default false,
  target_roles text[] not null default '{}',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calendar_events_title_not_blank check (length(btrim(title)) > 0),
  constraint calendar_events_end_after_start check (ends_at is null or ends_at >= starts_at)
);

create index if not exists calendar_events_starts_at_idx
  on public.calendar_events (starts_at);

create index if not exists calendar_events_target_roles_gin_idx
  on public.calendar_events using gin (target_roles);

alter table public.calendar_events enable row level security;

grant select, insert, update, delete on public.calendar_events to authenticated;
grant usage, select on sequence public.calendar_events_id_seq to authenticated;

drop policy if exists calendar_events_select on public.calendar_events;
create policy calendar_events_select
  on public.calendar_events for select
  to authenticated
  using (
    public.is_admin()
    or created_by = (select auth.uid())
    or target_roles @> array['audience:all']::text[]
    or target_roles @> array['user:' || (select auth.uid())]::text[]
    or (
      target_roles @> array['audience:staff']::text[]
      and exists (
        select 1
        from public.profiles p
        where p.id = (select auth.uid())
          and p.roles && array['administrator', 'teacher', 'translator', 'mentor', 'team_leader']::text[]
      )
    )
    or (
      target_roles @> array['role:teacher']::text[]
      and exists (
        select 1
        from public.profiles p
        where p.id = (select auth.uid())
          and p.roles @> array['teacher']::text[]
      )
    )
    or (
      target_roles @> array['role:translator']::text[]
      and exists (
        select 1
        from public.profiles p
        where p.id = (select auth.uid())
          and p.roles @> array['translator']::text[]
      )
    )
    or (
      target_roles @> array['role:mentor']::text[]
      and exists (
        select 1
        from public.profiles p
        where p.id = (select auth.uid())
          and p.roles @> array['mentor']::text[]
      )
    )
    or (
      target_roles @> array['role:team_leader']::text[]
      and exists (
        select 1
        from public.profiles p
        where p.id = (select auth.uid())
          and p.roles @> array['team_leader']::text[]
      )
    )
    or (
      target_roles @> array['course:first_year']::text[]
      and (
        exists (
          select 1
          from public.course_students cs
          join public.courses co on co.id = cs.course_id
          where cs.student_id = (select auth.uid())
            and cs.status = 'active'
            and co.status = 'active'
            and co.course_type = 'first_year'
        )
        or exists (
          select 1
          from public.profiles p
          where p.id = (select auth.uid())
            and p.roles @> array['teacher']::text[]
            and p.teaching_course_types @> array['first_year']::text[]
        )
        or exists (
          select 1
          from public.course_students cs
          join public.courses co on co.id = cs.course_id
          where cs.mentor_id = (select auth.uid())
            and cs.status = 'active'
            and co.status = 'active'
            and co.course_type = 'first_year'
        )
      )
    )
    or (
      target_roles @> array['course:second_year']::text[]
      and (
        exists (
          select 1
          from public.course_students cs
          join public.courses co on co.id = cs.course_id
          where cs.student_id = (select auth.uid())
            and cs.status = 'active'
            and co.status = 'active'
            and co.course_type = 'second_year'
        )
        or exists (
          select 1
          from public.profiles p
          where p.id = (select auth.uid())
            and p.roles @> array['teacher']::text[]
            and p.teaching_course_types @> array['second_year']::text[]
        )
        or exists (
          select 1
          from public.course_students cs
          join public.courses co on co.id = cs.course_id
          where cs.mentor_id = (select auth.uid())
            and cs.status = 'active'
            and co.status = 'active'
            and co.course_type = 'second_year'
        )
      )
    )
  );

drop policy if exists calendar_events_admin_insert on public.calendar_events;
create policy calendar_events_admin_insert
  on public.calendar_events for insert
  to authenticated
  with check (public.is_admin() and created_by = (select auth.uid()));

drop policy if exists calendar_events_admin_update on public.calendar_events;
create policy calendar_events_admin_update
  on public.calendar_events for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists calendar_events_admin_delete on public.calendar_events;
create policy calendar_events_admin_delete
  on public.calendar_events for delete
  to authenticated
  using (public.is_admin());
