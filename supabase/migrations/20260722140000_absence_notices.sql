create table if not exists public.absence_notices (
  id bigserial primary key,
  student_id uuid not null references public.profiles(id) on delete cascade,
  reason text,
  status text not null default 'submitted',
  submitted_at timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint absence_notices_status_check
    check (status in ('submitted', 'acknowledged', 'archived'))
);

create table if not exists public.absence_notice_sessions (
  id bigserial primary key,
  notice_id bigint not null references public.absence_notices(id) on delete cascade,
  class_id bigint not null references public.classes(id) on delete cascade,
  created_at timestamp with time zone not null default now(),
  constraint absence_notice_sessions_unique_notice_class unique (notice_id, class_id)
);

create index if not exists absence_notices_student_idx
  on public.absence_notices (student_id, submitted_at desc);

create index if not exists absence_notice_sessions_class_idx
  on public.absence_notice_sessions (class_id);

alter table public.absence_notices enable row level security;
alter table public.absence_notice_sessions enable row level security;

grant select, insert, update on public.absence_notices to authenticated;
grant select, insert on public.absence_notice_sessions to authenticated;
grant usage, select on sequence public.absence_notices_id_seq to authenticated;
grant usage, select on sequence public.absence_notice_sessions_id_seq to authenticated;

drop policy if exists "absence_notices_select_scoped" on public.absence_notices;
create policy "absence_notices_select_scoped"
  on public.absence_notices
  for select
  to authenticated
  using (
    student_id = (select auth.uid())
    or exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.roles @> array['administrator']::text[]
    )
  );

drop policy if exists "absence_notices_insert_own" on public.absence_notices;
create policy "absence_notices_insert_own"
  on public.absence_notices
  for insert
  to authenticated
  with check (student_id = (select auth.uid()));

drop policy if exists "absence_notices_admin_update" on public.absence_notices;
create policy "absence_notices_admin_update"
  on public.absence_notices
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.roles @> array['administrator']::text[]
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.roles @> array['administrator']::text[]
    )
  );

drop policy if exists "absence_notice_sessions_select_scoped" on public.absence_notice_sessions;
create policy "absence_notice_sessions_select_scoped"
  on public.absence_notice_sessions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.absence_notices n
      where n.id = absence_notice_sessions.notice_id
        and (
          n.student_id = (select auth.uid())
          or exists (
            select 1
            from public.profiles p
            where p.id = (select auth.uid())
              and p.roles @> array['administrator']::text[]
          )
        )
    )
  );

drop policy if exists "absence_notice_sessions_insert_own_notice" on public.absence_notice_sessions;
create policy "absence_notice_sessions_insert_own_notice"
  on public.absence_notice_sessions
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.absence_notices n
      where n.id = absence_notice_sessions.notice_id
        and n.student_id = (select auth.uid())
    )
  );
