# Working in this repository

Read docs/PROJECT_SPEC.md for requirements, docs/DEVELOPMENT_PLAN.md for the current approved scope, and the architecture, database and scheduling documents for proposed decisions. Phases 1 through 4 are complete and verified locally, including schedule proposals, approval, conflict rescheduling and conservative undo. Review the development plan before advancing to Phase 5. Record subsequent decisions and verified progress in the plan.

Build one usable slice at a time in strict TypeScript. Keep time arithmetic and scheduling in the domain layer. Inject the planning instant and zone. Keep authentication, persistence and calendar rendering outside that layer. Use real empty states and accessible editing forms.

Validate writes on the server, use the authenticated user's identity and enforce ownership in Postgres. Keep credentials, personal calendars and identifiable fixtures out of Git, logs and AI services. Ask before destructive migrations, irreversible deletion, paid services or production deployment.

For code changes run the phase's documented lint, typecheck, unit, integration and relevant browser checks. Report the commands actually run, outcomes and gaps. Never substitute mocked users for the database isolation test. For documentation changes, verify repository links and distinguish proposals from shipped behavior.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
