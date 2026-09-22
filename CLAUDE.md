# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

Not a monorepo/workspace — three independent apps sharing one Postgres database and one REST contract:

- `backend/` — Express 5 + TypeScript + Prisma ORM API (port 4000)
- `web/` — Next.js 14 (App Router) admin panel (port 3000)
- `mobile/` — Flutter app, talks to the same backend REST API directly
- `docker-compose.yml` — Postgres only, for local dev (`docker compose up -d`)
- `docker-compose.prod.yml` — adds `backend`/`web` services for a full-stack run (`docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build`); requires a root `.env` (see `.env.example`)

Each app has its own `package.json`/`pubspec.yaml`, install/run from inside that directory.

## Commands

### Backend (`cd backend`)

```bash
npm install
cp .env.example .env          # set DATABASE_URL, JWT_SECRET, PORT
npx prisma migrate dev        # or `migrate deploy` against an already-migrated DB
npm run db:seed               # optional demo data (backend/prisma/seed.ts)
npm run dev                   # ts-node-dev, http://localhost:4000

npx tsc --noEmit -p tsconfig.test.json   # typecheck (src + tests)
npm test                                  # vitest run — full suite
npx vitest run tests/auth.test.ts         # single test file
npm run build                             # tsc -> dist/
```

Tests run against a **real** Postgres (`DATABASE_URL`), not mocks — each test creates uuid-prefixed rows and deletes them by ID afterward (`tests/helpers/fixtures.ts`, `tests/helpers/setup.ts`). `vitest.config.mts` sets `fileParallelism: false`: test files run sequentially because they share one DB/Prisma client. A local Postgres must be reachable before running `npm test`.

### Web (`cd web`)

```bash
npm install
cp .env.example .env.local    # set NEXT_PUBLIC_API_URL
npm run dev                   # next dev --turbo, http://localhost:3000
npx tsc --noEmit
npm run lint                  # next lint
npm run build
```

### Mobile (`cd mobile`)

```bash
flutter pub get
flutter run
flutter test                          # full suite
flutter test test/models/job_test.dart  # single test file
```

## Architecture

### Auth & authorization (backend)

JWT is stateless (`lib/jwt.ts`) but carries a `tokenVersion` claim checked against `User.tokenVersion` on every request (`middleware/auth.ts` → `requireAuth`); security events (password reset, forced password change, account suspension) bump `tokenVersion`, which invalidates all outstanding tokens for that user without a session store. Normal logout does *not* bump it — it only closes that `UserSession` row.

Three stacked authorization layers, used in combination across routes:
- `requireRole(...roles)` — fixed role allow-list
- `requirePermission(key)` — OWNER always passes; others need a `Permission` row (`staffId + key = true`)
- `requireRoleOrPermission(roles, key)` — role allow-list OR permission

`Role` enum: `OWNER, MANAGER, TEAM_LEAD, STAFF, CUSTOMER`. Granular permission keys (`lib/permissions.ts`): `view_finance, delete_customers, view_all_jobs, manage_contracts, manage_staff, approve_advances, edit_prices, export_reports` — these let OWNER grant a specific STAFF/TEAM_LEAD an ability above their role without changing the role itself.

Scope/ownership checks live in `lib/access.ts`, not in controllers — reuse `canAccessJob`, `getStaffIdForUser`, `getCustomerIdForUser`, `getTeamStaffIds` rather than re-deriving them. `getTeamStaffIds` is **one level only** (a TEAM_LEAD's direct `Staff.supervisorId` reports) — this is correct for the current flat org model (STAFF report to TEAM_LEAD; TEAM_LEAD/MANAGER/OWNER don't nest), not a bug to "fix" without a reason to add deeper hierarchy.

### API surface

`app.ts` builds one `apiRouter` and mounts it twice: unprefixed (`app.use(apiRouter)`, all existing/shipped clients) and under `/v1` (`app.use("/v1", apiRouter)`). Both resolve identically today — this exists so a future breaking change can be introduced only under a new prefix without touching the frozen one. Add new route files to `apiRouter`, not directly to `app`.

### File storage

Uploads (job photos, signatures, customer documents, message attachments) go through `lib/storage.ts`, not raw `fs`. If `S3_BUCKET`/`S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY` are set, files go to S3-compatible storage; otherwise they stay on local disk (`backend/uploads/`) — this is the default for single-instance dev/small deployments. Files are served exclusively via `GET /files/:type/:id` (`filesController.ts`), authenticated, with per-record authorization matching the equivalent read endpoint — there is no static `/uploads` mount (removed deliberately; treat re-adding one as a regression).

### Scheduled jobs

`lib/cron.ts` registers `node-cron` jobs, each wrapped in `withCronLock(name, fn)` (`lib/distributedLock.ts`, Postgres `pg_try_advisory_xact_lock`). On a single instance this is a no-op; if the backend is ever run as 2+ instances it stops the same job firing twice (duplicate reminder emails, duplicate generated jobs). **Any new `cron.schedule(...)` must be wrapped in `withCronLock` too.**

### Optional integrations — fail-closed by convention

SMTP email, reCAPTCHA, Firebase push, S3 storage, and Sentry error reporting all follow the same pattern: read env vars, and if unset, no-op silently (log once, never throw) rather than crash the app. Follow this pattern for new optional integrations instead of throwing on missing config.

### Web auth token duality

The JWT is stored in `localStorage` (`web/src/lib/auth.ts`) and sent as `Authorization: Bearer` on every API call (`web/src/lib/api.ts`) — this is what actually authenticates requests. It is *also* mirrored into a plain cookie on login/logout solely so `web/src/middleware.ts` (Next.js edge middleware) can redirect unauthenticated page loads to `/giris`; the cookie is never read by the backend. Don't add backend cookie-auth expecting it to work — it's route-guard-only.

### Mobile

`mobile/lib/features/<domain>/` mirrors the same domain split as `backend/src/{routes,controllers}` and `web/src/app/(dashboard)/` (jobs, customers, staff, finance, stock, evaluations, etc.) — when a feature spans all three apps, look at the matching folder name in the other two for the existing contract before inventing a new shape.

### Conventions to preserve

- Code identifiers are English; comments, commit messages, and all user-facing strings are Turkish. Match this rather than switching languages.
- Backend controllers return errors as `{ error: "<Turkish message>" }`; centralized in `middleware/errorHandler.ts` (Zod, Prisma known-error codes, Multer errors, and a generic 500 that logs the real error server-side via `lib/logger.ts` but never leaks it to the client).
- `docs/PROJECT_HANDOFF_TR.md` is a point-in-time snapshot from an earlier session, not a living doc — several things it describes as "missing" have since been implemented (check the actual code/schema before trusting a "not implemented" claim there). `docs/SECURITY.md` and `docs/STITCH_FEATURE_MATRIX.md` record real, current design decisions and their trade-offs.
