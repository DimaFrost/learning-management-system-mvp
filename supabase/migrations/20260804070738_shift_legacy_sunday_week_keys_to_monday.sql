-- Earlier local-date helpers stored week_start values as Sunday in timezones
-- east of UTC. Normalize legacy schedule rows to Monday week keys.

update public.duty_schedule
set
  week_start = week_start + interval '1 day',
  week_end = week_end + interval '1 day'
where extract(isodow from week_start) = 7;

update public.prayer_schedule
set
  week_start = week_start + interval '1 day',
  week_end = week_end + interval '1 day'
where extract(isodow from week_start) = 7;

update public.well_schedule
set week_start = week_start + interval '1 day'
where extract(isodow from week_start) = 7;

update public.attendance_correction_requests
set well_week_start = well_week_start + interval '1 day'
where well_week_start is not null
  and extract(isodow from well_week_start) = 7;
