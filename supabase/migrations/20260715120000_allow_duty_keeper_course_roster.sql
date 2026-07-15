drop policy if exists course_students_select on public.course_students;

create policy course_students_select
on public.course_students
for select
to authenticated
using (
  is_admin()
  or (select auth.uid()) = student_id
  or (select auth.uid()) = mentor_id
  or exists (
    select 1
    from public.duty_schedule ds
    where ds.course_id = course_students.course_id
      and ds.student_id = (select auth.uid())
      and ds.status in ('active', 'transferred')
      and current_date between ds.week_start and ds.week_end
  )
);
