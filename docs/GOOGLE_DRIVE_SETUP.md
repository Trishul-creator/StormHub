# Google Drive Coursework Setup

StormHub uses Google Drive only for files a user explicitly selects. It requests
`drive.file`, plus basic OpenID email identity, rather than permission to browse an
entire Drive.

## 1. Create or select a Google Cloud project

Use a district-approved Google Cloud project, then enable:

- Google Drive API
- Google Picker API

Keep the Drive API and Picker in the same project so the OAuth client, browser key,
and numeric project ID belong to one trust boundary.

Official references:

- [Google Drive API authorization scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)
- [Google Picker web integration](https://developers.google.com/workspace/drive/picker/guides/web-picker)
- [Google OAuth for web-server applications](https://developers.google.com/identity/protocols/oauth2/web-server)

## 2. Configure the OAuth consent screen

1. Set the application name to StormHub and use the district-approved support contact.
2. Use **Internal** audience when the app is limited to one Google Workspace
   organization. Otherwise use **External**, add pilot users as test users, and
   complete the required Google publishing review before the wider pilot.
3. Declare these scopes:

```text
openid
email
https://www.googleapis.com/auth/drive.file
```

`drive.file` permits StormHub to work only with files created by the app or selected
through Google Picker. Do not replace it with the full `drive` scope.

## 3. Create the web OAuth client

Create an OAuth 2.0 client of type **Web application**. Add an exact redirect URI for
each environment:

```text
http://localhost:3000/api/integrations/google-drive/callback
https://<staging-host>/api/integrations/google-drive/callback
https://stormhubapp.com/api/integrations/google-drive/callback
```

The host must match `NEXT_PUBLIC_SITE_URL` for that deployment. Copy the client ID and
client secret into the server-only environment variables below.

## 4. Create and restrict the Picker API key

Create a browser API key and restrict it:

1. Under application restrictions, select **Websites**.
2. Add the exact local, staging, and production origins.
3. Under API restrictions, allow Google Picker API.

Find the numeric Google Cloud **project number** under IAM & Admin > Settings. Google
Picker calls this the App ID.

## 5. Configure environment variables

Generate a 32-byte encryption key:

```bash
openssl rand -base64 32
```

Set these in local development and in the matching Vercel Preview/Production
environment:

```text
GOOGLE_DRIVE_CLIENT_ID=<web OAuth client ID>
GOOGLE_DRIVE_CLIENT_SECRET=<web OAuth client secret>
GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY=<generated 32-byte base64 value>
NEXT_PUBLIC_GOOGLE_DRIVE_API_KEY=<restricted browser API key>
NEXT_PUBLIC_GOOGLE_DRIVE_APP_ID=<numeric Google Cloud project number>
```

Never prefix the client secret or encryption key with `NEXT_PUBLIC_`.

StormHub intentionally shows **Google Drive is not enabled** unless all five values are
present in the environment serving that page. Adding only the OAuth client, or adding
variables to Production but not Preview, leaves the button disabled. After saving the
variables, redeploy that environment because `NEXT_PUBLIC_` values are embedded during
the Next.js build.

If the button is still disabled, check the deployment (not only `.env.local`) for:

```text
GOOGLE_DRIVE_CLIENT_ID
GOOGLE_DRIVE_CLIENT_SECRET
GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY
NEXT_PUBLIC_GOOGLE_DRIVE_API_KEY
NEXT_PUBLIC_GOOGLE_DRIVE_APP_ID
```

Do not paste their values into logs or support messages.

## 6. Apply the database migration

The private bucket, attachment records, encrypted connection records, per-student
copy records, and server-bound direct-upload controls depend on:

```text
supabase/migrations/20260726150000_coursework_attachments_and_drive.sql
supabase/migrations/20260730220000_coursework_upload_intents.sql
supabase/migrations/20260730230000_legal_hold_execution_barriers.sql
supabase/migrations/20260730250000_tenant_deletion_integrity.sql
```

Do not cherry-pick only these files for the current release. Apply the normal migration chain
through `20260730290000_admin_step_up_authentication.sql` to staging first:

```bash
supabase link --project-ref <staging-project-ref>
supabase db push --dry-run
supabase db push
```

Repeat against production only after the PR is merged and the migration is approved.

## 7. Pilot verification

1. Sign in as a teacher sponsor and connect Google Drive from Settings.
2. Create an assignment and attach:
   - one private uploaded file;
   - one Drive reference;
   - one Google Doc with **Make an individual editable copy** enabled.
3. Sign in as a student member and open the assignment.
4. Confirm the private copy appears in Drive and is editable by that student.
5. Attach a private uploaded file and a Picker-selected Drive file, then turn in the work.
6. Sign in as the teacher and confirm both private files and the student copy are visible
   in grading.
7. Confirm another student cannot access those submission files or the first student's copy.
8. Disconnect Drive in Settings and confirm reconnecting restores Picker access.

## Ownership and privacy behavior

- Private uploads are stored in the non-public `coursework-private` Supabase bucket.
  Each signed upload is bound to a ten-minute, server-only database intent containing the exact
  user, assignment, target, storage path, normalized filename, MIME type, and expected byte size.
  Per-user active and rolling count/byte quotas limit abandoned-object abuse. Registration
  rechecks account, tenant, assignment, and membership/management access before atomically
  consuming the intent.
- Registration downloads the stored object (maximum 20 MB), compares its actual Storage metadata
  with the intent, and validates the format signature for supported PDF, image, HEIF, and plain-text
  files. Direct Office, OpenDocument, RTF, and CSV uploads stay disabled; users attach those through
  Google Drive so district Workspace controls remain in the path. Rejected objects are deleted.
  Expired abandoned objects and old terminal intent records are removed by the data-retention worker.
- Downloads use short-lived signed URLs after StormHub rechecks authorization and force a private
  attachment response rather than rendering untrusted content inline.
- A student-copy template is copied by the teacher's connected account. The teacher
  owns the generated copy, and the intended student receives private editor access.
  This keeps the copy available to the teacher for grading without requesting full
  student Drive access.
- Student-selected Drive submissions are shared only with authorized coursework
  managers when Google permits the share.
- OAuth access and refresh tokens are encrypted before database storage. Disconnecting
  Drive revokes the connection and deletes the stored credentials.

These controls validate the declared file format and reduce exposure, but they are not an
antivirus or content-disarm service. Before enabling direct uploads for a broad district rollout
with untrusted external users, the district security acceptance record must either require an
approved malware-scanning service in the upload pipeline or explicitly accept the residual risk
of private, forced-download, signature-validated files. Google Drive attachments remain subject to
the district's Google Workspace security controls.
