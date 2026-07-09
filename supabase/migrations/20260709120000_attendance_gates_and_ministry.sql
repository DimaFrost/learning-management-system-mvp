alter table public.attendance_settings
  add column if not exists present_credit numeric not null default 1,
  add column if not exists late_credit numeric not null default 0.5,
  add column if not exists absent_credit numeric not null default 0,
  add column if not exists late_uses_global_credit boolean not null default true,
  add column if not exists class_required_percent numeric not null default 0.8,
  add column if not exists class_included_weekdays integer[] not null default array[2,4],
  add column if not exists class_sessions_per_day integer not null default 2,
  add column if not exists class_joint_counts_once boolean not null default true,
  add column if not exists the_well_enabled boolean not null default true,
  add column if not exists the_well_weekday integer not null default 3,
  add column if not exists the_well_fallback_enabled boolean not null default true,
  add column if not exists the_well_fallback_percent numeric not null default 0.5,
  add column if not exists activation_enabled boolean not null default true,
  add column if not exists activation_frequency text not null default 'monthly',
  add column if not exists activation_max_lost_credits numeric not null default 1,
  add column if not exists activation_detection_rule text not null default 'saturday_both',
  add column if not exists ministry_enabled boolean not null default true,
  add column if not exists ministry_sunday_required_credits numeric not null default 2,
  add column if not exists ministry_sunday_period_months integer not null default 1,
  add column if not exists ministry_first_year_rotation_months integer not null default 2,
  add column if not exists ministry_second_year_rotation_months integer not null default 4,
  add column if not exists ministry_team_leaders_can_mark boolean not null default true,
  add column if not exists ministry_admins_can_override_rotations boolean not null default true,
  add column if not exists status_on_track_threshold numeric not null default 0.9,
  add column if not exists status_at_risk_threshold numeric not null default 0.8,
  add column if not exists status_failing_threshold numeric not null default 0.8,
  add column if not exists show_classes_on_student_view boolean not null default true,
  add column if not exists show_the_well_on_student_view boolean not null default true,
  add column if not exists show_activation_on_student_view boolean not null default true,
  add column if not exists show_ministry_on_student_view boolean not null default true,
  add column if not exists show_fallback_scores boolean not null default true,
  add column if not exists remind_missing_class_attendance boolean not null default true,
  add column if not exists remind_missing_well_attendance boolean not null default true,
  add column if not exists remind_missing_ministry_attendance boolean not null default true;

update public.attendance_settings
set
  late_credit = 0.5,
  late_class_weight = 0.5,
  late_saturday_weight = 0.5,
  late_well_weight = 0.5,
  class_required_percent = coalesce(graduation_threshold, 0.8),
  ministry_sunday_required_credits = coalesce(sunday_required_per_month, 2)
where id = 1;

create table if not exists public.ministry_teams (
  id bigint generated always as identity primary key,
  name text not null check (char_length(btrim(name)) > 0),
  name_bg text,
  info text,
  leader_id uuid references public.profiles(id) on delete set null,
  contact_name text,
  contact_phone text,
  call_time text,
  service_type text not null default 'sunday' check (service_type in ('sunday', 'non_sunday')),
  service_day integer check (service_day between 0 and 6),
  required_credits numeric not null default 2 check (required_credits >= 0),
  requirement_period_months integer not null default 1 check (requirement_period_months > 0),
  requirement_unit text not null default 'month' check (requirement_unit in ('month', 'rotation', 'school_year')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ministry_rotations (
  id bigint generated always as identity primary key,
  course_id bigint not null references public.courses(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  team_id bigint not null references public.ministry_teams(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  status text not null default 'active' check (status in ('active', 'locked', 'completed')),
  locked boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create table if not exists public.ministry_service_sessions (
  id bigint generated always as identity primary key,
  team_id bigint not null references public.ministry_teams(id) on delete cascade,
  service_date date not null,
  title text not null check (char_length(btrim(title)) > 0),
  service_type text not null default 'sunday' check (service_type in ('sunday', 'non_sunday')),
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ministry_service_attendance (
  id bigint generated always as identity primary key,
  session_id bigint not null references public.ministry_service_sessions(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'absent' check (status in ('present', 'late', 'absent')),
  marked_by uuid not null references public.profiles(id) on delete cascade,
  marked_at timestamptz not null default now(),
  unique (session_id, student_id)
);

create index if not exists ministry_teams_leader_idx on public.ministry_teams (leader_id);
create index if not exists ministry_rotations_student_course_idx on public.ministry_rotations (student_id, course_id);
create index if not exists ministry_rotations_team_dates_idx on public.ministry_rotations (team_id, start_date, end_date);
create index if not exists ministry_service_sessions_team_date_idx on public.ministry_service_sessions (team_id, service_date);
create index if not exists ministry_service_attendance_session_idx on public.ministry_service_attendance (session_id);

alter table public.ministry_teams enable row level security;
alter table public.ministry_rotations enable row level security;
alter table public.ministry_service_sessions enable row level security;
alter table public.ministry_service_attendance enable row level security;

grant select, insert, update, delete on public.ministry_teams to authenticated;
grant select, insert, update, delete on public.ministry_rotations to authenticated;
grant select, insert, update, delete on public.ministry_service_sessions to authenticated;
grant select, insert, update, delete on public.ministry_service_attendance to authenticated;
grant usage, select on sequence public.ministry_teams_id_seq to authenticated;
grant usage, select on sequence public.ministry_rotations_id_seq to authenticated;
grant usage, select on sequence public.ministry_service_sessions_id_seq to authenticated;
grant usage, select on sequence public.ministry_service_attendance_id_seq to authenticated;

create policy "Authenticated users can read ministry teams"
  on public.ministry_teams for select to authenticated using (true);

create policy "Authenticated users can read ministry rotations"
  on public.ministry_rotations for select to authenticated using (true);

create policy "Authenticated users can read ministry sessions"
  on public.ministry_service_sessions for select to authenticated using (true);

create policy "Authenticated users can read ministry attendance"
  on public.ministry_service_attendance for select to authenticated using (true);

create policy "Admins can manage ministry teams"
  on public.ministry_teams for all to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and roles @> array['administrator']::text[]))
  with check (exists (select 1 from public.profiles where id = auth.uid() and roles @> array['administrator']::text[]));

create policy "Admins can manage ministry rotations"
  on public.ministry_rotations for all to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and roles @> array['administrator']::text[]))
  with check (exists (select 1 from public.profiles where id = auth.uid() and roles @> array['administrator']::text[]));

create policy "Admins and leaders can create ministry sessions"
  on public.ministry_service_sessions for insert to authenticated
  with check (
    created_by = auth.uid()
    and (
      exists (select 1 from public.profiles where id = auth.uid() and roles @> array['administrator']::text[])
      or exists (select 1 from public.ministry_teams where id = team_id and leader_id = auth.uid())
    )
  );

create policy "Admins and leaders can update ministry sessions"
  on public.ministry_service_sessions for update to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and roles @> array['administrator']::text[])
    or exists (select 1 from public.ministry_teams where id = team_id and leader_id = auth.uid())
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and roles @> array['administrator']::text[])
    or exists (select 1 from public.ministry_teams where id = team_id and leader_id = auth.uid())
  );

create policy "Admins and leaders can mark ministry attendance"
  on public.ministry_service_attendance for all to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and roles @> array['administrator']::text[])
    or exists (
      select 1
      from public.ministry_service_sessions
      join public.ministry_teams on ministry_teams.id = ministry_service_sessions.team_id
      where ministry_service_sessions.id = session_id
        and ministry_teams.leader_id = auth.uid()
    )
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and roles @> array['administrator']::text[])
    or exists (
      select 1
      from public.ministry_service_sessions
      join public.ministry_teams on ministry_teams.id = ministry_service_sessions.team_id
      where ministry_service_sessions.id = session_id
        and ministry_teams.leader_id = auth.uid()
    )
  );
