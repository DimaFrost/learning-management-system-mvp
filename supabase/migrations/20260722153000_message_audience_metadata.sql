alter table public.messages
  add column if not exists audience_key text,
  add column if not exists audience_label text;

create index if not exists messages_audience_key_idx
  on public.messages (audience_key, created_at);
