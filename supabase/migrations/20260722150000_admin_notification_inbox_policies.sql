drop policy if exists "Notification jobs can be read by admins" on public.notification_jobs;
create policy "Notification jobs can be read by admins"
  on public.notification_jobs
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.roles @> array['administrator']::text[]
    )
  );

drop policy if exists "Notification deliveries can be read by admins" on public.notification_deliveries;
create policy "Notification deliveries can be read by admins"
  on public.notification_deliveries
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.roles @> array['administrator']::text[]
    )
  );
