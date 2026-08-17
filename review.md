# Code Review — TBO Learning Management System

**Reviewed:** 2026-08-02
**Branch:** `ventsi-adjustments` @ `1010dd0`
**Scope:** full repository — frontend (`src/`), Supabase migrations and edge functions, build/tooling, docs.
**Note:** no code was changed as part of this review. Every finding below is a recommendation.

---

## 1. Snapshot

| Metric | Value |
|---|---|
| TypeScript/TSX source files | 193 |
| Lines of app source | ~67,600 |
| Supabase migrations in repo | 37 (incremental only, no baseline) |
| Edge functions | 5 (~3,600 lines) |
| Production bundle | 2,209 kB raw / 509 kB gzip, single chunk |
| `tsc --noEmit` errors | **69** across 20 files |
| Automated tests | **0** |
| Lint / formatter / CI config | **none** |

**Overall.** This is a substantial, genuinely feature-rich application, and several things are done well: the i18n layer is disciplined (3,660 EN/BG key pairs with only 34 legitimately-identical values, and a `defineTranslations` helper that structurally forces BG parity), RLS is enabled on every table created in-repo, `AGENTS.md` is an unusually good contributor guide, and there is no `dangerouslySetInnerHTML`, no `@ts-ignore`, and no `console.log` debris.

The problems are concentrated in four places: **one exploitable mass-email hole**, **a systematic timezone bug in date handling**, **a type checker that has stopped working**, and **unbounded data loading that will silently truncate as the school grows**. Sections 2–4 cover those; 5–9 cover quality, docs, and hygiene.

---

## 2. Security

### 2.1 🔴 CRITICAL — Any signed-in user can send arbitrary email to every user

**Files:** [notificationJobs.ts:19](src/utils/notificationJobs.ts:19), [20260707120000_scheduled_announcement_notifications.sql:65](supabase/migrations/20260707120000_scheduled_announcement_notifications.sql:65), [process-notification-jobs/index.ts:256](supabase/functions/process-notification-jobs/index.ts:256)

The insert policy on `notification_jobs` is:

```sql
create policy "Notification jobs can be created by owner"
  on public.notification_jobs for insert to authenticated
  with check (created_by = (select auth.uid()));
```

It constrains *who owns* the row, but nothing about `type`, `payload.recipientIds`, `subject`, or `body`. The worker then trusts the payload completely:

```ts
async function sendWorkflowEmails(jobId: number, payload: WorkflowEmailPayload) {
  const recipientIds = Array.isArray(payload.recipientIds) ? payload.recipientIds.filter(Boolean) : [];
  ...
  .from('profiles').select(...).in('id', Array.from(new Set(recipientIds)));
```

**Attack:** a student opens devtools, calls `supabase.from('notification_jobs').insert({ type: 'workflow_email', status: 'pending', scheduled_for: <now>, created_by: <their own uid>, payload: { recipientIds: [<every user id>], subject: '...', title: '...', body: '...' } })`. Within one worker tick, Brevo delivers that message from the school's authenticated sending domain to the whole school. User IDs are trivially obtainable — `useUsers` loads the full `profiles` table into every client (see 2.4).

This is a phishing and reputation-damage vector, not just spam: recipients see a legitimately-signed school email.

**Remediation (do this first):**
1. Add a `with check` clause restricting `type = 'workflow_email'` inserts to privileged roles, e.g.
   `(type <> 'workflow_email' or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.roles && array['administrator','team_leader']::text[]))`.
2. Defence in depth in `sendWorkflowEmails`: re-read `job.created_by`, look up that profile's roles, and refuse the job if the creator is not authorised. Do not trust the payload's recipient list to be one the creator may address.
3. Add a rate limit (jobs per creator per hour) and a hard cap on `recipientIds.length` for non-admin creators.

### 2.2 🔴 HIGH — `send-notification` edge function has no authentication and injects unescaped HTML

**File:** [send-notification/index.ts](supabase/functions/send-notification/index.ts)

The handler never inspects the `Authorization` header. It creates a **service-role** client, and for `type: 'announcement'` it fetches *every* profile with announcement emails enabled and mails them content taken verbatim from the request body:

```ts
<h2 style="color: #111827;">${data.title}</h2>
<p style="color: #374151; line-height: 1.6;">${data.content}</p>
```

Two problems compound:
- **No authorisation.** Whether this is reachable unauthenticated depends entirely on the deployed `verify_jwt` setting, which is not tracked in this repo. If `verify_jwt` is off, it is an open relay. If it is on, any student can still trigger a school-wide mailshot.
- **HTML injection.** `data.title` and `data.content` are interpolated raw into the email body — an attacker controls the rendered markup, including links styled to look like the app's own CTA button.

`AGENTS.md` calls this function "legacy", but it is still wired into five live hooks: [useClassContent.ts:199](src/hooks/useClassContent.ts:199), [useEnrollments.ts:76](src/hooks/useEnrollments.ts:76), [useHomework.ts:223](src/hooks/useHomework.ts:223), [useMessages.ts:165](src/hooks/useMessages.ts:165), [useUsers.ts:148](src/hooks/useUsers.ts:148). "Legacy" in a doc does not reduce the attack surface.

**Remediation:** authenticate the caller and check roles the way `google-docs-v2` already does (see 2.6 — it is the correct model). HTML-escape all interpolated values. Then finish the migration: move those five call sites onto the `notification_jobs` queue and delete the function. Confirm `verify_jwt` is enabled on every deployed function and record that setting in the repo.

### 2.3 🟠 MEDIUM — `drive-operations` performs privileged Google Drive writes with no caller check

**File:** [drive-operations/index.ts:129](supabase/functions/drive-operations/index.ts:129)

The handler takes `{ action, data }`, mints a Google **service-account** token scoped to full `https://www.googleapis.com/auth/drive`, and creates folders — with no verification of who is asking or whether they may touch that course/subject/class. Any caller who reaches the function can create arbitrary folder trees anywhere under `DRIVE_ROOT_FOLDER_ID`.

Secondary issue at [drive-operations/index.ts:105](supabase/functions/drive-operations/index.ts:105): the Drive query is built by string concatenation.

```ts
`name = '${name}' and '${parentId}' in parents and ...`
```

A folder name containing an apostrophe breaks the query; a crafted name can alter its meaning. Escape `'` and `\` before interpolating, or use parameter-safe construction.

**Remediation:** adopt the `getCurrentProfile(authHeader)` pattern from `google-docs-v2`, verify the caller is an administrator (or the teacher owning the subject), and narrow the OAuth scope to `drive.file` if the function only manages folders it created.

### 2.4 🟠 MEDIUM — Every signed-in user downloads the full user directory, including emails and phone numbers

**File:** [useUsers.ts:62](src/hooks/useUsers.ts:62)

```ts
const { data, error: fetchError } = await supabase
  .from('profiles')
  .select('*')
  .order('name');
```

`useUsers()` runs unconditionally at app boot for every role, and `select('*')` pulls all 14 columns of `profiles` — including `email` and `phone` — for every student, staff member, and mentor in the system. A student who never opens the directory still holds the whole school's contact list in browser memory.

For a school handling minors, this is a data-minimisation problem regardless of what the UI chooses to render.

**Remediation:**
1. Select only the columns the client actually renders; drop `phone` (and `email`, where it isn't shown) from the default projection and fetch them on demand in admin views.
2. Add a `profiles` RLS policy, or a restricted view, that exposes contact fields only to administrators and to the row owner. Note the base `profiles` policies are **not in this repo** — they exist only in the live project, so this needs verifying against Supabase directly.

### 2.5 🟠 MEDIUM — All uploaded files are served from public URLs

**File:** [storageOperations.ts:16](src/utils/storageOperations.ts:16), [useSettings.ts:97](src/hooks/useSettings.ts:97)

Every upload path ends in `getPublicUrl(...)`; `createSignedUrl` appears nowhere in the codebase. If the `tbo-lms` bucket is public — which `getPublicUrl` only produces working links for — then homework submissions, class materials, **staff notes**, and **translator notes** are readable by anyone who has or guesses the URL, with no authentication at all.

The paths are also guessable by design: [`buildStoragePath`](src/utils/storageOperations.ts:33) composes `courseSlug/subjectSlug/classSlug/fileType/student-name/filename` from human-readable slugs.

Two further gaps in the same file: `fileName` and the slugs are interpolated without sanitisation (only `studentName` gets a partial cleanup — lowercase and space-collapse, which does not strip `/` or `..`), and no call site enforces a file-size or MIME limit. The `accept` attributes on the file inputs are UI hints, not validation.

**Remediation:** make the bucket private, switch reads to `createSignedUrl` with a short TTL, and enforce storage RLS by path prefix. Sanitise every path segment against `[^a-zA-Z0-9._-]`. Add explicit size/type validation before upload.

### 2.6 ✅ Good — `google-docs-v2` is the pattern the others should follow

[google-docs-v2/index.ts:171](supabase/functions/google-docs-v2/index.ts:171) does it properly: extracts the bearer token, calls `auth.getUser(token)`, loads the profile server-side, and gates each action on real role membership plus resource ownership (`subjectTeachers.includes(profile.id)`). Use this as the template when fixing 2.2 and 2.3.

### 2.7 🟡 LOW — Worker authentication fails open

**File:** [process-notification-jobs/index.ts:143](supabase/functions/process-notification-jobs/index.ts:143)

```ts
if (PROCESS_SECRET && req.headers.get('x-notification-secret') !== PROCESS_SECRET) {
  return json({ error: 'Unauthorized' }, 401);
}
```

If `PROCESS_SECRET` is unset or typo'd in the environment, the guard silently disappears and anyone can drive the queue. Invert it: refuse to start if the secret is missing.

### 2.8 🟡 LOW — Broad `using (true)` read policies on attendance data

Nine policies grant unrestricted `select` to all authenticated users, including `ministry_service_attendance` ([20260709120000:132](supabase/migrations/20260709120000_attendance_gates_and_ministry.sql:132)), `prayer_schedule`, `well_schedule`, and `ministry_team_members`. Any student can read every other student's ministry attendance record. That may well be intentional for a small community, but it should be a deliberate decision rather than a default — consider scoping at least the per-person attendance tables to the subject and to staff.

### 2.9 🟡 LOW — Policy pattern is repetitive and unindexed

Roughly forty policies inline the same subquery:

```sql
exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.roles @> array['administrator'::text])
```

Two costs: Postgres re-evaluates `auth.uid()` per row where it isn't wrapped in a scalar subquery (the notification policies get this right with `(select auth.uid())`; the tuition ones do not), and a role-name change means editing forty policies. `AGENTS.md` notes an `is_admin()` helper may already exist remotely — standardise on a `stable security definer` helper and migrate the policies to it.

### 2.10 Dependency audit

`npm audit --omit=dev` reports **7 vulnerabilities (6 high, 1 moderate)** — `brace-expansion`, `glob`, `minimatch`, `picomatch`, `postcss`, `svgo`, `yaml`. All are transitive build-toolchain packages (Tailwind/PostCSS/SVGO), not code shipped to the browser, so real-world exposure is low. `npm audit fix` resolves all of them and should be run.

Separately, **Vite 4.5.14 is well past end-of-life** (Vite 7 is current) and no longer receives security patches. Plan an upgrade.

---

## 3. Correctness bugs

### 3.1 🔴 HIGH — Timezone bug shifts every "week" and "today" by one day

**Files:** [attendanceUtils.ts:55](src/utils/attendanceUtils.ts:55), [courseUtils.ts:3](src/utils/courseUtils.ts:3), and 22 further sites

The shared helper builds a date in **local** time and then serialises it in **UTC**:

```ts
export function getWeekStart(date: Date): Date {
  ...
  d.setHours(0, 0, 0, 0);   // local midnight Monday
  return d;
}
export function dateToString(date: Date): string {
  return date.toISOString().split('T')[0];   // ← re-interpreted as UTC
}
```

Reproduced on this machine (Europe/Sofia, UTC+3):

```
local weekstart: Mon Jul 27 2026 00:00:00 GMT+0300
dateToString  -> 2026-07-26     ← Sunday, not Monday
```

`getCurrentWeekStart()` returns a **Sunday**. Local midnight Monday is 21:00 UTC Sunday, so the date component rolls back. Every timezone east of UTC is affected — which is every user of this app.

The same class of bug affects `getTodayDateString()` and 23 other `toISOString().split('T')[0]` / `.slice(0,10)` sites: between 00:00 and 03:00 local, "today" resolves to yesterday. That drives overdue flags, duty-week membership ([AuthenticatedApp.tsx:126](src/AuthenticatedApp.tsx:126)), enrollment dates, and attendance marking.

Because the same broken helper is used on both the write and read paths, much of this is *internally* consistent and therefore invisible in normal use — which is exactly what makes it dangerous. It breaks the moment anything constructs a date the correct way (see 3.2), or when DST shifts the offset.

**Remediation:** add one local-date formatter and route everything through it. `AdminStudentDashboard`'s `toDateKey` ([AdminStudentDashboard.tsx:182](src/views/admin/AdminStudentDashboard.tsx:182)) is already the correct implementation — promote it to `src/utils/dateUtils.ts`, replace all 24 `toISOString()` date-key sites with it, and then **audit stored data**: week-start keys already written to `duty_schedule`, `prayer_schedule`, and `well_schedule` are Sundays and will need a migration to shift forward one day, or the fix will silently orphan existing rotations.

### 3.2 🔴 HIGH — Three incompatible `getWeekStart` implementations produce disagreeing views

| Location | Date math | Serialisation | Result |
|---|---|---|---|
| [attendanceUtils.ts:39](src/utils/attendanceUtils.ts:39) | local | `toISOString()` | ❌ Sunday |
| [AdminStudentDashboard.tsx:189](src/views/admin/AdminStudentDashboard.tsx:189) | local | local `toDateKey` | ✅ Monday |
| [MyAttendanceBreakdownView.tsx:97](src/views/student/MyAttendanceBreakdownView.tsx:97) | local | `toISOString()` | ❌ Sunday |

A student viewing their own attendance breakdown sees weeks grouped from Sunday; an administrator viewing *the same student* on the admin dashboard sees them grouped from Monday. The two screens will show different totals for the same period, and there is no way for either party to tell which is right.

### 3.3 🟠 MEDIUM — `addDays` loses a day on every call

**File:** [MyAttendanceBreakdownView.tsx:104](src/views/student/MyAttendanceBreakdownView.tsx:104)

Same local-then-UTC mistake, but here it produces a directly visible wrong answer. Verified:

```
addDays('2026-01-01', 1) = 2026-01-01   (expected 2026-01-02)
addDays('2026-01-01', 6) = 2026-01-06   (expected 2026-01-07)
```

Used at lines 234, 251, and 266 to compute `weekEnd` and the week-picker labels — so every displayed week range is six days long instead of seven and ends on the wrong date.

### 3.4 🟠 MEDIUM — Unbounded queries will silently truncate at PostgREST's row cap

**File:** [useAttendance.ts:234](src/hooks/useAttendance.ts:234)

Sixteen full-table reads fire in one `Promise.all` on app start, with no filter, no pagination, and no date window:

```ts
supabase.from('class_attendance').select(`...`),
supabase.from('the_well_attendance').select('*'),
supabase.from('sunday_attendance').select('*'),
supabase.from('ministry_service_attendance').select(`...`),
```

Across the whole codebase there are **65 Supabase query sites, zero `.limit()` calls and one `.range()`**.

Supabase enforces a server-side `db.max_rows` cap (1000 by default). Once `class_attendance` passes it — roughly 100 students × 2 sessions/week × 5 weeks — PostgREST returns the first N rows **without an error**. Attendance percentages, gate calculations, and duty rotations will simply start being quietly wrong, and nothing in the client will indicate truncation.

**Remediation, in priority order:**
1. Add a school-year / date-range filter to every attendance query — the app almost never needs history beyond the active year.
2. Load attendance lazily, when an attendance view mounts, rather than at app boot for all roles.
3. Wherever a genuinely unbounded read is needed, paginate with `.range()` and loop until exhausted.
4. As a safety net, assert `data.length < expectedCap` and surface a visible error instead of failing silently.

### 3.5 🟠 MEDIUM — No error boundary

`grep` for `ErrorBoundary|componentDidCatch` returns nothing. A single render-time exception anywhere — and there are 3,000-line views doing heavy data massaging — unmounts the entire React tree and leaves the user staring at a white page with no recovery path and no error report.

**Remediation:** wrap `<AppRouter>` in an error boundary that renders `ErrorMessage` plus a reload action, and consider a second one around the whole shell in [main.tsx](src/main.tsx:8).

### 3.6 🟡 LOW — 486 of 583 `<button>` elements omit `type`

HTML defaults `<button>` to `type="submit"`. Nine files contain `<form>` elements — including [EditModal.tsx](src/components/modals/EditModal/EditModal.tsx), [GradeModal.tsx](src/components/modals/GradeModal.tsx), [LogCheckinModal.tsx](src/components/modals/LogCheckinModal.tsx), [TodosView.tsx](src/views/shared/TodosView.tsx), and [TuitionView.tsx](src/views/admin/TuitionView.tsx) — so any untyped button inside those forms submits it when clicked. Audit the buttons in those nine files first; adding `type="button"` everywhere else is a cheap safeguard against the next form that gets added.

---

## 4. Type safety — the compiler has stopped working

`npx tsc --noEmit` reports **69 errors in 20 files**. This is the finding with the widest blast radius, because it disables the safety net every other finding would otherwise be caught by.

Distribution:

| File | Errors |
|---|---|
| `src/views/shared/GradesView.tsx` | 14 |
| `src/views/shared/ClassworkView.tsx` | 9 |
| `src/views/shared/AbsenceNoticesView.tsx` | 6 |
| `src/utils/userManagementUtils.ts` | 6 |
| `src/views/admin/AdminStudentDashboard.tsx` | 5 |
| `src/views/admin/AdminDashboard.tsx` | 5 |
| 14 more files | 24 |

By error code: `TS2339` property-does-not-exist ×15, `TS2322` bad assignment ×15, `TS2367` **comparison between non-overlapping types** ×11, `TS2345` bad argument ×10, `TS2352` unsafe cast ×7, `TS18047` possibly-null ×4, `TS2304` undefined name ×3.

**Why this matters more than the count suggests.** `npm run build` is `vite build`, which uses esbuild — it strips types without checking them. There is no `typecheck` script, no lint, no pre-commit hook, and no CI. So the build passes green while 69 real type violations sit in the tree, and every new error added from here on is equally invisible. This directly undermines a documented invariant: `defineTranslations` promises that a missing Bulgarian key "fails the build instead of silently falling back" ([defineTranslations.ts:10](src/i18n/defineTranslations.ts:10)) — it cannot, because nothing typechecks the build.

**Notable individual errors:**

- **`TS2367` × 11 — dead conditional branches.** The compiler is reporting comparisons that can never be true, i.e. code that never runs. [GradesView.tsx:479](src/views/shared/GradesView.tsx:479) and `:868` compare a `'passing' | 'at_risk' | 'failing'` value against the strings `'pass'` and `'risk'`; [GradesView.tsx:988](src/views/shared/GradesView.tsx:988), `:991`, `:1022` compare a `'teacher' | 'admin'` value against `'student'`. These look like renames that were applied to the type but not to every consumer — the student-specific branches of `GradesView` are unreachable. **These are probably live bugs, not just type noise, and are the ones to look at first.**
- **`TS2304` × 3 — missing imports.** `Subject` and `Class` at [studentCalendar.ts:151](src/utils/studentCalendar.ts:151), `TranslationKey` at [PlanningCalendarGrid.tsx:1795](src/views/admin/planning/PlanningCalendarGrid.tsx:1795). Harmless at runtime (types erase) but they void the annotations they appear in.
- **`TS2741` × 2 — missing required prop.** `gradebookConfig` is not passed to `SubjectDetailPage` from [CurriculumDateView.tsx:382](src/views/admin/CurriculumDateView.tsx:382) or [CurriculumOverview.tsx:315](src/views/admin/CurriculumOverview.tsx:315). At runtime that prop arrives as `undefined`; whether it crashes depends on how the child dereferences it. Worth checking by hand.
- **`TS2352`/`TS2345` cluster — Supabase embedded-relation shape.** Repeated across `GradesView`, `ClassworkView`, `SubmissionsView`, `MyAssignmentsView`: PostgREST types embedded relations as arrays (`author: { id, name }[]`) while the hand-written row types declare objects (`author: { id, name }`). The code then force-casts. Whenever the runtime shape really is an array, `row.author.name` is `undefined` — [ClassworkView.tsx:486](src/views/shared/ClassworkView.tsx:486) reports exactly this. Fix the row types to match PostgREST's actual output rather than casting past it.
- **`TS2677`/`TS18047` — invalid type predicate.** [userManagementUtils.ts:267](src/utils/userManagementUtils.ts:267) declares `(row): row is EnrollmentRow => row !== null` against a parameter type the predicate doesn't fit, so the `.filter()` fails to narrow and the following `.sort()` at line 268 dereferences values TypeScript believes may be null. The runtime filter does exclude nulls, so this is currently latent — but the compiler can no longer prove it.

**Remediation:**
1. Add `"typecheck": "tsc --noEmit"` to `package.json`, and make `build` run it: `"build": "tsc --noEmit && vite build"`.
2. Fix the 11 `TS2367` errors first — those are the likely live bugs.
3. Then the 3 `TS2304` and 2 `TS2741` (one-line fixes each).
4. Then correct the Supabase row types instead of casting.
5. Add ESLint with `@typescript-eslint` and `eslint-plugin-react-hooks` — the hooks rules will catch dependency-array bugs no one is currently checking.
6. Add a minimal GitHub Actions workflow running `npm ci && npm run typecheck && npm run build` on every PR, so the count can never climb back.

---

## 5. Architecture

### 5.1 The prop bag has outgrown itself

`AppRouterProps` declares **128 props**, threaded from `AuthenticatedApp` which composes 15 domain hooks. `AGENTS.md` explicitly says not to refactor this, and that restraint is right for day-to-day feature work — but at 128 props it has become a genuine tax: every new feature touches three files, prop-drilling obscures which view actually consumes what, and React cannot memoise anything because a new object identity for at least one prop arrives on every render.

**Suggested increment (not a rewrite):** introduce narrow contexts for the most widely-shared slices — `CoursesContext`, `UsersContext`, `AttendanceContext` — and let leaf views consume them directly. That removes the majority of props without touching navigation, adding a router, or introducing a state library.

### 5.2 Everything loads for everyone, up front

`AuthenticatedApp` mounts all 15 domain hooks unconditionally, then blocks the entire UI on five of them:

```ts
const isLoading = coursesLoading || usersLoading || logsLoading || enrollmentsLoading || cadenceLoading;
```

A student who only wants today's homework waits on the full user directory, all enrollments, all mentorship logs, and all cadence settings — and separately triggers the 16 attendance queries from 3.4. First paint is gated on the slowest query in the set.

**Remediation:** gate hook instantiation on the active workspace and view. A student workspace has no reason to invoke `useMentorshipLogs` or `useCadenceSettings` at all.

### 5.3 Single 2.2 MB bundle

No code splitting: `dist/assets/index-*.js` is 2,209 kB raw / 509 kB gzip, and Vite emits the >500 kB warning. Both full translation dictionaries are eagerly bundled, as is every admin view for every user.

**Remediation:** `React.lazy` + `Suspense` at the `AppRouter` switch is the highest-leverage change — admin views alone are several thousand lines a student never renders. Dynamic-import the non-active language dictionary. Configure `manualChunks` to split the Supabase and Reshaped vendor code.

### 5.4 Supabase calls leaking out of the hook layer

`AGENTS.md` says: *"Prefer extending the matching domain hook/view over scattering Supabase calls in random components."* Seven view files now query directly: [GradesView.tsx:324](src/views/shared/GradesView.tsx:324), [ClassworkView.tsx:410](src/views/shared/ClassworkView.tsx:410), [AbsenceNoticesView.tsx](src/views/shared/AbsenceNoticesView.tsx), [HomeworkAssignmentDetailPage.tsx](src/views/shared/classwork/HomeworkAssignmentDetailPage.tsx), [CurriculumOverview.tsx](src/views/admin/CurriculumOverview.tsx), [CurriculumDateView.tsx](src/views/admin/CurriculumDateView.tsx), [MyAssignmentsView.tsx](src/views/student/MyAssignmentsView.tsx).

This is not cosmetic: those in-view queries are exactly where the `TS2352` cast errors cluster (4.0), because the shared row-mapping helpers in the hook layer were bypassed. Migrating them into hooks fixes both problems at once.

### 5.5 `window` CustomEvents used as a navigation channel

[AuthenticatedApp.tsx:276](src/AuthenticatedApp.tsx:276) dispatches `tbo:open-subject-search-result` and `tbo:open-homework-search-result` on `window`; [AppRouter.tsx:322](src/views/AppRouter.tsx:322) listens. This is a global untyped side channel that bypasses React entirely — no type checking on the detail payload, and silent failure if the listener isn't mounted when the event fires (a real risk, since it is dispatched from a search modal that can be open over any view). Replace with a state value passed down, or a small context.

### 5.6 God components

| File | Lines | State hooks |
|---|---|---|
| [AttendanceView.tsx](src/views/admin/AttendanceView.tsx) | 3,185 | **53 `useState`**, 8 `useEffect` |
| [AdminDashboard.tsx](src/views/admin/AdminDashboard.tsx) | 2,339 | 8 |
| [PlanningCalendarGrid.tsx](src/views/admin/planning/PlanningCalendarGrid.tsx) | 2,203 | 18 |
| [CreateAnnouncementModal.tsx](src/components/modals/CreateAnnouncementModal.tsx) | 1,721 | — |
| [useAttendance.ts](src/hooks/useAttendance.ts) | 1,487 | — |

Twenty-four files exceed 800 lines. `AttendanceView` at 53 `useState` calls in one component is effectively untestable and unreviewable; splitting it by tab (duty / prayer / The Well / ministry / corrections) into sibling components with their own state would be a large but mechanical win. There is also **zero `React.memo`** in the codebase, so these components re-render wholesale on any parent state change.

---

## 6. What's working well

Worth stating explicitly, because these are the parts to protect during refactoring:

- **i18n discipline.** 3,660 EN/BG key pairs; only 34 identical values, and nearly all of those are legitimately untranslatable ("Google Doc", "The Burning Ones", `https://...`). `defineTranslations` enforcing BG key parity through the type system is a genuinely good design — it just needs a working typechecker (4.0) to deliver on the promise.
- **RLS coverage.** Every table created in-repo has `enable row level security`. Migrations are idempotent (`create table if not exists`, `drop policy if exists` … `create policy`) and consistently named, exactly as `AGENTS.md` prescribes.
- **`google-docs-v2`** is a well-built edge function — proper token verification, server-side role lookup, per-resource ownership checks, structured `HttpError` handling.
- **Clean code hygiene.** Zero `console.log`, zero `@ts-ignore`, zero `dangerouslySetInnerHTML`, zero `key={index}`, only 22 `any` in 67k lines, no committed secrets (`git ls-files` shows only `.env.example` files), 184 `aria-` attributes.
- **`AGENTS.md`** is a better contributor guide than most projects have, and correctly flags that the README is stale.

---

## 7. Documentation

### 7.1 🟠 The README actively misleads

[README.md](README.md) describes a prototype that no longer exists:

- Lists a file structure of `learning_management_mvp_complete.tsx`, `learning_management_mvp.tsx`, `learning_management_mvp-2.tsx` — **none of which are in the repo.**
- Section "User Role Testing" instructs the reader to hardcode `const [currentUser, setCurrentUser] = useState({ id: 1, ..., roles: ['administrator'] })`. Roles come from Supabase `profiles` and are enforced by RLS; following this advice produces broken code and a false sense of what authorisation means.
- "Option 1: Direct HTML Test — Open `index.html` in your browser" cannot work; `index.html` is a Vite entry point that loads `/src/main.tsx`.
- "Next Steps for Production" lists Backend Integration, Authentication, and Data Persistence — all shipped long ago.

`AGENTS.md` warns agents away from the README, but a new human contributor reads it first.

**Remediation:** rewrite the README against current reality, or reduce it to a short quick-start that defers to `AGENTS.md`. The second option is cheap and honest.

### 7.2 🟡 Auto-generated translation report is garbage output

[missing-bulgarian-translations.md](missing-bulgarian-translations.md) and its `.csv` sibling are committed at repo root and claim "Total unique strings: 73". The extraction regex in [scripts/extract-untranslated-strings.mjs](scripts/extract-untranslated-strings.mjs) is matching code, not UI copy. Actual entries include:

- `5. void | Promise` — a TypeScript type annotation
- `6. Promise` — listed against 30 source files
- `7. SUBJECTS_PER_PAGE && (` — a JSX guard expression
- `8. upload-materials-title` — a translation key, already translated

Section 6 above shows BG coverage is in fact strong; these files describe a problem that largely does not exist, and would waste a translator's time. Either fix the extractor to parse JSX text nodes and string literals in `t()`-adjacent positions, or delete both artifacts and generate them on demand into a gitignored path.

### 7.3 🟡 Untracked deployment configuration

`AGENTS.md` notes that `supabase/functions/*/SETUP.md` is "not in git" — so the secrets inventory, the `verify_jwt` settings, and the cron schedule that drives `process-notification-jobs` exist nowhere in the repository. Findings 2.2 and 2.7 cannot be fully assessed from the code alone for exactly this reason. Commit a secrets-free deployment doc listing, per function: required env vars (names only), `verify_jwt` setting, and invocation schedule.

---

## 8. Repository hygiene

### 8.1 Dead code — 452 lines across 6 files, safe to delete

Verified unreferenced by any import:

| File | Lines |
|---|---|
| [src/components/modals/CreateAssignmentModal.tsx](src/components/modals/CreateAssignmentModal.tsx) | 206 |
| [src/data/seed.ts](src/data/seed.ts) | 158 |
| [src/views/shared/classwork/index.ts](src/views/shared/classwork/index.ts) | 39 |
| [src/utils/statusStyles.ts](src/utils/statusStyles.ts) | 25 |
| [src/components/ui/ResponsiveTable.tsx](src/components/ui/ResponsiveTable.tsx) | 22 |
| [src/views/admin/UsersView.tsx](src/views/admin/UsersView.tsx) | 2 |

`CreateAssignmentModal.tsx` is the one to double-check before deleting — a live `AssignmentComposer` and `CreateAnnouncementModal` exist, so confirm this isn't a half-finished replacement someone intends to return to.

### 8.2 Root-directory clutter

- [test-lms.html](test-lms.html) — 944 lines / 54 kB of standalone prototype, tracked in git, referenced by nothing.
- [vite-dev.log](vite-dev.log) — a committed dev-server log. `.gitignore` has `*.log` but this file predates it and is still tracked; needs `git rm --cached`.
- [missing-bulgarian-translations.md](missing-bulgarian-translations.md) / `.csv` — see 7.2.
- [MENTORSHIP_FEATURES.md](MENTORSHIP_FEATURES.md), [UI_UPGRADE_STAGES.md](UI_UPGRADE_STAGES.md) — last touched Oct 2025; likely superseded. Move to a `docs/` folder or delete.

### 8.3 Broken `npm start` script

```json
"start": "npx create-react-app . --template typescript && npm start"
```

Running this in the project root attempts to **scaffold Create React App over the existing repository**. `create-react-app` refuses on a non-empty directory in most cases, but this should not be one `npm start` away from a bad afternoon. Delete the script, or alias it to `vite`.

### 8.4 Fifteen branches, six months of drift

Seven local and fourteen remote branches, including `refactor/modularise`, `feature/reshaped-migration`, `feature/supabase-integration`, `personal-messages`, `planning-section`, `upload-notes`, `Announcements-system`. Several look long-superseded. Merge or delete them — every stale branch is a future merge conflict.

### 8.5 Minor

- [index.html](index.html) `<title>` is "Learning Management System" — should carry TBO branding. No `<meta name="description">`. `<html lang="en">` is static despite the app being bilingual.
- Six `<img>` elements lack `alt` attributes.
- Three `onClick` handlers on `<div>` elements — not keyboard-accessible; use `<button>`.
- `package.json` still says `"author": "Your Name"`.

---

## 9. Prioritised action plan

### Ship this week

| # | Action | Ref |
|---|---|---|
| 1 | Lock down `notification_jobs` inserts + verify creator roles in the worker | 2.1 |
| 2 | Authenticate `send-notification` and HTML-escape its interpolations | 2.2 |
| 3 | Fix the three `getWeekStart`/`dateToString` implementations; plan a data migration for already-stored Sunday week keys | 3.1, 3.2 |
| 4 | Add `"typecheck": "tsc --noEmit"`; fix the 11 `TS2367` dead-branch errors | 4.0 |
| 5 | Confirm `verify_jwt` is enabled on all five deployed edge functions | 2.2, 2.3 |
| 6 | `npm audit fix` | 2.10 |

### Next sprint

| # | Action | Ref |
|---|---|---|
| 7 | Add caller auth to `drive-operations`; escape the Drive query string | 2.3 |
| 8 | Make the storage bucket private; switch to signed URLs; sanitise path segments | 2.5 |
| 9 | Bound the attendance queries by date range; add truncation detection | 3.4 |
| 10 | Fix `addDays`; reconcile student vs admin week grouping | 3.3 |
| 11 | Add an error boundary around `AppRouter` | 3.5 |
| 12 | Narrow the `profiles` projection; restrict contact fields by RLS | 2.4 |
| 13 | Clear the remaining ~58 type errors; add ESLint + a CI workflow | 4.0 |
| 14 | Rewrite or retire the README | 7.1 |

### Backlog

| # | Action | Ref |
|---|---|---|
| 15 | `React.lazy` route splitting; lazy-load the inactive language dictionary | 5.3 |
| 16 | Gate domain-hook instantiation on active workspace | 5.2 |
| 17 | Move the seven in-view Supabase queries into hooks | 5.4 |
| 18 | Split `AttendanceView` (3,185 lines / 53 `useState`) by tab | 5.6 |
| 19 | Introduce narrow contexts to reduce the 128-prop bag | 5.1 |
| 20 | Replace the `window` CustomEvent navigation channel | 5.5 |
| 21 | Standardise RLS on an `is_admin()` helper; wrap `auth.uid()` in `(select ...)` | 2.9 |
| 22 | Delete dead code and root clutter; fix `npm start`; prune branches | 8.x |
| 23 | Fix or delete the translation-extraction script and its output | 7.2 |
| 24 | Introduce a test runner; start with `attendanceUtils`, `dateUtils`, `courseUtils` | — |
| 25 | Plan the Vite 4 → 7 upgrade | 2.10 |

---

## Appendix — how findings were verified

- **Type errors:** `npx tsc --noEmit`, aggregated by file and error code.
- **Build:** `npm run build` (succeeds — esbuild does not typecheck, which is the point of 4.0).
- **Timezone bugs (3.1, 3.3):** the actual helper implementations were extracted and executed under Node in the repo's own timezone (Europe/Sofia, UTC+3). Outputs quoted verbatim.
- **BG translation coverage (6):** script parsing all 39 files in `src/i18n/translations/`, comparing each `en`/`bg` value pair — 3,660 pairs, 34 identical.
- **Dead code (8.1):** per-module import search across all 193 source files, then manually re-verified for directory-style barrel imports (which the first pass produced false positives on — `i18n/translations/index.ts` and `views/admin/UsersView.tsx` were re-checked and only the latter is genuinely dead).
- **Security findings:** read of all five edge functions and all 37 migrations; RLS policies traced against the client call sites that exercise them.
- **Not verified — requires live Supabase access:** base `profiles` RLS policies, the `tbo-lms` bucket's public/private setting, deployed `verify_jwt` settings, and the actual `db.max_rows` value. Findings 2.4, 2.5, 2.2, and 3.4 each depend on one of these and should be confirmed against the live project before being sized.
