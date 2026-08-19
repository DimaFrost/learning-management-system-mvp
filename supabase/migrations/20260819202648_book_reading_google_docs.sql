alter table public.book_reading_submissions
  add column if not exists google_doc_id text,
  add column if not exists google_doc_url text,
  add column if not exists file_name text;
