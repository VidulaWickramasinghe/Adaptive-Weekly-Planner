# Local release and deployment procedure

The app is online-first. The local build includes daily and weekly progress, study/publication tasks, manual screen-time entries, account-scoped JSON backup/restore, weekly calendar-file export and an installable web manifest. Nothing in this procedure authorizes production deployment.

## Reproduce the local build

Use standalone Node 24 and pnpm 11.25.0. From the repository:

```sh
pnpm install --frozen-lockfile
pnpm local:start
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
PLAYWRIGHT_PRODUCTION=1 pnpm test:e2e
pnpm start --hostname 127.0.0.1
```

Local startup applies migrations without resetting the database. Never use a database reset to upgrade an existing planner. The test suites refuse non-loopback Supabase endpoints; they use dedicated test accounts, create synthetic fixtures and archive them after testing. They do not use the owner's account. Local data lives in the native Supabase stack; `pnpm local:stop` stops services without removing it. Keep private environment and account files out of source control.

The build and development scripts select the supported webpack compiler. The local Turbopack CSS worker failed to bind its worker port. Production browser testing starts the built app on port 3100; it does not reuse an older app on port 3000.

## Backup and recovery

Settings → Download JSON backup exports the signed-in account's settings, activities, archived records, task templates, occurrence changes, projects, manual screen-time records and proposal/revision history. Download uses an authenticated no-store response. The file contains personal data but no account password or authentication token; keep it in private storage.

Restore accepts a version-1 JSON backup smaller than 1.9 MB for the **same account ID**. Confirm the additive operation in Settings. It inserts missing records in a single transaction. Existing records and current preferences are preserved, even when the backup contains older values. Repeating a restore is a no-op. Invalid ownership, relationships, locked-history constraints or malformed data reject the transaction without a partial restore.

This is not an overwrite or rollback utility. It does not recreate authentication accounts, replace changed records, undo archiving, migrate data to another account, or recover the entire Supabase installation. Full disaster recovery also requires an operator-managed database/auth backup. Never delete current records to force an import; review a separate recovery plan first. The JSON export includes preferences for reference, which can be re-entered through Settings if required.

## Calendar portability

Settings → Export this week downloads an ICS file with the selected account's current-week occurrences, including accepted chunks. `/api/calendar?date=YYYY-MM-DD` exports the week containing another local date. UTC event times preserve the actual instants; recurring series are expanded for that week. Skipped/cancelled occurrences are omitted. This is a static export, not calendar sync or a subscription. Reimporting may duplicate events depending on the receiving calendar.

## Installable app and connectivity

The app supplies a standalone manifest, PNG icons, Apple home-screen metadata and a service worker. Use a supported browser's install command. On iPhone, open a reachable HTTPS deployment in Safari and use Share → Add to Home Screen. Localhost is reachable on the Mac itself; it is not the Mac's address on a physical iPhone.

The service worker never stores private pages or calendar data in Cache Storage. It only supplies a generic offline navigation response. An in-app indicator explains when the browser is offline. Writes are not queued: retain or re-enter the draft, reconnect, reload current records and retry. Stale proposals and versioned edits are checked by the database. Manifest/icon behavior and offline/reconnect UI are tested in desktop Chromium and emulated iPhone WebKit; physical home-screen installation needs a separate device test against HTTPS.

## Deployment after separate approval

1. Choose the hosting and Supabase environment, region and backup policy. Obtain deployment approval before changing production.
2. Provision confirmed accounts and disable public registration if the planner remains private. Configure Auth site/redirect URLs for the exact HTTPS application origin.
3. Review and apply timestamped migrations in order through the Supabase migration workflow. Take an operator database backup first; do not reset a live database. Validate migration history on a disposable environment before production.
4. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for the target environment. The app uses authenticated user-scoped clients and does not require a service-role key. Never copy `.env.test` or local credentials into production.
5. Run a frozen install, `pnpm build`, and `pnpm start` behind HTTPS (or use a host supporting the pinned Next.js version). Set a health check on `/sign-in`. Provide durable logs that exclude credentials and private calendar payloads.
6. Validate sign-in/out, create/save, proposal approval, progress, export and installation using approved staging accounts. Local test suites deliberately reject hosted endpoints; use a separately reviewed staging harness rather than removing the production guard.

Physical-device acceptance and production deployment are outstanding environment checks, not claims made by passing local browser emulation.
