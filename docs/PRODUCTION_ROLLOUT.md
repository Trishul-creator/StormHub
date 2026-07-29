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

### One-time staging migration required for this PR

The protected `e2e-staging` check intentionally fails until the staging project has the checked-in
schema. The current failure for `schools.allowed_email_domains` means staging still has the older
manual schema.

1. In the staging Supabase dashboard, open **Settings > General** and copy the **Reference ID**.
2. From this branch, sign in with the Supabase account that owns that staging project and link it:

```bash
supabase login
supabase link --project-ref <staging-reference-id>
supabase migration list
```

3. If the existing staging tables came from `schema.sql`, mark only the baseline as already applied:

```bash
supabase migration repair --status applied 20260701000000
```

4. Compare the migration list with the staging schema. If either `20260710160000` or
   `20260720120000` was previously run manually, repair that exact version as applied. Do not mark
   `20260721120000` applied; that is the new hardening migration that must run.
5. Preview and apply the remaining staging migrations:

```bash
supabase db push --dry-run
supabase db push
```

6. In **Table Editor > schools**, confirm each staging school has `stormhub.test` in
   `allowed_email_domains`, then rerun the failed `Staging E2E` job on PR #7.
7. Re-link the CLI to the intended project before any later database command. The local CLI account
   may have access to unrelated Supabase projects, so never select a project by guesswork.

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

## 4A. Enable Google Authentication

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

Immediately configure approved signup domains in the SQL editor during the maintenance window:

```sql
UPDATE public.schools
SET allowed_email_domains = ARRAY['students.example.edu', 'staff.example.edu']
WHERE slug = 'your-school-slug';
```

Replace the example values with domains controlled by the district. An empty domain list intentionally
blocks new accounts. Use `ARRAY['*']` to accept every verified email domain. Super admins can maintain
the list for any school from the school workspace, and school admins can maintain it for their own
school from `/manage`. The `20260725120000_configurable_school_signup_domains.sql` migration initially
sets Elkhorn South, Elkhorn North, and Lexington East to `ARRAY['*']`.

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
REQUEST_RATE_LIMIT_SECRET=<different random value of at least 32 characters>
SIGNUP_RATE_LIMIT_SECRET=<different random value of at least 32 characters>
AI_FEATURES_ENABLED=false
GROQ_ENABLED=false
AI_DATA_SHARING_APPROVED=false
```

The service-role key, CAPTCHA secret, SMTP/API keys, and rate-limit secrets must never use a
`NEXT_PUBLIC_` name.

### Shared club catalog and password recovery

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

1. Configure an external uptime monitor for `https://stormhubapp.com/api/health` every five minutes.
2. Treat any non-200 response or two consecutive timeouts as an alert.
3. In Vercel, open **Observability** and review function errors and latency.
4. On Pro/Enterprise with Observability Plus, open **Observability > Alerts**, subscribe to Error
   Anomaly and Usage Anomaly, and route alerts to the pilot owner and backup contact.
5. Test the alert path before inviting pilot users.

## 9. Final Manual Acceptance

Complete the automated suite and the checklist in `docs/PILOT_ACCEPTANCE.md`. Record tester, date,
browser/device, and result. A real district-managed Chromebook is required; emulation alone is not a
device sign-off.
