# AGENTS.md

Agent guide for the TBO Learning Management System MVP. Prefer this file and the code over `README.md` for architecture — the README still describes an older prototype (manual `currentUser`, monolithic `.tsx` files).

## Project

Role-based LMS for courses/curriculum, classwork, attendance (including duty/ministry), mentorship, stream announcements, books/reading, messages, and todos.

**Stack:** React 18, TypeScript (strict), Vite 4, Tailwind CSS, Reshaped, Lucide, Supabase JS (Auth, Postgres/RLS, Storage, Edge Functions).

## Commands

```bash
npm install
npm run dev        # http://localhost:3000
npm run build
npm run preview
npm run db:schema:sync   # refresh generated database-schema/ (needs .env.mcp.local)
npm run mcp:supabase     # optional live Supabase MCP
```

## Environment

- Frontend: copy `.env.example` → `.env.local`
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY` (anon/publishable only)
- Tooling / schema sync: copy `.env.mcp.example` → `.env.mcp.local`
  - `MCP_SUPABASE_URL`, `MCP_SUPABASE_SERVICE_ROLE_KEY`
- Never put a `service_role` key in any `VITE_*` variable (Vite exposes those to the browser).
- Never commit secrets (`.env.local`, `.env.mcp.local`, keys, dumps).

## Architecture

```
src/main.tsx
  → LearningManagementSystem.tsx   # useAuth → AuthScreen or AuthenticatedApp
  → AuthenticatedApp.tsx           # shell, domain hooks, workspace, modals
  → AppRouter.tsx                  # view switch by activeView + workspace/roles
```

- **No react-router.** Navigation is a string `activeView` (plus class-detail state) from `src/hooks/useNavigation.ts`.
- View IDs are defined in `src/components/layout/Sidebar.tsx` and handled in `src/views/AppRouter.tsx` (kebab-case, e.g. `curriculum-date-view`, `my-classwork`).
- Multi-role users switch **workspaces** (`src/types/workspace.ts`): `administrator` | `mentor` | `team_leader` | `teacher` | `translator` | `student`.
- Domain types live in `src/types/lms.ts`. Roles are snake_case strings matching DB (`administrator`, `team_leader`, …) including meta-role `dev`.
- Data access: hooks under `src/hooks/` call `src/lib/supabase.ts`. Map DB **snake_case** → app **camelCase** in the hook layer.
- Views by persona: `src/views/{admin,student,teacher,mentor,teamLeader,shared}/`.
- Auth: Google OAuth via Supabase (`src/hooks/useAuth.ts`). Users with no real roles see onboarding.
- `dev` role + `src/components/dev/DevRolePanel.tsx`: UI/workspace preview only — DB actions still run as the signed-in user.

## Conventions

- Follow existing patterns: one domain hook per area, relative imports (no path aliases), `EditingItem`-style unions for edit modals, `useConfirmation` for destructive actions.
- UI: Tailwind utilities + `tbo-*` tokens in `src/index.css`, Reshaped where already used. Do not introduce a new design system or card-heavy layouts that fight existing screens.
- i18n: EN/BG via `src/i18n/LanguageContext.tsx`. When adding user-facing copy, update both languages.
- Keep diffs focused. Do not refactor the `AuthenticatedApp` prop bag, invent react-router, or add a global state library unless the task explicitly requires it.
- Prefer extending the matching domain hook/view over scattering Supabase calls in random components.

## Supabase and schema

- **Source of truth:** the live Supabase project. This repo has **incremental** SQL only under `supabase/migrations/` (no full baseline dump). Helpers such as `is_admin()` may exist remotely but not in-repo.
- **New migration:** `supabase/migrations/YYYYMMDDHHMMSS_short_snake_description.sql`. Prefer idempotent DDL (`create table if not exists`, `drop policy if exists` … `create policy`, `add column if not exists`).
- **RLS:** enable on new public tables; `grant` to `authenticated` as needed; check `profiles.roles` with `@>` (contains) or `&&` (overlap); scope with `auth.uid()` / `course_students`. Reuse helpers like `can_current_user_write_stream()` for stream writes.
- **After schema or Data API exposure changes:** run `npm run db:schema:sync` in the same change set. Culture and limits: `database-schema/README.md`.
- **Do not hand-edit generated files:** `database-schema/overview.md`, `relationships.md`, `openapi.json`, `database-schema/tables/*`. Put human notes in `database-schema/README.md` or other hand-written docs (e.g. `notification-system.md`).
- The OpenAPI snapshot omits non-exposed tables, RLS, triggers, and indexes — read migrations (or MCP) when those matter. Tables not exposed to the REST API will not appear in the snapshot.
- **Storage:** bucket `tbo-lms` via `src/utils/storageOperations.ts`. Class materials may store a storage path in columns still named like `drive_file_id` — preserve that semantics.
- **Google:** folder provisioning → edge `drive-operations` (`src/utils/driveOperations.ts`); Docs/Drive OAuth uploads → `google-docs-v2` (`src/utils/googleDocsV2.ts`). See each function’s `SETUP.md`.
- **Notifications:** prefer job queue `notification_jobs` / `notification_deliveries` + `process-notification-jobs` (Brevo). Client enqueue/cancel lives mainly in `useAnnouncements` / `useTodos`. Behavior notes: `database-schema/notification-system.md`. Treat `send-notification` (`src/utils/notifications.ts`, Resend) as legacy — do not use it for new announcement flows unless intentionally maintaining that path.
- Edge function setup/secrets: `supabase/functions/*/SETUP.md` (not in git).

## Domain map

| Area | Start here |
|------|------------|
| Courses / curriculum / classes | `useCourses`, `src/views/admin/Curriculum*.tsx`, `ClassDetailView` |
| Classwork / homework | `useHomework`, `src/views/shared/ClassworkView.tsx`, `src/views/shared/classwork/` |
| Attendance / duty / prayer / The Well | `useAttendance`, `src/views/admin/AttendanceView.tsx`, student `MyAttendance*` |
| Ministry | attendance ministry tabs, `teamLeader/MinistryReportView.tsx`, `MyMinistryInfoView.tsx` |
| Mentorship | `useMentorshipLogs`, `MentorshipHubView`, `MentorDashboard`, `LogCheckinModal` |
| Stream / announcements | `useAnnouncements`, `useStreamSettings`, `AnnouncementsView` |
| Books / reading | `useBooks`, `BooksView`, `MyBooksView`, edge `book-lookup` |
| Messages / todos | `useMessages`, `useTodos`, `MessagesView`, `TodosView` |
| Users / profiles | `useUsers`, `src/views/admin/users/` |
| Schema reference | `database-schema/overview.md`, `relationships.md` |

## Safety / don’ts

- Do not commit secrets or put service-role keys in frontend env.
- Do not hand-edit generated `database-schema/` snapshots.
- Do not treat DevRolePanel / preview roles as real authorization.
- Do not follow README instructions that say to edit `currentUser` in component state for role testing.
- Do not assume every table used in code appears in `database-schema/` — verify API exposure and migrations.
- Prefer small, task-scoped changes; sync the schema snapshot when migrations change the exposed API.
