create table if not exists public.announcement_reactions (
  id bigint generated always as identity primary key,
  announcement_id bigint not null references public.announcements(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  constraint announcement_reactions_emoji_check check (char_length(emoji) between 1 and 16),
  constraint announcement_reactions_unique unique (announcement_id, user_id, emoji)
);

create index if not exists announcement_reactions_announcement_idx
  on public.announcement_reactions (announcement_id);

create index if not exists announcement_reactions_user_idx
  on public.announcement_reactions (user_id);

alter table public.announcement_reactions enable row level security;

grant select, insert, delete on public.announcement_reactions to authenticated;
grant usage, select on sequence public.announcement_reactions_id_seq to authenticated;

drop policy if exists "announcement reactions are viewable by authenticated users"
  on public.announcement_reactions;
create policy "announcement reactions are viewable by authenticated users"
  on public.announcement_reactions
  for select
  to authenticated
  using (true);

drop policy if exists "users can add their own announcement reactions"
  on public.announcement_reactions;
create policy "users can add their own announcement reactions"
  on public.announcement_reactions
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "users can remove their own announcement reactions"
  on public.announcement_reactions;
create policy "users can remove their own announcement reactions"
  on public.announcement_reactions
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);
