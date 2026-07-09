insert into public.ministry_teams (
  name,
  name_bg,
  service_type,
  service_day,
  required_credits,
  requirement_period_months,
  requirement_unit,
  active
)
select *
from (
  values
    ('Greeting', 'Посрещане', 'sunday', 0, 2::numeric, 1, 'month', true),
    ('Video team', 'Видео екип', 'sunday', 0, 2::numeric, 1, 'month', true),
    ('Hosting', 'Настаняване', 'sunday', 0, 2::numeric, 1, 'month', true),
    ('Connections', 'Свързване', 'sunday', 0, 2::numeric, 1, 'month', true),
    ('Set up', 'Подреждане', 'sunday', 0, 2::numeric, 1, 'month', true),
    ('Media', 'Медия', 'sunday', 0, 2::numeric, 1, 'month', true),
    ('Hospitality', 'Домакини (Кафе)', 'sunday', 0, 2::numeric, 1, 'month', true),
    ('Stage manager', null, 'sunday', 0, 2::numeric, 1, 'month', true),
    ('Zoe Kids', 'Зое Кидс', 'sunday', 0, 2::numeric, 1, 'month', true),
    ('Translation', 'Превод', 'sunday', 0, 2::numeric, 1, 'month', true),
    ('Feeding the homeless', null, 'non_sunday', null, 1::numeric, 1, 'month', true),
    ('Children of hope', null, 'non_sunday', null, 1::numeric, 1, 'month', true)
) as seed(name, name_bg, service_type, service_day, required_credits, requirement_period_months, requirement_unit, active)
where not exists (
  select 1
  from public.ministry_teams
  where lower(ministry_teams.name) = lower(seed.name)
);
