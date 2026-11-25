# Proposed relational design

Introduce tables with the first feature that uses them. Phase 1 needs Supabase auth.users and profiles. Give every user-owned row a user_id referencing auth.users. Use UUIDs for entities, date for local planning dates, timestamptz for instants, and positive integer minutes for durations. Store the IANA zone separately for local rules.

| Relation | Identity, fields and relationships |
|---|---|
| profiles | One row per auth user with user_id as primary key, timezone default Australia/Melbourne, Sunday week start, preferred daily capacity, settings version and update timestamp. |
| commitments | User owns many commitments. Store title, category, status, lock, location, notes, start/end instants, before/after travel and preparation minutes. For a series retain original local start, end and zone. |
| recurrence_rules and exceptions | At most one validated rule per series. Each exception identifies its series and original local occurrence, including offset choice for ambiguous times. Allow cancellation or replacement times. Enforce unique occurrence keys per series. |
| availability_rules | User, weekday selection or one-off date, zone, local time window, end-day offset and protected category. An overnight rule explicitly ends the next day. |
| task_templates and task_instances | Template stores demand, frequency, priority, preferences and split policy. Each instance snapshots that session's constraints, release, deadline, target minutes and status. Unique (user, template, local week start, ordinal) for generated instances. One-off instances may omit the template. Archive templates referenced by history. |
| routines and routine_occurrences | Rule stores frequency, checklist or reserved mode, target and preferred window. Occurrence has unique (user, routine, occurrence key), local date and completion/skip status. Only reserved occurrences link to a task instance. |
| planning_state and schedule_revisions | One planning input version per user, initially sufficient for a private planner. Each revision belongs to a user and week, records its base input version, parent accepted revision, status, reason and timestamp. |
| revision_changes and planned_blocks | Change rows identify preserved, moved, added or displaced sessions with before/after spans and reasons. Live blocks link to one task instance and the revision that last changed them. One session can have several numbered chunks. Keep lock and source on the block. |
| task_completions | One session completion per instance with completed_at, optional actual minutes and notes. Track chunk progress separately when needed. Moving blocks never removes a completion. |
| courses, assignments, publication_projects and stages | A course has assignments and a project has ordered stages. Study and publication tasks link to these records. Derive progress from their instances and completions. |

Use same-owner composite foreign keys on child relationships, unique (user_id, id) keys on parents, checks for end after start and nonnegative buffers, and indexes on owner plus week, due date or time range. Enforce no overlap among live flexible blocks for an owner with a half-open range exclusion constraint. Conflicting user-entered fixed facts must both be representable so the user can resolve them.

Enable RLS in the migration that creates each exposed table. Grant only required operations to authenticated users. Apply auth.uid() = user_id for reading or changing existing rows and for checking inserted or updated rows. Derive ownership on the server and enforce it again in the database. Anonymous requests receive no private data. Test direct API access as two ordinary users.

## Atomic changes

All planning-affecting writes acquire the user's planning_state lock and increment its version. Accept within one database transaction. Verify the caller owns the proposal, check its status, version and parent, recheck hard constraints, apply the diff, append history and advance the version. Returning the already-accepted result makes retries safe. A stale proposal returns a conflict and can be regenerated. Rejection changes proposal status only. Undo creates a compensating revision after checking current commitments and completions. If undo would introduce a conflict, show the blocked changes for review.

Apply versioned SQL migrations to a disposable local database before a shared environment. Use additive changes and explicit backfills. Restrict deletes where history depends on a parent. Test reconstruction from migrations, ownership, foreign keys, stale and repeated acceptance, and rollback on failure.

## Implemented Phase 2 schema

The manual workflow currently uses planner_items for commitments, flexible sessions, routines and protected blocks, with task_templates and occurrence_changes as related tables. This is the working schema for Phase 2. The separate revision and proposed-block relations above remain the design for Phases 3 and 4. A template session is uniquely identified by owner, template, planning week and ordinal. Occurrence changes use owner, item and original local occurrence date. Database functions validate ownership and locks and preserve unrelated exception fields during updates.

## Phase 3 persistence

schedule_proposals stores owner, week, zone and creation time. proposal_entries stores one proposed chunk or unallocated task per row, with same-owner foreign keys to the proposal and task. save_proposal writes both relations in one transaction under the caller's RLS policies. The application recomputes proposals server-side before saving. These immutable review snapshots cannot directly mutate the accepted calendar. Phase 4 must validate current constraints and input versions before applying any snapshot.

## Phase 4 verified implementation

The additive [revision migration](../supabase/migrations/202611230005_revisions.sql) implements owner-scoped schedule_slots (task, occurrence key, chunk ordinal and timestamps), revision_before (prior rows for each affected session) and append-only revision_events. A zero-ordinal null span records displaced demand without deleting the task. Review entries retain explicit before spans. Prior-row JSON is restricted to one session's inverse change; the live calendar and proposed chunks remain relational.

read_planning returns inputs and their fingerprint from one MVCC snapshot. Planning mutations acquire a per-user advisory transaction lock; decide_revision serializes with them and compares the fingerprint before acceptance. This replaces the proposed integer-version approach. Mutable planning input includes profiles, active activities, occurrence changes and live slots. Completion and manual movement invalidate pending proposals. Old save_proposal snapshots remain review-only. Direct proposal/slot/audit writes are revoked, with authenticated owner-checking RPCs supplying mutations.

Undo restores prior slot rows atomically and appends an `undone` event. Accepted and undone timestamps remain separate audit records. It conservatively rejects any intervening input change and independently rejects restored overlaps. It does not erase the roster shift or completion history. The additive migration and real-account ownership, retry, stale approval, rollback, split completion and safe undo checks passed against local Postgres on 23 November 2026; see the [development plan](DEVELOPMENT_PLAN.md).

## Progress and backup schema

Migration 202611230006_progress.sql adds owner-scoped workstreams and screen_time, same-owner task-to-project relationships, publication stage labels, completion timestamps and optimistic versions for project/journal edits. Existing completed records are not assigned invented historical timestamps. Completion changes stamp the current server instant; reopening clears it, and unrelated edits preserve it.

Migration 202611230007_backup.sql adds authenticated export_backup and additive restore_backup RPCs. Export reads the owner's relations in one MVCC statement, including archived history. Restore validates the backup format, account ID, all row ownership and nested inverse-revision ownership, then inserts missing records in dependency order inside one transaction. There is no delete or overwrite operation. Profiles are exported but deliberately not restored over current preferences.

Migration 202611240008_restore_idempotency.sql filters existing primary keys before insertion triggers run. This prevents existing locked activities or accepted occurrence overlays from causing a no-op restore to fail. Foreign keys and validation triggers still check newly inserted records. The real-account suite compares the full exported data before and after restoring the complete backup twice, and verifies rollback when a later relation contains a foreign owner.
