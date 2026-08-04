-- Close remaining Supabase security advisor items for attendance RLS and
-- helper functions that should not be directly callable as RPC endpoints.

alter table public.the_well_session_attendance enable row level security;

drop policy if exists the_well_session_attendance_select on public.the_well_session_attendance;
create policy the_well_session_attendance_select
  on public.the_well_session_attendance
  for select
  to authenticated
  using (
    student_id = (select auth.uid())
    or public.is_admin()
    or exists (
      select 1
      from public.duty_schedule ds
      where ds.course_id = the_well_session_attendance.course_id
        and ds.student_id = (select auth.uid())
        and ds.status in ('active', 'transferred')
        and the_well_session_attendance.week_start between ds.week_start and ds.week_end
    )
  );

drop policy if exists the_well_session_attendance_insert on public.the_well_session_attendance;
create policy the_well_session_attendance_insert
  on public.the_well_session_attendance
  for insert
  to authenticated
  with check (
    marked_by = (select auth.uid())
    and (
      public.is_admin()
      or exists (
        select 1
        from public.duty_schedule ds
        where ds.course_id = the_well_session_attendance.course_id
          and ds.student_id = (select auth.uid())
          and ds.status in ('active', 'transferred')
          and the_well_session_attendance.week_start between ds.week_start and ds.week_end
      )
    )
  );

drop policy if exists the_well_session_attendance_update on public.the_well_session_attendance;
create policy the_well_session_attendance_update
  on public.the_well_session_attendance
  for update
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1
      from public.duty_schedule ds
      where ds.course_id = the_well_session_attendance.course_id
        and ds.student_id = (select auth.uid())
        and ds.status in ('active', 'transferred')
        and the_well_session_attendance.week_start between ds.week_start and ds.week_end
    )
  )
  with check (
    marked_by = (select auth.uid())
    and (
      public.is_admin()
      or exists (
        select 1
        from public.duty_schedule ds
        where ds.course_id = the_well_session_attendance.course_id
          and ds.student_id = (select auth.uid())
          and ds.status in ('active', 'transferred')
          and the_well_session_attendance.week_start between ds.week_start and ds.week_end
      )
    )
  );

drop policy if exists the_well_session_attendance_delete on public.the_well_session_attendance;
create policy the_well_session_attendance_delete
  on public.the_well_session_attendance
  for delete
  to authenticated
  using (public.is_admin());

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and 'administrator' = any(roles)
  );
$$;

create or replace function public.can_current_user_write_stream(
  target_course_id bigint,
  action text
)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  with me as (
    select roles from public.profiles where id = (select auth.uid())
  ),
  setting as (
    select coalesce(
      (select permission from public.stream_course_settings where course_id = target_course_id),
      'students_comment'
    ) as permission
  )
  select
    exists (select 1 from me where roles @> array['administrator']::text[])
    or exists (
      select 1
      from public.subjects s
      join public.classes c on c.subject_id = s.id
      where s.course_id = target_course_id
        and c.teacher_id = (select auth.uid())
    )
    or (
      exists (select 1 from me where roles @> array['student']::text[])
      and exists (
        select 1 from public.course_students
        where course_students.course_id = target_course_id
          and course_students.student_id = (select auth.uid())
          and course_students.status = 'active'
      )
      and (
        (action = 'comment' and (select permission from setting) in ('students_post_comment', 'students_comment'))
        or (action = 'post' and (select permission from setting) = 'students_post_comment')
      )
    );
$$;

revoke execute on function public.enforce_classes_translator_only_update() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.prevent_profile_privilege_escalation() from public, anon, authenticated;
revoke execute on function public.prevent_profile_private_data_escalation() from public, anon, authenticated;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

revoke execute on function public.can_current_user_write_stream(bigint, text) from public, anon;
grant execute on function public.can_current_user_write_stream(bigint, text) to authenticated;

revoke execute on function public.is_translation_ministry_team_leader() from public, anon;
grant execute on function public.is_translation_ministry_team_leader() to authenticated;
