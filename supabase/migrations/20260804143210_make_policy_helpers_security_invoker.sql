create or replace function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and 'administrator' = any(roles)
  );
$$;

create or replace function public.is_translation_ministry_team_leader()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.roles @> array['team_leader']::text[]
    )
    and exists (
      select 1
      from public.ministry_teams t
      where t.active = true
        and (
          lower(t.name) = 'translation'
          or lower(coalesce(t.name_bg, '')) = 'превод'
        )
        and (
          t.leader_id = (select auth.uid())
          or exists (
            select 1
            from public.ministry_team_members m
            where m.team_id = t.id
              and m.user_id = (select auth.uid())
              and m.active = true
              and m.can_submit_reports = true
          )
        )
    );
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

revoke execute on function public.is_translation_ministry_team_leader() from public, anon;
grant execute on function public.is_translation_ministry_team_leader() to authenticated;
