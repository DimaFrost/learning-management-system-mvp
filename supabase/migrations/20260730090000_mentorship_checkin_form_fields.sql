-- Extend mentorship_logs for the month-based Google Form check-in questionnaire.

alter table public.mentorship_logs
  add column if not exists meeting_month text,
  add column if not exists in_person_meeting text,
  add column if not exists meetings_count text,
  add column if not exists stayed_in_touch text,
  add column if not exists main_topic text,
  add column if not exists engagement text,
  add column if not exists challenges text,
  add column if not exists school_support text,
  add column if not exists positive_moment text,
  add column if not exists other_observations text;

comment on column public.mentorship_logs.meeting_month is 'YYYY-MM month of conducted meetings selected by the mentor';
comment on column public.mentorship_logs.in_person_meeting is 'Q1: yes | planned_soon | unable';
comment on column public.mentorship_logs.meetings_count is 'Q2: 0 | 1 | 2 | more_than_2';
comment on column public.mentorship_logs.stayed_in_touch is 'Q3: regularly | occasionally | no';
comment on column public.mentorship_logs.main_topic is 'Q4: main discussion topic';
comment on column public.mentorship_logs.engagement is 'Q5: very_high | good | moderate | low';
comment on column public.mentorship_logs.challenges is 'Q6: mentoring difficulties';
comment on column public.mentorship_logs.school_support is 'Q7: school support request';
comment on column public.mentorship_logs.positive_moment is 'Q8: positive moment or progress';
comment on column public.mentorship_logs.other_observations is 'Q9: other observations';
