# Google Docs v2 setup

`google-docs-v2` is the OAuth-based Google Docs integration for homework submissions.
It intentionally does not use the older `drive-operations` service-account flow.

## Required Supabase secrets

Set these in Supabase Dashboard -> Project Settings -> Edge Functions -> Secrets:

```text
GOOGLE_DOCS_OAUTH_CLIENT_ID
GOOGLE_DOCS_OAUTH_CLIENT_SECRET
GOOGLE_FIRST_YEAR_FOLDER_ID
GOOGLE_SECOND_YEAR_FOLDER_ID
GOOGLE_DOC_TEMPLATE_ID
GOOGLE_DOCS_REDIRECT_URI
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are also required by the function runtime.
`GOOGLE_DOCS_REDIRECT_URI` is optional; if omitted, the function uses
`SUPABASE_URL/functions/v1/google-docs-v2`.

The function still accepts the older `GOOGLE_OAUTH_CLIENT_ID` and
`GOOGLE_OAUTH_CLIENT_SECRET` names as a fallback, but the `GOOGLE_DOCS_*`
names make it clear that this OAuth client is separate from the Supabase Auth
Google provider used for normal login.

## Google setup

The Google OAuth client should request:

```text
https://www.googleapis.com/auth/drive
https://www.googleapis.com/auth/documents
```

The template Doc must be accessible to the connected school Google account.
The First Year and Second Year folders should live in the school Shared Drive.

## App setup

An administrator connects the school Google account from:

```text
Settings -> Google Docs
```

Use `Connect Google` or `Reconnect Google`. The Google callback returns to this
edge function, saves the connection, and then redirects back to Settings. There
is no Supabase Auth provider token step.

Add this redirect URI to the Docs OAuth client in Google Cloud:

```text
https://<project-ref>.supabase.co/functions/v1/google-docs-v2
```

For this project:

```text
https://meeqknljjrsgsbukdwcm.supabase.co/functions/v1/google-docs-v2
```
