alter table public.profiles
  add column if not exists phone text;

update public.profiles as p
set phone = mt.contact_phone
from public.ministry_team_members as mtm
join public.ministry_teams as mt on mt.id = mtm.team_id
where p.id = mtm.user_id
  and mtm.role = 'leader'
  and p.phone is null
  and mt.contact_phone is not null;

alter table public.ministry_teams
  drop column if exists contact_name,
  drop column if exists contact_phone;
