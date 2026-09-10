# Environment Migration Tracker

Use this file as the human-visible queue for Supabase changes that must be promoted across long-lived environments.

The migration files in `supabase/migrations/` remain the source of truth. This tracker exists so Dev, Member Testing, and Production do not drift quietly when a migration is applied manually or through MCP.

## Status Key

- `Applied`: confirmed applied to that environment.
- `Pending`: must still be applied before that environment can run the matching app code safely.
- `Verify`: expected or unknown state; check before promoting.
- `N/A`: not intended for that environment.

## Current Queue

| Migration | Purpose | Dev | Member Testing | Production | Notes |
| --- | --- | --- | --- | --- | --- |
| `20260909081241_consolidate_notification_cron_and_prune_logs.sql` | Consolidates notification cron behavior and prunes old cron logs. | Verify | Verify | Pending | Confirm per environment before relying on the single notification processor path. |
| `20260909161639_set_auth_token_empty_string_defaults.sql` | Fixes Supabase Auth token null/default issues seen during Google sign-in. | Verify | Verify | Pending | Important for fresh sign-ins and environment bootstrap health. |
| `20260910143000_student_accepts_duty_transfer.sql` | Lets receiving students accept or decline duty transfers and updates scoped RLS. | Applied | Applied | Pending | Applied to Dev project `meeqknljjrsgsbukdwcm` and Member Testing project `uhaekmvbglavaqtnxrbq` on 2026-09-10. |

## Promotion Checklist

Before deploying app code to Member Testing or Production:

1. Check the target environment migration history.
2. Apply every `Pending` migration required by the app code being deployed.
3. Verify any `Verify` rows and update this file.
4. Run the Environment Status page against the target environment.
5. Run `npm run db:schema:sync` after applying Dev schema/API changes, then commit the migration file, tracker update, and generated schema snapshot together.

## Environment Refs

| Environment | Supabase project ref | Notes |
| --- | --- | --- |
| Dev | `meeqknljjrsgsbukdwcm` | Current live development source of truth. |
| Member Testing | `uhaekmvbglavaqtnxrbq` | Member-facing beta/testing environment. |
| Production | TBD | Fill in when the production Supabase project is created. |
