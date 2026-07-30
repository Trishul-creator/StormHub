# Pilot Acceptance

Record a result and evidence for every item before inviting pilot users.

## Automated Gates

- CI typecheck, lint, production build, unit/component tests
- Production dependency audit with zero moderate-or-higher findings
- Chromium, Firefox, WebKit, iPhone, and Chromebook-sized read-only flows
- axe serious/critical accessibility checks and keyboard navigation
- Supabase migration reset, database lint, and pgTAP role matrix
- Staging schema check proves every required privacy, district, tenant-RPC, policy, and operational
  migration through `20260730290000_admin_step_up_authentication.sql` is present; missing
  schema fails rather than skipping a flow
- Staging E2E and Vercel preview
- CodeQL

Automated results are necessary but do not replace the real-account, provider-console, contract,
restore, or deletion checks below.

## Real Device Checks

On one district-managed Chromebook and one physical phone:

- Create and confirm a student account with hCaptcha, the selected school access code, and an allowed school domain.
- Request a password reset, open the emailed link, set matching passwords, and sign in with the new password.
- As each administrator tier, let the five-minute confirmation window expire, then verify a
  protected role or organization change requires the same account's password or Google sign-in.
- Reject an incorrect school code, a disallowed-domain signup, and a missing CAPTCHA.
- Join/leave a club, RSVP/remove RSVP, bookmark/remove bookmark.
- Open school calendar and opportunity filters.
- Submit support feedback once; verify spam controls, scoped in-app content, and a generic support
  inbox alert that contains no name, reply address, school, or message body.
- Enable/disable weekly digest and view its preview.
- Navigate all controls using keyboard only; verify visible focus and no keyboard trap.
- At 200% browser zoom, verify no hidden buttons, clipped text, or horizontal page scrolling.
- Verify screen-reader names for navigation, form errors, icon buttons, and dialogs.

## Administrative Checks

- Unconfirmed accounts cannot sign in; confirmed student, teacher, admin, and super-admin accounts can sign in.
- New password and Google-onboarding accounts must accept the current policy versions, attest to
  age 13 or older, and reject any entered grade outside 9 through 12.
- No role is asked for a phone number, SMS code, or authenticator code.
- School admins can view/rotate only their school access code; platform admins can manage any school code.
- School admin cannot see or modify another school.
- Anonymous clients cannot query real school rows and receive only the limited active-school signup
  chooser. Students cannot query another school's clubs, member counts, events, or opportunities.
- Ordinary members receive only the limited club directory; only an Advisor or scoped administrator
  receives full roster/contact fields needed for supervision.
- Super admin can search the audited account-administration directory across all pages and filters;
  each result exposes only name, verified email, school/district, role, and account status.
- Super admin can manage ordinary school settings without private coursework, grades, attendance
  details, or support-message content.
- Start a temporary platform support session, confirm the school admin notification, inspect one private test submission, verify the access log, and confirm grading remains disabled.
- End the support session and confirm the same private submission is no longer visible.
- Suspend/reactivate a test student and confirm session/access behavior.
- Run graduation cleanup only against staging test users.
- Approve/reject content and verify actor, reason, and time in the audit log.
- Search and filter the shared draft catalog, publish one template, and confirm it is visible only in that school.
- Submit, review, export, and complete a test deletion request.
- In staging, complete an ordinary-account deletion with separate requester/reviewer accounts and
  confirm the Auth identity, profile, private files, provider tokens, and queued user mail are
  removed or terminalized while required audit evidence remains.
- Submit a school offboarding request with a school admin, advance it with a different in-scope
  reviewer, and confirm only a platform super admin can approve/schedule/restore/complete it. Confirm
  approval disables tenant access and cancellation restores the captured state without physical
  deletion.
- In a disposable staging tenant, execute the reviewed physical-purge runbook, verify zero remaining
  tenant/Auth/Storage rows, and record when backups containing the test tenant will expire. Do not
  run this destructive drill against a real pilot tenant.
- Place a test legal hold with an individual platform super-admin account. Confirm retention records
  a skipped run and matching offboarding cannot be scheduled or completed; release it with a reason
  and confirm normal processing resumes.
- Export one account and confirm policy acceptances, notifications, participation, coursework,
  support requests, and Drive metadata are represented without exposing another user.

## Operations

- Public `/api/health` monitored every five minutes and limited to generic `status`/`timestamp`;
  dedicated `HEALTH_CHECK_SECRET` bearer returns details only to the restricted operator check.
- Supabase automated backup status recorded.
- Encrypted off-site logical backup created and restoration drill passed.
- Incident contacts and privacy escalation route recorded privately.
- Resend/Supabase SMTP confirmation and reset delivery tested outside the Supabase team and in a
  district-managed mailbox; SPF, DKIM, and DMARC results recorded.
- Supabase Auth and `/contact` hCaptcha enforcement tested from the deployed production hostname.
- Google sign-in and Drive Picker/copy/disconnect tested with a non-owner account when those optional
  features are enabled; otherwise their UI flags remain off.
- External health monitoring and the restricted incident-alert route tested with a named primary
  and backup responder.
- Cron digest invoked twice with one resulting delivery.
- Daily data-retention cron invoked once with a completed `data_retention_runs` record.
- Email recovery worker retries a temporary provider failure without duplicate delivery.
- Assignment and submission uploads reject disallowed formats, spoofed file signatures, files above
  20 MB, and count/aggregate limits; exact short-lived upload intents are consumed once, and invalid
  or expired orphan objects are removed.
- For any district-wide direct-upload launch, record either an approved malware-scanning control or
  explicit district acceptance of the residual risk from signature-validated private downloads.
  File-signature validation alone must not be recorded as malware scanning.
- AI flags verified false.
- Signed district DPA/agreement/addendum and current, plan-specific subprocessor approval stored in
  the district's private contract system.
