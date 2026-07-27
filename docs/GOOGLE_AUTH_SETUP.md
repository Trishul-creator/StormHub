# Google Authentication Production Setup

Google authentication and Google Drive use separate OAuth clients in the same
Google Cloud project:

- **StormHub Sign-In** requests only `openid email profile`.
- **StormHub Drive** requests `openid email drive.file`.

Never put the Sign-In client secret in Vercel or the Drive client secret in
Supabase Auth.

## 1. Google Auth Platform

Set the audience to **External**. The production Sign-In web client uses:

```text
Authorized JavaScript origin:
https://stormhubapp.com

Authorized redirect URI:
https://<supabase-project-ref>.supabase.co/auth/v1/callback
```

The exact Supabase callback is displayed under **Authentication > Providers >
Google**. Declare only the Sign-In identity scopes:

```text
openid
https://www.googleapis.com/auth/userinfo.email
https://www.googleapis.com/auth/userinfo.profile
```

The shared project can also declare `drive.file` for the separate Drive client,
but StormHub does not request Drive access during login.

## 2. Apply the onboarding migration

Apply the normal migration chain, including:

```text
supabase/migrations/20260727043000_google_oauth_onboarding.sql
```

This must be applied before enabling the Google provider. It lets a new verified
Google identity reach school onboarding without assigning a default school.
Email/password users still cannot bypass school selection.

## 3. Supabase Auth

In **Authentication > URL Configuration**, set:

```text
Site URL:
https://stormhubapp.com

Redirect URL:
https://stormhubapp.com/auth/callback
```

In **Authentication > Providers > Google**, enter the **StormHub Sign-In**
client ID and secret, then enable the provider.

Do not change the existing Email provider, confirmation, SMTP, or hCaptcha
settings.

## 4. Enable the production UI

After the migration is applied and the Supabase provider is enabled, add this
Vercel Production variable and redeploy:

```text
NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true
```

The Google buttons remain hidden until this flag is built into the production
deployment. This prevents users from entering a partially configured OAuth
flow during rollout.

## 5. Production verification

After deploying the matching application code:

1. Sign in with an existing password account using the same Google email and
   confirm it reaches the existing profile.
2. Sign in with a new Google account and confirm it must select a school.
3. Confirm a school with `allowed_email_domains = ARRAY['*']` accepts the
   verified Google email.
4. Confirm a restricted school rejects a non-matching Google email.
5. Confirm the resulting account is a student in only the selected school.
6. Confirm password signup and email confirmation still work.

If Google returns `redirect_uri_mismatch`, compare the Sign-In client's Google
redirect URI with the exact Supabase callback. Do not use StormHub's
`/auth/callback` as the Google provider redirect; Supabase redirects there after
it completes the provider exchange.
