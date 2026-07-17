alter table public.book_reading_assignments
  add column if not exists max_points integer;

alter table public.book_reading_submissions
  add column if not exists points numeric,
  add column if not exists grade_comment text,
  add column if not exists graded_at timestamptz,
  add column if not exists graded_by uuid references public.profiles(id) on delete set null;

create index if not exists book_reading_submissions_graded_at_idx
  on public.book_reading_submissions(graded_at);
