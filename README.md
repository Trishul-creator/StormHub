# StormHub

StormHub is a Next.js + Supabase student opportunity hub for school clubs, events, announcements, resources, opportunities, notifications, and role-based management.

The app is currently configured for an Elkhorn South pilot school, but the internal structure is now prepared for additional school workspaces.

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
EMAIL_DELIVERY_MODE=resend
RESEND_API_KEY=
EMAIL_FROM="StormHub <notifications@stormhubapp.com>"
SUPABASE_SERVICE_ROLE_KEY=
SIGNUP_ACCESS_CODE=
ALLOWED_SIGNUP_EMAIL_DOMAINS=
GROQ_API_KEY=
```

`SUPABASE_SERVICE_ROLE_KEY` is server-only. Do not expose it in client code.

Real email delivery uses Resend when `EMAIL_DELIVERY_MODE=resend`, `RESEND_API_KEY`, and `EMAIL_FROM` are set. If `EMAIL_DELIVERY_MODE` is omitted but `RESEND_API_KEY` exists, StormHub also uses Resend for backward compatibility.

## Database setup

For an existing project, run the SQL patches in Supabase SQL Editor in this order:

1. `supabase/fix-current-db.sql`
2. `supabase/allow-club-leaders-publish.sql`
3. `supabase/improve-signups-roster-and-profile.sql`
4. `supabase/multi-school-platform-cleanup.sql`

The final patch adds school settings/metadata, keeps the Elkhorn South pilot school, hides standalone non-core modules by default, and creates a minimal pilot opportunity set.

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
- `SUPABASE_SERVICE_ROLE_KEY`

Optional production env vars:

- `SIGNUP_ACCESS_CODE`
- `ALLOWED_SIGNUP_EMAIL_DOMAINS`
- `GROQ_API_KEY`
- Set `EMAIL_DELIVERY_MODE=in_app_only` only if outbound email should be disabled.

After changing Vercel env vars, redeploy.

## Current product boundaries

Enabled core surfaces:

- Clubs and membership
- Club announcements
- Club events/calendar
- Club resources
- School-wide opportunities
- In-app notifications
- Feedback/admin response
- AI assistant with app-focused guardrails
- Admin/user/role management
- Super-admin school workspace creation

Hidden/non-core surfaces:

- Service hours
- Volunteering module
- Standalone workshops
- Email outbox UI
