# Development plan

Phases 0 through 5 are complete locally. The approved Phase 6 local feature set is implemented and verified; physical-device and release follow-ups remain. Phase 2 implementation and verification are recorded below. The repository began empty on branch main. Development uses Node 24 and pnpm 11.25.0. Supabase CLI is installed as a project dependency and uses its native runtime. See the implementation record below for verification results.

## Phase 1 approved on 22 November 2026

Deliver one private workflow end to end. A user signs in, sees the current Sunday–Saturday dates, edits their time zone and preferred daily capacity, and sees the saved settings after signing in on another device.

| Step | Files to create or update | Evidence required |
|---|---|---|
| 1. Scaffold and pin dependencies | package.json, pnpm-lock.yaml, tsconfig.json, Next, ESLint and PostCSS configs, src/app/layout.tsx and globals.css | Clean install, local start, lint, typecheck and production build succeed. |
| 2. Establish private storage | supabase/config.toml, supabase/migrations/*_profiles.sql, .gitignore, .env.example, src/lib/supabase and src/repositories/profiles.ts | Fresh local migration succeeds. Authenticated owner can read/write settings. Independent user and anonymous client cannot read or change them. |
| 3. Connect sign-in and settings | src/app/sign-in, protected dashboard/settings routes, src/features/settings, session handling and responsive navigation | Sign-in, sign-out, expiry, validation, refresh and failed saves work through the real routes. |
| 4. Verify and document | tests/unit, tests/integration, tests/e2e, test configs, README.md and this plan | Record working setup commands and actual results for the acceptance suite. |

Prefer local Supabase with a compatible container runtime and CLI, a disposable database and two local test accounts. Configure the local application URL and allowed auth redirect URLs. For a hosted development setup, the owner would supply the project URL and publishable key through local environment configuration and provision private test accounts. Use NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in the example with placeholders. Keep any migration credentials in the operator's environment. The application needs no service-role key. Proposed first auth method is email and password with pre-provisioned accounts.

### Acceptance tests

- Start from a clean checkout and disposable database. Run migrations, launch the app and load the sign-in page. Missing configuration produces actionable instructions without exposing values.
- In Playwright sign in as A, reload a protected page, sign out, then reopen its URL. A valid session persists across reload and signed-out or expired sessions return to sign-in.
- As A save a valid IANA zone and daily capacity. Check the saved values in a second authenticated browser context. Reject invalid zones or out-of-range minutes. A simulated write failure preserves the draft and shows an error.
- Using the real database API and separate credentials, verify A can update A's profile. B and an anonymous client cannot obtain A's data, overwrite it or insert a row owned by A. Verify A's row afterwards.
- With a fixed clock check a Saturday/Sunday boundary in Melbourne. The dashboard derives its week from the profile zone. On desktop and iPhone-sized WebKit viewports navigate and submit using labelled controls, with visible keyboard focus and no horizontal overflow.
- Run the proposed pnpm scripts lint, typecheck, test, test:integration, test:e2e and build. Document each result and any outstanding environment limitation before marking the phase complete.

## Subsequent milestones and test ownership

| Phase | Usable outcome and exit test | Master specification §15 |
|---|---|---|
| 2 — Manual planner | Create a shift, recurring lecture with an exception, task template and routine. Schedule manually, edit via form, show conflict, reload and complete a single occurrence. | 6 routine completion, 7 overnight shifts, 14 invalid recurrence |
| 3 — Generate a week | Preview a deterministic timetable with preserved protected time, realistic daily loads and reasons for unplaced sessions. Run pure domain tests including both Melbourne clock changes, adjacent intervals, buffered week boundaries and exact split totals. | 1 basic week, 3 capacity, 4 deadline, 5 balance, 8 DST, 9 regeneration, 10 locks, 15 splitting |
| 4 — Adapt to a roster change | Enter a conflicting shift, review the changes, reject, accept or undo. Test stale proposals, retry after a lost response, safe undo and visibility from a second authenticated device. | 2 new shift, 10 locks, 11 approval, 13 cross-device persistence |
| 5 — Daily use and progress | Complete a study session, a publication stage and a routine. Weekly totals reconcile to the stored completions. Manually entered recreational screen time stays distinct from productive activity. | 6 routine completion and progress regression |
| 6 — Release readiness | Verify installation, keyboard and touch flows, online sync after network interruption, export/restore, ownership policies and reproducible deployment on desktop and iPhone. | 12 user isolation (first tested in Phase 1), 13 cross-device persistence, full regression |
| 7 — Optional additions | Select integrations, offline writes, notifications or native clients after reviewing the core workflow. Define acceptance for each chosen feature. | Feature-specific |

For each approved phase read the baseline and repository guidance, identify acceptance criteria, build the smallest complete workflow, run checks, fix failures and document verified behavior. Review each phase before starting the next. Production deployment requires separate approval.

## Phase 1 implementation record

Phase 1 was approved and completed locally on 22 November 2026. The implementation includes the application foundation, responsive dashboard and settings, email/password sign-in and sign-out, server actions, profile migration and RLS policies.

The native Supabase runtime now runs real Postgres, Auth and REST on this Mac. The migration applied successfully, and local owner and test accounts were provisioned. Repeatable startup is available through pnpm local:start. Private account credentials are stored in ignored .env.local-accounts. The native runtime is experimental and its service versions are locked in supabase/supabase.lock.

Verified checks include lint, TypeScript, 10 domain and validation tests, real database ownership and persistence tests, 14 Chromium/iPhone WebKit browser tests and a production build. Browser tests cover saved settings across contexts, invalid input, failed-save draft retention and retry, stale edits, expired session cookies, sign-out, keyboard navigation and viewport fit. Physical iPhone access and production deployment remain later release checks.

The desktop application's signed Node runtime rejected native modules. Verification uses standalone Node 24. The dependency lockfile records compatible build and testing versions.

Phase 2 was subsequently approved. Its implementation is recorded below.

## Phase 2 implementation

Approved on 22 November 2026. The manual planner now includes day, week, month and agenda views, date navigation, editable commitments, weekly lectures, tentative and cancelled statuses, travel/preparation buffers, protected time, locks and duplication. Flexible tasks support duration, priority, deadlines, manual placement, form-based resizing, drag-to-day movement, completion and archiving. Overlap warnings include buffers.

Daily routines support checklist-only or calendar-reserved modes. Each recurring occurrence has separate completion, skip/restore and relocation records. Existing series anchors with recorded session history are protected from edits that would orphan that history. Users can change individual occurrences or create another series.

Reusable task templates generate a chosen number of distinct sessions for a Sunday-start week. Database uniqueness prevents duplicates when regenerating. Template changes apply to new instances and leave existing sessions intact. The task pool includes unscheduled and overdue filters.

The additive migration introduces template and occurrence tables with RLS, same-owner foreign keys, database lock validation, recurrence-date validation and transactional occurrence edits. Local data and completed occurrence records are retained.

Recurrence currently supports daily routines and weekly activities. Daylight-saving ambiguities are surfaced for review. General imported recurrence rules, automated placement, splitting and schedule proposals belong to later scheduling work.

The calendar uses native React views with accessible forms rather than a calendar dependency. Dragging changes the day of an unlocked flexible occurrence while preserving its local clock times. Exact time and duration edits use forms. This decision keeps domain and persistence independent of calendar rendering.

Verification passed with pnpm typecheck, pnpm lint, pnpm test (17 tests), pnpm test:integration (both real database suites), pnpm test:e2e (22 desktop/iPhone tests), and pnpm build. Phase 3 introduces deterministic schedule proposals and availability calculations.

## Phase 3 implementation

Approved on 22 November 2026. The Plan week workflow generates deterministic proposals for the selected planning week with explicit clock and time zone inputs. Existing allocations, confirmed commitments, protected periods and buffers remain reserved. Tasks are ordered by deadline, priority and stable identifier, then placed by daily flexible workload and time.

Tasks expose earliest start, allowed daily hours, splitting permission and minimum chunk duration. Splitting reserves the full target or rolls the tentative chunks back, retaining a reason for unallocated work. Calendar time uses local week boundaries and elapsed minutes across daylight-saving transitions. Invalid recurring local times block generation until reviewed.

The proposal screen reports proposed minutes, remaining free minutes within the selected daily window and elapsed minutes in the week. Free minutes account for overlapping occupied intervals once. They describe clock availability, which may exceed the remaining daily workload allowance.

Users can generate and save a proposal for review. Saved proposal headers and entries are relational, private, and written transactionally. Saving recalculates from current records. Historical proposals are review snapshots. Applying a proposal, detecting stale approval, automatic displacement handling and undo are Phase 4 work.

The first algorithm prioritises complete whole sessions and then tries permitted smaller chunks. It is deterministic and reports unsuccessful allocations without claiming a proof of infeasibility. Time-of-day preferences are exposed as allowed windows in this release. Advanced energy scoring and general recurrence imports remain future refinements.

Verification includes unit tests for deterministic balance, buffers, deadlines, split totals, partial-allocation rollback and release/window constraints, real database isolation of saved proposal headers and entries, and desktop/iPhone proposal persistence checks. The generated Next.js type backup pattern '.next/**/* 2.ts' is excluded to avoid duplicate declarations created in this local workspace.

Phase 3 verification passed with pnpm typecheck, pnpm lint, pnpm test (23 tests), pnpm test:integration (including proposal ownership), pnpm test:e2e (24 tests), and pnpm build.

## Phase 4 implementation and verification

Approved by the user's instruction to continue building on 23 November 2026. Code now includes conflict-driven relocation proposals, old/new placement review, accept/reject actions, accepted split chunks in the calendar, session completion, chunk movement and conservative undo. Unaffected tasks remain reserved. A task with chunks outside the selected week is preserved rather than partially replaced. Completed, locked and past sessions are not automatically moved.

Migration 202611230005_revisions.sql adds relational schedule_slots, revision_before and revision_events. Chunks reference their original task and occurrence; ordinal zero represents explicitly unallocated demand. Snapshots are read in one database statement and use a content fingerprint for concurrency, instead of introducing a separate integer planning version. Planning writes and revision decisions take the same per-user transaction lock. Acceptance checks the fingerprint and constraints, replaces affected groups atomically and records prior rows. Repeated acceptance returns the existing result. Rejection only changes proposal state. Undo restores stored prior allocations and records a compensating audit event; it is blocked after any planning-input change or if restoring old placements would reintroduce a conflict. This conservative policy intentionally requires regeneration after intervening edits.

The database independently checks ownership, task eligibility, range bounds, complete split totals, minimum chunks, deadlines, release times, permitted hours, buffered overlaps and daily capacity. New schedule and audit tables expose only owner-scoped reads; mutation is through authenticated RPCs. Older review snapshots cannot be accepted. Session completion applies to the whole task occurrence, including all split chunks; separate chunk progress remains later work. Accepted chunk moves preserve duration. Original anchors and exceptions cannot silently override accepted chunk placements.

Initial verification attempt on 23 November 2026 (resolved by the completion run below):

- `pnpm typecheck` and `pnpm lint` passed.
- `pnpm test` passed all 31 unit tests, including 8 revision tests.
- `pnpm local:start` failed in the sandbox. The requested elevated retry was declined, so the new migration has **not** been applied or verified against local Postgres.
- `pnpm test:integration` was attempted and failed at authentication with `AuthRetryableFetchError: fetch failed`, before any suite assertions about revisions ran. The new real-account revision suite is added to this command; it must pass before approval of this phase.
- `pnpm build` failed when Turbopack tried to bind a worker port (`Operation not permitted`). The requested elevated retry was declined. No successful production build is claimed for these changes.
- Authenticated browser execution is pending local services and migration application. New Chromium/iPhone tests cover accept, second-context calendar visibility, undo, stale approval and rejection. `pnpm test:e2e --list` successfully discovered 26 desktop/iPhone tests. Discovery is not execution; browser checks have not been run.

Local Markdown link targets in README and docs were verified.

### Phase 4 completion — 23 November 2026

The user authorized completing the blocked verification. `pnpm local:start` succeeded and applied the additive revision migration while retaining existing local records. `pnpm test:integration` passed all three real-account suites: profile isolation, manual planner behavior, and revision ownership/concurrent retry/stale approval/rejection/atomic rollback/split identity/completion/cross-client persistence/safe undo. No mocked identities substituted for database tests.

`pnpm lint`, `pnpm typecheck` and `pnpm test` passed (31 tests). `PLAYWRIGHT_PRODUCTION=1 pnpm test:e2e` passed all 26 Chromium and emulated iPhone WebKit tests against the built app on port 3100. The revision browser test was then strengthened to generate and save its initial proposal through the UI; `PLAYWRIGHT_PRODUCTION=1 pnpm test:e2e tests/e2e/revisions.spec.ts` passed on both browsers.

Turbopack still failed to bind its CSS worker port even on the approved retry. The installed Next.js CLI documentation supports webpack explicitly, so `dev` and `build` now select `--webpack`. `pnpm exec next build --webpack` and the updated standard `pnpm build` both completed successfully. Playwright supports an isolated production-server mode; its default development-server mode remains available.

Phase 4 is complete locally within the documented conservative scheduling scope. Physical-device access, production deployment, offline support, cross-week repair and subsequent milestones are not claimed as completed. Review Phase 5 before expanding scope. Production deployment still requires separate approval.

## Remaining core stages approved — 23 November 2026

The user requested completion of all stages. Phase 5 will add a real Today view, weekly workload/progress, study courses and publication projects linked to the existing task identities, and separate manually entered productive/recreational screen-time records. Phase 6 will add installable metadata, an explicit online/offline indicator, safe additive backup restore, portable export, release documentation and regression/security/browser verification. Work proceeds one usable slice at a time. Optional Phase 7 integrations/native clients require a concrete selection; calendar-file export is the default bounded addition. No production deployment, paid integration or destructive restore is authorized by this scope.

## Phase 5 and local release implementation — 24 November 2026

The user explicitly approved progress tracking, backup/restore, calendar export and an installable app, with preservation of existing data and no production changes. The implementation adds:

- Today agenda, next activity, routine checklist, conflicts and outstanding deadlines; weekly workload/completion review with injected clock and zone.
- Study courses and publication projects with weekly targets, editable settings, archival and tasks linked to the existing planner identities. Publication tasks have explicit workflow stages. Scheduled duration and estimated unscheduled duration are labelled; manual productive and recreational screen minutes remain separate.
- Completion timestamps, project/journal optimistic versions and same-owner relationships in additive migrations. Existing historical completion dates are not fabricated.
- Private JSON export, explicitly confirmed additive account-specific restore, static weekly ICS export, standalone manifest/icons, Apple home-screen metadata, a generic offline fallback and connectivity notices. Private pages are not cached and offline writes are not queued.
- A local-only guard in every integration script and the browser configuration. The release procedure documents deployment, recovery limits and hardware checks in docs/RELEASE.md.

The progress and backup migrations applied successfully to local Supabase. The restore-idempotency follow-up filters existing keys before insertion guards, preserving existing locked/history records on repeated import. All four real-account integration suites passed, including full-backup restore twice with equality of exported records before and after, new-record recovery, no overwrites, wrong-account rejection and atomic rollback. Production was not accessed or changed.

During browser verification, the new test's dropdown selector was corrected to use its accessible combobox role, repeated restores were updated to reselect the file/confirmation after successful form reset, and screen-time reload now waits for confirmed persistence. The existing lecture-move test now waits for the changed clock time rather than a success message left over from completion. Network-failure route mocking blocks service workers in that specific suite; the new release test exercises the actual offline/reconnect UI. Authentication traces are disabled to avoid capturing input credentials. A diagnostic had exposed a local test credential; rotation via scripts/rotate-local-test-password.mjs was initially declined and was subsequently approved and completed on 25 November 2026. Owner credentials were not changed.

### Final local verification

Verification completed on 24 November 2026; this record was finalized on 25 November after an interruption.

- `pnpm lint` — passed.
- `pnpm typecheck` — passed.
- `pnpm test` — 37 tests passed.
- `pnpm test:integration` — all four real-account suites passed against local Supabase, including complete-backup no-op restoration and rollback checks.
- `pnpm build` — passed using the supported webpack compiler.
- `PLAYWRIGHT_PRODUCTION=1 pnpm test:e2e` — all 28 desktop Chromium and emulated iPhone WebKit tests passed in the final complete run (55.1 seconds).
- Local Markdown link targets and the unique ordering of all eight migrations were checked.

The four approved local features are complete within the documented scope. Existing records were preserved by additive migrations and missing-record-only restore; production was not accessed, modified or deployed. The local app was started after the build, but its process was no longer running when checked on 25 November. Restart it using `pnpm local:start` followed by `pnpm start --hostname 127.0.0.1`.

 Physical iPhone home-screen installation and production deployment remain separate, unperformed environment checks. Optional external calendar sync, native clients and extended offline functionality are outside this approved local release; static ICS export is the implemented optional extension.


### Local follow-ups completed — 25 November 2026

Restarted the existing local Supabase services without resetting data, rotated only the exposed local test-account password after approval, and refreshed the ignored credential files. A read-only check passed for the refreshed test login, owned-profile access, sign-out and the app sign-in endpoint. No planner records, owner credentials or production data were modified by these follow-ups. The verified build is running at http://127.0.0.1:3000 for this session. Authentication traces remain disabled.

The approved local implementation and local security follow-up are complete. Physical iPhone home-screen installation remains unverified; production deployment still requires separate approval. Existing automated evidence remains 37 unit tests, four real-account database suites, 28 desktop/emulated-iPhone browser tests, lint, typecheck and successful build. No application code changed in this follow-up, so the full regression suite was not redundantly rerun.
