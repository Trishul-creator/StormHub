# StormHub Engineering Log

Last updated: 2026-07-02

## Current architecture summary

- Framework: Next.js App Router with TypeScript.
- Data/Auth: Supabase Auth, Postgres, RLS, server/client helpers.
- Hosting: Vercel from GitHub `main`.
- UI: React components with Tailwind classes and small local UI primitives.
- Notifications: in-app notifications plus controlled email outbox/send behavior.
- Email provider: Resend when `EMAIL_DELIVERY_MODE=send` and `RESEND_API_KEY`/`EMAIL_FROM` are configured.
- AI: app assistant route backed by Groq when configured.
- Test stack added: Vitest, React Testing Library, Playwright.

## Major refactors completed so far

- Simplified global profile roles to `student`, `teacher`, `admin`, and `super_admin`.
- Moved club-specific authority to `club_memberships` roles.
- Added/updated multi-school workspace model and school settings.
- Made root page platform-neutral.
- Added super-admin school chooser flow.
- Added draft club catalog and publish flow.
- Reset pilot school clubs into draft catalogs when requested.
- Hid/non-core legacy modules from the product experience.
- Moved club meeting setup out of club profile forms; meetings are now dated events.
- Improved event routing/deletion so club-created meetings can be opened and archived.
- Adjusted signed-in navigation so users do not see public “Home” as their primary tab.
- Added controlled email modes and support contact routing.

## Known resolved issues

- Signup/profile trigger reliability improved through Supabase patch scripts.
- Legacy `club_officer`/`teacher_sponsor` role confusion cleaned up into profile roles plus membership roles.
- School-scoped route cleanup for `/s/[schoolSlug]` workspaces.
- Volunteering/service hours hidden from app experience.
- Workshop module simplified/hidden from core product.
- Email behavior changed to controlled delivery modes.
- Public `www`/domain setup issues were resolved outside code through DNS/Vercel configuration.
- Club dashboard 404s for draft/unpublished clubs were fixed through managed lookup and route fallbacks.
- Event detail 404s from dashboard links were fixed by removing brittle default-school filtering from event detail lookup.

## Known remaining risks

- Supabase RLS is not yet covered by automated database integration tests.
- E2E authenticated flows require real seeded test accounts and are skipped when credentials are missing.
- App still contains legacy routes for disabled modules; they should remain inert unless intentionally revived.
- Some server actions are difficult to unit-test directly because they depend on Supabase Auth, RLS, cookies, and Next.js runtime behavior.
- The lockfile and dependency tree should be periodically audited; `npm install` currently reports moderate vulnerabilities.
- Playwright browser binaries may need `npx playwright install` on new machines/CI.

## Testing commands

```bash
npm run lint
npm run typecheck
npm run build
npm run test
npm run test:e2e
npm run qa
```

`npm run qa` runs lint, typecheck, build, and unit/component tests.

## Manual QA checklist

- Sign out and verify `/` is platform-neutral.
- Sign up as a student and verify the selected school is preserved.
- Sign in as student and verify dashboard, clubs, calendar, opportunities, notifications, and settings.
- Verify a student cannot access `/manage` or `/admin`.
- Sign in as school admin and verify only the assigned school appears in user/club inventory.
- Sign in as super admin and verify `/admin/schools` shows the school chooser.
- Verify super admin can open Elkhorn South and Elkhorn North workspaces.
- Create a draft club, publish it, and verify it appears only in that school.
- Create a club event, open it from the dashboard, verify calendar display, then archive it.
- Join a club as a student, then verify member dashboard access.
- Create normal/important/urgent notifications and verify email mode behavior.
- Submit support/contact feedback and verify support path.

## Important notes for future Codex/AI sessions

- Always inspect before editing.
- Always run lint, typecheck, build, and relevant tests.
- Do not expose `.env.local` values or print secrets.
- Do not rewrite UI unless explicitly asked.
- Do not claim success without tests or manual checks.
- Keep changes scoped.
- Preserve user data unless the user explicitly requests a destructive reset.
- Update `docs/SPEC.md` and this log when product behavior changes.

## AI coding rules for this project

- Inspect current routes, data helpers, and RLS assumptions before changing behavior.
- Prefer small patches over broad rewrites.
- Use Playwright for routing/auth/server-component flows.
- Use Vitest for pure logic and simple component tests.
- Mock Supabase only in unit tests.
- Do not send real email from tests.
- Do not use production credentials in tests.
- Keep E2E credentials in env vars only.
