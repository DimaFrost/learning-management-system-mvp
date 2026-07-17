create table if not exists public.stream_course_settings (
  course_id bigint primary key references public.courses(id) on delete cascade,
  permission text not null default 'students_comment'
    check (permission in ('students_post_comment', 'students_comment', 'staff_only')),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.stream_course_settings enable row level security;

grant select, insert, update, delete on public.stream_course_settings to authenticated;

drop policy if exists "stream_course_settings_select_scoped" on public.stream_course_settings;
create policy "stream_course_settings_select_scoped"
  on public.stream_course_settings for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.roles && array['administrator', 'teacher']::text[]
    )
    or exists (
      select 1 from public.course_students
      where course_students.course_id = stream_course_settings.course_id
        and course_students.student_id = (select auth.uid())
        and course_students.status = 'active'
    )
  );

drop policy if exists "stream_course_settings_admin_teacher_upsert" on public.stream_course_settings;
create policy "stream_course_settings_admin_upsert"
  on public.stream_course_settings for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.roles @> array['administrator']::text[]
    )
  );

drop policy if exists "stream_course_settings_admin_teacher_update" on public.stream_course_settings;
create policy "stream_course_settings_admin_update"
  on public.stream_course_settings for update
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

create or replace function public.can_current_user_write_stream(
  target_course_id bigint,
  action text
)
returns boolean
language sql
stable
security invoker
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

drop policy if exists announcements_insert on public.announcements;
drop policy if exists "announcements_insert" on public.announcements;
drop policy if exists "announcements_admin_insert" on public.announcements;
create policy announcements_insert
  on public.announcements for insert
  to authenticated
  with check (
    author_id = (select auth.uid())
    and (
      exists (
        select 1 from public.profiles
        where profiles.id = (select auth.uid())
          and profiles.roles && array['administrator', 'teacher']::text[]
      )
      or (
        course_id is not null
        and public.can_current_user_write_stream(course_id, 'post')
        and status = 'published'
        and target_roles is null
        and is_staff_only = false
      )
    )
  );

drop policy if exists comments_insert on public.announcement_comments;
drop policy if exists "comments_insert" on public.announcement_comments;
drop policy if exists "comments_authenticated_insert" on public.announcement_comments;
create policy comments_insert
  on public.announcement_comments for insert
  to authenticated
  with check (
    author_id = (select auth.uid())
    and (
      exists (
        select 1 from public.profiles
        where profiles.id = (select auth.uid())
          and profiles.roles && array['administrator', 'teacher']::text[]
      )
      or exists (
        select 1
        from public.announcements a
        where a.id = announcement_comments.announcement_id
          and a.status = 'published'
          and a.course_id is not null
          and public.can_current_user_write_stream(a.course_id, 'comment')
      )
    )
  );
