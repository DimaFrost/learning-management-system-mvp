# Notification System Notes

The LMS notification system is job-based.

## Core Tables

- `announcements.status`: `draft`, `scheduled`, `published`, or `archived`.
- `announcements.scheduled_at`: when a scheduled announcement should become active.
- `announcements.published_at`: when the announcement was published.
- `notification_jobs`: queued work for email and future notification channels.
- `notification_deliveries`: per-recipient delivery audit rows.

## Announcement Flow

- Draft announcements do not create/send notification jobs.
- Published announcements create an `announcement_email` job due immediately.
- Scheduled announcements create an `announcement_email` job due at `scheduled_at`.
- The `process-notification-jobs` Edge Function claims due jobs, resolves recipients at send time, sends email through Brevo, and records deliveries.

Resolving recipients at send time is intentional. If a student is added to a course before a scheduled announcement sends, they should receive it. If they opt out of announcement emails before it sends, they should not.

## Maintenance Culture

After applying notification-related migrations, run:

```bash
npm run db:schema:sync
```

Do not hand-edit generated files in `database-schema/tables/`.

