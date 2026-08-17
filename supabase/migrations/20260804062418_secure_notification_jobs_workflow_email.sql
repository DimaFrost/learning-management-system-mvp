-- Tighten notification job writes so browser clients cannot create arbitrary
-- workflow emails. Workflow emails are used for operational/admin flows such
-- as tuition reminders and must only be created by privileged roles.

drop policy if exists "Notification jobs can be created by owner" on public.notification_jobs;
create policy "Notification jobs can be created by owner"
  on public.notification_jobs
  for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
    and (
      type <> 'workflow_email'
      or exists (
        select 1
        from public.profiles p
        where p.id = (select auth.uid())
          and p.roles && array['administrator', 'team_leader']::text[]
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
      type <> 'workflow_email'
      or exists (
        select 1
        from public.profiles p
        where p.id = (select auth.uid())
          and p.roles && array['administrator', 'team_leader']::text[]
      )
    )
  );
