create table if not exists public.prayer_schedule (
  id bigint generated always as identity primary key,
  week_start date not null,
  week_end date not null,
  tuesday_student_id uuid references public.profiles(id) on delete set null,
  thursday_student_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint prayer_schedule_week_start_key unique (week_start)
);

create index if not exists prayer_schedule_week_start_idx on public.prayer_schedule (week_start);

alter table public.prayer_schedule enable row level security;

grant select, insert, update, delete on public.prayer_schedule to authenticated;
grant usage, select on sequence public.prayer_schedule_id_seq to authenticated;

create policy "Authenticated users can read prayer schedule"
  on public.prayer_schedule for select to authenticated using (true);

create policy "Admins can manage prayer schedule"
  on public.prayer_schedule for all to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and roles @> array['administrator']::text[]))
  with check (exists (select 1 from public.profiles where id = auth.uid() and roles @> array['administrator']::text[]));
