# StormHub Deployment and Staging Guide

Last updated: 2026-07-30

## Environments

StormHub should use separate Supabase projects:

- Production Supabase: real users and real school data.
- Staging Supabase: fake users, fake data, and E2E test mutations.

Never point mutating E2E tests at production.

## Staging Supabase setup

Use an empty, non-production `StormHub Staging` Supabase project. The timestamped files under
`supabase/migrations/` are the source of truth; do not initialize a new project from the legacy
top-level SQL snapshots or by pasting a subset into the SQL Editor.

```bash
supabase login
supabase link --project-ref <staging-project-ref>
supabase migration list
supabase db push --dry-run
supabase db push
supabase migration list
```

For this release, the final remote list must contain every migration through
`20260730280000_platform_support_access_logging.sql`. When a PR includes a new migration, apply
the complete pending chain to staging before authenticated E2E. Never mark a migration as applied
unless the exact schema was independently verified in that project.

`supabase/staging-setup.sql` is optional backup/documentation SQL. GitHub Actions does not require it for recurring staging setup.

Do not run these on staging unless you intentionally want old/large seeded data:

- `supabase/setup.sql`
- `supabase/seed.sql`
- `supabase/fix-current-db.sql`
- `supabase/reset-pilot-schools-to-draft-club-catalog.sql`

Reason:

- `setup.sql` includes the older large seed set.
- `seed.sql` adds many clubs plus fake announcements/resources/workshops.
- `fix-current-db.sql` is a patch for an existing production-like project, not the clean staging initializer.
- `reset-pilot-schools-to-draft-club-catalog.sql` is intentionally destructive for specific pilot-school club data.

## What the migration chain creates

The migration chain creates and patches, among other relations:

- `schools`
- `school_settings`
- `profiles`
- `clubs`
- `club_memberships`
- `club_announcements`
- `club_resources`
- `events`
- `event_rsvps`
- `opportunities`
- `bookmarks`
- `notifications`
- `notification_preferences`
- `email_outbox`
- `feedback`
- profile creation trigger for `auth.users`
- RLS helper functions and policies

`npm run staging:setup` then adds or updates staging-safe data automatically:

- School 1 (`school1`)
- School 2 (`school2`)
- Science Bowl, Robotics Club, and Math Club for School 1
- minimal School 1 club interest opportunities
- School 2 intentionally empty for cross-school empty-state tests

If these rows are missing, the setup script recreates them. If required schema is missing, stop and
apply the checked-in migration chain; do not repair the gap with ad hoc manual SQL.

## Staging Auth user setup

After applying the base schema/patches once, create or refresh staging data and fake users with:

```bash
npm run staging:setup
```

This script refuses to run unless all are true:

- `E2E_ENVIRONMENT=staging`
- `E2E_ALLOW_MUTATIONS=true`
- `EMAIL_DELIVERY_MODE=outbox_only`
- `E2E_TEST_PASSWORD` is set

It does not print passwords.

GitHub Actions runs this same command before staging E2E. It idempotently seeds `school1`, `school2`, School 1 test clubs, School 1 test opportunities, and fake E2E users. It fails clearly with `Staging schema is missing. Apply base schema/migrations to staging first.` if required tables such as `schools`, `school_settings`, `clubs`, `opportunities`, or `profiles` do not exist.

Recommended test accounts:

| Purpose | Email | Role after profile exists | School |
| --- | --- | --- | --- |
| Super admin | `e2e.superadmin@stormhub.test` | `super_admin` | `NULL` |
| School 1 student | `e2e.student.school1@stormhub.test` | `student` | School 1 |
| School 2 student | `e2e.student.school2@stormhub.test` | `student` | School 2 |
| School 1 admin | `e2e.admin.school1@stormhub.test` | `admin` | School 1 |
| School 2 admin | `e2e.admin.school2@stormhub.test` | `admin` | School 2 |
| School 1 teacher | `e2e.teacher.school1@stormhub.test` | `teacher` | School 1 |

## Local staging `.env.local`

Use the Staging Supabase URL and anon key:

```env
NEXT_PUBLIC_SUPABASE_URL=<staging-supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<staging-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<staging-service-role-key>

NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_DEFAULT_SCHOOL_SLUG=school1

SUPPORT_EMAIL=stormhubsupport@gmail.com
NEXT_PUBLIC_SUPPORT_EMAIL=stormhubsupport@gmail.com
EMAIL_DELIVERY_MODE=outbox_only
EMAIL_PROVIDER=disabled
AI_FEATURES_ENABLED=false
GROQ_ENABLED=false

E2E_ENVIRONMENT=staging
E2E_ALLOW_MUTATIONS=true
E2E_TEST_PASSWORD=<fake-shared-test-password>
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000

E2E_SUPER_ADMIN_EMAIL=e2e.superadmin@stormhub.test
E2E_SUPER_ADMIN_PASSWORD=<same-fake-password>
E2E_STUDENT_EMAIL=e2e.student.school1@stormhub.test
E2E_STUDENT_PASSWORD=<same-fake-password>
E2E_ADMIN_EMAIL=e2e.admin.school1@stormhub.test
E2E_ADMIN_PASSWORD=<same-fake-password>
E2E_TEACHER_EMAIL=e2e.teacher.school1@stormhub.test
E2E_TEACHER_PASSWORD=<same-fake-password>
```

Do not commit `.env.local`.

For scripts and GitHub Actions, staging-prefixed Supabase names are also accepted when `E2E_ENVIRONMENT=staging`:

```env
STAGING_NEXT_PUBLIC_SUPABASE_URL=<staging-supabase-url>
STAGING_NEXT_PUBLIC_SUPABASE_ANON_KEY=<staging-anon-key>
STAGING_SUPABASE_SERVICE_ROLE_KEY=<staging-service-role-key>
```

For browser auth in Vercel Preview, still set the normal `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to staging values. Browser-exposed env vars must use Next.js `NEXT_PUBLIC_` naming.

## Vercel Preview env vars

Preview deployments should point to Staging Supabase:

```env
NEXT_PUBLIC_SUPABASE_URL=<staging-supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<staging-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<staging-service-role-key>
NEXT_PUBLIC_APP_URL=<vercel-preview-url-or-preview-domain>
NEXT_PUBLIC_DEFAULT_SCHOOL_SLUG=school1
SUPPORT_EMAIL=stormhubsupport@gmail.com
NEXT_PUBLIC_SUPPORT_EMAIL=stormhubsupport@gmail.com
EMAIL_DELIVERY_MODE=outbox_only
EMAIL_PROVIDER=disabled
AI_FEATURES_ENABLED=false
GROQ_ENABLED=false
E2E_ENVIRONMENT=staging
E2E_ALLOW_MUTATIONS=true
```

Preview may also define staging-prefixed values:

```env
STAGING_NEXT_PUBLIC_SUPABASE_URL=<staging-supabase-url>
STAGING_NEXT_PUBLIC_SUPABASE_ANON_KEY=<staging-anon-key>
STAGING_SUPABASE_SERVICE_ROLE_KEY=<staging-service-role-key>
```

Only add `E2E_TEST_PASSWORD` and `E2E_*_PASSWORD` values in Vercel if you intentionally run authenticated E2E against Preview.

## Vercel Production env vars

Production deployments must point to Production Supabase:

```env
NEXT_PUBLIC_SUPABASE_URL=<production-supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<production-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<production-service-role-key>
NEXT_PUBLIC_APP_URL=https://stormhubapp.com
NEXT_PUBLIC_DEFAULT_SCHOOL_SLUG=elkhorn-south
SUPPORT_EMAIL=stormhubsupport@gmail.com
NEXT_PUBLIC_SUPPORT_EMAIL=stormhubsupport@gmail.com
EMAIL_DELIVERY_MODE=send
RESEND_API_KEY=<production-resend-key>
EMAIL_FROM="StormHub <notifications@stormhubapp.com>"
EMAIL_REPLY_TO=stormhubsupport@gmail.com
```

Do not set these production env vars:

```env
E2E_ENVIRONMENT=staging
E2E_ALLOW_MUTATIONS=true
E2E_TEST_PASSWORD=<anything>
```

Set these production safety flags explicitly:

```env
AI_FEATURES_ENABLED=false
GROQ_ENABLED=false
AI_DATA_SHARING_APPROVED=false
```

## Email safety

Staging and E2E must use:

```env
EMAIL_DELIVERY_MODE=outbox_only
```

In `outbox_only`, the app can create `email_outbox` rows but does not call Resend. Fake addresses such as `e2e.student@stormhub.test` are acceptable.

If any E2E email test sees `EMAIL_DELIVERY_MODE=send`, it should fail or skip loudly.

Preview/staging should not need `RESEND_API_KEY`. If `EMAIL_DELIVERY_MODE=outbox_only`, no Resend call is made.

## AI/Groq safety

Preview/staging should not need `GROQ_API_KEY`.

Use:

```env
AI_FEATURES_ENABLED=false
GROQ_ENABLED=false
```

If `GROQ_API_KEY` is missing or AI is disabled, the assistant returns a safe unavailable/configuration state and does not call Groq.

## E2E mutation safety

Mutating E2E tests must only run when both are set:

```env
E2E_ENVIRONMENT=staging
E2E_ALLOW_MUTATIONS=true
```

The helper functions in `tests/e2e/helpers.ts` provide:

- `skipUnlessMutationsAreSafe()`
- `skipUnlessEmailIsOutboxOnly()`

Future E2E tests that create, update, or delete rows must call the mutation guard before performing the mutation.

## GitHub Actions

`.github/workflows/ci.yml` runs normal non-mutating checks:

- `npm ci`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run test`
- `npm run test:e2e:readonly`

`.github/workflows/e2e-staging.yml` runs guarded staging setup and E2E only when staging secrets exist.

The workflow prepares required staging rows automatically with `npm run staging:setup`; do not
manually rerun `supabase/staging-setup.sql` for every PR. If the staging schema is behind, apply the
checked-in migration chain before rerunning the workflow.

Required GitHub secrets for staging E2E:

```text
STAGING_NEXT_PUBLIC_SUPABASE_URL
STAGING_NEXT_PUBLIC_SUPABASE_ANON_KEY
STAGING_SUPABASE_SERVICE_ROLE_KEY
E2E_TEST_PASSWORD
```

Accepted aliases:

```text
STAGING_SUPABASE_URL
STAGING_SUPABASE_ANON_KEY
```

Do not store production Supabase values in these staging secrets.
