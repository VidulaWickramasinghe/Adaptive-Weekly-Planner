MASTER PROJECT SPECIFICATION
Adaptive Weekly Planner — Personal Scheduling & Time Management System
Document type: Software Requirements Specification (SRS) and Development Instructions
Intended developer: OpenAI Codex
Project status: Initial development
Target platforms: Web, macOS browser, iPhone browser and installable Progressive Web App (PWA)
Default time zone: Australia/Melbourne
Planning week: Sunday 00:00 to the following Sunday 00:00 (exclusive)

1. Developer Instructions
You are acting as a senior full-stack software engineer, solution architect, UI/UX designer, database designer, and quality assurance engineer.

Your objective is to plan, develop, test, and document a professional personal scheduling application.

Read this entire specification before implementation.

Follow these rules:

Understand the intended workflows and functional requirements before writing code.

Inspect the existing project repository, if any, before modifying files.

Preserve existing code and user data unless a change is explicitly approved.

Begin with a technical architecture assessment and phased development plan.

Create a maintainable, modular architecture rather than placing all application logic inside UI components.

Use TypeScript with strong typing and proper validation.

Keep scheduling calculations independent from the database, UI, and external services.

Develop functionality in small, testable milestones.

Run appropriate tests and fix identified issues before declaring each milestone complete.

Document important implementation decisions and any deviations from this specification.

Do not claim a feature is implemented unless it has been implemented and verified.

Do not create placeholder controls that appear functional but perform no action.

Do not require AI services for scheduling or basic application functions.

Ask for approval before irreversible data deletion, destructive migrations, paid services, or production deployment.

Initial instruction: First inspect the repository, identify the existing environment, produce the architecture and implementation plan, and present the proposed Phase 1 work. Do not immediately attempt to implement the entire application in one unreviewed change.

2. Project Overview
2.1 Problem statement
The user is a university student working in casual part-time employment.

Their weekly working hours can change, making traditional fixed daily timetables impractical.

They must manage several categories of commitments:

Casual employment and changing work rosters.

University lectures and academic responsibilities.

Confirmed events, bookings, appointments, and reservations.

University assignments and deadlines.

Independent study and online learning.

Library study sessions.

Research, writing, editing, and publication.

Reading books and academic journals.

Personal journaling.

Social media and recreational screen time.

Rest, travel, meals, and personal responsibilities.

Most traditional calendar applications depend on manually placing events into specific time slots.

This application must provide a more adaptive approach.

2.2 Proposed solution
Develop a personal scheduling platform that:

Records confirmed weekly commitments.

Calculates usable free time around those commitments.

Manages flexible duties independently of fixed commitments.

Automatically suggests suitable time slots for flexible duties.

Balances workloads throughout the week.

Prioritises important tasks and deadlines.

Adapts when work shifts or other commitments change.

Preserves existing schedules wherever possible.

Allows the user to review and approve changes.

Tracks task completion and weekly progress.

The objective is to reduce unnecessary manual timetable administration while maintaining realistic, manageable daily schedules.

3. Fundamental Scheduling Principles
3.1 Weekly planning cycle
The scheduling week starts on Sunday and ends on Saturday.

The system must support:

Current week.

Next week.

Previous weeks.

Custom date navigation.

Recurring weekly activities.

Planning ahead for future weeks.

Incomplete and completed tasks.

Changes to existing schedules.

Use the user's configured time zone to determine local calendar boundaries.

The application must not assume that every week contains exactly 168 elapsed hours because daylight-saving transitions may occur.

3.2 Fixed commitments take precedence
Confirmed commitments should be entered before flexible activities.

Examples include:

Work: Monday, 2:00 PM–10:00 PM.

University lecture: Tuesday, 9:00 AM–12:00 PM.

Doctor's appointment: Friday, 11:00 AM.

Reserved event: Saturday, 7:00 PM.

These examples are illustrative and must not become permanent application defaults.

Fixed commitments can be:

One-time.

Recurring.

Confirmed.

Tentative.

Cancelled.

Confirmed commitments must never be automatically moved by the scheduling engine without explicit user approval.

3.3 Flexible tasks occupy remaining suitable time
The scheduler must calculate the actual available time after accounting for:

Confirmed commitments.

Travel buffers.

Protected sleep hours.

Meal breaks.

User-defined unavailable periods.

Planned recovery periods.

Existing locked activities.

It must not mark an entire day unavailable merely because a work shift or lecture occurs on that day.

For example, working from 1:00 PM to 7:00 PM does not automatically make the morning unavailable.

However, available time must also be checked against sleep, travel, minimum session lengths, energy preferences, and other restrictions.

3.4 Tasks should not require fixed clock times unless necessary
Examples:

Social media: 30–45 minutes total per day.

Reading: 20 minutes on selected days.

Journaling: 10 minutes daily.

Academic study: three 90-minute sessions per week.

Publication: two 60-minute sessions per week.

These should initially be treated as flexible activity targets.

A scheduled routine can later become time-specific if the user chooses.

3.5 Balanced scheduling
The system should distribute activities across the week instead of overcrowding one day.

It must consider:

Daily workload.

Working hours.

Academic commitments.

Deadlines.

Available time.

User-defined energy preferences.

Preferred study periods.

Maximum planned hours per day.

Minimum rest periods.

Activity frequency.

Activity spacing.

If the requested workload cannot fit, the system must explain the problem and identify unscheduled activities.

Never silently delete or ignore tasks.

4. Activity Classification
The application must support the following activity types.

Type A — Fixed commitments
Examples:

Employment shifts.

University lectures.

Reserved appointments.

Confirmed meetings.

Booked library rooms.

Personal events.

Fields:

Title.

Description.

Category.

Start date and time.

End date and time.

Time zone.

Location (optional).

Recurrence rule.

Recurrence exceptions.

Confirmation status.

Travel buffer.

Preparation buffer.

Notes.

Lock status.

Type B — Flexible tasks
Examples:

Independent study.

Research.

Reading.

Publication writing.

Editing.

Learning new technical skills.

Revision.

Fields:

Task title.

Category.

Description.

Estimated duration.

Required number of sessions per week.

Preferred days.

Earliest allowed date.

Due date (optional).

Priority.

Minimum session duration.

Whether splitting is allowed.

Preferred time of day.

Energy requirement.

Completion status.

A deadline is a property of a task, not a separate scheduling category. Flexible tasks may have hard deadlines.

Type C — Daily routines
Examples:

Personal journaling.

Reading.

Daily planning.

Social media checks.

Short learning sessions.

Fields:

Routine name.

Daily or weekly recurrence.

Target duration.

Mandatory or optional status.

Preferred window.

Whether a calendar reservation is required.

Completion tracking.

Daily routines should support a checklist-only mode without occupying a fixed calendar slot.

Type D — Protected time
Examples:

Sleep.

Meals.

Commute.

Recovery.

Personal time.

Unavailable hours.

Protected time must be considered during availability calculations.

5. Main Application Modules
Module 1 — Dashboard
Create a central dashboard displaying:

Current date.

Current planning week.

Today's confirmed commitments.

Today's flexible activities.

Upcoming deadlines.

Daily planned workload.

Completed tasks.

Unscheduled tasks.

Weekly progress.

Scheduling conflicts.

Next recommended activity.

The dashboard must work well on both desktop and mobile devices.

Module 2 — Weekly Calendar
Create a Sunday–Saturday calendar interface.

Required views:

Weekly view.

Daily view.

Monthly view.

Agenda/list view.

Required features:

Visually distinguish fixed, flexible, and protected blocks.

Display event start/end times.

Create events.

Edit events.

Move flexible activities.

Resize activity durations.

Inspect event details.

Navigate between weeks.

Show conflicts.

Highlight the current day.

Display available time.

Support recurring events.

Provide both drag-and-drop and accessible form-based editing.

Prevent users from accidentally moving locked commitments.

Module 3 — Fixed Commitment Manager
Allow the user to create and manage:

Casual work shifts.

Repeating lectures.

Bookings.

Appointments.

Meetings.

Other confirmed commitments.

The user should be able to:

Enter a single work shift.

Enter multiple shifts for the week.

Duplicate shifts.

Mark shifts tentative or confirmed.

Modify shift times.

Cancel a shift.

Add travel or preparation buffers.

Review existing recurring commitments.

A changed work shift should trigger a scheduling-conflict check.

Module 4 — Flexible Task Manager
Create a separate task pool for activities not yet assigned a time.

The user must be able to:

Create tasks.

Create reusable task templates.

Set weekly frequency targets.

Set estimated duration.

Assign priorities.

Add due dates.

Define preferred days and times.

Mark tasks completed.

Postpone tasks.

Delete tasks with confirmation.

Split eligible tasks into smaller sessions.

Review overdue tasks.

View tasks that have not been scheduled.

Example task templates:

University Study

Duration: 90 minutes.

Frequency: 3 sessions/week.

Priority: High.

Splitting: Optional.

Publication

Duration: 60 minutes.

Frequency: 2 sessions/week.

Priority: Medium.

Splitting: Optional.

Reading

Duration: 20 minutes.

Frequency: 5 sessions/week.

Priority: Low.

Personal Journal

Duration: 10 minutes.

Frequency: Daily.

Timing: Flexible.

Do not hard-code these templates as mandatory activities. Users must be able to modify or remove them.

Module 5 — Scheduling Engine
Create a standalone scheduling engine responsible for:

Reading fixed events.

Expanding recurrence rules into the target planning period.

Reading existing protected periods.

Calculating available time intervals.

Retrieving unscheduled task instances.

Applying hard scheduling constraints.

Ranking feasible task placements.

Distributing tasks across the week.

Producing a proposed timetable.

Identifying unallocated tasks.

Providing understandable reasons for scheduling decisions.

The scheduling engine must be testable without rendering the user interface or connecting to Supabase.

Module 6 — Automatic Rescheduling
When a new commitment conflicts with existing activities:

Detect the conflict.

Determine which scheduled activities are fixed or locked.

Preserve the fixed activities.

Find alternate placements for affected flexible activities.

Minimise disruption to unaffected activities.

Produce a proposed revised timetable.

Explain which activities will move.

Allow the user to approve or reject the proposal.

Preserve an undoable schedule revision.

Mark tasks as unscheduled if no valid placement is possible.

The system must never silently move a confirmed appointment.

Module 7 — Daily Routine Manager
Allow the user to manage simple recurring activities.

Support:

Daily routines.

Selected weekdays.

Weekly frequency.

Flexible completion windows.

Completion checklists.

Daily progress.

Skipped days.

Optional reminders.

Daily routines may be completed without being assigned an exact calendar time.

Module 8 — Study Management
Provide study-specific activity features:

Subject or course association.

Assignment association.

Study session targets.

Online or offline study.

Library study activities.

Upcoming assessment deadlines.

Completed study sessions.

Weekly learning progress.

This is not a full Learning Management System.

The focus is managing study time and academic deadlines.

Module 9 — Publication Management
Support the user's article-production workflow.

A publication project may contain stages such as:

Topic selection.

Research.

Source collection.

Drafting.

Editing.

Fact-checking.

Proofreading.

Publication.

Each stage can become a task with its own duration, priority, deadline, and completion status.

The system should allow flexible scheduling of these stages across multiple days.

It is not necessary to build a full article editor in the initial release.

Module 10 — Digital Wellbeing
Provide personal screen-time planning features.

Examples:

Social media daily target.

Recreational screen-time allowance.

Intended checking frequency.

Study focus sessions.

Screen breaks.

Daily digital habits.

Weekly wellbeing review.

Important limitations:

Do not claim access to actual iOS or macOS Screen Time statistics without an authorised integration.

Do not claim to block third-party social media applications from an ordinary web application.

Initially use user-entered targets and manual completion tracking.

Keep productive screen time separate from recreational screen time.

Avoid inflexible social media appointments unless explicitly requested.

6. Scheduling Engine — Detailed Behaviour
6.1 Required inputs
The engine should accept:

User time zone.

Target week start and end.

Fixed commitments.

Recurring commitments and exceptions.

Protected availability periods.

Existing scheduled blocks.

Task instances.

Task priorities.

Task deadlines.

Preferred activity times.

User workload preferences.

Planning constraints.

6.2 Hard constraints
The engine must never produce a proposed schedule that violates the following rules:

No overlap with confirmed fixed commitments.

No overlap with protected sleep or unavailable periods.

No overlapping planned activities for the same user.

No activity outside its permitted date range.

No task placed after a hard deadline.

No invalid or negative-duration sessions.

No tasks placed outside the configured planning period unless a separate future-planning operation permits this.

No modification of completed or locked activities.

No unsupported split below the minimum session duration.

No splitting of tasks when splitting is disabled.

No scheduling that ignores required travel buffers.

Apply a consistent half-open interval model: a time block ending at 10:00 AM does not conflict with another starting at exactly 10:00 AM.

6.3 Soft preferences
Among valid placements, prefer those that:

Meet important deadlines early.

Match user-selected preferred days.

Match preferred morning, afternoon, or evening periods.

Maintain balanced daily workloads.

Distribute repeated sessions across suitable days.

Respect energy preferences.

Avoid unnecessarily fragmented schedules.

Preserve existing allocations.

Leave useful buffer time between activities.

Soft preferences must not override hard constraints.

6.4 Priority rules
Suggested default hierarchy:

Confirmed fixed commitments.

Protected time and hard scheduling restrictions.

Tasks with approaching hard deadlines.

High-priority academic or other essential tasks.

Recurring flexible tasks with weekly targets.

Medium-priority activities.

Low-priority and optional activities.

Within eligible tasks, use a documented deterministic scoring and tie-breaking strategy.

The algorithm should not simply schedule every high-priority task on Sunday.

It must account for available capacity and reasonable workload distribution.

6.5 Weekly target management
A weekly target such as "3 × 60-minute study sessions" must produce three distinct session instances.

Track:

Planned sessions.

Completed sessions.

Missed sessions.

Remaining sessions.

Unscheduled sessions.

Do not duplicate session instances when the user regenerates the same weekly schedule.

If splitting is enabled, allow smaller blocks only when they satisfy the configured minimum duration and preserve the required total planned time.

6.6 Scheduling outcomes
The engine should return:

Proposed scheduled blocks.

Existing blocks preserved.

Blocks proposed for relocation.

Unscheduled task instances.

Scheduling conflict descriptions.

Reasons a task cannot fit.

Summary of total planned time.

Summary of available usable time.

Explanation of relevant scheduling decisions.

Use typed result objects rather than returning only calendar display data.

6.7 Weekly capacity
The system must distinguish:

Total calendar hours.

Fixed-commitment hours.

Protected or unavailable hours.

Usable flexible hours.

Planned flexible hours.

Remaining usable hours.

Overlapping protected periods should not be double-counted.

6.8 Rescheduling strategy
Use a minimal-disruption approach.

When a new shift is entered:

Identify only directly affected flexible blocks first.

Retain unrelated blocks unless moving them is necessary to satisfy a higher-priority constraint.

Evaluate available replacement slots.

Prefer placements with lower disruption scores.

Produce a change preview.

Obtain confirmation.

Save the accepted revision transactionally.

Never erase task history when rescheduling.

6.9 Important edge cases
Handle:

Overnight work shifts.

Consecutive shifts.

Last-minute roster changes.

Cancelled lectures.

Overlapping tentative appointments.

Multiple deadlines on one day.

No free time remaining.

Incomplete tasks crossing into the next week.

Tasks requiring multiple sessions.

A task completed ahead of schedule.

A task manually moved by the user.

Recurring events that have exceptions.

Travel buffers across midnight.

Events across month or year boundaries.

Melbourne daylight-saving transitions.

Changes to the user's configured time zone.

Different devices editing the schedule.

7. User Interface and Experience
7.1 General design
Create a professional, minimal, modern productivity interface.

Visual characteristics:

Clean typography.

Clearly separated sections.

Consistent spacing.

Subtle colour coding.

Light and dark themes.

Accessible contrast.

Responsive layouts.

Minimal visual clutter.

Clear navigation.

Readable calendar events.

Professional dashboard metrics.

Avoid unnecessary animations, excessive gradients, and visually noisy dashboards.

7.2 Main navigation
Desktop sidebar:

Dashboard

Today

Weekly Planner

Calendar

Tasks

Study

Publications

Routines

Progress

Settings

Mobile navigation:

Today

Week

Tasks

Add

More

The mobile interface must not rely exclusively on drag-and-drop interactions.

7.3 Today page
Display:

Today's date.

Current or next commitment.

Important deadlines.

Scheduled activities.

Flexible tasks available today.

Daily routine checklist.

Completed activities.

Remaining planned workload.

Allow quick task completion, postponement, and manual rescheduling.

7.4 Weekly Planner page
Display:

Sunday–Saturday columns.

Confirmed commitments.

Flexible sessions.

Available time.

Conflicts.

Unscheduled task pool.

Weekly workload summary.

Generate Schedule action.

Review Changes action.

7.5 Task creation
Provide a practical form for adding tasks.

Allow the user to create a simple task quickly, while keeping advanced scheduling controls available when needed.

Use form validation and helpful errors.

7.6 Onboarding
When the user first opens the application:

Create or sign in to a private account.

Confirm the time zone.

Configure preferred waking/sleeping or unavailable hours.

Set Sunday as the weekly start.

Add recurring lectures or other commitments.

Add known work shifts.

Choose flexible task templates.

Configure weekly workload targets.

Generate the first weekly planning proposal.

Review and confirm the proposal.

All onboarding values must remain editable.

8. Technical Architecture
8.1 Preferred technology
Frontend:

Next.js with App Router.

React.

TypeScript.

Tailwind CSS.

Calendar:

FullCalendar React integration, subject to compatibility and licence verification.

Backend:

Next.js server-side functionality and validated application services.

Avoid unnecessary microservices.

Database:

PostgreSQL through Supabase.

Authentication:

Supabase Auth.

Validation:

Zod or an equivalent strongly typed validation solution.

Testing:

Vitest for unit and domain tests.

React Testing Library for component tests.

Playwright for browser-based end-to-end tests.

Offline functionality:

IndexedDB for local caching.

Explicitly designed synchronisation behaviour.

Installable experience:

Progressive Web App support.

Use actively maintained compatible package versions and document major dependency decisions.

8.2 Architecture principles
Separate the system into:

Presentation layer.

Application services.

Scheduling domain engine.

Persistence interfaces.

Database implementation.

External integration adapters.

The scheduling engine must not directly depend on React components or Supabase SDK calls.

Avoid tightly coupling business rules to calendar visualisation libraries.

Create reusable domain models, validation schemas and service interfaces.

9. Data Model
Design a relational database supporting at least the following conceptual entities.

UserProfile
id

user_id

timezone

week_start_day

preferred_daily_capacity

preferences

created_at

updated_at

Commitment
id

user_id

title

description

category

start_at

end_at

timezone

location

status

locked

recurrence_rule

recurrence_exceptions

travel_buffer_before

travel_buffer_after

created_at

updated_at

TaskTemplate
id

user_id

name

category

description

default_duration

sessions_per_week

priority

preferred_days

preferred_time_window

minimum_session_duration

can_split

active

TaskInstance
id

user_id

template_id (optional)

title

planning_week

duration

earliest_start

due_at

priority

status

completion_timestamp

created_at

updated_at

PlannedBlock
id

user_id

task_instance_id

start_at

end_at

status

locked

source

schedule_revision_id

AvailabilityRule
id

user_id

rule_type

days_of_week

start_local_time

end_local_time

timezone

recurrence_details

ScheduleRevision
id

user_id

target_week

creation_timestamp

reason

status

change_summary

previous_revision_id

TaskCompletion
id

user_id

task_instance_id

completed_at

actual_duration (optional)

notes (optional)

These are conceptual models. Refine them during database design, including normalised recurrence rules and session-level completion tracking as appropriate.

Requirements:

Use stable identifiers.

Maintain proper foreign keys.

Prevent orphaned records.

Keep user data isolated.

Avoid duplicate weekly task creation.

Add appropriate indexes.

Use migrations.

Preserve historical completion records.

Use timezone-aware timestamps.

Prevent duplicate acceptance of scheduling revisions.

Do not store an entire complex schedule as one opaque JSON field if relational storage is more appropriate.

10. Authentication, Security and Privacy
The application will contain personal scheduling information, including work commitments and locations.

Security requirements:

Private user authentication.

Enforced ownership of each record.

PostgreSQL Row Level Security on user-owned tables.

Server-side validation for changes.

No unauthorised cross-user data access.

No service-role credentials exposed to the browser.

No credentials committed to Git.

Safe environment variable handling.

Secure session handling.

Appropriate protection against common web vulnerabilities.

Controlled logging without unnecessary personal data.

Confirmation before destructive operations.

Export and backup options.

Tests verifying user-data isolation.

Provide an .env.example file with placeholder values only.

Do not upload private calendar data to AI services.

11. Synchronisation and Offline Behaviour
The application must eventually support a consistent schedule across MacBook and iPhone.

Requirements:

Authenticated cloud synchronisation.

Device-independent schedule data.

Clear loading and error states.

Conflict-safe updates.

Local caching for faster access.

Explicit offline indicators.

Backup and restore.

For the initial release, prioritise reliable online synchronisation.

If offline writes are introduced, design a durable mutation queue, retry handling, idempotent operations and conflict resolution.

Do not claim full offline editing support until it is implemented and tested.

External calendar integrations are not required for the initial milestone.

12. Notification System
Support a later notification module for:

Upcoming fixed events.

Study-session reminders.

Important deadlines.

Daily planning reminders.

Rescheduling proposals.

Weekly review reminders.

Notifications must be optional.

Do not assume browser notifications or push messaging will always be available, especially on mobile devices.

Provide in-app notifications as the baseline functionality.

13. Progress Tracking and Analytics
Track:

Weekly planned hours.

Weekly completed hours.

Completed task sessions.

Missed task sessions.

Study target achievement.

Publication progress.

Routine completion.

Unscheduled workload.

Schedule changes.

Workload distribution.

Metrics must be calculated from actual task and scheduling records.

Do not fabricate statistics.

The purpose is practical personal planning, not surveillance or productivity scoring.

14. Development Phases
Phase 0 — Repository assessment and planning
Tasks:

Inspect the project directory.

Detect existing technologies and dependencies.

Check Git repository status.

Review any existing instructions.

Document architectural choices.

Define the database schema.

Design scheduling domain types.

Define development milestones.

Identify implementation risks.

Produce the Phase 1 execution plan.

Deliverables:

Architecture document.

Development roadmap.

Database design.

Initial interface structure.

Test strategy.

Updated project instructions.

Phase 1 — Foundation
Implement:

Next.js project setup.

TypeScript configuration.

Tailwind CSS.

Application layout.

Responsive navigation.

Authentication.

User settings.

Supabase database configuration.

Database migrations.

Data access layer.

Basic dashboard.

Acceptance criteria:

Application starts locally.

Authentication works.

Database connections work.

Private user data is isolated.

Desktop and mobile layouts render correctly.

Foundation tests pass.

Phase 2 — Calendar and Task Management
Implement:

Sunday–Saturday calendar.

Fixed commitment creation.

Recurring events.

Work shift management.

Flexible task creation.

Task templates.

Daily routines.

Manual task scheduling.

Task completion.

Unscheduled task pool.

Acceptance criteria:

Work shifts can be created and edited.

Recurring lectures display correctly.

Tasks can be created and completed.

Calendar navigation works.

Existing data persists after reload.

Overlapping commitments produce visible warnings.

Phase 3 — Scheduling Engine
Implement:

Recurrence expansion.

Availability calculations.

Hard constraints.

Task priority rules.

Weekly session generation.

Workload distribution.

Scheduling proposals.

Unscheduled task reporting.

Conflict detection.

Acceptance criteria:

No invalid overlap is generated.

Weekly task targets are respected.

Protected time remains unavailable.

Deadlines are considered.

Scheduling is deterministic for identical inputs.

The engine handles infeasible schedules honestly.

All scheduling unit tests pass.

Phase 4 — Adaptive Rescheduling
Implement:

Detection of changed commitments.

Recalculation of affected blocks.

Minimal-disruption rescheduling.

Change preview.

Approval/rejection.

Undo support.

Schedule revision history.

Overdue and displaced task handling.

Acceptance criteria:

A new work shift triggers conflict detection.

Fixed commitments remain protected.

Affected flexible tasks are proposed for relocation.

Unaffected tasks remain stable where possible.

Rejected proposals do not change the current schedule.

Accepted proposals persist correctly.

Undo restores the previous valid revision.

Phase 5 — Daily Experience and Progress
Implement:

Today dashboard.

Routine checklist.

Study activity tracking.

Publication workflow tracking.

Daily progress indicators.

Weekly review.

Scheduling preference settings.

Workload summaries.

Acceptance criteria:

Daily progress reflects actual records.

Task completion does not create duplicate sessions.

Study and publication progress remain consistent.

The weekly review is accurate.

Phase 6 — Production Readiness
Implement:

PWA installation support.

Improved mobile layout.

Accessibility improvements.

Error handling.

Responsive performance.

Backup/export.

Synchronisation reliability.

Security testing.

End-to-end testing.

Deployment documentation.

Acceptance criteria:

Application works on current desktop and mobile browsers.

User data synchronises correctly when online.

Security controls are tested.

No critical broken interface controls remain.

Deployment instructions are reproducible.

Known limitations are documented.

Phase 7 — Future Enhancements
Potential later additions:

Google Calendar integration.

Apple-compatible calendar import/export.

Calendar subscription support.

Advanced scheduling optimisation.

User-defined scheduling rules.

More detailed analytics.

Native macOS and iOS applications.

Extended offline functionality.

Enhanced notifications.

Optional AI-based planning assistance.

Do not implement these at the expense of completing the essential scheduling workflow.

15. Mandatory Test Scenarios
The scheduling engine must be verified against at least the following scenarios.

Test 1 — Basic weekly planning

Given three fixed events and five flexible tasks, the system generates a schedule without overlapping the fixed events.

Test 2 — New casual shift

Given a study session scheduled on Wednesday afternoon, adding a confirmed overlapping work shift must trigger a revised study placement proposal or an unscheduled warning.

Test 3 — No available capacity

When all suitable scheduling periods are occupied, the system must report the task as unscheduled and identify why.

Test 4 — Deadline priority

A high-priority assignment due Thursday must not be scheduled after Thursday's deadline.

Test 5 — Workload balance

When multiple comparable free days exist, the engine should avoid concentrating all flexible tasks on one day without justification.

Test 6 — Routine completion

Marking a daily journal routine complete must not remove the task template or corrupt future recurring instances.

Test 7 — Overnight shifts

A shift crossing midnight must reserve the correct time across both calendar dates.

Test 8 — Daylight-saving transition

Time calculations in Australia/Melbourne must correctly account for daylight-saving changes.

Test 9 — Repeated schedule generation

Generating the same week repeatedly must not create duplicate tasks or duplicate blocks.

Test 10 — Manual changes

A manually locked study session must be retained unless the user explicitly changes it.

Test 11 — Schedule approval

Rejecting a rescheduling proposal must leave the accepted calendar unchanged.

Test 12 — User-data isolation

One authenticated user must not be able to read or modify another user's schedule.

Test 13 — Cross-device persistence

An accepted schedule change must be retrievable from a second authenticated device.

Test 14 — Invalid recurrence

Malformed recurrence rules must be rejected safely without producing an infinite expansion loop.

Test 15 — Task splitting

A task that cannot be split must remain a single valid session. A splittable task must respect its minimum chunk size and total target duration.

16. Quality Requirements
Functional correctness
Prioritise correctness over appearance.

The software must not silently overwrite calendar records, lose tasks, or generate conflicting plans.

Performance
Scheduling should be responsive for normal personal workloads.

Avoid unnecessary database requests and repeated full-calendar recalculations.

Maintainability
Use:

Clear component boundaries.

Strong TypeScript types.

Reusable validation schemas.

Modular domain services.

Meaningful file names.

Automated tests.

Documented architecture decisions.

Accessibility
Provide:

Keyboard-accessible controls.

Proper form labels.

Readable contrast.

Visible focus indicators.

Text alternatives for visual statuses.

Mobile-friendly touch controls.

Reliability
Handle:

Network interruptions.

Database failures.

Invalid input.

Expired sessions.

Conflicting updates.

Missing configuration.

Unexpected empty states.

Never display a false success state after a failed save.

17. Recommended Repository Structure
Use the existing repository conventions where appropriate. For a new project, consider:

adaptive-weekly-planner/
├── src/
│   ├── app/
│   ├── components/
│   │   ├── calendar/
│   │   ├── dashboard/
│   │   ├── tasks/
│   │   ├── routines/
│   │   └── shared/
│   ├── features/
│   │   ├── commitments/
│   │   ├── tasks/
│   │   ├── planning/
│   │   └── progress/
│   ├── domain/
│   │   ├── scheduling/
│   │   ├── models/
│   │   └── rules/
│   ├── services/
│   ├── repositories/
│   ├── lib/
│   └── types/
├── supabase/
│   └── migrations/
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── docs/
│   ├── ARCHITECTURE.md
│   ├── PROJECT_SPEC.md
│   ├── DATABASE.md
│   ├── SCHEDULING_ENGINE.md
│   └── DEVELOPMENT_PLAN.md
├── public/
├── AGENTS.md
├── README.md
├── .env.example
└── package.json
Adapt this structure if a different arrangement improves maintainability.

18. Documentation Requirements
Maintain the following documents:

README.md

Project overview.

Prerequisites.

Installation instructions.

Environment configuration.

Development commands.

Test commands.

Deployment information.

docs/ARCHITECTURE.md

Overall architecture.

Application modules.

Technology decisions.

Data flow.

Major dependencies.

docs/DATABASE.md

Database schema.

Table relationships.

Migration strategy.

Security policies.

docs/SCHEDULING_ENGINE.md

Scheduling inputs and outputs.

Constraints.

Scoring system.

Conflict resolution.

Recurrence handling.

Test scenarios.

docs/DEVELOPMENT_PLAN.md

Milestones.

Completed features.

Remaining work.

Known issues.

Implementation decisions.

AGENTS.md

Repository-specific coding standards.

Architecture boundaries.

Testing requirements.

Commands required before completing changes.

Security rules.

How Codex should use the project documentation.

Keep documentation aligned with the actual implementation.

19. Development Workflow for Codex
For each phase:

Read the master project specification.

Read applicable repository instructions.

Inspect relevant existing implementation files.

Identify the phase's acceptance criteria.

Produce a concise implementation plan.

Implement the smallest complete vertical slice.

Add or update automated tests.

Run linting, type checking, and tests.

Fix any discovered issues.

Review the implementation for security and regressions.

Update relevant documentation.

Summarise what was implemented.

Identify outstanding limitations.

Explain what should be built next.

Do not mark incomplete work as finished.

Before beginning a later phase, verify that its prerequisite features work.

Do not introduce unnecessary architectural complexity.

20. Final Acceptance Criteria
The initial application is complete when the user can:

Sign in privately.

Open a Sunday–Saturday weekly calendar.

Enter casual work shifts.

Add recurring university lectures.

Create fixed appointments.

Create flexible activities.

Set weekly study and publication goals.

Configure personal routines.

Generate a valid proposed weekly timetable.

Review and accept scheduling proposals.

Add or modify a work shift.

Receive a conflict warning.

Reschedule affected flexible activities.

Preserve confirmed commitments.

Complete daily tasks.

Review weekly progress.

Access their saved schedule on MacBook and iPhone.

Export or back up their planning data.

All critical functionality must have appropriate automated tests.

21. Immediate Task for Codex
Do not attempt to write the complete application immediately.

Start with Phase 0.

Perform the following:

Inspect the current repository or establish that the project is new.

Summarise your understanding of the software.

Identify any major technical risks or architectural inconsistencies.

Recommend the final architecture.

Define the core scheduling domain models.

Design the database relationships.

Propose the main interface layout.

Prepare a practical milestone-based development plan.

Define the Phase 1 acceptance tests.

Explain which files will be created or modified.

Identify any credentials or external configuration the developer must provide.

Present the plan for approval before implementing Phase 1.

Use the specification above as the project requirements baseline.

The finished product should provide a flexible, dependable, secure, and user-friendly personal scheduling system that adapts to the user's real-life commitments rather than forcing the user to follow a rigid daily timetable.
