# Elkhorn fictional demonstration runbook

This environment is a completely fictional StormHub presentation tenant. It is not an official Elkhorn Public Schools deployment and must never be seeded into production.

## Required nonproduction environment

Use a Supabase local project, branch, staging project, or preview project. Do not reuse Production credentials. Put the values in an ignored file such as `.env.demo.local` and load them into the current shell; never commit the file.

```env
STORMHUB_DEMO_MODE=true
ALLOW_ELKHORN_DEMO_SEED=ELKHORN_DEMO_CONFIRMED
STORMHUB_DEMO_TARGET=preview
DEMO_SUPABASE_PROJECT_REF=<exact-ref-from-the-nonproduction-Supabase-URL>
DEMO_ACCOUNT_PASSWORD=<at-least-16-chars-with-upper-lower-number-symbol>
NEXT_PUBLIC_SUPABASE_URL=https://<same-nonproduction-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<nonproduction-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<nonproduction-service-role-key>
NEXT_PUBLIC_SITE_URL=<preview-url>
EMAIL_DELIVERY_MODE=outbox_only
EMAIL_PROVIDER=disabled
AI_FEATURES_ENABLED=false
GROQ_ENABLED=false
```

For local Supabase, use its local URL and keys. `STORMHUB_DEMO_TARGET` and `DEMO_SUPABASE_PROJECT_REF` are not required when the URL host is `localhost` or `127.0.0.1`.

The runner refuses `NODE_ENV=production`, `VERCEL_ENV=production`, the documented Production Supabase project reference, a mismatched hosted project reference, missing confirmations, or a weak password. It never prints the password.

## Prepare, seed, and verify

1. Link the CLI only to the nonproduction Supabase project and apply the current migration chain:

   ```bash
   npx supabase db push --dry-run
   npx supabase db push
   ```

2. Load the ignored environment file:

   ```bash
   set -a
   source .env.demo.local
   set +a
   ```

3. Seed and verify. Run the seed twice during initial setup to prove idempotency:

   ```bash
   npm run demo:seed:elkhorn
   npm run demo:seed:elkhorn
   npm run demo:verify:elkhorn
   ```

4. Configure the Preview deployment with the same nonproduction Supabase URL/keys and `STORMHUB_DEMO_MODE=true`, then redeploy. Do not set `NEXT_PUBLIC_DEMO_MODE`; that flag uses StormHub's separate logged-out sample-data mode rather than this live Supabase tenant.

5. Confirm the amber authenticated-page banner reads:

   > DEMONSTRATION ENVIRONMENT — All users and data shown are fictional. This is not an official Elkhorn Public Schools deployment.

## Browser profiles

Create separate Chrome profiles so role changes do not require signing out during the meeting:

1. **StormHub — Jordan**: `jordan.lee@demo.stormhubapp.com`
2. **StormHub — Elena**: `elena.carter@demo.stormhubapp.com`
3. **StormHub — Alex**: `alex.morgan@demo.stormhubapp.com`
4. **StormHub — Dana (backup)**: `dana.mitchell@demo.stormhubapp.com`

Sign each profile in before the meeting with the value currently stored in `DEMO_ACCOUNT_PASSWORD`. Open the target page in each profile, keep light mode selected, and close unrelated tabs. The profiles have old onboarding timestamps and current policy acceptances, so tours and policy gates should not interrupt the route.

## Exact four-minute live-demo click path

Rehearse once after every reset. Do not improvise destructive actions.

| Time | Browser profile | Click path and narration |
| --- | --- | --- |
| 0:00–0:20 | Jordan | Start on **Dashboard**. Point out upcoming Robotics work, events, announcements, and opportunities generated from actual records. |
| 0:20–0:45 | Jordan | Open **Clubs**, search `Robotics`, and open **Engineering & Robotics Club**. Show description, Advisor, meeting location, roster, announcement, and upcoming event. |
| 0:45–1:00 | Jordan | Open **Robotics New-Member Open Lab** and show the existing RSVP. If reset changed it, choose **Going**. |
| 1:00–1:30 | Jordan | Open **Manage → Engineering & Robotics → Create → Announcements**. Find **Robotics Open Lab — Room Update** and choose **Submit for staff approval**. Explain that it remains private. |
| 1:30–2:05 | Elena | Switch browser profiles. Open **Manage → Approval Queue**. Open the prepared announcement and choose **Approve**. Briefly point out **Revise** and **Reject** without clicking them. |
| 2:05–2:40 | Alex | Switch browser profiles. Open **Manage → Add a club**. Find **Photography Club**, open its workspace, review it, and use the existing publication controls to make it active/listed. Assign a fictional Advisor only after publication if the interface requires it. |
| 2:40–3:15 | Alex | Open **Administration → Users & roles** to show school-scoped people and Advisor assignments, then **Statistics** to show metrics derived from profiles, memberships, events, RSVPs, opportunities, and activity records. |
| 3:15–3:40 | Jordan | Return to Jordan and open the Robotics club/member page. Show the now-approved announcement and related in-app notification. |
| 3:40–4:00 | Dana, optional | If asked about district expansion, switch to Dana and show the district workspace, its three schools, and district-wide statistics. Do not open platform-wide pages. |

## Rehearsal reset

The seed is the quickest safe way to restore the announcement draft, remove its review request, return Photography Club to an unpublished draft, refresh relative dates, and restore synthetic activity:

```bash
npm run demo:seed:elkhorn
npm run demo:verify:elkhorn
```

Use the full reset only to remove the fictional tenant completely:

```bash
npm run demo:reset:elkhorn
```

The full reset compares the current two platform super-administrator IDs with the pre-seed safety snapshot before deleting demo records. It targets only the stable demo tenant IDs and `@demo.stormhubapp.com` authentication users.

## Backup presentation paths

- **Announcement submission fails:** do not force publication. Show the private draft and Elena's empty/previous queue, explain the staff-review boundary, and use the seeded approved **Build Team Orientation** announcement as the visible result. Rerun seed/verify after the meeting.
- **Approval action fails:** keep the item visibly pending and explain that failure preserves privacy. Show the **Revise**, **Reject**, and **Approve** controls without retrying repeatedly.
- **Photography workflow fails:** show its draft card in Alex's draft catalog and then open an already-active club to demonstrate the published state.
- **Statistics fail:** show the populated school dashboard, club rosters, events, RSVPs, and opportunity states—the source records behind the metrics—rather than quoting numbers from memory.
- **Preview is unavailable:** do not point local credentials at Production. Use a previously verified local/staging deployment or screenshots captured from that same fictional tenant.

## Final pre-meeting checklist

- `npm run demo:verify:elkhorn` passes.
- The Preview banner is visible after login and absent from Production.
- All four browser profiles sign in.
- Jordan's prepared announcement is a private draft.
- Photography Club is a private inactive draft.
- Robotics Open Lab and all main events are future-dated.
- The expired opportunity is absent from active lists.
- The demo email outbox count is zero.
- The two platform super administrators match the safety snapshot.
