create index if not exists announcements_feed_order_idx
  on public.announcements (is_pinned desc, created_at desc);

create index if not exists announcements_author_id_idx
  on public.announcements (author_id);

create index if not exists announcements_course_id_idx
  on public.announcements (course_id);

create index if not exists announcements_status_schedule_idx
  on public.announcements (status, scheduled_at);

create index if not exists announcements_target_roles_gin_idx
  on public.announcements using gin (target_roles);

create index if not exists announcement_comments_announcement_id_idx
  on public.announcement_comments (announcement_id);

create index if not exists announcement_comments_author_id_idx
  on public.announcement_comments (author_id);

create index if not exists announcement_attachments_announcement_id_idx
  on public.announcement_attachments (announcement_id);

create index if not exists announcement_attachments_uploader_id_idx
  on public.announcement_attachments (uploader_id);

create index if not exists profiles_roles_gin_idx
  on public.profiles using gin (roles);

create index if not exists course_students_student_status_idx
  on public.course_students (student_id, status);

create index if not exists course_students_mentor_status_idx
  on public.course_students (mentor_id, status);

create index if not exists course_students_course_status_idx
  on public.course_students (course_id, status);

create index if not exists subjects_course_id_idx
  on public.subjects (course_id);

create index if not exists classes_subject_id_idx
  on public.classes (subject_id);

create index if not exists classes_teacher_id_idx
  on public.classes (teacher_id);

create index if not exists classes_translator_id_idx
  on public.classes (translator_id);

create index if not exists book_reading_assignments_book_id_idx
  on public.book_reading_assignments (book_id);

create index if not exists book_reading_assignments_status_due_idx
  on public.book_reading_assignments (status, due_date);

create index if not exists book_reading_submission_comments_author_id_idx
  on public.book_reading_submission_comments (author_id);
