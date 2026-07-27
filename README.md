# StormHub

StormHub is a Next.js + Supabase platform for school club discovery, calendars, opportunities, club portals, in-app notifications, controlled important/urgent email notifications, school management, and support/contact workflows.

The public `/` page is a neutral platform landing page. Each school is a separate workspace. Super admins manage the platform through `/admin/schools`; school admins manage one assigned school.

## Core stack

- Next.js App Router
- Supabase Auth, Postgres, and RLS
- Vercel hosting
- In-app notifications plus Resend email delivery
- Optional, district-approved Groq assistant integration (disabled by default)

## Local environment

Copy `.env.example` to `.env.local` and fill the values:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_DEFAULT_SCHOOL_SLUG=elkhorn-south
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SITE_URL=http://localhost:3000
SUPPORT_EMAIL=stormhubsupport@gmail.com
NEXT_PUBLIC_SUPPORT_EMAIL=stormhubsupport@gmail.com
EMAIL_DELIVERY_MODE=outbox_only
RESEND_API_KEY=
EMAIL_FROM="StormHub <noreply@stormhubapp.com>"
EMAIL_REPLY_TO=stormhubsupport@gmail.com
SUPABASE_SERVICE_ROLE_KEY=
SIGNUP_ACCESS_CODE=
ALLOWED_SIGNUP_EMAIL_DOMAINS=
NEXT_PUBLIC_HCAPTCHA_SITE_KEY=
HCAPTCHA_SECRET_KEY=
CRON_SECRET=
REQUEST_RATE_LIMIT_SECRET=
AI_FEATURES_ENABLED=false
GROQ_ENABLED=false
AI_DATA_SHARING_APPROVED=false
```

`SUPABASE_SERVICE_ROLE_KEY` is server-only. Do not expose it in client code.

Email delivery modes:

- `EMAIL_DELIVERY_MODE=disabled`: do not create or send email records.
- `EMAIL_DELIVERY_MODE=outbox_only`: queue/log email records without sending real email. Recommended for development.
- `EMAIL_DELIVERY_MODE=send`: send through the configured provider. Requires `RESEND_API_KEY`.

Normal updates stay inside StormHub. Important or urgent updates may also be emailed. Replies should go to `stormhubsupport@gmail.com` through `EMAIL_REPLY_TO`.

## Database setup

The timestamped migration chain in `supabase/migrations` is the database source of truth.
For local development:

```bash
supabase start
supabase db reset
supabase test db
```

The files directly under `supabase/*.sql` are retained only as legacy/manual references. Do not apply
them to a new database. Existing production rollout and one-time baseline repair steps are in
`docs/PRODUCTION_ROLLOUT.md`.

## Development

```bash
npm install
npm run dev
```

Useful checks:

```bash
npm run lint
npm run build
npm run test
npm run test:e2e:readonly
supabase test db
```

## Deployment

Deploy through Vercel from the GitHub repository. Required production env vars:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_DEFAULT_SCHOOL_SLUG`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SITE_URL`
- `SUPPORT_EMAIL`
- `NEXT_PUBLIC_SUPPORT_EMAIL`
- `EMAIL_DELIVERY_MODE`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `EMAIL_REPLY_TO`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_HCAPTCHA_SITE_KEY`
- `HCAPTCHA_SECRET_KEY`
- `CRON_SECRET`
- `REQUEST_RATE_LIMIT_SECRET`

Optional production env vars:

- `SIGNUP_ACCESS_CODE`
- `ALLOWED_SIGNUP_EMAIL_DOMAINS`
- `GROQ_API_KEY`, only after district approval
- `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`, and
  `GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY` for server-side Google Drive authorization
- `NEXT_PUBLIC_GOOGLE_DRIVE_API_KEY` and `NEXT_PUBLIC_GOOGLE_DRIVE_APP_ID`
  for the Google Picker
- `EMAIL_DELIVERY_MODE=outbox_only` for queue-only testing.
- `EMAIL_DELIVERY_MODE=send` for real Resend delivery.

After changing Vercel env vars, redeploy.
See `docs/GOOGLE_DRIVE_SETUP.md` for the Google Cloud consent screen, redirect URI,
API-key restrictions, and pilot test steps.

## Current product boundaries

Enabled core surfaces:

- Clubs and membership
- Searchable school draft-club catalog with shared starter templates
- Club announcements
- Club events/calendar
- Club resources
- School-wide opportunities
- In-app notifications
- Controlled important/urgent email notifications
- Support/contact through stormhubsupport@gmail.com
- Weekly digest delivery with idempotent scheduling
- Account suspension, graduation deactivation, data export, and deletion requests
- Immutable administrative audit log
- School admin/user/role management
- Super-admin school workspace creation
- Email/password confirmation, password recovery, and Google sign-in
- Optional AI assistant, disabled until district approval

Roles:

- `student`: school-specific student account
- `teacher`: school-specific teacher/sponsor account
- `admin`: school admin for one school
- `super_admin`: platform admin; creates and manages school workspaces

Routes:

- `/`: neutral StormHub platform landing page
- `/s/[schoolSlug]`: public school workspace
- `/admin/schools`: super admin platform dashboard and school chooser
- `/manage`: school management dashboard for school admins/teachers
- `/dashboard`: student dashboard

Hidden/non-core surfaces:

- Service hours
- Volunteering module
- Standalone workshops
- Billing
