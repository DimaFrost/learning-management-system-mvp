# Dev, Member Testing, and Production Environments

This app should run with three long-lived environments:

- **Dev:** the current build-and-debug environment.
- **Member Testing:** a controlled beta environment used by admins, teachers, students, and collaborators to test real workflows before release.
- **Production:** the live school portal for real daily use.

The current Supabase project (`meeqknljjrsgsbukdwcm`) should be treated as **Dev**. Member Testing and Production should each be separate Supabase projects with their own database, Auth settings, Edge Function secrets, Google Drive folders, and Cloudflare Pages environment variables.

## Why We Need A Baseline First

The repo currently stores incremental migrations, while the live Supabase project is the source of truth. That means a new Supabase project cannot be safely recreated from `supabase/migrations/` alone until we have a clean schema bootstrap.

Before creating Member Testing or Production, create a schema-only bootstrap from the current Dev database. Do not commit real table data, auth users, service-role keys, Google tokens, or CSV/database dumps containing personal information.

The Supabase CLI dump command requires a project role with enough privileges or the Dev database password exported as `SUPABASE_DB_PASSWORD`. If the CLI says `unexpected login role status 403`, set `SUPABASE_DB_PASSWORD` from the Dev project database settings and rerun the dump.

On Windows, the Supabase CLI may also require Docker Desktop to be running because it uses bundled Postgres tooling for database dumps. If Docker is unavailable, install PostgreSQL client tools and use `pg_dump` directly with the Dev database connection string.

The baseline should include:

- tables, columns, constraints, indexes, enums, and extensions
- functions, triggers, views, grants, and RLS policies
- storage buckets and policies used by the app
- exposed Data API tables/views needed by the frontend

Create the first raw draft with:

```bash
npx supabase db dump --linked --schema public,storage --file supabase/bootstrap/dev_schema_baseline.sql
```

Then create a public-only bootstrap and keep Supabase-managed storage/auth glue in a small companion file:

- `supabase/bootstrap/001_dev_public_schema_baseline.sql`
- `supabase/bootstrap/002_supabase_managed_glue.sql`

Review generated SQL before using it anywhere. If storage buckets depend on rows in `storage.buckets`, add a small separate seed migration for bucket records only; do not include user-uploaded files or personal data.

After the baseline exists, every future schema change should be an ordinary incremental migration.

## Recommended Setup

1. Keep `meeqknljjrsgsbukdwcm` as **Dev**.
2. Generate and verify a schema-only bootstrap from Dev.
3. Create a new Supabase project for **Member Testing**.
4. Apply the bootstrap to Member Testing.
5. Create a new Supabase project for **Production**.
6. Apply the same bootstrap to Production.
7. Apply all newer migrations after the bootstrap to both non-dev projects.
8. Deploy the same Edge Functions to all projects, with different secrets per environment.
9. Configure Cloudflare Pages so Dev, Member Testing, and Production builds use the matching Supabase credentials.

## Frontend Environment Variables

Cloudflare Pages and local development need these browser-safe variables:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_APP_ENV=member-testing
VITE_APP_ENV_LABEL=Member Testing
```

Use `VITE_APP_ENV=development` for Dev and `VITE_APP_ENV=production` for the live site. The header shows a small environment badge for every non-production build.

Never add a Supabase `service_role` key to any `VITE_*` variable.

## Tooling Environment Variables

Local schema sync and MCP tooling use `.env.mcp.local`:

```bash
MCP_SUPABASE_URL=
MCP_SUPABASE_SERVICE_ROLE_KEY=
```

Only point this at Member Testing or Production when intentionally applying, debugging, or syncing that environment. Switch it back to Dev afterward.

## Supabase Edge Function Secrets

Set these separately in each Supabase project.

Notifications:

```bash
APP_URL=
LOGO_URL=
BREVO_API_KEY=
BREVO_FROM_EMAIL=
BREVO_FROM_NAME=
PROCESS_NOTIFICATION_SECRET=
```

Google Docs and Drive:

```bash
GOOGLE_DOCS_OAUTH_CLIENT_ID=
GOOGLE_DOCS_OAUTH_CLIENT_SECRET=
GOOGLE_DOCS_REDIRECT_URI=
GOOGLE_FIRST_YEAR_FOLDER_ID=
GOOGLE_SECOND_YEAR_FOLDER_ID=
GOOGLE_SHARED_FOLDER_ID=
GOOGLE_DOC_TEMPLATE_ID=
GOOGLE_SERVICE_ACCOUNT_JSON=
DRIVE_ROOT_FOLDER_ID=
```

Books:

```bash
GOOGLE_BOOKS_API_KEY=
```

Dev, Member Testing, and Production should use separate folders and URLs so test documents do not pollute the real school archive.

## Auth And Google Configuration

Configure Supabase Auth separately for each project:

- Site URL for the matching Cloudflare URL
- Redirect URLs for local development, Member Testing, and Production as needed
- Google OAuth provider client ID and secret

Configure Google OAuth redirect URIs for both Supabase Auth and the `google-docs-v2` Edge Function redirect in each environment.

If the app is restricted to a Google Workspace organization, personal Google accounts will not be able to complete Google OAuth. Keep student sign-in and school Google Docs authorization as separate decisions.

## Promotion Workflow

1. Develop locally against Dev.
2. Apply and verify migrations in Dev first.
3. Run `npm run db:schema:sync` after schema or API exposure changes.
4. Promote the tested changes to Member Testing.
5. Apply the same migrations to Member Testing.
6. Deploy Edge Functions to Member Testing.
7. Test with real member roles.
8. Merge the tested branch into `main`.
9. Apply the same migrations and Edge Function versions to Production.
10. Deploy Cloudflare Pages Production.
11. Run a smoke test: sign in, load dashboard, open Classroom, send a test notification if appropriate, and verify logs.

## Data Policy

- Do not copy Production personal data into Dev or Member Testing unless it is anonymized.
- Do not send testing emails to all real users unless explicitly intended.
- Keep Dev and Member Testing email subjects visibly marked or route them to a small testing group when possible.
- Keep Dev, Member Testing, and Production Google Drive folders separate.

## Deployment Checklist

- [ ] Dev remains connected to `meeqknljjrsgsbukdwcm`.
- [ ] Member Testing Supabase project exists.
- [ ] Production Supabase project exists.
- [ ] Schema bootstrap has been applied and reviewed in Member Testing.
- [ ] Schema bootstrap has been applied and reviewed in Production.
- [ ] Incremental migrations after the bootstrap have been applied to Member Testing and Production.
- [ ] RLS policies are enabled and verified.
- [ ] Storage buckets and policies exist.
- [ ] Edge Functions are deployed.
- [ ] Edge Function secrets are set.
- [ ] Supabase Auth URLs and Google provider settings are configured.
- [ ] Cloudflare Pages environment variables are set for Dev, Member Testing, and Production.
- [ ] `npm run build` passes.
- [ ] Smoke tests pass in Member Testing.
- [ ] Smoke tests pass in Production.
