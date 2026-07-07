# process-notification-jobs

This Edge Function processes due notification jobs and sends announcement emails through Brevo.

## Required Secrets

Set these on the Supabase project:

```bash
supabase secrets set BREVO_API_KEY="xkeysib-..."
supabase secrets set BREVO_FROM_EMAIL="sender@example.com"
supabase secrets set BREVO_FROM_NAME="The Burning Ones"
supabase secrets set APP_URL="https://your-app-url.example"
```

The app serves the default email logo from `public/tbo-logo.png`, so a production `APP_URL` can load it at `APP_URL/tbo-logo.png`. In local development, the template falls back to a built-in HTML brand seal so it will not show a broken image.

If you want the real logo image in email, use a public PNG or JPG URL. Avoid SVG and localhost URLs because Gmail and other email clients often proxy or reject them.

```bash
supabase secrets set LOGO_URL="https://your-app-url.example/tbo-logo.png"
```

Optional, but recommended when invoking from Cron:

```bash
supabase secrets set PROCESS_NOTIFICATION_SECRET="a-long-random-secret"
```

If `PROCESS_NOTIFICATION_SECRET` is set, Cron must send it as the `x-notification-secret` header.

## Deploy

```bash
supabase functions deploy process-notification-jobs
```

## Cron

Enable `pg_cron` and `pg_net` in Supabase, then create a job that calls the function every minute.

Supabase recommends storing URL and auth values in Vault. Example:

```sql
select vault.create_secret('https://PROJECT_REF.supabase.co', 'project_url');
select vault.create_secret('YOUR_PUBLISHABLE_KEY', 'publishable_key');
select vault.create_secret('YOUR_PROCESS_NOTIFICATION_SECRET', 'process_notification_secret');

select cron.schedule(
  'process-notification-jobs-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
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
```

## Local Test Payload

```json
{
  "limit": 1
}
```
