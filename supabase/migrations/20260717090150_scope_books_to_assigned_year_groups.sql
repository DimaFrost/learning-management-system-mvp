drop policy if exists "books_select_authenticated" on public.books;
create policy "books_select_scoped"
  on public.books for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.roles @> array['administrator']::text[]
    )
    or exists (
      select 1
      from public.book_reading_assignments bra
      join public.course_students cs on cs.course_id = bra.course_id
      where bra.book_id = books.id
        and cs.student_id = (select auth.uid())
        and cs.status = 'active'
    )
    or exists (
      select 1
      from public.book_reading_assignments bra
      join public.subjects s on s.course_id = bra.course_id
      join public.classes c on c.subject_id = s.id
      where bra.book_id = books.id
        and (
          c.teacher_id = (select auth.uid())
          or c.translator_id = (select auth.uid())
        )
    )
    or exists (
      select 1
      from public.book_reading_assignments bra
      join public.course_students cs on cs.course_id = bra.course_id
      where bra.book_id = books.id
        and cs.mentor_id = (select auth.uid())
        and cs.status = 'active'
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
        and profiles.roles @> array['administrator']::text[]
    )
    or exists (
      select 1 from public.course_students
      where course_students.course_id = book_reading_assignments.course_id
        and course_students.student_id = (select auth.uid())
        and course_students.status = 'active'
    )
    or exists (
      select 1
      from public.subjects s
      join public.classes c on c.subject_id = s.id
      where s.course_id = book_reading_assignments.course_id
        and (
          c.teacher_id = (select auth.uid())
          or c.translator_id = (select auth.uid())
        )
    )
    or exists (
      select 1
      from public.course_students cs
      where cs.course_id = book_reading_assignments.course_id
        and cs.mentor_id = (select auth.uid())
        and cs.status = 'active'
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
        and profiles.roles @> array['administrator']::text[]
    )
    or exists (
      select 1
      from public.book_reading_assignments bra
      join public.subjects s on s.course_id = bra.course_id
      join public.classes c on c.subject_id = s.id
      where bra.id = book_reading_submissions.assignment_id
        and (
          c.teacher_id = (select auth.uid())
          or c.translator_id = (select auth.uid())
        )
    )
    or exists (
      select 1
      from public.book_reading_assignments bra
      join public.course_students cs on cs.course_id = bra.course_id
      where bra.id = book_reading_submissions.assignment_id
        and cs.mentor_id = (select auth.uid())
        and cs.status = 'active'
    )
  );
