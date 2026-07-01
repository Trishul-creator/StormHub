# StormHub

StormHub is a Next.js + Supabase platform for school club discovery, calendars, opportunities, club portals, in-app notifications, controlled important/urgent email notifications, school management, and support/contact workflows.

The public `/` page is a neutral platform landing page. Each school is a separate workspace. Super admins manage the platform through `/admin/schools`; school admins manage one assigned school.

## Core stack

- Next.js App Router
- Supabase Auth, Postgres, and RLS
- Vercel hosting
- In-app notifications plus Resend email delivery
- Optional Groq assistant integration

## Local environment

Copy `.env.example` to `.env.local` and fill the values:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_DEFAULT_SCHOOL_SLUG=elkhorn-south
NEXT_PUBLIC_APP_URL=http://localhost:3000
SUPPORT_EMAIL=stormhubsupport@gmail.com
NEXT_PUBLIC_SUPPORT_EMAIL=stormhubsupport@gmail.com
EMAIL_DELIVERY_MODE=outbox_only
RESEND_API_KEY=
EMAIL_FROM="StormHub <noreply@stormhubapp.com>"
EMAIL_REPLY_TO=stormhubsupport@gmail.com
SUPABASE_SERVICE_ROLE_KEY=
SIGNUP_ACCESS_CODE=
ALLOWED_SIGNUP_EMAIL_DOMAINS=
GROQ_API_KEY=
```

`SUPABASE_SERVICE_ROLE_KEY` is server-only. Do not expose it in client code.

Email delivery modes:

- `EMAIL_DELIVERY_MODE=disabled`: do not create or send email records.
- `EMAIL_DELIVERY_MODE=outbox_only`: queue/log email records without sending real email. Recommended for development.
- `EMAIL_DELIVERY_MODE=send`: send through the configured provider. Requires `RESEND_API_KEY`.

Normal updates stay inside StormHub. Important or urgent updates may also be emailed. Replies should go to `stormhubsupport@gmail.com` through `EMAIL_REPLY_TO`.

## Database setup

For an existing project, run the SQL patches in Supabase SQL Editor in this order:

1. `supabase/fix-current-db.sql`
2. `supabase/allow-club-leaders-publish.sql`
3. `supabase/improve-signups-roster-and-profile.sql`
4. `supabase/multi-school-platform-cleanup.sql`

The final patch adds school settings/metadata, preserves existing schools such as Elkhorn South and Elkhorn North, allows platform-level super admins to be schoolless, hides standalone non-core modules by default, and creates a minimal pilot opportunity set for Elkhorn South.

## Development

```bash
npm install
npm run dev
```

Useful checks:

```bash
npm run lint
npm run build
```

## Deployment

Deploy through Vercel from the GitHub repository. Required production env vars:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_DEFAULT_SCHOOL_SLUG`
- `NEXT_PUBLIC_APP_URL`
- `SUPPORT_EMAIL`
- `NEXT_PUBLIC_SUPPORT_EMAIL`
- `EMAIL_DELIVERY_MODE`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `EMAIL_REPLY_TO`
- `SUPABASE_SERVICE_ROLE_KEY`

Optional production env vars:

- `SIGNUP_ACCESS_CODE`
- `ALLOWED_SIGNUP_EMAIL_DOMAINS`
- `GROQ_API_KEY`
- `EMAIL_DELIVERY_MODE=outbox_only` for queue-only testing.
- `EMAIL_DELIVERY_MODE=send` for real Resend delivery.

After changing Vercel env vars, redeploy.

## Current product boundaries

Enabled core surfaces:

- Clubs and membership
- Club announcements
- Club events/calendar
- Club resources
- School-wide opportunities
- In-app notifications
- Controlled important/urgent email notifications
- Support/contact through stormhubsupport@gmail.com
- AI assistant with app-focused guardrails
- School admin/user/role management
- Super-admin school workspace creation

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
