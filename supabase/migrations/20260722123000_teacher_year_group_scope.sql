alter table public.profiles
  add column if not exists teaching_course_types text[] not null default '{}';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_teaching_course_types_check'
  ) then
    alter table public.profiles
      add constraint profiles_teaching_course_types_check
      check (teaching_course_types <@ array['first_year', 'second_year']::text[]);
  end if;
end $$;
