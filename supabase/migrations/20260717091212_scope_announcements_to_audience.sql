drop policy if exists announcements_select on public.announcements;
create policy announcements_select
  on public.announcements for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.roles @> array['administrator']::text[]
    )
    or author_id = (select auth.uid())
    or (
      status = 'published'
      and (scheduled_at is null or scheduled_at <= now())
      and (
        (
          target_roles is null
          and course_id is null
          and is_staff_only = false
        )
        or (
          target_roles is null
          and course_id is not null
          and (
            exists (
              select 1
              from public.course_students cs
              where cs.course_id = announcements.course_id
                and cs.student_id = (select auth.uid())
                and cs.status = 'active'
            )
            or exists (
              select 1
              from public.subjects s
              join public.classes c on c.subject_id = s.id
              where s.course_id = announcements.course_id
                and c.teacher_id = (select auth.uid())
            )
            or exists (
              select 1
              from public.course_students cs
              where cs.course_id = announcements.course_id
                and cs.mentor_id = (select auth.uid())
                and cs.status = 'active'
            )
          )
        )
        or (
          is_staff_only = true
          and exists (
            select 1
            from public.profiles p
            where p.id = (select auth.uid())
              and p.roles && array['administrator', 'teacher', 'mentor', 'team_leader']::text[]
          )
        )
        or (
          target_roles is not null
          and (
            target_roles @> array['user:' || (select auth.uid())]::text[]
            or (
              target_roles @> array['audience:staff']::text[]
              and exists (
                select 1
                from public.profiles p
                where p.id = (select auth.uid())
                  and p.roles && array['administrator', 'teacher', 'mentor', 'team_leader']::text[]
              )
            )
            or (
              target_roles @> array['role:teacher']::text[]
              and exists (
                select 1
                from public.profiles p
                where p.id = (select auth.uid())
                  and p.roles @> array['teacher']::text[]
              )
            )
            or (
              target_roles @> array['role:translator']::text[]
              and exists (
                select 1
                from public.profiles p
                where p.id = (select auth.uid())
                  and p.roles @> array['translator']::text[]
              )
            )
            or (
              target_roles @> array['course:first_year']::text[]
              and (
                exists (
                  select 1
                  from public.course_students cs
                  join public.courses co on co.id = cs.course_id
                  where cs.student_id = (select auth.uid())
                    and cs.status = 'active'
                    and co.status = 'active'
                    and co.course_type = 'first_year'
                )
                or exists (
                  select 1
                  from public.courses co
                  join public.subjects s on s.course_id = co.id
                  join public.classes c on c.subject_id = s.id
                  where co.status = 'active'
                    and co.course_type = 'first_year'
                    and c.teacher_id = (select auth.uid())
                )
                or exists (
                  select 1
                  from public.course_students cs
                  join public.courses co on co.id = cs.course_id
                  where cs.mentor_id = (select auth.uid())
                    and cs.status = 'active'
                    and co.status = 'active'
                    and co.course_type = 'first_year'
                )
              )
            )
            or (
              target_roles @> array['course:second_year']::text[]
              and (
                exists (
                  select 1
                  from public.course_students cs
                  join public.courses co on co.id = cs.course_id
                  where cs.student_id = (select auth.uid())
                    and cs.status = 'active'
                    and co.status = 'active'
                    and co.course_type = 'second_year'
                )
                or exists (
                  select 1
                  from public.courses co
                  join public.subjects s on s.course_id = co.id
                  join public.classes c on c.subject_id = s.id
                  where co.status = 'active'
                    and co.course_type = 'second_year'
                    and c.teacher_id = (select auth.uid())
                )
                or exists (
                  select 1
                  from public.course_students cs
                  join public.courses co on co.id = cs.course_id
                  where cs.mentor_id = (select auth.uid())
                    and cs.status = 'active'
                    and co.status = 'active'
                    and co.course_type = 'second_year'
                )
              )
            )
          )
        )
      )
    )
  );

drop policy if exists attachments_select on public.announcement_attachments;
create policy attachments_select
  on public.announcement_attachments for select
  to authenticated
  using (
    exists (
      select 1
      from public.announcements a
      where a.id = announcement_attachments.announcement_id
    )
  );

drop policy if exists comments_select on public.announcement_comments;
create policy comments_select
  on public.announcement_comments for select
  to authenticated
  using (
    exists (
      select 1
      from public.announcements a
      where a.id = announcement_comments.announcement_id
    )
  );

drop policy if exists "announcement reactions are viewable by authenticated users" on public.announcement_reactions;
create policy "announcement reactions are viewable by scoped announcement audience"
  on public.announcement_reactions for select
  to authenticated
  using (
    exists (
      select 1
      from public.announcements a
      where a.id = announcement_reactions.announcement_id
    )
  );
