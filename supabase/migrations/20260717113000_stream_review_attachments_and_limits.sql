alter table public.announcements
  drop constraint if exists announcements_status_check;

alter table public.announcements
  add constraint announcements_status_check
  check (status in ('draft', 'scheduled', 'pending_review', 'published', 'archived'));

alter table public.announcement_attachments
  drop constraint if exists announcement_attachments_attachment_type_check;

alter table public.announcement_attachments
  add constraint announcement_attachments_attachment_type_check
  check (attachment_type in ('file', 'google_doc', 'google_sheet', 'google_slide', 'link'));

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
        and target_roles is null
        and is_staff_only = false
        and (
          (
            status = 'published'
            and coalesce(
              (
                select stream_course_settings.require_student_post_approval
                from public.stream_course_settings
                where stream_course_settings.course_id = announcements.course_id
              ),
              true
            ) = false
          )
          or (
            status = 'pending_review'
            and coalesce(
              (
                select stream_course_settings.require_student_post_approval
                from public.stream_course_settings
                where stream_course_settings.course_id = announcements.course_id
              ),
              true
            ) = true
          )
        )
      )
    )
  );

drop policy if exists attachments_insert on public.announcement_attachments;
drop policy if exists "attachments_insert" on public.announcement_attachments;
drop policy if exists "announcement_attachments_insert" on public.announcement_attachments;
create policy attachments_insert
  on public.announcement_attachments for insert
  to authenticated
  with check (
    uploader_id = (select auth.uid())
    and exists (
      select 1
      from public.announcements a
      where a.id = announcement_attachments.announcement_id
        and a.author_id = (select auth.uid())
        and (
          exists (
            select 1 from public.profiles
            where profiles.id = (select auth.uid())
              and profiles.roles && array['administrator', 'teacher']::text[]
          )
          or (
            a.course_id is not null
            and coalesce(
              (
                select stream_course_settings.allow_student_attachments
                from public.stream_course_settings
                where stream_course_settings.course_id = a.course_id
              ),
              false
            ) = true
            and public.can_current_user_write_stream(a.course_id, 'post')
          )
        )
    )
  );
