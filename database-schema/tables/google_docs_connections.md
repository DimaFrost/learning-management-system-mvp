# google_docs_connections

Stores the single school Google OAuth connection used by `google-docs-v2`.

This table contains sensitive OAuth tokens. Normal clients only get admin-scoped `select`
access through RLS. Token writes and refreshes are handled by the Edge Function with the
Supabase service role.

| Column | Type | Notes |
| --- | --- | --- |
| id | text | Primary key, fixed to `school_docs` |
| provider | text | Defaults to `google` |
| connected_email | text | Google account that authorized document creation |
| access_token | text | Short-lived Google access token |
| refresh_token | text | Long-lived Google refresh token |
| expires_at | timestamptz | Access token expiry |
| scopes | text[] | Requested Google scopes |
| connected_by | uuid | Admin profile that saved the connection |
| connected_at | timestamptz | Initial connection time |
| updated_at | timestamptz | Last token/connection update |
