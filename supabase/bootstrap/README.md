# Supabase Schema Bootstrap

This directory is reserved for a schema-only bootstrap used to create new long-lived Supabase environments.

Current status:

- Dev project: `meeqknljjrsgsbukdwcm`
- Member Testing project: not created yet
- Production project: not created yet
- Baseline SQL: generated

Files:

- `000_raw_dev_public_storage_schema_dump.sql`: raw schema capture of `public` and `storage`; keep for review/reference because it includes Supabase-managed storage internals.
- `001_dev_public_schema_baseline.sql`: public app schema baseline intended for fresh project bootstrap.
- `002_supabase_managed_glue.sql`: auth trigger, storage bucket, and storage policies that need to be applied around Supabase-managed schemas.

The raw public/storage capture was created with:

```bash
npx supabase db dump --linked --schema public,storage --file supabase/bootstrap/dev_schema_baseline.sql
```

The public-only baseline was created with Docker `postgres:17` and the Supabase pooler because the direct database host was IPv6-only from this environment:

```bash
pg_dump --schema-only --schema=public --no-owner --no-privileges \
  -h aws-0-eu-west-1.pooler.supabase.com \
  -p 6543 \
  -U postgres.meeqknljjrsgsbukdwcm \
  -d postgres \
  -f supabase/bootstrap/001_dev_public_schema_baseline.sql
```

Supabase first rejected the CLI login role with a `403` and requested `SUPABASE_DB_PASSWORD`. After adding the password, the CLI reached the dump step, but Docker failed while pulling the Supabase Postgres image with an input/output error in Docker's container storage. A direct Docker `postgres:17` `pg_dump` through the pooler succeeded.

To recreate a fresh project:

1. Apply `001_dev_public_schema_baseline.sql`.
2. Apply `002_supabase_managed_glue.sql`.
3. Deploy Edge Functions.
4. Set Edge Function secrets for that environment.
5. Configure Supabase Auth URLs and Google OAuth redirects.
6. Run a smoke test.

Do not commit:

- data-only dumps
- auth users
- profile/user rows
- Google OAuth tokens
- service-role keys
- production database passwords
- uploaded file contents
