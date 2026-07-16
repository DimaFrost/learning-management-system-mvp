create table if not exists public.books (
  id bigint generated always as identity primary key,
  internal_code text unique,
  title text not null,
  subtitle text,
  authors text[] not null default '{}',
  description text,
  publisher text,
  published_date text,
  page_count integer,
  isbn_10 text,
  isbn_13 text,
  cover_url text,
  source_provider text,
  source_id text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.book_reading_assignments (
  id bigint generated always as identity primary key,
  book_id bigint not null references public.books(id) on delete cascade,
  course_id bigint not null references public.courses(id) on delete cascade,
  assigned_by uuid references public.profiles(id) on delete set null,
  title text not null,
  instructions text,
  due_date date,
  status text not null default 'assigned' check (status in ('draft', 'assigned', 'completed', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.book_reading_submissions (
  id bigint generated always as identity primary key,
  assignment_id bigint not null references public.book_reading_assignments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'not_started' check (status in ('not_started', 'reading', 'submitted', 'returned', 'completed')),
  response_text text,
  response_url text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewer_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assignment_id, student_id)
);

create index if not exists books_isbn_10_idx on public.books(isbn_10);
create index if not exists books_isbn_13_idx on public.books(isbn_13);
create index if not exists book_reading_assignments_course_id_idx on public.book_reading_assignments(course_id);
create index if not exists book_reading_assignments_due_date_idx on public.book_reading_assignments(due_date);
create index if not exists book_reading_submissions_assignment_id_idx on public.book_reading_submissions(assignment_id);
create index if not exists book_reading_submissions_student_id_idx on public.book_reading_submissions(student_id);

alter table public.books enable row level security;
alter table public.book_reading_assignments enable row level security;
alter table public.book_reading_submissions enable row level security;

grant select, insert, update, delete on public.books to authenticated;
grant select, insert, update, delete on public.book_reading_assignments to authenticated;
grant select, insert, update, delete on public.book_reading_submissions to authenticated;
grant usage, select on sequence public.books_id_seq to authenticated;
grant usage, select on sequence public.book_reading_assignments_id_seq to authenticated;
grant usage, select on sequence public.book_reading_submissions_id_seq to authenticated;

drop policy if exists "books_select_authenticated" on public.books;
create policy "books_select_authenticated"
  on public.books for select
  to authenticated
  using (true);

drop policy if exists "books_admin_insert" on public.books;
create policy "books_admin_insert"
  on public.books for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.roles @> array['administrator']::text[]
    )
  );

drop policy if exists "books_admin_update" on public.books;
create policy "books_admin_update"
  on public.books for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.roles @> array['administrator']::text[]
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.roles @> array['administrator']::text[]
    )
  );

drop policy if exists "books_admin_delete" on public.books;
create policy "books_admin_delete"
  on public.books for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.roles @> array['administrator']::text[]
    )
  );

drop policy if exists "book_assignments_select_scoped" on public.book_reading_assignments;
create policy "book_assignments_select_scoped"
  on public.book_reading_assignments for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.roles && array['administrator', 'teacher', 'mentor']::text[]
    )
    or exists (
      select 1 from public.course_students
      where course_students.course_id = book_reading_assignments.course_id
        and course_students.student_id = (select auth.uid())
        and course_students.status = 'active'
    )
  );

drop policy if exists "book_assignments_admin_insert" on public.book_reading_assignments;
create policy "book_assignments_admin_insert"
  on public.book_reading_assignments for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.roles @> array['administrator']::text[]
    )
  );

drop policy if exists "book_assignments_admin_update" on public.book_reading_assignments;
create policy "book_assignments_admin_update"
  on public.book_reading_assignments for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.roles @> array['administrator']::text[]
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.roles @> array['administrator']::text[]
    )
  );

drop policy if exists "book_assignments_admin_delete" on public.book_reading_assignments;
create policy "book_assignments_admin_delete"
  on public.book_reading_assignments for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.roles @> array['administrator']::text[]
    )
  );

drop policy if exists "book_submissions_select_scoped" on public.book_reading_submissions;
create policy "book_submissions_select_scoped"
  on public.book_reading_submissions for select
  to authenticated
  using (
    student_id = (select auth.uid())
    or exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.roles && array['administrator', 'teacher', 'mentor']::text[]
    )
  );

drop policy if exists "book_submissions_student_insert" on public.book_reading_submissions;
create policy "book_submissions_student_insert"
  on public.book_reading_submissions for insert
  to authenticated
  with check (
    student_id = (select auth.uid())
    and exists (
      select 1
      from public.book_reading_assignments bra
      join public.course_students cs on cs.course_id = bra.course_id
      where bra.id = assignment_id
        and cs.student_id = (select auth.uid())
        and cs.status = 'active'
    )
  );

drop policy if exists "book_submissions_student_update" on public.book_reading_submissions;
create policy "book_submissions_student_update"
  on public.book_reading_submissions for update
  to authenticated
  using (
    student_id = (select auth.uid())
    or exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.roles @> array['administrator']::text[]
    )
  )
  with check (
    student_id = (select auth.uid())
    or exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.roles @> array['administrator']::text[]
    )
  );

drop policy if exists "book_submissions_admin_delete" on public.book_reading_submissions;
create policy "book_submissions_admin_delete"
  on public.book_reading_submissions for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.roles @> array['administrator']::text[]
    )
  );
