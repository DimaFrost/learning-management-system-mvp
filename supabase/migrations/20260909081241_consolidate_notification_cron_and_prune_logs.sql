-- Consolidate notification processing to one pg_cron job and keep cron logs lean.
-- The v2 command includes both apikey and Authorization headers, so we keep that
-- shape and run it every five minutes.

select cron.unschedule('process-notification-jobs-every-five-minutes')
where exists (
  select 1
  from cron.job
  where jobname = 'process-notification-jobs-every-five-minutes'
);

select cron.unschedule('process-notification-jobs-v2')
where exists (
  select 1
  from cron.job
  where jobname = 'process-notification-jobs-v2'
);

select cron.unschedule('prune-cron-job-run-details-weekly-retention')
where exists (
  select 1
  from cron.job
  where jobname = 'prune-cron-job-run-details-weekly-retention'
);

select cron.schedule(
  'process-notification-jobs-v2',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url_v2')
      || '/functions/v1/process-notification-jobs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key'),
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key'),
      'x-notification-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'process_notification_secret')
    ),
    body := jsonb_build_object('limit', 10),
    timeout_milliseconds := 10000
  );
  $$
);

select cron.schedule(
  'prune-cron-job-run-details-weekly-retention',
  '17 3 * * *',
  $$
  delete from cron.job_run_details
  where start_time < now() - interval '7 days';
  $$
);

delete from cron.job_run_details
where start_time < now() - interval '7 days';
