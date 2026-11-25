# Architecture and screens

Use one Next.js App Router application with React, strict TypeScript and Tailwind, backed by Supabase Auth and Postgres. Both devices read the same accepted schedule. The first release uses online writes. Show failed saves explicitly and retain the user's draft. Add read caching and PWA installation in Phase 6. Offline editing needs its own replay and conflict design.

| Boundary | Responsibility |
|---|---|
| app and components | Route layouts, accessible forms, calendar rendering and review of proposed changes. Pass edits through the same service for drag and keyboard input. |
| features and services | Verify the session, validate input with Zod, load per-user records, call the scheduling engine and commit approved changes. |
| domain/scheduling | Pure TypeScript interval arithmetic, recurrence, weekly targets and proposal generation. Receives an explicit clock, zone and stable IDs. Runs in Vitest without a browser or database. |
| repositories and lib | Translate database rows to domain values, handle typed persistence errors, and supply session-scoped Supabase clients. Keep calendar vendor event objects behind a presentation adapter. |

A shift edit saves the confirmed commitment and advances the planning input version in one transaction. The application reads a consistent snapshot, detects conflicts, and asks the engine for a proposal. The review page shows old and proposed times. Acceptance revalidates current inputs in Postgres before changing the accepted schedule. A rejected proposal leaves the saved shift in place and its unresolved conflict visible.

## Screens

| Screen | Desktop | iPhone and keyboard access |
|---|---|---|
| Sign in and Settings (Phase 1) | Private email sign-in, editable time zone and preferred daily capacity, Sunday week boundary, sign out | Single-column labelled form, inline validation, visible focus and save confirmation |
| Dashboard (Phase 1) and Today (Phase 5) | Dashboard opens on this week's dates and account settings. Today later adds next commitment, deadlines, routines, remaining time and completion actions from saved records. | Chronological agenda, quick completion and form-based postponement |
| Weekly Planner and Calendar (Phases 2–4) | Sunday–Saturday grid with fixed, protected and flexible labels, adjacent task pool and capacity totals. Calendar also offers day, month and agenda. Review lists each move and reason before acceptance. | Start with a day agenda and week selector. Show the pool and review as separate panels. Form controls support moving and resizing. |
| Tasks and Routines (Phase 2) | Quick entry with duration and frequency, optional advanced constraints, unscheduled list. Checklist-only routines appear without occupying time. | Add opens a labelled form. Completion is available directly from a checklist. |
| Study, Publications and Progress (Phase 5) | Course and assignment detail, publication stages, weekly goals and actual completions | More menu opens focused lists and weekly review |

Desktop navigation uses a sidebar. Mobile grows into Today, Week, Tasks, Add and More as those destinations become functional. Offer light and dark themes with text and colour for status. Onboarding grows with the phases from account and settings to recurring lectures, shifts, flexible targets and first proposal.

## Dependency choices and risks

Use a pinned, compatible Node/pnpm toolchain and lockfile when scaffolding. Verify a production build before selecting final package versions. See the [Next.js installation requirements](https://nextjs.org/docs/app/getting-started/installation). Use a cookie-backed server session and a user-scoped client with RLS. See [Supabase server authentication](https://supabase.com/docs/guides/auth/server-side).

Evaluate FullCalendar Standard at Phase 2 against week/day/month/list views, keyboard alternatives and mobile rendering. Standard plugins use the MIT licence and Premium plugins have separate terms. Check the exact plugins before installation. See [FullCalendar licensing](https://fullcalendar.io/license).

The largest correctness risks are recurrence across daylight saving, treating a saved shift conflict as an accepted new plan, and accepting stale changes across devices. The domain and database documents specify how to handle each. A deterministic heuristic can miss a feasible timetable. Explain the search result accurately and retain every unplaced session.

## Phase 2 implementation decision

The planner uses React calendar views with accessible forms and native drag-to-day interaction. FullCalendar evaluation remains optional for later presentation improvements. Pure date expansion lives in src/domain/items.ts, authenticated actions in src/app/planner-actions.ts, and database invariants in migrations. The data model currently combines manual activities in planner_items and relates them to normalized templates and occurrence records. Revision-based automatic planning remains future work.

## Phase 4 verified implementation

The proposal route now uses read_planning for a consistent snapshot, with pure relocation logic in domain/revisions.ts and authenticated save/decision actions. The planner overlays relational schedule_slots without duplicating task identities. Postgres revalidates revision decisions, preserves before rows and appends acceptance/rejection/undo events. A conservative undo policy blocks changed inputs or unsafe restored placements. The migration, real-account database suites and desktop/iPhone browser workflows passed local verification as recorded in the development plan.

## Daily use and local release features

The Today dashboard and weekly review use domain/progress.ts with an injected clock and zone. It clips scheduled duration at local boundaries, deduplicates split sessions by original occurrence identity and keeps the manual screen-time journal separate. Study courses and publication projects link to existing planner_items; completion therefore uses the same actions and database records as the calendar.

Authenticated download routes return no-store JSON backup or expanded weekly ICS. The restore form has an explicit additive-operation confirmation and reports transaction failure without changing existing data. The installable manifest and service worker provide app metadata and a generic offline message only: private pages and credentials are not cached and writes are not queued. See [release and recovery instructions](RELEASE.md) for deployment gates and limitations.
