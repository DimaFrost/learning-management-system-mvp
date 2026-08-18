# Bulgarian domain glossary (proposed)

Approve or edit the **Proposed BG** column before Phase 2+ mass translation.
Tone: neutral / impersonal where possible. Brand names stay English.

English UI copy is **not** changed by this glossary — these are Bulgarian dictionary values only.

| English term | Context | Proposed BG | Notes |
|---|---|---|---|
| The Burning Ones | Brand | The Burning Ones | Keep English |
| TBO | Brand short | TBO | Keep English |
| Stream | Announcements feed / nav | Известия | Already used in i18n |
| Classwork | Classroom module umbrella | Занятия | Covers homework + materials |
| Classroom | Sidebar submodule | Учебна стая | |
| Homework | Assignments | Домашна работа | |
| Assignment | Single homework item | Задание | |
| Quick check | Short in-class work type | Бърза проверка | |
| Submission | Student work hand-in | Предаване | |
| Material / Materials | Class resources | Материал / Материали | |
| Curriculum | Courses & sessions module | Програма | Already used in i18n |
| Session | Class meeting | Сесия | |
| Subject | Course subject | Предмет | |
| Course | Year group / program course | Учебна година | |
| Year group | Cohort | Година
| First year / Second year | Course type | Първа година / Втора година | |
| Enrollment | Student–course link | Записване | |
| People / Directory | Users hub | Хора / Списък | |
| Attendance | Presence tracking | Присъствие | Already used in i18n |
| Present / Late / Absent | Attendance status | Присъства / Закъснял / Отсъства | Gender-neutral forms preferred for badges |
| Classes | Graduation gate | Лекции | Gate label for class attendance |
| The Well | Named Wednesday program | Кладенецът
| Wednesday gathering | Well subtitle | Кладенец| |
| Activation Saturday | Named Saturday joint sessions | Събота на активация| |
| Activation | Short label | Активация | |
| Joint session | Both hours together | Обща сесия | |
| First hour / Second hour | Class slots | Първа сесия / Втора сесия | |
| Ministry | Service / Sunday teams gate | Служение | Matches church context |
| Ministry team | Team assignment | Екип за служение | DB already has `name_bg` for team names |
| On Duty | Duty roster | Дежурство | Already used in i18n (`sidebar.onDuty`) |
| Attendance keeper | Person marking class/Well attendance |Дежурен | |
| Fallback | The Well yearly alternate rule | Резервно правило | Not generic “backup” |
| Graduation gates | Readiness requirements | Условия за завършване | |
| Cadence | Mentorship meeting rhythm rules | Ритъм | Already echoed in `sidebar.mentorOps.desc` |
| Check-in | Mentorship log form | Среща / запис | Existing check-in modal uses „среща“ |
| Mentee | Mentored student | Менти | Keep loanword used in existing BG copy |
| Mentor | Mentorship role | Ментор | |
| Team leader | Workspace / role | Лидер на екип | |
| Absence notice | Student miss notice | Известие за отсъствие | |
| Correction request | Attendance fix request | Заявка за корекция | |
| Tuition | Fees module | Такса | |
| Installment | Tuition payment slice | Вноска | |
| To-do / To-dos | Task list | Задача / Задачи | Already „Задачи“ in sidebar |
| Announcement / Post | Stream item | Публикация | |
| Workspace | Role workspace | Работно място | Already used in i18n |
| Knowledge Base | Admin docs | База знания | |
| Operations | Sidebar section | Операции | Already used in i18n |
| Health | Compliance / status metaphor | Състояние | Avoid medical „здраве“ unless you prefer it |
| Review | Queue / action | Преглед | Verb vs noun decided per screen |
| Due | Deadline adjective | Краен срок / До | Context-dependent |
| Grade | Mark (noun) | Оценка | Verb „оцени“ when grading |
| Open / Close | UI actions | Отвори / Затвори | Status „отворена“ when adjective |
| Directory | People list | Списък | Not file directory |

## Ambiguous words (decide per screen)

These do **not** get one global Bulgarian string; each UI occurrence picks the right sense:

- **Open** — action vs status
- **Close** — action vs status
- **Present** — attendance vs “show”
- **Due** — deadline vs amount owed
- **Grade** — noun vs verb
- **Post** — noun vs verb
- **Review** — verb vs queue noun
- **Fallback** — Well rule only (not generic backup)
- **Health** — compliance metaphor
- **Directory** — people list
- **Operations** — admin ops hub

## Intentionally not localized

- Brand / product tokens: `The Burning Ones`, `TBO`, `Google Docs`, `EUR`, `Ctrl/Cmd K`, `EN` / `BG`
- Internal planning day-name keys in `useSchoolYearPlanning` stay English (`Tuesday`, `Saturday`, …) because they drive schedule logic; the planning grid **displays** localized weekday names from the date instead
- Dev tools (`DevRolePanel`) stay English

## Sign-off

- [x] Glossary approved (edit table above if needed)
- [x] Proceed to Phase 2 (global chrome)
