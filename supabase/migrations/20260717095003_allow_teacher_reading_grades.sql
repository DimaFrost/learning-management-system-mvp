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
    or exists (
      select 1
      from public.book_reading_assignments bra
      join public.subjects s on s.course_id = bra.course_id
      join public.classes c on c.subject_id = s.id
      where bra.id = book_reading_submissions.assignment_id
        and c.teacher_id = (select auth.uid())
    )
  )
  with check (
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
        and c.teacher_id = (select auth.uid())
    )
  );
