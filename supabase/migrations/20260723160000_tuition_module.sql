create table if not exists public.tuition_plans (
  id bigint generated always as identity primary key,
  name text not null,
  course_id bigint references public.courses(id) on delete set null,
  academic_year text,
  currency text not null default 'EUR',
  total_amount numeric(12,2) not null default 0,
  status text not null default 'active' check (status in ('draft', 'active', 'archived')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tuition_installments (
  id bigint generated always as identity primary key,
  plan_id bigint not null references public.tuition_plans(id) on delete cascade,
  title text not null,
  amount numeric(12,2) not null default 0,
  due_date date not null,
  reminder_days_before integer not null default 7,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.student_tuition_accounts (
  id bigint generated always as identity primary key,
  student_id uuid not null references public.profiles(id) on delete cascade,
  plan_id bigint not null references public.tuition_plans(id) on delete cascade,
  expected_amount numeric(12,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  status text not null default 'open' check (status in ('open', 'part_paid', 'paid', 'overdue', 'waived')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(student_id, plan_id)
);

create table if not exists public.student_tuition_payments (
  id bigint generated always as identity primary key,
  account_id bigint not null references public.student_tuition_accounts(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  payment_date date not null default current_date,
  method text not null default 'cash',
  reference text,
  note text,
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.tuition_reminder_logs (
  id bigint generated always as identity primary key,
  account_id bigint references public.student_tuition_accounts(id) on delete cascade,
  installment_id bigint references public.tuition_installments(id) on delete set null,
  student_id uuid not null references public.profiles(id) on delete cascade,
  sent_by uuid references public.profiles(id) on delete set null,
  subject text not null,
  body text not null,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed', 'canceled')),
  notification_job_id bigint references public.notification_jobs(id) on delete set null,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.tuition_plans enable row level security;
alter table public.tuition_installments enable row level security;
alter table public.student_tuition_accounts enable row level security;
alter table public.student_tuition_payments enable row level security;
alter table public.tuition_reminder_logs enable row level security;

drop policy if exists "Admins manage tuition plans" on public.tuition_plans;
create policy "Admins manage tuition plans" on public.tuition_plans
  for all using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.roles @> array['administrator'::text]))
  with check (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.roles @> array['administrator'::text]));

drop policy if exists "Admins manage tuition installments" on public.tuition_installments;
create policy "Admins manage tuition installments" on public.tuition_installments
  for all using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.roles @> array['administrator'::text]))
  with check (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.roles @> array['administrator'::text]));

drop policy if exists "Admins manage tuition accounts" on public.student_tuition_accounts;
create policy "Admins manage tuition accounts" on public.student_tuition_accounts
  for all using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.roles @> array['administrator'::text]))
  with check (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.roles @> array['administrator'::text]));

drop policy if exists "Admins manage tuition payments" on public.student_tuition_payments;
create policy "Admins manage tuition payments" on public.student_tuition_payments
  for all using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.roles @> array['administrator'::text]))
  with check (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.roles @> array['administrator'::text]));

drop policy if exists "Admins manage tuition reminder logs" on public.tuition_reminder_logs;
create policy "Admins manage tuition reminder logs" on public.tuition_reminder_logs
  for all using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.roles @> array['administrator'::text]))
  with check (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.roles @> array['administrator'::text]));
