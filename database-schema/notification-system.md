# Notification System Notes

The LMS notification system is job-based.

## Core Tables

- `announcements.status`: `draft`, `scheduled`, `published`, or `archived`.
- `announcements.scheduled_at`: when a scheduled announcement should become active.
- `announcements.published_at`: when the announcement was published.
- `notification_jobs`: queued work for email and future notification channels.
- `notification_deliveries`: per-recipient delivery audit rows.
- `todo_items`: staff/admin operational to-dos. Priority to-dos create reminder jobs.

## Announcement Flow

- Draft announcements do not create/send notification jobs.
- Published announcements create an `announcement_email` job due immediately.
- Scheduled announcements create an `announcement_email` job due at `scheduled_at`.
- The `process-notification-jobs` Edge Function claims due jobs, resolves recipients at send time, sends email through Brevo, and records deliveries.
- Announcement emails use each recipient's `profiles.preferred_language`. Bulgarian recipients receive Bulgarian content when both Bulgarian title/body exist; otherwise email falls back to English, then Bulgarian if English is missing.

Resolving recipients at send time is intentional. If a student is added to a course before a scheduled announcement sends, they should receive it. If they opt out of announcement emails before it sends, they should not.

## To-do Reminder Flow

- Non-priority todos do not create email reminder jobs.
- Priority todos create two `todo_reminder_email` jobs: one for the day before the due date and one for the due date.
- Todo reminder jobs use `notification_jobs.payload.todoId` instead of `announcement_id`.
- The `process-notification-jobs` Edge Function reads the todo at send time. If it has been completed or is no longer priority, the job completes without sending.
- Admin-created todos may have reminder jobs owned by the admin, but completion still suppresses the send because the edge function checks the live todo state.

## Maintenance Culture

There should be only one active notification processor cron:

- `process-notification-jobs-v2`
- schedule: every 5 minutes
- target: `/functions/v1/process-notification-jobs`

The earlier duplicate cron jobs caused `cron.job_run_details` to grow heavily. Keep the cleanup cron active:

- `prune-cron-job-run-details-weekly-retention`
- schedule: daily
- retention: delete `cron.job_run_details` rows older than 7 days

If old cron logs are deleted manually, run `vacuum full analyze cron.job_run_details;` once to release the database space.

After applying notification-related migrations, run:

```bash
npm run db:schema:sync
```

Do not hand-edit generated files in `database-schema/tables/`.
