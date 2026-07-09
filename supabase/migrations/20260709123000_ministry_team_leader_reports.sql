alter table public.ministry_service_sessions
  add column if not exists general_view text,
  add column if not exists wins_testimonies text,
  add column if not exists challenges text,
  add column if not exists timely_actions text,
  add column if not exists submitted_at timestamptz not null default now();

drop policy if exists "Admins and leaders can create ministry sessions" on public.ministry_service_sessions;
drop policy if exists "Admins and leaders can update ministry sessions" on public.ministry_service_sessions;
drop policy if exists "Admins and leaders can mark ministry attendance" on public.ministry_service_attendance;

create policy "Admins and assigned team leaders can create ministry reports"
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
        from public.profiles
        join public.ministry_teams on ministry_teams.leader_id = profiles.id
        where profiles.id = (select auth.uid())
          and profiles.roles @> array['team_leader']::text[]
          and ministry_teams.id = team_id
      )
    )
  );

create policy "Admins and assigned team leaders can update ministry reports"
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
      from public.profiles
      join public.ministry_teams on ministry_teams.leader_id = profiles.id
      where profiles.id = (select auth.uid())
        and profiles.roles @> array['team_leader']::text[]
        and ministry_teams.id = team_id
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
      from public.profiles
      join public.ministry_teams on ministry_teams.leader_id = profiles.id
      where profiles.id = (select auth.uid())
        and profiles.roles @> array['team_leader']::text[]
        and ministry_teams.id = team_id
    )
  );

create policy "Admins and assigned team leaders can mark ministry attendance"
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
      join public.ministry_teams on ministry_teams.id = ministry_service_sessions.team_id
      join public.profiles on profiles.id = ministry_teams.leader_id
      where ministry_service_sessions.id = session_id
        and profiles.id = (select auth.uid())
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
      join public.ministry_teams on ministry_teams.id = ministry_service_sessions.team_id
      join public.profiles on profiles.id = ministry_teams.leader_id
      where ministry_service_sessions.id = session_id
        and profiles.id = (select auth.uid())
        and profiles.roles @> array['team_leader']::text[]
    )
  );
