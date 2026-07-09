alter table public.announcements
  add column if not exists title_bg text,
  add column if not exists content_bg text;

alter table public.announcements
  drop constraint if exists announcements_has_content_language_check;

alter table public.announcements
  add constraint announcements_has_content_language_check
  check (
    (
      nullif(trim(coalesce(title, '')), '') is not null
      and nullif(trim(coalesce(content, '')), '') is not null
    )
    or (
      nullif(trim(coalesce(title_bg, '')), '') is not null
      and nullif(trim(coalesce(content_bg, '')), '') is not null
    )
  );
