-- Move remaining legacy email flows onto notification_jobs while keeping
-- privileged email types restricted at the database boundary.

drop policy if exists "Notification jobs can be created by owner" on public.notification_jobs;
create policy "Notification jobs can be created by owner"
  on public.notification_jobs
  for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
    and (
      (
        type <> 'workflow_email'
        or exists (
          select 1
          from public.profiles p
          where p.id = (select auth.uid())
            and p.roles && array['administrator', 'team_leader']::text[]
        )
      )
      and (
        type not in ('role_change_email', 'enrollment_email')
        or exists (
          select 1
          from public.profiles p
          where p.id = (select auth.uid())
            and p.roles @> array['administrator']::text[]
        )
      )
    )
  );

drop policy if exists "Notification jobs can be updated by owner" on public.notification_jobs;
create policy "Notification jobs can be updated by owner"
  on public.notification_jobs
  for update
  to authenticated
  using (created_by = (select auth.uid()))
  with check (
    created_by = (select auth.uid())
    and (
      (
        type <> 'workflow_email'
        or exists (
          select 1
          from public.profiles p
          where p.id = (select auth.uid())
            and p.roles && array['administrator', 'team_leader']::text[]
        )
      )
      and (
        type not in ('role_change_email', 'enrollment_email')
        or exists (
          select 1
          from public.profiles p
          where p.id = (select auth.uid())
            and p.roles @> array['administrator']::text[]
        )
      )
    )
  );
