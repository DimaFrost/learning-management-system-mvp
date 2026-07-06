# Database Schema Folder

This folder gives future maintainers and AI assistants a local map of the Supabase database shape.

Supabase is still the source of truth. The files here are a checked-in snapshot so routine code work can understand tables, columns, and exposed API structure without connecting to MCP every time.

## How To Refresh

Run this after any database structure change:

```bash
npm run db:schema:sync
```

The command reads `.env.local` and `.env.mcp.local`, then fetches the Supabase REST OpenAPI schema with the service-role key. It writes schema-only files and does not dump row data.

## Folder Culture

- Keep generated files generated. Do not hand-edit `overview.md`, `openapi.json`, or files in `tables/`.
- Put human guidance in this `README.md` or another clearly hand-written Markdown file.
- Refresh the snapshot in the same change as migrations, manual Supabase dashboard edits, table/column changes, or RPC/view changes exposed through the Data API.
- If a schema refresh removes a table unexpectedly, check Supabase Data API exposure before assuming the table was deleted.
- Never place service-role keys, anon keys, connection strings, or row exports in this folder.

## What Lives Here

- `overview.md`: generated index of exposed tables/views.
- `relationships.md`: generated primary-key and foreign-key reference.
- `tables/*.md`: generated per-table column reference.
- `openapi.json`: generated raw Supabase REST OpenAPI schema for deeper inspection.

## Limits

This snapshot reflects what the Supabase REST/Data API exposes. It may not include private schemas, non-exposed tables, all RLS policies, triggers, indexes, or auth/storage internals. Use the custom `tbo_supabase` MCP server when live verification is needed.
