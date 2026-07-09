create table if not exists public.todo_items (
  id bigint generated always as identity primary key,
  title text not null check (char_length(btrim(title)) > 0),
  description text,
  assigned_to uuid not null references public.profiles(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  due_date date not null,
  priority text not null default 'none' check (priority in ('none', 'priority')),
  status text not null default 'open' check (status in ('open', 'completed')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists todo_items_assigned_to_status_due_idx
  on public.todo_items (assigned_to, status, due_date);

create index if not exists todo_items_priority_due_idx
  on public.todo_items (priority, due_date)
  where status = 'open';

create index if not exists todo_items_created_by_idx
  on public.todo_items (created_by);

alter table public.todo_items enable row level security;

grant select, insert, update, delete on public.todo_items to authenticated;
grant usage, select on sequence public.todo_items_id_seq to authenticated;

create policy "Admins can read all todos"
  on public.todo_items
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

create policy "Staff can read their own todos"
  on public.todo_items
  for select
  to authenticated
  using (assigned_to = auth.uid() or created_by = auth.uid());

create policy "Admins can assign todos"
  on public.todo_items
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

create policy "Staff can create personal todos"
  on public.todo_items
  for insert
  to authenticated
  with check (created_by = auth.uid() and assigned_to = auth.uid());

create policy "Admins can update all todos"
  on public.todo_items
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

create policy "Staff can update their own todos"
  on public.todo_items
  for update
  to authenticated
  using (assigned_to = auth.uid() or created_by = auth.uid())
  with check (assigned_to = auth.uid() or created_by = auth.uid());

create policy "Admins and creators can delete todos"
  on public.todo_items
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
