alter table public.announcements
  add column if not exists status text not null default 'published',
  add column if not exists scheduled_at timestamp with time zone,
  add column if not exists published_at timestamp with time zone;

alter table public.announcements
  drop constraint if exists announcements_status_check;

alter table public.announcements
  add constraint announcements_status_check
  check (status in ('draft', 'scheduled', 'published', 'archived'));

update public.announcements
set published_at = coalesce(published_at, created_at),
    status = coalesce(status, 'published')
where published_at is null
   or status is null;

create table if not exists public.notification_jobs (
  id bigserial primary key,
  type text not null,
  announcement_id bigint references public.announcements(id) on delete cascade,
  status text not null default 'pending',
  scheduled_for timestamp with time zone not null default now(),
  processed_at timestamp with time zone,
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  payload jsonb not null default '{}'::jsonb,
  error_message text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint notification_jobs_status_check
    check (status in ('pending', 'processing', 'completed', 'failed', 'canceled'))
);

create unique index if not exists notification_jobs_announcement_type_key
  on public.notification_jobs (announcement_id, type);

create index if not exists notification_jobs_due_idx
  on public.notification_jobs (status, scheduled_for)
  where status in ('pending', 'failed');

create table if not exists public.notification_deliveries (
  id bigserial primary key,
  job_id bigint not null references public.notification_jobs(id) on delete cascade,
  recipient_id uuid references public.profiles(id) on delete set null,
  recipient_email text not null,
  status text not null default 'pending',
  provider text not null default 'brevo',
  provider_message_id text,
  error_message text,
  sent_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  constraint notification_deliveries_status_check
    check (status in ('pending', 'sent', 'failed', 'skipped'))
);

create index if not exists notification_deliveries_job_idx
  on public.notification_deliveries (job_id);

alter table public.notification_jobs enable row level security;
alter table public.notification_deliveries enable row level security;

drop policy if exists "Notification jobs can be created by owner" on public.notification_jobs;
create policy "Notification jobs can be created by owner"
  on public.notification_jobs
  for insert
  to authenticated
  with check (created_by = (select auth.uid()));

drop policy if exists "Notification jobs can be updated by owner" on public.notification_jobs;
create policy "Notification jobs can be updated by owner"
  on public.notification_jobs
  for update
  to authenticated
  using (created_by = (select auth.uid()))
  with check (created_by = (select auth.uid()));

drop policy if exists "Notification jobs can be read by owner" on public.notification_jobs;
create policy "Notification jobs can be read by owner"
  on public.notification_jobs
  for select
  to authenticated
  using (created_by = (select auth.uid()));

