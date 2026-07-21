create table if not exists public.google_docs_connections (
  id text primary key default 'school_docs',
  provider text not null default 'google',
  connected_email text not null,
  access_token text,
  refresh_token text not null,
  expires_at timestamptz,
  scopes text[] not null default '{}',
  connected_by uuid references public.profiles(id) on delete set null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (id = 'school_docs')
);

alter table public.google_docs_connections enable row level security;

grant select on public.google_docs_connections to authenticated;

drop policy if exists "google_docs_connections_admin_select" on public.google_docs_connections;
create policy "google_docs_connections_admin_select"
  on public.google_docs_connections for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and 'administrator' = any(profiles.roles)
    )
  );
