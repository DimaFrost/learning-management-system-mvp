alter table public.homework_assignments
  add column if not exists subject_id bigint references public.subjects(id) on delete cascade;

update public.homework_assignments ha
set subject_id = c.subject_id
from public.classes c
where ha.class_id = c.id
  and ha.subject_id is null;

alter table public.homework_assignments
  alter column class_id drop not null;

alter table public.homework_assignments
  add constraint homework_assignments_subject_or_class_check
  check (subject_id is not null or class_id is not null);

create index if not exists homework_assignments_subject_id_idx
  on public.homework_assignments(subject_id);

alter table public.class_files
  add column if not exists subject_id bigint references public.subjects(id) on delete cascade;

update public.class_files cf
set subject_id = c.subject_id
from public.classes c
where cf.class_id = c.id
  and cf.subject_id is null;

alter table public.class_files
  alter column class_id drop not null;

alter table public.class_files
  add constraint class_files_subject_or_class_check
  check (subject_id is not null or class_id is not null);

create index if not exists class_files_subject_id_idx
  on public.class_files(subject_id);
