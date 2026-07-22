alter table public.homework_assignments
  add column if not exists grading_due_date date;

create index if not exists homework_assignments_grading_due_date_idx
  on public.homework_assignments(grading_due_date);
