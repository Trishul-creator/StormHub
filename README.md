# StormHub

**StormHub** is a student-built school opportunity and activities hub for **Elkhorn South High School (ESHS)**.

> Student-built platform. Not an official school system unless approved by school administration.

## Quick start

### Demo mode (no Supabase)

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Without Supabase env vars, the app uses built-in demo data. Sign in with any email/password.

### Real Supabase mode

1. **Create a Supabase project** at [supabase.com](https://supabase.com)

2. **Add `.env.local`** in the project root (same folder as `package.json`):

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_xxxxxxxxx
EMAIL_FROM="StormHub <notifications@your-domain.org>"
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Never commit `.env.local`. The service role key is used only by trusted server
code for notification and email-outbox writes; it is never exposed to the
browser. `RESEND_API_KEY` is used only by trusted server code to send
notification emails.

3. **Run database setup** — open Supabase → SQL Editor → paste and run the entire contents of:

```
supabase/setup.sql
```

This creates tables, RLS policies, and seeds Elkhorn South clubs, events, opportunities, and member resources.

4. **Start the app:**

```bash
npm run dev
```

5. **Create an account** at `/auth/sign-up`, then sign in.

6. **Promote yourself to admin** (after your account exists):

```sql
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'your@email.com';
```

Only run this in the Supabase SQL Editor, then sign out and sign back in. The
application always reads roles from `public.profiles.role`; users cannot promote
themselves from the client.

## What works with Supabase

| Feature | Status |
|---------|--------|
| Sign up / sign in / sign out | Supabase Auth |
| Profiles (auto-created on signup) | `profiles` table + trigger |
| Club directory & public pages | Live from database |
| Join / leave club | `club_memberships` |
| Member-only club pages | RLS + membership check |
| Opportunities & bookmarks | Live + toggle bookmark |
| Events & RSVP | Live + upsert RSVP |
| In-app notifications | Club updates, approvals, system/admin messages |
| Email notifications | Resend-backed sending for important/urgent notifications |
| Email outbox | Delivery log + admin retry for pending/failed messages |
| Student dashboard | Joined clubs, events, saved opps |
| Workshops & feedback | Live inserts |
| Admin / manage routes | Role-protected using `profiles.role` |
| Demo mode fallback | Works when env vars are removed |

## Disable demo mode

With Supabase env vars set, the app uses Supabase automatically. To force demo mode even with credentials:

```env
NEXT_PUBLIC_DEMO_MODE=true
```

## Reset demo / seed data

To reset browser demo state, sign out and clear the StormHub site cookies, then
restart the dev server. Do not run database SQL to reset demo mode.

To repair an existing Supabase database without deleting data, run:

```
supabase/fix-current-db.sql
```

## Restrict signups to school emails

In Supabase Dashboard → Authentication → Providers → Email, enable confirmations. Add a check in the `handle_new_user` trigger or use a Supabase Auth hook to reject emails outside `@elkhornsouth.org`.

## Google OAuth (future)

Enable Google provider in Supabase Auth, add redirect URL `https://your-domain/auth/callback`, and configure allowed domains.

## Adding / editing clubs

- **Summer placeholders:** Sponsor names, meeting times, and rooms are seeded as TBD. Update via `/manage/clubs/[slug]/edit` or directly in Supabase when school resumes.
- **New clubs:** Insert into `clubs` with `school_id` for Elkhorn South, or use the manage UI.

## Product scope

StormHub currently focuses on clubs, club membership, announcements, scheduled
events, and action-based opportunities.

- **Events** are scheduled meetings, practices, workshops, info sessions,
  competitions, auditions, deadlines, or other date-based activities.
- **Opportunities** are items students act on: applications, tryouts,
  registrations, auditions, workshops, deadlines, or interest forms.
- Regular weekly meetings belong in Events, not Opportunities.

Volunteering and service-hour tracking are disabled because the school uses a
separate system. The existing database tables are preserved but unused by the
student and approval interfaces.

## Club visibility

A club appears in the public directory only when:

```text
status is interest_open or active
is_listed is true
visibility is public
```

To make a club visible:

```sql
UPDATE public.clubs
SET status = 'interest_open',
    is_listed = TRUE,
    visibility = 'public'
WHERE slug = 'club-slug';
```

To hide a club without deleting it:

```sql
UPDATE public.clubs
SET status = 'paused',
    is_listed = FALSE
WHERE slug = 'club-slug';
```

## Roles

Global roles in `public.profiles.role` are `student`, `teacher`, `admin`, and
`super_admin`. Club-specific roles in `public.club_memberships.role` are
`member`, `officer`, `president`, and `sponsor`.

- Student officers remain global students and receive an `officer` or
  `president` membership for the specific club they manage.
- Teachers receive a `sponsor` membership for each assigned club.
- Admins and super admins manage all clubs without joining them as students.

Administrators manage these assignments from `/admin/users`:

- Admins may change student and teacher accounts and assign teachers to one or
  more clubs.
- Super admins may additionally promote or demote admin-level accounts.
- Users cannot change their own role.

Assigned teachers and administrators manage a club roster from
`/manage/clubs/[slug]/members`. They can remove members or assign students as
member, officer, or president. Student officers can manage club content, but
cannot change the roster.

Content approval rules:

- Admin and super-admin club posts publish immediately.
- Assigned teacher posts publish immediately in their assigned clubs.
- Student officer and president posts remain pending until an assigned teacher
  or administrator approves them.

## Notifications and email

StormHub uses in-app notifications for normal updates. Important or urgent
updates can also send email when a provider is configured.

Notification importance:

- `normal`: in-app only
- `important`: in-app, plus email queue only when selected and allowed by preferences
- `urgent`: in-app, plus email queue by default when allowed by preferences

StormHub currently supports Resend for real notification email. Configure:

```env
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_xxxxxxxxx
EMAIL_FROM="StormHub <notifications@your-domain.org>"
NEXT_PUBLIC_APP_URL=https://your-production-domain.org
```

`EMAIL_FROM` must use a sender address allowed by your Resend account/domain.
StormHub writes every attempted email to `email_outbox`. Successful sends are
marked `sent`; provider/configuration errors are marked `failed` with the error
message. Admins can review and retry pending/failed emails at
`/manage/email-outbox`.

Do not put provider keys in source code. If no provider is configured, in-app
notifications still work, but email attempts are recorded as failed. 
`SUPABASE_SERVICE_ROLE_KEY` is still needed for trusted notification creation,
email-outbox writes, and status updates.

Dashboards are role-specific:

- Students see joined clubs, upcoming events, saved opportunities, and updates.
- Student officers additionally see shortcuts to clubs they manage.
- Teachers see assigned clubs and their pending approvals.
- Admins and super admins see school-wide users, clubs, approvals, and metrics.

## Approving content

Officer submissions default to `pending`. Admins/sponsors approve in `/manage/approvals`. Approved content appears on public/member pages.

## Privacy & safety

- No grades, disciplinary records, or private DMs
- No public student profiles by default
- Users cannot change their own role to admin (database trigger)
- Minimal data collection for club participation only
- Review RLS policies before using real student data

Do not use real student data until your school or project security reviewer has
reviewed the RLS policies, administrator assignments, privacy notice, and data
retention requirements.

## Troubleshooting Supabase

### Signup fails with “Database error saving new user”

The `handle_new_user` trigger is missing or outdated. For an existing project,
run `supabase/fix-current-db.sql`. For a fresh project, run
`supabase/setup.sql`. The fixed trigger creates the Elkhorn South school row if
needed and inserts new profiles as `student`.

### A role update reports success but remains `student`

The old `profiles_prevent_role_escalation` trigger silently restored the prior
role. Run `supabase/fix-current-db.sql`, then promote the account from the SQL
Editor:

```sql
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'your@email.com';
```

Sign out and sign back in after the update. Never add a role selector to normal
profile settings.

### Supabase mode versus demo mode

- Supabase mode is active when both public Supabase variables are present and
  `NEXT_PUBLIC_DEMO_MODE` is not `true`.
- Demo mode is active when the variables are absent or
  `NEXT_PUBLIC_DEMO_MODE=true`.
- A small Demo Mode banner appears in the navigation in demo mode.
- In demo mode, use an email beginning with `admin` to preview administrator
  pages; other demo accounts are students.
- After changing environment variables, restart `npm run dev`.

If Supabase is connected but tables are missing, run `supabase/setup.sql`.
Live query failures do not intentionally fall back to demo records.

## Manual QA checklist

Student flow:

1. Sign up and verify `public.profiles.role = 'student'`.
2. Sign in, join Science Bowl, and open its member page.
3. Bookmark and unbookmark an opportunity.
4. RSVP and cancel an RSVP.
5. Save and unsave an opportunity.
6. Verify `/admin` is blocked.
7. Verify `/manage` is blocked unless the student has an officer membership.
8. Sign out and verify dashboard/member pages require sign-in.

Admin flow:

1. Promote a test account with the SQL above, then sign out and sign back in.
2. Open `/admin/users`, `/manage/analytics`, and `/manage/approvals`.
3. Submit and review an announcement, event, resource, opportunity, and workshop.
4. Verify hidden clubs remain visible in management but not in `/clubs`.
5. Verify approved public content appears publicly and member content appears
   only to active members.

Security checks:

1. A non-member cannot open a club member page.
2. A student cannot update their own role through the API.
3. Officers see only clubs where they have an active officer-level membership.
4. Sponsors manage only clubs where they have an active sponsor membership.
5. Admin accounts see Manage Club rather than Join Club.

## Deployment (Vercel)

1. Push to GitHub
2. Import in Vercel
3. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` as environment variables
4. Set Site URL in Supabase Auth to your production domain
5. Add `https://your-domain/auth/callback` to Supabase redirect URLs

## Project structure

```
app/           Next.js routes
components/    UI (preserved from initial build)
lib/
  auth.ts      Session + profile helpers
  actions.ts   Server actions (join, RSVP, bookmark, etc.)
  data/        Typed data access (Supabase + demo fallback)
  supabase/    Client, server, mode utilities
supabase/
  setup.sql    ← Run this in Supabase SQL Editor
  schema.sql   Schema only
  policies.sql RLS policies
  seed.sql     ESHS seed data
```

## Tech stack

Next.js 15 · TypeScript · Tailwind CSS · Supabase · shadcn/ui · lucide-react · date-fns

## Future roadmap

- Google login restricted to school domain
- Email digest sending (Resend/SendGrid)
- Calendar sync · File uploads · CSV club import
- Multi-school SaaS mode · Sponsor verification
- Export analytics reports
