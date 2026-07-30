-- Allow Translation ministry team leaders to update classes.translator_id only.

create or replace function public.is_translation_ministry_team_leader()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.roles @> array['team_leader']::text[]
    )
    and exists (
      select 1
      from public.ministry_teams t
      where t.active = true
        and (
          lower(t.name) = 'translation'
          or lower(coalesce(t.name_bg, '')) = 'превод'
        )
        and (
          t.leader_id = (select auth.uid())
          or exists (
            select 1
            from public.ministry_team_members m
            where m.team_id = t.id
              and m.user_id = (select auth.uid())
              and m.active = true
              and m.can_submit_reports = true
          )
        )
    );
$$;

revoke all on function public.is_translation_ministry_team_leader() from public;
grant execute on function public.is_translation_ministry_team_leader() to authenticated;

create or replace function public.enforce_classes_translator_only_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if public.is_translation_ministry_team_leader() then
    if new.subject_id is distinct from old.subject_id
      or new.title is distinct from old.title
      or new.date is distinct from old.date
      or new.hour is distinct from old.hour
      or new.teacher_id is distinct from old.teacher_id
      or new.drive_folder_id is distinct from old.drive_folder_id
      or new.materials_folder_id is distinct from old.materials_folder_id
      or new.homework_folder_id is distinct from old.homework_folder_id
      or new.teacher_notes_folder_id is distinct from old.teacher_notes_folder_id
      or new.translator_notes_folder_id is distinct from old.translator_notes_folder_id
      or new.created_at is distinct from old.created_at
    then
      raise exception 'Translation team leaders may only update translator_id on classes';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists classes_translator_only_update on public.classes;
create trigger classes_translator_only_update
  before update on public.classes
  for each row
  execute function public.enforce_classes_translator_only_update();

drop policy if exists "Translation team leaders can assign class translators" on public.classes;
create policy "Translation team leaders can assign class translators"
  on public.classes
  for update
  to authenticated
  using (public.is_translation_ministry_team_leader())
  with check (public.is_translation_ministry_team_leader());
