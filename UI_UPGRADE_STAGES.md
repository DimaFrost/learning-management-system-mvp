# UI Upgrade Stages

This app is being moved toward the pasted Dub-inspired methodology: light canvas, compact density, monochrome typography, 1px borders, restrained blue accent, and product UI as the visual language.

## Stage 1: Platform Chrome

Status: started.

Scope:

- App shell background and page width.
- Header visual system.
- Sidebar navigation states.
- Shared page header primitive.
- First dashboard card treatment.

Rules:

- Prefer border-defined surfaces over heavy shadows.
- Use `#e5e5e5` as the default container line.
- Use blue for active navigation and meaningful highlights, not large decorative fills.
- Keep content-dense screens compact and scannable.
- Add shared CSS utilities only when they improve more than one page.

## Stage 2: Shared Data Surfaces

Next likely pass:

- Tables.
- Empty states.
- Loading states.
- Form inputs.
- Modal shells.
- Filter pills and status badges.

## Stage 3: Core Role Dashboards

Upgrade one role area at a time:

- Administrator pages.
- Student course and homework surfaces.
- Teacher sessions.
- Mentor dashboard.

## Stage 4: Deep Workflow Screens

Save complex screens for later:

- Curriculum planning calendar.
- Attendance management.
- Homework/class detail workflows.
- Messaging.

## Maintenance Culture

When changing UI, keep stages small enough to review visually. Prefer updating shared components before editing many leaf pages. If a page needs a one-off style, first ask whether it should become a reusable utility or component.
