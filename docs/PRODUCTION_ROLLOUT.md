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
3. In Supabase, open **Authentication > Settings > SMTP Settings** and enable custom SMTP.
4. Enter these values:

| Supabase field | Value |
| --- | --- |
| Sender email | `auth@stormhubapp.com` (or an address on the verified sending domain) |
| Sender name | `StormHub` |
| Host | `smtp.resend.com` |
| Port | `465` |
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

## 4. Enable Admin MFA

1. In Supabase, open **Authentication > Multi-Factor Authentication**.
2. Enable TOTP enrollment and TOTP verification.
3. Deploy the application code before applying the hardening migration.
4. Have every admin and super admin sign in and open `/auth/mfa`.
5. Scan the QR code with an authenticator app, enter the six-digit code, and store recovery access
   according to district policy.
6. Confirm an AAL1 admin is redirected to `/auth/mfa` and an AAL2 admin can open `/admin`.

Do not share one administrator account. Every administrator needs an individual account and factor.

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
blocks new accounts. After the super admin has AAL2, the same list can be maintained in the school
workspace under **Signup protection**.

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
