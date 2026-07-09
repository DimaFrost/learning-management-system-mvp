create table if not exists public.ministry_team_members (
  id bigint generated always as identity primary key,
  team_id bigint not null references public.ministry_teams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'leader' check (role in ('leader', 'assistant', 'member')),
  can_submit_reports boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, user_id)
);

insert into public.ministry_team_members (team_id, user_id, role, can_submit_reports, active)
select id, leader_id, 'leader', true, true
from public.ministry_teams
where leader_id is not null
on conflict (team_id, user_id) do update
set role = excluded.role,
    can_submit_reports = true,
    active = true,
    updated_at = now();

create index if not exists ministry_team_members_team_idx on public.ministry_team_members (team_id);
create index if not exists ministry_team_members_user_idx on public.ministry_team_members (user_id);

alter table public.ministry_team_members enable row level security;

grant select, insert, update, delete on public.ministry_team_members to authenticated;
grant usage, select on sequence public.ministry_team_members_id_seq to authenticated;

create policy "Authenticated users can read ministry team members"
  on public.ministry_team_members for select to authenticated using (true);

create policy "Admins can manage ministry team members"
  on public.ministry_team_members for all to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where id = (select auth.uid())
        and roles @> array['administrator']::text[]
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      where id = (select auth.uid())
        and roles @> array['administrator']::text[]
    )
  );

drop policy if exists "Admins and assigned team leaders can create ministry reports" on public.ministry_service_sessions;
drop policy if exists "Admins and assigned team leaders can update ministry reports" on public.ministry_service_sessions;
drop policy if exists "Admins and assigned team leaders can mark ministry attendance" on public.ministry_service_attendance;

create policy "Admins and assigned team members can create ministry reports"
  on public.ministry_service_sessions for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (
      exists (
        select 1
        from public.profiles
        where id = (select auth.uid())
          and roles @> array['administrator']::text[]
      )
      or exists (
        select 1
        from public.ministry_team_members
        join public.profiles on profiles.id = ministry_team_members.user_id
        where ministry_team_members.team_id = ministry_service_sessions.team_id
          and ministry_team_members.user_id = (select auth.uid())
          and ministry_team_members.active = true
          and ministry_team_members.can_submit_reports = true
          and profiles.roles @> array['team_leader']::text[]
      )
    )
  );

create policy "Admins and assigned team members can update ministry reports"
  on public.ministry_service_sessions for update to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where id = (select auth.uid())
        and roles @> array['administrator']::text[]
    )
    or exists (
      select 1
      from public.ministry_team_members
      join public.profiles on profiles.id = ministry_team_members.user_id
      where ministry_team_members.team_id = ministry_service_sessions.team_id
        and ministry_team_members.user_id = (select auth.uid())
        and ministry_team_members.active = true
        and ministry_team_members.can_submit_reports = true
        and profiles.roles @> array['team_leader']::text[]
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      where id = (select auth.uid())
        and roles @> array['administrator']::text[]
    )
    or exists (
      select 1
      from public.ministry_team_members
      join public.profiles on profiles.id = ministry_team_members.user_id
      where ministry_team_members.team_id = ministry_service_sessions.team_id
        and ministry_team_members.user_id = (select auth.uid())
        and ministry_team_members.active = true
        and ministry_team_members.can_submit_reports = true
        and profiles.roles @> array['team_leader']::text[]
    )
  );

create policy "Admins and assigned team members can mark ministry attendance"
  on public.ministry_service_attendance for all to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where id = (select auth.uid())
        and roles @> array['administrator']::text[]
    )
    or exists (
      select 1
      from public.ministry_service_sessions
      join public.ministry_team_members on ministry_team_members.team_id = ministry_service_sessions.team_id
      join public.profiles on profiles.id = ministry_team_members.user_id
      where ministry_service_sessions.id = ministry_service_attendance.session_id
        and ministry_team_members.user_id = (select auth.uid())
        and ministry_team_members.active = true
        and ministry_team_members.can_submit_reports = true
        and profiles.roles @> array['team_leader']::text[]
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      where id = (select auth.uid())
        and roles @> array['administrator']::text[]
    )
    or exists (
      select 1
      from public.ministry_service_sessions
      join public.ministry_team_members on ministry_team_members.team_id = ministry_service_sessions.team_id
      join public.profiles on profiles.id = ministry_team_members.user_id
      where ministry_service_sessions.id = ministry_service_attendance.session_id
        and ministry_team_members.user_id = (select auth.uid())
        and ministry_team_members.active = true
        and ministry_team_members.can_submit_reports = true
        and profiles.roles @> array['team_leader']::text[]
    )
  );
