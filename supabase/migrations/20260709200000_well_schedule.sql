create table if not exists public.well_schedule (
  id bigint generated always as identity primary key,
  course_id bigint not null references public.courses(id) on delete cascade,
  week_start date not null,
  well_date date not null,
  created_at timestamptz not null default now(),
  constraint well_schedule_course_week_key unique (course_id, week_start)
);

create index if not exists well_schedule_course_id_idx on public.well_schedule (course_id);
create index if not exists well_schedule_well_date_idx on public.well_schedule (well_date);

alter table public.well_schedule enable row level security;

grant select, insert, update, delete on public.well_schedule to authenticated;
grant usage, select on sequence public.well_schedule_id_seq to authenticated;

create policy "Authenticated users can read well schedule"
  on public.well_schedule for select to authenticated using (true);

create policy "Admins can manage well schedule"
  on public.well_schedule for all to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and roles @> array['administrator']::text[]))
  with check (exists (select 1 from public.profiles where id = auth.uid() and roles @> array['administrator']::text[]));
