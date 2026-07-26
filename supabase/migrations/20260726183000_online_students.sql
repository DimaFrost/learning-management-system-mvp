-- Online students: profile flag, separate online attendance requirements row,
-- and a school-wide online session (Google Meet) link setting.

alter table public.profiles
  add column if not exists is_online_student boolean not null default false;

alter table public.attendance_settings
  add column if not exists audience text not null default 'regular';

update public.attendance_settings
set audience = 'regular'
where id = 1 and audience is distinct from 'regular';

-- Replace the single-row guard so a second row (online audience) is allowed.
alter table public.attendance_settings drop constraint if exists single_row;
alter table public.attendance_settings drop constraint if exists attendance_settings_row_check;
alter table public.attendance_settings add constraint attendance_settings_row_check
  check ((id = 1 and audience = 'regular') or (id = 2 and audience = 'online'));

-- Seed the online settings row as a copy of the regular one so behavior is
-- unchanged until admins edit it. Column list is built dynamically so this
-- stays correct as attendance_settings grows.
do $$
declare
  cols text;
begin
  if not exists (select 1 from public.attendance_settings where id = 2) then
    select string_agg(quote_ident(column_name), ', ')
      into cols
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'attendance_settings'
        and column_name not in ('id', 'audience');

    execute format(
      'insert into public.attendance_settings (id, audience, %1$s) select 2, ''online'', %1$s from public.attendance_settings where id = 1',
      cols
    );
  end if;
end $$;

-- School-wide online session link. Read by everyone; existing settings_update
-- policy (is_admin()) already restricts writes to administrators.
insert into public.settings (key, value)
values ('online_session', '{"meetLink": ""}'::jsonb)
on conflict (key) do nothing;
