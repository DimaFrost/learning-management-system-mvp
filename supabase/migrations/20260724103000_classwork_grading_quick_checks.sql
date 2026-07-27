create table if not exists public.grade_categories (
  id bigserial primary key,
  course_id bigint references public.courses(id) on delete cascade,
  name text not null,
  default_points integer not null default 100,
  weight_percent numeric(5,2),
  color text not null default '#1a73e8',
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.grading_periods (
  id bigserial primary key,
  course_id bigint references public.courses(id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint grading_period_dates_check check (start_date <= end_date)
);

create table if not exists public.grade_settings (
  id bigserial primary key,
  course_id bigint references public.courses(id) on delete cascade unique,
  calculation_method text not null default 'total_points',
  show_overall_grade_to_students boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint grade_settings_calculation_method_check
    check (calculation_method in ('no_overall_grade', 'total_points', 'weighted_by_category'))
);

alter table public.homework_assignments
  add column if not exists work_type text not null default 'assignment',
  add column if not exists question_type text,
  add column if not exists question_options jsonb not null default '[]'::jsonb,
  add column if not exists grade_category_id bigint references public.grade_categories(id) on delete set null,
  add column if not exists grading_period_id bigint references public.grading_periods(id) on delete set null;

alter table public.homework_assignments
  drop constraint if exists homework_assignments_work_type_check;

alter table public.homework_assignments
  add constraint homework_assignments_work_type_check
    check (work_type in ('assignment', 'quick_check'));

alter table public.homework_assignments
  drop constraint if exists homework_assignments_question_type_check;

alter table public.homework_assignments
  add constraint homework_assignments_question_type_check
    check (question_type is null or question_type in ('short_answer', 'multiple_choice'));

alter table public.homework_submissions
  add column if not exists response_text text,
  add column if not exists selected_option text;

create index if not exists grade_categories_course_id_idx on public.grade_categories(course_id);
create index if not exists grading_periods_course_id_idx on public.grading_periods(course_id);
create index if not exists homework_assignments_work_type_idx on public.homework_assignments(work_type);
create index if not exists homework_assignments_grade_category_id_idx on public.homework_assignments(grade_category_id);
create index if not exists homework_assignments_grading_period_id_idx on public.homework_assignments(grading_period_id);

alter table public.grade_categories enable row level security;
alter table public.grading_periods enable row level security;
alter table public.grade_settings enable row level security;

grant select, insert, update, delete on public.grade_categories to authenticated;
grant select, insert, update, delete on public.grading_periods to authenticated;
grant select, insert, update, delete on public.grade_settings to authenticated;
grant usage, select on sequence public.grade_categories_id_seq to authenticated;
grant usage, select on sequence public.grading_periods_id_seq to authenticated;
grant usage, select on sequence public.grade_settings_id_seq to authenticated;

drop policy if exists "grade_categories_select_scoped" on public.grade_categories;
create policy "grade_categories_select_scoped"
  on public.grade_categories for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.roles && array['administrator', 'teacher', 'student']::text[]
    )
  );

drop policy if exists "grading_periods_select_scoped" on public.grading_periods;
create policy "grading_periods_select_scoped"
  on public.grading_periods for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.roles && array['administrator', 'teacher', 'student']::text[]
    )
  );

drop policy if exists "grade_settings_select_scoped" on public.grade_settings;
create policy "grade_settings_select_scoped"
  on public.grade_settings for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.roles && array['administrator', 'teacher', 'student']::text[]
    )
  );

drop policy if exists "grade_categories_admin_teacher_write" on public.grade_categories;
create policy "grade_categories_admin_teacher_write"
  on public.grade_categories for all
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.roles && array['administrator', 'teacher']::text[]
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.roles && array['administrator', 'teacher']::text[]
    )
  );

drop policy if exists "grading_periods_admin_teacher_write" on public.grading_periods;
create policy "grading_periods_admin_teacher_write"
  on public.grading_periods for all
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.roles && array['administrator', 'teacher']::text[]
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.roles && array['administrator', 'teacher']::text[]
    )
  );

drop policy if exists "grade_settings_admin_teacher_write" on public.grade_settings;
create policy "grade_settings_admin_teacher_write"
  on public.grade_settings for all
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.roles && array['administrator', 'teacher']::text[]
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.roles && array['administrator', 'teacher']::text[]
    )
  );
