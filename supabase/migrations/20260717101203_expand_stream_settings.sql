alter table public.stream_course_settings
  add column if not exists require_student_post_approval boolean not null default true,
  add column if not exists allow_student_attachments boolean not null default false,
  add column if not exists email_notifications text not null default 'staff_and_pinned'
    check (email_notifications in ('all_posts', 'staff_and_pinned', 'pinned_only', 'none')),
  add column if not exists pinned_post_limit integer not null default 3
    check (pinned_post_limit between 0 and 10);
