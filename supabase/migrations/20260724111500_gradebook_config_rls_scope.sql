drop policy if exists "grade_categories_admin_teacher_write" on public.grade_categories;
create policy "grade_categories_admin_teacher_write"
  on public.grade_categories for all
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and 'administrator' = any(profiles.roles)
    )
    or (
      course_id is not null
      and exists (
        select 1
        from public.courses
        join public.subjects on subjects.course_id = courses.id
        join public.classes on classes.subject_id = subjects.id
        where courses.id = grade_categories.course_id
          and classes.teacher_id = auth.uid()
      )
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and 'administrator' = any(profiles.roles)
    )
    or (
      course_id is not null
      and exists (
        select 1
        from public.courses
        join public.subjects on subjects.course_id = courses.id
        join public.classes on classes.subject_id = subjects.id
        where courses.id = grade_categories.course_id
          and classes.teacher_id = auth.uid()
      )
    )
  );

drop policy if exists "grading_periods_admin_teacher_write" on public.grading_periods;
create policy "grading_periods_admin_teacher_write"
  on public.grading_periods for all
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and 'administrator' = any(profiles.roles)
    )
    or (
      course_id is not null
      and exists (
        select 1
        from public.courses
        join public.subjects on subjects.course_id = courses.id
        join public.classes on classes.subject_id = subjects.id
        where courses.id = grading_periods.course_id
          and classes.teacher_id = auth.uid()
      )
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and 'administrator' = any(profiles.roles)
    )
    or (
      course_id is not null
      and exists (
        select 1
        from public.courses
        join public.subjects on subjects.course_id = courses.id
        join public.classes on classes.subject_id = subjects.id
        where courses.id = grading_periods.course_id
          and classes.teacher_id = auth.uid()
      )
    )
  );

drop policy if exists "grade_settings_admin_teacher_write" on public.grade_settings;
create policy "grade_settings_admin_teacher_write"
  on public.grade_settings for all
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and 'administrator' = any(profiles.roles)
    )
    or (
      course_id is not null
      and exists (
        select 1
        from public.courses
        join public.subjects on subjects.course_id = courses.id
        join public.classes on classes.subject_id = subjects.id
        where courses.id = grade_settings.course_id
          and classes.teacher_id = auth.uid()
      )
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and 'administrator' = any(profiles.roles)
    )
    or (
      course_id is not null
      and exists (
        select 1
        from public.courses
        join public.subjects on subjects.course_id = courses.id
        join public.classes on classes.subject_id = subjects.id
        where courses.id = grade_settings.course_id
          and classes.teacher_id = auth.uid()
      )
    )
  );
