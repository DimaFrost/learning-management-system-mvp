alter table public.duty_transfer_requests
  drop constraint if exists duty_transfer_requests_status_check;

alter table public.duty_transfer_requests
  add constraint duty_transfer_requests_status_check
  check (status = any (array['pending'::text, 'accepted'::text, 'approved'::text, 'rejected'::text]));

drop policy if exists transfer_update on public.duty_transfer_requests;

create policy transfer_update on public.duty_transfer_requests
for update
to authenticated
using (
  public.is_admin()
  or (
    auth.uid() = to_student_id
    and status = 'pending'
  )
)
with check (
  public.is_admin()
  or (
    auth.uid() = to_student_id
    and status in ('accepted', 'rejected')
  )
);

drop policy if exists duty_transfer_accept_update on public.duty_schedule;

create policy duty_transfer_accept_update on public.duty_schedule
for update
to authenticated
using (
  exists (
    select 1
    from public.duty_transfer_requests request
    where request.duty_schedule_id = duty_schedule.id
      and request.to_student_id = auth.uid()
      and request.status in ('pending', 'accepted')
  )
)
with check (
  student_id = auth.uid()
  and status = 'transferred'
  and exists (
    select 1
    from public.duty_transfer_requests request
    where request.duty_schedule_id = duty_schedule.id
      and request.to_student_id = auth.uid()
      and request.status = 'accepted'
  )
);
