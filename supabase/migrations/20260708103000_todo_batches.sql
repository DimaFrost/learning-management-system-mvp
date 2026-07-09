create table if not exists public.todo_batches (
  id bigint generated always as identity primary key,
  title text not null check (char_length(btrim(title)) > 0),
  description text,
  created_by uuid not null references public.profiles(id) on delete cascade,
  due_date date not null,
  priority text not null default 'none' check (priority in ('none', 'priority')),
  assignment_type text not null default 'person' check (assignment_type in ('person', 'category')),
  target_label text not null,
  target_ids text[] not null default '{}'::text[],
  recipient_count integer not null default 1 check (recipient_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.todo_items
  add column if not exists batch_id bigint references public.todo_batches(id) on delete set null;

create index if not exists todo_batches_created_by_idx
  on public.todo_batches (created_by);

create index if not exists todo_items_batch_id_idx
  on public.todo_items (batch_id);

alter table public.todo_batches enable row level security;

grant select, insert, update, delete on public.todo_batches to authenticated;
grant usage, select on sequence public.todo_batches_id_seq to authenticated;

create policy "Admins can read all todo batches"
  on public.todo_batches
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and roles @> array['administrator']::text[]
    )
  );

create policy "Creators can read own todo batches"
  on public.todo_batches
  for select
  to authenticated
  using (created_by = auth.uid());

create policy "Assigned users can read linked todo batches"
  on public.todo_batches
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.todo_items
      where todo_items.batch_id = todo_batches.id
        and todo_items.assigned_to = auth.uid()
    )
  );

create policy "Admins can create todo batches"
  on public.todo_batches
  for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and roles @> array['administrator']::text[]
    )
  );

create policy "Staff can create personal todo batches"
  on public.todo_batches
  for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and assignment_type = 'person'
    and target_ids = array[auth.uid()::text]
  );

create policy "Admins can update todo batches"
  on public.todo_batches
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and roles @> array['administrator']::text[]
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and roles @> array['administrator']::text[]
    )
  );

create policy "Creators can delete own todo batches"
  on public.todo_batches
  for delete
  to authenticated
  using (
    created_by = auth.uid()
    or exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and roles @> array['administrator']::text[]
    )
  );
