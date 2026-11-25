# Adaptive Weekly Planner

A private planner for a student with changing work shifts, using Sunday–Saturday weeks and Australia/Melbourne by default.

## Current release

The core planner and daily-use features are implemented locally. The private planner supports day, week, month and agenda views, commitments, weekly recurrence, per-occurrence rescheduling/completion, daily routine checklists, task templates, manual scheduling, deadlines, priorities, travel buffers, conflict warnings, locks and archiving. Generate weekly template sessions repeatedly without duplicates. Drag unlocked flexible tasks to a day or edit their exact times through the occurrence form.

Recurring series support daily routines and weekly activities. Existing session history is preserved, so use individual occurrence editing after recording completions or exceptions. Template edits affect newly generated sessions. Plan week now previews automatic placement, splitting, release times, allowed hours and deadlines. Proposals can be saved and reviewed. Phase 4 adds acceptance, rejection, conflict-driven relocation, split-session calendar support and conservative undo. Apply pending migrations with `pnpm local:start`. See the [verification record](docs/DEVELOPMENT_PLAN.md#phase-4-implementation-and-verification).

Today shows your agenda, next activity, checklist routines and deadlines. Study courses and publication projects share the planner's task records. Progress shows weekly workload and stored completions; productive and recreational screen-time entries are manual and separate.

Settings provides private JSON backup, additive restore of missing records, static weekly ICS export and installation guidance. The app includes a standalone manifest, icons and a generic offline fallback. Private data is not cached and offline writes are not queued. See [release and recovery instructions](docs/RELEASE.md) for limits, physical-device checks and deployment requirements. Production has not been changed.

## Start locally

Use standalone Node 24 and pnpm 11.25.0. A Node binary bundled inside a signed desktop application can reject native dependencies on macOS. Use a standard Node installation for development. The dev and build scripts select Next.js’s supported webpack compiler because Turbopack’s CSS worker failed to bind a port in this local environment.

```sh
pnpm install --frozen-lockfile
pnpm local:start
pnpm dev
```

Open http://localhost:3000. Local startup applies pending migrations, creates the local owner and test accounts on first use, and writes the connection configuration into ignored .env.local. It preserves existing accounts on subsequent runs.

Your private local login is the first entry in .env.local-accounts, with email owner@weekly.local and a generated password. This file and .env.test are Git-ignored and created with owner-only file permissions. The setup script refuses a non-local Supabase endpoint and does not overwrite an existing connection to another project.

The project uses Supabase CLI 3.2 and the experimental native runtime on this Apple silicon Mac. The first start downloads service archives. Database, Auth and REST run locally at 127.0.0.1. Service versions are recorded in supabase/supabase.lock. Supabase stores its native data under ~/.supabase/stacks. Stop these services with pnpm local:stop. Stopping preserves the database.

This local setup is available on the Mac. Access from another physical device requires a reachable deployment or explicitly configured local network access.

## Verification

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm exec playwright install chromium webkit
pnpm test:e2e
pnpm build
# Optional: test the production build on an isolated local port
PLAYWRIGHT_PRODUCTION=1 pnpm test:e2e
```

On 22 November 2026, lint, TypeScript checking, 23 unit tests, both real database integration suites, 24 browser tests and the production build passed. Browser tests use desktop Chromium and emulated iPhone WebKit.

On 23 November 2026, the Phase 4 working code passed lint, TypeScript checking and 31 unit tests. The migration applied successfully, all three real-account integration suites and 26 browser tests passed, and `pnpm build` succeeded. The full generate/save/accept/undo UI path also passed a focused desktop/iPhone rerun.

The final local verification on 24 November 2026 passed lint, TypeScript, 37 unit tests, all four real-account integration suites, 28 desktop/iPhone browser tests and the production build. The four approved features—progress, backup/restore, calendar export and installable-app support—are implemented. Physical-device installation remains unverified; production was not changed. The local test credential was rotated and its refreshed sign-in verified on 25 November 2026. See the [development record](docs/DEVELOPMENT_PLAN.md) and [release instructions](docs/RELEASE.md).

Coverage includes authentication, settings persistence, concurrent edits, failed-save recovery, cross-user and anonymous isolation, same-owner relationships, locked-activity enforcement, recurrence validation, daylight-saving review, per-session completion, template idempotency, calendar views, routine checklists, and drag/form scheduling. Tests use separate local test accounts and archive their fixtures while preserving records.

## Hosted setup

For a hosted development project, apply all migrations in supabase/migrations in timestamp order using its migration workflow. Disable public registration, enable email/password login, configure the application URL in Auth settings, and provision a confirmed account. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in the deployment environment. Server-side application requests use the user's session and database RLS.

Run pnpm build and pnpm start for the production server. The supplied verification suites reject non-local database endpoints. Hosted staging validation requires a separately reviewed harness as described in [release instructions](docs/RELEASE.md). Production deployment requires approval.

## Project guidance

Read [AGENTS.md](AGENTS.md), [requirements](docs/PROJECT_SPEC.md), [architecture](docs/ARCHITECTURE.md), [database design](docs/DATABASE.md), [scheduling contract](docs/SCHEDULING_ENGINE.md) and [development plan](docs/DEVELOPMENT_PLAN.md).
