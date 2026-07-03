# StormHub Test Report

Last updated: 2026-07-02

## Current automated coverage

### Static checks

- `npm run lint`
- `npm run typecheck`
- `npm run build`

### Unit tests

- `tests/unit/permissions.test.ts`
  - Global role classification.
  - Student feature school scoping.
  - School admin and super admin boundaries.
  - Club manager/member/sponsor/admin/super-admin boundaries.
  - Opportunity-style school scoping expectations through existing permission helpers.

- `tests/unit/schools.test.ts`
  - Default school slug behavior.
  - School route helper output.
  - Explicit selected-school route behavior.

- `tests/unit/utils.test.ts`
  - Slug generation.
  - Opportunity action label normalization.
  - Deadline soon logic.
  - Public club/opportunity visibility rules.
  - Upcoming event filtering expectation.

- `tests/unit/email.test.ts`
  - Disabled email mode.
  - Outbox-only mode.
  - Send/resend mode.
  - Default behavior with/without provider config.

### Component tests

- `tests/components/club-card.test.tsx`
- `tests/components/opportunity-card.test.tsx`
- `tests/components/empty-state.test.tsx`

These verify render behavior without server actions or Supabase.

### E2E tests

- `tests/e2e/public.spec.ts`
- `tests/e2e/school-workspaces.spec.ts`
- `tests/e2e/super-admin.spec.ts`
- `tests/e2e/student.spec.ts`

Authenticated tests skip when matching `E2E_*` credentials are missing.

## What is covered

- Key pure permission rules.
- Route helper output for school workspaces.
- Email delivery mode decisions.
- Basic card/empty-state rendering.
- Public route smoke coverage.
- Skeleton authenticated E2E flows for super admin and student accounts.

## What is not covered yet

- Supabase RLS integration tests.
- Full server action integration tests.
- Real signup flow with disposable test users.
- Real email provider delivery.
- Complete school admin/teacher/officer E2E workflows.
- AI assistant jailbreak/safety regression suite.
- Cross-browser E2E beyond Chromium.

## How to interpret results

Passing unit/component tests prove only isolated behavior. They do not prove Supabase auth/RLS flows work end-to-end.

Passing Playwright public tests prove the public app starts and key public routes render. Authenticated E2E tests require real test accounts and seeded schools.

Do not claim a role-based flow works unless either:

- A Playwright authenticated test passed for that role, or
- The exact manual QA flow was performed and recorded.

## Latest local run

Date/time: 2026-07-02 16:05 CDT

### Commands run

- `npm run test`
  - Result: passed.
  - Coverage: 7 test files, 35 tests.

- `npm run lint`
  - Result: passed.
  - Note: Next.js reports `next lint` is deprecated and should eventually move to the ESLint CLI.

- `npm run typecheck`
  - Result: passed.

- `npm run build`
  - Result: passed.
  - Note: production build still includes `/admin/feedback`; this conflicts with the prior product direction that app feedback should go only to support, but this testing pass did not change product behavior.

- `npx playwright install chromium`
  - Result: completed.
  - Reason: Playwright browser binary was missing after adding the dependency.

- `npm run test:e2e`
  - First run: failed because Chromium was not installed.
  - Second run after browser install: passed for public/school workspace smoke tests.
  - Result: 4 passed, 2 skipped.
  - Skipped:
    - `tests/e2e/super-admin.spec.ts` because `E2E_SUPER_ADMIN_EMAIL` / `E2E_SUPER_ADMIN_PASSWORD` are not configured.
    - `tests/e2e/student.spec.ts` because `E2E_STUDENT_EMAIL` / `E2E_STUDENT_PASSWORD` are not configured.

- `npm run qa`
  - Result: passed.
  - Runs lint, typecheck, production build, and Vitest tests.

### Current result summary

- Static checks: passed.
- Production build: passed.
- Unit/component tests: passed.
- Public E2E smoke tests: passed.
- Authenticated E2E tests: created but skipped until test accounts are configured.

### Known test gaps after this run

- No automated Supabase RLS test suite yet.
- No authenticated admin/teacher/officer E2E coverage yet.
- No real signup E2E test with disposable accounts yet.
- No real email provider delivery test; email tests cover delivery-mode decisions only.
- No AI assistant safety regression test suite yet.
- No full CRUD E2E flow for club drafts, publishing, events, resources, or opportunities yet.

### Bugs or mismatches discovered

- `/admin/feedback` still exists in the route table. Prior product direction said app feedback should route only to support, not an admin feedback panel. This should be addressed in a separate scoped product cleanup.

## Staging safety update

Date/time: 2026-07-02

Added staging/E2E safety preparation:

- `supabase/staging-setup.sql` for staging-only schools, minimal clubs, minimal opportunities, and disabled sample modules.
- E2E safety helpers requiring `E2E_ENVIRONMENT=staging` and `E2E_ALLOW_MUTATIONS=true` before mutating tests run.
- E2E email safety requiring `EMAIL_DELIVERY_MODE=outbox_only` before email tests run.
- `docs/DEPLOYMENT.md` with staging SQL order, fake test users, and Vercel Preview/Production env guidance.

Mutating E2E was not run during this update because the Staging Supabase URL/keys and fake Auth users were not configured in this workspace.

Safe checks run after staging-prep changes:

- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm run test` — passed, 8 test files / 39 tests.
- `npm run build` — passed.

## Environment wiring update

Date/time: 2026-07-02

Added:

- Centralized env resolver in `lib/env.ts`.
- Support for staging-prefixed Supabase env vars in explicit staging E2E/server/script contexts.
- Runtime email safety that forces explicit staging E2E to outbox-only.
- Assistant/Groq disable behavior through missing `GROQ_API_KEY`, `AI_FEATURES_ENABLED=false`, `GROQ_ENABLED=false`, or explicit staging E2E.
- Generic `school1`/`school2` staging SQL.
- Guarded `scripts/setup-staging-e2e.ts` fake user setup.
- GitHub Actions workflows for CI and staging E2E.

Mutating E2E was not run for this update because staging credentials are not configured in this workspace.

Safe checks run after environment-wiring changes:

- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm run test` — passed, 9 test files / 45 tests.
- `npm run build` — passed.

Skipped:

- `npm run staging:setup` was not run because staging Supabase credentials and `E2E_TEST_PASSWORD` are not configured in this workspace.
- Mutating E2E was not run because staging guards and staging database setup are not active in this workspace.
