# StormHub Production Rollout

Use this checklist in order. Keep `AI_FEATURES_ENABLED=false`, `GROQ_ENABLED=false`, and
`AI_DATA_SHARING_APPROVED=false` until the district has approved the AI vendor and data flow.

## 1. Verify The Pull Request

Require these checks before merge:

- `CI / checks`
- `CI / database`
- `Staging E2E / e2e-staging`
- `CodeQL / analyze`
- Vercel preview deployment

Do not deploy a database migration from an unmerged branch to production.

### Current schema gate

Staging setup now fails instead of warning or skipping when a required privacy, district,
organization, tenant-isolation, policy-acceptance, or operational relation/RPC is missing. Apply the
entire checked-in chain to staging, run protected E2E, merge, and then apply that same chain to
production. The current release must contain every migration through:

```text
20260729180000_organization_details.sql
20260730110000_tenant_privacy_boundaries.sql
20260730120000_opportunity_lifecycle.sql
20260730130000_operational_hardening.sql
20260730140000_policy_acceptance_and_upload_limits.sql
20260730150000_scoped_support_inbox.sql
20260730160000_scoped_user_inventory.sql
20260730170000_tenant_offboarding_workflow.sql
20260730180000_paginated_school_directories.sql
20260730190000_operational_release_blockers.sql
20260730200000_read_only_platform_roster_support.sql
20260730210000_privacy_release_gates.sql
20260730220000_coursework_upload_intents.sql
20260730230000_legal_hold_execution_barriers.sql
20260730240000_elevated_account_deletion.sql
20260730250000_tenant_deletion_integrity.sql
20260730260000_independent_school_offboarding.sql
20260730270000_cross_tenant_transition_integrity.sql
20260730280000_platform_support_access_logging.sql
20260730290000_admin_step_up_authentication.sql
```

Use one linked-project workflow per environment:

```bash
supabase link --project-ref <staging-reference-id>
supabase migration list
supabase db push --dry-run
supabase db push
npm run test:e2e:staging

supabase link --project-ref <production-reference-id>
supabase migration list
supabase db push --dry-run
supabase db push
supabase migration list
```

Do not repair a migration as applied unless its exact schema was independently verified in that
project. Re-link explicitly before every environment change; never select a similarly named project
by guesswork.

## 2. Configure Resend And Supabase SMTP

1. In Resend, add and verify the sending domain. Complete every DNS record Resend provides.
2. Create a Resend API key restricted to sending email.
3. In Supabase, open **Authentication > Email > SMTP Settings** and enable custom SMTP.
4. Enter these values:

| Supabase field | Value |
| --- | --- |
| Sender email | `auth@stormhubapp.com` (or an address on the verified sending domain) |
| Sender name | `StormHub` |
| Host | `smtp.resend.com` |
| Port | `587` |
| Username | `resend` |
| Password | The Resend API key |

5. In **Authentication > URL Configuration**, set Site URL to `https://stormhubapp.com`.
6. Add `https://stormhubapp.com/auth/callback` as a redirect URL. Add the exact staging
   callback URL as well; do not allow an unrestricted production wildcard.
7. Enable email confirmation. Keep secure email changes enabled.
8. Leave the default confirmation template using `{{ .ConfirmationURL }}`. If the template was
   customized, make sure its confirmation link still uses `{{ .ConfirmationURL }}` rather than
   linking directly to `{{ .SiteURL }}`; StormHub sends users through `/auth/callback` to establish
   their session and profile safely.
9. Send a signup confirmation and password-reset email to an address outside the Supabase team.

To reduce junk-folder placement:

1. Send Auth mail from a dedicated address such as `auth@stormhubapp.com`, never Resend's shared
   testing domain or a free Gmail address.
2. In Resend, confirm that SPF and DKIM both show **Verified** for the exact sending domain.
3. Publish a DMARC record for the organizational domain. Start with monitoring
   (`v=DMARC1; p=none; rua=mailto:dmarc@stormhubapp.com`) and move to quarantine/reject only after
   the reports show that Supabase/Resend mail aligns correctly.
4. Keep the visible sender name and domain consistent (`StormHub <auth@stormhubapp.com>`), use the
   concise confirmation subject/template in `supabase/templates/confirmation.html`, and avoid URL
   shorteners or attachment-heavy Auth messages.
5. Test Gmail, Outlook, and a district-managed mailbox. In each received message, inspect the
   headers and require SPF, DKIM, and DMARC to report `PASS`.
6. In Resend, disable click tracking for transactional authentication mail. Rewritten tracking
   links can make a confirmation message look less trustworthy to a mailbox filter.

No application can guarantee inbox placement because the recipient's mail administrator controls
filtering. Domain authentication, alignment, a stable sender reputation, and low complaint/bounce
rates are the controls that materially improve delivery.

The `RESEND_API_KEY` stored in Vercel is only used by StormHub's application-email worker. Supabase
Auth cannot read Vercel environment variables, so enabling email confirmation before configuring
Supabase SMTP causes registration to fail while Auth tries to send the confirmation message. In
Supabase Auth logs this appears as `Error sending confirmation email`; finish the SMTP integration
and repeat the outside-team signup test before inviting users.

For application email, set these Vercel Production and Preview variables:

```text
EMAIL_DELIVERY_MODE=send
EMAIL_PROVIDER=resend
RESEND_API_KEY=<separate Resend API key>
EMAIL_FROM=StormHub <notifications@stormhubapp.com>
EMAIL_REPLY_TO=stormhubsupport@gmail.com
SUPPORT_EMAIL=stormhubsupport@gmail.com
NEXT_PUBLIC_SUPPORT_EMAIL=stormhubsupport@gmail.com
```

Before a district-wide launch, replace the pilot Gmail address with a district-approved managed
support mailbox on a controlled domain, restrict it to named operators, and include its provider in
the signed subprocessor review. Contact-form message content stays in StormHub; the mailbox receives
only a generic alert. A user who sends a direct email still sends that email's content through the
mailbox provider, so the Privacy Notice discloses that separate path.

## 2A. Enable Scheduled Club Releases

The scheduled-content migration adds private release timestamps, and StormHub exposes a protected
worker at `/api/cron/publish-scheduled`. Vercel Hobby only permits daily cron schedules, so use the
free Supabase Cron module for a useful five-minute release interval instead of adding a frequent
job to `vercel.json`.

1. Apply `20260726220000_scheduled_club_content.sql` with the normal migration chain.
2. In Supabase, open **Integrations > Cron** and enable the Cron module.
3. Create an **HTTP Request** job named `publish-scheduled-stormhub-content`.
4. Use schedule `*/5 * * * *`, method `GET`, and URL
   `https://stormhubapp.com/api/cron/publish-scheduled`.
5. Add the header `Authorization: Bearer <CRON_SECRET>`, using the exact same `CRON_SECRET`
   configured in Vercel Production. Store the value as a Supabase Vault secret when the Cron
   interface offers that option; never put it in source control.
6. After deployment, schedule one announcement and one assignment about ten minutes ahead.
   Confirm both stay private, release within five minutes of the selected time, and create member
   notifications. Review the job under **Integrations > Cron > History** if either remains a draft.

The worker is idempotent: overlapping calls can claim each scheduled item only once. A school on a
Vercel Pro plan may use a frequent Vercel Cron instead, but it should not configure both schedulers.

## 3. Enable hCaptcha

1. Create an hCaptcha site and allow `stormhubapp.com`, the staging hostname, and localhost only
   when testing locally.
2. Copy the site key and secret.
3. In Supabase, open **Authentication > Bot and Abuse Protection**.
4. Enable CAPTCHA protection, select **hCaptcha**, enter the hCaptcha secret, and save.
5. Add these Vercel variables:

```text
NEXT_PUBLIC_HCAPTCHA_SITE_KEY=<hCaptcha site key>
HCAPTCHA_SECRET_KEY=<hCaptcha secret>
```

6. Redeploy. Verify signup and sign-in reject requests without a valid challenge.
7. Verify `/contact` accepts one valid challenge and rejects a reused or missing token.

Supabase validates Auth CAPTCHA tokens. StormHub separately validates the contact form token before
using the service-role database client.

## 4. Verify Email-Only Authentication

Every student, teacher, school admin, district admin, and super admin uses password sign-in plus Supabase email confirmation.
StormHub does not require phone numbers, SMS, or authenticator applications.

1. In Supabase, open **Authentication > Providers > Email** and keep email signup and email
   confirmations enabled.
2. Keep phone signup, Phone MFA, and TOTP MFA disabled.
3. Confirm the production URL and `/auth/callback` are present in Supabase redirect URL settings.
4. Create one test account for every role. Confirm an unverified account is rejected and each account
   can sign in after using the confirmation link.
5. Confirm school admins remain limited to their school, district admins remain limited to their
   district, and super admins retain platform-wide access. Email confirmation does not replace role,
   school/district, account-status, or audit controls.

Do not share administrator accounts. Every administrator needs an individual confirmed email account.
MFA is intentionally not a launch requirement for the current high-school rollout. Record that
decision and the compensating controls in the district security review, then reassess it when a
district requires MFA, privileged scope expands materially, or incident evidence changes the risk.

## 4A. Confirm High-School Eligibility And Policy Records

1. Keep the rollout limited to high-school communities and people age 13 or older.
2. Verify password signup and Google onboarding both require the 13+ assurance and acceptance of
   the versioned Privacy Notice, Terms, and Acceptable Use Policy.
3. Verify any entered grade outside 9 through 12 is rejected and no birth date is collected.
4. Confirm `policy_acceptances` stores the user, school, versions, source, assurance, and timestamp,
   and that a user can read only their own record.
5. Do not onboard an elementary/middle school that may include children under 13 until a separate
   notice and documented school authorization or parental-consent process is approved and built.

## 4B. Enable Google Authentication

Google authentication uses a separate OAuth client from Google Drive. Apply
`20260727043000_google_oauth_onboarding.sql` before enabling the provider, then
follow `docs/GOOGLE_AUTH_SETUP.md`. The Sign-In client secret belongs only in
Supabase Auth. It is not a Vercel environment variable. Keep
`NEXT_PUBLIC_GOOGLE_AUTH_ENABLED` unset until the migration is applied and the
provider is enabled, then set it to `true` in Vercel Production and redeploy.

Retain password authentication and email confirmation as a fallback. A new
Google identity must finish school onboarding and pass the selected school's
accepted-email-domain rules before accessing school-scoped features.

## 5. Apply The Migration Chain

The production database predates the baseline migration. Mark the baseline as already represented
only after confirming the existing tables are present.

```bash
supabase login
supabase link --project-ref <production-project-ref>
supabase migration list
supabase migration repair --status applied 20260701000000
supabase db push --dry-run
supabase db push
```

If either `20260710160000` or `20260720120000` is already installed but missing from remote migration
history, repair that exact version only after comparing the hosted schema. Never rerun a guessed repair.

After the push, production `supabase migration list` must include every checked-in migration through
`20260730290000`. A missing row blocks production acceptance even when the current UI appears to
work.

Configure approved signup domains in the application after the migration is applied:

1. A school administrator opens **Manage → Registration email domains** for their own school.
2. A platform super administrator opens **Administration → Schools**, selects a school, and uses
   **Accepted email domains**.
3. Enter `*` by itself to accept every verified email domain, or a comma-separated list of
   district-controlled domains to restrict signup. An empty list intentionally blocks new
   accounts.
4. Save, reload the school page, and test one allowed and one disallowed address. The private
   school access code and verified email remain required even when `*` is selected.

The admin UI is the primary configuration path because it applies the same authorization and
validation as the product. Use SQL only as an emergency recovery fallback when that UI is
unavailable, under a recorded maintenance change:

```sql
UPDATE public.schools
SET allowed_email_domains = ARRAY['students.example.edu', 'staff.example.edu']
WHERE slug = 'your-school-slug';
```

Replace the example values with domains controlled by the district. Use `ARRAY['*']` only when the
district intentionally accepts every verified email domain. The
`20260725120000_configurable_school_signup_domains.sql` migration initially sets Elkhorn South,
Elkhorn North, and Lexington East to `ARRAY['*']`; review those settings in the UI before launch.

## 6. Set Vercel Secrets

Add these as sensitive Production variables and use separate values for Preview:

```text
NEXT_PUBLIC_SUPABASE_URL=<project URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable/anon key>
SUPABASE_SERVICE_ROLE_KEY=<service-role key>
NEXT_PUBLIC_SITE_URL=https://stormhubapp.com
NEXT_PUBLIC_APP_URL=https://stormhubapp.com
APP_URL=https://stormhubapp.com
CRON_SECRET=<random value of at least 32 characters>
HEALTH_CHECK_SECRET=<different random value of at least 32 characters>
REQUEST_RATE_LIMIT_SECRET=<different random value of at least 32 characters>
SIGNUP_RATE_LIMIT_SECRET=<different random value of at least 32 characters>
AI_FEATURES_ENABLED=false
GROQ_ENABLED=false
AI_DATA_SHARING_APPROVED=false
```

The service-role key, health secret, CAPTCHA secret, SMTP/API keys, and rate-limit secrets must
never use a `NEXT_PUBLIC_` name. Keep `HEALTH_CHECK_SECRET` distinct from `CRON_SECRET`; the health
endpoint accepts `CRON_SECRET` only as a backward-compatible fallback when a dedicated health
secret is absent.

## 6A. Confirm Privacy Release Controls

Apply every migration through
`20260730290000_admin_step_up_authentication.sql` before performing these checks.

### Administrator identity confirmation

- Role, district, account-status, account-deletion, school-access, tenant-offboarding, organization,
  and private-support changes require a password or Google confirmation from the same administrator.
- The confirmation window lasts five minutes. An ordinary access-token refresh does not extend it.
- Verify both password and Google paths in staging. After the window expires, confirm that a
  protected change returns to the identity-confirmation flow without applying the mutation.

### Legal holds and tenant offboarding

- Place and release legal holds only through the authenticated
  `place_legal_hold`/`release_legal_hold` RPCs using an individual platform super-admin session.
  Each hold requires a reason, and each release requires a separate release reason. Do not edit the
  hold table directly or use a shared service credential as the operator identity.
- An active legal hold makes the daily retention task record a completed, skipped run with no
  deletion. A matching school, district, or global hold also prevents offboarding from entering
  `scheduled` or `completed`. Verify both behaviors with test data before launch.
- Use **Administration → Tenant offboarding** for school or district removal. School administrators
  may request their own school; district administrators may request schools in their district or
  their own district; only a platform super administrator can finally approve, schedule, restore,
  or record verified completion. The requester cannot review their own request.
- Approval is recoverable access suspension, not physical deletion. It marks the tenant access
  boundary disabled, deactivates covered profiles, stops queued user mail, preserves the prior
  state, and blocks existing sessions through authorization/RLS checks. Follow
  `docs/TENANT_OFFBOARDING.md` for the separate, reviewed purge.

### Private coursework uploads

- Each direct upload must begin with a short-lived server-created intent bound to the exact actor,
  assignment, target, object path, file name, media type, and byte size. Registration consumes the
  intent once; authorization is rechecked at registration.
- Confirm the per-user pending and rolling preparation quotas, 20 MB file maximum, permitted type
  and file-signature checks, expired/rejected object cleanup, and private bucket behavior.
- File extension, media-type, size, and file-signature checks are not malware scanning. Before
  allowing broad untrusted uploads for a district, deploy a district-approved malware-scanning
  control or record the district’s explicit acceptance of the residual private-download risk in
  `docs/PRODUCTION_ACCEPTANCE_RECORD.md`. Do not describe signature validation as antivirus.

## 6B. Confirm Shared Club Catalog And Password Recovery

Apply the normal migration chain, including:

```text
supabase/migrations/20260727160000_shared_draft_club_catalog.sql
```

This adds missing private, inactive draft templates to every existing school and
automatically initializes new schools. It does not edit, publish, or replace an
existing club with the same name.

Password recovery uses the existing production Auth callback:

```text
https://stormhubapp.com/auth/callback
```

In Supabase, keep **Authentication > Email Templates > Reset Password** enabled.
If the template was customized, its button must use Supabase's generated
`{{ .ConfirmationURL }}` value. No additional Vercel environment variable is
required. After deployment, request one reset from a non-team mailbox, change
the password, and confirm the old password no longer signs in.

## 7. Verify Scheduled Digest

1. In Vercel, open **Settings > Cron Jobs** after deployment.
2. Confirm `/api/cron/weekly-digest` is scheduled for `0 13 * * 1` (Monday 13:00 UTC).
3. Enable weekly digest for one test user in Settings.
4. Invoke the endpoint once with `Authorization: Bearer <CRON_SECRET>`.
5. Confirm one `digest_deliveries` row and one linked `email_outbox` row exist.
6. Invoke it again and confirm no duplicate email is created.

## 8. Monitoring

1. Configure an external uptime monitor for `https://stormhubapp.com/api/health` every five
   minutes. The unauthenticated response is intentionally generic: `status` and `timestamp` only,
   with HTTP 200 when healthy or 503 when degraded.
2. Treat any non-200 response or two consecutive timeouts as an alert. Do not give a third-party
   public monitor the detailed-health bearer unless its secret handling has been approved.
3. For a restricted operator check, send
   `Authorization: Bearer <HEALTH_CHECK_SECRET>`. The detailed response includes the database,
   private storage, email confirmation/delivery, cron authentication, retention freshness,
   request ID, and duration. Store the bearer as a secret and never paste a detailed response into
   a public ticket.
4. Confirm unauthenticated requests do not receive the `checks`, `emailMode`, `requestId`, or
   `probeDurationMs`/`responseDurationMs` fields, and confirm an incorrect bearer receives only
   the generic response.
5. In Vercel, open **Observability** and review function errors and latency.
6. On Pro/Enterprise with Observability Plus, open **Observability > Alerts**, subscribe to Error
   Anomaly and Usage Anomaly, and route alerts to the pilot owner and backup contact.
7. Test the alert path before inviting pilot users.

## 9. Final Manual Acceptance

Complete the automated suite and the checklist in `docs/PILOT_ACCEPTANCE.md`. Record tester, date,
browser/device, and result. A real district-managed Chromebook is required; emulation alone is not a
device sign-off.

For district production, also complete `docs/PRODUCTION_ACCEPTANCE_RECORD.md`, execute the
district's DPA or other reviewed agreement and
`docs/DISTRICT_PRIVACY_AND_SECURITY_ADDENDUM.md`, and approve the current
`docs/SUBPROCESSOR_REGISTER.md`. Code can enforce technical controls, but it cannot sign for either
party, accept a subprocessor on a district's behalf, verify provider consoles, or prove a
real-device/restore/deletion exercise without an authorized person performing it.

The following acceptance gates are external and remain release-blocking until evidence is recorded:

- the complete migration chain is applied to staging and then production, with the exact linked
  project and final remote migration list captured;
- staging authenticated E2E passes with real fake-role accounts, followed by a district-managed
  Chromebook check;
- the district DPA/addendum is signed and the actual Supabase, Vercel, Resend, hCaptcha, and optional
  Google subprocessors and plans are approved;
- a disposable restore drill and staging-only account/tenant deletion drill pass, including
  deletion replay after restore;
- production SMTP delivery, hCaptcha enforcement, Google sign-in/Drive when enabled, scheduled
  jobs, external health monitoring, and the incident-alert route are exercised from their provider
  consoles.

Before processing a school or district deletion instruction, use **Administration → Tenant
offboarding** and follow `docs/TENANT_OFFBOARDING.md`. Platform approval performs a recoverable,
transactional tenant deactivation. Physical purge remains a reviewed operator change after export,
hold, retention, and evidence checks; it is never triggered by the approval button alone.

## 10. Jurisdiction And Scale Review

The pilot is Nebraska high-school use; district production is not a claim of automatic compliance
in every state. Before adding a district in a new state, have the district/operator review that
state's student-data, breach, records, accessibility, and child-design requirements and record any
contract or product changes.

Track the Nebraska Age-Appropriate Online Design Code thresholds at least quarterly. The law's
covered-business definition includes revenue and consumer/device-count thresholds, and its known-
minor duties include notification quiet periods. StormHub is expected to be below those thresholds
at the present pilot scale, but the owner must record annual revenue, unique Nebraska
consumers/devices, the legal determination, and the next review date. If a threshold is approached,
notification quiet hours and the full statutory control set become release-blocking work rather
than a deferred backlog item.
