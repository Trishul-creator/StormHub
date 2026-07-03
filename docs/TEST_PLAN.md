# StormHub Test Plan

Last updated: 2026-07-02

## 1. Static checks

Run on every meaningful change:

```bash
npm run lint
npm run typecheck
npm run build
```

These catch syntax, lint, TypeScript, and Next.js production build failures.

## 2. Unit tests with Vitest

Current targets:

- Permission logic in `lib/permissions.ts`.
- School route helpers in `lib/schools.ts`.
- Email delivery mode decisions in `lib/email.ts`.
- Utility helpers in `lib/utils.ts`.
- Pure visibility/filter expectations represented with test-local helpers.

Command:

```bash
npm run test
```

## 3. Component tests

Current targets:

- `ClubCard`
- `OpportunityCard`
- `EmptyState`

Approach:

- Use React Testing Library.
- Mock child action-heavy components such as join/bookmark buttons.
- Avoid server actions and Supabase in component tests.

Additional future targets:

- Notification bell rendering.
- School card/actions once isolated as a component.
- Role-based management buttons.

## 4. E2E tests with Playwright

Current folder:

```bash
tests/e2e
```

Current specs:

- `public.spec.ts`
- `school-workspaces.spec.ts`
- `super-admin.spec.ts`
- `student.spec.ts`

Public specs run without credentials. Authenticated specs skip unless env vars are configured.
`test:e2e:readonly` runs only public read-only specs and does not require staging credentials.
`test:e2e:staging` runs guarded staging setup and then the E2E suite.

Mutating E2E specs must not run against production. Any E2E test that creates,
updates, or deletes app data must call `skipUnlessMutationsAreSafe()` from
`tests/e2e/helpers.ts`.

Required mutation-safety env vars:

- `E2E_ENVIRONMENT=staging`
- `E2E_ALLOW_MUTATIONS=true`
- `E2E_TEST_PASSWORD` when running `npm run staging:setup`

Email E2E specs must not send real email. Any E2E test that exercises email
delivery must call `skipUnlessEmailIsOutboxOnly()` from `tests/e2e/helpers.ts`.

Required email-safety env var:

- `EMAIL_DELIVERY_MODE=outbox_only`

Required optional env vars:

- `E2E_SUPER_ADMIN_EMAIL`
- `E2E_SUPER_ADMIN_PASSWORD`
- `E2E_STUDENT_EMAIL`
- `E2E_STUDENT_PASSWORD`
- `E2E_ADMIN_EMAIL`
- `E2E_ADMIN_PASSWORD`
- `E2E_TEACHER_EMAIL`
- `E2E_TEACHER_PASSWORD`

Run:

```bash
npm run test:e2e
```

Install browsers on new machines/CI if needed:

```bash
npx playwright install
```

## 5. Security/permission tests

Automated unit coverage now includes:

- Student cannot use student features in another school.
- Admin can manage own school only.
- Super admin can manage any school.
- Student/officer/sponsor club management boundaries.
- Admin/super admin preview/manage but do not join through student flow.

Remaining E2E/security targets:

- Student cannot access `/admin`.
- Student cannot access `/manage`.
- School admin cannot access another school's users/clubs.
- Student cannot join another school's club.
- Student cannot save another school's opportunity.
- Super admin can open all school workspaces.

## 6. Database/RLS tests

Automated RLS tests are not currently implemented. They require either:

- A disposable Supabase project.
- Supabase local stack in CI.
- Seeded test users and SQL assertions.

Manual Supabase SQL checks should verify:

- `profiles` role constraints.
- `club_memberships` role/status constraints.
- Students cannot update rejected memberships back to active.
- School admins are scoped to their school.
- Event/club/opportunity RLS does not leak cross-school data.
- Super admins retain platform-level access.

Staging database setup for these tests is documented in `docs/DEPLOYMENT.md`.
Use the dedicated Staging Supabase project only.

## 7. Manual QA flows

### Public

1. Open `/`.
2. Confirm platform-neutral messaging.
3. Confirm no active volunteering/service-hours/workshops navigation.
4. Open `/contact`.
5. Confirm `stormhubsupport@gmail.com`.

### Super admin

1. Sign in.
2. Confirm redirect/arrival at `/admin/schools`.
3. Open School 1 and School 2.
4. Confirm Platform Admin Mode.
5. Confirm Join Club is not primary action.

### Student

1. Sign up/select school.
2. Confirm dashboard is school-specific.
3. Browse own-school clubs.
4. Join a published club.
5. Open club member dashboard.
6. RSVP to event and cancel RSVP.
7. Save/sign up for opportunity.

### School admin/teacher

1. Open `/manage`.
2. Create draft club.
3. Publish club.
4. Create announcement/resource/event.
5. Verify event appears on school calendar.
6. Delete/archive event.
7. Manage roster.

### Email/notifications

1. Normal announcement creates in-app notification only.
2. Important update queues/sends email only if selected and preferences allow.
3. Urgent update queues/sends email.
4. `EMAIL_DELIVERY_MODE=outbox_only` creates outbox entries but sends nothing.
5. `EMAIL_DELIVERY_MODE=send` sends through Resend only when configured.

## 8. What is not automated yet

- Full Supabase RLS integration tests.
- Real email provider send tests.
- AI assistant safety jailbreak regression suite.
- Complete admin/teacher/officer E2E flows.
- Visual regression tests.
- Mobile layout regression tests.
