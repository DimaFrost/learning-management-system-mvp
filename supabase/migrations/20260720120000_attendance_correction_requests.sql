create table if not exists public.attendance_correction_requests (
  id bigint generated always as identity primary key,
  student_id uuid not null references public.profiles(id) on delete cascade,
  course_id bigint references public.courses(id) on delete set null,
  gate text not null check (gate in ('classes', 'the_well', 'activation', 'ministry')),
  record_date date not null,
  title text not null,
  class_id bigint references public.classes(id) on delete set null,
  well_week_start date,
  ministry_session_id bigint references public.ministry_service_sessions(id) on delete set null,
  current_status text check (current_status in ('present', 'late', 'absent') or current_status is null),
  requested_status text not null check (requested_status in ('present', 'late', 'absent')),
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolution_note text
);

create index if not exists attendance_correction_requests_student_idx
  on public.attendance_correction_requests(student_id, requested_at desc);

create index if not exists attendance_correction_requests_status_idx
  on public.attendance_correction_requests(status, requested_at desc);

alter table public.attendance_correction_requests enable row level security;

drop policy if exists attendance_correction_requests_select on public.attendance_correction_requests;
create policy attendance_correction_requests_select
on public.attendance_correction_requests
for select
to authenticated
using (
  student_id = (select auth.uid())
  or exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.roles @> array['administrator']::text[]
  )
);

drop policy if exists attendance_correction_requests_insert_own on public.attendance_correction_requests;
create policy attendance_correction_requests_insert_own
on public.attendance_correction_requests
for insert
to authenticated
with check (
  student_id = (select auth.uid())
);

drop policy if exists attendance_correction_requests_admin_update on public.attendance_correction_requests;
create policy attendance_correction_requests_admin_update
on public.attendance_correction_requests
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.roles @> array['administrator']::text[]
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.roles @> array['administrator']::text[]
  )
);
