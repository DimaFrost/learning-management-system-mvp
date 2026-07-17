create table if not exists public.book_reading_submission_comments (
  id bigserial primary key,
  submission_id bigint not null references public.book_reading_submissions(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists book_reading_submission_comments_submission_id_idx
  on public.book_reading_submission_comments(submission_id);

alter table public.book_reading_submission_comments enable row level security;

grant select, insert, delete on public.book_reading_submission_comments to authenticated;
grant usage, select on sequence public.book_reading_submission_comments_id_seq to authenticated;

drop policy if exists "book_reading_submission_comments_select_scoped" on public.book_reading_submission_comments;
create policy "book_reading_submission_comments_select_scoped"
  on public.book_reading_submission_comments for select
  to authenticated
  using (
    exists (
      select 1
      from public.book_reading_submissions brs
      join public.book_reading_assignments bra on bra.id = brs.assignment_id
      where brs.id = book_reading_submission_comments.submission_id
        and (
          brs.student_id = (select auth.uid())
          or exists (
            select 1 from public.profiles
            where profiles.id = (select auth.uid())
              and profiles.roles @> array['administrator']::text[]
          )
          or exists (
            select 1
            from public.subjects s
            join public.classes c on c.subject_id = s.id
            where s.course_id = bra.course_id
              and c.teacher_id = (select auth.uid())
          )
        )
    )
  );

drop policy if exists "book_reading_submission_comments_insert_scoped" on public.book_reading_submission_comments;
create policy "book_reading_submission_comments_insert_scoped"
  on public.book_reading_submission_comments for insert
  to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (
      select 1
      from public.book_reading_submissions brs
      join public.book_reading_assignments bra on bra.id = brs.assignment_id
      where brs.id = book_reading_submission_comments.submission_id
        and (
          brs.student_id = (select auth.uid())
          or exists (
            select 1 from public.profiles
            where profiles.id = (select auth.uid())
              and profiles.roles @> array['administrator']::text[]
          )
          or exists (
            select 1
            from public.subjects s
            join public.classes c on c.subject_id = s.id
            where s.course_id = bra.course_id
              and c.teacher_id = (select auth.uid())
          )
        )
    )
  );

drop policy if exists "book_reading_submission_comments_delete_own_or_admin" on public.book_reading_submission_comments;
create policy "book_reading_submission_comments_delete_own_or_admin"
  on public.book_reading_submission_comments for delete
  to authenticated
  using (
    author_id = (select auth.uid())
    or exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.roles @> array['administrator']::text[]
    )
  );
