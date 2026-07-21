# Pilot Acceptance

Record a result and evidence for every item before inviting pilot users.

## Automated Gates

- CI typecheck, lint, production build, unit/component tests
- Production dependency audit with zero moderate-or-higher findings
- Chromium, Firefox, WebKit, iPhone, and Chromebook-sized read-only flows
- axe serious/critical accessibility checks and keyboard navigation
- Supabase migration reset, database lint, and pgTAP role matrix
- Staging E2E and Vercel preview
- CodeQL

## Real Device Checks

On one district-managed Chromebook and one physical phone:

- Create and confirm a student account with hCaptcha and an allowed school domain.
- Reject a personal-domain signup and a missing CAPTCHA.
- Join/leave a club, RSVP/remove RSVP, bookmark/remove bookmark.
- Open school calendar and opportunity filters.
- Submit support feedback once; verify spam controls and support inbox receipt.
- Enable/disable weekly digest and view its preview.
- Navigate all controls using keyboard only; verify visible focus and no keyboard trap.
- At 200% browser zoom, verify no hidden buttons, clipped text, or horizontal page scrolling.
- Verify screen-reader names for navigation, form errors, icon buttons, and dialogs.

## Administrative Checks

- Unconfirmed accounts cannot sign in; confirmed student, teacher, admin, and super-admin accounts can sign in.
- No role is asked for a phone number, SMS code, or authenticator code.
- School admin cannot see or modify another school.
- Super admin can explicitly select a school and can see platform audit/support views.
- Suspend/reactivate a test student and confirm session/access behavior.
- Run graduation cleanup only against staging test users.
- Approve/reject content and verify actor, reason, and time in the audit log.
- Submit, review, export, and complete a test deletion request.

## Operations

- `/api/health` monitored every five minutes and alert delivery tested.
- Supabase automated backup status recorded.
- Encrypted off-site logical backup created and restoration drill passed.
- Incident contacts and privacy escalation route recorded privately.
- SMTP confirmation/reset delivery tested outside the Supabase team.
- Cron digest invoked twice with one resulting delivery.
- AI flags verified false.
